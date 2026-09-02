import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { makeId } from '../lib/id';
import { todayISO, streakContinues, currentDayOfWeek } from '../lib/dates';
import { DEFAULT_BADGES, DEFAULT_FEATURE_TOGGLES } from './badges';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import {
  fetchAll,
  subscribeRealtime,
  applyArrayRow,
  applyNestedRow,
  applyStudentMetaRow,
  rowToStudent,
  rowToProgress,
  rowToBreakRequest,
  rowToHelpPing,
  rowToOffscreenReview,
  rowToBadge,
  rowToBadgeEarn,
  rowToBreakPoolItem,
  rowToQuestionSet,
  rowToActivity,
  rowToTemplate,
  pushStudent,
  deleteStudentRemote,
  pushRotation,
  pushProgress,
  pushBreakRequest,
  deleteBreakRequestRemote,
  pushHelpPing,
  pushOffscreenReview,
  pushBadge,
  deleteBadgeRemote,
  pushBadgeEarn,
  pushBreakPoolItem,
  deleteBreakPoolItemRemote,
  pushQuestionSet,
  deleteQuestionSetRemote,
  pushRotationMode,
  pushStudentMeta,
  pushActivity,
  deleteActivityRemote,
  pushTemplate,
  deleteTemplateRemote,
  rowToWeeklyScheduleEntry,
  pushWeeklyScheduleEntry,
  deleteWeeklyScheduleEntryRemote,
} from '../lib/sync';
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
  RotationMode,
  QuestionSet,
  ActivityLibraryItem,
  PlanTemplate,
  WeeklyScheduleEntry,
  DayOfWeek,
} from '../types';

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}

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
  rotationModes: Record<string, Record<Subject, RotationMode>>; // studentId -> subject -> sequence|choiceboard
  questionSets: QuestionSet[]; // reusable saved quiz/drill question sets
  activityLibrary: ActivityLibraryItem[]; // reusable whole activities, drag into any student's plan
  planTemplates: PlanTemplate[]; // saved, reusable daily plans
  weeklySchedule: WeeklyScheduleEntry[]; // which template auto-loads on which weekday, per student+subject
  weeklyPlanApplied: Record<string, Partial<Record<Subject, string>>>; // studentId -> subject -> ISO date last auto-applied

  hydrated: boolean; // initial fetch from Supabase has completed (or failed)
  hydrationError: string | null;
  initSync: () => Promise<void>;

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

  // rotation display mode (numbered/required vs choice board)
  getRotationMode: (studentId: string, subject: Subject) => RotationMode;
  setRotationMode: (studentId: string, subject: Subject, mode: RotationMode) => void;

  // reusable question/drill sets ("Google Sheet" CSV import lands here too)
  addQuestionSet: (set: Omit<QuestionSet, 'id' | 'createdAt'>) => string;
  updateQuestionSet: (id: string, patch: Partial<QuestionSet>) => void;
  deleteQuestionSet: (id: string) => void;

  // activity library: create once, reuse everywhere (drag into a plan, flag for the Playground)
  addLibraryActivity: (activity: Omit<ActivityLibraryItem, 'id' | 'createdAt'>) => string;
  updateLibraryActivity: (id: string, patch: Partial<ActivityLibraryItem>) => void;
  deleteLibraryActivity: (id: string) => void;
  addActivityToPlan: (studentId: string, subject: Subject, activityId: string) => void;

  // reusable daily-plan templates
  addTemplate: (name: string, subject: Subject, activities: Task[]) => string;
  updateTemplate: (id: string, patch: Partial<PlanTemplate>) => void;
  duplicateTemplate: (id: string) => void;
  deleteTemplate: (id: string) => void;
  saveCurrentPlanAsTemplate: (studentId: string, subject: Subject, name: string) => void;
  applyTemplateToStudent: (studentId: string, templateId: string) => void;

  // weekly schedule: which template auto-loads on which weekday
  getScheduledTemplateId: (studentId: string, subject: Subject, day: DayOfWeek) => string | null;
  setWeeklyScheduleDay: (studentId: string, subject: Subject, day: DayOfWeek, templateId: string | null) => void;
  applyTodaysScheduleIfNeeded: (studentId: string) => void;
}

// Pushes the full consolidated student_meta row for a student, reading the
// current values straight out of the store — used any time one of the five
// pieces it bundles (task completion counts, tool usage, corrections count,
// scratch text, onboarded) changes.
function pushMetaFor(get: () => AppState, studentId: string) {
  const s = get();
  const prefix = `${studentId}:`;
  const taskCompletionCounts: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.taskCompletionCounts)) {
    if (k.startsWith(prefix)) taskCompletionCounts[k.slice(prefix.length)] = v;
  }
  pushStudentMeta(studentId, {
    taskCompletionCounts,
    toolUsage: s.toolUsage[studentId] ?? [],
    correctionsCount: s.correctionsCount[studentId] ?? 0,
    scratchText: s.scratchText[studentId] ?? '',
    onboarded: s.onboardedIds.includes(studentId),
    weeklyPlanApplied: s.weeklyPlanApplied[studentId] ?? {},
  });
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
      rotationModes: {},
      questionSets: [],
      activityLibrary: [],
      planTemplates: [],
      weeklySchedule: [],
      weeklyPlanApplied: {},

      hydrated: !isSupabaseConfigured,
      hydrationError: null,
      initSync: async () => {
        if (!isSupabaseConfigured) {
          set({ hydrated: true });
          return;
        }
        try {
          const data = await fetchAll();
          set({ ...data, hydrated: true, hydrationError: null });
        } catch (err) {
          set({ hydrated: true, hydrationError: extractErrorMessage(err) });
          return;
        }
        subscribeRealtime({
          onStudent: (e, n, o) => set((s) => ({ students: applyArrayRow(s.students, e, rowToStudent, n, o) })),
          onRotation: (e, n, o) =>
            set((s) => ({ rotations: applyNestedRow(s.rotations, e, (r) => r.tasks ?? [], n, o) })),
          onProgress: (e, n, o) => set((s) => ({ progress: applyNestedRow(s.progress, e, rowToProgress, n, o) })),
          onBreakRequest: (e, n, o) =>
            set((s) => ({ breakRequests: applyArrayRow(s.breakRequests, e, rowToBreakRequest, n, o) })),
          onHelpPing: (e, n, o) => set((s) => ({ helpPings: applyArrayRow(s.helpPings, e, rowToHelpPing, n, o) })),
          onOffscreenReview: (e, n, o) =>
            set((s) => ({ offscreenReviews: applyArrayRow(s.offscreenReviews, e, rowToOffscreenReview, n, o) })),
          onBadge: (e, n, o) => set((s) => ({ badges: applyArrayRow(s.badges, e, rowToBadge, n, o) })),
          onBadgeEarn: (e, n, o) => set((s) => ({ badgeEarns: applyArrayRow(s.badgeEarns, e, rowToBadgeEarn, n, o) })),
          onBreakPoolItem: (e, n, o) =>
            set((s) => ({ breakPool: applyArrayRow(s.breakPool, e, rowToBreakPoolItem, n, o) })),
          onQuestionSet: (e, n, o) =>
            set((s) => ({ questionSets: applyArrayRow(s.questionSets, e, rowToQuestionSet, n, o) })),
          onRotationMode: (e, n, o) =>
            set((s) => ({ rotationModes: applyNestedRow(s.rotationModes, e, (r) => r.mode, n, o) })),
          onStudentMeta: (e, n, o) => set((s) => applyStudentMetaRow(s, e, n, o)),
          onActivity: (e, n, o) => set((s) => ({ activityLibrary: applyArrayRow(s.activityLibrary, e, rowToActivity, n, o) })),
          onTemplate: (e, n, o) => set((s) => ({ planTemplates: applyArrayRow(s.planTemplates, e, rowToTemplate, n, o) })),
          onWeeklySchedule: (e, n, o) =>
            set((s) => ({ weeklySchedule: applyArrayRow(s.weeklySchedule, e, rowToWeeklyScheduleEntry, n, o) })),
        });
      },

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
          playgroundThreshold: 4,
          ttsSettings: { rate: 1, voiceURI: null },
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          students: [...s.students, student],
          rotations: { ...s.rotations, [id]: { math: [], literacy: [] } },
        }));
        pushStudent(student);
        return id;
      },

      updateStudent: (id, patch) => {
        set((s) => ({ students: s.students.map((st) => (st.id === id ? { ...st, ...patch } : st)) }));
        const updated = get().students.find((st) => st.id === id);
        if (updated) pushStudent(updated);
      },

      deleteStudent: (id) => {
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
        });
        deleteStudentRemote(id);
      },

      setFeatureToggle: (studentId, tool, enabled) => {
        set((s) => ({
          students: s.students.map((st) =>
            st.id === studentId ? { ...st, featureToggles: { ...st.featureToggles, [tool]: enabled } } : st,
          ),
        }));
        const updated = get().students.find((st) => st.id === studentId);
        if (updated) pushStudent(updated);
      },

      setStreak: (studentId, streak) => {
        set((s) => ({ students: s.students.map((st) => (st.id === studentId ? { ...st, streak } : st)) }));
        const updated = get().students.find((st) => st.id === studentId);
        if (updated) pushStudent(updated);
      },

      getTasks: (studentId, subject) => get().rotations[studentId]?.[subject] ?? [],

      addTask: (studentId, subject, task) => {
        set((s) => {
          const studentRot = s.rotations[studentId] ?? { math: [], literacy: [] };
          return {
            rotations: {
              ...s.rotations,
              [studentId]: { ...studentRot, [subject]: [...studentRot[subject], task] },
            },
          };
        });
        pushRotation(studentId, subject, get().rotations[studentId][subject]);
      },

      updateTask: (studentId, subject, taskId, patch) => {
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
        });
        const tasks = get().rotations[studentId]?.[subject];
        if (tasks) pushRotation(studentId, subject, tasks);
      },

      deleteTask: (studentId, subject, taskId) => {
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
        });
        const tasks = get().rotations[studentId]?.[subject];
        if (tasks) pushRotation(studentId, subject, tasks);
      },

      reorderTasks: (studentId, subject, fromIndex, toIndex) => {
        set((s) => {
          const studentRot = s.rotations[studentId];
          if (!studentRot) return {};
          const list = [...studentRot[subject]];
          const [moved] = list.splice(fromIndex, 1);
          list.splice(toIndex, 0, moved);
          return {
            rotations: { ...s.rotations, [studentId]: { ...studentRot, [subject]: list } },
          };
        });
        const tasks = get().rotations[studentId]?.[subject];
        if (tasks) pushRotation(studentId, subject, tasks);
      },

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
        pushProgress(studentId, subject, fresh);
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
        pushProgress(studentId, subject, get().progress[studentId][subject]);
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
        pushMetaFor(get, studentId);
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
        pushProgress(studentId, subject, get().progress[studentId][subject]);

        // lifetime completion count -> practice-makes-progress badge
        const key = `${studentId}:${taskId}`;
        const count = (get().taskCompletionCounts[key] ?? 0) + 1;
        set((s) => ({ taskCompletionCounts: { ...s.taskCompletionCounts, [key]: count } }));
        pushMetaFor(get, studentId);
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
        pushOffscreenReview(review);
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
        pushProgress(studentId, subject, get().progress[studentId][subject]);
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
            pushMetaFor(get, studentId);
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
        pushProgress(studentId, subject, get().progress[studentId][subject]);
      },

      requestBreak: (studentId) => {
        const req: BreakRequest = { id: makeId(), studentId, timestamp: new Date().toISOString(), status: 'pending' };
        set((s) => ({ breakRequests: [req, ...s.breakRequests] }));
        pushBreakRequest(req);
      },

      grantBreak: (studentId) => {
        const req: BreakRequest = { id: makeId(), studentId, timestamp: new Date().toISOString(), status: 'granted' };
        set((s) => ({ breakRequests: [req, ...s.breakRequests] }));
        pushBreakRequest(req);
      },

      approveBreak: (requestId) => {
        set((s) => ({
          breakRequests: s.breakRequests.map((b) => (b.id === requestId ? { ...b, status: 'approved' } : b)),
        }));
        const updated = get().breakRequests.find((b) => b.id === requestId);
        if (updated) pushBreakRequest(updated);
      },

      denyBreak: (requestId) => {
        set((s) => ({
          breakRequests: s.breakRequests.map((b) => (b.id === requestId ? { ...b, status: 'denied' } : b)),
        }));
        const updated = get().breakRequests.find((b) => b.id === requestId);
        if (updated) pushBreakRequest(updated);
      },

      finishBreak: (requestId) => {
        set((s) => ({ breakRequests: s.breakRequests.filter((b) => b.id !== requestId) }));
        deleteBreakRequestRemote(requestId);
      },

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

      pingHelp: (studentId) => {
        const ping: HelpPing = { id: makeId(), studentId, timestamp: new Date().toISOString(), resolved: false };
        set((s) => ({ helpPings: [ping, ...s.helpPings] }));
        pushHelpPing(ping);
      },

      resolveHelp: (id) => {
        set((s) => ({ helpPings: s.helpPings.map((h) => (h.id === id ? { ...h, resolved: true } : h)) }));
        const updated = get().helpPings.find((h) => h.id === id);
        if (updated) pushHelpPing(updated);
      },

      verifyOffscreen: (id) => {
        set((s) => ({ offscreenReviews: s.offscreenReviews.map((o) => (o.id === id ? { ...o, verified: true } : o)) }));
        const updated = get().offscreenReviews.find((o) => o.id === id);
        if (updated) pushOffscreenReview(updated);
      },

      addBadge: (badge) => {
        const full: BadgeDef = { ...badge, id: makeId() };
        set((s) => ({ badges: [...s.badges, full] }));
        pushBadge(full);
      },

      updateBadge: (id, patch) => {
        set((s) => ({ badges: s.badges.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
        const updated = get().badges.find((b) => b.id === id);
        if (updated) pushBadge(updated);
      },

      deleteBadge: (id) => {
        set((s) => ({ badges: s.badges.filter((b) => b.id !== id) }));
        deleteBadgeRemote(id);
      },

      awardBadge: (studentId, badgeId) => {
        const earn: BadgeEarn = { id: makeId(), studentId, badgeId, date: new Date().toISOString() };
        set((s) => ({ badgeEarns: [earn, ...s.badgeEarns] }));
        pushBadgeEarn(earn);
        const student = get().students.find((st) => st.id === studentId);
        if (student && !student.badgeIds.includes(badgeId)) {
          get().updateStudent(studentId, { badgeIds: [...student.badgeIds, badgeId] });
        }
      },

      addBreakPoolItem: (item) => {
        const full: BreakPoolItem = { ...item, id: makeId() };
        set((s) => ({ breakPool: [...s.breakPool, full] }));
        pushBreakPoolItem(full);
      },

      deleteBreakPoolItem: (id) => {
        set((s) => ({ breakPool: s.breakPool.filter((b) => b.id !== id) }));
        deleteBreakPoolItemRemote(id);
      },

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

      markOnboarded: (studentId) => {
        if (get().onboardedIds.includes(studentId)) return;
        set((s) => ({ onboardedIds: [...s.onboardedIds, studentId] }));
        pushMetaFor(get, studentId);
      },

      setScratchText: (studentId, text) => {
        set((s) => ({ scratchText: { ...s.scratchText, [studentId]: text } }));
        pushMetaFor(get, studentId);
      },

      getRotationMode: (studentId, subject) => get().rotationModes[studentId]?.[subject] ?? 'sequence',

      setRotationMode: (studentId, subject, mode) => {
        set((s) => ({
          rotationModes: {
            ...s.rotationModes,
            [studentId]: { ...(s.rotationModes[studentId] ?? {}), [subject]: mode } as Record<Subject, RotationMode>,
          },
        }));
        pushRotationMode(studentId, subject, mode);
      },

      addQuestionSet: (set_) => {
        const id = makeId();
        const full: QuestionSet = { ...set_, id, createdAt: new Date().toISOString() };
        set((s) => ({ questionSets: [full, ...s.questionSets] }));
        pushQuestionSet(full);
        return id;
      },

      updateQuestionSet: (id, patch) => {
        set((s) => ({ questionSets: s.questionSets.map((qs) => (qs.id === id ? { ...qs, ...patch } : qs)) }));
        const updated = get().questionSets.find((qs) => qs.id === id);
        if (updated) pushQuestionSet(updated);
      },

      deleteQuestionSet: (id) => {
        set((s) => ({ questionSets: s.questionSets.filter((qs) => qs.id !== id) }));
        deleteQuestionSetRemote(id);
      },

      addLibraryActivity: (activity) => {
        const id = makeId();
        const full: ActivityLibraryItem = { ...activity, id, createdAt: new Date().toISOString() };
        set((s) => ({ activityLibrary: [full, ...s.activityLibrary] }));
        pushActivity(full);
        return id;
      },

      updateLibraryActivity: (id, patch) => {
        set((s) => ({ activityLibrary: s.activityLibrary.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
        const updated = get().activityLibrary.find((a) => a.id === id);
        if (updated) pushActivity(updated);
      },

      deleteLibraryActivity: (id) => {
        set((s) => ({ activityLibrary: s.activityLibrary.filter((a) => a.id !== id) }));
        deleteActivityRemote(id);
      },

      addActivityToPlan: (studentId, subject, activityId) => {
        const activity = get().activityLibrary.find((a) => a.id === activityId);
        if (!activity) return;
        const task: Task = {
          id: makeId(),
          title: activity.title,
          icon: activity.icon,
          type: activity.type,
          quiz: activity.quiz,
          link: activity.link,
          offscreen: activity.offscreen,
          video: activity.video,
          passage: activity.passage,
          drill: activity.drill,
          wordchain: activity.wordchain,
          sentenceEdit: activity.sentenceEdit,
          customSteps: activity.customSteps,
          referenceImageUrl: activity.referenceImageUrl,
          referenceLinkUrl: activity.referenceLinkUrl,
          referenceLinkLabel: activity.referenceLinkLabel,
        };
        get().addTask(studentId, subject, task);
      },

      addTemplate: (name, subject, activities) => {
        const id = makeId();
        const full: PlanTemplate = { id, name, subject, activities, createdAt: new Date().toISOString() };
        set((s) => ({ planTemplates: [full, ...s.planTemplates] }));
        pushTemplate(full);
        return id;
      },

      updateTemplate: (id, patch) => {
        set((s) => ({ planTemplates: s.planTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
        const updated = get().planTemplates.find((t) => t.id === id);
        if (updated) pushTemplate(updated);
      },

      duplicateTemplate: (id) => {
        const t = get().planTemplates.find((x) => x.id === id);
        if (!t) return;
        get().addTemplate(`${t.name} (copy)`, t.subject, t.activities.map((a) => ({ ...a, id: makeId() })));
      },

      deleteTemplate: (id) => {
        set((s) => ({ planTemplates: s.planTemplates.filter((t) => t.id !== id) }));
        deleteTemplateRemote(id);
        set((s) => ({ weeklySchedule: s.weeklySchedule.filter((w) => w.templateId !== id) }));
      },

      saveCurrentPlanAsTemplate: (studentId, subject, name) => {
        const tasks = get().rotations[studentId]?.[subject] ?? [];
        get().addTemplate(name, subject, tasks);
      },

      applyTemplateToStudent: (studentId, templateId) => {
        const template = get().planTemplates.find((t) => t.id === templateId);
        if (!template) return;
        const freshTasks = template.activities.map((t) => ({ ...t, id: makeId() }));
        set((s) => {
          const studentRot = s.rotations[studentId] ?? { math: [], literacy: [] };
          return {
            rotations: { ...s.rotations, [studentId]: { ...studentRot, [template.subject]: freshTasks } },
          };
        });
        pushRotation(studentId, template.subject, freshTasks);
      },

      getScheduledTemplateId: (studentId, subject, day) =>
        get().weeklySchedule.find((w) => w.studentId === studentId && w.subject === subject && w.day === day)
          ?.templateId ?? null,

      setWeeklyScheduleDay: (studentId, subject, day, templateId) => {
        const id = `${studentId}:${subject}:${day}`;
        if (!templateId) {
          set((s) => ({ weeklySchedule: s.weeklySchedule.filter((w) => w.id !== id) }));
          deleteWeeklyScheduleEntryRemote(id);
          return;
        }
        const entry: WeeklyScheduleEntry = { id, studentId, subject, day, templateId };
        set((s) => ({ weeklySchedule: [...s.weeklySchedule.filter((w) => w.id !== id), entry] }));
        pushWeeklyScheduleEntry(entry);
      },

      // Once per calendar day (first time this runs after midnight), refresh
      // each subject's live plan from whatever template that weekday is
      // scheduled to. A teacher's same-day hand edit is never clobbered,
      // since this is a no-op once today's date is already recorded.
      applyTodaysScheduleIfNeeded: (studentId) => {
        const day = currentDayOfWeek();
        if (!day) return;
        const today = todayISO();
        (['math', 'literacy'] as Subject[]).forEach((subject) => {
          if (get().weeklyPlanApplied[studentId]?.[subject] === today) return;
          const templateId = get().getScheduledTemplateId(studentId, subject, day);
          set((s) => ({
            weeklyPlanApplied: {
              ...s.weeklyPlanApplied,
              [studentId]: { ...(s.weeklyPlanApplied[studentId] ?? {}), [subject]: today },
            },
          }));
          if (templateId) get().applyTemplateToStudent(studentId, templateId);
          pushMetaFor(get, studentId);
        });
      },
    }),
    { name: 'iwd-session', partialize: (s) => ({ currentStudentId: s.currentStudentId, role: s.role }) },
  ),
);
