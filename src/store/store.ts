import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { makeId } from '../lib/id';
import { todayISO, streakContinues } from '../lib/dates';
import { DEFAULT_BADGES, DEFAULT_FEATURE_TOGGLES } from './badges';
import type {
  Student,
  Subject,
  Task,
  ProgressMap,
  SubjectProgress,
  BreakRequest,
  HelpPing,
  OffscreenReview,
  BadgeDef,
  BadgeEarn,
  BreakPoolItem,
  ToolKey,
  QuizRuntimeState,
  StudentStatus,
} from '../types';

const emptyProgress = (): SubjectProgress => ({
  date: todayISO(),
  activeIndex: 0,
  completedTaskIds: [],
  quizState: {},
  sessionRitualSeen: false,
  subjectComplete: false,
});

interface AppState {
  students: Student[];
  rotations: Record<string, Record<Subject, Task[]>>;
  progress: ProgressMap;
  breakRequests: BreakRequest[];
  helpPings: HelpPing[];
  offscreenReviews: OffscreenReview[];
  badges: BadgeDef[];
  badgeEarns: BadgeEarn[];
  breakPool: BreakPoolItem[];
  taskCompletionCounts: Record<string, number>; // `${studentId}:${taskId}` -> lifetime completions
  toolUsage: Record<string, ToolKey[]>; // studentId -> tool keys ever used
  correctionsCount: Record<string, number>; // studentId -> total recycle-corrections
  onboardedIds: string[]; // students who've seen the one-time first-login walkthrough
  scratchText: Record<string, string>; // studentId -> word processor autosave text

  currentStudentId: string | null;
  role: 'none' | 'teacher' | 'student';

  // session
  setRole: (r: 'none' | 'teacher' | 'student') => void;
  loginStudent: (id: string) => void;
  logoutStudent: () => void;

  // students
  addStudent: (name: string, avatar: string) => string;
  updateStudent: (id: string, patch: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  setFeatureToggle: (studentId: string, tool: ToolKey, enabled: boolean) => void;
  setStreak: (studentId: string, streak: number) => void;

  // rotations
  getTasks: (studentId: string, subject: Subject) => Task[];
  addTask: (studentId: string, subject: Subject, task: Task) => void;
  updateTask: (studentId: string, subject: Subject, taskId: string, patch: Partial<Task>) => void;
  deleteTask: (studentId: string, subject: Subject, taskId: string) => void;
  reorderTasks: (studentId: string, subject: Subject, fromIndex: number, toIndex: number) => void;

  // progress / session flow
  ensureProgress: (studentId: string, subject: Subject) => SubjectProgress;
  markRitualSeen: (studentId: string, subject: Subject) => void;
  getActiveTask: (studentId: string, subject: Subject) => Task | null;
  completeTask: (studentId: string, subject: Subject, taskId: string) => void;
  markOffscreenDone: (studentId: string, subject: Subject, task: Task) => void;
  recordToolUsage: (studentId: string, tool: ToolKey) => void;

  // quiz
  ensureQuizState: (studentId: string, subject: Subject, task: Task) => QuizRuntimeState;
  submitQuizAnswer: (studentId: string, subject: Subject, task: Task, questionId: string, correct: boolean) => void;

  // breaks
  requestBreak: (studentId: string) => void;
  grantBreak: (studentId: string) => void;
  approveBreak: (requestId: string) => void;
  denyBreak: (requestId: string) => void;
  finishBreak: (requestId: string) => void;
  getStudentBreakState: (studentId: string) => BreakRequest | null;
  breakCountToday: (studentId: string) => number;

  // help
  pingHelp: (studentId: string) => void;
  resolveHelp: (id: string) => void;

  // offscreen review
  verifyOffscreen: (id: string) => void;

  // badges
  addBadge: (badge: Omit<BadgeDef, 'id'>) => void;
  updateBadge: (id: string, patch: Partial<BadgeDef>) => void;
  deleteBadge: (id: string) => void;
  awardBadge: (studentId: string, badgeId: string) => void;

  // break pool
  addBreakPoolItem: (item: Omit<BreakPoolItem, 'id'>) => void;
  deleteBreakPoolItem: (id: string) => void;

  // derived
  studentStatus: (studentId: string) => StudentStatus;

  markOnboarded: (studentId: string) => void;
  setScratchText: (studentId: string, text: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      students: [],
      rotations: {},
      progress: {},
      breakRequests: [],
      helpPings: [],
      offscreenReviews: [],
      badges: DEFAULT_BADGES,
      badgeEarns: [],
      breakPool: [],
      taskCompletionCounts: {},
      toolUsage: {},
      correctionsCount: {},
      onboardedIds: [],
      scratchText: {},

      currentStudentId: null,
      role: 'none',

      setRole: (r) => set({ role: r }),
      loginStudent: (id) => set({ currentStudentId: id, role: 'student' }),
      logoutStudent: () => set({ currentStudentId: null, role: 'none' }),

      addStudent: (name, avatar) => {
        const id = makeId();
        const student: Student = {
          id,
          name,
          avatar,
          streak: 0,
          lastCompletedDate: null,
          streakHidden: false,
          badgeIds: [],
          featureToggles: { ...DEFAULT_FEATURE_TOGGLES },
          breakMinutes: 4,
          ttsSettings: { rate: 1, voiceURI: null },
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          students: [...s.students, student],
          rotations: { ...s.rotations, [id]: { math: [], literacy: [] } },
        }));
        return id;
      },

      updateStudent: (id, patch) =>
        set((s) => ({ students: s.students.map((st) => (st.id === id ? { ...st, ...patch } : st)) })),

      deleteStudent: (id) =>
        set((s) => {
          const rotations = { ...s.rotations };
          delete rotations[id];
          const progress = { ...s.progress };
          delete progress[id];
          return {
            students: s.students.filter((st) => st.id !== id),
            rotations,
            progress,
            currentStudentId: s.currentStudentId === id ? null : s.currentStudentId,
          };
        }),

      setFeatureToggle: (studentId, tool, enabled) =>
        set((s) => ({
          students: s.students.map((st) =>
            st.id === studentId ? { ...st, featureToggles: { ...st.featureToggles, [tool]: enabled } } : st,
          ),
        })),

      setStreak: (studentId, streak) =>
        set((s) => ({ students: s.students.map((st) => (st.id === studentId ? { ...st, streak } : st)) })),

      getTasks: (studentId, subject) => get().rotations[studentId]?.[subject] ?? [],

      addTask: (studentId, subject, task) =>
        set((s) => {
          const studentRot = s.rotations[studentId] ?? { math: [], literacy: [] };
          return {
            rotations: {
              ...s.rotations,
              [studentId]: { ...studentRot, [subject]: [...studentRot[subject], task] },
            },
          };
        }),

      updateTask: (studentId, subject, taskId, patch) =>
        set((s) => {
          const studentRot = s.rotations[studentId];
          if (!studentRot) return {};
          return {
            rotations: {
              ...s.rotations,
              [studentId]: {
                ...studentRot,
                [subject]: studentRot[subject].map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
              },
            },
          };
        }),

      deleteTask: (studentId, subject, taskId) =>
        set((s) => {
          const studentRot = s.rotations[studentId];
          if (!studentRot) return {};
          return {
            rotations: {
              ...s.rotations,
              [studentId]: {
                ...studentRot,
                [subject]: studentRot[subject].filter((t) => t.id !== taskId),
              },
            },
          };
        }),

      reorderTasks: (studentId, subject, fromIndex, toIndex) =>
        set((s) => {
          const studentRot = s.rotations[studentId];
          if (!studentRot) return {};
          const list = [...studentRot[subject]];
          const [moved] = list.splice(fromIndex, 1);
          list.splice(toIndex, 0, moved);
          return {
            rotations: { ...s.rotations, [studentId]: { ...studentRot, [subject]: list } },
          };
        }),

      ensureProgress: (studentId, subject) => {
        const s = get();
        const today = todayISO();
        const existing = s.progress[studentId]?.[subject];
        if (existing && existing.date === today) return existing;
        const fresh = emptyProgress();
        set((st) => ({
          progress: {
            ...st.progress,
            [studentId]: { ...(st.progress[studentId] ?? {}), [subject]: fresh } as ProgressMap[string],
          },
        }));
        return fresh;
      },

      markRitualSeen: (studentId, subject) => {
        get().ensureProgress(studentId, subject);
        set((s) => {
          const sp = s.progress[studentId][subject];
          return {
            progress: {
              ...s.progress,
              [studentId]: { ...s.progress[studentId], [subject]: { ...sp, sessionRitualSeen: true } },
            },
          };
        });
      },

      getActiveTask: (studentId, subject) => {
        const tasks = get().getTasks(studentId, subject);
        const prog = get().ensureProgress(studentId, subject);
        return tasks[prog.activeIndex] ?? null;
      },

      recordToolUsage: (studentId, tool) => {
        const used = get().toolUsage[studentId] ?? [];
        if (used.includes(tool)) return;
        set((s) => ({ toolUsage: { ...s.toolUsage, [studentId]: [...used, tool] } }));
        get().awardBadge(studentId, 'explorer');
      },

      completeTask: (studentId, subject, taskId) => {
        get().ensureProgress(studentId, subject);
        const tasks = get().getTasks(studentId, subject);
        const today = todayISO();

        set((s) => {
          const sp = s.progress[studentId][subject];
          if (sp.completedTaskIds.includes(taskId)) return {};
          const completedTaskIds = [...sp.completedTaskIds, taskId];
          const nextIndex = sp.activeIndex + 1;
          const subjectComplete = nextIndex >= tasks.length;
          return {
            progress: {
              ...s.progress,
              [studentId]: {
                ...s.progress[studentId],
                [subject]: { ...sp, completedTaskIds, activeIndex: nextIndex, subjectComplete },
              },
            },
          };
        });

        // lifetime completion count -> practice-makes-progress badge
        const key = `${studentId}:${taskId}`;
        const count = (get().taskCompletionCounts[key] ?? 0) + 1;
        set((s) => ({ taskCompletionCounts: { ...s.taskCompletionCounts, [key]: count } }));
        if (count === 3) get().awardBadge(studentId, 'practice-progress');

        const student = get().students.find((st) => st.id === studentId);

        // streak: increments once both subjects are complete for today
        const other: Subject = subject === 'math' ? 'literacy' : 'math';
        const otherTasks = get().getTasks(studentId, other);
        const otherProg = get().progress[studentId]?.[other];
        const otherDone = otherTasks.length === 0 || (otherProg && otherProg.date === today && otherProg.subjectComplete);
        const thisNowComplete = get().progress[studentId][subject].subjectComplete;
        if (thisNowComplete && otherDone && student && student.lastCompletedDate !== today) {
          const continued = streakContinues(student.lastCompletedDate, today);
          const newStreak = continued ? student.streak + 1 : 1;
          get().updateStudent(studentId, { streak: newStreak, lastCompletedDate: today });
          get().awardBadge(studentId, 'showed-up');
        }
      },

      markOffscreenDone: (studentId, subject, task) => {
        const review: OffscreenReview = {
          id: makeId(),
          studentId,
          subject,
          taskId: task.id,
          taskTitle: task.title,
          timestamp: new Date().toISOString(),
          verified: false,
        };
        set((s) => ({ offscreenReviews: [review, ...s.offscreenReviews] }));
        get().completeTask(studentId, subject, task.id);
      },

      ensureQuizState: (studentId, subject, task) => {
        get().ensureProgress(studentId, subject);
        const sp = get().progress[studentId][subject];
        const existing = sp.quizState[task.id];
        if (existing) return existing;
        const ids = (task.quiz?.questions ?? []).map((q) => q.id);
        const shuffled = [...ids].sort(() => Math.random() - 0.5);
        const fresh: QuizRuntimeState = { remainingIds: shuffled, masteredIds: [], log: [] };
        set((s) => {
          const cur = s.progress[studentId][subject];
          return {
            progress: {
              ...s.progress,
              [studentId]: {
                ...s.progress[studentId],
                [subject]: { ...cur, quizState: { ...cur.quizState, [task.id]: fresh } },
              },
            },
          };
        });
        return fresh;
      },

      submitQuizAnswer: (studentId, subject, task, questionId, correct) => {
        const state = get().ensureQuizState(studentId, subject, task);
        const wasMissedBefore = state.log.some((l) => l.questionId === questionId && !l.correct);
        const log = [...state.log, { questionId, timestamp: new Date().toISOString(), correct }];
        let remainingIds = state.remainingIds.filter((id) => id !== questionId);
        let masteredIds = state.masteredIds;
        if (correct) {
          masteredIds = [...masteredIds, questionId];
          if (wasMissedBefore) {
            const n = (get().correctionsCount[studentId] ?? 0) + 1;
            set((s) => ({ correctionsCount: { ...s.correctionsCount, [studentId]: n } }));
            if (n === 3) get().awardBadge(studentId, 'great-correction');
          }
        } else {
          // reinsert at a random spot further back so it isn't asked again immediately
          const insertAt = remainingIds.length === 0 ? 0 : Math.floor(Math.random() * remainingIds.length) + 1;
          remainingIds = [...remainingIds.slice(0, insertAt), questionId, ...remainingIds.slice(insertAt)];
        }
        const next: QuizRuntimeState = { remainingIds, masteredIds, log };
        set((s) => {
          const cur = s.progress[studentId][subject];
          return {
            progress: {
              ...s.progress,
              [studentId]: {
                ...s.progress[studentId],
                [subject]: { ...cur, quizState: { ...cur.quizState, [task.id]: next } },
              },
            },
          };
        });
      },

      requestBreak: (studentId) =>
        set((s) => ({
          breakRequests: [
            { id: makeId(), studentId, timestamp: new Date().toISOString(), status: 'pending' },
            ...s.breakRequests,
          ],
        })),

      grantBreak: (studentId) =>
        set((s) => ({
          breakRequests: [
            { id: makeId(), studentId, timestamp: new Date().toISOString(), status: 'granted' },
            ...s.breakRequests,
          ],
        })),

      approveBreak: (requestId) =>
        set((s) => ({
          breakRequests: s.breakRequests.map((b) => (b.id === requestId ? { ...b, status: 'approved' } : b)),
        })),

      denyBreak: (requestId) =>
        set((s) => ({
          breakRequests: s.breakRequests.map((b) => (b.id === requestId ? { ...b, status: 'denied' } : b)),
        })),

      finishBreak: (requestId) =>
        set((s) => ({ breakRequests: s.breakRequests.filter((b) => b.id !== requestId) })),

      getStudentBreakState: (studentId) => {
        const mine = get()
          .breakRequests.filter((b) => b.studentId === studentId)
          .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
        return mine[0] ?? null;
      },

      breakCountToday: (studentId) => {
        const today = todayISO();
        return get().breakRequests.filter(
          (b) =>
            b.studentId === studentId &&
            (b.status === 'approved' || b.status === 'granted') &&
            b.timestamp.startsWith(today),
        ).length;
      },

      pingHelp: (studentId) =>
        set((s) => ({
          helpPings: [{ id: makeId(), studentId, timestamp: new Date().toISOString(), resolved: false }, ...s.helpPings],
        })),

      resolveHelp: (id) =>
        set((s) => ({ helpPings: s.helpPings.map((h) => (h.id === id ? { ...h, resolved: true } : h)) })),

      verifyOffscreen: (id) =>
        set((s) => ({ offscreenReviews: s.offscreenReviews.map((o) => (o.id === id ? { ...o, verified: true } : o)) })),

      addBadge: (badge) => set((s) => ({ badges: [...s.badges, { ...badge, id: makeId() }] })),
      updateBadge: (id, patch) =>
        set((s) => ({ badges: s.badges.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      deleteBadge: (id) => set((s) => ({ badges: s.badges.filter((b) => b.id !== id) })),

      awardBadge: (studentId, badgeId) => {
        const earn: BadgeEarn = { id: makeId(), studentId, badgeId, date: new Date().toISOString() };
        set((s) => ({ badgeEarns: [earn, ...s.badgeEarns] }));
        const student = get().students.find((st) => st.id === studentId);
        if (student && !student.badgeIds.includes(badgeId)) {
          get().updateStudent(studentId, { badgeIds: [...student.badgeIds, badgeId] });
        }
      },

      addBreakPoolItem: (item) => set((s) => ({ breakPool: [...s.breakPool, { ...item, id: makeId() }] })),
      deleteBreakPoolItem: (id) => set((s) => ({ breakPool: s.breakPool.filter((b) => b.id !== id) })),

      studentStatus: (studentId) => {
        const s = get();
        const breakState = s.getStudentBreakState(studentId);
        if (breakState && (breakState.status === 'approved' || breakState.status === 'granted')) return 'on-break';
        if (breakState && breakState.status === 'pending') return 'awaiting-approval';
        const today = todayISO();
        const mathProg = s.progress[studentId]?.math;
        const litProg = s.progress[studentId]?.literacy;
        const mathTasks = s.getTasks(studentId, 'math');
        const litTasks = s.getTasks(studentId, 'literacy');
        const mathDone = mathTasks.length === 0 || (mathProg?.date === today && mathProg.subjectComplete);
        const litDone = litTasks.length === 0 || (litProg?.date === today && litProg.subjectComplete);
        if (mathDone && litDone) return 'done-for-day';
        const started =
          (mathProg?.date === today && mathProg.completedTaskIds.length > 0) ||
          (litProg?.date === today && litProg.completedTaskIds.length > 0);
        return started ? 'working' : 'not-started';
      },

      markOnboarded: (studentId) =>
        set((s) => (s.onboardedIds.includes(studentId) ? {} : { onboardedIds: [...s.onboardedIds, studentId] })),

      setScratchText: (studentId, text) => set((s) => ({ scratchText: { ...s.scratchText, [studentId]: text } })),
    }),
    { name: 'iwd-store' },
  ),
);
