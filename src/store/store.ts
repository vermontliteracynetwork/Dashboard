import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { makeId } from '../lib/id';
import { todayISO, streakContinues, currentDayOfWeek } from '../lib/dates';
import { DEFAULT_BADGES, DEFAULT_FEATURE_TOGGLES } from './badges';
import { STARTER_EMOTE_IDS, emoteById } from '../lib/emoteCatalog';
import { STARTER_FONT_IDS, fontById } from '../lib/fontCatalog';
import { STARTER_COLOR_IDS, colorById } from '../lib/colorCatalog';
import { STARTER_VOICE_IDS, voiceOptionById } from '../lib/voiceCatalog';
import { avatarById } from '../lib/avatarCatalog';
import { DEFAULT_TASK_REWARD_CENTS, DEFAULT_BADGE_REWARD_CENTS, formatMoney } from '../lib/money';
import { playChaChing } from '../lib/chime';
import { getDailySpinSegments } from '../lib/dailySpin';
import type { SpinItemKind } from '../lib/dailySpin';

// React StrictMode (and any other accidental re-invocation of initSync)
// double-fires the mount effect that calls it. Without this guard, a second
// subscribeRealtime() call reuses the same 'iwd-sync' channel name after the
// first is already subscribed, which throws — and that throw was silently
// leaving the app's realtime stream half-broken (this is the root cause of
// live views not reliably updating without a manual refresh).
let realtimeSubscribed = false;

export interface DailySpinResult {
  type: 'cents' | 'skip' | 'cashback' | 'item';
  amountCents: number; // for 'cashback' this is the computed payout, not the percent; 0 for 'item' unless it fell back to a cash consolation
  label: string;
  segmentIndex: number; // which of today's 10 segments won, so the wheel UI can land on the same one
  itemKind?: SpinItemKind; // set when type is 'item' and the student actually won it (not the consolation fallback)
  itemId?: string;
}

const SKIP_TOKEN_PRICE_CENTS = 1500; // $15.00

// Consolation prize when an 'item' segment lands but the student already
// owns that item — keeps every spin a genuine win instead of a no-op.
const ITEM_ALREADY_OWNED_CONSOLATION_CENTS = 250; // $2.50

// A streak bonus is capped so a very long streak can't compound into an
// unrealistic percentage — 20% (a 20-day streak) is already a generous
// "keep showing up" reward.
const MAX_STREAK_INTEREST_PCT = 20;
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
  rowToQuizAttempt,
  rowToBadge,
  rowToBadgeEarn,
  rowToBreakPoolItem,
  rowToQuestionSet,
  rowToActivity,
  rowToTemplate,
  rowToTransaction,
  rowToAnnotation,
  annotationKey,
  pushAnnotation,
  rowToSbResponse,
  sbResponseKey,
  pushSbResponse,
  pushStudent,
  deleteStudentRemote,
  pushRotation,
  pushProgress,
  pushBreakRequest,
  deleteBreakRequestRemote,
  pushHelpPing,
  pushOffscreenReview,
  pushQuizAttempt,
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
  rowToAssignment,
  pushAssignment,
  deleteAssignmentRemote,
  pushTransaction,
  pushChatMessage,
  rowToChatMessage,
  deleteBadgeEarnRemote,
  pushNote,
  deleteNoteRemote,
  rowToNote,
  pushCustomPrize,
  deleteCustomPrizeRemote,
  rowToCustomPrize,
} from '../lib/sync';
import type { BadgeCounters } from '../lib/sync';
import { ruleMet } from '../lib/badgeRules';
import type {
  Student,
  Subject,
  Task,
  ProgressMap,
  SubjectProgress,
  BreakRequest,
  HelpPing,
  OffscreenReview,
  QuizAttemptRecord,
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
  Assignment,
  Transaction,
  TransactionKind,
  ArticleAnnotationSet,
  Highlight,
  SentenceBuilderResponse,
  ChatMessage,
  Note,
  CustomPrize,
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
  skippedTaskIds: [],
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
  quizAttempts: QuizAttemptRecord[];
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
  badgeCounters: Record<string, BadgeCounters>; // studentId -> lifetime counters used by badge rules
  assignments: Assignment[]; // published plans with a date window (repeats daily, or one span with carried-forward progress)
  transactions: Transaction[]; // every student's bank register, newest first
  articleAnnotations: Record<string, ArticleAnnotationSet>; // key: `${studentId}:${taskId}:${articleIndex}`
  sentenceBuilderResponses: Record<string, SentenceBuilderResponse>; // key: `${studentId}:${taskId}`
  chatMessages: ChatMessage[]; // teacher<->student chat, newest last
  notes: Note[];
  customPrizes: CustomPrize[];

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
  recordTransaction: (studentId: string, amountCents: number, description: string, icon: string, kind: TransactionKind) => void;
  addHighlight: (studentId: string, taskId: string, articleIndex: number, highlight: Highlight) => void;
  removeHighlight: (studentId: string, taskId: string, articleIndex: number, highlightId: string) => void;
  setHighlightNote: (studentId: string, taskId: string, articleIndex: number, highlightId: string, note: string) => void;
  setSentenceBuilderAnswer: (studentId: string, taskId: string, partId: string, text: string) => void;
  sendChatMessage: (studentId: string, sender: 'student' | 'teacher', text: string) => void;
  createNote: (studentId: string) => string;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'fontId' | 'colorId'>>) => void;
  deleteNote: (id: string) => void;
  addCustomPrize: (prize: Omit<CustomPrize, 'id' | 'createdAt'>) => void;
  updateCustomPrize: (id: string, patch: Partial<CustomPrize>) => void;
  deleteCustomPrize: (id: string) => void;
  buyFont: (studentId: string, fontId: string) => boolean;
  buyColor: (studentId: string, colorId: string) => boolean;
  buyVoice: (studentId: string, voiceId: string) => boolean;
  buyCustomPrize: (studentId: string, prizeId: string) => boolean;
  adjustStudentBalance: (studentId: string, amountCents: number, reason: string) => void;
  setStudentBalance: (studentId: string, newBalanceCents: number, reason: string) => void;
  buyAvatar: (studentId: string, avatarId: string) => boolean;
  buyEmote: (studentId: string, emoteId: string) => boolean;
  equipEmote: (studentId: string, emoteId: string | null) => void;
  buySkipToken: (studentId: string) => boolean;
  skipTask: (studentId: string, subject: Subject, taskId: string) => boolean;
  spinDailyWheel: (studentId: string) => DailySpinResult | null;
  resetDailySpin: (studentId: string) => void;
  resetAllDailySpins: () => void;
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
  uncompleteTask: (studentId: string, subject: Subject, taskId: string) => void;
  markOffscreenDone: (studentId: string, subject: Subject, task: Task, photoUrl?: string) => void;
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
  resetAllStudentAchievements: () => void;
  evaluateBadgeRules: (studentId: string) => void;

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
  addActivityToPlanForStudents: (studentIds: string[], subject: Subject, activityId: string) => void;

  // reusable daily-plan templates
  addTemplate: (name: string, subject: Subject, activities: Task[]) => string;
  updateTemplate: (id: string, patch: Partial<PlanTemplate>) => void;
  duplicateTemplate: (id: string) => void;
  deleteTemplate: (id: string) => void;
  saveCurrentPlanAsTemplate: (studentId: string, subject: Subject, name: string) => void;
  applyTemplateToStudent: (studentId: string, templateId: string) => void;
  applyTemplateToStudents: (studentIds: string[], templateId: string) => void;

  // weekly schedule: which template auto-loads on which weekday
  getScheduledTemplateId: (studentId: string, subject: Subject, day: DayOfWeek) => string | null;
  setWeeklyScheduleDay: (studentId: string, subject: Subject, day: DayOfWeek, templateId: string | null) => void;
  applyTodaysScheduleIfNeeded: (studentId: string) => void;
  // Wipes a student's live plan for a subject if nothing (no active
  // assignment, no weekday schedule) currently accounts for it — used so an
  // assignment that just ended or got deleted stops showing, instead of
  // its last-applied copy lingering forever.
  clearRotationIfNoLongerAssigned: (studentId: string, subject: Subject) => void;

  // published plans with a date window (see Assignment)
  publishAssignment: (
    studentIds: string[],
    subject: Subject,
    tasks: Task[],
    name: string,
    startDate: string,
    endDate: string,
    mode: 'repeat' | 'span',
  ) => void;
  deleteAssignment: (id: string) => void;
  updateAssignment: (id: string, patch: Partial<Assignment>) => void;
  addStudentToAssignment: (
    studentId: string,
    subject: Subject,
    templateId: string,
    startDate: string,
    endDate: string,
    mode: 'repeat' | 'span',
  ) => void;
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
    badgeCounters: s.badgeCounters[studentId] ?? { subjectsCompletedCount: {}, finalChecksPassed: {} },
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
      quizAttempts: [],
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
      badgeCounters: {},
      assignments: [],
      transactions: [],
      articleAnnotations: {},
      sentenceBuilderResponses: {},
      chatMessages: [],
      notes: [],
      customPrizes: [],

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
        if (realtimeSubscribed) return;
        realtimeSubscribed = true;
        subscribeRealtime({
          onStudent: (e, n, o) => set((s) => ({ students: applyArrayRow(s.students, e, rowToStudent, n, o) })),
          onRotation: (e, n, o) =>
            set((s) => ({ rotations: applyNestedRow(s.rotations, e, (r) => r.tasks ?? [], n, o) })),
          // A student's own device is the source of truth for its own live
          // progress — this realtime stream exists for OTHER observers
          // (the teacher's live view). Re-applying an echo of our own just-
          // pushed write here raced against every write since, so a
          // student answering quiz questions quickly could see "Next
          // Question" silently un-advance them back to an older, already-
          // superseded queue. Skip it for whichever student is actively
          // using this device; anyone else's progress still applies.
          onProgress: (e, n, o) => {
            const studentId = n?.student_id ?? o?.student_id;
            if (studentId && studentId === get().currentStudentId) return;
            set((s) => ({ progress: applyNestedRow(s.progress, e, rowToProgress, n, o) }));
          },
          onBreakRequest: (e, n, o) =>
            set((s) => ({ breakRequests: applyArrayRow(s.breakRequests, e, rowToBreakRequest, n, o) })),
          onHelpPing: (e, n, o) => set((s) => ({ helpPings: applyArrayRow(s.helpPings, e, rowToHelpPing, n, o) })),
          onOffscreenReview: (e, n, o) =>
            set((s) => ({ offscreenReviews: applyArrayRow(s.offscreenReviews, e, rowToOffscreenReview, n, o) })),
          onQuizAttempt: (e, n, o) =>
            set((s) => ({ quizAttempts: applyArrayRow(s.quizAttempts, e, rowToQuizAttempt, n, o) })),
          onBadge: (e, n, o) => set((s) => ({ badges: applyArrayRow(s.badges, e, rowToBadge, n, o) })),
          onBadgeEarn: (e, n, o) => set((s) => ({ badgeEarns: applyArrayRow(s.badgeEarns, e, rowToBadgeEarn, n, o) })),
          onBreakPoolItem: (e, n, o) =>
            set((s) => ({ breakPool: applyArrayRow(s.breakPool, e, rowToBreakPoolItem, n, o) })),
          onQuestionSet: (e, n, o) =>
            set((s) => ({ questionSets: applyArrayRow(s.questionSets, e, rowToQuestionSet, n, o) })),
          onRotationMode: (e, n, o) =>
            set((s) => ({ rotationModes: applyNestedRow(s.rotationModes, e, (r) => r.mode, n, o) })),
          // Same self-echo risk as onProgress above — task-completion
          // counts, corrections, and tool usage are only ever written by a
          // student's own device, so it never needs to re-apply an echo of
          // its own write back onto itself.
          onStudentMeta: (e, n, o) => {
            const studentId = n?.student_id ?? o?.student_id;
            if (studentId && studentId === get().currentStudentId) return;
            set((s) => applyStudentMetaRow(s, e, n, o));
          },
          onActivity: (e, n, o) => set((s) => ({ activityLibrary: applyArrayRow(s.activityLibrary, e, rowToActivity, n, o) })),
          onTemplate: (e, n, o) => set((s) => ({ planTemplates: applyArrayRow(s.planTemplates, e, rowToTemplate, n, o) })),
          onWeeklySchedule: (e, n, o) =>
            set((s) => ({ weeklySchedule: applyArrayRow(s.weeklySchedule, e, rowToWeeklyScheduleEntry, n, o) })),
          onAssignment: (e, n, o) => set((s) => ({ assignments: applyArrayRow(s.assignments, e, rowToAssignment, n, o) })),
          onTransaction: (e, n, o) => set((s) => ({ transactions: applyArrayRow(s.transactions, e, rowToTransaction, n, o) })),
          onAnnotation: (e, n, o) => {
            if (e === 'DELETE') {
              if (!o) return;
              const key = annotationKey(o.student_id, o.task_id, o.article_index);
              set((s) => {
                const next = { ...s.articleAnnotations };
                delete next[key];
                return { articleAnnotations: next };
              });
              return;
            }
            if (!n) return;
            const parsed = rowToAnnotation(n);
            const key = annotationKey(parsed.studentId, parsed.taskId, parsed.articleIndex);
            set((s) => ({ articleAnnotations: { ...s.articleAnnotations, [key]: parsed } }));
          },
          onSbResponse: (e, n, o) => {
            if (e === 'DELETE') {
              if (!o) return;
              const key = sbResponseKey(o.student_id, o.task_id);
              set((s) => {
                const next = { ...s.sentenceBuilderResponses };
                delete next[key];
                return { sentenceBuilderResponses: next };
              });
              return;
            }
            if (!n) return;
            const parsed = rowToSbResponse(n);
            const key = sbResponseKey(parsed.studentId, parsed.taskId);
            set((s) => ({ sentenceBuilderResponses: { ...s.sentenceBuilderResponses, [key]: parsed } }));
          },
          onChatMessage: (e, n, o) =>
            set((s) => ({ chatMessages: applyArrayRow(s.chatMessages, e, rowToChatMessage, n, o) })),
          onNote: (e, n, o) => set((s) => ({ notes: applyArrayRow(s.notes, e, rowToNote, n, o) })),
          onCustomPrize: (e, n, o) => set((s) => ({ customPrizes: applyArrayRow(s.customPrizes, e, rowToCustomPrize, n, o) })),
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
          breakMinutes: 3,
          playgroundThreshold: 4,
          ttsSettings: { rate: 1, voiceURI: null },
          createdAt: new Date().toISOString(),
          customTools: [],
          coins: 0,
          ownedAvatarIds: [avatar],
          ownedEmoteIds: [...STARTER_EMOTE_IDS],
          equippedEmoteId: null,
          skipTokens: 0,
          lastSpinDate: null,
          ownedFontIds: [...STARTER_FONT_IDS],
          equippedFontId: null,
          ownedColorIds: [...STARTER_COLOR_IDS],
          equippedColorId: null,
          ownedVoiceIds: [...STARTER_VOICE_IDS],
          equippedVoiceId: null,
          ownedPrizeIds: [],
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

      // Every earn/spend goes through here so the bank register always has
      // a matching row — nothing changes a balance silently.
      recordTransaction: (studentId, amountCents, description, icon, kind) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student) return;
        const tx: Transaction = {
          id: makeId(),
          studentId,
          amountCents,
          description,
          icon,
          kind,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ transactions: [tx, ...s.transactions] }));
        pushTransaction(tx);
        get().updateStudent(studentId, { coins: student.coins + amountCents });
        if (amountCents > 0) playChaChing();
      },

      // Marketplace: spend Class Cash to unlock an avatar or emote. Returns
      // false (no-op) if already owned, unknown, or not enough money, so
      // callers can show "not enough" without duplicating the balance check.
      buyAvatar: (studentId, avatarId) => {
        const student = get().students.find((st) => st.id === studentId);
        const item = avatarById(avatarId);
        if (!student || !item) return false;
        if (student.ownedAvatarIds.includes(avatarId)) return false;
        if (student.coins < item.price) return false;
        get().updateStudent(studentId, { ownedAvatarIds: [...student.ownedAvatarIds, avatarId] });
        get().recordTransaction(studentId, -item.price, `New character: ${item.name}`, item.src, 'purchase-avatar');
        return true;
      },

      buyEmote: (studentId, emoteId) => {
        const student = get().students.find((st) => st.id === studentId);
        const item = emoteById(emoteId);
        if (!student || !item) return false;
        if (student.ownedEmoteIds.includes(emoteId)) return false;
        if (student.coins < item.price) return false;
        get().updateStudent(studentId, { ownedEmoteIds: [...student.ownedEmoteIds, emoteId] });
        get().recordTransaction(studentId, -item.price, `New emote: ${item.name}`, item.src, 'purchase-emote');
        return true;
      },

      equipEmote: (studentId, emoteId) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student) return;
        if (emoteId && !student.ownedEmoteIds.includes(emoteId)) return;
        get().updateStudent(studentId, { equippedEmoteId: emoteId });
      },

      buyFont: (studentId, fontId) => {
        const student = get().students.find((st) => st.id === studentId);
        const item = fontById(fontId);
        if (!student || !item) return false;
        if (student.ownedFontIds.includes(fontId)) return false;
        if (student.coins < item.price) return false;
        get().updateStudent(studentId, { ownedFontIds: [...student.ownedFontIds, fontId] });
        get().recordTransaction(studentId, -item.price, `New font: ${item.name}`, '🔤', 'purchase-font');
        return true;
      },

      buyColor: (studentId, colorId) => {
        const student = get().students.find((st) => st.id === studentId);
        const item = colorById(colorId);
        if (!student || !item) return false;
        if (student.ownedColorIds.includes(colorId)) return false;
        if (student.coins < item.price) return false;
        get().updateStudent(studentId, { ownedColorIds: [...student.ownedColorIds, colorId] });
        get().recordTransaction(studentId, -item.price, `New color: ${item.name}`, '🎨', 'purchase-color');
        return true;
      },

      buyVoice: (studentId, voiceId) => {
        const student = get().students.find((st) => st.id === studentId);
        const item = voiceOptionById(voiceId);
        if (!student || !item) return false;
        if (student.ownedVoiceIds.includes(voiceId)) return false;
        if (student.coins < item.price) return false;
        get().updateStudent(studentId, { ownedVoiceIds: [...student.ownedVoiceIds, voiceId] });
        get().recordTransaction(studentId, -item.price, `New voice: ${item.name}`, '🔊', 'purchase-voice');
        return true;
      },

      buyCustomPrize: (studentId, prizeId) => {
        const student = get().students.find((st) => st.id === studentId);
        const prize = get().customPrizes.find((p) => p.id === prizeId);
        if (!student || !prize) return false;
        if (student.coins < prize.price) return false;
        get().updateStudent(studentId, { ownedPrizeIds: [...student.ownedPrizeIds, prizeId] });
        get().recordTransaction(studentId, -prize.price, `Prize: ${prize.name}`, prize.icon, 'purchase-prize');
        return true;
      },

      addCustomPrize: (prize) => {
        const p: CustomPrize = { ...prize, id: makeId(), createdAt: new Date().toISOString() };
        set((s) => ({ customPrizes: [...s.customPrizes, p] }));
        pushCustomPrize(p);
      },

      updateCustomPrize: (id, patch) => {
        const existing = get().customPrizes.find((p) => p.id === id);
        if (!existing) return;
        const updated = { ...existing, ...patch };
        set((s) => ({ customPrizes: s.customPrizes.map((p) => (p.id === id ? updated : p)) }));
        pushCustomPrize(updated);
      },

      deleteCustomPrize: (id) => {
        set((s) => ({ customPrizes: s.customPrizes.filter((p) => p.id !== id) }));
        deleteCustomPrizeRemote(id);
      },

      createNote: (studentId) => {
        const id = makeId();
        const note: Note = { id, studentId, title: 'Untitled', body: '', fontId: null, colorId: null, updatedAt: new Date().toISOString() };
        set((s) => ({ notes: [...s.notes, note] }));
        pushNote(note);
        return id;
      },

      updateNote: (id, patch) => {
        const existing = get().notes.find((n) => n.id === id);
        if (!existing) return;
        const updated: Note = { ...existing, ...patch, updatedAt: new Date().toISOString() };
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? updated : n)) }));
        pushNote(updated);
      },

      deleteNote: (id) => {
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
        deleteNoteRemote(id);
      },

      // A teacher-initiated deposit or withdrawal — goes through the same
      // recordTransaction choke point as everything else, so it shows up
      // in the register (and plays the cha-ching for a deposit) exactly
      // like a student-earned reward would.
      adjustStudentBalance: (studentId, amountCents, reason) => {
        if (amountCents === 0) return;
        get().recordTransaction(studentId, amountCents, reason || (amountCents > 0 ? 'Bonus from your teacher' : 'Balance adjusted by your teacher'), '🏦', 'teacher-adjustment');
      },

      setStudentBalance: (studentId, newBalanceCents, reason) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student) return;
        const delta = newBalanceCents - student.coins;
        if (delta === 0) return;
        get().recordTransaction(studentId, delta, reason || 'Balance set by your teacher', '🏦', 'teacher-adjustment');
      },

      addHighlight: (studentId, taskId, articleIndex, highlight) => {
        const key = annotationKey(studentId, taskId, articleIndex);
        const existing = get().articleAnnotations[key];
        const updated: ArticleAnnotationSet = {
          studentId,
          taskId,
          articleIndex,
          highlights: [...(existing?.highlights ?? []), highlight],
        };
        set((s) => ({ articleAnnotations: { ...s.articleAnnotations, [key]: updated } }));
        pushAnnotation(updated);
      },

      removeHighlight: (studentId, taskId, articleIndex, highlightId) => {
        const key = annotationKey(studentId, taskId, articleIndex);
        const existing = get().articleAnnotations[key];
        if (!existing) return;
        const updated: ArticleAnnotationSet = { ...existing, highlights: existing.highlights.filter((h) => h.id !== highlightId) };
        set((s) => ({ articleAnnotations: { ...s.articleAnnotations, [key]: updated } }));
        pushAnnotation(updated);
      },

      setHighlightNote: (studentId, taskId, articleIndex, highlightId, note) => {
        const key = annotationKey(studentId, taskId, articleIndex);
        const existing = get().articleAnnotations[key];
        if (!existing) return;
        const updated: ArticleAnnotationSet = {
          ...existing,
          highlights: existing.highlights.map((h) => (h.id === highlightId ? { ...h, note } : h)),
        };
        set((s) => ({ articleAnnotations: { ...s.articleAnnotations, [key]: updated } }));
        pushAnnotation(updated);
      },

      setSentenceBuilderAnswer: (studentId, taskId, partId, text) => {
        const key = sbResponseKey(studentId, taskId);
        const existing = get().sentenceBuilderResponses[key];
        const updated: SentenceBuilderResponse = {
          studentId,
          taskId,
          answers: { ...(existing?.answers ?? {}), [partId]: text },
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ sentenceBuilderResponses: { ...s.sentenceBuilderResponses, [key]: updated } }));
        pushSbResponse(updated);
      },

      sendChatMessage: (studentId, sender, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const msg: ChatMessage = { id: makeId(), studentId, sender, text: trimmed, createdAt: new Date().toISOString() };
        set((s) => ({ chatMessages: [...s.chatMessages, msg] }));
        pushChatMessage(msg);
      },

      buySkipToken: (studentId) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student || student.coins < SKIP_TOKEN_PRICE_CENTS) return false;
        get().updateStudent(studentId, { skipTokens: student.skipTokens + 1 });
        get().recordTransaction(studentId, -SKIP_TOKEN_PRICE_CENTS, 'Skip Pass', '🎫', 'purchase-skip');
        return true;
      },

      // Crosses a task off using a Skip Pass instead of actually doing it.
      // It still lands in completedTaskIds (so progress/unlock logic treats
      // it the same as any other finished task), but also in
      // skippedTaskIds, which the checklist renders distinctly (⏭️ not ✓)
      // and the teacher's Live View shows the same way — a skip is always
      // visible, never indistinguishable from real work. No coins are
      // awarded for a skipped task.
      skipTask: (studentId, subject, taskId) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student || student.skipTokens <= 0) return false;
        const prog = get().progress[studentId]?.[subject];
        if (!prog || prog.completedTaskIds.includes(taskId)) return false;
        const task = get().rotations[studentId]?.[subject]?.find((t) => t.id === taskId);
        if (task?.required) return false;
        get().updateStudent(studentId, { skipTokens: student.skipTokens - 1 });
        set((s) => ({
          progress: {
            ...s.progress,
            [studentId]: {
              ...s.progress[studentId],
              [subject]: {
                ...prog,
                completedTaskIds: [...prog.completedTaskIds, taskId],
                skippedTaskIds: [...prog.skippedTaskIds, taskId],
              },
            },
          },
        }));
        pushProgress(studentId, subject, get().progress[studentId][subject]);
        return true;
      },

      spinDailyWheel: (studentId) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student) return null;
        const today = todayISO();
        if (student.lastSpinDate === today) return null;
        const segments = getDailySpinSegments(today, get().customPrizes);
        const segmentIndex = Math.floor(Math.random() * segments.length);
        const segment = segments[segmentIndex];
        get().updateStudent(studentId, { lastSpinDate: today });

        if (segment.kind === 'skip') {
          get().updateStudent(studentId, { skipTokens: student.skipTokens + 1 });
          get().recordTransaction(studentId, 0, '🎡 Daily Spin: won a Skip Pass', '🎫', 'spin-cash');
          return { type: 'skip', amountCents: 0, label: segment.label, segmentIndex };
        }

        if (segment.kind === 'cents' || segment.kind === 'cashback') {
          const amountCents = segment.kind === 'cashback' ? Math.round(student.coins * ((segment.percent ?? 0) / 100)) : segment.amountCents ?? 0;
          get().recordTransaction(studentId, amountCents, '🎡 Daily Spin winnings', '🎡', segment.kind === 'cashback' ? 'spin-cashback' : 'spin-cash');
          return {
            type: segment.kind,
            amountCents,
            label: segment.kind === 'cashback' ? `💰 ${formatMoney(amountCents)} Cashback` : `💵 ${segment.label}`,
            segmentIndex,
          };
        }

        // Every remaining kind is a marketplace item (avatar/emote/font/color/voice/prize).
        const itemKind = segment.kind as SpinItemKind;
        const itemId = segment.itemId!;
        const ownedField = (
          {
            avatar: 'ownedAvatarIds',
            emote: 'ownedEmoteIds',
            font: 'ownedFontIds',
            color: 'ownedColorIds',
            voice: 'ownedVoiceIds',
            prize: 'ownedPrizeIds',
          } as const
        )[itemKind];
        const alreadyOwned = student[ownedField].includes(itemId);
        if (alreadyOwned) {
          get().recordTransaction(studentId, ITEM_ALREADY_OWNED_CONSOLATION_CENTS, `🎡 Daily Spin (already had ${segment.label})`, '🎡', 'spin-cash');
          return {
            type: 'item',
            amountCents: ITEM_ALREADY_OWNED_CONSOLATION_CENTS,
            label: `You already have that one — here's ${formatMoney(ITEM_ALREADY_OWNED_CONSOLATION_CENTS)} instead!`,
            segmentIndex,
          };
        }
        get().updateStudent(studentId, { [ownedField]: [...student[ownedField], itemId] } as Partial<Student>);
        // Every spin — including a free item win — leaves a $0 register
        // row, so a student's bank history always shows exactly what
        // happened on every spin, not just the ones that moved money.
        get().recordTransaction(studentId, 0, `🎡 Daily Spin: won ${segment.label}`, segment.imageUrl ?? '🎁', 'spin-cash');
        return { type: 'item', amountCents: 0, label: segment.label, segmentIndex, itemKind, itemId };
      },

      // Clears one student's "already spun today" flag so they can spin
      // again — for a teacher who wants to let a student re-roll, or to
      // undo a spin used for testing rather than a real prize.
      resetDailySpin: (studentId) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student || student.lastSpinDate === null) return;
        get().updateStudent(studentId, { lastSpinDate: null });
      },

      resetAllDailySpins: () => {
        get().students.forEach((st) => {
          if (st.lastSpinDate !== null) get().updateStudent(st.id, { lastSpinDate: null });
        });
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

        // A new task added after the student already finished today would
        // otherwise stay hidden behind a stale "all done" screen.
        const today = todayISO();
        const prog = get().progress[studentId]?.[subject];
        if (prog && prog.date === today && prog.subjectComplete) {
          const updated: SubjectProgress = { ...prog, subjectComplete: false };
          set((s) => ({
            progress: { ...s.progress, [studentId]: { ...s.progress[studentId], [subject]: updated } },
          }));
          pushProgress(studentId, subject, updated);
        }
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

        // A 'span' assignment currently in its window keeps the student's
        // progress instead of resetting it fresh each day, so a multi-day
        // assignment doesn't lose completed work overnight.
        const activeSpan = s.assignments.find(
          (a) => a.studentId === studentId && a.subject === subject && a.mode === 'span' && a.startDate <= today && today <= a.endDate,
        );
        const fresh: SubjectProgress = activeSpan && existing ? { ...existing, date: today } : emptyProgress();

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
        get().evaluateBadgeRules(studentId);
      },

      completeTask: (studentId, subject, taskId) => {
        get().ensureProgress(studentId, subject);
        const tasks = get().getTasks(studentId, subject);
        const today = todayISO();
        // A teacher can designate one activity (typically a quiz) as the
        // Final Check — completing it is what marks the subject done,
        // instead of requiring every single activity to be checked off.
        const finalCheckTask = tasks.find((t) => t.isFinalCheck);
        const wasComplete = get().progress[studentId]?.[subject]?.subjectComplete ?? false;

        set((s) => {
          const sp = s.progress[studentId][subject];
          if (sp.completedTaskIds.includes(taskId)) return {};
          const completedTaskIds = [...sp.completedTaskIds, taskId];
          const nextIndex = sp.activeIndex + 1;
          const subjectComplete = finalCheckTask ? completedTaskIds.includes(finalCheckTask.id) : nextIndex >= tasks.length;
          const completedAt = subjectComplete ? (sp.completedAt ?? new Date().toISOString()) : sp.completedAt;
          return {
            progress: {
              ...s.progress,
              [studentId]: {
                ...s.progress[studentId],
                [subject]: { ...sp, completedTaskIds, activeIndex: nextIndex, subjectComplete, completedAt },
              },
            },
          };
        });
        pushProgress(studentId, subject, get().progress[studentId][subject]);

        const rewardedTask = tasks.find((t) => t.id === taskId);
        const rewardCents = rewardedTask?.rewardCents ?? DEFAULT_TASK_REWARD_CENTS;
        get().recordTransaction(studentId, rewardCents, rewardedTask?.title || 'Activity completed', rewardedTask?.icon ?? '📝', 'task');

        // lifetime completion count -> practice-makes-progress badge
        const key = `${studentId}:${taskId}`;
        const count = (get().taskCompletionCounts[key] ?? 0) + 1;
        set((s) => ({ taskCompletionCounts: { ...s.taskCompletionCounts, [key]: count } }));
        if (count === 3) get().awardBadge(studentId, 'practice-progress');

        const nowComplete = get().progress[studentId][subject].subjectComplete;
        const completedTask = tasks.find((t) => t.id === taskId);
        if (!wasComplete && nowComplete) {
          const counters = get().badgeCounters[studentId] ?? { subjectsCompletedCount: {}, finalChecksPassed: {} };
          const subjectsCompletedCount = { ...counters.subjectsCompletedCount, [subject]: (counters.subjectsCompletedCount[subject] ?? 0) + 1 };
          set((s) => ({ badgeCounters: { ...s.badgeCounters, [studentId]: { ...counters, subjectsCompletedCount } } }));
        }
        if (completedTask?.isFinalCheck) {
          const counters = get().badgeCounters[studentId] ?? { subjectsCompletedCount: {}, finalChecksPassed: {} };
          const finalChecksPassed = { ...counters.finalChecksPassed, [subject]: (counters.finalChecksPassed[subject] ?? 0) + 1 };
          set((s) => ({ badgeCounters: { ...s.badgeCounters, [studentId]: { ...counters, finalChecksPassed } } }));
        }
        pushMetaFor(get, studentId);

        const student = get().students.find((st) => st.id === studentId);

        // streak: increments once both subjects are complete for today
        const other: Subject = subject === 'math' ? 'literacy' : 'math';
        const otherTasks = get().getTasks(studentId, other);
        const otherProg = get().progress[studentId]?.[other];
        const otherDone = otherTasks.length === 0 || (otherProg && otherProg.date === today && otherProg.subjectComplete);
        if (nowComplete && otherDone && student && student.lastCompletedDate !== today) {
          const continued = streakContinues(student.lastCompletedDate, today);
          const newStreak = continued ? student.streak + 1 : 1;
          get().updateStudent(studentId, { streak: newStreak, lastCompletedDate: today });
          get().awardBadge(studentId, 'showed-up');

          // Streak interest: a 1% bonus of the current balance per day of
          // streak (capped), paid the moment the streak ticks up — the same
          // "money makes money" idea as a real savings account.
          const pct = Math.min(newStreak, MAX_STREAK_INTEREST_PCT);
          const balanceForInterest = get().students.find((st) => st.id === studentId)?.coins ?? 0;
          const interest = Math.round(balanceForInterest * (pct / 100));
          if (interest > 0) {
            get().recordTransaction(studentId, interest, `🔥 ${newStreak}-day streak bonus (${pct}%)`, '🔥', 'streak-interest');
          }
        }
        get().evaluateBadgeRules(studentId);
      },

      // A student unchecking a mistaken tap — just removes it from today's
      // completed list (and un-completes the subject if that was the task
      // that finished it). Badges, streaks, and counters already earned
      // from it stay earned; those aren't undone by a single unchecked box.
      uncompleteTask: (studentId, subject, taskId) => {
        get().ensureProgress(studentId, subject);
        const tasks = get().getTasks(studentId, subject);
        const finalCheckTask = tasks.find((t) => t.isFinalCheck);
        set((s) => {
          const sp = s.progress[studentId][subject];
          if (!sp.completedTaskIds.includes(taskId)) return {};
          const completedTaskIds = sp.completedTaskIds.filter((id) => id !== taskId);
          const skippedTaskIds = sp.skippedTaskIds.filter((id) => id !== taskId);
          const subjectComplete = finalCheckTask
            ? completedTaskIds.includes(finalCheckTask.id)
            : completedTaskIds.length >= tasks.length;
          return {
            progress: {
              ...s.progress,
              [studentId]: {
                ...s.progress[studentId],
                [subject]: { ...sp, completedTaskIds, skippedTaskIds, subjectComplete, completedAt: subjectComplete ? sp.completedAt : undefined },
              },
            },
          };
        });
        pushProgress(studentId, subject, get().progress[studentId][subject]);
      },

      markOffscreenDone: (studentId, subject, task, photoUrl) => {
        const review: OffscreenReview = {
          id: makeId(),
          studentId,
          subject,
          taskId: task.id,
          taskTitle: task.title,
          timestamp: new Date().toISOString(),
          verified: false,
          photoUrl,
        };
        set((s) => ({ offscreenReviews: [review, ...s.offscreenReviews] }));
        pushOffscreenReview(review);
        get().completeTask(studentId, subject, task.id);
      },

      ensureQuizState: (studentId, subject, task) => {
        get().ensureProgress(studentId, subject);
        const sp = get().progress[studentId][subject];
        const existing = sp.quizState[task.id];
        // De-duplicated so a question that accidentally got inserted twice
        // (e.g. a set added into the same task more than once) never leaves
        // a phantom second copy sitting in the queue.
        const liveIds = Array.from(new Set((task.quiz?.questions ?? []).map((q) => q.id)));

        const applyState = (fresh: QuizRuntimeState) => {
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
        };

        if (existing) {
          // A fully-mastered queue reopened means the student is retaking
          // this quiz — start a brand new attempt (fresh shuffle, empty
          // log) instead of reusing the finished one, so this run gets its
          // own score record and a real "questions left" count.
          if (liveIds.length > 0 && existing.remainingIds.length === 0 && existing.masteredIds.length > 0) {
            const shuffleQuestions = task.quiz?.shuffleQuestions ?? true;
            const orderedIds = shuffleQuestions ? [...liveIds].sort(() => Math.random() - 0.5) : liveIds;
            return applyState({ remainingIds: orderedIds, masteredIds: [], log: [], attemptStartedAt: new Date().toISOString() });
          }

          // Self-heal against a queue that references a question the
          // teacher has since removed/replaced — without this, that
          // question stays stuck at the front of remainingIds forever
          // (submitQuizAnswer can only remove an id it's told about, and
          // the id from an edited quiz will never come from the student
          // again), and any brand-new question the teacher added never
          // gets picked up either. This runs on every quiz open/refresh.
          const knownIds = new Set([...existing.remainingIds, ...existing.masteredIds]);
          const cleanRemaining = existing.remainingIds.filter((id) => liveIds.includes(id));
          const cleanMastered = existing.masteredIds.filter((id) => liveIds.includes(id));
          const newIds = liveIds.filter((id) => !knownIds.has(id));
          const changed =
            cleanRemaining.length !== existing.remainingIds.length ||
            cleanMastered.length !== existing.masteredIds.length ||
            newIds.length > 0;
          if (!changed) return existing;

          return applyState({
            remainingIds: [...cleanRemaining, ...newIds],
            masteredIds: cleanMastered,
            log: existing.log,
            attemptStartedAt: existing.attemptStartedAt,
          });
        }

        const shuffleQuestions = task.quiz?.shuffleQuestions ?? true;
        const orderedIds = shuffleQuestions ? [...liveIds].sort(() => Math.random() - 0.5) : liveIds;
        return applyState({ remainingIds: orderedIds, masteredIds: [], log: [], attemptStartedAt: new Date().toISOString() });
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
            get().evaluateBadgeRules(studentId);
          }
        } else {
          // reinsert at a random spot further back so it isn't asked again immediately
          const insertAt = remainingIds.length === 0 ? 0 : Math.floor(Math.random() * remainingIds.length) + 1;
          remainingIds = [...remainingIds.slice(0, insertAt), questionId, ...remainingIds.slice(insertAt)];
        }
        const next: QuizRuntimeState = { remainingIds, masteredIds, log, attemptStartedAt: state.attemptStartedAt };
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

        // Every question answered correctly at least once — this attempt is
        // done. Score it off the first result logged for each question
        // (so a corrected retry doesn't inflate the raw score) and record
        // it for the teacher, independent of the live quizState above so a
        // student retaking the quiz later doesn't erase this run's result.
        if (remainingIds.length === 0) {
          const totalCount = (task.quiz?.questions ?? []).length;
          const firstResultByQuestion = new Map<string, boolean>();
          for (const entry of log) {
            if (!firstResultByQuestion.has(entry.questionId)) firstResultByQuestion.set(entry.questionId, entry.correct);
          }
          const correctCount = [...firstResultByQuestion.values()].filter(Boolean).length;
          const completedAt = new Date().toISOString();
          const startedAt = state.attemptStartedAt ?? log[0]?.timestamp ?? completedAt;
          const record: QuizAttemptRecord = {
            id: makeId(),
            studentId,
            subject,
            taskId: task.id,
            taskTitle: task.title,
            startedAt,
            completedAt,
            durationMs: Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime()),
            correctCount,
            totalCount,
          };
          set((s) => ({ quizAttempts: [record, ...s.quizAttempts] }));
          pushQuizAttempt(record);
        }
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
          const badge = get().badges.find((b) => b.id === badgeId);
          const rewardCents = badge?.rewardCents ?? DEFAULT_BADGE_REWARD_CENTS;
          if (rewardCents > 0) {
            get().recordTransaction(studentId, rewardCents, `🏆 Achievement: ${badge?.name ?? 'Achievement'}`, badge?.icon ?? '🏆', 'achievement');
          }
        }
      },

      // A one-time reset: clears every student's earned achievements (both
      // the visible badgeIds list and the underlying earn-log rows) so a
      // teacher can redesign the whole achievement set — new rules, new
      // Class Cash rewards — and have students earn them fresh, without a
      // pile of earns from the old, pre-currency badge system still showing.
      // The BadgeDef catalog itself (the achievements' definitions) is untouched.
      resetAllStudentAchievements: () => {
        const s = get();
        s.students.forEach((st) => {
          if (st.badgeIds.length > 0) get().updateStudent(st.id, { badgeIds: [] });
        });
        s.badgeEarns.forEach((e) => deleteBadgeEarnRemote(e.id));
        set({ badgeEarns: [] });
      },

      // Checked after anything that could satisfy a badge rule (a task
      // completed, a tool opened, a correction made, a streak updated) —
      // awards any rule-based badge whose condition is now true and that
      // this student doesn't already have.
      evaluateBadgeRules: (studentId) => {
        const s = get();
        const student = s.students.find((st) => st.id === studentId);
        if (!student) return;

        const prefix = `${studentId}:`;
        let totalTasksCompleted = 0;
        for (const [k, v] of Object.entries(s.taskCompletionCounts)) {
          if (k.startsWith(prefix)) totalTasksCompleted += v;
        }

        const today = todayISO();
        const tasksCompletedTodayBySubject: Partial<Record<Subject, number>> = {};
        (['math', 'literacy'] as Subject[]).forEach((subj) => {
          const p = s.progress[studentId]?.[subj];
          if (p?.date === today) tasksCompletedTodayBySubject[subj] = p.completedTaskIds.length;
        });

        const counters = s.badgeCounters[studentId] ?? { subjectsCompletedCount: {}, finalChecksPassed: {} };
        const sumValues = (rec: Partial<Record<Subject, number>>) => Object.values(rec).reduce((sum: number, v) => sum + (v ?? 0), 0);

        const ctx = {
          student,
          totalTasksCompleted,
          tasksCompletedTodayBySubject,
          subjectsCompletedCount: sumValues(counters.subjectsCompletedCount),
          subjectsCompletedCountBySubject: counters.subjectsCompletedCount,
          finalChecksPassed: sumValues(counters.finalChecksPassed),
          finalChecksPassedBySubject: counters.finalChecksPassed,
          toolsUsedCount: (s.toolUsage[studentId] ?? []).length,
          correctionsCount: s.correctionsCount[studentId] ?? 0,
        };

        s.badges.forEach((b) => {
          if (!b.rule) return;
          if (student.badgeIds.includes(b.id)) return;
          if (ruleMet(b.rule, ctx)) get().awardBadge(studentId, b.id);
        });
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
        // A progress record for today exists the moment a student opens a
        // subject (see ensureProgress) — well before they finish their
        // first task — so that alone is "working," not completedTaskIds
        // being non-empty. Waiting for a completion made the Live View
        // (and this status) read "not started" for a student who was
        // visibly mid-task on their very first activity of the day.
        const started = mathProg?.date === today || litProg?.date === today;
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

      addActivityToPlanForStudents: (studentIds, subject, activityId) => {
        studentIds.forEach((id) => get().addActivityToPlan(id, subject, activityId));
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

        // The whole task list just changed out from under any existing
        // progress — old completedTaskIds point at tasks that no longer
        // exist, and a stale subjectComplete would hide the new plan
        // behind an "all done" screen. Start that subject's progress over.
        const fresh: SubjectProgress = { ...emptyProgress() };
        set((s) => ({
          progress: {
            ...s.progress,
            [studentId]: { ...(s.progress[studentId] ?? {}), [template.subject]: fresh } as ProgressMap[string],
          },
        }));
        pushProgress(studentId, template.subject, fresh);
      },

      applyTemplateToStudents: (studentIds, templateId) => {
        studentIds.forEach((id) => get().applyTemplateToStudent(id, templateId));
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
      // each subject's live plan from whatever's scheduled for today: a
      // dated assignment (if one's window covers today) takes priority,
      // otherwise the weekday-based weekly schedule. A teacher's same-day
      // hand edit is never clobbered, since this is a no-op once today's
      // date is already recorded.
      applyTodaysScheduleIfNeeded: (studentId) => {
        const day = currentDayOfWeek();
        const today = todayISO();
        (['math', 'literacy'] as Subject[]).forEach((subject) => {
          const lastApplied = get().weeklyPlanApplied[studentId]?.[subject];
          if (lastApplied === today) return;

          const activeAssignment = get().assignments.find(
            (a) => a.studentId === studentId && a.subject === subject && a.startDate <= today && today <= a.endDate,
          );

          if (activeAssignment) {
            if (activeAssignment.mode === 'repeat' || !activeAssignment.applied) {
              get().applyTemplateToStudent(studentId, activeAssignment.templateId);
            }
            if (!activeAssignment.applied) {
              const updated: Assignment = { ...activeAssignment, applied: true };
              set((s) => ({ assignments: s.assignments.map((a) => (a.id === activeAssignment.id ? updated : a)) }));
              pushAssignment(updated);
            }
          } else {
            const templateId = day ? get().getScheduledTemplateId(studentId, subject, day) : null;
            if (templateId) {
              get().applyTemplateToStudent(studentId, templateId);
            } else if (lastApplied) {
              // Nothing scheduled for today. If the plan that was showing
              // as of the last day this ran was itself put there by a dated
              // assignment (not a manual edit), that assignment's window has
              // now ended — clear it out rather than leave an expired
              // assignment's tasks sitting there indefinitely. A plan set
              // by hand and never touched by the assignment system is left
              // alone either way.
              const wasAssignmentDriven = get().assignments.some(
                (a) => a.studentId === studentId && a.subject === subject && a.startDate <= lastApplied && lastApplied <= a.endDate,
              );
              if (wasAssignmentDriven) get().clearRotationIfNoLongerAssigned(studentId, subject);
            }
          }

          set((s) => ({
            weeklyPlanApplied: {
              ...s.weeklyPlanApplied,
              [studentId]: { ...(s.weeklyPlanApplied[studentId] ?? {}), [subject]: today },
            },
          }));
          pushMetaFor(get, studentId);
        });
      },

      clearRotationIfNoLongerAssigned: (studentId, subject) => {
        const today = todayISO();
        const stillActive = get().assignments.some(
          (a) => a.studentId === studentId && a.subject === subject && a.startDate <= today && today <= a.endDate,
        );
        if (stillActive) return;
        const day = currentDayOfWeek();
        const scheduledTemplateId = day ? get().getScheduledTemplateId(studentId, subject, day) : null;
        if (scheduledTemplateId) return;
        const current = get().rotations[studentId]?.[subject] ?? [];
        if (current.length === 0) return;
        set((s) => {
          const studentRot = s.rotations[studentId] ?? { math: [], literacy: [] };
          return { rotations: { ...s.rotations, [studentId]: { ...studentRot, [subject]: [] } } };
        });
        pushRotation(studentId, subject, []);
      },

      publishAssignment: (studentIds, subject, tasks, name, startDate, endDate, mode) => {
        const templateId = get().addTemplate(name, subject, tasks);
        const today = todayISO();
        studentIds.forEach((studentId) => {
          const isActiveNow = startDate <= today && today <= endDate;
          const assignment: Assignment = {
            id: makeId(),
            studentId,
            subject,
            templateId,
            startDate,
            endDate,
            mode,
            applied: isActiveNow,
          };
          set((s) => ({ assignments: [...s.assignments, assignment] }));
          pushAssignment(assignment);
          if (isActiveNow) {
            get().applyTemplateToStudent(studentId, templateId);
            set((s) => ({
              weeklyPlanApplied: {
                ...s.weeklyPlanApplied,
                [studentId]: { ...(s.weeklyPlanApplied[studentId] ?? {}), [subject]: today },
              },
            }));
            pushMetaFor(get, studentId);
          }
        });
      },

      deleteAssignment: (id) => {
        const removed = get().assignments.find((a) => a.id === id);
        set((s) => ({ assignments: s.assignments.filter((a) => a.id !== id) }));
        deleteAssignmentRemote(id);
        // Removing an assignment that was live today should stop showing
        // its tasks right away, not wait for tomorrow's daily refresh.
        if (removed) {
          const today = todayISO();
          if (removed.startDate <= today && today <= removed.endDate) {
            get().clearRotationIfNoLongerAssigned(removed.studentId, removed.subject);
          }
        }
      },

      updateAssignment: (id, patch) => {
        set((s) => ({ assignments: s.assignments.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
        const updated = get().assignments.find((a) => a.id === id);
        if (updated) pushAssignment(updated);
      },

      // Idempotent by design: a student can only ever have one live
      // assignment for a given plan+subject. If they already have one that
      // hasn't ended yet, this updates its dates/mode in place instead of
      // creating a second, duplicate assignment.
      addStudentToAssignment: (studentId, subject, templateId, startDate, endDate, mode) => {
        const today = todayISO();
        const isActiveNow = startDate <= today && today <= endDate;

        const existing = get().assignments.find(
          (a) => a.studentId === studentId && a.templateId === templateId && a.subject === subject && a.endDate >= today,
        );
        if (existing) {
          // Already assigned — this is an edit/republish, not a new
          // assignment. Only the window/mode changes; never re-apply the
          // template here, since that would wipe whatever progress,
          // completions, or in-progress quiz state this student already
          // has for the subject.
          get().updateAssignment(existing.id, { startDate, endDate, mode });
          return;
        }

        const assignment: Assignment = { id: makeId(), studentId, subject, templateId, startDate, endDate, mode, applied: isActiveNow };
        set((s) => ({ assignments: [...s.assignments, assignment] }));
        pushAssignment(assignment);

        if (isActiveNow) {
          get().applyTemplateToStudent(studentId, templateId);
          set((s) => ({
            weeklyPlanApplied: {
              ...s.weeklyPlanApplied,
              [studentId]: { ...(s.weeklyPlanApplied[studentId] ?? {}), [subject]: today },
            },
          }));
          pushMetaFor(get, studentId);
        }
      },
    }),
    { name: 'iwd-session', partialize: (s) => ({ currentStudentId: s.currentStudentId, role: s.role }) },
  ),
);
