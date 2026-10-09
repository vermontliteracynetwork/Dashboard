// Gus's Checkup (Claudia's audit: "Gus's Checkup, an optional baseline", Build Queue 2026-10-09).
// Ten quick "which one is right?" items, one per skill, no hints and no right or wrong shown during
// it, so the teacher gets a clean baseline. Results go in the teacher report, never ranked.

export interface CheckItem { skill: string; ask: string; right: string; wrong: string[] }
export const CHECKUP: CheckItem[] = [
  { skill: 'Capital letter at the start', ask: 'Which sentence is written right?', right: 'The cat ran home.', wrong: ['the cat ran home.', 'The Cat ran home.'] },
  { skill: 'End punctuation', ask: 'Which sentence is written right?', right: 'My dog likes the park.', wrong: ['My dog likes the park', 'My dog. likes the park'] },
  { skill: 'Who and action match', ask: 'Which sentence sounds right?', right: 'The birds sing.', wrong: ['The birds sings.', 'The bird sing.'] },
  { skill: 'Past', ask: 'Which sentence tells about the past?', right: 'We jumped over the log.', wrong: ['We jump over the log.', 'We will jump over the log.'] },
  { skill: 'More than one', ask: 'Which sentence is right?', right: 'Three mice ate the cheese.', wrong: ['Three mouses ate the cheese.', 'Three mouse ate the cheese.'] },
  { skill: 'a and an', ask: 'Which sentence is right?', right: 'I ate an apple.', wrong: ['I ate a apple.', 'I ate an banana.'] },
  { skill: 'I, he and she or me, him and her', ask: 'Which sentence is right?', right: 'She gave the book to me.', wrong: ['Her gave the book to me.', 'She gave the book to I.'] },
  { skill: 'Comma before but, so and and', ask: 'Which sentence is written right?', right: 'It was raining, so we stayed inside.', wrong: ['It was raining so, we stayed inside.', 'It was, raining so we stayed inside.'] },
  { skill: 'Whole sentences (no run-ons)', ask: 'Which one is written right?', right: 'The dog barked. The cat ran away.', wrong: ['The dog barked the cat ran away.', 'The dog barked, the cat ran away'] },
  { skill: 'Whole sentences (no fragments)', ask: 'Which one is a whole sentence?', right: 'The robot fixed the lamp.', wrong: ['Fixed the lamp.', 'The robot in the lab.'] },
];
