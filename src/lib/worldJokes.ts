// A static lookup of every joke's Joke Book entry, keyed by jokeId — built
// from the same dialogue data the conversation engine already walks, so a
// joke's text lives in exactly one place (its ConversationStep) instead of
// being duplicated into a separate catalog. A student's Joke Book is just
// their worldJokesHeardIds looked up against this.
import { QUEST1_NEIGHBORS, type ConversationStep } from './worldQuest1';
import { TOWNSPEOPLE } from './worldTownspeople';

export interface JokeBookEntry {
  npcName: string;
  setup: string;
  punchline: string;
  explain: string;
}

function collectJokes(dialogues: ConversationStep[][]): Record<string, JokeBookEntry> {
  const out: Record<string, JokeBookEntry> = {};
  for (const steps of dialogues) {
    for (const step of steps) {
      if (step.jokeId && step.jokeBookEntry) out[step.jokeId] = step.jokeBookEntry;
    }
  }
  return out;
}

export const ALL_JOKES: Record<string, JokeBookEntry> = collectJokes([
  ...QUEST1_NEIGHBORS.map((n) => n.dialogue),
  ...Object.values(TOWNSPEOPLE).map((t) => t.dialogue),
]);
