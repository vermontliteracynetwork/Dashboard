// Mini machines from Claudia's Phase 1 scaffold plan (teacher 2026-10-07:
// "Keep building this out Claudia"). Science-flavored sentences.

// Homophone Sorter: words that sound the same but mean different things
// (L.3.2, L.4.2). Each word has a picture clue; the clue fades in later rounds.
export interface HomoItem { sentence: string; answer: string; choices: string[] }
export const HOMO_CLUES: Record<string, { pic: string; clue: string }> = {
  their: { pic: '👪', clue: 'belongs to them' }, there: { pic: '📍', clue: 'a place' }, "they're": { pic: '🫵', clue: 'they are' },
  to: { pic: '➡️', clue: 'toward' }, too: { pic: '➕', clue: 'also, or very' }, two: { pic: '2️⃣', clue: 'the number 2' },
  its: { pic: '🏷️', clue: 'belongs to it' }, "it's": { pic: '🟰', clue: 'it is' },
  your: { pic: '🎒', clue: 'belongs to you' }, "you're": { pic: '🫵', clue: 'you are' },
  than: { pic: '⚖️', clue: 'comparing' }, then: { pic: '⏭️', clue: 'next, after that' },
  hear: { pic: '👂', clue: 'with your ears' }, here: { pic: '📍', clue: 'this place' },
  know: { pic: '🧠', clue: 'understand' }, no: { pic: '🚫', clue: 'not yes' },
};
export const HOMO_ITEMS: HomoItem[] = [
  { sentence: 'The scientists packed ___ goggles.', answer: 'their', choices: ['their', 'there', "they're"] },
  { sentence: 'Put the beaker over ___ by the sink.', answer: 'there', choices: ['their', 'there', "they're"] },
  { sentence: '___ testing the magnets in the lab.', answer: "They're", choices: ['Their', 'There', "They're"] },
  { sentence: 'The marble rolled ___ the end of the ramp.', answer: 'to', choices: ['to', 'too', 'two'] },
  { sentence: 'We need ___ batteries for the robot.', answer: 'two', choices: ['to', 'too', 'two'] },
  { sentence: 'The water is ___ hot to touch.', answer: 'too', choices: ['to', 'too', 'two'] },
  { sentence: 'The robot lifted ___ arm.', answer: 'its', choices: ['its', "it's"] },
  { sentence: '___ time to start the experiment.', answer: "It's", choices: ['Its', "It's"] },
  { sentence: 'Is this ___ lab notebook?', answer: 'your', choices: ['your', "you're"] },
  { sentence: '___ the best engineer in the class!', answer: "You're", choices: ['Your', "You're"] },
  { sentence: 'The rocket is taller ___ the tower.', answer: 'than', choices: ['than', 'then'] },
  { sentence: 'Mix the powder, ___ add the water.', answer: 'then', choices: ['than', 'then'] },
  { sentence: 'Can you ___ the motor humming?', answer: 'hear', choices: ['hear', 'here'] },
  { sentence: 'Bring the magnet over ___.', answer: 'here', choices: ['hear', 'here'] },
  { sentence: 'Do you ___ how the pulley works?', answer: 'know', choices: ['know', 'no'] },
  { sentence: 'There is ___ air in the jar.', answer: 'no', choices: ['know', 'no'] },
];

// Transition Track: sentence cars couple only with the right kind of
// transition (W.4.2, W.5.2): adds, contrast, result, example, time order.
export type TransKind = 'adds' | 'contrast' | 'result' | 'example' | 'time';
export const TRANS_KINDS: Record<TransKind, { icon: string; name: string; words: string[] }> = {
  adds: { icon: '➕', name: 'Adds more', words: ['Also', 'In addition', 'Plus'] },
  contrast: { icon: '↔️', name: 'Shows a difference', words: ['However', 'But then', 'On the other hand'] },
  result: { icon: '➡️', name: 'Shows a result', words: ['As a result', 'So', 'Because of this'] },
  example: { icon: '🔍', name: 'Gives an example', words: ['For example', 'For instance'] },
  time: { icon: '⏱️', name: 'Time order', words: ['First', 'Next', 'Then', 'After that', 'Finally'] },
};
export interface TransItem { a: string; b: string; kind: TransKind }
export const TRANS_ITEMS: TransItem[] = [
  { a: 'The ice sat in the sun.', b: 'it melted into a puddle.', kind: 'result' },
  { a: 'Magnets pull on iron.', b: 'a magnet can pick up a paper clip.', kind: 'example' },
  { a: 'Plants need water.', b: 'they need sunlight.', kind: 'adds' },
  { a: 'The ramp was tall.', b: 'the marble rolled slowly.', kind: 'contrast' },
  { a: 'We built the circuit.', b: 'the bulb lit up.', kind: 'result' },
  { a: 'Some animals sleep all winter.', b: 'bears hibernate in caves.', kind: 'example' },
  { a: 'Mix the soil and the seeds.', b: 'water the pot.', kind: 'time' },
  { a: 'Metal is a good conductor.', b: 'plastic does not carry electricity.', kind: 'contrast' },
  { a: 'The robot can lift boxes.', b: 'it can sort them by color.', kind: 'adds' },
  { a: 'The wind blew hard.', b: 'the kite flew higher.', kind: 'result' },
  { a: 'Gather your tools.', b: 'start building the frame.', kind: 'time' },
  { a: 'Insects have six legs.', b: 'an ant has six legs.', kind: 'example' },
];
