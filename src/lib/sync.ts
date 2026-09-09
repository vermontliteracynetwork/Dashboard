import { supabase, isSupabaseConfigured } from './supabaseClient';
import type {
  Student,
  Subject,
  Task,
  SubjectProgress,
  BreakRequest,
  HelpPing,
  OffscreenReview,
  QuizAttemptRecord,
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
  Assignment,
  Transaction,
  ArticleAnnotationSet,
  SentenceBuilderResponse,
  ChatMessage,
  Note,
  MarketplaceItem,
  AssignmentCompletionReward,
} from '../types';
import { STARTER_EMOTE_IDS } from './emoteCatalog';
import { STARTER_FONT_IDS, STARTER_COLOR_IDS, STARTER_VOICE_IDS } from './marketplaceSeed';

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
  customTools: r.custom_tools ?? [],
  coins: r.coins ?? 0,
  // Grandfather in whatever avatar a student already had before this
  // marketplace system existed, so nobody who already picked an avatar
  // loses access to it.
  ownedAvatarIds: r.owned_avatar_ids && r.owned_avatar_ids.length > 0 ? r.owned_avatar_ids : [r.avatar],
  ownedEmoteIds: r.owned_emote_ids && r.owned_emote_ids.length > 0 ? r.owned_emote_ids : [...STARTER_EMOTE_IDS],
  equippedEmoteId: r.equipped_emote_id ?? null,
  skipTokens: r.skip_tokens ?? 0,
  lastSpinDate: r.last_spin_date ?? null,
  ownedFontIds: r.owned_font_ids && r.owned_font_ids.length > 0 ? r.owned_font_ids : [...STARTER_FONT_IDS],
  equippedFontId: r.equipped_font_id ?? null,
  ownedColorIds: r.owned_color_ids && r.owned_color_ids.length > 0 ? r.owned_color_ids : [...STARTER_COLOR_IDS],
  equippedColorId: r.equipped_color_id ?? null,
  equippedHighlightColorId: r.equipped_highlight_color_id ?? null,
  equippedMarkerColorId: r.equipped_marker_color_id ?? null,
  ownedVoiceIds: r.owned_voice_ids && r.owned_voice_ids.length > 0 ? r.owned_voice_ids : [...STARTER_VOICE_IDS],
  equippedVoiceId: r.equipped_voice_id ?? null,
  ownedPrizeIds: r.owned_prize_ids ?? [],
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
  custom_tools: s.customTools,
  coins: s.coins,
  owned_avatar_ids: s.ownedAvatarIds,
  owned_emote_ids: s.ownedEmoteIds,
  equipped_emote_id: s.equippedEmoteId,
  skip_tokens: s.skipTokens,
  last_spin_date: s.lastSpinDate,
  owned_font_ids: s.ownedFontIds,
  equipped_font_id: s.equippedFontId,
  owned_color_ids: s.ownedColorIds,
  equipped_color_id: s.equippedColorId,
  equipped_highlight_color_id: s.equippedHighlightColorId,
  equipped_marker_color_id: s.equippedMarkerColorId,
  owned_voice_ids: s.ownedVoiceIds,
  equipped_voice_id: s.equippedVoiceId,
  owned_prize_ids: s.ownedPrizeIds,
});

const rowToProgress = (r: Row): SubjectProgress => ({
  date: r.date,
  activeIndex: r.active_index,
  completedTaskIds: r.completed_task_ids ?? [],
  skippedTaskIds: r.skipped_task_ids ?? [],
  quizState: r.quiz_state ?? {},
  sessionRitualSeen: r.session_ritual_seen,
  subjectComplete: r.subject_complete,
  completedAt: r.completed_at ?? undefined,
});

const progressToRow = (studentId: string, subject: Subject, p: SubjectProgress): Row => ({
  student_id: studentId,
  subject,
  date: p.date,
  active_index: p.activeIndex,
  completed_task_ids: p.completedTaskIds,
  skipped_task_ids: p.skippedTaskIds,
  quiz_state: p.quizState,
  session_ritual_seen: p.sessionRitualSeen,
  subject_complete: p.subjectComplete,
  completed_at: p.completedAt ?? null,
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
  photoUrl: r.photo_url ?? undefined,
});

const rowToQuizAttempt = (r: Row): QuizAttemptRecord => ({
  id: r.id,
  studentId: r.student_id,
  subject: r.subject,
  taskId: r.task_id,
  taskTitle: r.task_title,
  startedAt: r.started_at,
  completedAt: r.completed_at,
  durationMs: r.duration_ms,
  correctCount: r.correct_count,
  totalCount: r.total_count,
});
const quizAttemptToRow = (a: QuizAttemptRecord): Row => ({
  id: a.id,
  student_id: a.studentId,
  subject: a.subject,
  task_id: a.taskId,
  task_title: a.taskTitle,
  started_at: a.startedAt,
  completed_at: a.completedAt,
  duration_ms: a.durationMs,
  correct_count: a.correctCount,
  total_count: a.totalCount,
});

const rowToBadge = (r: Row): BadgeDef => ({ id: r.id, name: r.name, description: r.description, icon: r.icon, rule: r.rule ?? undefined, rewardCents: r.reward_cents ?? undefined });
const badgeToRow = (b: BadgeDef): Row => ({ id: b.id, name: b.name, description: b.description, icon: b.icon, rule: b.rule ?? null, reward_cents: b.rewardCents ?? null });

const rowToBadgeEarn = (r: Row): BadgeEarn => ({ id: r.id, studentId: r.student_id, badgeId: r.badge_id, date: r.earned_at });

const rowToChatMessage = (r: Row): ChatMessage => ({ id: r.id, studentId: r.student_id, sender: r.sender, text: r.text, createdAt: r.created_at });
const chatMessageToRow = (m: ChatMessage): Row => ({ id: m.id, student_id: m.studentId, sender: m.sender, text: m.text, created_at: m.createdAt });

const rowToNote = (r: Row): Note => ({
  id: r.id,
  studentId: r.student_id,
  title: r.title,
  body: r.body,
  fontId: r.font_id ?? null,
  colorId: r.color_id ?? null,
  highlightColorId: r.highlight_color_id ?? null,
  updatedAt: r.updated_at,
});
const noteToRow = (n: Note): Row => ({
  id: n.id,
  student_id: n.studentId,
  title: n.title,
  body: n.body,
  highlight_color_id: n.highlightColorId,
  font_id: n.fontId,
  color_id: n.colorId,
  updated_at: n.updatedAt,
});

const rowToMarketplaceItem = (r: Row): MarketplaceItem => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  icon: r.icon,
  price: r.price,
  category: r.category,
  tags: r.tags ?? [],
  description: r.description ?? undefined,
  availableFrom: r.available_from ?? null,
  availableUntil: r.available_until ?? null,
  createdAt: r.created_at,
  cssFontFamily: r.css_font_family ?? undefined,
  colorHex: r.color_hex ?? undefined,
  colorUse: r.color_use ?? undefined,
  voicePitch: r.voice_pitch ?? undefined,
  voiceRate: r.voice_rate ?? undefined,
  voiceHints: r.voice_hints ?? undefined,
});
const marketplaceItemToRow = (it: MarketplaceItem): Row => ({
  id: it.id,
  kind: it.kind,
  name: it.name,
  icon: it.icon,
  price: it.price,
  category: it.category,
  tags: it.tags,
  description: it.description ?? null,
  available_from: it.availableFrom ?? null,
  available_until: it.availableUntil ?? null,
  created_at: it.createdAt,
  css_font_family: it.cssFontFamily ?? null,
  color_hex: it.colorHex ?? null,
  color_use: it.colorUse ?? null,
  voice_pitch: it.voicePitch ?? null,
  voice_rate: it.voiceRate ?? null,
  voice_hints: it.voiceHints ?? null,
});

const rowToAppSettings = (r: Row): AssignmentCompletionReward | null => r.assignment_completion_reward ?? null;

const rowToTransaction = (r: Row): Transaction => ({
  id: r.id,
  studentId: r.student_id,
  amountCents: r.amount_cents,
  description: r.description,
  icon: r.icon,
  kind: r.kind,
  createdAt: r.created_at,
});

const transactionToRow = (t: Transaction): Row => ({
  id: t.id,
  student_id: t.studentId,
  amount_cents: t.amountCents,
  description: t.description,
  icon: t.icon,
  kind: t.kind,
  created_at: t.createdAt,
});

const annotationKey = (studentId: string, taskId: string, articleIndex: number) => `${studentId}:${taskId}:${articleIndex}`;

const rowToAnnotation = (r: Row): ArticleAnnotationSet => ({
  studentId: r.student_id,
  taskId: r.task_id,
  articleIndex: r.article_index,
  highlights: r.highlights ?? [],
});

const annotationToRow = (a: ArticleAnnotationSet): Row => ({
  id: annotationKey(a.studentId, a.taskId, a.articleIndex),
  student_id: a.studentId,
  task_id: a.taskId,
  article_index: a.articleIndex,
  highlights: a.highlights,
});

const sbResponseKey = (studentId: string, taskId: string) => `${studentId}:${taskId}`;

const rowToSbResponse = (r: Row): SentenceBuilderResponse => ({
  studentId: r.student_id,
  taskId: r.task_id,
  answers: r.answers ?? {},
  updatedAt: r.updated_at,
});

const sbResponseToRow = (a: SentenceBuilderResponse): Row => ({
  id: sbResponseKey(a.studentId, a.taskId),
  student_id: a.studentId,
  task_id: a.taskId,
  answers: a.answers,
  updated_at: a.updatedAt,
});

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
  isDaily: r.is_daily ?? false,
  createdAt: r.created_at,
  rewardCents: r.reward_cents ?? undefined,
  article: r.article ?? undefined,
  sentenceBuilder: r.sentence_builder ?? undefined,
  linkChoice: r.link_choice ?? undefined,
  tags: r.tags ?? [],
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
  is_daily: a.isDaily ?? false,
  created_at: a.createdAt,
  reward_cents: a.rewardCents ?? null,
  article: a.article ?? null,
  sentence_builder: a.sentenceBuilder ?? null,
  link_choice: a.linkChoice ?? null,
  tags: a.tags ?? [],
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

const rowToAssignment = (r: Row): Assignment => ({
  id: r.id,
  studentId: r.student_id,
  subject: r.subject,
  templateId: r.template_id,
  startDate: r.start_date,
  endDate: r.end_date,
  mode: r.mode,
  applied: r.applied ?? false,
});

const assignmentToRow = (a: Assignment): Row => ({
  id: a.id,
  student_id: a.studentId,
  subject: a.subject,
  template_id: a.templateId,
  start_date: a.startDate,
  end_date: a.endDate,
  mode: a.mode,
  applied: a.applied,
});

// ---------------------------------------------------------------------------
// Fetch everything once, folded into the shapes the store keeps in memory
// ---------------------------------------------------------------------------

export interface BadgeCounters {
  subjectsCompletedCount: Partial<Record<Subject, number>>;
  finalChecksPassed: Partial<Record<Subject, number>>;
}
const emptyBadgeCounters = (): BadgeCounters => ({ subjectsCompletedCount: {}, finalChecksPassed: {} });

export interface HydratedState {
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
  questionSets: QuestionSet[];
  activityLibrary: ActivityLibraryItem[];
  planTemplates: PlanTemplate[];
  weeklySchedule: WeeklyScheduleEntry[];
  assignments: Assignment[];
  transactions: Transaction[];
  articleAnnotations: Record<string, ArticleAnnotationSet>;
  sentenceBuilderResponses: Record<string, SentenceBuilderResponse>;
  chatMessages: ChatMessage[];
  notes: Note[];
  marketplaceItems: MarketplaceItem[];
  assignmentCompletionReward: AssignmentCompletionReward | null;
  rotationModes: Record<string, Record<Subject, RotationMode>>;
  taskCompletionCounts: Record<string, number>;
  toolUsage: Record<string, ToolKey[]>;
  correctionsCount: Record<string, number>;
  scratchText: Record<string, string>;
  onboardedIds: string[];
  weeklyPlanApplied: Record<string, Partial<Record<Subject, string>>>;
  badgeCounters: Record<string, BadgeCounters>;
}

export async function fetchAll(): Promise<HydratedState> {
  const [
    studentsRes, rotationsRes, progressRes, breaksRes, pingsRes, reviewsRes,
    badgesRes, earnsRes, poolRes, setsRes, modesRes, metaRes, activitiesRes, templatesRes, scheduleRes, assignmentsRes,
    quizAttemptsRes, transactionsRes, annotationsRes, sbResponsesRes, chatMessagesRes, notesRes, marketplaceItemsRes, appSettingsRes,
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
    supabase.from('assignments').select('*'),
    supabase.from('quiz_attempts').select('*'),
    supabase.from('transactions').select('*'),
    supabase.from('article_annotations').select('*'),
    supabase.from('sentence_builder_responses').select('*'),
    supabase.from('chat_messages').select('*'),
    supabase.from('notes').select('*'),
    supabase.from('marketplace_items').select('*'),
    supabase.from('app_settings').select('*').eq('id', 'global').maybeSingle(),
  ]);

  for (const res of [studentsRes, rotationsRes, progressRes, breaksRes, pingsRes, reviewsRes, badgesRes, earnsRes, poolRes, setsRes, modesRes, metaRes, activitiesRes, templatesRes, scheduleRes, assignmentsRes, quizAttemptsRes, transactionsRes, annotationsRes, sbResponsesRes, chatMessagesRes, notesRes, marketplaceItemsRes, appSettingsRes]) {
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
  const badgeCounters: Record<string, BadgeCounters> = {};
  for (const r of metaRes.data ?? []) {
    for (const [taskId, count] of Object.entries(r.task_completion_counts ?? {})) {
      taskCompletionCounts[`${r.student_id}:${taskId}`] = count as number;
    }
    toolUsage[r.student_id] = r.tool_usage ?? [];
    correctionsCount[r.student_id] = r.corrections_count ?? 0;
    scratchText[r.student_id] = r.scratch_text ?? '';
    if (r.onboarded) onboardedIds.push(r.student_id);
    weeklyPlanApplied[r.student_id] = r.weekly_plan_applied ?? {};
    badgeCounters[r.student_id] = r.badge_counters ?? emptyBadgeCounters();
  }

  return {
    students: (studentsRes.data ?? []).map(rowToStudent),
    rotations,
    progress,
    breakRequests: (breaksRes.data ?? []).map(rowToBreakRequest),
    helpPings: (pingsRes.data ?? []).map(rowToHelpPing),
    offscreenReviews: (reviewsRes.data ?? []).map(rowToOffscreenReview),
    quizAttempts: (quizAttemptsRes.data ?? []).map(rowToQuizAttempt),
    badges: (badgesRes.data ?? []).map(rowToBadge),
    badgeEarns: (earnsRes.data ?? []).map(rowToBadgeEarn),
    breakPool: (poolRes.data ?? []).map(rowToBreakPoolItem),
    questionSets: (setsRes.data ?? []).map(rowToQuestionSet),
    activityLibrary: (activitiesRes.data ?? []).map(rowToActivity),
    planTemplates: (templatesRes.data ?? []).map(rowToTemplate),
    weeklySchedule: (scheduleRes.data ?? []).map(rowToWeeklyScheduleEntry),
    assignments: (assignmentsRes.data ?? []).map(rowToAssignment),
    transactions: (transactionsRes.data ?? []).map(rowToTransaction),
    articleAnnotations: Object.fromEntries(
      (annotationsRes.data ?? []).map(rowToAnnotation).map((a) => [annotationKey(a.studentId, a.taskId, a.articleIndex), a]),
    ),
    sentenceBuilderResponses: Object.fromEntries(
      (sbResponsesRes.data ?? []).map(rowToSbResponse).map((a) => [sbResponseKey(a.studentId, a.taskId), a]),
    ),
    chatMessages: (chatMessagesRes.data ?? []).map(rowToChatMessage),
    notes: (notesRes.data ?? []).map(rowToNote),
    marketplaceItems: (marketplaceItemsRes.data ?? []).map(rowToMarketplaceItem),
    assignmentCompletionReward: appSettingsRes.data ? rowToAppSettings(appSettingsRes.data) : null,
    rotationModes,
    taskCompletionCounts,
    toolUsage,
    correctionsCount,
    scratchText,
    onboardedIds,
    weeklyPlanApplied,
    badgeCounters,
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
    photo_url: o.photoUrl ?? null,
  });

export const pushQuizAttempt = (a: QuizAttemptRecord) => upsert('quiz_attempts', quizAttemptToRow(a));

export const pushBadge = (b: BadgeDef) => upsert('badges', badgeToRow(b));
export const deleteBadgeRemote = (id: string) => remove('badges', { id });

export const pushBadgeEarn = (e: BadgeEarn) =>
  upsert('badge_earns', { id: e.id, student_id: e.studentId, badge_id: e.badgeId, earned_at: e.date });
export const deleteBadgeEarnRemote = (id: string) => remove('badge_earns', { id });

export const pushTransaction = (t: Transaction) => upsert('transactions', transactionToRow(t));
export const deleteTransactionRemote = (id: string) => remove('transactions', { id });
export const pushAnnotation = (a: ArticleAnnotationSet) => upsert('article_annotations', annotationToRow(a));
export const pushSbResponse = (a: SentenceBuilderResponse) => upsert('sentence_builder_responses', sbResponseToRow(a));
export const pushChatMessage = (m: ChatMessage) => upsert('chat_messages', chatMessageToRow(m));
export const pushNote = (n: Note) => upsert('notes', noteToRow(n));
export const deleteNoteRemote = (id: string) => remove('notes', { id });
export const pushMarketplaceItem = (it: MarketplaceItem) => upsert('marketplace_items', marketplaceItemToRow(it));
export const deleteMarketplaceItemRemote = (id: string) => remove('marketplace_items', { id });

export const pushAppSettings = (reward: AssignmentCompletionReward | null) =>
  upsert('app_settings', { id: 'global', assignment_completion_reward: reward, updated_at: new Date().toISOString() });

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

export const pushAssignment = (a: Assignment) => upsert('assignments', assignmentToRow(a));
export const deleteAssignmentRemote = (id: string) => remove('assignments', { id });

export interface StudentMetaSlice {
  taskCompletionCounts: Record<string, number>; // just this student's, keyed by taskId (not the composite key)
  toolUsage: ToolKey[];
  correctionsCount: number;
  scratchText: string;
  onboarded: boolean;
  weeklyPlanApplied: Partial<Record<Subject, string>>; // subject -> last ISO date its weekly schedule was auto-applied
  badgeCounters: BadgeCounters;
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
    badge_counters: data.badgeCounters,
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
  badgeCounters: Record<string, BadgeCounters>;
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
    const badgeCounters = { ...current.badgeCounters };
    delete badgeCounters[studentId];
    return {
      taskCompletionCounts,
      toolUsage,
      correctionsCount,
      scratchText,
      onboardedIds: current.onboardedIds.filter((id) => id !== studentId),
      weeklyPlanApplied,
      badgeCounters,
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
    badgeCounters: { ...current.badgeCounters, [studentId]: newRow.badge_counters ?? emptyBadgeCounters() },
  };
}

export { rowToStudent, rowToProgress, rowToBreakRequest, rowToHelpPing, rowToOffscreenReview, rowToQuizAttempt, rowToBadge, rowToBadgeEarn, rowToBreakPoolItem, rowToQuestionSet, rowToActivity, rowToTemplate, rowToWeeklyScheduleEntry, rowToAssignment, rowToTransaction, rowToAnnotation, annotationKey, rowToSbResponse, sbResponseKey, rowToChatMessage, rowToNote, rowToMarketplaceItem };

export interface RealtimeHandlers {
  onStudent: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onRotation: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onProgress: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onBreakRequest: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onHelpPing: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onOffscreenReview: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onQuizAttempt: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onBadge: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onBadgeEarn: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onBreakPoolItem: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onQuestionSet: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onRotationMode: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onStudentMeta: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onActivity: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onTemplate: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onWeeklySchedule: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onAssignment: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onTransaction: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onAnnotation: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onSbResponse: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onChatMessage: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onNote: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onMarketplaceItem: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onAppSettings: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_attempts' }, wire(handlers.onQuizAttempt))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'badges' }, wire(handlers.onBadge))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'badge_earns' }, wire(handlers.onBadgeEarn))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'break_pool_items' }, wire(handlers.onBreakPoolItem))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'question_sets' }, wire(handlers.onQuestionSet))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rotation_modes' }, wire(handlers.onRotationMode))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'student_meta' }, wire(handlers.onStudentMeta))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_library' }, wire(handlers.onActivity))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_templates' }, wire(handlers.onTemplate))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_schedule' }, wire(handlers.onWeeklySchedule))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, wire(handlers.onAssignment))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, wire(handlers.onTransaction))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'article_annotations' }, wire(handlers.onAnnotation))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sentence_builder_responses' }, wire(handlers.onSbResponse))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, wire(handlers.onChatMessage))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, wire(handlers.onNote))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_items' }, wire(handlers.onMarketplaceItem))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, wire(handlers.onAppSettings))
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
