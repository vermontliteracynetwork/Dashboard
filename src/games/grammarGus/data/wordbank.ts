// Word bank (plan sections 3.13, 6.2, 13.2, 13.3). Core words are the
// teacher's word-list PDF. "example" words are the extra words her own 33
// pattern examples use (fish, dolphin, swam, proudly...) so every example
// sentence can be built and earns 3 stars. "color" and "action" are the
// Color pack and the start of the Action Pack the plan adds (section 6).

export type Rig = 'biped' | 'quadruped' | 'critter' | 'bird' | 'serpent' | 'vehicle' | 'object' | 'weather' | 'prop';
export type NounKind = 'human' | 'animal' | 'thing';
export type Pack = 'core' | 'example' | 'color' | 'action' | 'space' | 'ocean' | 'dinos' | 'food' | 'heroes' | 'wheels' | 'big' | 'custom';
// Interest word packs (plan 17.5). The teacher turns them on or off; they
// follow the same data model and agreement rules as every other word.
// More packs (Build Queue 2026-10-09): Dinosaurs, Food, Superheroes, Trains and Cars.
export const WORD_PACKS: { id: Pack; name: string; icon: string }[] = [{ id: 'space', name: 'Space', icon: '🚀' }, { id: 'ocean', name: 'Ocean', icon: '🌊' }, { id: 'dinos', name: 'Dinosaurs', icon: '🦖' }, { id: 'food', name: 'Food', icon: '🍔' }, { id: 'heroes', name: 'Superheroes', icon: '🦸' }, { id: 'wheels', name: 'Trains and Cars', icon: '🚂' }, { id: 'big', name: 'Big words', icon: '🎓' }];
export const isPackWord = (p: Pack) => p === 'space' || p === 'ocean' || p === 'dinos' || p === 'food' || p === 'heroes' || p === 'wheels' || p === 'big';

export interface NounEntry {
  word: string; tier: 1 | 2 | 3; kind: NounKind; rig: Rig; emoji: string; pack: Pack;
  plural?: boolean; noA?: boolean; group?: number; // group: how many sprites (children, crowd)
  proper?: boolean; // a name: Mia, Vermont (always a capital letter, no article)
  singular?: string; // a Duplicator plural ("cats") drawn with its singular's picture
  food?: boolean; drink?: boolean; size?: 'small' | 'normal' | 'big';
  color?: string; // always drawn this color on the Pixel TV (Yoga, the class's black lab)
}

const n = (word: string, tier: 1 | 2 | 3, kind: NounKind, rig: Rig, emoji: string, extra: Partial<NounEntry> = {}): NounEntry =>
  ({ word, tier, kind, rig, emoji, pack: 'core', ...extra });

export const NOUNS: NounEntry[] = [
  // Tier 1 (CVC)
  n('ball', 1, 'thing', 'object', '⚽', { size: 'small' }), n('bat', 1, 'animal', 'bird', '🦇', { size: 'small' }),
  n('boy', 1, 'human', 'biped', '👦'), n('car', 1, 'thing', 'vehicle', '🚗', { size: 'big' }),
  n('cat', 1, 'animal', 'quadruped', '🐱'), n('cow', 1, 'animal', 'quadruped', '🐄', { size: 'big' }),
  n('dad', 1, 'human', 'biped', '👨'), n('dog', 1, 'animal', 'quadruped', '🐶'),
  n('girl', 1, 'human', 'biped', '👧'), n('kite', 1, 'thing', 'object', '🪁'),
  n('man', 1, 'human', 'biped', '👨'), n('mom', 1, 'human', 'biped', '👩'),
  n('pet', 1, 'animal', 'quadruped', '🐾'), n('pig', 1, 'animal', 'quadruped', '🐷'),
  n('rat', 1, 'animal', 'critter', '🐀', { size: 'small' }), n('son', 1, 'human', 'biped', '👦'),
  n('van', 1, 'thing', 'vehicle', '🚐', { size: 'big' }),
  // Tier 2
  n('apple', 2, 'thing', 'object', '🍎', { food: true, size: 'small' }), n('bike', 2, 'thing', 'vehicle', '🚲'),
  n('bird', 2, 'animal', 'bird', '🐦', { size: 'small' }), n('book', 2, 'thing', 'object', '📕', { size: 'small' }),
  n('clam', 2, 'animal', 'critter', '🦪', { size: 'small' }), n('crayon', 2, 'thing', 'object', '🖍️', { size: 'small' }),
  n('crowd', 2, 'human', 'biped', '👥', { group: 5 }), n('dime', 2, 'thing', 'object', '🪙', { size: 'small' }),
  n('mice', 2, 'animal', 'critter', '🐭', { plural: true, noA: true, group: 3, size: 'small' }),
  n('rain', 2, 'thing', 'weather', '🌧️', { noA: true, drink: true }), n('rose', 2, 'thing', 'object', '🌹', { size: 'small' }),
  n('shoe', 2, 'thing', 'object', '👟', { size: 'small' }), n('snail', 2, 'animal', 'critter', '🐌', { size: 'small' }),
  n('snake', 2, 'animal', 'serpent', '🐍'), n('straw', 2, 'thing', 'object', '🥤', { size: 'small' }),
  n('swing', 2, 'thing', 'object', '🛝'), n('tank', 2, 'thing', 'vehicle', '🛢️', { size: 'big' }),
  n('team', 2, 'human', 'biped', '👥', { group: 4 }), n('woman', 2, 'human', 'biped', '👩'),
  // Tier 3
  n('animal', 3, 'animal', 'quadruped', '🐾'), n('aunt', 3, 'human', 'biped', '👩'),
  n('balloon', 3, 'thing', 'object', '🎈'), n('chicken', 3, 'animal', 'bird', '🐔'),
  n('children', 3, 'human', 'biped', '🧒', { plural: true, noA: true, group: 3 }), n('deer', 3, 'animal', 'quadruped', '🦌', { size: 'big' }),
  n('doctor', 3, 'human', 'biped', '🧑‍⚕️'), n('family', 3, 'human', 'biped', '👪', { group: 3 }),
  n('frog', 3, 'animal', 'critter', '🐸', { size: 'small' }), n('goose', 3, 'animal', 'bird', '🪿'),
  n('grandmother', 3, 'human', 'biped', '👵'), n('horse', 3, 'animal', 'quadruped', '🐴', { size: 'big' }),
  n('kitten', 3, 'animal', 'quadruped', '🐱', { size: 'small' }), n('owl', 3, 'animal', 'bird', '🦉'),
  n('rabbit', 3, 'animal', 'quadruped', '🐰', { size: 'small' }), n('sister', 3, 'human', 'biped', '👧'),
  n('spy', 3, 'human', 'biped', '🕵️'), n('tiger', 3, 'animal', 'quadruped', '🐯'),
  n('uncle', 3, 'human', 'biped', '👨'), n('wheel', 3, 'thing', 'vehicle', '🛞'),
  n('zebra', 3, 'animal', 'quadruped', '🦓', { size: 'big' }),
  // Bigger everyday lists (teacher 2026-10-08: "the detaul word lists need to
  // be exapanded for increased vocab and more options (ensure they will
  // display on the pixel tv)"). Every one has a Pixel TV drawing.
  n('baby', 2, 'human', 'biped', '👶', { size: 'small' }), n('teacher', 2, 'human', 'biped', '🧑‍🏫'), n('friend', 2, 'human', 'biped', '🧑'),
  n('king', 2, 'human', 'biped', '🤴'), n('queen', 2, 'human', 'biped', '👸'), n('chef', 2, 'human', 'biped', '🧑‍🍳'),
  n('farmer', 2, 'human', 'biped', '🧑‍🌾'), n('pirate', 2, 'human', 'biped', '🏴‍☠️'), n('nurse', 2, 'human', 'biped', '🧑‍⚕️'),
  n('bear', 2, 'animal', 'quadruped', '🐻', { size: 'big' }), n('lion', 2, 'animal', 'quadruped', '🦁'), n('monkey', 2, 'animal', 'biped', '🐵'),
  n('duck', 2, 'animal', 'bird', '🦆', { size: 'small' }), n('penguin', 2, 'animal', 'bird', '🐧'), n('elephant', 2, 'animal', 'quadruped', '🐘', { size: 'big' }),
  n('giraffe', 2, 'animal', 'quadruped', '🦒', { size: 'big' }), n('fox', 2, 'animal', 'quadruped', '🦊'), n('puppy', 2, 'animal', 'quadruped', '🐶', { size: 'small' }),
  n('bunny', 2, 'animal', 'quadruped', '🐰', { size: 'small' }), n('bee', 2, 'animal', 'critter', '🐝', { size: 'small' }), n('butterfly', 2, 'animal', 'bird', '🦋', { size: 'small' }),
  n('cake', 2, 'thing', 'object', '🎂', { food: true }), n('cookie', 2, 'thing', 'object', '🍪', { food: true, size: 'small' }), n('pizza', 2, 'thing', 'object', '🍕', { food: true }),
  n('banana', 2, 'thing', 'object', '🍌', { food: true, size: 'small' }), n('carrot', 2, 'thing', 'object', '🥕', { food: true, size: 'small' }), n('sandwich', 2, 'thing', 'object', '🥪', { food: true }),
  n('milk', 2, 'thing', 'object', '🥛', { drink: true, noA: true }), n('juice', 2, 'thing', 'object', '🧃', { drink: true, noA: true }), n('water', 2, 'thing', 'object', '💧', { drink: true, noA: true }),
  n('cup', 2, 'thing', 'object', '🥤', { size: 'small' }), n('hat', 2, 'thing', 'object', '🎩', { size: 'small' }), n('box', 2, 'thing', 'object', '📦'),
  n('tree', 2, 'thing', 'object', '🌳', { size: 'big' }), n('flower', 2, 'thing', 'object', '🌼', { size: 'small' }), n('drum', 2, 'thing', 'object', '🥁'),
  n('sun', 2, 'thing', 'object', '☀️', { size: 'big' }), n('star', 2, 'thing', 'object', '⭐'), n('house', 2, 'thing', 'object', '🏠', { size: 'big' }),
  n('boat', 2, 'thing', 'vehicle', '⛵', { size: 'big' }), n('train', 2, 'thing', 'vehicle', '🚂', { size: 'big' }), n('truck', 2, 'thing', 'vehicle', '🚚', { size: 'big' }),
  // Silly words and big middle school words (teacher 2026-10-08: "funny vocab words, longer good
  // words for middle school, silly goofy funny words, too ... like besieged ... splatter and slime").
  n('slime', 2, 'thing', 'object', '🟢', { noA: true }), n('goo', 2, 'thing', 'object', '🫧', { noA: true }), n('pickle', 2, 'thing', 'object', '🥒', { food: true, size: 'small' }),
  n('noodle', 2, 'thing', 'object', '🍜', { food: true, size: 'small' }), n('marshmallow', 2, 'thing', 'object', '☁️', { food: true, size: 'small' }), n('taco', 2, 'thing', 'object', '🌮', { food: true }),
  n('donut', 2, 'thing', 'object', '🍩', { food: true, size: 'small' }), n('potato', 2, 'thing', 'object', '🥔', { food: true, size: 'small' }), n('sock', 2, 'thing', 'object', '🧦', { size: 'small' }),
  n('toaster', 2, 'thing', 'object', '🍞'), n('unicorn', 2, 'animal', 'quadruped', '🦄'), n('dragon', 2, 'animal', 'quadruped', '🐉', { size: 'big' }),
  n('monster', 2, 'animal', 'biped', '👹'), n('ninja', 2, 'human', 'biped', '🥷'), n('wizard', 2, 'human', 'biped', '🧙'), n('knight', 2, 'human', 'biped', '🛡️'),
  n('goblin', 2, 'animal', 'biped', '👺'), n('sloth', 2, 'animal', 'quadruped', '🦥'), n('llama', 2, 'animal', 'quadruped', '🦙'),
  n('narwhal', 2, 'animal', 'critter', '🐋'), n('hamster', 2, 'animal', 'critter', '🐹', { size: 'small' }),
  // Places (teacher 2026-10-08: "nouns have lots of places (school, town, beach)"), each a Pixel TV scene piece.
  ...Object.entries({ school: '🏫', town: '🏘️', beach: '🏖️', park: '🏞️', store: '🏪', library: '📚', zoo: '🦓', farm: '🚜', forest: '🌲', garden: '🌷', playground: '🛝', castle: '🏰', city: '🏙️', pool: '🏊', lake: '🛶', mountain: '⛰️', hospital: '🏥', bakery: '🥐', museum: '🏛️', river: '🏞️' }).map(([w, e]) => n(w, 2, 'thing', 'prop', e)),
  // Words her 33 example sentences use (pack "example", tier 3).
  ...([
    n('fish', 3, 'animal', 'critter', '🐟', { size: 'small' }), n('dolphin', 3, 'animal', 'critter', '🐬'),
    n('bug', 3, 'animal', 'critter', '🐞', { size: 'small' }), n('turtle', 3, 'animal', 'critter', '🐢', { size: 'small' }),
    n('hare', 3, 'animal', 'quadruped', '🐇', { size: 'small' }), n('plane', 3, 'thing', 'vehicle', '✈️', { size: 'big' }),
    n('popsicle', 3, 'thing', 'object', '🍭', { food: true, size: 'small' }), n('rock', 3, 'thing', 'object', '🪨', { size: 'small' }),
    n('window', 3, 'thing', 'prop', '🪟'), n('floor', 3, 'thing', 'prop', '🟫'), n('table', 3, 'thing', 'prop', '🪑'),
    n('kitchen', 3, 'thing', 'prop', '🍳'), n('door', 3, 'thing', 'prop', '🚪'), n('bus', 3, 'thing', 'vehicle', '🚌', { size: 'big' }),
  ].map((e) => ({ ...e, pack: 'example' as Pack }))),
  // Space pack.
  ...([
    n('astronaut', 3, 'human', 'biped', '🧑‍🚀'), n('alien', 3, 'animal', 'biped', '👽'), n('robot', 3, 'thing', 'biped', '🤖'),
    n('rocket', 3, 'thing', 'vehicle', '🚀', { size: 'big' }), n('planet', 3, 'thing', 'object', '🪐', { size: 'big' }),
    n('moon', 3, 'thing', 'object', '🌙'), n('comet', 3, 'thing', 'object', '☄️'),
  ].map((e) => ({ ...e, pack: 'space' as Pack }))),
  // Ocean pack.
  ...([
    n('shark', 3, 'animal', 'critter', '🦈', { size: 'big' }), n('octopus', 3, 'animal', 'critter', '🐙'), n('whale', 3, 'animal', 'critter', '🐋', { size: 'big' }),
    n('crab', 3, 'animal', 'critter', '🦀', { size: 'small' }), n('jellyfish', 3, 'animal', 'critter', '🪼', { size: 'small' }),
    n('submarine', 3, 'thing', 'vehicle', '🚢', { size: 'big' }), n('shell', 3, 'thing', 'object', '🐚', { size: 'small' }),
  ].map((e) => ({ ...e, pack: 'ocean' as Pack }))),
  // Dinosaurs pack.
  ...([
    n('dinosaur', 3, 'animal', 'quadruped', '🦕', { size: 'big' }), n('raptor', 3, 'animal', 'biped', '🦖'), n('triceratops', 3, 'animal', 'quadruped', '🦕', { size: 'big' }),
    n('stegosaurus', 3, 'animal', 'quadruped', '🦕', { size: 'big' }), n('pterodactyl', 3, 'animal', 'bird', '🦅', { size: 'big' }), n('fossil', 3, 'thing', 'object', '🦴', { size: 'small' }),
    n('volcano', 3, 'thing', 'object', '🌋', { size: 'big' }),
  ].map((e) => ({ ...e, pack: 'dinos' as Pack }))),
  // Food pack.
  ...([
    n('burger', 3, 'thing', 'object', '🍔', { food: true }), n('pancake', 3, 'thing', 'object', '🥞', { food: true }), n('waffle', 3, 'thing', 'object', '🧇', { food: true }),
    n('cupcake', 3, 'thing', 'object', '🧁', { food: true, size: 'small' }), n('burrito', 3, 'thing', 'object', '🌯', { food: true }), n('pretzel', 3, 'thing', 'object', '🥨', { food: true, size: 'small' }),
    n('muffin', 3, 'thing', 'object', '🧁', { food: true, size: 'small' }), n('meatball', 3, 'thing', 'object', '🍝', { food: true, size: 'small' }),
  ].map((e) => ({ ...e, pack: 'food' as Pack }))),
  // Superheroes pack.
  ...([
    n('superhero', 3, 'human', 'biped', '🦸'), n('villain', 3, 'human', 'biped', '🦹'), n('sidekick', 3, 'human', 'biped', '🧑'),
    n('cape', 3, 'thing', 'object', '🧣'), n('mask', 3, 'thing', 'object', '🎭', { size: 'small' }), n('shield', 3, 'thing', 'object', '🛡️'),
  ].map((e) => ({ ...e, pack: 'heroes' as Pack }))),
  // Trains and Cars pack.
  ...([
    n('tractor', 3, 'thing', 'vehicle', '🚜'), n('locomotive', 3, 'thing', 'vehicle', '🚂', { size: 'big' }),
    n('racecar', 3, 'thing', 'vehicle', '🏎️'), n('firetruck', 3, 'thing', 'vehicle', '🚒', { size: 'big' }), n('ambulance', 3, 'thing', 'vehicle', '🚑', { size: 'big' }),
    n('taxi', 3, 'thing', 'vehicle', '🚕'), n('bulldozer', 3, 'thing', 'vehicle', '🚜', { size: 'big' }), n('motorcycle', 3, 'thing', 'vehicle', '🏍️'), n('scooter', 3, 'thing', 'vehicle', '🛴', { size: 'small' }),
  ].map((e) => ({ ...e, pack: 'wheels' as Pack }))),
];

export interface VerbEntry {
  base: string; third: string; past: string; objectUse: 'T' | 'B' | 'I' | 'L'; // L: a linking verb (is, are, was)
  clip: string; pack: Pack; gentle?: boolean;
}
const v = (base: string, third: string, past: string, objectUse: 'T' | 'B' | 'I' | 'L', clip: string, pack: Pack = 'core', gentle = true): VerbEntry =>
  ({ base, third, past, objectUse, clip, pack, gentle });

// hid and slid are stored as hide and slide so every tense works (plan 13.3).
export const VERBS: VerbEntry[] = [
  v('chop', 'chops', 'chopped', 'T', 'chop'), v('climb', 'climbs', 'climbed', 'B', 'climb'),
  v('drink', 'drinks', 'drank', 'B', 'drink'), v('eat', 'eats', 'ate', 'B', 'eat'),
  v('fall', 'falls', 'fell', 'I', 'fall'), v('hide', 'hides', 'hid', 'B', 'hide'),
  v('jump', 'jumps', 'jumped', 'I', 'jump'), v('kick', 'kicks', 'kicked', 'T', 'kick'),
  v('mix', 'mixes', 'mixed', 'T', 'mix'), v('run', 'runs', 'ran', 'I', 'run'),
  v('sing', 'sings', 'sang', 'B', 'sing'), v('slide', 'slides', 'slid', 'I', 'slide'),
  v('spin', 'spins', 'spun', 'B', 'spin'), v('talk', 'talks', 'talked', 'I', 'talk'),
  v('walk', 'walks', 'walked', 'B', 'walk'),
  // Bigger everyday list (teacher 2026-10-08), each on a real Pixel TV clip.
  v('dance', 'dances', 'danced', 'I', 'spin'), v('hop', 'hops', 'hopped', 'I', 'jump'), v('skip', 'skips', 'skipped', 'I', 'jump'),
  v('race', 'races', 'raced', 'I', 'run'), v('march', 'marches', 'marched', 'I', 'walk'), v('stomp', 'stomps', 'stomped', 'I', 'walk'),
  v('roll', 'rolls', 'rolled', 'I', 'spin'), v('twirl', 'twirls', 'twirled', 'I', 'spin'), v('tumble', 'tumbles', 'tumbled', 'I', 'fall'),
  v('trip', 'trips', 'tripped', 'I', 'fall'), v('sneak', 'sneaks', 'sneaked', 'I', 'hide'), v('laugh', 'laughs', 'laughed', 'I', 'talk'),
  v('yell', 'yells', 'yelled', 'I', 'talk'), v('whisper', 'whispers', 'whispered', 'I', 'talk'), v('read', 'reads', 'read', 'B', 'talk'),
  v('throw', 'throws', 'threw', 'T', 'kick'), v('push', 'pushes', 'pushed', 'T', 'kick'), v('wash', 'washes', 'washed', 'B', 'clean'),
  v('sweep', 'sweeps', 'swept', 'B', 'clean'), v('paint', 'paints', 'painted', 'B', 'clean'), v('build', 'builds', 'built', 'B', 'mix'),
  v('munch', 'munches', 'munched', 'B', 'eat'), v('gobble', 'gobbles', 'gobbled', 'T', 'eat'), v('sip', 'sips', 'sipped', 'B', 'drink'),
  v('slurp', 'slurps', 'slurped', 'B', 'drink'), v('drive', 'drives', 'drove', 'B', 'run'), v('visit', 'visits', 'visited', 'T', 'walk'),
  // Silly and big middle school action words (teacher 2026-10-08).
  v('besiege', 'besieges', 'besieged', 'T', 'pounce', 'core', false), v('conquer', 'conquers', 'conquered', 'T', 'pounce', 'core', false), v('demolish', 'demolishes', 'demolished', 'T', 'break', 'core', false),
  v('devour', 'devours', 'devoured', 'T', 'eat'), v('guzzle', 'guzzles', 'guzzled', 'B', 'drink'), v('plummet', 'plummets', 'plummeted', 'I', 'fall'),
  v('saunter', 'saunters', 'sauntered', 'I', 'walk'), v('scurry', 'scurries', 'scurried', 'I', 'run'), v('stumble', 'stumbles', 'stumbled', 'I', 'fall'),
  v('splatter', 'splatters', 'splattered', 'I', 'break'), v('wobble', 'wobbles', 'wobbled', 'I', 'spin'), v('squish', 'squishes', 'squished', 'T', 'hug'),
  v('bonk', 'bonks', 'bonked', 'T', 'kick', 'core', false), v('gallop', 'gallops', 'galloped', 'I', 'run'), v('slither', 'slithers', 'slithered', 'I', 'slide'),
  v('lurk', 'lurks', 'lurked', 'I', 'hide'), v('tiptoe', 'tiptoes', 'tiptoed', 'I', 'walk'), v('waddle', 'waddles', 'waddled', 'I', 'walk'),
  v('boogie', 'boogies', 'boogied', 'I', 'spin'), v('cartwheel', 'cartwheels', 'cartwheeled', 'I', 'spin'), v('zigzag', 'zigzags', 'zigzagged', 'I', 'run'),
  v('sprint', 'sprints', 'sprinted', 'I', 'run'), v('soar', 'soars', 'soared', 'I', 'fly'), v('glide', 'glides', 'glided', 'I', 'slide'),
  // Verbs her example sentences use.
  v('crawl', 'crawls', 'crawled', 'I', 'walk', 'example'), v('fly', 'flies', 'flew', 'I', 'fly', 'example'),
  v('swim', 'swims', 'swam', 'I', 'swim', 'example'), v('bounce', 'bounces', 'bounced', 'I', 'jump', 'example'),
  v('break', 'breaks', 'broke', 'B', 'break', 'example'), v('clean', 'cleans', 'cleaned', 'B', 'clean', 'example'),
  v('dust', 'dusts', 'dusted', 'B', 'clean', 'example'), v('cook', 'cooks', 'cooked', 'B', 'mix', 'example'),
  v('bake', 'bakes', 'baked', 'B', 'mix', 'example'), v('miss', 'misses', 'missed', 'B', 'miss', 'example'),
  v('land', 'lands', 'landed', 'I', 'fall', 'example'), v('melt', 'melts', 'melted', 'I', 'melt', 'example'),
  // Start of the Action Pack (the white cat / black cat example needs attack).
  v('attack', 'attacks', 'attacked', 'T', 'pounce', 'action', false), v('chase', 'chases', 'chased', 'T', 'chase', 'action'),
  v('hug', 'hugs', 'hugged', 'T', 'hug', 'action'),
  // Space pack.
  v('float', 'floats', 'floated', 'I', 'fly', 'space'), v('zoom', 'zooms', 'zoomed', 'I', 'run', 'space'),
  v('beep', 'beeps', 'beeped', 'I', 'talk', 'space'), v('orbit', 'orbits', 'orbited', 'B', 'spin', 'space'),
  // Ocean pack.
  v('dive', 'dives', 'dived', 'I', 'swim', 'ocean'), v('splash', 'splashes', 'splashed', 'I', 'jump', 'ocean'),
  v('tickle', 'tickles', 'tickled', 'T', 'hug', 'ocean'),
];

export type AdjKind = 'feeling' | 'size' | 'age' | 'look' | 'color';
export const ADJ_RANK: Record<AdjKind, number> = { feeling: 1, size: 2, age: 3, look: 4, color: 5 };
export interface AdjEntry { word: string; kind: AdjKind; pack: Pack; degree?: 'er' | 'est' }
const adj = (kind: AdjKind, pack: Pack, words: string) => words.split(' ').map((word) => ({ word, kind, pack }));

// Order of describing words: feeling, size, age, look, color (plan 3.13).
export const ADJECTIVES: AdjEntry[] = [
  ...adj('feeling', 'core', 'beautiful brave calm dazzling fancy gentle great handsome happy lazy plain polite pretty silly thankful'),
  ...adj('size', 'core', 'big small tiny chubby plump'),
  ...adj('age', 'core', 'young old new'),
  ...adj('look', 'core', 'bald'),
  ...adj('look', 'example', 'hard'),
  ...adj('color', 'color', 'red blue green yellow white black pink purple orange brown gray striped spotted'),
  // Bigger everyday list (teacher 2026-10-08); each one shows on the Pixel TV.
  ...adj('feeling', 'core', 'sad angry scared sleepy tired hungry excited proud shy grumpy curious surprised worried kind friendly cheerful'),
  ...adj('size', 'core', 'huge giant little tall short'),
  ...adj('age', 'core', 'ancient'),
  ...adj('look', 'core', 'fluffy furry spiky wet dirty muddy smelly sticky strong fast slow hot cold soft loud quiet bright round'),
  ...adj('color', 'core', 'gold silver'),
  ...adj('feeling', 'core', 'ferocious courageous furious exhausted famished goofy zany cranky jolly timid bonkers mischievous magnificent'),
  ...adj('size', 'core', 'enormous gigantic colossal minuscule petite'),
  ...adj('look', 'core', 'peculiar mysterious radiant luminous drenched gooey squishy wobbly stinky grimy fuzzy elegant'),
  ...adj('feeling', 'space', 'cosmic'), ...adj('look', 'space', 'shiny glowing'),
  ...adj('look', 'ocean', 'slimy sparkly soggy'),
];

export const ADVERBS: { word: string; pack: Pack }[] = [
  ...'gently innocently lightly loudly messily quickly quietly slowly softly swiftly warmly wildly'.split(' ').map((word) => ({ word, pack: 'core' as Pack })),
  // Hard words from the everyday lists (Claudia's audit: "zealously, upon"), now in the off-by-default 🎓 Big words pack.
  ...'tenderly zealously'.split(' ').map((word) => ({ word, pack: 'big' as Pack })),
  ...'proudly safely'.split(' ').map((word) => ({ word, pack: 'example' as Pack })),
  ...'then happily sadly carefully bravely angrily calmly sleepily eagerly nervously kindly politely playfully ferociously triumphantly mysteriously gleefully clumsily frantically majestically boldly grumpily lazily sluggishly'.split(' ').map((word) => ({ word, pack: 'core' as Pack })),
  ...'weirdly silently'.split(' ').map((word) => ({ word, pack: 'space' as Pack })),
  ...'gracefully sneakily'.split(' ').map((word) => ({ word, pack: 'ocean' as Pack })),
];

// "like" makes a simile: runs like a rocket (teacher 2026-10-08, figurative language).
export const PREPOSITIONS: string[] = 'above across along around below behind down from in into on over past through to under underneath up upon within at like'.split(' ');
// The 🎓 Big words pack's where words: still understood everywhere, only offered when the pack is on.
export const BIG_PREPOSITIONS = ['upon', 'within'];
export const CORE_PREPOSITIONS = PREPOSITIONS.filter((p) => !BIG_PREPOSITIONS.includes(p));
export const SUBJECT_PRONOUNS = ['I', 'you', 'he', 'she', 'it', 'we', 'they'] as const;
export const REFLEXIVE_PRONOUNS = ['itself', 'himself', 'herself', 'themselves', 'myself', 'yourself', 'ourselves'] as const;
export const ARTICLES = ['a', 'an', 'the'] as const;
// "nor" is left out of v1 (needs inverted word order, plan section 12).
export const CONJUNCTIONS = ['and', 'but', 'for', 'or'] as const;
// Sound words too (teacher 2026-10-08: "interjections should have onemonepias like \"Hey!\" \"Boom!\"").
export const INTERJECTIONS = ['Eek', 'Golly', 'Wow', 'Whew', 'Yuck', 'Phew', 'Hey', 'Boom', 'Pow', 'Bam', 'Bang', 'Crash', 'Zap', 'Whoosh', 'Splat', 'Wham', 'Oops', 'Yay', 'Hooray', 'Ouch', 'Yikes', 'Achoo', 'Brr', 'Ahoy', 'Hmm'] as const;

// Conjunction pools by position (plan section 12, configurable).
export const CONJ_POOLS = {
  subject: ['and', 'or'], verb: ['and', 'or'], prep: ['and', 'or'],
  adverb: ['and', 'but', 'or'], clause: ['and', 'but', 'for'],
} as const;

export const nounByWord = new Map(NOUNS.map((x) => [x.word, x]));
export const verbByBase = new Map(VERBS.map((x) => [x.base, x]));
export const adjByWord = new Map(ADJECTIVES.map((x) => [x.word, x]));
export const adverbSet = new Set(ADVERBS.map((x) => x.word));
export const prepSet = new Set(PREPOSITIONS);
export const subjectPronounSet = new Set<string>(SUBJECT_PRONOUNS);
export const reflexiveSet = new Set<string>(REFLEXIVE_PRONOUNS);
export const interjectionSet = new Set<string>(INTERJECTIONS);

// Every word of a part of speech (for the generator and the word shelf).
export const nounsForTier = (tier: 1 | 2 | 3) => NOUNS.filter((x) => x.tier <= tier).map((x) => x.word);

// The linking verb "be" (Equals Sign Machine, Claudia's Phase 1, 2026-10-07):
// "The magnet is strong." It links the who to what it is like. It lives
// only in the dictionary of real words, not in the everyday word lists.
const BE: VerbEntry = { base: 'be', third: 'is', past: 'was', objectUse: 'L', clip: 'wiggle', pack: 'custom', gentle: true };
if (!verbByBase.has('be')) verbByBase.set('be', BE);
