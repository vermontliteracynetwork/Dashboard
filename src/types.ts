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
  tts: 'Text-to-Speech',
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
  ownedAvatarIds: string[]; // avatar catalog ids this student has unlocked/purchased
  ownedEmoteIds: string[]; // emote catalog ids this student has unlocked/purchased
  equippedEmoteId: string | null; // currently displayed emote, if any
  skipTokens: number; // "skip pass" count, purchased in the marketplace; lets a student cross off one task without doing it
  lastSpinDate: string | null; // ISO date of the last daily-wheel spin, so it's once per day
}

export type TaskType = 'quiz' | 'link' | 'offscreen' | 'video' | 'passage' | 'drill' | 'wordchain' | 'sentenceEdit' | 'article' | 'sentenceBuilder' | 'linkChoice';

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
};

export interface MCQuestion {
  id: string;
  kind: 'mc';
  prompt: string;
  imageUrl?: string;
  choices: string[];
  correctIndex: number;
}

export interface MatchingQuestion {
  id: string;
  kind: 'matching';
  prompt: string;
  imageUrl?: string;
  pairs: { left: string; right: string }[];
}

export interface FillBlankQuestion {
  id: string;
  kind: 'fill';
  prompt: string;
  imageUrl?: string;
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
  rewardCents?: number; // Class Cash paid out on completion; falls back to DEFAULT_TASK_REWARD_CENTS when unset
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
}

export type Rotation = Record<string, Record<Subject, Task[]>>; // studentId -> subject -> tasks

// A reusable activity, created once and dragged into any student's daily
// plan (which copies it into a fresh Task instance) or flagged for the
// shared Playground pool — the "create once, reuse everywhere" library.
export interface ActivityLibraryItem extends Task {
  subject: Subject;
  inPlayground: boolean;
  createdAt: string;
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

export type TransactionKind = 'task' | 'streak-interest' | 'spin-cashback' | 'spin-cash' | 'purchase-avatar' | 'purchase-emote' | 'purchase-skip' | 'achievement';

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
