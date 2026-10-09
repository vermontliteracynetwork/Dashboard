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

// Fusion Reactor (Claudia's Phase 2 writing machines, Build Queue 2026-10-09): 2 or 3 short
// sentences go in, the repeated words get crushed, and one smooth sentence rolls out. [Brackets]
// mark the repeated words to crush. kind: what the fusion teaches.
export type FusionKind = 'describe' | 'who' | 'did' | 'what';
export const FUSION_KINDS: Record<FusionKind, { icon: string; name: string; tip: string }> = {
  describe: { icon: '🎨', name: 'Describing word moves in', tip: 'A describing word from "is" sentences moves right in front of its noun.' },
  who: { icon: '👥', name: 'Two whos, one action', tip: 'Two whos doing the same action share it: and joins them, and the action word changes to match more than one.' },
  did: { icon: '⚙️', name: 'One who, two actions', tip: 'One who doing two actions keeps the who once: and joins the actions.' },
  what: { icon: '📦', name: 'One action, two things', tip: 'The same action on two things: and joins the things.' },
};
export interface FusionItem { kind: FusionKind; sentences: string[]; result: string; wrong: string[] }
export const FUSION_ITEMS: FusionItem[] = [
  { kind: 'describe', sentences: ['The dog barks.', '[The] [dog] [is] fluffy.'], result: 'The fluffy dog barks.', wrong: ['The dog fluffy barks.', 'The dog is fluffy barks.'] },
  { kind: 'describe', sentences: ['The robot zooms.', '[The] [robot] [is] tiny.'], result: 'The tiny robot zooms.', wrong: ['The robot tiny zooms.', 'The robot zooms tiny is.'] },
  { kind: 'describe', sentences: ['The cat sleeps on the mat.', '[The] [cat] [is] orange.'], result: 'The orange cat sleeps on the mat.', wrong: ['The cat sleeps on the orange mat.', 'The cat orange sleeps on the mat.'] },
  { kind: 'describe', sentences: ['A dragon eats the pizza.', '[The] [pizza] [is] giant.'], result: 'A dragon eats the giant pizza.', wrong: ['A giant dragon eats the pizza.', 'A dragon eats the pizza giant.'] },
  { kind: 'describe', sentences: ['The frog jumps.', '[The] [frog] [is] green.', '[The] [frog] [jumps] over the log.'], result: 'The green frog jumps over the log.', wrong: ['The frog jumps over the green log.', 'The green frog jumps. The frog jumps over the log.'] },
  { kind: 'who', sentences: ['The cat naps.', 'The dog [naps].'], result: 'The cat and the dog nap.', wrong: ['The cat and the dog naps.', 'The cat naps the dog naps.'] },
  { kind: 'who', sentences: ['Mia dances.', 'Leo [dances].'], result: 'Mia and Leo dance.', wrong: ['Mia and Leo dances.', 'Mia dances and Leo.'] },
  { kind: 'who', sentences: ['The robot sings.', 'The goat [sings].', 'The chef [sings].'], result: 'The robot, the goat and the chef sing.', wrong: ['The robot the goat the chef sings.', 'The robot, the goat and the chef sings.'] },
  { kind: 'did', sentences: ['Gus jumps.', '[Gus] spins.'], result: 'Gus jumps and spins.', wrong: ['Gus jumps and Gus.', 'Gus jumps spins.'] },
  { kind: 'did', sentences: ['The puppy runs.', '[The] [puppy] barks.'], result: 'The puppy runs and barks.', wrong: ['The puppy runs and the barks.', 'The puppy and barks runs.'] },
  { kind: 'did', sentences: ['The chef cooks.', '[The] [chef] tastes.', '[The] [chef] dances.'], result: 'The chef cooks, tastes and dances.', wrong: ['The chef cooks tastes dances.', 'The chef cooks and the chef tastes and dances.'] },
  { kind: 'what', sentences: ['Mia eats pizza.', '[Mia] [eats] tacos.'], result: 'Mia eats pizza and tacos.', wrong: ['Mia eats pizza and Mia tacos.', 'Mia and tacos eats pizza.'] },
  { kind: 'what', sentences: ['The goat chews a sock.', '[The] [goat] [chews] a shoe.'], result: 'The goat chews a sock and a shoe.', wrong: ['The goat chews a sock and chews.', 'The goat and a shoe chews a sock.'] },
  { kind: 'what', sentences: ['Leo kicks the ball.', '[Leo] [kicks] the can.'], result: 'Leo kicks the ball and the can.', wrong: ['Leo kicks the ball and Leo the can.', 'Leo and the can kicks the ball.'] },
];

// Revision Workshop (Claudia's Phase 2, ARMS: Add, Remove, Move, Substitute; Build Queue
// 2026-10-09). Each job is a rough paragraph with one weak spot and the tool that fixes it.
//  s: the sentence. w: the word (swap, and remove when one word repeats). options: the first one is
//  right. to: where a moved sentence belongs. ask: what the added detail must tell.
export type ArmsTool = 'add' | 'remove' | 'move' | 'swap';
export const ARMS_TOOLS: Record<ArmsTool, { icon: string; name: string; does: string }> = {
  add: { icon: '🔧', name: 'Add', does: 'The wrench adds a detail: where, when or how.' },
  remove: { icon: '✂️', name: 'Remove', does: 'The cutter trims a repeat or something that does not belong.' },
  move: { icon: '🏗️', name: 'Move', does: 'The crane moves a sentence to the right spot.' },
  swap: { icon: '🔄', name: 'Swap', does: 'The swap arm trades a dull word for a precise one.' },
};
export interface RevisionItem { tool: ArmsTool; sentences: string[]; s: number; w?: number; options?: string[]; to?: number; ask?: string; why: string }
export const REVISION_ITEMS: RevisionItem[] = [
  { tool: 'swap', sentences: ['We made soup for lunch.', 'The soup was good.', 'Everyone asked for more.'], s: 1, w: 3, options: ['delicious', 'speedy', 'rusty'], why: '"Delicious" tells exactly how the soup tasted.' },
  { tool: 'swap', sentences: ['The race started.', 'Leo went to the finish line.', 'He won a shiny medal.'], s: 1, w: 1, options: ['sprinted', 'yawned', 'whispered'], why: '"Sprinted" shows how fast Leo moved in a race.' },
  { tool: 'swap', sentences: ['The storm was big.', 'Thunder shook the windows.', 'We hid under a blanket.'], s: 0, w: 3, options: ['enormous', 'tiny', 'sleepy'], why: '"Enormous" is a stronger way to say very big.' },
  { tool: 'swap', sentences: ['The dragon looked at the knight.', 'The knight held up a pizza.', 'The dragon smiled.'], s: 0, w: 2, options: ['glared', 'sneezed', 'tiptoed'], why: '"Glared" shows the dragon looked in an angry way.' },
  { tool: 'remove', sentences: ['My dog loves the park.', 'He chases every ball.', 'My dog loves the park.'], s: 2, why: 'That sentence said the same thing twice.' },
  { tool: 'remove', sentences: ['The robot rolled into the lab.', 'It fixed the the broken lamp.', 'The lights came on.'], s: 1, w: 3, why: 'The word "the" was there twice in a row.' },
  { tool: 'remove', sentences: ['We planted seeds in the garden.', 'My favorite color is blue.', 'Soon, little sprouts popped up.'], s: 1, why: 'That sentence is not about the garden, so it does not belong.' },
  { tool: 'move', sentences: ['Finally, we ate the cake.', 'First, we mixed the batter.', 'Next, we baked it.'], s: 0, to: 2, why: '"Finally" tells what happened last, so it goes at the end.' },
  { tool: 'move', sentences: ['Then, the frog jumped into the pond.', 'First, the frog sat on a log.', 'Last, it swam away.'], s: 1, to: 0, why: '"First" goes at the beginning.' },
  { tool: 'move', sentences: ['First, Gus pulled the lever.', 'In the end, the movie played.', 'Next, the marble rolled.'], s: 1, to: 2, why: '"In the end" means it comes last.' },
  { tool: 'add', sentences: ['The cat sat.', 'It purred happily.', 'Then it fell asleep.'], s: 0, ask: 'where', options: ['on the warm windowsill', 'very quickly', 'yesterday'], why: '"On the warm windowsill" tells where the cat sat.' },
  { tool: 'add', sentences: ['The goat ate a sock.', 'Mia laughed.', 'The goat burped.'], s: 0, ask: 'how', options: ['very loudly', 'in the barn', 'at noon'], why: '"Very loudly" tells how the goat ate.' },
  { tool: 'add', sentences: ['We went to the beach.', 'We built a sandcastle.', 'The waves knocked it down.'], s: 0, ask: 'when', options: ['in the morning', 'with a bucket', 'carefully'], why: '"In the morning" tells when we went.' },
];

// Noun Boiler Pairs (Claudia's open queue, Build Queue 2026-10-09): a twin boiler with a "one / more
// than one" switch. Match the picture: one thing or more than one, then a, an or some, the noun's
// form (with the weird plurals) and the action word that agrees.
export interface PairNoun { one: string; many: string; emoji: string; verb: [string, string]; an?: boolean }
export const PAIR_NOUNS: PairNoun[] = [
  { one: 'dog', many: 'dogs', emoji: '🐶', verb: ['barks', 'bark'] },
  { one: 'cat', many: 'cats', emoji: '🐱', verb: ['naps', 'nap'] },
  { one: 'apple', many: 'apples', emoji: '🍎', verb: ['rolls', 'roll'], an: true },
  { one: 'egg', many: 'eggs', emoji: '🥚', verb: ['wobbles', 'wobble'], an: true },
  { one: 'owl', many: 'owls', emoji: '🦉', verb: ['hoots', 'hoot'], an: true },
  { one: 'elephant', many: 'elephants', emoji: '🐘', verb: ['stomps', 'stomp'], an: true },
  { one: 'robot', many: 'robots', emoji: '🤖', verb: ['beeps', 'beep'] },
  { one: 'mouse', many: 'mice', emoji: '🐭', verb: ['squeaks', 'squeak'] },
  { one: 'goose', many: 'geese', emoji: '🪿', verb: ['honks', 'honk'] },
  { one: 'tooth', many: 'teeth', emoji: '🦷', verb: ['wiggles', 'wiggle'] },
  { one: 'child', many: 'children', emoji: '🧒', verb: ['giggles', 'giggle'] },
  { one: 'fox', many: 'foxes', emoji: '🦊', verb: ['sneaks', 'sneak'] },
  { one: 'bus', many: 'buses', emoji: '🚌', verb: ['zooms', 'zoom'] },
  { one: 'sheep', many: 'sheep', emoji: '🐑', verb: ['sleeps', 'sleep'] },
  { one: 'fish', many: 'fish', emoji: '🐟', verb: ['swims', 'swim'] },
];
