export type Subject = 'math' | 'literacy';

export type ToolKey =
  | 'calculator'
  | 'tts'
  | 'wordProcessor'
  | 'breakVisual'
  | 'multiplicationTable'
  | 'hundredsChart'
  | 'numberLine'
  | 'thesaurus'
  | 'dictionary'
  | 'soundWall'
  | 'whiteboard';

export const SUBJECT_TOOLS: Record<Subject, ToolKey[]> = {
  math: ['multiplicationTable', 'hundredsChart', 'numberLine'],
  literacy: ['thesaurus', 'dictionary', 'soundWall'],
};

export const ACCESSIBILITY_TOOLS: ToolKey[] = ['calculator', 'tts', 'wordProcessor', 'whiteboard', 'breakVisual'];

export const ALL_TOOL_KEYS: ToolKey[] = [
  'calculator',
  'tts',
  'wordProcessor',
  'whiteboard',
  'breakVisual',
  'multiplicationTable',
  'hundredsChart',
  'numberLine',
  'thesaurus',
  'dictionary',
  'soundWall',
];

export const TOOL_LABELS: Record<ToolKey, string> = {
  calculator: 'Calculator',
  tts: 'Reading Settings',
  wordProcessor: 'Word Processor',
  whiteboard: 'Whiteboard',
  breakVisual: 'Quiet/Break Tool',
  multiplicationTable: 'Multiplication Table',
  hundredsChart: 'Hundreds Chart',
  numberLine: 'Number Line',
  thesaurus: 'Thesaurus',
  dictionary: 'Dictionary',
  soundWall: 'Sound Wall',
};

export interface TTSSettings {
  rate: number; // 0.5 - 1.5
  voiceURI: string | null;
}

// A teacher-added external link shown as its own tool button (e.g. Amplify,
// Polypad, or a curated research link) — opens in the internal browser like
// any other external activity.
export interface CustomTool {
  id: string;
  label: string;
  url: string;
  subject: Subject | 'both';
}

export interface Student {
  id: string;
  name: string;
  avatar: string; // emoji
  streak: number;
  lastCompletedDate: string | null; // ISO date, last day both subjects finished
  streakHidden: boolean;
  badgeIds: string[]; // earned badge defs (can repeat conceptually, but stored unique+count via BadgeEarn[])
  featureToggles: Record<ToolKey, boolean>;
  breakMinutes: number; // teacher-set default micro-break length (informational, not shown as a countdown to the student)
  ttsSettings: TTSSettings;
  createdAt: string;
  playgroundThreshold: number; // activities completed today needed to unlock the Playground (repeatable)
  customTools: CustomTool[]; // teacher-added external link tools (e.g. Amplify, Polypad, research links)
  coins: number; // marketplace currency, earned by completing tasks
  savingsGoalLabel: string | null; // what the student is saving up for, student-set, shown as a fill-meter in the Piggy Bank (Homeplot's Bank standard — concept-only saving, no interest math)
  savingsGoalCents: number | null; // the target balance for that goal
  countItOutEnabled: boolean; // teacher-set per student (Homeplot's Bank standard, Tier 1 skill): checkout requires tapping real bill/coin amounts up to the price instead of one Confirm tap — off by default, an explicit add-on, not everyone's normal checkout
  ownedAvatarIds: string[]; // avatar catalog ids this student has unlocked/purchased
  ownedEmoteIds: string[]; // emote catalog ids this student has unlocked/purchased
  equippedEmoteId: string | null; // currently displayed emote, if any
  skipTokens: number; // "skip pass" count, purchased in the marketplace; lets a student cross off one task without doing it
  lastSpinDate: string | null; // ISO date of the last daily-wheel spin, so it's once per day
  ownedFontIds: string[]; // font catalog ids unlocked for the Notes word processor
  equippedFontId: string | null;
  ownedColorIds: string[]; // marketplace color-item ids unlocked, any use (text/highlight/marker share one owned pool)
  equippedColorId: string | null; // active Notes TEXT color
  equippedHighlightColorId: string | null; // active Notes HIGHLIGHT (note background) color
  equippedMarkerColorId: string | null; // active Whiteboard marker color
  ownedVoiceIds: string[]; // voice catalog ids unlocked (read-aloud "voice skins")
  equippedVoiceId: string | null;
  ownedPrizeIds: string[]; // custom_prizes ids this student has redeemed (teacher-fulfilled real/in-game prizes)
  quizTheme: QuizTheme; // student-picked visual skin for the quiz view
  bonusSpinAvailable: boolean; // earned a re-spin today for finishing the whole assignment (assignmentCompletionReward type 'spin') — shown as a distinct "Bonus Spin!" on the wheel, cleared once used
  worldQuest1MetIds: string[]; // Neighbor ids met so far in Homeplot's launch quest ("Meet the Neighbors") — grows to 4, then the quest is complete
  favoriteCinemaVideoIds?: string[]; // CinemaVideo ids this student has hearted — shown first on the Now Showing shelf
  favoriteScratchGameIds?: string[]; // ScratchGame ids this student has hearted — shown first on the Arcade shelf
  lastMysteryPackOpenedDate?: string | null; // ISO date of the last Mystery Adoption Box open, one per real-world day — Claudia's audit (M3): the guaranteed-pull design is sound, but nothing stopped a same-sitting open-repeat loop before this
  worldMoveSensitivity: number; // Town Square movement-speed multiplier, student-adjustable in-world Settings (0.5-2, default 1)
  worldDpadSide: 'left' | 'right'; // which corner the on-screen D-pad sits in, student-adjustable
  worldNpcLastTalkDates: Record<string, string>; // NPC id -> ISO date of the last conversation that paid the daily talk coin, so each NPC pays at most once per real-world day
  worldJokesHeardIds: string[]; // joke ids ever collected into the Joke Book — permanent, never resets
  worldTalkRewardCents: number; // per-NPC daily talk coin amount; a teacher can set to 0 to turn off all NPC-talk payouts for a student without hiding the jokes/Joke Book
  worldShowArrivalCard: boolean; // teacher override for the Tier 0 daily arrival choice card — Claudia's full-game audit flagged that none of the guardrails tiers had a per-student off switch yet
  worldShowDeskGlow: boolean; // teacher override for the Tier 2 computer-desk glow/label
  // Creative Island — direct teacher spec: "Minecraft-style creative free
  // build," full catalog, full build-mode parity with the teacher, but
  // locked by default and only reachable once a teacher explicitly
  // unlocks it per student. Defaults false everywhere it's read.
  islandBuildUnlocked?: boolean;
  // Which changelog entry (see src/lib/changelog.ts) this student has
  // already seen — the "what's new" book auto-opens in Town Square the
  // moment this no longer matches the newest entry's id, then gets set to
  // it on close. undefined = never seen any entry (a brand-new student
  // sees the whole book the first time, same as everyone else).
  lastSeenChangelogId?: string | null;
  worldReduceMotion: boolean; // student/teacher-set in-app motion reduction (desk glow, etc.) independent of the OS-level prefers-reduced-motion setting, for a shared/school device a student can't change system settings on
  dyslexiaFont: boolean; // app-wide (not just Town Square) dyslexia-friendly display mode — a standing requirement in docs/NATIVE_GAME_STANDARD.md that had no actual toggle anywhere in the app until Claudia's full-game audit found the gap
  homeWallColor?: string; // Home Room paint bucket — hex color for the room's 4 walls; undefined = default
  homeFloorTexture?: string | null; // Home Room floor — a path from HOME_FLOOR_OPTIONS in HomeRoom.tsx; null/undefined = default
  houseExteriorPath?: string | null; // student-picked model path from HOUSE_EXTERIOR_OPTIONS in townLayout.ts — rendered on the shared 'home'-role building in Town Square whenever this student is the one viewing it; null/undefined = that building's own placed model (the teacher's default)
  // Pets system (Claudia's brainstorm, answered by direct teacher spec).
  // A brand-new student — or an existing one the first time pets ship —
  // has a one-time free-pet coupon: pick any catalog pet in the
  // Marketplace's Pets tab at no cost. Redeeming it (adoptPet's free path)
  // flips this true forever; never reset.
  petCouponRedeemed?: boolean;
  // Pet Journal (Claudia's collection-identity plan): every pet species
  // ever adopted, lifetime — added to on adoptPet, NEVER removed on
  // sellPet. This is what makes "collect them all" mean something even
  // though only 4 pets can be live-owned at once: a rehomed pet still
  // counts as discovered forever.
  discoveredPetDefIds?: string[];
  // Lifetime running total given to the Pet Shelter's free "donate"
  // action — a real prosocial/SEL beat, deliberately reward-free (no
  // coins, no items, no pet unlocked by donating) so it never quietly
  // becomes a second way to buy something.
  shelterDonationsCents?: number;
}

export type QuizTheme = 'standard' | 'pixel' | 'adventure' | 'fantasy';

export const QUIZ_THEME_LABELS: Record<QuizTheme, string> = {
  standard: 'Standard',
  pixel: 'Pixel',
  adventure: 'Adventure',
  fantasy: 'Fantasy',
};

export type TaskType = 'quiz' | 'link' | 'offscreen' | 'video' | 'passage' | 'drill' | 'wordchain' | 'sentenceEdit' | 'article' | 'sentenceBuilder' | 'linkChoice' | 'platformer';

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  quiz: 'Quiz (practice or checkpoint)',
  link: 'External link (review game, website)',
  offscreen: 'Off-screen / paper',
  video: 'Video (YouTube)',
  passage: 'Reading passage + questions',
  drill: 'Flashcard drill (facts, grapheme/morpheme, vocab)',
  wordchain: 'Word chain (word ladder)',
  sentenceEdit: 'Editing sentences',
  article: 'Article Reader (real web article, in-app)',
  sentenceBuilder: 'Sentence Builder (graphic organizer)',
  linkChoice: 'Pick One (2-4 video/link options, student chooses)',
  platformer: '🎮 Platformer Game + Quiz (Blooket-style homework)',
};

export interface MCQuestion {
  id: string;
  kind: 'mc';
  prompt: string;
  imageUrl?: string;
  // Set only when imageUrl carries real question content (e.g. "which
  // picture matches the word?") rather than decoration — Claudia's
  // quiz-mode audit: every question image rendered with alt="" even when
  // the image WAS the question, leaving a screen-reader-dependent student
  // with nothing. Teacher-authored, optional; falls back to empty (still
  // correct for a genuinely decorative image) when unset.
  imageAlt?: string;
  choices: string[];
  correctIndex: number;
}

export interface MatchingQuestion {
  id: string;
  kind: 'matching';
  prompt: string;
  imageUrl?: string;
  imageAlt?: string;
  pairs: { left: string; right: string }[];
}

export interface FillBlankQuestion {
  id: string;
  kind: 'fill';
  prompt: string;
  imageUrl?: string;
  imageAlt?: string;
  answer: string;
  wordBank?: string[];
}

export type QuizQuestion = MCQuestion | MatchingQuestion | FillBlankQuestion;

export interface QuizContent {
  questions: QuizQuestion[];
  shuffleQuestions?: boolean; // default true — a fresh random order each time the student starts this quiz
  shuffleAnswers?: boolean; // default false — randomize multiple-choice answer order each time a question is shown
}

export interface LinkContent {
  url: string;
  // Shows this activity inside the app in an iframe instead of the default
  // "opens in a new tab" card. Only works for sites that explicitly allow
  // being framed (most block it outright with X-Frame-Options/CSP) — e.g.
  // Scratch's own /embed project URLs (scratch.mit.edu/projects/<id>/embed).
  // Off by default so a teacher opts in per-activity, since turning it on
  // for a site that blocks framing just shows a blank box.
  embed?: boolean;
}

export interface OffscreenContent {
  instructions: string;
  photoRequired?: boolean; // student must upload a photo of their work before checking this off
}

export interface VideoContent {
  youtubeUrl: string;
  note?: string;
}

export interface PassageContent {
  title: string;
  text: string;
  imageUrl?: string;
}

// One extracted web article — clean text pulled server-side (Mozilla
// Readability), stripped of ads/nav/site chrome. sourceUrl is kept for a
// "view original" link and re-fetching; the rest is a frozen snapshot so a
// student's reading experience never changes mid-assignment even if the
// source page does.
export interface ArticleSnapshot {
  id: string;
  sourceUrl: string;
  title: string;
  byline?: string | null;
  siteName?: string | null;
  contentHtml: string;
  textContent: string;
  fetchedAt: string; // ISO
}

export interface ArticleTaskContent {
  articles: ArticleSnapshot[]; // 1 = single reader; 2+ = tabbed, one highlight color per tab
}

export interface Highlight {
  id: string;
  start: number; // character offset into textContent
  end: number;
  color: string;
  note?: string;
}

// One student's highlights+notes on one article within one task. Keyed by
// (studentId, taskId, articleIndex) rather than a synthetic id since a
// student only ever has one annotation set per article.
export interface ArticleAnnotationSet {
  studentId: string;
  taskId: string;
  articleIndex: number;
  highlights: Highlight[];
}

// One slot in a sentence-building graphic organizer. 'blank' is a
// student-filled part (colored, labeled, optionally with a tap-to-insert
// word bank so a non-independent typer can still build the sentence);
// 'connector' is a fixed joining word the teacher sets (e.g. "because",
// "and") that always appears as-is between blanks.
export interface SentencePart {
  id: string;
  kind: 'blank' | 'connector';
  label?: string; // blank only, e.g. "Who?"
  color?: string; // blank only
  placeholder?: string; // blank only, example text shown faded
  wordBank?: string[]; // blank only, optional tap-to-insert choices
  text?: string; // connector only, the fixed word(s)
}

export interface SentenceBuilderContent {
  parts: SentencePart[];
}

// One option in a "pick one" link/video choice task — the replacement for
// a whole-subject choice board, scoped to a single activity: 2-4 videos or
// links the student picks freely between, never required to do more than one.
export interface LinkChoiceOption {
  id: string;
  label: string;
  url: string;
  thumbnailUrl?: string; // auto-filled from a YouTube link; teacher can override/add for any other link
  durationLabel?: string; // free-text, e.g. "4:32" — teacher-entered, no reliable no-key API for real duration
  embed?: boolean; // see LinkContent.embed — only for non-YouTube urls (YouTube ones already embed automatically)
}

export interface LinkChoiceContent {
  prompt?: string; // optional instruction shown above the options, e.g. "Pick the one that sounds most interesting!"
  options: LinkChoiceOption[]; // 2-4
}

// One student's filled-in answers for one sentence-builder task, keyed by
// (studentId, taskId) — a student only ever has one in-progress/finished
// response per assignment of this task.
export interface SentenceBuilderResponse {
  studentId: string;
  taskId: string;
  answers: Record<string, string>; // SentencePart.id -> student's text
  updatedAt: string; // ISO
}

export interface DrillCard {
  id: string;
  front: string;
  back: string;
  imageUrl?: string;
}

export interface DrillContent {
  cards: DrillCard[];
}

export interface WordChainStep {
  id: string;
  hint: string;
  answer: string;
}

export interface WordChainContent {
  startWord: string;
  steps: WordChainStep[];
}

export interface SentenceEditContent {
  original: string;
  corrected: string;
  hint?: string;
}

// A single card in a teacher-authored (or auto-generated) visual "how to do this" guide.
export interface StepDef {
  id: string;
  icon: string; // emoji shown big
  imageUrl?: string;
  text: string;
}

// What completing an activity grants. Defaults to money (see Task.rewardCents)
// when unset — every task created before this existed keeps working exactly
// as it did.
export type TaskRewardType = 'money' | 'marketplaceItem' | 'customItem' | 'spin';
export interface TaskReward {
  type: TaskRewardType;
  itemId?: string; // type: 'marketplaceItem' — any item from the Marketplace, granted free (no charge)
  customName?: string; // type: 'customItem' — a one-off prize just for this activity, not listed in the Marketplace
  customIcon?: string; // type: 'customItem' — emoji shown in the student's transaction history
}

export interface Task {
  id: string;
  title: string;
  icon: string;
  type: TaskType;
  quiz?: QuizContent; // used by 'quiz', and as the attached comprehension questions on 'passage'
  link?: LinkContent;
  offscreen?: OffscreenContent;
  video?: VideoContent;
  passage?: PassageContent;
  drill?: DrillContent;
  wordchain?: WordChainContent;
  sentenceEdit?: SentenceEditContent;
  article?: ArticleTaskContent;
  sentenceBuilder?: SentenceBuilderContent;
  linkChoice?: LinkChoiceContent;
  customSteps?: StepDef[]; // teacher override of the auto-generated visual step guide
  referenceImageUrl?: string; // shown to the student throughout this activity, any task type
  referenceLinkUrl?: string; // an extra reference link, any task type (distinct from the 'link' task type itself)
  referenceLinkLabel?: string;
  order?: number; // set = must be done in ascending order before any unordered task unlocks; unset = free-choice once all ordered tasks are done
  isDaily?: boolean; // teacher-marked "this repeats every day" — shown with a star in the library
  isFinalCheck?: boolean; // teacher-marked "completing this marks the whole subject done" — unlocks Playground and updates the streak, instead of requiring every other activity to be checked off too. Typically a quiz.
  reward?: TaskReward; // what completing this grants; defaults to { type: 'money' } (see rewardCents) when unset
  rewardCents?: number; // Class Cash paid out on completion when reward is money-type (the default); falls back to DEFAULT_TASK_REWARD_CENTS when unset
  required?: boolean; // teacher-marked "cannot be skipped with a Skip Pass under any circumstances"
}

// Literacy Workspace — open-exploration sandbox (direct teacher
// instruction: no rungs, no mastery gating, no rewards, just a freeform
// canvas of draggable word pieces). A "word class" is a fixed lexical
// category (noun/verb/...); it is kept separate from grammatical ROLE
// (e.g. "subject") since the same noun is the same word class whether
// it's a subject or an object.
export type GrammarWordClass = 'noun' | 'verb';

export const GRAMMAR_WORD_CLASS_COLORS: Record<GrammarWordClass, string> = {
  noun: '#F6C445', // yellow — direct teacher spec: subject/who is always yellow
  verb: '#E4572E', // coral-red — distinct from the platform's flat error-red
};

export const GRAMMAR_WORD_CLASS_TEXT_COLORS: Record<GrammarWordClass, string> = {
  noun: '#241a05', // dark text on the yellow pastel fill (WCAG contrast)
  verb: '#241a05', // dark text on the saturated coral fill — Claudia's audit: white-on-coral read at ~3.68:1, below the WCAG 4.5:1 floor; this dark ink matches the noun tile's own text color and clears contrast comfortably
};

export const GRAMMAR_WORD_CLASS_LABELS: Record<GrammarWordClass, string> = {
  noun: 'Naming word (noun)',
  verb: 'Action word (verb)',
};

// One draggable piece on the open canvas. `number` is what the snap
// mechanic checks — a noun and a verb only click together when these
// match (subject-verb agreement), the one grammar rule the sandbox
// quietly enforces while everything else (which words, in what order)
// stays completely free.
export interface GrammarPiece {
  id: string;
  text: string;
  wordClass: GrammarWordClass;
  number: 'singular' | 'plural';
}

export type RotationMode = 'sequence' | 'choiceboard';

export interface QuestionSet {
  id: string;
  name: string;
  subject: Subject;
  kind: 'quiz' | 'drill';
  questions: QuizQuestion[]; // kind === 'quiz'
  cards: DrillCard[]; // kind === 'drill'
  coverImageUrl?: string; // shown on the library card; falls back to a kind icon when unset
  createdAt: string;
  tags?: string[]; // teacher-authored, for searching/filtering the Question Sets library
}

// A video shown in the in-world Cinema — either an external link (YouTube,
// same extractYouTubeId path VideoTask already uses) or a file the teacher
// uploaded straight to Supabase Storage. Unlimited replay, no task/mastery
// tracking attached — this is a pure watch-for-fun feature, not an
// assignment; a video someone should be graded on watching still belongs
// on a real Task with type 'video' instead.
export interface CinemaVideo {
  id: string;
  title: string;
  source: 'youtube' | 'upload';
  url: string; // a youtube.com/watch or youtu.be URL when source is 'youtube'; a Supabase Storage public URL when 'upload'
  coverImageUrl?: string; // teacher-uploaded poster shown on the Now Showing shelf; falls back to the YouTube auto-thumbnail when unset and source is 'youtube', or a generic icon otherwise
  createdAt: string;
  tags?: string[]; // teacher-authored, free-form (e.g. "Math", "Silly", "Calm-down") — so kids can search/filter the Cinema shelf, same pattern as QuestionSet tags
  durationSeconds?: number; // real length for an uploaded file (read from the file itself), or a teacher-entered estimate for a YouTube link (no API key configured to fetch it) — shown to students as "~N min" before they tap play
}

// Shown in the in-world Arcade — direct teacher request: her students are
// "obsessed with Scratch," and want a Cinema-style browse-and-play screen
// for MIT Scratch (scratch.mit.edu) projects. A teacher pastes any public
// project's URL; Scratch's own CDN serves a real thumbnail with no key or
// upload needed (see src/lib/scratch.ts), and the project plays inline via
// Scratch's own officially-supported embed path. Pure play-for-fun, same as
// Cinema: unlimited replay, no task/mastery tracking attached.
export interface ScratchGame {
  id: string;
  title: string;
  projectId: string; // the numeric id from a scratch.mit.edu/projects/<id> URL
  createdAt: string;
  tags?: string[]; // teacher-authored, free-form — same search/filter pattern as CinemaVideo.tags
}

export type Rotation = Record<string, Record<Subject, Task[]>>; // studentId -> subject -> tasks

// A reusable activity, created once and dragged into any student's daily
// plan (which copies it into a fresh Task instance) or flagged for the
// shared Playground pool — the "create once, reuse everywhere" library.
export interface ActivityLibraryItem extends Task {
  subject: Subject;
  inPlayground: boolean;
  createdAt: string;
  tags: string[]; // teacher-defined, free-form (e.g. "YouTube Video", "Baamboozle Game") — for filtering/search in the library
}

// A saved, named daily plan — a frozen snapshot of activities (not live
// references) so editing or deleting a library item later never breaks an
// existing template. Apply it to a student to instantiate fresh copies.
export interface PlanTemplate {
  id: string;
  name: string;
  subject: Subject;
  activities: Task[];
  createdAt: string;
}

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

export const WEEKDAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

export const WEEKDAY_LABELS: Record<DayOfWeek, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
};

export const WEEKDAY_SHORT: Record<DayOfWeek, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
};

// Which template (if any) auto-loads into a student's live daily plan for a
// given subject + weekday. Absence of an entry = no auto-plan that day (the
// teacher manages that day's plan by hand instead).
export interface WeeklyScheduleEntry {
  id: string; // `${studentId}:${subject}:${day}`
  studentId: string;
  subject: Subject;
  day: DayOfWeek;
  templateId: string;
}

// A published plan with a date window. 'repeat' reloads a fresh copy of
// the template into the student's live plan every day in the window
// (like a recurring daily checklist); 'span' loads it once, on the first
// day, and the student keeps working the same list — with progress
// carried forward day to day — until the window ends.
export interface Assignment {
  id: string;
  studentId: string;
  subject: Subject;
  templateId: string;
  startDate: string; // ISO date
  endDate: string; // ISO date; equals startDate for a single day
  mode: 'repeat' | 'span';
  applied: boolean; // 'span' only: whether the one-time copy into the live plan has happened yet
  deletedAt?: string | null; // ISO timestamp — set when soft-deleted (moved to the Deleted tab), null/unset = active
}

// A student's phonics/morpheme/spelling focus for a date window (typically
// a week) — shown to the student as a quick reference while they work on
// Literacy, and editable per-student by the teacher. Only one is "active"
// at a time per student (today's date falls inside its window); older ones
// are kept around as history rather than overwritten.
export interface LiteracyFocusSet {
  id: string;
  studentId: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  phonicsPatterns: string[]; // e.g. "-ild", "-ost" (long vowel VCC exceptions)
  morphemes: string[]; // e.g. "-ed", "-est"
  practiceWords: string[]; // spelling words combining the patterns/morphemes above
}

// A class-wide curriculum spotlight — Claudia's "Focuses" system (direct
// teacher request: a phonics pattern, a math strategy, a prefix/suffix
// set, a personal-finance topic, or an SEL skill the whole class is
// working on right now, shown simply on the teacher side and woven
// quietly into gameplay on the student side — never labeled to a student
// as "your weak spot," always framed as a shared class theme, per
// Claudia's population-risk guidance). Four independent lanes (one focus
// "current" per subject at a time, same one-active-at-a-time simplicity
// as LiteracyFocusSet above) rather than one combined list, since SEL and
// personal finance don't fit naturally under Math/Literacy.
export type FocusSubject = 'math' | 'literacy' | 'sel' | 'finance';

export const FOCUS_SUBJECT_LABELS: Record<FocusSubject, string> = {
  math: '🔢 Math',
  literacy: '📚 Literacy',
  sel: '💬 Social-Emotional',
  finance: '💰 Personal Finance',
};

// Suggested categories per lane — shown as dropdown options (plus a
// "Custom" free-text escape hatch) so the picker stays explicit/predictable
// without blocking a teacher from typing something not on the list.
export const FOCUS_CATEGORY_SUGGESTIONS: Record<FocusSubject, string[]> = {
  math: ['Math strategy', 'Fact fluency', 'Word problems', 'Measurement'],
  literacy: ['Phonics pattern', 'Prefix/suffix (affix)', 'Vocabulary', 'Word origins', 'Reading comprehension'],
  sel: ['Asking for help', 'Turn-taking', 'Emotional regulation', 'Following routines'],
  finance: ['Budgeting', 'Needs vs. wants', 'Saving', 'Earning'],
};

export type FocusDurationMode = 'days' | 'dateRange' | 'untilChanged';

export interface Focus {
  id: string;
  subject: FocusSubject;
  category: string; // one of FOCUS_CATEGORY_SUGGESTIONS[subject], or teacher-typed custom text
  title: string; // short label, e.g. "Silent-E Pattern"
  detail: string; // a sentence or two of specifics/example, e.g. "Words ending in a silent e, like cake, hope, five."
  wordList: string[]; // specific words/phrases tied to this focus (phonics/affix words, finance vocab) — used to seed gameplay content; empty = none set
  durationMode: FocusDurationMode;
  startDate: string; // ISO date, always set (today when created)
  endDate: string | null; // ISO date — set for 'days'/'dateRange' (computed at publish time); null while 'untilChanged' is still current
  createdAt: string; // ISO timestamp
}

export interface QuestionAttemptLog {
  questionId: string;
  timestamp: string;
  correct: boolean;
}

export interface QuizRuntimeState {
  remainingIds: string[]; // question ids still needing a correct answer, shuffled order
  masteredIds: string[];
  log: QuestionAttemptLog[];
  attemptStartedAt?: string; // ISO — when the CURRENT run through the queue began, for duration on the score record
}

// One finished run through a quiz — a student can retake a quiz any number
// of times, and each full pass (every question answered correctly at least
// once) logs its own record here for the teacher to see.
export interface QuizAttemptRecord {
  id: string;
  studentId: string;
  subject: Subject;
  taskId: string;
  taskTitle: string;
  startedAt: string; // ISO
  completedAt: string; // ISO
  durationMs: number;
  correctCount: number; // questions answered correctly on the first try this attempt
  totalCount: number;
}

export type TransactionKind =
  | 'task'
  | 'streak-interest'
  | 'spin-cashback'
  | 'spin-cash'
  | 'purchase-avatar'
  | 'purchase-emote'
  | 'purchase-skip'
  | 'achievement'
  | 'purchase-font'
  | 'purchase-color'
  | 'purchase-voice'
  | 'purchase-prize'
  | 'teacher-adjustment'
  | 'assignment-complete'
  | 'purchase-pet'
  | 'sell-pet'
  | 'purchase-yard'
  | 'donation';

// A teacher-defined bonus given the moment a student finishes their WHOLE
// assignment for the day (both Math and Literacy complete) — separate from
// the per-activity task reward. Exactly one of these at a time, class-wide.
export type AssignmentCompletionRewardType = 'coins' | 'marketplaceItem' | 'spin';
export interface AssignmentCompletionReward {
  type: AssignmentCompletionRewardType;
  amountCents?: number; // type: 'coins'
  itemId?: string; // type: 'marketplaceItem' — granted free, no charge
}

// One line in a student's bank register. amountCents is signed: positive
// for income (task rewards, interest, spin winnings), negative for a
// purchase. icon is either an emoji or an image URL (e.g. the avatar/emote
// art being bought), shown as the register-row thumbnail.
export interface Transaction {
  id: string;
  studentId: string;
  amountCents: number;
  description: string;
  icon: string;
  kind: TransactionKind;
  createdAt: string; // ISO
  voided?: boolean; // teacher removed this entry (reversed from the balance) but it stays in the register, struck through, for an audit trail
  // Purchases only — set from the optional, non-blocking "still want this
  // tomorrow?" cart reflection prompt (Homeplot's needs-vs-wants standard).
  // 'need': the student was confident it'll still matter tomorrow. 'want':
  // they weren't sure. Never required, never gates the purchase itself.
  needsWants?: 'need' | 'want';
}

// A teacher-placed object in the shared Town Square, from the World
// Editor's "build mode" (Sims/Minecraft-style: place, move, rotate, scale,
// tint, delete). Global/shared, not per-student — the whole point is that
// every student sees the same real, live town. Rendered by the same
// WorldObjectRenderer both the editor and the real student-facing scene
// use, so what a teacher builds is exactly what a student walks around in.
// Direct teacher instruction: "teachers (and students on creative island)
// can give roles including custom roles to any asset" — 'custom' is a
// free-form role, not one of the fixed built-in destinations: instead of
// routing to a hardcoded app screen (see ROLE_VIEWS in townLayout.ts), it
// opens WorldObject.customRoleUrl in the same internal browser a task's
// own external link already uses.
export type WorldObjectRole = 'bank' | 'store' | 'post-office' | 'welcome-center' | 'computer-desk' | 'home' | 'pet-shelter' | 'island-dock' | 'cinema' | 'arcade' | 'closed' | 'custom';
export interface WorldObject {
  id: string;
  modelPath: string; // from the generated asset manifest, e.g. '/world/models/city/streetLight.glb'
  label: string; // the asset's own generic name (from the manifest), e.g. "Street Light"
  customName?: string; // teacher-given name for this specific placed instance, e.g. "Bank" — shown to students as the building's label when set
  role?: WorldObjectRole; // if set, a student clicking this object opens the matching 2D view (same routing the 4 original buildings already use)
  customRoleUrl?: string; // only meaningful when role === 'custom' — the URL a click opens, in the same internal browser a task's own external link uses
  position: [number, number, number];
  rotationY: number; // radians
  scale: number; // uniform scale multiplier
  tintColor?: string; // hex color multiplied onto the model's material — the v1 "retexture" (arbitrary UV re-texturing is a later, bigger pass)
  // Whether this object blocks student/NPC movement (a real, generic-
  // circle obstacle in TownSquare's collision system). Undefined/false for
  // every object placed before this field existed — Claudia's explicit
  // guardrail against retroactively trapping a student under a building
  // placed back when nothing collided — so only NEWLY placed objects
  // default to colliding; an older object needs a teacher to opt it in.
  collides?: boolean;
  // undefined/null = a shared Town Square object (the teacher's WorldEditor
  // usage, everyone sees it); set to a Student.id = that student's own
  // private Home Room — same table, same sync plumbing, just scoped by
  // this field (this app has no per-row RLS anywhere, so filtering by
  // studentId happens client-side, same trust model every other table here
  // already uses).
  studentId?: string;
  createdAt: string; // ISO
  // Draft/publish for the shared Town Square (see docs on Build Mode's
  // Publish flow). Only meaningful when studentId is unset — a Home Room
  // object is always created 'published' and never enters this state.
  // undefined on an old row (created before this field existed) reads as
  // 'published', matching what students already see.
  status?: 'draft' | 'published';
  // A published object queued for removal — held back (still rendered to
  // students from publishedSnapshot) until Publish actually deletes it, so
  // Discard can still undo the deletion.
  pendingDelete?: boolean;
  // Captured the first time a currently-published object is touched in a
  // new draft cycle (add/move/resize/role/delete/...) — the pre-edit
  // values a student keeps seeing until Publish, and what Discard restores.
  // undefined = this object has no published version yet (created this
  // draft cycle) — Discard on it means "never existed."
  publishedSnapshot?: WorldObject;
  // Teacher-written body text for a sign/notice-board asset (see
  // SIGN_MODEL_PATHS in townLayout.ts) — double-click in Build Mode to
  // edit, tap in Town Square to read (with TTS).
  signText?: string;
  // Which of a student's own HomeRoomDef rows this piece of furniture/yard
  // décor belongs to (see HomeRoomDef below) — only meaningful alongside
  // studentId; a shared Town Square object never sets this. Undefined on a
  // row placed before the room system existed = still assigned to that
  // student's migrated default room the first time HomeRoom.tsx loads.
  roomId?: string;
}

// A single straight wall segment, drawn with Sims 4-style click-drag
// (start point, drag to end point, release) rather than placed as a whole
// pre-built model like every other WorldObject. Two endpoints, not a
// position+scale, since that's the one shape a wall actually needs — and
// it's the one surface a door/window WorldObject is allowed to be placed
// on (see WorldEditor.tsx's wall-proximity placement gate). Same
// studentId convention as WorldObject: undefined/null = shared Town
// Square, set = that student's own private Home Room.
export interface WallSegment {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  height: number;
  thickness: number;
  color?: string;
  studentId?: string;
  createdAt: string; // ISO
  // Same draft/publish convention as WorldObject — see its own field
  // comments for the full explanation. Only meaningful when studentId is
  // unset; a Home Room wall is always 'published'.
  status?: 'draft' | 'published';
  pendingDelete?: boolean;
  publishedSnapshot?: WallSegment;
}

// A patch of alternate ground texture painted over the base Town Square
// ground plane — the "grass/water mixed regions" ground-type system.
// Shared Town Square only (same live-instant behavior as the whole-map
// groundTexture/skyColor settings it extends, not part of the WorldObject/
// WallSegment draft/publish system — a scope this app can revisit if a
// teacher wants patches held back too).
export interface GroundPatch {
  id: string;
  x: number;
  z: number;
  radius: number; // meters — the painted circle's radius
  texturePath: string; // one of GROUND_TEXTURE_OPTIONS' real paths (never null — a Grass patch stores the literal grass.png path)
  createdAt: string; // ISO
}

// A student's own private Home Room floor plan is a set of these — replaces
// the old single fixed 10x10 room + freeform student-drawn walls. Each row
// is one discrete room (or the one 'yard' row every student gets), sized by
// its fixed `kind` (see HOME_ROOM_SIZES in HomeRoom.tsx: large 10x10,
// medium 8x8, small 6x6, xsmall 4x4, closet 1x2, yard 5x5) rather than a
// freely-resizable footprint — students place discrete rooms and decorate
// them, they don't draw wall geometry anymore. WorldObject.roomId scopes
// furniture/yard décor to one of these.
export type HomeRoomKind = 'large' | 'medium' | 'small' | 'xsmall' | 'closet' | 'yard';
export interface HomeRoomDef {
  id: string;
  studentId: string;
  kind: HomeRoomKind;
  name: string; // student-given or picked from HomeRoom.tsx's ROOM_NAME_SUGGESTIONS; defaults to a generic label at creation
  wallColor?: string | null; // per-room now, not per-student — undefined/null = default
  floorTexture?: string | null; // per-room now, not per-student — undefined/null = default
  createdAt: string; // ISO
}

// A teacher-made edit to one of the ORIGINAL fixed Town Square layout items
// (a building from BUILDINGS, a stall from MARKET_STALLS, a road tile, a
// decor/city prop — see townLayout.ts) — keyed by that item's own fixed id
// (e.g. 'bank', 'stall-1', 'main-st-0'). Kayden's explicit instruction:
// everything in the town should be deletable/movable/resizable/retintable
// from Build Mode, not just objects placed after the tool existed. Layered
// on top of the fixed layout data at render time (in both WorldEditor and
// the real TownSquare) rather than mutating townLayout.ts's own arrays, so
// "reset to the original town" is always just "clear the overrides."
export interface LayoutOverride {
  deleted?: boolean;
  position?: [number, number]; // x,z — matches the layout arrays' own 2-tuple convention (always y=0)
  rotationY?: number;
  scale?: number;
  tintColor?: string;
}

export interface SubjectProgress {
  date: string; // ISO date this progress applies to
  activeIndex: number;
  completedTaskIds: string[];
  quizState: Record<string, QuizRuntimeState>; // taskId -> state
  sessionRitualSeen: boolean;
  subjectComplete: boolean;
  completedAt?: string; // ISO timestamp when subjectComplete first became true today — drives the timed Playground unlock
  skippedTaskIds: string[]; // subset of completedTaskIds crossed off with a Skip Pass instead of actually done — kept visible to the teacher, not hidden
}

export type ProgressMap = Record<string, Record<Subject, SubjectProgress>>; // studentId -> subject -> progress

export interface BreakRequest {
  id: string;
  studentId: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'denied' | 'granted';
}

export interface HelpPing {
  id: string;
  studentId: string;
  timestamp: string;
  resolved: boolean;
}

// A question a student got wrong three times in a row and that the quiz
// engine has now permanently retired for this attempt (see
// submitQuizAnswer's 2-retry cap) — flagged here so the teacher actually
// finds out, instead of the question just quietly disappearing. Claudia's
// quiz-mode audit: the retry-cap-and-fallback principle already written
// for native games (docs/NATIVE_GAME_STANDARD.md) applies just as much to
// the shared quiz engine, since both go through the same function.
export interface QuizStruggle {
  id: string;
  studentId: string;
  subject: Subject;
  taskId: string;
  taskTitle: string;
  questionPrompt: string;
  timestamp: string;
  resolved: boolean;
}

// A student's owned pet instance — PetDef in lib/petCatalog.ts is the
// static catalog (model/price/category); this is the per-student row: one
// per adopted pet, up to PET_OWNERSHIP_CAP each. Direct teacher spec: pets
// live at Home, gain a trainable "walk beside you" unlock from ordinary
// task completion (not from care actions), and have soft food/social/
// health needs that only fall while the student is actively in the world
// — never while they're away, and never to zero ("pets never die").
export interface StudentPet {
  id: string;
  studentId: string;
  petDefId: string; // PET_CATALOG entry id
  customName: string; // student-given name, defaults to the catalog pet's own name at adoption
  acquiredAt: string; // ISO
  following: boolean; // this pet is the one companion walking beside the student right now — at most one true per student, enforced by setFollowingPet
  trainingProgress: number; // task completions logged since adoption; canFollowPet() in petCatalog.ts gates the "walk beside" unlock on this
  food: number; // 0-100, soft floor (never 0)
  social: number; // 0-100, soft floor
  health: number; // 0-100, soft floor — falls only as a consequence of food/social running low, not decayed independently
}

// A student's own feedback about the game, submitted through the
// structured, quiz-like Feedback tool (not free-typed cold) — designed
// specifically for students with communication disorders: pick a category,
// drill down as far as it goes (Game Play -> Build Mode -> Asset to add,
// for instance), then explain in their own words, typed or spoken.
// category is the top-level pick; subcategoryLabel is a plain-language
// breadcrumb of every step taken after that (e.g. "Build Mode > Asset to
// add") so a teacher reading the inbox sees the whole path at a glance
// without a lookup table. customLabel only exists for category 'other',
// where the student names their own category instead of picking one.
export interface StudentFeedback {
  id: string;
  studentId: string;
  category: 'gameplay' | 'visuals' | 'assignments' | 'other' | 'wishlist';
  subcategoryLabel?: string;
  customLabel?: string;
  text: string;
  createdAt: string;
  resolved: boolean;
}

// A single teacher<->student chat message, opened from a help ping (or any
// time from either side). One flat list per student — small classrooms
// don't need threading, just "everything said with this student."
export interface ChatMessage {
  id: string;
  studentId: string;
  sender: 'student' | 'teacher';
  text: string;
  createdAt: string;
}

// One saved document in a student's Notes word processor — replaces the
// old single scratchText blob with real, named, independently
// saved/edited/deleted notes, the way a simple native notes app works.
export interface Note {
  id: string;
  studentId: string;
  title: string;
  body: string; // plain-text mirror of bodyHtml, kept in sync — used for word count and read-aloud
  bodyHtml?: string; // rich content: lets a student color-code individual words/phrases (multiple text/highlight colors in one note), not just one color for the whole note. Falls back to plain `body` for notes saved before this existed.
  fontId: string | null; // null = use whatever's currently equipped
  colorId: string | null; // default text color for anything not individually colored
  highlightColorId: string | null; // default note background/highlight color
  updatedAt: string;
  // Personal Journal (direct teacher instruction: "personal journal should
  // be option, word processor should be base, think of a diary") — a
  // journal entry is just a Note with kind 'journal': same rich-text editor,
  // same storage, only the creation flow differs (auto-dated title, a
  // diary-style empty-state prompt). undefined on every note saved before
  // this existed, treated the same as 'note'.
  kind?: 'note' | 'journal';
}

// Every non-character, non-emote thing a student can buy — a font, a text
// color, a read-aloud voice skin, a power-up (Skip Pass), or an open-ended
// prize ("10 minutes free time," "a pet," a real-life item the teacher
// hands over). Fully teacher-authored: name, icon, price, category, tags,
// and an optional date window for seasonal/limited-time items — nothing
// about the marketplace's economic items is hardcoded in the app.
export type MarketplaceItemKind = 'font' | 'color' | 'voice' | 'powerup' | 'prize';

export interface MarketplaceItem {
  id: string;
  kind: MarketplaceItemKind;
  name: string;
  icon: string; // emoji, or an uploaded image URL
  price: number; // Class Cash, in cents
  category: string; // teacher-defined, free-form (e.g. "Free Time", "Pets", "Tools", "Seasonal")
  tags: string[]; // teacher-defined, free-form
  description?: string;
  availableFrom?: string | null; // ISO date (yyyy-mm-dd) — null/undefined = always available
  availableUntil?: string | null; // ISO date (yyyy-mm-dd), inclusive
  createdAt: string;
  // kind: 'font' only
  cssFontFamily?: string;
  // kind: 'color' only — a CSS color, or the literal 'rainbow' for the animated swatch
  colorHex?: string;
  // kind: 'color' only — which surface this color equips to; defaults to
  // 'text' when absent (keeps older color items working unchanged)
  colorUse?: 'text' | 'highlight' | 'marker';
  // kind: 'voice' only — layered on top of the student's TTS rate/voice settings
  voicePitch?: number;
  voiceRate?: number;
  voiceHints?: string[];
}

export interface OffscreenReview {
  id: string;
  studentId: string;
  subject: Subject;
  taskId: string;
  taskTitle: string;
  timestamp: string;
  verified: boolean;
  photoUrl?: string; // student-uploaded photo evidence, if the task required one
}

// A condition that auto-awards a badge once true and not already earned.
// "constraint" (an optional subject filter) narrows what counts toward the
// threshold — e.g. only Math activities, only Literacy final checks.
export type BadgeRuleType =
  | 'streak' // current streak reaches N days
  | 'tasksCompletedTotal' // lifetime activities completed (any subject) reaches N
  | 'tasksCompletedToday' // activities completed today reaches N
  | 'subjectsCompletedTotal' // lifetime count of "fully finished a subject for the day" reaches N
  | 'finalChecksPassed' // lifetime count of Final Check activities passed reaches N
  | 'toolsUsed' // distinct tools ever opened reaches N
  | 'correctionsMade'; // missed-then-corrected quiz questions, lifetime, reaches N

export const BADGE_RULE_LABELS: Record<BadgeRuleType, string> = {
  streak: 'Streak reaches (days)',
  tasksCompletedTotal: 'Lifetime activities completed reaches',
  tasksCompletedToday: 'Activities completed today reaches',
  subjectsCompletedTotal: 'Times a subject was fully finished (lifetime) reaches',
  finalChecksPassed: 'Final Checks passed (lifetime) reaches',
  toolsUsed: 'Distinct tools used reaches',
  correctionsMade: 'Missed-then-corrected questions (lifetime) reaches',
};

// Rule types where a subject constraint is meaningful.
export const BADGE_RULE_SUBJECT_AWARE: BadgeRuleType[] = ['tasksCompletedToday', 'subjectsCompletedTotal', 'finalChecksPassed'];

export interface BadgeRule {
  type: BadgeRuleType;
  threshold: number; // the "N" — if [metric] >= threshold, then award
  subject?: Subject; // constraint: only count this subject (ignored for rule types that aren't subject-aware)
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  rule?: BadgeRule; // present = auto-awarded when the condition is met; absent = teacher awards it by hand (unchanged existing behavior)
  rewardCents?: number; // Class Cash paid into Piggy Bank when earned; falls back to DEFAULT_BADGE_REWARD_CENTS when unset
}

export interface BadgeEarn {
  id: string;
  studentId: string;
  badgeId: string;
  date: string;
}

export interface BreakPoolItem {
  id: string;
  title: string;
  kind: 'text' | 'link';
  value: string;
  studentId?: string; // undefined = shared pool
}

export type StudentStatus = 'not-started' | 'working' | 'on-break' | 'awaiting-approval' | 'done-for-day';
