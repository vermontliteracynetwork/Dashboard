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
}

export type TaskType = 'quiz' | 'link' | 'offscreen' | 'video' | 'passage' | 'drill' | 'wordchain' | 'sentenceEdit';

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  quiz: 'Quiz (practice or checkpoint)',
  link: 'External link (review game, website)',
  offscreen: 'Off-screen / paper',
  video: 'Video (YouTube)',
  passage: 'Reading passage + questions',
  drill: 'Flashcard drill (facts, grapheme/morpheme, vocab)',
  wordchain: 'Word chain (word ladder)',
  sentenceEdit: 'Editing sentences',
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
  customSteps?: StepDef[]; // teacher override of the auto-generated visual step guide
  referenceImageUrl?: string; // shown to the student throughout this activity, any task type
  referenceLinkUrl?: string; // an extra reference link, any task type (distinct from the 'link' task type itself)
  referenceLinkLabel?: string;
  order?: number; // set = must be done in ascending order before any unordered task unlocks; unset = free-choice once all ordered tasks are done
  isDaily?: boolean; // teacher-marked "this repeats every day" — shown with a star in the library
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
}

export interface SubjectProgress {
  date: string; // ISO date this progress applies to
  activeIndex: number;
  completedTaskIds: string[];
  quizState: Record<string, QuizRuntimeState>; // taskId -> state
  sessionRitualSeen: boolean;
  subjectComplete: boolean;
  completedAt?: string; // ISO timestamp when subjectComplete first became true today — drives the timed Playground unlock
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

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
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
