import type { Task, StepDef, TaskType } from '../types';

const DEFAULT_STEPS: Record<TaskType, Omit<StepDef, 'id'>[]> = {
  quiz: [
    { icon: '👀', text: 'Read the question' },
    { icon: '👉', text: 'Pick your answer' },
    { icon: '✅', text: 'Tap to check' },
    { icon: '🔁', text: "If it's tricky, try again!" },
  ],
  link: [
    { icon: '🚀', text: 'Tap Open Activity' },
    { icon: '🎮', text: 'Do the activity' },
    { icon: '🔙', text: 'Come back to this tab' },
    { icon: '✅', text: 'Tap "I did it!"' },
  ],
  offscreen: [
    { icon: '👀', text: 'Read what to do' },
    { icon: '✏️', text: 'Do it away from the screen' },
    { icon: '✅', text: 'Tap "I did it!"' },
  ],
  video: [
    { icon: '▶️', text: 'Tap play' },
    { icon: '👀', text: 'Watch the whole video' },
    { icon: '✅', text: 'Tap "I watched it!"' },
  ],
  passage: [
    { icon: '📖', text: 'Read the passage' },
    { icon: '🤔', text: 'Think about what it means' },
    { icon: '✅', text: 'Answer the questions' },
  ],
  drill: [
    { icon: '👀', text: 'Look at the card' },
    { icon: '💭', text: 'Think of your answer' },
    { icon: '🔄', text: 'Flip to check' },
    { icon: '➡️', text: 'Tap next' },
  ],
  wordchain: [
    { icon: '🔤', text: 'Look at the word' },
    { icon: '🧩', text: 'Change it to match the clue' },
    { icon: '✅', text: 'Check your answer' },
    { icon: '➡️', text: 'Keep going down the chain' },
  ],
  sentenceEdit: [
    { icon: '👀', text: 'Read the sentence' },
    { icon: '🔍', text: 'Find the mistake' },
    { icon: '✏️', text: 'Fix it' },
    { icon: '✅', text: 'Check your work' },
  ],
};

export function getTaskSteps(task: Task): StepDef[] {
  if (task.customSteps && task.customSteps.length > 0) return task.customSteps;
  return DEFAULT_STEPS[task.type].map((s, i) => ({ ...s, id: `${task.type}-default-${i}` }));
}
