import { supabase, isSupabaseConfigured } from './supabaseClient';
import type {
  Student,
  Subject,
  Task,
  SubjectProgress,
  BreakRequest,
  HelpPing,
  StudentFeedback,
  QuizStruggle,
  OffscreenReview,
  QuizAttemptRecord,
  BadgeDef,
  BadgeEarn,
  BreakPoolItem,
  QuestionSet,
  CinemaVideo,
  ScratchGame,
  MusicTrack,
  RotationMode,
  ToolKey,
  ProgressMap,
  ActivityLibraryItem,
  PlanTemplate,
  WeeklyScheduleEntry,
  Assignment,
  LiteracyFocusSet,
  Transaction,
  ArticleAnnotationSet,
  SentenceBuilderResponse,
  ChatMessage,
  Note,
  MarketplaceItem,
  AssignmentCompletionReward,
  WorldObject,
  WallSegment,
  GroundPatch,
  LayoutOverride,
  Focus,
  StudentPet,
  HomeRoomDef,
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
  customTools: r.custom_tools ?? [],
  coins: r.coins ?? 0,
  savingsGoalLabel: r.savings_goal_label ?? null,
  savingsGoalCents: r.savings_goal_cents ?? null,
  countItOutEnabled: r.count_it_out_enabled ?? false,
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
  quizTheme: r.quiz_theme ?? 'standard',
  bonusSpinAvailable: r.bonus_spin_available ?? false,
  worldQuest1MetIds: r.world_quest1_met_ids ?? [],
  favoriteCinemaVideoIds: r.favorite_cinema_video_ids ?? [],
  favoriteScratchGameIds: r.favorite_scratch_game_ids ?? [],
  lastMysteryPackOpenedDate: r.last_mystery_pack_opened_date ?? null,
  worldMoveSensitivity: r.world_move_sensitivity ?? 1,
  worldDpadSide: r.world_dpad_side ?? 'left',
  worldNpcLastTalkDates: r.world_npc_last_talk_dates ?? {},
  worldJokesHeardIds: r.world_jokes_heard_ids ?? [],
  worldTalkRewardCents: r.world_talk_reward_cents ?? 5,
  worldShowArrivalCard: r.world_show_arrival_card ?? true,
  worldShowDeskGlow: r.world_show_desk_glow ?? true,
  islandBuildUnlocked: r.island_build_unlocked ?? false,
  lastSeenChangelogId: r.last_seen_changelog_id ?? undefined,
  worldReduceMotion: r.world_reduce_motion ?? false,
  dyslexiaFont: r.dyslexia_font ?? false,
  homeWallColor: r.home_wall_color ?? undefined,
  homeFloorTexture: r.home_floor_texture ?? undefined,
  houseExteriorPath: r.house_exterior_path ?? undefined,
  petCouponRedeemed: r.pet_coupon_redeemed ?? false,
  discoveredPetDefIds: r.discovered_pet_def_ids ?? [],
  shelterDonationsCents: r.shelter_donations_cents ?? 0,
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
  custom_tools: s.customTools,
  coins: s.coins,
  savings_goal_label: s.savingsGoalLabel,
  savings_goal_cents: s.savingsGoalCents,
  count_it_out_enabled: s.countItOutEnabled,
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
  quiz_theme: s.quizTheme,
  bonus_spin_available: s.bonusSpinAvailable,
  world_quest1_met_ids: s.worldQuest1MetIds,
  favorite_cinema_video_ids: s.favoriteCinemaVideoIds ?? [],
  favorite_scratch_game_ids: s.favoriteScratchGameIds ?? [],
  last_mystery_pack_opened_date: s.lastMysteryPackOpenedDate ?? null,
  world_move_sensitivity: s.worldMoveSensitivity,
  world_dpad_side: s.worldDpadSide,
  world_npc_last_talk_dates: s.worldNpcLastTalkDates,
  world_jokes_heard_ids: s.worldJokesHeardIds,
  world_talk_reward_cents: s.worldTalkRewardCents,
  world_show_arrival_card: s.worldShowArrivalCard,
  world_show_desk_glow: s.worldShowDeskGlow,
  island_build_unlocked: s.islandBuildUnlocked ?? false,
  last_seen_changelog_id: s.lastSeenChangelogId ?? null,
  world_reduce_motion: s.worldReduceMotion,
  dyslexia_font: s.dyslexiaFont,
  home_wall_color: s.homeWallColor ?? null,
  home_floor_texture: s.homeFloorTexture ?? null,
  house_exterior_path: s.houseExteriorPath ?? null,
  pet_coupon_redeemed: s.petCouponRedeemed ?? false,
  discovered_pet_def_ids: s.discoveredPetDefIds ?? [],
  shelter_donations_cents: s.shelterDonationsCents ?? 0,
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

const rowToQuizStruggle = (r: Row): QuizStruggle => ({
  id: r.id,
  studentId: r.student_id,
  subject: r.subject,
  taskId: r.task_id,
  taskTitle: r.task_title,
  questionPrompt: r.question_prompt ?? '',
  timestamp: r.occurred_at,
  resolved: r.resolved,
});
const quizStruggleToRow = (q: QuizStruggle): Row => ({
  id: q.id,
  student_id: q.studentId,
  subject: q.subject,
  task_id: q.taskId,
  task_title: q.taskTitle,
  question_prompt: q.questionPrompt,
  occurred_at: q.timestamp,
  resolved: q.resolved,
});

const rowToStudentFeedback = (r: Row): StudentFeedback => ({
  id: r.id,
  studentId: r.student_id,
  category: r.category,
  subcategoryLabel: r.subcategory_label ?? undefined,
  customLabel: r.custom_label ?? undefined,
  text: r.text ?? '',
  createdAt: r.created_at,
  resolved: r.resolved,
});
const studentFeedbackToRow = (f: StudentFeedback): Row => ({
  id: f.id,
  student_id: f.studentId,
  category: f.category,
  subcategory_label: f.subcategoryLabel ?? null,
  custom_label: f.customLabel ?? null,
  text: f.text,
  created_at: f.createdAt,
  resolved: f.resolved,
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
  bodyHtml: r.body_html ?? undefined,
  fontId: r.font_id ?? null,
  colorId: r.color_id ?? null,
  highlightColorId: r.highlight_color_id ?? null,
  updatedAt: r.updated_at,
  kind: r.kind === 'journal' ? 'journal' : 'note',
});
const noteToRow = (n: Note): Row => ({
  id: n.id,
  student_id: n.studentId,
  title: n.title,
  body: n.body,
  body_html: n.bodyHtml ?? null,
  kind: n.kind ?? 'note',
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

// Direct teacher request: every assignment should default to popping a
// bonus wheel spin on completion, not require a teacher to opt in first.
// A student's row genuinely never having this configured and a teacher
// explicitly turning it off both store as a null column (setAssignmentCompletionReward(null)
// is exactly how the "off" checkbox in MarketplaceManager works) — there's
// no way to tell those two states apart today. Defaulting the unset case
// to a spin (rather than null) accepts that a never-touched teacher
// account gets the default they asked for; any FUTURE explicit opt-off
// still writes a real null and is honored from then on.
export const DEFAULT_ASSIGNMENT_COMPLETION_REWARD: AssignmentCompletionReward = { type: 'spin' };
const rowToAppSettings = (r: Row): AssignmentCompletionReward | null => r.assignment_completion_reward ?? DEFAULT_ASSIGNMENT_COMPLETION_REWARD;

const rowToTransaction = (r: Row): Transaction => ({
  id: r.id,
  studentId: r.student_id,
  amountCents: r.amount_cents,
  description: r.description,
  icon: r.icon,
  kind: r.kind,
  createdAt: r.created_at,
  voided: r.voided ?? false,
  needsWants: r.needs_wants ?? undefined,
});

const transactionToRow = (t: Transaction): Row => ({
  id: t.id,
  student_id: t.studentId,
  amount_cents: t.amountCents,
  description: t.description,
  icon: t.icon,
  kind: t.kind,
  created_at: t.createdAt,
  voided: t.voided ?? false,
  needs_wants: t.needsWants ?? null,
});

const rowToWorldObject = (r: Row): WorldObject => ({
  id: r.id,
  modelPath: r.model_path,
  label: r.label,
  customName: r.custom_name ?? undefined,
  role: r.role ?? undefined,
  position: r.position ?? [0, 0, 0],
  rotationY: r.rotation_y ?? 0,
  scale: r.scale ?? 1,
  tintColor: r.tint_color ?? undefined,
  collides: r.collides ?? undefined,
  studentId: r.student_id ?? undefined,
  createdAt: r.created_at,
  status: r.status ?? 'published',
  pendingDelete: r.pending_delete ?? false,
  publishedSnapshot: r.published_snapshot ?? undefined,
  signText: r.sign_text ?? undefined,
  roomId: r.room_id ?? undefined,
  customRoleUrl: r.custom_role_url ?? undefined,
});
const worldObjectToRow = (o: WorldObject): Row => ({
  id: o.id,
  model_path: o.modelPath,
  label: o.label,
  custom_name: o.customName ?? null,
  role: o.role ?? null,
  position: o.position,
  rotation_y: o.rotationY,
  scale: o.scale,
  tint_color: o.tintColor ?? null,
  collides: o.collides ?? null,
  student_id: o.studentId ?? null,
  created_at: o.createdAt,
  status: o.status ?? 'published',
  pending_delete: o.pendingDelete ?? false,
  published_snapshot: o.publishedSnapshot ?? null,
  sign_text: o.signText ?? null,
  room_id: o.roomId ?? null,
  custom_role_url: o.customRoleUrl ?? null,
});

const rowToWallSegment = (r: Row): WallSegment => ({
  id: r.id,
  x1: r.x1,
  z1: r.z1,
  x2: r.x2,
  z2: r.z2,
  height: r.height ?? 3,
  thickness: r.thickness ?? 0.2,
  color: r.color ?? undefined,
  studentId: r.student_id ?? undefined,
  createdAt: r.created_at,
  status: r.status ?? 'published',
  pendingDelete: r.pending_delete ?? false,
  publishedSnapshot: r.published_snapshot ?? undefined,
});
const wallSegmentToRow = (w: WallSegment): Row => ({
  id: w.id,
  x1: w.x1,
  z1: w.z1,
  x2: w.x2,
  z2: w.z2,
  height: w.height,
  thickness: w.thickness,
  color: w.color ?? null,
  student_id: w.studentId ?? null,
  created_at: w.createdAt,
  status: w.status ?? 'published',
  pending_delete: w.pendingDelete ?? false,
  published_snapshot: w.publishedSnapshot ?? null,
});

const rowToGroundPatch = (r: Row): GroundPatch => ({
  id: r.id,
  x: r.x,
  z: r.z,
  radius: r.radius ?? 3,
  texturePath: r.texture_path,
  createdAt: r.created_at,
});
const groundPatchToRow = (p: GroundPatch): Row => ({
  id: p.id,
  x: p.x,
  z: p.z,
  radius: p.radius,
  texture_path: p.texturePath,
  created_at: p.createdAt,
});

const rowToStudentPet = (r: Row): StudentPet => ({
  id: r.id,
  studentId: r.student_id,
  petDefId: r.pet_def_id,
  customName: r.custom_name ?? '',
  acquiredAt: r.acquired_at,
  following: r.following ?? false,
  trainingProgress: r.training_progress ?? 0,
  food: r.food ?? 100,
  social: r.social ?? 100,
  health: r.health ?? 100,
  tintColor: r.tint_color ?? undefined,
  tricksLearned: r.tricks_learned ?? [],
});
const studentPetToRow = (p: StudentPet): Row => ({
  id: p.id,
  student_id: p.studentId,
  pet_def_id: p.petDefId,
  custom_name: p.customName,
  acquired_at: p.acquiredAt,
  following: p.following,
  training_progress: p.trainingProgress,
  food: p.food,
  social: p.social,
  health: p.health,
  tint_color: p.tintColor ?? null,
  tricks_learned: p.tricksLearned ?? [],
});

const rowToHomeRoom = (r: Row): HomeRoomDef => ({
  id: r.id,
  studentId: r.student_id,
  kind: r.kind,
  name: r.name ?? '',
  wallColor: r.wall_color ?? undefined,
  floorTexture: r.floor_texture ?? undefined,
  createdAt: r.created_at,
});
const homeRoomToRow = (rm: HomeRoomDef): Row => ({
  id: rm.id,
  student_id: rm.studentId,
  kind: rm.kind,
  name: rm.name,
  wall_color: rm.wallColor ?? null,
  floor_texture: rm.floorTexture ?? null,
  created_at: rm.createdAt,
});

const rowToFocus = (r: Row): Focus => ({
  id: r.id,
  subject: r.subject,
  category: r.category ?? '',
  title: r.title,
  detail: r.detail ?? '',
  wordList: r.word_list ?? [],
  durationMode: r.duration_mode ?? 'untilChanged',
  startDate: r.start_date,
  endDate: r.end_date ?? null,
  createdAt: r.created_at,
});
const focusToRow = (f: Focus): Row => ({
  id: f.id,
  subject: f.subject,
  category: f.category,
  title: f.title,
  detail: f.detail,
  word_list: f.wordList,
  duration_mode: f.durationMode,
  start_date: f.startDate,
  end_date: f.endDate,
  created_at: f.createdAt,
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
  tags: r.tags ?? [],
});

const rowToCinemaVideo = (r: Row): CinemaVideo => ({
  id: r.id,
  title: r.title,
  source: r.source,
  url: r.url,
  coverImageUrl: r.cover_image_url ?? undefined,
  createdAt: r.created_at,
  tags: r.tags ?? [],
  durationSeconds: r.duration_seconds ?? undefined,
});

const rowToScratchGame = (r: Row): ScratchGame => ({
  id: r.id,
  title: r.title,
  projectId: r.project_id,
  createdAt: r.created_at,
  tags: r.tags ?? [],
});

const rowToMusicTrack = (r: Row): MusicTrack => ({
  id: r.id,
  title: r.title,
  url: r.url,
  createdAt: r.created_at,
  tags: r.tags ?? [],
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
  reward: r.reward ?? undefined,
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
  reward: a.reward ?? null,
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
  deletedAt: r.deleted_at ?? null,
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
  deleted_at: a.deletedAt ?? null,
});

const rowToLiteracyFocusSet = (r: Row): LiteracyFocusSet => ({
  id: r.id,
  studentId: r.student_id,
  startDate: r.start_date,
  endDate: r.end_date,
  phonicsPatterns: r.phonics_patterns ?? [],
  morphemes: r.morphemes ?? [],
  practiceWords: r.practice_words ?? [],
});

const literacyFocusSetToRow = (f: LiteracyFocusSet): Row => ({
  id: f.id,
  student_id: f.studentId,
  start_date: f.startDate,
  end_date: f.endDate,
  phonics_patterns: f.phonicsPatterns,
  morphemes: f.morphemes,
  practice_words: f.practiceWords,
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
  studentFeedback: StudentFeedback[];
  quizStruggles: QuizStruggle[];
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
  literacyFocusSets: LiteracyFocusSet[];
  transactions: Transaction[];
  articleAnnotations: Record<string, ArticleAnnotationSet>;
  sentenceBuilderResponses: Record<string, SentenceBuilderResponse>;
  chatMessages: ChatMessage[];
  notes: Note[];
  marketplaceItems: MarketplaceItem[];
  worldObjects: WorldObject[];
  wallSegments: WallSegment[];
  groundPatches: GroundPatch[];
  pets: StudentPet[];
  homeRooms: HomeRoomDef[];
  cinemaVideos: CinemaVideo[];
  scratchGames: ScratchGame[];
  musicTracks: MusicTrack[];
  focuses: Focus[];
  assignmentCompletionReward: AssignmentCompletionReward | null;
  emotePriceOverrides: Record<string, number>;
  npcTitleOverrides: Record<string, string>;
  npcVoiceOverrides: Record<string, string>;
  layoutOverrides: Record<string, LayoutOverride>;
  groundTexture: string | null;
  skyColor: string | null;
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
    literacyFocusSetsRes, worldObjectsRes, focusesRes, wallSegmentsRes, studentFeedbackRes, quizStrugglesRes, groundPatchesRes, studentPetsRes, homeRoomsRes, cinemaVideosRes, scratchGamesRes, musicTracksRes,
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
    supabase.from('literacy_focus_sets').select('*'),
    supabase.from('world_objects').select('*'),
    supabase.from('focuses').select('*'),
    supabase.from('wall_segments').select('*'),
    supabase.from('student_feedback').select('*'),
    supabase.from('quiz_struggles').select('*'),
    supabase.from('ground_patches').select('*'),
    supabase.from('student_pets').select('*'),
    supabase.from('home_rooms').select('*'),
    supabase.from('cinema_videos').select('*'),
    supabase.from('scratch_games').select('*'),
    supabase.from('music_tracks').select('*'),
  ]);

  for (const res of [studentsRes, rotationsRes, progressRes, breaksRes, pingsRes, reviewsRes, badgesRes, earnsRes, poolRes, setsRes, modesRes, metaRes, activitiesRes, templatesRes, scheduleRes, assignmentsRes, quizAttemptsRes, transactionsRes, annotationsRes, sbResponsesRes, chatMessagesRes, notesRes, marketplaceItemsRes, appSettingsRes, literacyFocusSetsRes, worldObjectsRes, focusesRes, wallSegmentsRes, studentFeedbackRes, quizStrugglesRes, groundPatchesRes, studentPetsRes, homeRoomsRes, cinemaVideosRes, scratchGamesRes, musicTracksRes]) {
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
    studentFeedback: (studentFeedbackRes.data ?? []).map(rowToStudentFeedback),
    quizStruggles: (quizStrugglesRes.data ?? []).map(rowToQuizStruggle),
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
    literacyFocusSets: (literacyFocusSetsRes.data ?? []).map(rowToLiteracyFocusSet),
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
    worldObjects: (worldObjectsRes.data ?? []).map(rowToWorldObject),
    wallSegments: (wallSegmentsRes.data ?? []).map(rowToWallSegment),
    groundPatches: (groundPatchesRes.data ?? []).map(rowToGroundPatch),
    pets: (studentPetsRes.data ?? []).map(rowToStudentPet),
    homeRooms: (homeRoomsRes.data ?? []).map(rowToHomeRoom),
    cinemaVideos: (cinemaVideosRes.data ?? []).map(rowToCinemaVideo),
    scratchGames: (scratchGamesRes.data ?? []).map(rowToScratchGame),
    musicTracks: (musicTracksRes.data ?? []).map(rowToMusicTrack),
    focuses: (focusesRes.data ?? []).map(rowToFocus),
    assignmentCompletionReward: appSettingsRes.data ? rowToAppSettings(appSettingsRes.data) : DEFAULT_ASSIGNMENT_COMPLETION_REWARD,
    emotePriceOverrides: appSettingsRes.data?.emote_price_overrides ?? {},
    npcTitleOverrides: appSettingsRes.data?.npc_title_overrides ?? {},
    npcVoiceOverrides: appSettingsRes.data?.npc_voice_overrides ?? {},
    layoutOverrides: appSettingsRes.data?.layout_overrides ?? {},
    groundTexture: appSettingsRes.data?.ground_texture ?? null,
    skyColor: appSettingsRes.data?.sky_color ?? null,
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

// A single flaky request (a dropped wifi packet, a tab backgrounded mid-
// request, a brief Supabase hiccup) used to mean that write was just gone
// — nothing retried it, and the only trace was a console.error nobody was
// looking at. That's how something like a daily-spin prize could vanish
// on the very write that was supposed to save it, with no visible error
// to the student or teacher. Retry a few times with backoff before
// finally giving up and logging, so a one-off network blip doesn't cost
// real data.
const RETRY_DELAYS_MS = [500, 1500, 4000, 8000];

// Set by the store once it's created (sync.ts can't import the store —
// the store imports this file) so a save that fails even after every
// retry can surface something the teacher/student actually sees, instead
// of only a console.error nobody's watching. A repeated, identical
// failure here (e.g. every save to one table) usually means a schema
// mismatch — a column the app expects that a migration hasn't been run
// for yet — not a network blip, so surfacing it matters even more than
// for a one-off.
let onPersistentSyncFailure: ((label: string, message: string) => void) | null = null;
export function setSyncFailureHandler(fn: (label: string, message: string) => void) {
  onPersistentSyncFailure = fn;
}

// Writes that ran out of retries land here instead of just vanishing, so a
// classroom wifi drop that outlasts the retry window doesn't permanently
// lose the change (a coin balance, a saved answer) the moment the alert is
// dismissed. They're replayed automatically the instant the browser reports
// it's back online, on a slow background sweep as a fallback for devices
// that don't fire that event reliably, and on demand via retryPendingSync
// (wired to the "Retry now" button on the sync-trouble alert).
type PendingWrite = { run: () => PromiseLike<{ error: { message: string } | null }>; label: string };
let pendingWrites: PendingWrite[] = [];

async function pushWithRetry(run: () => PromiseLike<{ error: { message: string } | null }>, label: string) {
  for (let attempt = 0; ; attempt++) {
    const res = await run();
    if (!res.error) return;
    if (attempt >= RETRY_DELAYS_MS.length) {
      console.error(`[sync] ${label} failed after ${attempt + 1} attempts:`, res.error.message);
      pendingWrites.push({ run, label });
      onPersistentSyncFailure?.(label, res.error.message);
      return;
    }
    console.warn(`[sync] ${label} failed (attempt ${attempt + 1}), retrying:`, res.error.message);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }
}

export function retryPendingSync() {
  if (pendingWrites.length === 0) return;
  const queued = pendingWrites;
  pendingWrites = [];
  for (const w of queued) void pushWithRetry(w.run, w.label);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', retryPendingSync);
  setInterval(() => {
    if (pendingWrites.length > 0) retryPendingSync();
  }, 20000);
}

const upsert = (table: string, row: Row) => {
  if (!isSupabaseConfigured) return;
  void pushWithRetry(() => supabase.from(table).upsert(row), `upsert ${table}`);
};

const remove = (table: string, match: Row) => {
  if (!isSupabaseConfigured) return;
  void pushWithRetry(() => supabase.from(table).delete().match(match), `delete ${table}`);
};

export const pushStudent = (s: Student) => upsert('students', studentToRow(s));
export const deleteStudentRemote = (id: string) => remove('students', { id });

// camelCase Student field -> snake_case students column, for pushStudentPatch below.
const STUDENT_COLUMNS: Record<keyof Student, string> = {
  id: 'id',
  name: 'name',
  avatar: 'avatar',
  streak: 'streak',
  lastCompletedDate: 'last_completed_date',
  streakHidden: 'streak_hidden',
  badgeIds: 'badge_ids',
  featureToggles: 'feature_toggles',
  breakMinutes: 'break_minutes',
  ttsSettings: 'tts_settings',
  createdAt: 'created_at',
  customTools: 'custom_tools',
  coins: 'coins',
  savingsGoalLabel: 'savings_goal_label',
  savingsGoalCents: 'savings_goal_cents',
  countItOutEnabled: 'count_it_out_enabled',
  ownedAvatarIds: 'owned_avatar_ids',
  ownedEmoteIds: 'owned_emote_ids',
  equippedEmoteId: 'equipped_emote_id',
  skipTokens: 'skip_tokens',
  lastSpinDate: 'last_spin_date',
  ownedFontIds: 'owned_font_ids',
  equippedFontId: 'equipped_font_id',
  ownedColorIds: 'owned_color_ids',
  equippedColorId: 'equipped_color_id',
  equippedHighlightColorId: 'equipped_highlight_color_id',
  equippedMarkerColorId: 'equipped_marker_color_id',
  ownedVoiceIds: 'owned_voice_ids',
  equippedVoiceId: 'equipped_voice_id',
  ownedPrizeIds: 'owned_prize_ids',
  quizTheme: 'quiz_theme',
  bonusSpinAvailable: 'bonus_spin_available',
  worldQuest1MetIds: 'world_quest1_met_ids',
  favoriteCinemaVideoIds: 'favorite_cinema_video_ids',
  favoriteScratchGameIds: 'favorite_scratch_game_ids',
  lastMysteryPackOpenedDate: 'last_mystery_pack_opened_date',
  worldMoveSensitivity: 'world_move_sensitivity',
  worldNpcLastTalkDates: 'world_npc_last_talk_dates',
  worldJokesHeardIds: 'world_jokes_heard_ids',
  worldTalkRewardCents: 'world_talk_reward_cents',
  worldDpadSide: 'world_dpad_side',
  worldShowArrivalCard: 'world_show_arrival_card',
  worldShowDeskGlow: 'world_show_desk_glow',
  islandBuildUnlocked: 'island_build_unlocked',
  lastSeenChangelogId: 'last_seen_changelog_id',
  worldReduceMotion: 'world_reduce_motion',
  dyslexiaFont: 'dyslexia_font',
  homeWallColor: 'home_wall_color',
  homeFloorTexture: 'home_floor_texture',
  houseExteriorPath: 'house_exterior_path',
  petCouponRedeemed: 'pet_coupon_redeemed',
  discoveredPetDefIds: 'discovered_pet_def_ids',
  shelterDonationsCents: 'shelter_donations_cents',
};

// Writes only the changed columns (a real SQL UPDATE), instead of
// pushStudent's full-row upsert of whatever the client last had in memory.
// Two updateStudent() calls for the same student (e.g. a daily-spin prize
// grant and an unrelated streak/bonus-spin update landing moments apart)
// used to each push their own full snapshot of every column; whichever
// network request reached Supabase last won outright and silently reverted
// every column the other one had just changed — that's how a spin prize (or
// the "already spun today" flag itself) could vanish after a refresh.
// Patching only the touched columns means two concurrent writes to
// different fields can never clobber each other, regardless of arrival order.
export const pushStudentPatch = (id: string, patch: Partial<Student>) => {
  if (!isSupabaseConfigured) return;
  const row: Row = {};
  for (const key of Object.keys(patch) as (keyof Student)[]) {
    const col = STUDENT_COLUMNS[key];
    if (col) row[col] = patch[key];
  }
  if (Object.keys(row).length === 0) return;
  void pushWithRetry(() => supabase.from('students').update(row).eq('id', id), 'update students');
};

export const pushRotation = (studentId: string, subject: Subject, tasks: Task[]) =>
  upsert('rotations', { student_id: studentId, subject, tasks });

export const pushProgress = (studentId: string, subject: Subject, p: SubjectProgress) =>
  upsert('subject_progress', progressToRow(studentId, subject, p));

export const pushBreakRequest = (b: BreakRequest) =>
  upsert('break_requests', { id: b.id, student_id: b.studentId, occurred_at: b.timestamp, status: b.status });
export const deleteBreakRequestRemote = (id: string) => remove('break_requests', { id });

export const pushHelpPing = (h: HelpPing) =>
  upsert('help_pings', { id: h.id, student_id: h.studentId, occurred_at: h.timestamp, resolved: h.resolved });

export const pushStudentFeedback = (f: StudentFeedback) => upsert('student_feedback', studentFeedbackToRow(f));

export const pushQuizStruggle = (q: QuizStruggle) => upsert('quiz_struggles', quizStruggleToRow(q));

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

export const pushWorldObject = (o: WorldObject) => upsert('world_objects', worldObjectToRow(o));
export const deleteWorldObjectRemote = (id: string) => remove('world_objects', { id });

export const pushWallSegment = (w: WallSegment) => upsert('wall_segments', wallSegmentToRow(w));
export const deleteWallSegmentRemote = (id: string) => remove('wall_segments', { id });
export const pushGroundPatch = (p: GroundPatch) => upsert('ground_patches', groundPatchToRow(p));
export const deleteGroundPatchRemote = (id: string) => remove('ground_patches', { id });
export const pushStudentPet = (p: StudentPet) => upsert('student_pets', studentPetToRow(p));
export const deleteStudentPetRemote = (id: string) => remove('student_pets', { id });
export const pushHomeRoom = (rm: HomeRoomDef) => upsert('home_rooms', homeRoomToRow(rm));
export const deleteHomeRoomRemote = (id: string) => remove('home_rooms', { id });

export const pushFocus = (f: Focus) => upsert('focuses', focusToRow(f));
export const deleteFocusRemote = (id: string) => remove('focuses', { id });
export const pushAnnotation = (a: ArticleAnnotationSet) => upsert('article_annotations', annotationToRow(a));
export const pushSbResponse = (a: SentenceBuilderResponse) => upsert('sentence_builder_responses', sbResponseToRow(a));
export const pushChatMessage = (m: ChatMessage) => upsert('chat_messages', chatMessageToRow(m));
export const pushNote = (n: Note) => upsert('notes', noteToRow(n));
export const deleteNoteRemote = (id: string) => remove('notes', { id });
export const pushMarketplaceItem = (it: MarketplaceItem) => upsert('marketplace_items', marketplaceItemToRow(it));
export const deleteMarketplaceItemRemote = (id: string) => remove('marketplace_items', { id });

export const pushAppSettings = (reward: AssignmentCompletionReward | null) =>
  upsert('app_settings', { id: 'global', assignment_completion_reward: reward, updated_at: new Date().toISOString() });

export const pushEmotePriceOverrides = (overrides: Record<string, number>) =>
  upsert('app_settings', { id: 'global', emote_price_overrides: overrides, updated_at: new Date().toISOString() });

export const pushNpcTitleOverrides = (overrides: Record<string, string>) =>
  upsert('app_settings', { id: 'global', npc_title_overrides: overrides, updated_at: new Date().toISOString() });

export const pushNpcVoiceOverrides = (overrides: Record<string, string>) =>
  upsert('app_settings', { id: 'global', npc_voice_overrides: overrides, updated_at: new Date().toISOString() });

export const pushLayoutOverrides = (overrides: Record<string, LayoutOverride>) =>
  upsert('app_settings', { id: 'global', layout_overrides: overrides, updated_at: new Date().toISOString() });

export const pushGroundTexture = (path: string | null) =>
  upsert('app_settings', { id: 'global', ground_texture: path, updated_at: new Date().toISOString() });

export const pushSkyColor = (color: string | null) =>
  upsert('app_settings', { id: 'global', sky_color: color, updated_at: new Date().toISOString() });

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
    tags: q.tags ?? [],
  });
export const deleteQuestionSetRemote = (id: string) => remove('question_sets', { id });

export const pushCinemaVideo = (v: CinemaVideo) =>
  upsert('cinema_videos', {
    id: v.id,
    title: v.title,
    source: v.source,
    url: v.url,
    cover_image_url: v.coverImageUrl ?? null,
    created_at: v.createdAt,
    tags: v.tags ?? [],
    duration_seconds: v.durationSeconds ?? null,
  });
export const deleteCinemaVideoRemote = (id: string) => remove('cinema_videos', { id });

export const pushScratchGame = (g: ScratchGame) =>
  upsert('scratch_games', {
    id: g.id,
    title: g.title,
    project_id: g.projectId,
    created_at: g.createdAt,
    tags: g.tags ?? [],
  });
export const deleteScratchGameRemote = (id: string) => remove('scratch_games', { id });

export const pushMusicTrack = (m: MusicTrack) =>
  upsert('music_tracks', {
    id: m.id,
    title: m.title,
    url: m.url,
    created_at: m.createdAt,
    tags: m.tags ?? [],
  });
export const deleteMusicTrackRemote = (id: string) => remove('music_tracks', { id });

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

export const pushLiteracyFocusSet = (f: LiteracyFocusSet) => upsert('literacy_focus_sets', literacyFocusSetToRow(f));
export const deleteLiteracyFocusSetRemote = (id: string) => remove('literacy_focus_sets', { id });

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

export { rowToStudent, rowToProgress, rowToBreakRequest, rowToHelpPing, rowToOffscreenReview, rowToQuizAttempt, rowToBadge, rowToBadgeEarn, rowToBreakPoolItem, rowToQuestionSet, rowToActivity, rowToTemplate, rowToWeeklyScheduleEntry, rowToAssignment, rowToTransaction, rowToAnnotation, annotationKey, rowToSbResponse, sbResponseKey, rowToChatMessage, rowToNote, rowToMarketplaceItem, rowToLiteracyFocusSet, rowToWorldObject, rowToWallSegment, rowToFocus, rowToStudentFeedback, rowToQuizStruggle, rowToGroundPatch, rowToStudentPet, rowToHomeRoom, rowToCinemaVideo, rowToScratchGame, rowToMusicTrack };

export interface RealtimeHandlers {
  onStudent: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onRotation: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onProgress: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onBreakRequest: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onHelpPing: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onStudentFeedback: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onQuizStruggle: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onGroundPatch: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onStudentPet: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onHomeRoom: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
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
  onLiteracyFocusSet: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onTransaction: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onAnnotation: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onSbResponse: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onChatMessage: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onNote: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onMarketplaceItem: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onAppSettings: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onWorldObject: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onWallSegment: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onFocus: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onCinemaVideo: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onScratchGame: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
  onMusicTrack: (e: ChangeEvent, n: Row | null, o: Row | null) => void;
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'student_feedback' }, wire(handlers.onStudentFeedback))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_struggles' }, wire(handlers.onQuizStruggle))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ground_patches' }, wire(handlers.onGroundPatch))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'student_pets' }, wire(handlers.onStudentPet))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'home_rooms' }, wire(handlers.onHomeRoom))
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'literacy_focus_sets' }, wire(handlers.onLiteracyFocusSet))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, wire(handlers.onTransaction))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'article_annotations' }, wire(handlers.onAnnotation))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sentence_builder_responses' }, wire(handlers.onSbResponse))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, wire(handlers.onChatMessage))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, wire(handlers.onNote))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_items' }, wire(handlers.onMarketplaceItem))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, wire(handlers.onAppSettings))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'world_objects' }, wire(handlers.onWorldObject))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wall_segments' }, wire(handlers.onWallSegment))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'focuses' }, wire(handlers.onFocus))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cinema_videos' }, wire(handlers.onCinemaVideo))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scratch_games' }, wire(handlers.onScratchGame))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'music_tracks' }, wire(handlers.onMusicTrack))
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
