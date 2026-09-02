import { supabase, isSupabaseConfigured } from './supabaseClient';
import type {
  Student,
  Subject,
  Task,
  SubjectProgress,
  BreakRequest,
  HelpPing,
  OffscreenReview,
  BadgeDef,
  BadgeEarn,
  BreakPoolItem,
  QuestionSet,
  RotationMode,
  ToolKey,
  ProgressMap,
  ActivityLibraryItem,
  PlanTemplate,
  WeeklyScheduleEntry,
} from '../types';

// ---------------------------------------------------------------------------
// Row <-> app-shape mapping
// ---------------------------------------------------------------------------
type Row = Record<string, any>;

const rowToStudent = (r: Row): Student => ({
  id: r.id,
  name: r.name,
  avatar: r.avatar,
  streak: r.streak,
  lastCompletedDate: r.last_completed_date,
  streakHidden: r.streak_hidden,
  badgeIds: r.badge_ids ?? [],
  featureToggles: r.feature_toggles ?? {},
  breakMinutes: r.break_minutes,
  ttsSettings: r.tts_settings ?? { rate: 1, voiceURI: null },
  createdAt: r.created_at,
  playgroundThreshold: r.playground_threshold ?? 4,
});

const studentToRow = (s: Student): Row => ({
  id: s.id,
  name: s.name,
  avatar: s.avatar,
  streak: s.streak,
  last_completed_date: s.lastCompletedDate,
  streak_hidden: s.streakHidden,
  badge_ids: s.badgeIds,
  feature_toggles: s.featureToggles,
  break_minutes: s.breakMinutes,
  tts_settings: s.ttsSettings,
  created_at: s.createdAt,
  playground_threshold: s.playgroundThreshold,
});

const rowToProgress = (r: Row): SubjectProgress => ({
  date: r.date,
  activeIndex: r.active_index,
  completedTaskIds: r.completed_task_ids ?? [],
  quizState: r.quiz_state ?? {},
  sessionRitualSeen: r.session_ritual_seen,
  subjectComplete: r.subject_complete,
});

const progressToRow = (studentId: string, subject: Subject, p: SubjectProgress): Row => ({
  student_id: studentId,
  subject,
  date: p.date,
  active_index: p.activeIndex,
  completed_task_ids: p.completedTaskIds,
  quiz_state: p.quizState,
  session_ritual_seen: p.sessionRitualSeen,
  subject_complete: p.subjectComplete,
});

const rowToBreakRequest = (r: Row): BreakRequest => ({
  id: r.id,
  studentId: r.student_id,
  timestamp: r.occurred_at,
  status: r.status,
});

const rowToHelpPing = (r: Row): HelpPing => ({
  id: r.id,
  studentId: r.student_id,
  timestamp: r.occurred_at,
  resolved: r.resolved,
});

const rowToOffscreenReview = (r: Row): OffscreenReview => ({
  id: r.id,
  studentId: r.student_id,
  subject: r.subject,
  taskId: r.task_id,
  taskTitle: r.task_title,
  timestamp: r.occurred_at,
  verified: r.verified,
});

const rowToBadge = (r: Row): BadgeDef => ({ id: r.id, name: r.name, description: r.description, icon: r.icon });

const rowToBadgeEarn = (r: Row): BadgeEarn => ({ id: r.id, studentId: r.student_id, badgeId: r.badge_id, date: r.earned_at });

const rowToBreakPoolItem = (r: Row): BreakPoolItem => ({
  id: r.id,
  title: r.title,
  kind: r.kind,
  value: r.value,
  studentId: r.student_id ?? undefined,
});

const rowToQuestionSet = (r: Row): QuestionSet => ({
  id: r.id,
  name: r.name,
  subject: r.subject,
  kind: r.kind,
  questions: r.questions ?? [],
  cards: r.cards ?? [],
  coverImageUrl: r.cover_image_url ?? undefined,
  createdAt: r.created_at,
});

const rowToActivity = (r: Row): ActivityLibraryItem => ({
  id: r.id,
  subject: r.subject,
  title: r.title,
  icon: r.icon,
  type: r.type,
  quiz: r.quiz ?? undefined,
  link: r.link ?? undefined,
  offscreen: r.offscreen ?? undefined,
  video: r.video ?? undefined,
  passage: r.passage ?? undefined,
  drill: r.drill ?? undefined,
  wordchain: r.wordchain ?? undefined,
  sentenceEdit: r.sentence_edit ?? undefined,
  customSteps: r.custom_steps ?? undefined,
  referenceImageUrl: r.reference_image_url ?? undefined,
  referenceLinkUrl: r.reference_link_url ?? undefined,
  referenceLinkLabel: r.reference_link_label ?? undefined,
  inPlayground: r.in_playground ?? false,
  createdAt: r.created_at,
});

const activityToRow = (a: ActivityLibraryItem): Row => ({
  id: a.id,
  subject: a.subject,
  title: a.title,
  icon: a.icon,
  type: a.type,
  quiz: a.quiz ?? null,
  link: a.link ?? null,
  offscreen: a.offscreen ?? null,
  video: a.video ?? null,
  passage: a.passage ?? null,
  drill: a.drill ?? null,
  wordchain: a.wordchain ?? null,
  sentence_edit: a.sentenceEdit ?? null,
  custom_steps: a.customSteps ?? null,
  reference_image_url: a.referenceImageUrl ?? null,
  reference_link_url: a.referenceLinkUrl ?? null,
  reference_link_label: a.referenceLinkLabel ?? null,
  in_playground: a.inPlayground,
  created_at: a.createdAt,
});

const rowToTemplate = (r: Row): PlanTemplate => ({
  id: r.id,
  name: r.name,
  subject: r.subject,
  activities: r.activities ?? [],
  createdAt: r.created_at,
});

const rowToWeeklyScheduleEntry = (r: Row): WeeklyScheduleEntry => ({
  id: r.id,
  studentId: r.student_id,
  subject: r.subject,
  day: r.day,
  templateId: r.template_id,
});

const weeklyScheduleEntryToRow = (w: WeeklyScheduleEntry): Row => ({
  id: w.id,
  student_id: w.studentId,
  subject: w.subject,
  day: w.day,
  template_id: w.templateId,
});

// ---------------------------------------------------------------------------
// Fetch everything once, folded into the shapes the store keeps in memory
// ---------------------------------------------------------------------------

export interface HydratedState {
  students: Student[];
  rotations: Record<string, Record<Subject, Task[]>>;
  progress: ProgressMap;
  breakRequests: BreakRequest[];
  helpPings: HelpPing[];
  offscreenReviews: OffscreenReview[];
  badges: BadgeDef[];
  badgeEarns: BadgeEarn[];
  breakPool: BreakPoolItem[];
  questionSets: QuestionSet[];
  activityLibrary: ActivityLibraryItem[];
  planTemplates: PlanTemplate[];
  weeklySchedule: WeeklyScheduleEntry[];
  rotationModes: Record<string, Record<Subject, RotationMode>>;
  taskCompletionCounts: Record<string, number>;
  toolUsage: Record<string, ToolKey[]>;
  correctionsCount: Record<string, number>;
  scratchText: Record<string, string>;
  onboardedIds: string[];
  weeklyPlanApplied: Record<string, Partial<Record<Subject, string>>>;
}

export async function fetchAll(): Promise<HydratedState> {
  const [
    studentsRes, rotationsRes, progressRes, breaksRes, pingsRes, reviewsRes,
    badgesRes, earnsRes, poolRes, setsRes, modesRes, metaRes, activitiesRes, templatesRes, scheduleRes,
  ] = await Promise.all([
    supabase.from('students').select('*'),
    supabase.from('rotations').select('*'),
    supabase.from('subject_progress').select('*'),
    supabase.from('break_requests').select('*'),
    supabase.from('help_pings').select('*'),
    supabase.from('offscreen_reviews').select('*'),
    supabase.from('badges').select('*'),
    supabase.from('badge_earns').select('*'),
    supabase.from('break_pool_items').select('*'),
    supabase.from('question_sets').select('*'),
    supabase.from('rotation_modes').select('*'),
    supabase.from('student_meta').select('*'),
    supabase.from('activity_library').select('*'),
    supabase.from('plan_templates').select('*'),
    supabase.from('weekly_schedule').select('*'),
  ]);

  for (const res of [studentsRes, rotationsRes, progressRes, breaksRes, pingsRes, reviewsRes, badgesRes, earnsRes, poolRes, setsRes, modesRes, metaRes, activitiesRes, templatesRes, scheduleRes]) {
    if (res.error) throw res.error;
  }

  const rotations: Record<string, Record<Subject, Task[]>> = {};
  for (const r of rotationsRes.data ?? []) {
    (rotations[r.student_id] ??= {} as Record<Subject, Task[]>)[r.subject as Subject] = r.tasks ?? [];
  }

  const progress: ProgressMap = {};
  for (const r of progressRes.data ?? []) {
    (progress[r.student_id] ??= {} as ProgressMap[string])[r.subject as Subject] = rowToProgress(r);
  }

  const rotationModes: Record<string, Record<Subject, RotationMode>> = {};
  for (const r of modesRes.data ?? []) {
    (rotationModes[r.student_id] ??= {} as Record<Subject, RotationMode>)[r.subject as Subject] = r.mode;
  }

  const taskCompletionCounts: Record<string, number> = {};
  const toolUsage: Record<string, ToolKey[]> = {};
  const correctionsCount: Record<string, number> = {};
  const scratchText: Record<string, string> = {};
  const onboardedIds: string[] = [];
  const weeklyPlanApplied: Record<string, Partial<Record<Subject, string>>> = {};
  for (const r of metaRes.data ?? []) {
    for (const [taskId, count] of Object.entries(r.task_completion_counts ?? {})) {
      taskCompletionCounts[`${r.student_id}:${taskId}`] = count as number;
    }
    toolUsage[r.student_id] = r.tool_usage ?? [];
    correctionsCount[r.student_id] = r.corrections_count ?? 0;
    scratchText[r.student_id] = r.scratch_text ?? '';
    if (r.onboarded) onboardedIds.push(r.student_id);
    weeklyPlanApplied[r.student_id] = r.weekly_plan_applied ?? {};
  }

  return {
    students: (studentsRes.data ?? []).map(rowToStudent),
    rotations,
    progress,
    breakRequests: (breaksRes.data ?? []).map(rowToBreakRequest),
    helpPings: (pingsRes.data ?? []).map(rowToHelpPing),
    offscreenReviews: (reviewsRes.data ?? []).map(rowToOffscreenReview),
    badges: (badgesRes.data ?? []).map(rowToBadge),
    badgeEarns: (earnsRes.data ?? []).map(rowToBadgeEarn),
    breakPool: (poolRes.data ?? []).map(rowToBreakPoolItem),
    questionSets: (setsRes.data ?? []).map(rowToQuestionSet),
    activityLibrary: (activitiesRes.data ?? []).map(rowToActivity),
    planTemplates: (templatesRes.data ?? []).map(rowToTemplate),
    weeklySchedule: (scheduleRes.data ?? []).map(rowToWeeklyScheduleEntry),
    rotationModes,
    taskCompletionCounts,
    toolUsage,
    correctionsCount,
    scratchText,
    onboardedIds,
    weeklyPlanApplied,
  };
}

// ---------------------------------------------------------------------------
// Push (write-through) helpers — best-effort, fire-and-forget from the
// store's point of view; errors are logged so a broken sync is visible in
// the console rather than silently dropped.
// ---------------------------------------------------------------------------

const logIfError = (label: string) => (res: { error: { message: string } | null }) => {
  if (res.error) console.error(`[sync] ${label} failed:`, res.error.message);
};

const upsert = (table: string, row: Row) => {
  if (!isSupabaseConfigured) return;
  supabase.from(table).upsert(row).then(logIfError(`upsert ${table}`));
};

const remove = (table: string, match: Row) => {
  if (!isSupabaseConfigured) return;
  supabase.from(table).delete().match(match).then(logIfError(`delete ${table}`));
};

export const pushStudent = (s: Student) => upsert('students', studentToRow(s));
export const deleteStudentRemote = (id: string) => remove('students', { id });

export const pushRotation = (studentId: string, subject: Subject, tasks: Task[]) =>
  upsert('rotations', { student_id: studentId, subject, tasks });

export const pushProgress = (studentId: string, subject: Subject, p: SubjectProgress) =>
  upsert('subject_progress', progressToRow(studentId, subject, p));

export const pushBreakRequest = (b: BreakRequest) =>
  upsert('break_requests', { id: b.id, student_id: b.studentId, occurred_at: b.timestamp, status: b.status });
export const deleteBreakRequestRemote = (id: string) => remove('break_requests', { id });

export const pushHelpPing = (h: HelpPing) =>
  upsert('help_pings', { id: h.id, student_id: h.studentId, occurred_at: h.timestamp, resolved: h.resolved });

export const pushOffscreenReview = (o: OffscreenReview) =>
  upsert('offscreen_reviews', {
    id: o.id,
    student_id: o.studentId,
    subject: o.subject,
    task_id: o.taskId,
    task_title: o.taskTitle,
    occurred_at: o.timestamp,
    verified: o.verified,
  });

export const pushBadge = (b: BadgeDef) => upsert('badges', b);
export const deleteBadgeRemote = (id: string) => remove('badges', { id });

export const pushBadgeEarn = (e: BadgeEarn) =>
  upsert('badge_earns', { id: e.id, student_id: e.studentId, badge_id: e.badgeId, earned_at: e.date });

export const pushBreakPoolItem = (i: BreakPoolItem) =>
  upsert('break_pool_items', { id: i.id, title: i.title, kind: i.kind, value: i.value, student_id: i.studentId ?? null });
export const deleteBreakPoolItemRemote = (id: string) => remove('break_pool_items', { id });

export const pushQuestionSet = (q: QuestionSet) =>
  upsert('question_sets', {
    id: q.id,
    name: q.name,
    subject: q.subject,
    kind: q.kind,
    questions: q.questions,
    cards: q.cards,
    cover_image_url: q.coverImageUrl ?? null,
    created_at: q.createdAt,
  });
export const deleteQuestionSetRemote = (id: string) => remove('question_sets', { id });

export const pushRotationMode = (studentId: string, subject: Subject, mode: RotationMode) =>
  upsert('rotation_modes', { student_id: studentId, subject, mode });

export const pushActivity = (a: ActivityLibraryItem) => upsert('activity_library', activityToRow(a));
export const deleteActivityRemote = (id: string) => remove('activity_library', { id });

export const pushTemplate = (t: PlanTemplate) =>
  upsert('plan_templates', { id: t.id, name: t.name, subject: t.subject, activities: t.activities, created_at: t.createdAt });
export const deleteTemplateRemote = (id: string) => remove('plan_templates', { id });

export const pushWeeklyScheduleEntry = (w: WeeklyScheduleEntry) => upsert('weekly_schedule', weeklyScheduleEntryToRow(w));
export const deleteWeeklyScheduleEntryRemote = (id: string) => remove('weekly_schedule', { id });

export interface StudentMetaSlice {
  taskCompletionCounts: Record<string, number>; // just this student's, keyed by taskId (not the composite key)
  toolUsage: ToolKey[];
  correctionsCount: number;
  scratchText: string;
  onboarded: boolean;
  weeklyPlanApplied: Partial<Record<Subject, string>>; // subject -> last ISO date its weekly schedule was auto-applied
}

export const pushStudentMeta = (studentId: string, data: StudentMetaSlice) =>
  upsert('student_meta', {
    student_id: studentId,
    task_completion_counts: data.taskCompletionCounts,
    tool_usage: data.toolUsage,
    corrections_count: data.correctionsCount,
    scratch_text: data.scratchText,
    onboarded: data.onboarded,
    weekly_plan_applied: data.weeklyPlanApplied,
  });

// ---------------------------------------------------------------------------
// Realtime: fold incoming changes into existing in-memory collections
// ---------------------------------------------------------------------------

export type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export function applyArrayRow<T extends { id: string }>(
  arr: T[],
  eventType: ChangeEvent,
  mapRow: (r: Row) => T,
  newRow: Row | null,
  oldRow: Row | null,
): T[] {
  if (eventType === 'DELETE') {
    const id = oldRow?.id;
    return id ? arr.filter((x) => x.id !== id) : arr;
  }
  if (!newRow) return arr;
  const mapped = mapRow(newRow);
  const idx = arr.findIndex((x) => x.id === mapped.id);
  if (idx === -1) return [mapped, ...arr];
  const next = [...arr];
  next[idx] = mapped;
  return next;
}

export function applyNestedRow<T>(
  map: Record<string, Record<Subject, T>>,
  eventType: ChangeEvent,
  mapRow: (r: Row) => T,
  newRow: Row | null,
  oldRow: Row | null,
): Record<string, Record<Subject, T>> {
  const studentId: string | undefined = newRow?.student_id ?? oldRow?.student_id;
  const subject: Subject | undefined = newRow?.subject ?? oldRow?.subject;
  if (!studentId || !subject) return map;
  if (eventType === 'DELETE') {
    if (!map[studentId]) return map;
    const inner = { ...map[studentId] };
    delete inner[subject];
    return { ...map, [studentId]: inner };
  }
  if (!newRow) return map;
  return { ...map, [studentId]: { ...(map[studentId] ?? {}), [subject]: mapRow(newRow) } };
}

export interface StudentMetaState {
  taskCompletionCounts: Record<string, number>;
  toolUsage: Record<string, ToolKey[]>;
  correctionsCount: Record<string, number>;
  scratchText: Record<string, string>;
  onboardedIds: string[];
  weeklyPlanApplied: Record<string, Partial<Record<Subject, string>>>;
}

export function applyStudentMetaRow(
  current: StudentMetaState,
  eventType: ChangeEvent,
  newRow: Row | null,
  oldRow: Row | null,
): StudentMetaState {
  const studentId: string | undefined = newRow?.student_id ?? oldRow?.student_id;
  if (!studentId) return current;

  const taskCompletionCounts = { ...current.taskCompletionCounts };
  for (const k of Object.keys(taskCompletionCounts)) {
    if (k.startsWith(`${studentId}:`)) delete taskCompletionCounts[k];
  }

  if (eventType === 'DELETE') {
    const toolUsage = { ...current.toolUsage };
    delete toolUsage[studentId];
    const correctionsCount = { ...current.correctionsCount };
    delete correctionsCount[studentId];
    const scratchText = { ...current.scratchText };
    delete scratchText[studentId];
    const weeklyPlanApplied = { ...current.weeklyPlanApplied };
    delete weeklyPlanApplied[studentId];
    return {
      taskCompletionCounts,
      toolUsage,
      correctionsCount,
      scratchText,
      onboardedIds: current.onboardedIds.filter((id) => id !== studentId),
      weeklyPlanApplied,
    };
  }

  if (!newRow) return current;
  for (const [taskId, count] of Object.entries(newRow.task_completion_counts ?? {})) {
    taskCompletionCounts[`${studentId}:${taskId}`] = count as number;
  }
  const onboardedIds = newRow.onboarded
    ? current.onboardedIds.includes(studentId)
      ? current.onboardedIds
      : [...current.onboardedIds, studentId]
    : current.onboardedIds.filter((id) => id !== studentId);

  return {
    taskCompletionCounts,
    toolUsage: { ...current.toolUsage, [studentId]: newRow.tool_usage ?? [] },
    correctionsCount: { ...current.correctionsCount, [studentId]: newRow.corrections_count ?? 0 },
    scratchText: { ...current.scratchText, [studentId]: newRow.scratch_text ?? '' },
    onboardedIds,
    weeklyPlanApplied: { ...current.weeklyPlanApplied, [studentId]: newRow.weekly_plan_applied ?? {} },
  };
}

export { rowToStudent, rowToProgress, rowToBreakRequest, rowToHelpPing, rowToOffscreenReview, rowToBadge, rowToBadgeEarn, rowToBreakPoolItem, rowToQuestionSet, rowToActivity, rowToTemplate, rowToWeeklyScheduleEntry };

export interface RealtimeHandlers {
  onStudent: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onRotation: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onProgress: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onBreakRequest: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onHelpPing: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onOffscreenReview: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onBadge: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onBadgeEarn: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onBreakPoolItem: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onQuestionSet: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onRotationMode: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onStudentMeta: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onActivity: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onTemplate: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onWeeklySchedule: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
}

export function subscribeRealtime(handlers: RealtimeHandlers): () => void {
  if (!isSupabaseConfigured) return () => {};

  type Payload = { eventType: ChangeEvent; new: Row; old: Row };
  const wire = (handler: (e: ChangeEvent, n: Row | null, o: Row | null) => void) =>
    (payload: Payload) => {
      const n = Object.keys(payload.new ?? {}).length ? payload.new : null;
      const o = Object.keys(payload.old ?? {}).length ? payload.old : null;
      handler(payload.eventType, n, o);
    };

  const channel = supabase
    .channel('iwd-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, wire(handlers.onStudent))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rotations' }, wire(handlers.onRotation))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'subject_progress' }, wire(handlers.onProgress))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'break_requests' }, wire(handlers.onBreakRequest))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'help_pings' }, wire(handlers.onHelpPing))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'offscreen_reviews' }, wire(handlers.onOffscreenReview))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'badges' }, wire(handlers.onBadge))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'badge_earns' }, wire(handlers.onBadgeEarn))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'break_pool_items' }, wire(handlers.onBreakPoolItem))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'question_sets' }, wire(handlers.onQuestionSet))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rotation_modes' }, wire(handlers.onRotationMode))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'student_meta' }, wire(handlers.onStudentMeta))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_library' }, wire(handlers.onActivity))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_templates' }, wire(handlers.onTemplate))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_schedule' }, wire(handlers.onWeeklySchedule))
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
