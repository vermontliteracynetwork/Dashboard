export type Subject = 'math' | 'literacy';

export type ToolKey =
  | 'calculator'
  | 'tts'
  | 'wordProcessor'
  | 'breakVisual'
  | 'multiplicationTable'
  | 'hundredsChart'
  | 'thesaurus'
  | 'dictionary'
  | 'soundWall';

export const SUBJECT_TOOLS: Record<Subject, ToolKey[]> = {
  math: ['multiplicationTable', 'hundredsChart'],
  literacy: ['thesaurus', 'dictionary', 'soundWall'],
};

export const ACCESSIBILITY_TOOLS: ToolKey[] = ['calculator', 'tts', 'wordProcessor', 'breakVisual'];

export const ALL_TOOL_KEYS: ToolKey[] = [
  'calculator',
  'tts',
  'wordProcessor',
  'breakVisual',
  'multiplicationTable',
  'hundredsChart',
  'thesaurus',
  'dictionary',
  'soundWall',
];

export const TOOL_LABELS: Record<ToolKey, string> = {
  calculator: 'Calculator',
  tts: 'Text-to-Speech',
  wordProcessor: 'Word Processor',
  breakVisual: 'Quiet/Break Tool',
  multiplicationTable: 'Multiplication Table',
  hundredsChart: 'Hundreds Chart',
  thesaurus: 'Thesaurus',
  dictionary: 'Dictionary',
  soundWall: 'Sound Wall',
};

export interface TTSSettings {
  rate: number; // 0.5 - 1.5
  voiceURI: string | null;
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
}

export type TaskType = 'quiz' | 'link' | 'offscreen';

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
}

export interface LinkContent {
  url: string;
}

export interface OffscreenContent {
  instructions: string;
}

export interface Task {
  id: string;
  title: string;
  icon: string;
  type: TaskType;
  quiz?: QuizContent;
  link?: LinkContent;
  offscreen?: OffscreenContent;
}

export type Rotation = Record<string, Record<Subject, Task[]>>; // studentId -> subject -> tasks

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
