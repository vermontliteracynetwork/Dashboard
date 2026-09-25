import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { makeId } from '../lib/id';
import { todayISO, streakContinues, currentDayOfWeek } from '../lib/dates';
import { DEFAULT_BADGES, DEFAULT_FEATURE_TOGGLES } from './badges';
import { STARTER_EMOTE_IDS, emoteById, emotePriceFor } from '../lib/emoteCatalog';
import { STARTER_FONT_IDS, STARTER_COLOR_IDS, STARTER_VOICE_IDS, STARTER_MARKETPLACE_ITEMS } from '../lib/marketplaceSeed';
import { avatarById, avatarPriceFor } from '../lib/avatarCatalog';
import { DEFAULT_TASK_REWARD_CENTS, DEFAULT_BADGE_REWARD_CENTS, PLAYGROUND_REWARD_CENTS, formatMoney } from '../lib/money';
import { getDailySpinSegments } from '../lib/dailySpin';
import { QUEST1_NEIGHBOR_COUNT, QUEST1_GRAND_PRIZE_CENTS } from '../lib/worldQuest1';
import type { SpinItemKind } from '../lib/dailySpin';
import { petDefById, rarityFor, canPetFollow, PET_OWNERSHIP_CAP, PET_STAT_FLOOR, PET_DECAY_AMOUNT, rollMysteryPet, MYSTERY_PACK_PRICE_CENTS, PET_MILESTONES } from '../lib/petCatalog';
import type { PetDef } from '../lib/petCatalog';
// townLayout.ts is pure data/helpers, no React/Three.js imports (see its own
// header comment), so importing it here doesn't drag TownSquare.tsx's heavy
// R3F bundle into the store.
import { DEFAULT_GROUND_BOUNDS, clampGroundBoundsValue, sanitizeGroundBounds } from '../routes/world/townLayout';

// React StrictMode (and any other accidental re-invocation of initSync)
// double-fires the mount effect that calls it. Without this guard, a second
// subscribeRealtime() call reuses the same 'iwd-sync' channel name after the
// first is already subscribed, which throws — and that throw was silently
// leaving the app's realtime stream half-broken (this is the root cause of
// live views not reliably updating without a manual refresh).
let realtimeSubscribed = false;

// Direct teacher instruction: "clear all achievements, dont give anymore
// and dont add any without me saying it. that will be updated later."
// Every rule-based auto-award AND the teacher's own manual "award badge"
// button both become no-ops while this is true — the whole system is
// paused, not just automatic grants, since she said the achievement set
// itself is being redesigned. Flip back to false (or remove) only on the
// teacher's own explicit later instruction to resume, never on a guess
// that "it's probably fine now." Also a standing reminder for this file:
// do not add new entries to DEFAULT_BADGES (./badges.ts) without her
// asking for them specifically, even while this flag is on.
export const BADGES_PAUSED = true;

export interface DailySpinResult {
  type: 'cents' | 'skip' | 'cashback' | 'item';
  amountCents: number; // for 'cashback' this is the computed payout, not the percent; 0 for 'item' unless it fell back to a cash consolation
  label: string;
  segmentIndex: number; // which of today's 10 segments won, so the wheel UI can land on the same one
  itemKind?: SpinItemKind; // set when type is 'item' and the student actually won it (not the consolation fallback)
  itemId?: string;
}

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
  setSyncFailureHandler,
  retryPendingSync,
  applyArrayRow,
  applyNestedRow,
  applyStudentMetaRow,
  rowToStudent,
  rowToProgress,
  rowToBreakRequest,
  rowToHelpPing,
  rowToStudentFeedback,
  rowToQuizStruggle,
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
  pushStudentPatch,
  deleteStudentRemote,
  pushRotation,
  pushProgress,
  pushBreakRequest,
  deleteBreakRequestRemote,
  pushHelpPing,
  pushStudentFeedback,
  pushQuizStruggle,
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
  rowToLiteracyFocusSet,
  pushLiteracyFocusSet,
  deleteLiteracyFocusSetRemote,
  pushTransaction,
  pushChatMessage,
  rowToChatMessage,
  deleteBadgeEarnRemote,
  pushNote,
  deleteNoteRemote,
  rowToNote,
  pushSavedWhiteboard,
  deleteSavedWhiteboardRemote,
  rowToSavedWhiteboard,
  pushMarketplaceItem,
  deleteMarketplaceItemRemote,
  rowToMarketplaceItem,
  pushAppSettings,
  pushEmotePriceOverrides,
  pushNpcTitleOverrides,
  pushNpcVoiceOverrides,
  pushLayoutOverrides,
  pushGroundTexture,
  pushSkyColor,
  pushSkyTexture,
  pushGroundBounds,
  pushAvatarPriceOverrides,
  pushWorldObject,
  deleteWorldObjectRemote,
  rowToWorldObject,
  pushWallSegment,
  deleteWallSegmentRemote,
  rowToWallSegment,
  pushGroundPatch,
  deleteGroundPatchRemote,
  rowToGroundPatch,
  pushStudentPet,
  deleteStudentPetRemote,
  rowToStudentPet,
  pushHomeRoom,
  deleteHomeRoomRemote,
  rowToHomeRoom,
  pushFocus,
  deleteFocusRemote,
  rowToFocus,
  pushCinemaVideo,
  deleteCinemaVideoRemote,
  rowToCinemaVideo,
  pushScratchGame,
  deleteScratchGameRemote,
  rowToScratchGame,
  pushMusicTrack,
  deleteMusicTrackRemote,
  rowToMusicTrack,
  pushGalleryItem,
  deleteGalleryItemRemote,
  rowToGalleryItem,
  pushSillyQuiz,
  deleteSillyQuizRemote,
  rowToSillyQuiz,
  pushFarmerMarketOffer,
  deleteFarmerMarketOfferRemote,
  acceptFarmerMarketOfferRemote,
  rowToFarmerMarketOffer,
  DEFAULT_ASSIGNMENT_COMPLETION_REWARD,
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
  StudentFeedback,
  QuizStruggle,
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
  CinemaVideo,
  ScratchGame,
  MusicTrack,
  GalleryItem,
  SillyQuiz,
  FarmerMarketOffer,
  ActivityLibraryItem,
  PlanTemplate,
  WeeklyScheduleEntry,
  DayOfWeek,
  Assignment,
  LiteracyFocusSet,
  Transaction,
  TransactionKind,
  ArticleAnnotationSet,
  Highlight,
  SentenceBuilderResponse,
  ChatMessage,
  Note,
  SavedWhiteboard,
  MarketplaceItem,
  AssignmentCompletionReward,
  WorldObject,
  WallSegment,
  GroundPatch,
  GroundBounds,
  StudentPet,
  HomeRoomDef,
  HomeRoomKind,
  LayoutOverride,
  Focus,
  FocusSubject,
  FocusDurationMode,
} from '../types';

// Draft/publish for shared Town Square objects: the first time a currently-
// published WorldObject/WallSegment is touched in a new draft cycle, this
// captures its pre-edit values so a student keeps seeing them (and Discard
// can restore them) until the teacher actually hits Publish.
function snapshotForDraft<T extends { status?: 'draft' | 'published'; pendingDelete?: boolean; publishedSnapshot?: T }>(existing: T): T | undefined {
  if (existing.status === 'draft' && existing.publishedSnapshot) return existing.publishedSnapshot; // already have the real baseline
  if (existing.status === 'draft' && !existing.publishedSnapshot) return undefined; // never published — nothing to protect
  const clone: T = { ...existing };
  delete (clone as { status?: unknown }).status;
  delete (clone as { pendingDelete?: unknown }).pendingDelete;
  delete (clone as { publishedSnapshot?: unknown }).publishedSnapshot;
  return clone;
}

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
  studentFeedback: StudentFeedback[];
  submitFeedback: (studentId: string, category: StudentFeedback['category'], subcategoryLabel: string | undefined, customLabel: string | undefined, text: string) => void;
  resolveFeedback: (id: string) => void;
  quizStruggles: QuizStruggle[];
  flagQuizStruggle: (studentId: string, subject: Subject, task: Task, questionPrompt: string) => void;
  resolveQuizStruggle: (id: string) => void;
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
  literacyFocusSets: LiteracyFocusSet[]; // a student's phonics/morpheme/spelling focus for a date window, typically a week
  transactions: Transaction[]; // every student's bank register, newest first
  lastCoinEarn: { id: string; studentId: string; amountCents: number } | null; // bumped by recordTransaction whenever coins land (spin win, task reward, streak bonus, etc.) — purely a UI trigger for the coin-drop animation/sound, not persisted
  lastCharacterUnlock: { id: string; studentId: string; characterId: string } | null; // bumped by recordBakeryQuestionAnswered when a character-catalog unlock is earned — same transient-UI-trigger shape as lastCoinEarn, not persisted
  articleAnnotations: Record<string, ArticleAnnotationSet>; // key: `${studentId}:${taskId}:${articleIndex}`
  sentenceBuilderResponses: Record<string, SentenceBuilderResponse>; // key: `${studentId}:${taskId}`
  chatMessages: ChatMessage[]; // teacher<->student chat, newest last
  notes: Note[];
  savedWhiteboards: SavedWhiteboard[]; // Literacy Manipulatives saved-board log, newest first
  marketplaceItems: MarketplaceItem[];
  worldObjects: WorldObject[]; // teacher-placed World Editor objects in the shared Town Square — global, not per-student
  wallSegments: WallSegment[]; // Sims 4-style drawn walls — shared Town Square (studentId undefined) or a student's own Home Room (studentId set), same table/convention as worldObjects
  groundPatches: GroundPatch[]; // painted patches of alternate ground texture (grass/water mixed regions) — shared Town Square only, live-instant like groundTexture/skyColor
  pets: StudentPet[]; // every student's owned pets — see StudentPet in types.ts
  homeRooms: HomeRoomDef[]; // every student's own Home Room floor plan (discrete rooms + one yard) — see HomeRoomDef in types.ts
  cinemaVideos: CinemaVideo[]; // videos shown in the in-world Cinema — teacher-authored, unlimited replay, no mastery tracking
  scratchGames: ScratchGame[]; // games shown in the in-world Arcade — teacher-authored MIT Scratch project links, unlimited replay, no mastery tracking
  musicTracks: MusicTrack[]; // shared music library — car radio, Concert Hall building, and Boom Box all draw from this same list, audio only
  // Direct teacher instruction: "the music player can always be played in
  // the background, even when students are completing assignments." Lives
  // here (not local component state) specifically so it survives
  // navigating between routes — TownSquare unmounting to go do a task no
  // longer kills the song. Not persisted to localStorage (only
  // currentStudentId/role are, via this store's partialize) — a hard page
  // reload starts silent again, on purpose, same as any other session-only
  // UI state in this app.
  playingTrackId: string | null;
  galleryItems: GalleryItem[]; // Playground Gallery images — teacher-curated, unlimited browse, no mastery tracking
  sillyQuizzes: SillyQuiz[]; // Playground silly personality quizzes — teacher-authored, results private/client-side only, see SillyQuiz in types.ts
  farmerMarketOffers: FarmerMarketOffer[]; // student-to-student barter offers — async/turn-based, see FarmerMarketOffer in types.ts
  layoutOverrides: Record<string, LayoutOverride>; // fixed-layout-item id (a building/stall/road tile/prop from townLayout.ts) -> teacher's Build Mode edit; everything in town is editable, not just objects placed after the tool existed
  groundTexture: string | null; // Build Mode's paint bucket — a path under /world/textures/, replacing the default grass; null = default
  skyColor: string | null; // Build Mode's paint bucket for the sky — sets the flat sky color directly (see SkyboxBackground in TownSquare.tsx); null = the default '#bfe3ff'
  skyTexture: string | null; // Build Mode's Fill Sky texture picker — a seamless-tileable sky pattern id from SKY_TEXTURE_OPTIONS (see SkyDome.tsx), rendered as a tiled dome over the flat color; null = no texture, flat skyColor only
  groundBounds: GroundBounds; // the walkable square's 4 walls, each independently push-able outward from Build Mode's Lot panel — see GroundBounds in types.ts. Defaults to DEFAULT_GROUND_BOUNDS (townLayout.ts) until a teacher actually expands one.
  avatarPriceOverrides: Record<string, number>; // same override pattern as emotePriceOverrides — Characters had no teacher-editable price anywhere until now
  focuses: Focus[]; // class-wide curriculum spotlights (math/literacy/sel/finance lanes) — global, not per-student
  assignmentCompletionReward: AssignmentCompletionReward | null;

  hydrated: boolean; // initial fetch from Supabase has completed (or failed)
  hydrationError: string | null;
  initSync: () => Promise<void>;

  // A save that failed even after every retry (see pushWithRetry in
  // sync.ts) — surfaced so it's visible somewhere a person actually looks,
  // not just a console.error. A repeated failure on the same table
  // usually means a pending database migration hasn't been run yet.
  syncTrouble: { at: number; label: string; message: string } | null;
  dismissSyncTrouble: () => void;
  retrySyncNow: () => void;

  currentStudentId: string | null;
  role: 'none' | 'teacher' | 'student';

  // session
  setRole: (r: 'none' | 'teacher' | 'student') => void;
  loginStudent: (id: string) => void;
  logoutStudent: () => void;

  // students
  addStudent: (name: string, avatar: string) => string;
  updateStudent: (id: string, patch: Partial<Student>) => void;
  recordTransaction: (studentId: string, amountCents: number, description: string, icon: string, kind: TransactionKind, silent?: boolean, needsWants?: 'need' | 'want') => void;
  // Manually fires the same coin-drop celebration recordTransaction triggers automatically —
  // for the rare case (the Daily Spin Wheel) where the money already landed silently ahead of
  // a multi-second reveal animation, and the celebration needs to wait for that reveal instead
  // of firing the instant the spin button is clicked.
  announceCoinEarn: (studentId: string, amountCents: number) => void;
  deleteTransaction: (id: string) => void;
  addHighlight: (studentId: string, taskId: string, articleIndex: number, highlight: Highlight) => void;
  removeHighlight: (studentId: string, taskId: string, articleIndex: number, highlightId: string) => void;
  setHighlightNote: (studentId: string, taskId: string, articleIndex: number, highlightId: string, note: string) => void;
  setSentenceBuilderAnswer: (studentId: string, taskId: string, partId: string, text: string) => void;
  sendChatMessage: (studentId: string, sender: 'student' | 'teacher', text: string) => void;
  createNote: (studentId: string, kind?: 'note' | 'journal') => string;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'bodyHtml' | 'fontId' | 'colorId' | 'highlightColorId'>>) => void;
  deleteNote: (id: string) => void;
  saveWhiteboard: (studentId: string, name: string, placedJson: string, drawingDataUrl: string | null) => void;
  deleteWhiteboard: (id: string) => void;
  addMarketplaceItem: (item: Omit<MarketplaceItem, 'id' | 'createdAt'>) => void;
  updateMarketplaceItem: (id: string, patch: Partial<MarketplaceItem>) => void;
  deleteMarketplaceItem: (id: string) => void;
  buyMarketplaceItem: (studentId: string, itemId: string, needsWants?: 'need' | 'want') => boolean;
  addWorldObject: (obj: Omit<WorldObject, 'id' | 'createdAt'>) => string;
  updateWorldObject: (id: string, patch: Partial<WorldObject>) => void;
  deleteWorldObject: (id: string) => void;
  parkVehicle: (id: string, position: [number, number, number], rotationY: number) => void;
  addWallSegment: (w: Omit<WallSegment, 'id' | 'createdAt'>) => string;
  updateWallSegment: (id: string, patch: Partial<WallSegment>) => void;
  deleteWallSegment: (id: string) => void;
  addGroundPatch: (p: Omit<GroundPatch, 'id' | 'createdAt'>) => string;
  deleteGroundPatch: (id: string) => void;
  // Pets system — see StudentPet in types.ts and PET_CATALOG in
  // lib/petCatalog.ts. `charge` true (adoptPet's default) deducts coins;
  // false is a free grant, used by the one-time coupon (Marketplace also
  // flips petCouponRedeemed itself right after) and by daily-spin/quest
  // wins. Every action here fails harmlessly (false/no-op) rather than
  // throwing, since they're all called straight from click handlers.
  adoptPet: (studentId: string, petDefId: string, charge?: boolean) => boolean;
  carePet: (petId: string, action: 'feed' | 'pet' | 'play') => void;
  // Bakery Match's question-answered tracker — every submitted answer
  // counts, right or wrong. Crossing 100 unlocks 'cake' in
  // unlockedCharacterIds and bumps lastCharacterUnlock once.
  recordBakeryQuestionAnswered: (studentId: string) => void;
  // Bakery Match's private per-game XP leaderboard — appends one entry
  // (this game's total XP + today's date) once a full 3-round game ends.
  // Never read/compared across students anywhere (standing no-leaderboard
  // rule) — only ever shown back to the same student on their own main menu.
  recordBakeryGameResult: (studentId: string, xp: number) => void;
  equipCharacter: (studentId: string, characterId: string | null) => void;
  renamePet: (petId: string, name: string) => void;
  // Pet paint-brush customization (Part B backlog item) — reuses the exact
  // color-tint mechanism WorldObject/Build Mode already uses, applied to a
  // pet's own model wherever it renders. null clears back to the model's
  // original color.
  tintPet: (petId: string, tintColor: string | null) => void;
  // Teach a Trick (Part C backlog item) — SEL/bonding, not an academic
  // task: first attempt always succeeds, no retry-until-correct. No-op if
  // the pet doesn't exist or already learned that trick.
  teachTrick: (petId: string, trickId: string) => void;
  // petId: null unsets whichever pet was following (goes back to no companion).
  setFollowingPet: (studentId: string, petId: string | null) => void;
  sellPet: (petId: string) => void;
  // Soft need-decay — only ever called while a student is actively in Town
  // Square (see TownSquare.tsx's own interval), never on a timer that runs
  // while they're away. "Pets never die," so stats floor at PET_STAT_FLOOR.
  tickPetDecay: (studentId: string) => void;
  // Mystery Adoption Box — always returns the pet def it granted (never
  // null except on a genuine refusal: unaffordable or pet home full).
  openMysteryPack: (studentId: string) => PetDef | null;
  // Pet Shelter's free donate action — false if the student can't afford
  // the (voluntary) amount; never grants anything back.
  donateToShelter: (studentId: string, amountCents: number) => boolean;
  // Home Room's room system — see HomeRoomDef in types.ts. addHomeRoom
  // defaults kind 'yard' to the fixed name "Yard" and every other kind to a
  // sensible generic label; students can rename freely afterward.
  addHomeRoom: (studentId: string, kind: HomeRoomKind, name?: string) => string;
  updateHomeRoom: (id: string, patch: Partial<Pick<HomeRoomDef, 'name' | 'wallColor' | 'floorTexture'>>) => void;
  // Deleting a room never cascades to the furniture inside it — those
  // WorldObject rows just become inaccessible (their roomId points nowhere
  // rendered) rather than being destructively deleted alongside it.
  deleteHomeRoom: (id: string) => void;
  // Build Mode Publish flow: commits every shared-Town-Square draft
  // (worldObjects + wallSegments) so students see it, finalizing any
  // pending deletion; Discard reverts every shared draft back to its last
  // published snapshot (or deletes it, if it was never published).
  publishWorldDraft: () => void;
  discardWorldDraft: () => void;
  // A teacher edit to one of the ORIGINAL fixed layout items (see
  // LayoutOverride's own comment in types.ts). `patch: null` clears that
  // item's override entirely (used by undo to fully revert a change).
  setLayoutOverride: (layoutId: string, patch: Partial<LayoutOverride> | null) => void;
  setGroundTexture: (path: string | null) => void;
  setSkyColor: (color: string | null) => void;
  setSkyTexture: (path: string | null) => void;
  // Direct teacher request: "use arrows to expand each lot." One call pushes
  // a single wall (north/south/east/west) outward by GROUND_BOUNDS_STEP
  // meters — or inward if `deltaMeters` is negative, floored at
  // GROUND_BOUNDS_MIN so a wall can never shrink past the fixed spawn point.
  // See WorldEditor.tsx's Lot panel for the arrow buttons that call this.
  expandGroundBounds: (edge: keyof GroundBounds, deltaMeters: number) => void;
  // Bulk-restores Build Mode's editable state to an exact prior snapshot —
  // undo/redo's only store action. Diffs against the current worldObjects
  // to push just what actually changed/got removed, rather than a
  // delete-everything-then-recreate pass (which would also mint fresh ids
  // for every restored object via addWorldObject's own id generation).
  restoreWorldEditorState: (worldObjects: WorldObject[], layoutOverrides: Record<string, LayoutOverride>) => void;
  // Publishing a new focus for a subject lane ends whichever focus was
  // previously current for that lane (sets its endDate if it didn't have
  // one), matching the "one current focus per lane" model in types.ts.
  publishFocus: (
    subject: FocusSubject,
    category: string,
    title: string,
    detail: string,
    wordList: string[],
    durationMode: FocusDurationMode,
    dayCount?: number,
    dateRangeStart?: string,
    dateRangeEnd?: string,
  ) => void;
  endFocus: (id: string) => void; // teacher-ended 'untilChanged' focus — sets endDate to today
  deleteFocus: (id: string) => void; // removes it from history entirely
  setAssignmentCompletionReward: (reward: AssignmentCompletionReward | null) => void;
  emotePriceOverrides: Record<string, number>;
  setEmotePriceOverride: (emoteId: string, priceCents: number | null) => void;
  setAvatarPriceOverride: (avatarId: string, priceCents: number | null) => void;
  npcTitleOverrides: Record<string, string>; // hand-authored Neighbor/Townsperson id -> teacher's cosmetic custom title (Roster tab); never overwrites their actual dialogue content
  setNpcTitleOverride: (npcId: string, title: string | null) => void;
  npcVoiceOverrides: Record<string, string>; // Neighbor/Townsperson id -> lib/npcVoices.ts preset id, teacher override on top of each character's own hand-picked default (Roster tab)
  setNpcVoiceOverride: (npcId: string, presetId: string | null) => void;
  adjustStudentBalance: (studentId: string, amountCents: number, reason: string) => void;
  setStudentBalance: (studentId: string, newBalanceCents: number, reason: string) => void;
  buyAvatar: (studentId: string, avatarId: string, needsWants?: 'need' | 'want') => boolean;
  buyEmote: (studentId: string, emoteId: string, needsWants?: 'need' | 'want') => boolean;
  equipEmote: (studentId: string, emoteId: string | null) => void;
  skipTask: (studentId: string, subject: Subject, taskId: string) => boolean;
  spinDailyWheel: (studentId: string) => DailySpinResult | null;
  resetDailySpin: (studentId: string) => void;
  // Homeplot launch quest ("Meet the Neighbors") — records one Neighbor as
  // met (idempotent, a second call for the same id is a no-op), pays that
  // Neighbor's small item reward, and once all 4 are met also pays the
  // $200 grand-finish reward, through the same real Class Cash ledger
  // every other reward in the app already uses.
  meetQuest1Neighbor: (studentId: string, neighborId: string, itemRewardCents: number, itemLabel: string) => void;
  recordNpcDailyTalk: (studentId: string, npcId: string, npcName: string) => void;
  collectJoke: (studentId: string, jokeId: string) => void;
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
  // Direct teacher request: a question set finished in the Playground
  // (Free Play, or any Activity Library entry flagged for the Playground)
  // should pay into the bank register the same way a real assignment
  // does — it just doesn't touch rotation/checklist progress the way
  // completeTask does, since Playground content was deliberately built as
  // ungraded/no-checkbox.
  completePlaygroundActivity: (studentId: string, task: Task) => void;
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
  duplicateQuestionSet: (id: string) => string | null;
  updateQuestionSet: (id: string, patch: Partial<QuestionSet>) => void;
  deleteQuestionSet: (id: string) => void;

  // Cinema videos — teacher-authored external links or uploaded files
  addCinemaVideo: (video: Omit<CinemaVideo, 'id' | 'createdAt'>) => string;
  updateCinemaVideo: (id: string, patch: Partial<CinemaVideo>) => void;
  deleteCinemaVideo: (id: string) => void;
  addScratchGame: (game: Omit<ScratchGame, 'id' | 'createdAt'>) => string;
  updateScratchGame: (id: string, patch: Partial<ScratchGame>) => void;
  deleteScratchGame: (id: string) => void;
  addMusicTrack: (track: Omit<MusicTrack, 'id' | 'createdAt'>) => string;
  updateMusicTrack: (id: string, patch: Partial<MusicTrack>) => void;
  deleteMusicTrack: (id: string) => void;
  setPlayingTrackId: (id: string | null) => void;
  addGalleryItem: (item: Omit<GalleryItem, 'id' | 'createdAt'>) => string;
  updateGalleryItem: (id: string, patch: Partial<GalleryItem>) => void;
  deleteGalleryItem: (id: string) => void;
  addSillyQuiz: (quiz: Omit<SillyQuiz, 'id' | 'createdAt'>) => string;
  updateSillyQuiz: (id: string, patch: Partial<SillyQuiz>) => void;
  deleteSillyQuiz: (id: string) => void;

  // Farmer's Market — async student-to-student barter, see FarmerMarketOffer in types.ts
  postFarmerMarketOffer: (studentId: string, offeredItemId: string, wantsItemId: string) => string;
  postPetTradeOffer: (studentId: string, offeredPetId: string) => string;
  withdrawFarmerMarketOffer: (id: string) => void;
  acceptFarmerMarketOffer: (id: string, acceptingStudentId: string, acceptingPetId?: string) => Promise<{ ok: boolean; reason?: string }>;

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
  // Moves an assignment to the Deleted tab instead of erasing it — the
  // default "delete" everywhere in the Assignments UI. The permanent
  // deleteAssignment above is only reachable from inside that tab now
  // ("delete forever").
  softDeleteAssignment: (id: string) => void;
  restoreAssignment: (id: string) => void;
  updateAssignment: (id: string, patch: Partial<Assignment>) => void;
  addStudentToAssignment: (
    studentId: string,
    subject: Subject,
    templateId: string,
    startDate: string,
    endDate: string,
    mode: 'repeat' | 'span',
  ) => void;

  // A student's phonics/morpheme/spelling focus for a date window (see
  // LiteracyFocusSet). Publishing while an existing set for that student
  // overlaps the new window updates it in place instead of creating a
  // duplicate — a teacher republishing this week's focus shouldn't pile up
  // near-identical rows.
  publishLiteracyFocusSet: (
    studentId: string,
    startDate: string,
    endDate: string,
    phonicsPatterns: string[],
    morphemes: string[],
    practiceWords: string[],
  ) => void;
  deleteLiteracyFocusSet: (id: string) => void;
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

// Grants a marketplace item to a student for free (a task-completion prize
// or the assignment-completion bonus) — a power-up adds a Skip Pass token,
// anything else is added to the matching owned-ids list. Returns the
// granted item, or null if it's gone (deleted from the marketplace since
// being picked as a reward).
function grantFreeMarketplaceItem(get: () => AppState, studentId: string, itemId: string): MarketplaceItem | null {
  const item = get().marketplaceItems.find((it) => it.id === itemId);
  const s = get().students.find((st) => st.id === studentId);
  if (!item || !s) return null;
  if (item.kind === 'powerup') {
    get().updateStudent(studentId, { skipTokens: s.skipTokens + 1 });
  } else {
    const ownedField = ({ font: 'ownedFontIds', color: 'ownedColorIds', voice: 'ownedVoiceIds', prize: 'ownedPrizeIds', furniture: 'ownedHomeItemIds' } as const)[item.kind];
    if (!(s[ownedField] as string[]).includes(item.id)) {
      get().updateStudent(studentId, { [ownedField]: [...(s[ownedField] as string[]), item.id] } as Partial<Student>);
    }
  }
  return item;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      students: [],
      rotations: {},
      progress: {},
      breakRequests: [],
      helpPings: [],
      studentFeedback: [],
      quizStruggles: [],
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
      literacyFocusSets: [],
      transactions: [],
      lastCoinEarn: null,
      lastCharacterUnlock: null,
      articleAnnotations: {},
      sentenceBuilderResponses: {},
      chatMessages: [],
      notes: [],
      savedWhiteboards: [],
      marketplaceItems: [],
      worldObjects: [],
      wallSegments: [],
      groundPatches: [],
      pets: [],
      homeRooms: [],
      cinemaVideos: [],
      scratchGames: [],
      musicTracks: [],
      playingTrackId: null,
      galleryItems: [],
      sillyQuizzes: [],
      farmerMarketOffers: [],
      layoutOverrides: {},
      groundTexture: null,
      skyColor: null,
      skyTexture: null,
      groundBounds: DEFAULT_GROUND_BOUNDS,
      focuses: [],
      assignmentCompletionReward: DEFAULT_ASSIGNMENT_COMPLETION_REWARD,
      emotePriceOverrides: {},
      avatarPriceOverrides: {},
      npcTitleOverrides: {},
      npcVoiceOverrides: {},

      hydrated: !isSupabaseConfigured,
      hydrationError: null,
      syncTrouble: null,
      dismissSyncTrouble: () => set({ syncTrouble: null }),
      retrySyncNow: () => {
        retryPendingSync();
        set({ syncTrouble: null });
      },
      initSync: async () => {
        if (!isSupabaseConfigured) {
          set({ hydrated: true });
          return;
        }
        try {
          const data = await fetchAll();
          set({ ...data, hydrated: true, hydrationError: null });
          // One-time bootstrap: the very first time this app's data is
          // ever empty of marketplace items, seed the starter fonts/
          // colors/voices/power-ups so students aren't left with nothing
          // to buy and existing ownedFontIds/etc. references still
          // resolve. Never runs again once any item exists — from then on
          // the marketplace is entirely teacher-authored.
          if (data.marketplaceItems.length === 0) {
            const now = new Date().toISOString();
            const seeded: MarketplaceItem[] = STARTER_MARKETPLACE_ITEMS.map((it) => ({ ...it, createdAt: now }));
            set({ marketplaceItems: seeded });
            seeded.forEach((it) => pushMarketplaceItem(it));
          } else if (!data.marketplaceItems.some((it) => it.colorUse === 'marker')) {
            // A smaller, one-time top-up for data seeded before Whiteboard
            // marker colors and Notes highlight colors existed — adds just
            // those new starter items without touching anything the
            // teacher may have already edited.
            const now = new Date().toISOString();
            const topUp: MarketplaceItem[] = STARTER_MARKETPLACE_ITEMS
              .filter((it) => it.colorUse === 'marker' || it.colorUse === 'highlight')
              .map((it) => ({ ...it, createdAt: now }));
            set((s) => ({ marketplaceItems: [...s.marketplaceItems, ...topUp] }));
            topUp.forEach((it) => pushMarketplaceItem(it));
          }

          // One-time price normalization to the teacher's stated pricing
          // standard (fonts/colors $2, voices $4, power-ups $15, +25% for
          // specialty/seasonal/fun items). Only touches an item still at
          // its OLD auto-seeded price — if a price differs from that, the
          // teacher already edited it by hand, so it's left alone.
          const OLD_SEED_PRICES: Record<string, number> = {
            'font-baloo': 400, 'font-mono': 400, 'font-serif': 600,
            'color-gold': 400, 'color-rainbow': 800,
            'voice-santa': 400,
          };
          const priceFixes = get().marketplaceItems.filter(
            (it) => OLD_SEED_PRICES[it.id] !== undefined && it.price === OLD_SEED_PRICES[it.id],
          );
          if (priceFixes.length > 0) {
            const newPriceById = new Map(STARTER_MARKETPLACE_ITEMS.map((it) => [it.id, it.price]));
            priceFixes.forEach((it) => {
              const newPrice = newPriceById.get(it.id);
              if (newPrice !== undefined) get().updateMarketplaceItem(it.id, { price: newPrice });
            });
          }
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
          onStudentFeedback: (e, n, o) => set((s) => ({ studentFeedback: applyArrayRow(s.studentFeedback, e, rowToStudentFeedback, n, o) })),
          onQuizStruggle: (e, n, o) => set((s) => ({ quizStruggles: applyArrayRow(s.quizStruggles, e, rowToQuizStruggle, n, o) })),
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
          onLiteracyFocusSet: (e, n, o) => set((s) => ({ literacyFocusSets: applyArrayRow(s.literacyFocusSets, e, rowToLiteracyFocusSet, n, o) })),
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
          onSavedWhiteboard: (e, n, o) => set((s) => ({ savedWhiteboards: applyArrayRow(s.savedWhiteboards, e, rowToSavedWhiteboard, n, o) })),
          onMarketplaceItem: (e, n, o) => set((s) => ({ marketplaceItems: applyArrayRow(s.marketplaceItems, e, rowToMarketplaceItem, n, o) })),
          onWorldObject: (e, n, o) => set((s) => ({ worldObjects: applyArrayRow(s.worldObjects, e, rowToWorldObject, n, o) })),
          onWallSegment: (e, n, o) => set((s) => ({ wallSegments: applyArrayRow(s.wallSegments, e, rowToWallSegment, n, o) })),
          onGroundPatch: (e, n, o) => set((s) => ({ groundPatches: applyArrayRow(s.groundPatches, e, rowToGroundPatch, n, o) })),
          onStudentPet: (e, n, o) => set((s) => ({ pets: applyArrayRow(s.pets, e, rowToStudentPet, n, o) })),
          onHomeRoom: (e, n, o) => set((s) => ({ homeRooms: applyArrayRow(s.homeRooms, e, rowToHomeRoom, n, o) })),
          onCinemaVideo: (e, n, o) => set((s) => ({ cinemaVideos: applyArrayRow(s.cinemaVideos, e, rowToCinemaVideo, n, o) })),
          onScratchGame: (e, n, o) => set((s) => ({ scratchGames: applyArrayRow(s.scratchGames, e, rowToScratchGame, n, o) })),
          onMusicTrack: (e, n, o) => set((s) => ({ musicTracks: applyArrayRow(s.musicTracks, e, rowToMusicTrack, n, o) })),
          onGalleryItem: (e, n, o) => set((s) => ({ galleryItems: applyArrayRow(s.galleryItems, e, rowToGalleryItem, n, o) })),
          onSillyQuiz: (e, n, o) => set((s) => ({ sillyQuizzes: applyArrayRow(s.sillyQuizzes, e, rowToSillyQuiz, n, o) })),
          onFarmerMarketOffer: (e, n, o) => set((s) => ({ farmerMarketOffers: applyArrayRow(s.farmerMarketOffers, e, rowToFarmerMarketOffer, n, o) })),
          onFocus: (e, n, o) => set((s) => ({ focuses: applyArrayRow(s.focuses, e, rowToFocus, n, o) })),
          onAppSettings: (e, n) => {
            if (e === 'DELETE') return;
            if (!n) return;
            set({
              // Direct teacher request: every assignment defaults to a
              // bonus wheel spin on completion — see the matching comment
              // on DEFAULT_ASSIGNMENT_COMPLETION_REWARD in sync.ts for why
              // this can't perfectly distinguish "never configured" from a
              // teacher's own explicit opt-out (both are a null column).
              assignmentCompletionReward: n.assignment_completion_reward ?? DEFAULT_ASSIGNMENT_COMPLETION_REWARD,
              emotePriceOverrides: n.emote_price_overrides ?? {},
              avatarPriceOverrides: n.avatar_price_overrides ?? {},
              npcTitleOverrides: n.npc_title_overrides ?? {},
              npcVoiceOverrides: n.npc_voice_overrides ?? {},
              layoutOverrides: n.layout_overrides ?? {},
              groundTexture: n.ground_texture ?? null,
              skyColor: n.sky_color ?? null,
              skyTexture: n.sky_texture ?? null,
              groundBounds: sanitizeGroundBounds(n.ground_bounds),
            });
          },
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
          ttsSettings: { rate: 1, voiceURI: null },
          createdAt: new Date().toISOString(),
          customTools: [],
          coins: 0,
          savingsGoalLabel: null,
          savingsGoalCents: null,
          countItOutEnabled: false,
          ownedAvatarIds: [avatar],
          ownedEmoteIds: [...STARTER_EMOTE_IDS],
          equippedEmoteId: null,
          skipTokens: 0,
          lastSpinDate: null,
          ownedFontIds: [...STARTER_FONT_IDS],
          equippedFontId: null,
          ownedColorIds: [...STARTER_COLOR_IDS],
          equippedColorId: null,
          equippedHighlightColorId: null,
          equippedMarkerColorId: null,
          ownedVoiceIds: [...STARTER_VOICE_IDS],
          equippedVoiceId: null,
          ownedPrizeIds: [],
          ownedHomeItemIds: [],
          quizTheme: 'standard',
          bonusSpinAvailable: false,
          worldQuest1MetIds: [],
          worldMoveSensitivity: 1,
          worldDpadSide: 'left',
          worldNpcLastTalkDates: {},
          worldJokesHeardIds: [],
          worldTalkRewardCents: 5,
          worldShowArrivalCard: true,
          worldShowDeskGlow: true,
          islandBuildUnlocked: false,
          worldReduceMotion: false,
          vehicleSoundEnabled: true,
          dyslexiaFont: false,
          petCouponRedeemed: false,
          discoveredPetDefIds: [],
          shelterDonationsCents: 0,
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
        pushStudentPatch(id, patch);
      },

      // Every earn/spend goes through here so the bank register always has
      // a matching row — nothing changes a balance silently.
      recordTransaction: (studentId, amountCents, description, icon, kind, silent, needsWants) => {
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
          ...(needsWants ? { needsWants } : {}),
        };
        set((s) => ({
          transactions: [tx, ...s.transactions],
          lastCoinEarn: amountCents > 0 && !silent ? { id: makeId(), studentId, amountCents } : s.lastCoinEarn,
        }));
        pushTransaction(tx);
        // A $0 transaction (a free item win, a Skip Pass win, a log-only
        // register row) changes nothing about the balance — skip the
        // otherwise-redundant updateStudent call so it can't race a
        // different update already in flight for this student (e.g. the
        // daily spin's item-grant write) and clobber it.
        if (amountCents !== 0) get().updateStudent(studentId, { coins: student.coins + amountCents });
      },

      announceCoinEarn: (studentId, amountCents) => {
        if (amountCents <= 0) return;
        set({ lastCoinEarn: { id: makeId(), studentId, amountCents } });
      },

      // Reverses a mistaken register entry's effect on the balance — for a
      // teacher fixing a fat-fingered bonus or a duplicate spin/purchase
      // row, not for routine corrections (those should be a new
      // adjustStudentBalance entry so the register still shows what
      // happened). The row itself is kept and marked voided (struck
      // through in the register, excluded from Charts) rather than erased,
      // so there's always an audit trail of what was removed and when.
      deleteTransaction: (id) => {
        const tx = get().transactions.find((t) => t.id === id);
        if (!tx || tx.voided) return;
        const student = get().students.find((st) => st.id === tx.studentId);
        const voidedTx: Transaction = { ...tx, voided: true };
        set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? voidedTx : t)) }));
        pushTransaction(voidedTx);
        if (student) get().updateStudent(student.id, { coins: student.coins - tx.amountCents });
      },

      // Marketplace: spend Class Cash to unlock an avatar or emote. Returns
      // false (no-op) if already owned, unknown, or not enough money, so
      // callers can show "not enough" without duplicating the balance check.
      buyAvatar: (studentId, avatarId, needsWants) => {
        const student = get().students.find((st) => st.id === studentId);
        const item = avatarById(avatarId);
        if (!student || !item) return false;
        if (student.ownedAvatarIds.includes(avatarId)) return false;
        const price = avatarPriceFor(get().avatarPriceOverrides, avatarId);
        if (student.coins < price) return false;
        get().updateStudent(studentId, { ownedAvatarIds: [...student.ownedAvatarIds, avatarId] });
        get().recordTransaction(studentId, -price, `New character: ${item.name}`, item.src, 'purchase-avatar', false, needsWants);
        return true;
      },

      buyEmote: (studentId, emoteId, needsWants) => {
        const student = get().students.find((st) => st.id === studentId);
        const item = emoteById(emoteId);
        if (!student || !item) return false;
        if (student.ownedEmoteIds.includes(emoteId)) return false;
        const price = emotePriceFor(get().emotePriceOverrides, emoteId);
        if (student.coins < price) return false;
        get().updateStudent(studentId, { ownedEmoteIds: [...student.ownedEmoteIds, emoteId] });
        get().recordTransaction(studentId, -price, `New emote: ${item.name}`, item.src, 'purchase-emote', false, needsWants);
        return true;
      },

      equipEmote: (studentId, emoteId) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student) return;
        if (emoteId && !student.ownedEmoteIds.includes(emoteId)) return;
        get().updateStudent(studentId, { equippedEmoteId: emoteId });
      },

      // Every non-character, non-emote purchase (font/color/voice/power-up/
      // prize) goes through this one path — a MarketplaceItem is either
      // "owned" (font/color/voice/prize, tracked in the matching
      // ownedXIds array) or a stacking power-up (skip passes: no owned
      // list, buying always grants another one). Seasonal items outside
      // their availability window can't be bought even if a stale UI
      // still shows them.
      buyMarketplaceItem: (studentId, itemId, needsWants) => {
        const student = get().students.find((st) => st.id === studentId);
        const item = get().marketplaceItems.find((it) => it.id === itemId);
        if (!student || !item) return false;
        const today = todayISO();
        if (item.availableFrom && today < item.availableFrom) return false;
        if (item.availableUntil && today > item.availableUntil) return false;
        if (student.coins < item.price) return false;

        if (item.kind === 'powerup') {
          get().updateStudent(studentId, { skipTokens: student.skipTokens + 1 });
          get().recordTransaction(studentId, -item.price, item.name, item.icon, 'purchase-skip', false, needsWants);
          return true;
        }

        const ownedField = (
          { font: 'ownedFontIds', color: 'ownedColorIds', voice: 'ownedVoiceIds', prize: 'ownedPrizeIds', furniture: 'ownedHomeItemIds' } as const
        )[item.kind];
        if (student[ownedField].includes(itemId)) return false;
        get().updateStudent(studentId, { [ownedField]: [...student[ownedField], itemId] } as Partial<Student>);
        const kindLabel = { font: 'New font', color: 'New color', voice: 'New voice', prize: 'Prize', furniture: 'New home item' }[item.kind];
        const txKind = { font: 'purchase-font', color: 'purchase-color', voice: 'purchase-voice', prize: 'purchase-prize', furniture: 'purchase-furniture' }[item.kind] as TransactionKind;
        get().recordTransaction(studentId, -item.price, `${kindLabel}: ${item.name}`, item.icon, txKind, false, needsWants);
        return true;
      },

      addMarketplaceItem: (item) => {
        const full: MarketplaceItem = { ...item, id: makeId(), createdAt: new Date().toISOString() };
        set((s) => ({ marketplaceItems: [...s.marketplaceItems, full] }));
        pushMarketplaceItem(full);
      },

      updateMarketplaceItem: (id, patch) => {
        const existing = get().marketplaceItems.find((it) => it.id === id);
        if (!existing) return;
        const updated = { ...existing, ...patch };
        set((s) => ({ marketplaceItems: s.marketplaceItems.map((it) => (it.id === id ? updated : it)) }));
        pushMarketplaceItem(updated);
      },

      deleteMarketplaceItem: (id) => {
        set((s) => ({ marketplaceItems: s.marketplaceItems.filter((it) => it.id !== id) }));
        deleteMarketplaceItemRemote(id);
      },

      // World Editor: teacher-placed objects in the shared Town Square.
      // Every write pushes immediately (same pattern as Marketplace items) —
      // the editor UI itself is responsible for only calling these at the
      // end of a drag/rotate/scale gesture, never on every intermediate
      // frame, so a teacher mid-drag never flickers live for a logged-in
      // student.
      addWorldObject: (obj) => {
        // Shared Town Square objects start life as a draft — students keep
        // seeing whatever was last published until the teacher hits
        // Publish. A Home Room object (studentId set) skips drafting
        // entirely and is published immediately, same as before this
        // system existed.
        const full: WorldObject = {
          ...obj,
          id: makeId(),
          createdAt: new Date().toISOString(),
          status: obj.studentId ? 'published' : 'draft',
        };
        set((s) => ({ worldObjects: [...s.worldObjects, full] }));
        pushWorldObject(full);
        return full.id;
      },

      updateWorldObject: (id, patch) => {
        const existing = get().worldObjects.find((o) => o.id === id);
        if (!existing) return;
        const updated = existing.studentId
          ? { ...existing, ...patch }
          : { ...existing, ...patch, status: 'draft' as const, publishedSnapshot: snapshotForDraft(existing) };
        set((s) => ({ worldObjects: s.worldObjects.map((o) => (o.id === id ? updated : o)) }));
        pushWorldObject(updated);
      },

      // A driven car's parked position when a student exits it — ordinary
      // gameplay state, not a Build Mode content edit, so it deliberately
      // bypasses updateWorldObject's draft/publish gate (status untouched)
      // instead of turning every parked car into an "unpublished change"
      // the teacher would have to Publish. Real bug this fixes: if the
      // object happened to already be mid-draft for an unrelated reason
      // (a teacher's own pending Build Mode edit on it), resolveDraftRows
      // shows publishedSnapshot instead of the live object for students —
      // so the parked position would silently revert to wherever it was
      // before the drive. Nudging position/rotationY on the snapshot too
      // (when one exists) keeps the car exactly where it was left either
      // way, without touching or force-publishing anything else pending.
      parkVehicle: (id, position, rotationY) => {
        set((s) => ({
          worldObjects: s.worldObjects.map((o) =>
            o.id === id
              ? { ...o, position, rotationY, publishedSnapshot: o.publishedSnapshot ? { ...o.publishedSnapshot, position, rotationY } : o.publishedSnapshot }
              : o
          ),
        }));
        const updated = get().worldObjects.find((o) => o.id === id);
        if (updated) pushWorldObject(updated);
      },

      deleteWorldObject: (id) => {
        const existing = get().worldObjects.find((o) => o.id === id);
        if (!existing) return;
        // Home Room, or a draft that was never published — nothing a
        // student has seen yet, so a real delete is safe right now.
        if (existing.studentId || (existing.status !== 'published' && !existing.publishedSnapshot)) {
          set((s) => ({ worldObjects: s.worldObjects.filter((o) => o.id !== id) }));
          deleteWorldObjectRemote(id);
          return;
        }
        // Already published and visible to students — hold the deletion
        // back until Publish; Discard can still bring it back.
        const updated: WorldObject = {
          ...existing,
          status: 'draft',
          pendingDelete: true,
          publishedSnapshot: existing.publishedSnapshot ?? snapshotForDraft(existing),
        };
        set((s) => ({ worldObjects: s.worldObjects.map((o) => (o.id === id ? updated : o)) }));
        pushWorldObject(updated);
      },

      publishWorldDraft: () => {
        const nextObjects: WorldObject[] = [];
        for (const o of get().worldObjects) {
          if (o.studentId || o.status !== 'draft') { nextObjects.push(o); continue; }
          if (o.pendingDelete) { deleteWorldObjectRemote(o.id); continue; }
          const published: WorldObject = { ...o, status: 'published', pendingDelete: false, publishedSnapshot: undefined };
          nextObjects.push(published);
          pushWorldObject(published);
        }
        const nextWalls: WallSegment[] = [];
        for (const w of get().wallSegments) {
          if (w.studentId || w.status !== 'draft') { nextWalls.push(w); continue; }
          if (w.pendingDelete) { deleteWallSegmentRemote(w.id); continue; }
          const published: WallSegment = { ...w, status: 'published', pendingDelete: false, publishedSnapshot: undefined };
          nextWalls.push(published);
          pushWallSegment(published);
        }
        set({ worldObjects: nextObjects, wallSegments: nextWalls });
      },

      discardWorldDraft: () => {
        const nextObjects: WorldObject[] = [];
        for (const o of get().worldObjects) {
          if (o.studentId || o.status !== 'draft') { nextObjects.push(o); continue; }
          if (!o.publishedSnapshot) { deleteWorldObjectRemote(o.id); continue; }
          const restored: WorldObject = { ...o.publishedSnapshot, status: 'published', pendingDelete: false, publishedSnapshot: undefined };
          nextObjects.push(restored);
          pushWorldObject(restored);
        }
        const nextWalls: WallSegment[] = [];
        for (const w of get().wallSegments) {
          if (w.studentId || w.status !== 'draft') { nextWalls.push(w); continue; }
          if (!w.publishedSnapshot) { deleteWallSegmentRemote(w.id); continue; }
          const restored: WallSegment = { ...w.publishedSnapshot, status: 'published', pendingDelete: false, publishedSnapshot: undefined };
          nextWalls.push(restored);
          pushWallSegment(restored);
        }
        set({ worldObjects: nextObjects, wallSegments: nextWalls });
      },

      // Sims 4-style drawn walls — same immediate-push pattern as
      // WorldObject above, used both by WorldEditor's Wall tool (shared
      // Town Square, studentId undefined) and HomeRoom's own Wall tool
      // (studentId set).
      addWallSegment: (w) => {
        const full: WallSegment = {
          ...w,
          id: makeId(),
          createdAt: new Date().toISOString(),
          status: w.studentId ? 'published' : 'draft',
        };
        set((s) => ({ wallSegments: [...s.wallSegments, full] }));
        pushWallSegment(full);
        return full.id;
      },

      updateWallSegment: (id, patch) => {
        const existing = get().wallSegments.find((w) => w.id === id);
        if (!existing) return;
        const updated = existing.studentId
          ? { ...existing, ...patch }
          : { ...existing, ...patch, status: 'draft' as const, publishedSnapshot: snapshotForDraft(existing) };
        set((s) => ({ wallSegments: s.wallSegments.map((w) => (w.id === id ? updated : w)) }));
        pushWallSegment(updated);
      },

      deleteWallSegment: (id) => {
        const existing = get().wallSegments.find((w) => w.id === id);
        if (!existing) return;
        if (existing.studentId || (existing.status !== 'published' && !existing.publishedSnapshot)) {
          set((s) => ({ wallSegments: s.wallSegments.filter((w) => w.id !== id) }));
          deleteWallSegmentRemote(id);
          return;
        }
        const updated: WallSegment = {
          ...existing,
          status: 'draft',
          pendingDelete: true,
          publishedSnapshot: existing.publishedSnapshot ?? snapshotForDraft(existing),
        };
        set((s) => ({ wallSegments: s.wallSegments.map((w) => (w.id === id ? updated : w)) }));
        pushWallSegment(updated);
      },

      // Ground-type per-tile system: painted patches of alternate ground
      // texture, same live-instant behavior as groundTexture/skyColor
      // above rather than the draft/publish system — a teacher repainting
      // ground is low-stakes the same way a sky-color change already is.
      addGroundPatch: (p) => {
        const full: GroundPatch = { ...p, id: makeId(), createdAt: new Date().toISOString() };
        set((s) => ({ groundPatches: [...s.groundPatches, full] }));
        pushGroundPatch(full);
        return full.id;
      },

      deleteGroundPatch: (id) => {
        set((s) => ({ groundPatches: s.groundPatches.filter((p) => p.id !== id) }));
        deleteGroundPatchRemote(id);
      },

      adoptPet: (studentId, petDefId, charge = true) => {
        const student = get().students.find((st) => st.id === studentId);
        const def = petDefById(petDefId);
        if (!student || !def) return false;
        const owned = get().pets.filter((p) => p.studentId === studentId);
        if (owned.length >= PET_OWNERSHIP_CAP) return false;
        if (charge && student.coins < def.priceCents) return false;
        const pet: StudentPet = {
          id: makeId(),
          studentId,
          petDefId,
          customName: def.name,
          acquiredAt: new Date().toISOString(),
          following: false,
          trainingProgress: 0,
          food: 100,
          social: 100,
          health: 100,
        };
        set((s) => ({ pets: [...s.pets, pet] }));
        pushStudentPet(pet);
        if (charge) get().recordTransaction(studentId, -def.priceCents, `Adopted a pet: ${def.name}`, '🐾', 'purchase-pet');
        // Pet Journal: every adoption — free, paid, or from a Mystery Box —
        // marks that species discovered forever, even if this exact pet is
        // later sold.
        if (!student.discoveredPetDefIds?.includes(petDefId)) {
          get().updateStudent(studentId, { discoveredPetDefIds: [...(student.discoveredPetDefIds ?? []), petDefId] });
        }
        return true;
      },

      // Mystery Adoption Box (Claudia's plan) — a flat-priced pack that
      // always yields a pet (never an empty pull, the line between a fun
      // surprise and a loot-box mechanic). Charges the pack price directly
      // here, then grants the rolled pet through adoptPet's free path since
      // payment already happened. Refuses outright (no charge at all) when
      // the pet home is already full, rather than charging for a pull that
      // couldn't land anywhere — simpler and fairer than a consolation
      // prize for a purchase that was never going to work.
      //
      // Claudia's audit (M3): the guaranteed-pull design is sound and stays
      // as-is, but a real-currency weighted-rarity pull with no cap at all
      // could still become a repeated-tap impulse loop in one sitting for
      // this population. One open per real-world day, mirroring the daily
      // spin wheel's own lastSpinDate gate.
      openMysteryPack: (studentId) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student) return null;
        const today = todayISO();
        if (student.lastMysteryPackOpenedDate === today) return null;
        if (student.coins < MYSTERY_PACK_PRICE_CENTS) return null;
        const owned = get().pets.filter((p) => p.studentId === studentId);
        if (owned.length >= PET_OWNERSHIP_CAP) return null;
        const ownedDefIds = new Set(owned.map((p) => p.petDefId));
        const def = rollMysteryPet(ownedDefIds);
        get().recordTransaction(studentId, -MYSTERY_PACK_PRICE_CENTS, `🎁 Mystery Adoption Box: got ${def.name}!`, '🎁', 'purchase-pet');
        get().adoptPet(studentId, def.id, false);
        get().updateStudent(studentId, { lastMysteryPackOpenedDate: today });
        return def;
      },

      // Pet Shelter's free "donate" action — a real coin sink, deliberately
      // reward-free (no coins back, no item, nothing pet-related unlocked)
      // so it stays a genuine prosocial/SEL beat and never quietly becomes
      // a second way to buy something.
      donateToShelter: (studentId, amountCents) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student || student.coins < amountCents) return false;
        get().recordTransaction(studentId, -amountCents, '💛 Donated to the Pet Shelter', '💛', 'donation');
        get().updateStudent(studentId, { shelterDonationsCents: (student.shelterDonationsCents ?? 0) + amountCents });
        return true;
      },

      carePet: (petId, action) => {
        const pet = get().pets.find((p) => p.id === petId);
        if (!pet) return;
        const clamp = (n: number) => Math.max(0, Math.min(100, n));
        const updated: StudentPet =
          action === 'feed'
            ? { ...pet, food: clamp(pet.food + 25) }
            : action === 'pet'
              ? { ...pet, social: clamp(pet.social + 20), health: clamp(pet.health + 5) }
              : { ...pet, social: clamp(pet.social + 15), health: clamp(pet.health + 15) }; // play
        set((s) => ({ pets: s.pets.map((p) => (p.id === petId ? updated : p)) }));
        pushStudentPet(updated);
      },

      recordBakeryQuestionAnswered: (studentId) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student) return;
        const before = student.bakeryQuestionsAnswered ?? 0;
        const after = before + 1;
        const alreadyUnlocked = (student.unlockedCharacterIds ?? []).includes('cake');
        const justUnlocked = !alreadyUnlocked && after >= 100;
        get().updateStudent(studentId, {
          bakeryQuestionsAnswered: after,
          ...(justUnlocked ? { unlockedCharacterIds: [...(student.unlockedCharacterIds ?? []), 'cake'] } : {}),
        });
        if (justUnlocked) set({ lastCharacterUnlock: { id: makeId(), studentId, characterId: 'cake' } });
      },

      recordBakeryGameResult: (studentId, xp) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student) return;
        const entry = { xp, date: new Date().toISOString().slice(0, 10) };
        get().updateStudent(studentId, {
          bakeryLeaderboard: [...(student.bakeryLeaderboard ?? []), entry],
        });
      },

      equipCharacter: (studentId, characterId) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student) return;
        if (characterId !== null && !(student.unlockedCharacterIds ?? []).includes(characterId)) return;
        get().updateStudent(studentId, { equippedCharacterId: characterId });
      },

      renamePet: (petId, name) => {
        const pet = get().pets.find((p) => p.id === petId);
        const trimmed = name.trim();
        if (!pet || !trimmed) return;
        const updated: StudentPet = { ...pet, customName: trimmed };
        set((s) => ({ pets: s.pets.map((p) => (p.id === petId ? updated : p)) }));
        pushStudentPet(updated);
      },

      tintPet: (petId, tintColor) => {
        const pet = get().pets.find((p) => p.id === petId);
        if (!pet) return;
        const updated: StudentPet = { ...pet, tintColor: tintColor ?? undefined };
        set((s) => ({ pets: s.pets.map((p) => (p.id === petId ? updated : p)) }));
        pushStudentPet(updated);
      },

      teachTrick: (petId, trickId) => {
        const pet = get().pets.find((p) => p.id === petId);
        if (!pet || (pet.tricksLearned ?? []).includes(trickId)) return;
        const updated: StudentPet = { ...pet, tricksLearned: [...(pet.tricksLearned ?? []), trickId] };
        set((s) => ({ pets: s.pets.map((p) => (p.id === petId ? updated : p)) }));
        pushStudentPet(updated);
      },

      setFollowingPet: (studentId, petId) => {
        if (petId) {
          const pet = get().pets.find((p) => p.id === petId && p.studentId === studentId);
          if (!pet || !canPetFollow(pet.trainingProgress)) return;
        }
        set((s) => ({
          pets: s.pets.map((p) => (p.studentId === studentId ? { ...p, following: p.id === petId } : p)),
        }));
        get().pets.filter((p) => p.studentId === studentId).forEach((p) => pushStudentPet(p));
      },

      sellPet: (petId) => {
        const pet = get().pets.find((p) => p.id === petId);
        if (!pet) return;
        const def = petDefById(pet.petDefId);
        // Resale, not a refund — a real economy consequence, same reasoning
        // as any other "trade it in" mechanic. "Pets never die," they just
        // move on.
        const refund = def ? Math.round(def.priceCents * 0.4) : 0;
        set((s) => ({ pets: s.pets.filter((p) => p.id !== petId) }));
        deleteStudentPetRemote(petId);
        if (refund > 0) get().recordTransaction(pet.studentId, refund, `Sold pet: ${pet.customName}`, '🐾', 'sell-pet');
      },

      tickPetDecay: (studentId) => {
        const owned = get().pets.filter((p) => p.studentId === studentId);
        owned.forEach((pet) => {
          const food = Math.max(PET_STAT_FLOOR, pet.food - PET_DECAY_AMOUNT);
          const social = Math.max(PET_STAT_FLOOR, pet.social - PET_DECAY_AMOUNT);
          // Health only falls as a consequence of food/social running low,
          // never decayed independently (see StudentPet's own comment).
          const neglected = food <= PET_STAT_FLOOR + 5 || social <= PET_STAT_FLOOR + 5;
          const health = neglected ? Math.max(PET_STAT_FLOOR, pet.health - PET_DECAY_AMOUNT) : pet.health;
          if (food === pet.food && social === pet.social && health === pet.health) return;
          const updated: StudentPet = { ...pet, food, social, health };
          set((s) => ({ pets: s.pets.map((p) => (p.id === pet.id ? updated : p)) }));
          pushStudentPet(updated);
        });
      },

      addHomeRoom: (studentId, kind, name) => {
        const defaultNames: Record<HomeRoomKind, string> = {
          large: 'Large Room',
          medium: 'Medium Room',
          small: 'Small Room',
          xsmall: 'Small Room',
          closet: 'Closet',
          yard: 'Yard',
        };
        const room: HomeRoomDef = {
          id: makeId(),
          studentId,
          kind,
          name: name?.trim() || defaultNames[kind],
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ homeRooms: [...s.homeRooms, room] }));
        pushHomeRoom(room);
        return room.id;
      },

      updateHomeRoom: (id, patch) => {
        const room = get().homeRooms.find((r) => r.id === id);
        if (!room) return;
        const updated: HomeRoomDef = { ...room, ...patch };
        set((s) => ({ homeRooms: s.homeRooms.map((r) => (r.id === id ? updated : r)) }));
        pushHomeRoom(updated);
      },

      deleteHomeRoom: (id) => {
        set((s) => ({ homeRooms: s.homeRooms.filter((r) => r.id !== id) }));
        deleteHomeRoomRemote(id);
      },

      setLayoutOverride: (layoutId, patch) => {
        const next = { ...get().layoutOverrides };
        if (patch === null) {
          delete next[layoutId];
        } else {
          next[layoutId] = { ...next[layoutId], ...patch };
        }
        set({ layoutOverrides: next });
        pushLayoutOverrides(next);
      },

      setGroundTexture: (path) => {
        set({ groundTexture: path });
        pushGroundTexture(path);
      },

      setSkyColor: (color) => {
        set({ skyColor: color });
        pushSkyColor(color);
      },

      setSkyTexture: (path) => {
        set({ skyTexture: path });
        pushSkyTexture(path);
      },

      expandGroundBounds: (edge, deltaMeters) => {
        const current = get().groundBounds;
        const next: GroundBounds = { ...current, [edge]: clampGroundBoundsValue(current[edge] + deltaMeters) };
        set({ groundBounds: next });
        pushGroundBounds(next);
      },

      // Undo/redo's only store action — see its own interface comment.
      restoreWorldEditorState: (worldObjects, layoutOverrides) => {
        const prevObjects = get().worldObjects;
        set({ worldObjects, layoutOverrides });
        const nextIds = new Set(worldObjects.map((o) => o.id));
        for (const obj of worldObjects) {
          const prev = prevObjects.find((o) => o.id === obj.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(obj)) pushWorldObject(obj);
        }
        for (const prev of prevObjects) {
          if (!nextIds.has(prev.id)) deleteWorldObjectRemote(prev.id);
        }
        pushLayoutOverrides(layoutOverrides);
      },

      publishFocus: (subject, category, title, detail, wordList, durationMode, dayCount, dateRangeStart, dateRangeEnd) => {
        const today = todayISO();
        let startDate = today;
        let endDate: string | null = null;
        if (durationMode === 'days') {
          const n = Math.max(1, dayCount ?? 7);
          const end = new Date(`${today}T00:00:00`);
          end.setDate(end.getDate() + (n - 1));
          endDate = end.toISOString().slice(0, 10);
        } else if (durationMode === 'dateRange') {
          startDate = dateRangeStart ?? today;
          endDate = dateRangeEnd ?? today;
        }
        // Ends whichever focus was current for this lane (per getCurrentFocus's
        // rule) so there's only ever one current focus per subject at a time.
        const previous = get().focuses.find(
          (f) => f.subject === subject && f.startDate <= today && (f.endDate === null || f.endDate >= today),
        );
        const fresh: Focus = { id: makeId(), subject, category, title, detail, wordList, durationMode, startDate, endDate, createdAt: new Date().toISOString() };
        set((s) => ({
          focuses: [
            ...(previous ? s.focuses.map((f) => (f.id === previous.id ? { ...f, endDate: f.endDate ?? today } : f)) : s.focuses),
            fresh,
          ],
        }));
        if (previous && previous.endDate === null) pushFocus({ ...previous, endDate: today });
        pushFocus(fresh);
      },

      endFocus: (id) => {
        const today = todayISO();
        const existing = get().focuses.find((f) => f.id === id);
        if (!existing) return;
        const updated = { ...existing, endDate: existing.endDate ?? today };
        set((s) => ({ focuses: s.focuses.map((f) => (f.id === id ? updated : f)) }));
        pushFocus(updated);
      },

      deleteFocus: (id) => {
        set((s) => ({ focuses: s.focuses.filter((f) => f.id !== id) }));
        deleteFocusRemote(id);
      },

      setAssignmentCompletionReward: (reward) => {
        set({ assignmentCompletionReward: reward });
        pushAppSettings(reward);
      },

      setEmotePriceOverride: (emoteId, priceCents) => {
        const next = { ...get().emotePriceOverrides };
        if (priceCents === null) {
          delete next[emoteId];
        } else {
          next[emoteId] = priceCents;
        }
        set({ emotePriceOverrides: next });
        pushEmotePriceOverrides(next);
      },

      setAvatarPriceOverride: (avatarId, priceCents) => {
        const next = { ...get().avatarPriceOverrides };
        if (priceCents === null) {
          delete next[avatarId];
        } else {
          next[avatarId] = priceCents;
        }
        set({ avatarPriceOverrides: next });
        pushAvatarPriceOverrides(next);
      },

      setNpcTitleOverride: (npcId, title) => {
        const next = { ...get().npcTitleOverrides };
        if (title === null || title.trim() === '') {
          delete next[npcId];
        } else {
          next[npcId] = title.trim();
        }
        set({ npcTitleOverrides: next });
        pushNpcTitleOverrides(next);
      },

      setNpcVoiceOverride: (npcId, presetId) => {
        const next = { ...get().npcVoiceOverrides };
        if (presetId === null) {
          delete next[npcId];
        } else {
          next[npcId] = presetId;
        }
        set({ npcVoiceOverrides: next });
        pushNpcVoiceOverrides(next);
      },

      // Personal Journal (direct teacher instruction): built as an option
      // on the same Notes word processor, not a separate tool — only the
      // creation flow differs, an auto-dated title standing in for a real
      // diary's date header.
      createNote: (studentId, kind = 'note') => {
        const id = makeId();
        const title = kind === 'journal' ? new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Untitled';
        const note: Note = { id, studentId, title, body: '', fontId: null, colorId: null, highlightColorId: null, updatedAt: new Date().toISOString(), kind };
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

      // Literacy Manipulatives save file — direct teacher instruction: "a
      // save file (creating a log of all saved whiteboards that they can
      // name and refer back to)." Same named-independent-saves shape as
      // Notes above.
      saveWhiteboard: (studentId, name, placedJson, drawingDataUrl) => {
        const board: SavedWhiteboard = { id: makeId(), studentId, name, createdAt: new Date().toISOString(), placedJson, drawingDataUrl };
        set((s) => ({ savedWhiteboards: [...s.savedWhiteboards, board] }));
        pushSavedWhiteboard(board);
      },

      deleteWhiteboard: (id) => {
        set((s) => ({ savedWhiteboards: s.savedWhiteboards.filter((w) => w.id !== id) }));
        deleteSavedWhiteboardRemote(id);
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
        // Hard rule: quizzes and final checkpoints can never be skipped with
        // a Skip Pass, regardless of the teacher's per-task "required" toggle.
        if (task?.required || task?.type === 'quiz' || task?.isFinalCheck) return false;
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
        // Already spun today refuses another spin — UNLESS a bonus spin
        // (from finishing an activity/assignment with a "spin" reward) is
        // waiting, in which case lastSpinDate being today is exactly the
        // expected state and shouldn't block it. This used to be handled
        // by literally nulling lastSpinDate out (resetDailySpin) whenever a
        // bonus spin was granted, which also reset "already spun today"
        // itself — so the very next time the student's Home screen
        // re-checked that flag, it looked like they hadn't spun at all yet
        // and popped the wheel open again, forever, for anyone who ever
        // earned a bonus spin. bonusSpinAvailable is now its own
        // independent gate, so a real spin's "already used today" status
        // is never touched by granting a bonus one.
        if (student.lastSpinDate === today && !student.bonusSpinAvailable) return null;
        const segments = getDailySpinSegments(today, get().marketplaceItems);
        const segmentIndex = Math.floor(Math.random() * segments.length);
        const segment = segments[segmentIndex];
        // Folded into each branch's own updateStudent call below instead of
        // fired as its own separate update — two back-to-back updateStudent
        // calls on the same student each push their own full-row upsert to
        // Supabase, and those two async writes can land out of order,
        // occasionally letting the earlier (pre-prize) row win and silently
        // drop whatever the second call had just added (e.g. a won emote
        // never actually persisting). One combined patch per branch avoids
        // the race entirely.
        const spinPatch: Partial<Student> = { lastSpinDate: today, bonusSpinAvailable: false };

        if (segment.kind === 'skip') {
          get().updateStudent(studentId, { ...spinPatch, skipTokens: student.skipTokens + 1 });
          get().recordTransaction(studentId, 0, '🎡 Daily Spin: won a Skip Pass', '🎫', 'spin-cash', true);
          return { type: 'skip', amountCents: 0, label: segment.label, segmentIndex };
        }

        if (segment.kind === 'cents' || segment.kind === 'cashback') {
          const amountCents = segment.kind === 'cashback' ? Math.round(student.coins * ((segment.percent ?? 0) / 100)) : segment.amountCents ?? 0;
          get().updateStudent(studentId, spinPatch);
          // silent: true — the wheel's own multi-second spin animation is the real reveal; the
          // component fires the coin-drop celebration itself once that animation actually
          // finishes, via announceCoinEarn, instead of it firing the instant Spin is clicked.
          get().recordTransaction(studentId, amountCents, '🎡 Daily Spin winnings', '🎡', segment.kind === 'cashback' ? 'spin-cashback' : 'spin-cash', true);
          return {
            type: segment.kind,
            amountCents,
            label: segment.kind === 'cashback' ? `💰 ${formatMoney(amountCents)} Cashback` : `💵 ${segment.label}`,
            segmentIndex,
          };
        }

        // The dedicated pet wedge doesn't fit the ownedField/marketplace-item
        // path below at all — pets are their own table, not a Student
        // ownedXIds array — so it's handled as its own branch, same
        // already-full-so-cash-consolation shape as the "already owned" path.
        if (segment.kind === 'pet') {
          const petId = segment.itemId!;
          const def = petDefById(petId);
          const atCap = get().pets.filter((p) => p.studentId === studentId).length >= PET_OWNERSHIP_CAP;
          if (!def || atCap) {
            get().updateStudent(studentId, spinPatch);
            get().recordTransaction(studentId, ITEM_ALREADY_OWNED_CONSOLATION_CENTS, `🎡 Daily Spin (pet home is full!)`, '🎡', 'spin-cash', true);
            return {
              type: 'item',
              amountCents: ITEM_ALREADY_OWNED_CONSOLATION_CENTS,
              label: `Your pet home is full! Here's ${formatMoney(ITEM_ALREADY_OWNED_CONSOLATION_CENTS)} instead!`,
              segmentIndex,
            };
          }
          get().updateStudent(studentId, spinPatch);
          get().adoptPet(studentId, petId, false);
          get().recordTransaction(studentId, 0, `🎡 Daily Spin: won a pet, ${def.name}!`, '🐾', 'spin-cash', true);
          return { type: 'item', amountCents: 0, label: `🐾 ${def.name}!`, segmentIndex, itemKind: 'pet', itemId: petId };
        }

        // Every remaining kind is a marketplace item (avatar/emote/font/color/voice/prize) —
        // 'pet' already returned above, so TS narrows segment.kind down to exactly this set
        // without needing an unsafe cast (the old `as SpinItemKind` here defeated that).
        const itemKind = segment.kind;
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
          get().updateStudent(studentId, spinPatch);
          get().recordTransaction(studentId, ITEM_ALREADY_OWNED_CONSOLATION_CENTS, `🎡 Daily Spin (already had ${segment.label})`, '🎡', 'spin-cash', true);
          return {
            type: 'item',
            amountCents: ITEM_ALREADY_OWNED_CONSOLATION_CENTS,
            label: `You already have that one, here's ${formatMoney(ITEM_ALREADY_OWNED_CONSOLATION_CENTS)} instead!`,
            segmentIndex,
          };
        }
        get().updateStudent(studentId, { ...spinPatch, [ownedField]: [...student[ownedField], itemId] } as Partial<Student>);
        // Every spin — including a free item win — leaves a $0 register
        // row, so a student's bank history always shows exactly what
        // happened on every spin, not just the ones that moved money.
        get().recordTransaction(studentId, 0, `🎡 Daily Spin: won ${segment.label}`, segment.imageUrl ?? '🎁', 'spin-cash', true);
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

      meetQuest1Neighbor: (studentId, neighborId, itemRewardCents, itemLabel) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student || student.worldQuest1MetIds.includes(neighborId)) return; // already met — no double reward
        const metIds = [...student.worldQuest1MetIds, neighborId];
        get().updateStudent(studentId, { worldQuest1MetIds: metIds });
        get().recordTransaction(studentId, itemRewardCents, `🦊 Meet the Neighbors: ${itemLabel}`, '🍂', 'task');
        // The grand-finish prize fires the moment the 4th Neighbor is met —
        // a separate register row, not folded into that Neighbor's own
        // item reward, so a student's history shows the two as the
        // distinct moments they actually were (§First quest).
        if (metIds.length >= QUEST1_NEIGHBOR_COUNT) {
          get().recordTransaction(studentId, QUEST1_GRAND_PRIZE_CENTS, '🎉 Meet the Neighbors: quest complete!', '🏆', 'task');
        }
      },

      // Small coin for the first conversation with a given NPC each real-
      // world day — a legible, learnable rule (never random) so talking to
      // people has a real reason beyond the one-time Neighbor quest item.
      // Fired after the student's first response pick, not the closing
      // line, so bailing out early with "I need a minute" is always free.
      recordNpcDailyTalk: (studentId, npcId, npcName) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student) return;
        const today = todayISO();
        if (student.worldNpcLastTalkDates[npcId] === today) return;
        get().updateStudent(studentId, { worldNpcLastTalkDates: { ...student.worldNpcLastTalkDates, [npcId]: today } });
        if (student.worldTalkRewardCents > 0) {
          get().recordTransaction(studentId, student.worldTalkRewardCents, `💬 Talked with ${npcName}`, '💬', 'task', true);
        }
      },

      // A joke heard for the first time ever goes into the permanent Joke
      // Book plus a one-time small bonus — never again for the same joke,
      // and never tied to which response the student picked (Pivotal
      // Response Treatment: reinforce the attempt, not "the best answer").
      collectJoke: (studentId, jokeId) => {
        const student = get().students.find((st) => st.id === studentId);
        if (!student || student.worldJokesHeardIds.includes(jokeId)) return;
        get().updateStudent(studentId, { worldJokesHeardIds: [...student.worldJokesHeardIds, jokeId] });
        if (student.worldTalkRewardCents > 0) {
          get().recordTransaction(studentId, 5, '😄 New joke for the Joke Book!', '📖', 'task', true);
        }
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
        const student = get().students.find((st) => st.id === studentId);
        if (!student) return;
        get().updateStudent(studentId, { featureToggles: { ...student.featureToggles, [tool]: enabled } });
      },

      setStreak: (studentId, streak) => {
        get().updateStudent(studentId, { streak });
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
        const taskLabel = rewardedTask?.title || 'Activity completed';
        const reward = rewardedTask?.reward ?? { type: 'money' as const };
        if (reward.type === 'marketplaceItem' && reward.itemId) {
          const item = grantFreeMarketplaceItem(get, studentId, reward.itemId);
          get().recordTransaction(studentId, 0, item ? `${taskLabel}: won ${item.name}!` : taskLabel, item?.icon ?? rewardedTask?.icon ?? '🎁', 'task');
        } else if (reward.type === 'customItem') {
          get().recordTransaction(studentId, 0, `${taskLabel}: won ${reward.customName || 'a prize'}!`, reward.customIcon || '🎁', 'task');
        } else if (reward.type === 'spin') {
          get().updateStudent(studentId, { bonusSpinAvailable: true });
          get().recordTransaction(studentId, 0, `${taskLabel}: bonus spin!`, '🎡', 'task');
        } else {
          const rewardCents = rewardedTask?.rewardCents ?? DEFAULT_TASK_REWARD_CENTS;
          get().recordTransaction(studentId, rewardCents, taskLabel, rewardedTask?.icon ?? '📝', 'task');
        }

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

        // Pet training: every task completion nudges every owned pet that
        // hasn't yet reached the top of the milestone ladder — direct
        // teacher spec ties training to assignment/question-set completion,
        // never to care actions (feed/pet/play don't touch this). Caught in
        // review: filtering on canPetFollow() (the 5-completion follow
        // unlock) instead of the ladder's actual top threshold froze
        // trainingProgress at 5 forever, silently killing the later
        // "Best Friends"/"Bonded for Life" milestones.
        const trainingCap = PET_MILESTONES[PET_MILESTONES.length - 1].threshold;
        get().pets.filter((p) => p.studentId === studentId && p.trainingProgress < trainingCap).forEach((pet) => {
          const updated: StudentPet = { ...pet, trainingProgress: pet.trainingProgress + 1 };
          set((s) => ({ pets: s.pets.map((p) => (p.id === pet.id ? updated : p)) }));
          pushStudentPet(updated);
        });

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

          // A separate, teacher-defined bonus for finishing the WHOLE
          // assignment (both subjects) — on top of, not instead of, every
          // per-activity task reward and the streak interest above.
          const reward = get().assignmentCompletionReward;
          if (reward) {
            if (reward.type === 'coins' && (reward.amountCents ?? 0) > 0) {
              get().recordTransaction(studentId, reward.amountCents!, "🎉 Finished today's assignment!", '🎉', 'assignment-complete');
            } else if (reward.type === 'marketplaceItem' && reward.itemId) {
              const item = grantFreeMarketplaceItem(get, studentId, reward.itemId);
              if (item) {
                get().recordTransaction(studentId, 0, `🎉 Finished today's assignment: won ${item.name}!`, item.icon, 'assignment-complete');
              }
            } else if (reward.type === 'spin') {
              get().updateStudent(studentId, { bonusSpinAvailable: true });
              get().recordTransaction(studentId, 0, "🎉 Finished today's assignment: bonus spin!", '🎡', 'assignment-complete');
            }
          }
        }
        get().evaluateBadgeRules(studentId);
      },

      // Direct teacher request: Playground/Free Play question sets should
      // pay into the bank register on completion, same as a real
      // assignment — mirrors completeTask's own reward branch exactly
      // (money/marketplaceItem/customItem/spin) but deliberately skips
      // every rotation/progress/streak/badge/pet-training side effect
      // completeTask has, since Playground content was built ungraded on
      // purpose (no to-do checkbox, not tied to a specific day's plan).
      completePlaygroundActivity: (studentId, task) => {
        const taskLabel = task.title || 'Playground activity completed';
        const reward = task.reward ?? { type: 'money' as const };
        if (reward.type === 'marketplaceItem' && reward.itemId) {
          const item = grantFreeMarketplaceItem(get, studentId, reward.itemId);
          get().recordTransaction(studentId, 0, item ? `${taskLabel}: won ${item.name}!` : taskLabel, item?.icon ?? task.icon ?? '🎁', 'task');
        } else if (reward.type === 'customItem') {
          get().recordTransaction(studentId, 0, `${taskLabel}: won ${reward.customName || 'a prize'}!`, reward.customIcon || '🎁', 'task');
        } else if (reward.type === 'spin') {
          get().updateStudent(studentId, { bonusSpinAvailable: true });
          get().recordTransaction(studentId, 0, `${taskLabel}: bonus spin!`, '🎡', 'task');
        } else {
          const rewardCents = task.rewardCents ?? PLAYGROUND_REWARD_CENTS;
          get().recordTransaction(studentId, rewardCents, taskLabel, task.icon ?? '🎮', 'task');
        }
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
          // A missed question gets requeued exactly once — direct teacher
          // spec: "students have one more try to see and answer a question
          // only if it was answered wrong the first time," a total of two
          // attempts, never more. Caught in review: this previously allowed
          // up to 2 retries (3 wrong attempts total) before retiring a
          // question, one retry too many against that spec.
          const priorWrongAttempts = state.log.filter((l) => l.questionId === questionId && !l.correct).length;
          if (priorWrongAttempts >= 1) {
            masteredIds = [...masteredIds, questionId];
            const retiredPrompt = task.quiz?.questions.find((q) => q.id === questionId)?.prompt;
            if (retiredPrompt) get().flagQuizStruggle(studentId, subject, task, retiredPrompt);
          } else {
            // reinsert at a random spot further back so it isn't asked again immediately
            const insertAt = remainingIds.length === 0 ? 0 : Math.floor(Math.random() * remainingIds.length) + 1;
            remainingIds = [...remainingIds.slice(0, insertAt), questionId, ...remainingIds.slice(insertAt)];
          }
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
          const liveQuestionIds = new Set((task.quiz?.questions ?? []).map((q) => q.id));
          const totalCount = liveQuestionIds.size;
          const firstResultByQuestion = new Map<string, boolean>();
          for (const entry of log) {
            // A question the teacher removed mid-attempt gets auto-skipped
            // (see QuizTask's "stuck on stale question" path) so the
            // student isn't trapped — but it was never really part of
            // THIS quiz, so it shouldn't count toward the score.
            if (!liveQuestionIds.has(entry.questionId)) continue;
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

      submitFeedback: (studentId, category, subcategoryLabel, customLabel, text) => {
        const feedback: StudentFeedback = {
          id: makeId(),
          studentId,
          category,
          subcategoryLabel,
          customLabel,
          text,
          createdAt: new Date().toISOString(),
          resolved: false,
        };
        set((s) => ({ studentFeedback: [feedback, ...s.studentFeedback] }));
        pushStudentFeedback(feedback);
      },

      resolveFeedback: (id) => {
        set((s) => ({ studentFeedback: s.studentFeedback.map((f) => (f.id === id ? { ...f, resolved: true } : f)) }));
        const updated = get().studentFeedback.find((f) => f.id === id);
        if (updated) pushStudentFeedback(updated);
      },

      flagQuizStruggle: (studentId, subject, task, questionPrompt) => {
        const struggle: QuizStruggle = {
          id: makeId(),
          studentId,
          subject,
          taskId: task.id,
          taskTitle: task.title,
          questionPrompt,
          timestamp: new Date().toISOString(),
          resolved: false,
        };
        set((s) => ({ quizStruggles: [struggle, ...s.quizStruggles] }));
        pushQuizStruggle(struggle);
      },

      resolveQuizStruggle: (id) => {
        set((s) => ({ quizStruggles: s.quizStruggles.map((q) => (q.id === id ? { ...q, resolved: true } : q)) }));
        const updated = get().quizStruggles.find((q) => q.id === id);
        if (updated) pushQuizStruggle(updated);
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
        if (BADGES_PAUSED) return;
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
        if (BADGES_PAUSED) return;
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

      duplicateQuestionSet: (id) => {
        const original = get().questionSets.find((qs) => qs.id === id);
        if (!original) return null;
        return get().addQuestionSet({
          name: `${original.name} (copy)`,
          subject: original.subject,
          kind: original.kind,
          questions: original.questions.map((q) => ({ ...q, id: makeId() })),
          cards: original.cards.map((c) => ({ ...c, id: makeId() })),
          coverImageUrl: original.coverImageUrl,
          tags: original.tags,
        });
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

      addCinemaVideo: (video) => {
        const id = makeId();
        const full: CinemaVideo = { ...video, id, createdAt: new Date().toISOString() };
        set((s) => ({ cinemaVideos: [full, ...s.cinemaVideos] }));
        pushCinemaVideo(full);
        return id;
      },

      updateCinemaVideo: (id, patch) => {
        set((s) => ({ cinemaVideos: s.cinemaVideos.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));
        const updated = get().cinemaVideos.find((v) => v.id === id);
        if (updated) pushCinemaVideo(updated);
      },

      deleteCinemaVideo: (id) => {
        set((s) => ({ cinemaVideos: s.cinemaVideos.filter((v) => v.id !== id) }));
        deleteCinemaVideoRemote(id);
      },

      addScratchGame: (game) => {
        const id = makeId();
        const full: ScratchGame = { ...game, id, createdAt: new Date().toISOString() };
        set((s) => ({ scratchGames: [full, ...s.scratchGames] }));
        pushScratchGame(full);
        return id;
      },

      updateScratchGame: (id, patch) => {
        set((s) => ({ scratchGames: s.scratchGames.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
        const updated = get().scratchGames.find((g) => g.id === id);
        if (updated) pushScratchGame(updated);
      },

      deleteScratchGame: (id) => {
        set((s) => ({ scratchGames: s.scratchGames.filter((g) => g.id !== id) }));
        deleteScratchGameRemote(id);
      },

      addMusicTrack: (track) => {
        const id = makeId();
        const full: MusicTrack = { ...track, id, createdAt: new Date().toISOString() };
        set((s) => ({ musicTracks: [full, ...s.musicTracks] }));
        pushMusicTrack(full);
        return id;
      },

      updateMusicTrack: (id, patch) => {
        set((s) => ({ musicTracks: s.musicTracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
        const updated = get().musicTracks.find((t) => t.id === id);
        if (updated) pushMusicTrack(updated);
      },

      deleteMusicTrack: (id) => {
        set((s) => ({ musicTracks: s.musicTracks.filter((t) => t.id !== id) }));
        deleteMusicTrackRemote(id);
      },

      setPlayingTrackId: (id) => set({ playingTrackId: id }),

      addGalleryItem: (item) => {
        const id = makeId();
        const full: GalleryItem = { ...item, id, createdAt: new Date().toISOString() };
        set((s) => ({ galleryItems: [full, ...s.galleryItems] }));
        pushGalleryItem(full);
        return id;
      },

      updateGalleryItem: (id, patch) => {
        set((s) => ({ galleryItems: s.galleryItems.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
        const updated = get().galleryItems.find((g) => g.id === id);
        if (updated) pushGalleryItem(updated);
      },

      deleteGalleryItem: (id) => {
        set((s) => ({ galleryItems: s.galleryItems.filter((g) => g.id !== id) }));
        deleteGalleryItemRemote(id);
      },

      addSillyQuiz: (quiz) => {
        const id = makeId();
        const full: SillyQuiz = { ...quiz, id, createdAt: new Date().toISOString() };
        set((s) => ({ sillyQuizzes: [full, ...s.sillyQuizzes] }));
        pushSillyQuiz(full);
        return id;
      },

      updateSillyQuiz: (id, patch) => {
        set((s) => ({ sillyQuizzes: s.sillyQuizzes.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));
        const updated = get().sillyQuizzes.find((q) => q.id === id);
        if (updated) pushSillyQuiz(updated);
      },

      deleteSillyQuiz: (id) => {
        set((s) => ({ sillyQuizzes: s.sillyQuizzes.filter((q) => q.id !== id) }));
        deleteSillyQuizRemote(id);
      },

      postFarmerMarketOffer: (studentId, offeredItemId, wantsItemId) => {
        const id = makeId();
        const full: FarmerMarketOffer = { id, studentId, kind: 'catalog', offeredItemId, wantsItemId, status: 'open', createdAt: new Date().toISOString() };
        set((s) => ({ farmerMarketOffers: [full, ...s.farmerMarketOffers] }));
        pushFarmerMarketOffer(full);
        return id;
      },

      // Pet-for-pet barter — completes Part C's "pets... can be traded"
      // line. Same fairness rule as catalog trades, applied to PetRarity
      // instead of MarketplaceItemKind: wantsPetRarity is always derived
      // from the offered pet's own rarity, never a student's free choice,
      // so there's no way to post "give me something better."
      postPetTradeOffer: (studentId, offeredPetId) => {
        const pet = get().pets.find((p) => p.id === offeredPetId && p.studentId === studentId);
        const def = pet ? petDefById(pet.petDefId) : undefined;
        if (!pet || !def) return '';
        const id = makeId();
        const full: FarmerMarketOffer = { id, studentId, kind: 'pet', offeredItemId: offeredPetId, wantsPetRarity: rarityFor(def), status: 'open', createdAt: new Date().toISOString() };
        set((s) => ({ farmerMarketOffers: [full, ...s.farmerMarketOffers] }));
        pushFarmerMarketOffer(full);
        return id;
      },

      // No penalty, either party's own open offer only — matches the
      // "never punitive" standing rule (see PART D of the dev plan).
      withdrawFarmerMarketOffer: (id) => {
        set((s) => ({ farmerMarketOffers: s.farmerMarketOffers.filter((o) => o.id !== id) }));
        deleteFarmerMarketOfferRemote(id);
      },

      // The actual barter: swaps ownership of the two marketplace items
      // between the two students, the same owned-id-array mechanism
      // buying/spinning a marketplace item already uses. Re-validates both
      // sides still actually own what they're trading right before the
      // swap (circumstances can change between when an offer was posted
      // and when someone accepts it, since this is async/turn-based, not
      // a live session) rather than trusting stale state.
      //
      // Claudia's review (HIGH #1): local status checks alone can't stop
      // two students both tapping Accept on the same offer within the
      // realtime-sync latency window — acceptFarmerMarketOfferRemote does
      // a real conditional DB write (only succeeds if the row is still
      // 'open'), and only the caller that wins that race is allowed to
      // touch either student's owned items. The loser gets a plain-
      // language "someone already took this" message instead of silently
      // losing/duplicating an item.
      acceptFarmerMarketOffer: async (id, acceptingStudentId, acceptingPetId) => {
        const offer = get().farmerMarketOffers.find((o) => o.id === id);
        if (!offer || offer.status !== 'open') return { ok: false, reason: 'This offer is no longer available.' };
        if (offer.studentId === acceptingStudentId) return { ok: false, reason: "You can't accept your own offer." };
        const offering = get().students.find((s) => s.id === offer.studentId);
        const accepting = get().students.find((s) => s.id === acceptingStudentId);
        if (!offering || !accepting) return { ok: false, reason: 'Student not found.' };

        let ownedField: 'ownedFontIds' | 'ownedColorIds' | 'ownedVoiceIds' | undefined;
        if (offer.kind === 'catalog') {
          const offeredItem = get().marketplaceItems.find((m) => m.id === offer.offeredItemId);
          const wantsItem = get().marketplaceItems.find((m) => m.id === offer.wantsItemId);
          if (!offeredItem || !wantsItem || offeredItem.kind !== wantsItem.kind) {
            return { ok: false, reason: 'This trade is no longer valid.' };
          }
          ownedField = ({ font: 'ownedFontIds', color: 'ownedColorIds', voice: 'ownedVoiceIds' } as const)[offeredItem.kind as 'font' | 'color' | 'voice'];
          if (!ownedField) return { ok: false, reason: 'This item type cannot be traded.' };
          if (!offering[ownedField].includes(offer.offeredItemId)) return { ok: false, reason: `${offering.name} no longer has that item to trade.` };
          if (!accepting[ownedField].includes(offer.wantsItemId!)) return { ok: false, reason: "You don't have the item this trade is asking for." };
        } else {
          if (!acceptingPetId) return { ok: false, reason: 'Pick one of your own pets to trade first.' };
          const offeredPet = get().pets.find((p) => p.id === offer.offeredItemId);
          const acceptingPet = get().pets.find((p) => p.id === acceptingPetId);
          if (!offeredPet || offeredPet.studentId !== offer.studentId) return { ok: false, reason: `${offering.name} no longer has that pet to trade.` };
          if (!acceptingPet || acceptingPet.studentId !== acceptingStudentId) return { ok: false, reason: "That's not one of your pets." };
          const offeredDef = petDefById(offeredPet.petDefId);
          const acceptingDef = petDefById(acceptingPet.petDefId);
          if (!offeredDef || !acceptingDef || rarityFor(offeredDef) !== rarityFor(acceptingDef) || rarityFor(acceptingDef) !== offer.wantsPetRarity) {
            return { ok: false, reason: 'This trade needs a pet of the same rarity tier.' };
          }
        }

        let won = true;
        try {
          won = await acceptFarmerMarketOfferRemote(id, acceptingStudentId, offer.kind === 'pet' ? acceptingPetId : undefined);
        } catch {
          return { ok: false, reason: "Couldn't complete this trade right now, try again in a moment." };
        }
        if (!won) return { ok: false, reason: 'Someone else already took this trade.' };

        if (offer.kind === 'catalog' && ownedField) {
          get().updateStudent(offer.studentId, {
            [ownedField]: [...offering[ownedField].filter((x: string) => x !== offer.offeredItemId), offer.wantsItemId],
          } as Partial<Student>);
          get().updateStudent(acceptingStudentId, {
            [ownedField]: [...accepting[ownedField].filter((x: string) => x !== offer.wantsItemId!), offer.offeredItemId],
          } as Partial<Student>);
        } else if (offer.kind === 'pet' && acceptingPetId) {
          // Transfers ownership by reassigning studentId, not a
          // remove-and-recreate — the pet keeps its name, tint,
          // training progress, and learned tricks through the trade.
          // 'following' is forced off on both sides: it's meaningless
          // for a pet's NEW owner until they choose it themselves, and
          // leaving it on could put a student at their 4-pet follow cap
          // (setFollowingPet's own invariant) without them asking for it.
          set((s) => ({
            pets: s.pets.map((p) => {
              if (p.id === offer.offeredItemId) return { ...p, studentId: acceptingStudentId, following: false };
              if (p.id === acceptingPetId) return { ...p, studentId: offer.studentId, following: false };
              return p;
            }),
          }));
          const offeredPet = get().pets.find((p) => p.id === offer.offeredItemId);
          const acceptedPet = get().pets.find((p) => p.id === acceptingPetId);
          if (offeredPet) pushStudentPet(offeredPet);
          if (acceptedPet) pushStudentPet(acceptedPet);
        }

        const updated: FarmerMarketOffer = {
          ...offer,
          status: 'accepted',
          acceptedByStudentId: acceptingStudentId,
          acceptedWithPetId: offer.kind === 'pet' ? acceptingPetId : undefined,
          respondedAt: new Date().toISOString(),
        };
        // Claudia's review (MEDIUM #3): the offering student may have
        // other still-open offers for this SAME item — once it's traded
        // away, those would otherwise sit on the board as a dead offer no
        // one can ever complete, with no explanation. Auto-withdrawing
        // them keeps the board honest instead of leaving a silent dead end.
        // Claudia's follow-up review (this hour, MEDIUM #3 on the pet
        // extension): the ACCEPTING student can also spend a pet that's
        // the subject of one of their own other open offers — that side
        // wasn't covered by the filter above (it only looked at the
        // offer just accepted, not at whatever the acceptor gave up), so
        // that offer would dangle on the board showing a pet its poster
        // no longer owns. Folded into the same stale-offer sweep.
        const staleOfferIds = get()
          .farmerMarketOffers.filter((o) => {
            if (o.id === id || o.status !== 'open') return false;
            if (o.studentId === offer.studentId && o.offeredItemId === offer.offeredItemId) return true;
            if (offer.kind === 'pet' && acceptingPetId && o.studentId === acceptingStudentId && o.offeredItemId === acceptingPetId) return true;
            return false;
          })
          .map((o) => o.id);
        set((s) => ({
          farmerMarketOffers: s.farmerMarketOffers
            .filter((o) => !staleOfferIds.includes(o.id))
            .map((o) => (o.id === id ? updated : o)),
        }));
        pushFarmerMarketOffer(updated);
        staleOfferIds.forEach((staleId) => deleteFarmerMarketOfferRemote(staleId));
        return { ok: true };
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

      softDeleteAssignment: (id) => {
        const removed = get().assignments.find((a) => a.id === id);
        if (!removed) return;
        get().updateAssignment(id, { deletedAt: new Date().toISOString() });
        // Same as a real delete: stop showing it today rather than waiting
        // for tomorrow's daily refresh.
        const today = todayISO();
        if (removed.startDate <= today && today <= removed.endDate) {
          get().clearRotationIfNoLongerAssigned(removed.studentId, removed.subject);
        }
      },

      restoreAssignment: (id) => {
        const restored = get().assignments.find((a) => a.id === id);
        if (!restored) return;
        get().updateAssignment(id, { deletedAt: null });
        // If it's back inside its own active window, put it back on the
        // student's live plan immediately rather than waiting on them to
        // reload — mirrors how publishing a new assignment already works.
        const today = todayISO();
        if (restored.startDate <= today && today <= restored.endDate) {
          get().applyTemplateToStudent(restored.studentId, restored.templateId);
        }
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

      publishLiteracyFocusSet: (studentId, startDate, endDate, phonicsPatterns, morphemes, practiceWords) => {
        const overlapping = get().literacyFocusSets.find(
          (f) => f.studentId === studentId && f.startDate <= endDate && f.endDate >= startDate,
        );
        const set_: LiteracyFocusSet = {
          id: overlapping?.id ?? makeId(),
          studentId,
          startDate,
          endDate,
          phonicsPatterns,
          morphemes,
          practiceWords,
        };
        set((s) => ({
          literacyFocusSets: overlapping
            ? s.literacyFocusSets.map((f) => (f.id === set_.id ? set_ : f))
            : [...s.literacyFocusSets, set_],
        }));
        pushLiteracyFocusSet(set_);
      },

      deleteLiteracyFocusSet: (id) => {
        set((s) => ({ literacyFocusSets: s.literacyFocusSets.filter((f) => f.id !== id) }));
        deleteLiteracyFocusSetRemote(id);
      },
    }),
    { name: 'iwd-session', partialize: (s) => ({ currentStudentId: s.currentStudentId, role: s.role }) },
  ),
);

setSyncFailureHandler((label, message) => {
  useStore.setState({ syncTrouble: { at: Date.now(), label, message } });
});
