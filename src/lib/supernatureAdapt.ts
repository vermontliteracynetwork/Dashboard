// How every Habitat creature reacts to the land, the weather, the time and disasters (Build Queue
// 118, her words: "show how all creatures with the habitat respond/adapt/react to the habitat
// changes"; and 116: "make sure different features equate to different reactions and adaptations
// in different habitats"). Each reaction comes from the creature's own body: thick fur keeps it warm
// in a blizzard, swimmers dive away from floods and fires, fliers take off in an earthquake but get
// tossed by a tornado, desert bodies save water in a drought. The reason is always said out loud,
// so the adaptation is the lesson.
import type { Biome, Creature } from './supernatureCreatures';

export type Tag = 'fly' | 'swim' | 'float' | 'warm' | 'heat' | 'tough' | 'fire' | 'night' | 'magic';
export function tagsOf(c: Creature): Set<Tag> {
  const t = c.traits.join(' ').toLowerCase(); const s = new Set<Tag>();
  if (c.move === 'fly' || t.includes('flying')) s.add('fly');
  if (c.move === 'swim' || /aquatic|water breathing|swimming|fin tail|swimmer/.test(t)) s.add('swim');
  if (c.move === 'float' || t.includes('floating')) s.add('float');
  if (c.likes.includes('snow') || /fur|shaggy|snow walker/.test(t)) s.add('warm');
  if (c.likes.includes('desert') || /desert/.test(t)) s.add('heat');
  if (/tough scales|hard shell|clay|giant|huge|strong|tough/.test(t) || c.chapter === 'colossal') s.add('tough');
  if (/fire|fiery/.test(t)) s.add('fire');
  if (/night creature|night/.test(t)) s.add('night');
  if (c.chapter === 'gods' || (c.chapter === 'spirits' && c.eats === 'magic')) s.add('magic');
  return s;
}
export const TAG_WORDS: Record<Tag, string> = {
  fly: 'It can fly', swim: 'It can swim', float: 'It floats', warm: 'Thick fur or a warm body', heat: 'A body made for heat and dry land',
  tough: 'A tough, heavy body', fire: 'A fiery body', night: 'It is a night creature', magic: 'Magic protects it',
};
// What each body feature does in the Habitat, for the Creature Maker preview.
export const TAG_EFFECTS: Record<Tag, string> = {
  fly: 'Flies above floods and earthquakes, but strong wind tosses it.',
  swim: 'Dives away from floods, fires and storms; gets thirsty in a drought.',
  float: 'Floats safely over floods and shaking ground.',
  warm: 'Stays warm in snow and blizzards.',
  heat: 'Saves water in a drought and loves the hot sun.',
  tough: 'Stands strong in storms and tornadoes.',
  fire: 'Is not bothered by wildfire.',
  night: 'Wakes up and explores at night.',
  magic: 'Magic keeps it safe from everything.',
};

export type Pose = 'none' | 'dive' | 'land' | 'shiver' | 'fluff' | 'brace' | 'bask' | 'sleep' | 'glow' | 'splash';
export interface Reaction { icon: string; word: string; text: string; hit: number; status?: string; pose: Pose; because?: string }
export interface Ctx { weather: string; disaster: string | null; night: boolean; biome: Biome | 'ocean'; season?: string }

// Baby seasons (Build Queue 120, her words: "creatures should have a breeding/spawning period if
// noted and otherwise can breed whenever"). Water creatures spawn in spring, fliers nest in spring,
// snow creatures have their babies in snug winter dens (like polar bears); everyone else, any time.
export function breedsIn(c: Creature): string | null {
  if (c.chapter === 'gods' || c.eats === 'magic') return null;
  const t = tagsOf(c);
  if (t.has('swim') || t.has('fly')) return 'Spring';
  if (c.likes.includes('snow') && !c.likes.includes('desert')) return 'Winter';
  return null;
}
export function breedNote(c: Creature): string {
  const b = breedsIn(c); const t = tagsOf(c);
  if (b === 'Spring') return t.has('swim') ? 'Spawning season: spring. Its eggs hatch in the spring water.' : 'Nesting season: spring. It builds a nest and its eggs hatch.';
  if (b === 'Winter') return 'Den season: winter. Its babies are born in a snug snow den.';
  return 'It can have babies in any season.';
}

// extra: this creature's own skills (Build Queue 134): skill tags join its body tags, and some skills
// make it safe from one hard time (Earth magic tunnels underground, Earthquake immunity, Storm rider...).
export function react(c: Creature, x: Ctx, extra?: { tags?: Tag[]; skills?: string[] }): Reaction {
  const t = tagsOf(c); const n = c.name;
  extra?.tags?.forEach((g) => t.add(g));
  const sk = new Set(extra?.skills ?? []);
  const ok = (icon: string, word: string, text: string, pose: Pose, tag?: Tag): Reaction => ({ icon, word, text: `${n} ${text}`, hit: 0, pose, because: tag ? TAG_WORDS[tag] : undefined });
  const hurt = (icon: string, word: string, text: string, status: string, pose: Pose, hit = 1, why?: string): Reaction => ({ icon, word, text: `${n} ${text}`, hit, status, pose, because: why });
  const bad = x.disaster || ['storm', 'snow'].includes(x.weather);
  if (sk.has('earthMagic') && (x.disaster || ['storm', 'snow'].includes(x.weather) || (x.season === 'Winter' && !t.has('warm')))) return ok('⛰️', 'tunnels', 'tunnels into the ground with earth magic, where nothing can reach it.', 'dive');
  if (sk.has('quakeProof') && x.disaster === 'earthquake') return ok('🫨', 'steady', 'keeps its balance: it has earthquake immunity.', 'brace');
  if (sk.has('stormRider') && (x.disaster === 'tornado' || x.weather === 'storm')) return ok('⛈️', 'rides it', 'rides the wind like a storm rider.', 'glow');
  if (sk.has('floodSafe') && x.disaster === 'flood') return ok('⛰️', 'high ground', 'climbs to high ground, safe from the flood.', 'none');
  if (sk.has('smokeProof') && x.disaster === 'wildfire') return ok('💨', 'breathes easy', 'breathes easy in the smoke.', 'none');
  if (sk.has('droughtSaver') && x.disaster === 'drought') return ok('🌵', 'saves water', 'saves water in its body and is not thirsty.', 'bask');
  if (sk.has('hibernate') && x.season === 'Winter' && !x.disaster) return ok('💤', 'hibernates', 'curls up and hibernates through the winter.', 'sleep');
  if (sk.has('shadeSeeker') && x.season === 'Summer' && !x.disaster && x.weather === 'clear') return ok('🌳', 'finds shade', 'finds a shady spot, so the summer heat is fine.', 'none');
  if (bad && t.has('magic')) return ok('✨', 'safe', 'is not bothered: its magic keeps it safe.', 'glow', 'magic');
  // The Ocean (Build Queue 123, 125): deep water changes slowly, so most hard times pass over it.
  // Floaters drift near the top, so big wind still tosses them.
  if (x.biome === 'ocean') {
    if ((x.disaster === 'tornado' || x.weather === 'storm') && !t.has('swim')) return hurt('🌊', 'tossed', 'gets tossed by the big waves near the surface.', 'tossed', 'shiver', 1);
    if (x.disaster === 'drought') return ok('🌊', 'deep sea', 'is fine: the ocean never dries up, even in a drought. A pond would shrink!', 'none', 'swim');
    if (x.disaster === 'wildfire') return ok('🌊', 'safe', 'is safe under the water, far from the fire.', 'dive', 'swim');
    if (x.disaster === 'flood') return ok('🌊', 'swims', 'hardly notices: the ocean is already full of water.', 'splash', 'swim');
    if (x.disaster === 'earthquake') return ok('🌊', 'rocks', 'feels the water rock and swims down deep until it stops.', 'dive', 'swim');
    if (x.disaster === 'blizzard' || x.weather === 'snow' || x.season === 'Winter') return ok('🧊', 'deep water', 'swims down deep, where ocean water stays warmer than the air.', 'dive', 'swim');
    if (x.weather === 'storm') return ok('🌊', 'dives', 'dives below the waves until the storm passes.', 'dive', 'swim');
    if (x.season === 'Summer') return ok('🐠', 'cool water', 'swims in the cool ocean while the land is hot.', 'splash', 'swim');
    if (x.season === 'Spring' && breedsIn(c) === 'Spring') return ok('🥚', 'spawning', 'lays its eggs in the spring sea. It is spawning time!', 'none', 'swim');
    if (x.night) return ok('🌙', 'drifts', 'drifts in the dark, quiet sea.', 'none');
    return ok('🐟', 'at home', 'swims happily in the open ocean.', 'none', 'swim');
  }
  // Biome changes the hard times (Build Queue 125): desert summers are dry, deserts stay mild in
  // winter, forests give shade, and the snow land is cold in every season but summer.
  if (!x.disaster && x.weather === 'clear') {
    if (x.biome === 'desert' && x.season === 'Summer' && !t.has('heat') && !t.has('fire') && !t.has('swim')) return hurt('🌵', 'thirsty', 'gets thirsty in the dry desert summer. A desert body would save water.', 'thirsty', 'shiver', 1, 'It does not have a desert body');
    if (x.biome === 'desert' && x.season === 'Winter' && t.has('heat')) return ok('🏜️', 'mild', 'is fine: desert winters are mild in the daytime.', 'bask', 'heat');
    if (x.biome === 'forest' && x.season === 'Summer' && t.has('warm')) return ok('🌳', 'shade', 'rests in the cool forest shade, so its thick fur is fine.', 'none', 'warm');
    if (x.biome === 'snow' && (x.season === 'Spring' || x.season === 'Fall') && !t.has('warm') && !t.has('swim') && !t.has('fire')) return hurt('🥶', 'chilly', 'is chilly: the snow land stays cold even in spring and fall.', 'chilly', 'shiver', 1, 'It has no thick fur');
    if (x.biome === 'swamp' && x.season !== 'Winter' && !t.has('swim') && !t.has('fly') && !t.has('float')) return ok('🪷', 'squelches', 'squelches through the warm swamp mud.', 'none');
  }
  switch (x.disaster) {
    case 'flood':
      if (t.has('swim')) return ok('🌊', 'swims', 'loves the extra water and swims around.', 'splash', 'swim');
      if (t.has('fly')) return ok('🪽', 'flies up', 'flies up above the flood water.', 'none', 'fly');
      if (t.has('float')) return ok('🫧', 'floats', 'floats safely over the water.', 'none', 'float');
      return hurt('💧', 'soggy', 'gets soggy in the flood. It cannot swim or fly: take cover!', 'soggy', 'shiver');
    case 'wildfire':
      if (t.has('fire')) return ok('🔥', 'fine', 'is not bothered by the fire at all.', 'bask', 'fire');
      if (t.has('swim')) return ok('🌊', 'dives', 'stays down in the pond, away from the smoke.', 'dive', 'swim');
      if (t.has('fly')) return ok('🪽', 'flies off', 'flies far away from the smoke.', 'none', 'fly');
      return hurt('💨', 'smoky', 'coughs from the smoke. Take cover!', 'smoky', 'shiver');
    case 'blizzard':
      if (t.has('warm')) return ok('🧥', 'warm', 'fluffs up its fur and stays warm.', 'fluff', 'warm');
      if (t.has('swim')) return ok('🌊', 'dives', 'dives under the ice, where the water stays warmer.', 'dive', 'swim');
      return hurt('🥶', 'chilly', 'shivers in the cold. It has no thick fur.', 'chilly', 'shiver');
    case 'earthquake':
      if (t.has('fly')) return ok('🪽', 'takes off', 'takes off into the air until the shaking stops.', 'none', 'fly');
      if (t.has('swim') || t.has('float')) return ok('🌊', 'rocks', 'just rocks gently in the water.', 'none', t.has('swim') ? 'swim' : 'float');
      return hurt('💫', 'dizzy', 'wobbles on the shaking ground.', 'dizzy', 'brace');
    case 'drought':
      if (t.has('heat')) return ok('🏜️', 'saves water', 'saves water in its body, like desert animals do.', 'bask', 'heat');
      if (t.has('fly')) return ok('🪽', 'finds water', 'flies off to find water far away.', 'none', 'fly');
      if (t.has('swim')) return hurt('🌵', 'thirsty', 'is worried: the pond is shrinking!', 'thirsty', 'shiver');
      return hurt('🌵', 'thirsty', 'gets thirsty in the dry heat.', 'thirsty', 'shiver');
    case 'tornado':
      if (t.has('tough')) return ok('🪨', 'stands strong', 'is too heavy and strong to blow away.', 'brace', 'tough');
      if (t.has('swim')) return ok('🌊', 'dives', 'dives deep, under the wind.', 'dive', 'swim');
      if (t.has('fly')) return hurt('🌪️', 'tossed', 'gets tossed by the wind: wings are no help in a tornado!', 'tossed', 'shiver', 2, TAG_WORDS.fly);
      return hurt('💫', 'dizzy', 'gets dizzy in the spinning wind. Take cover!', 'dizzy', 'brace');
  }
  switch (x.weather) {
    case 'storm':
      if (t.has('swim')) return ok('🌊', 'dives', 'dives deep where the storm cannot reach.', 'dive', 'swim');
      if (t.has('tough')) return ok('🪨', 'stands strong', 'stands strong in the storm.', 'brace', 'tough');
      if (t.has('fly')) return hurt('⚡', 'lands', 'lands and holds on tight. Flying in lightning is not safe.', 'soggy', 'land', 1, TAG_WORDS.fly);
      return hurt('💧', 'soggy', 'gets soaked in the storm.', 'soggy', 'shiver');
    case 'snow':
      if (t.has('warm')) return ok('❄️', 'plays', 'plays in the snow. Its fur keeps it warm.', 'fluff', 'warm');
      if (t.has('swim')) return ok('🌊', 'dives', 'stays under the water, where it is warmer.', 'dive', 'swim');
      return hurt('🥶', 'chilly', 'gets chilly. It has no thick fur.', 'chilly', 'shiver');
    case 'rain':
      if (t.has('swim')) return ok('💦', 'splashes', 'splashes happily in the rain.', 'splash', 'swim');
      if (t.has('fly')) return ok('🌳', 'waits', 'tucks its wings and waits under a tree.', 'land', 'fly');
      if (t.has('warm')) return ok('💦', 'shakes', 'shakes the rain off its fur.', 'none', 'warm');
      return ok('☂️', 'stays dry', 'finds a dry spot under the leaves.', 'none');
    case 'wind':
      if (t.has('fly')) return ok('🪽', 'glides', 'glides on the wind.', 'none', 'fly');
      return ok('🍃', 'braces', 'leans into the wind.', 'brace');
    case 'fog': return ok('🌫️', 'sniffs', 'moves slowly and sniffs its way through the fog.', 'none');
    case 'rainbow': case 'meteors': return ok('🤩', 'amazed', 'watches the magic sky in wonder.', 'glow');
  }
  // The four seasons (Build Queue 120). Hard seasons first: winter cold for bodies with no warm fur,
  // summer heat for thick fur.
  if (x.season === 'Winter') {
    if (t.has('warm')) return ok('🧥', 'cozy', 'has its thick winter coat and stays cozy.', 'fluff', 'warm');
    if (t.has('swim')) return ok('🧊', 'under ice', 'swims slowly under the ice, where the water stays warmer.', 'dive', 'swim');
    if (t.has('fire')) return ok('🔥', 'toasty', 'stays toasty with its own fire.', 'bask', 'fire');
    if (t.has('magic')) return ok('✨', 'safe', 'is not bothered: its magic keeps it warm.', 'glow', 'magic');
    return hurt('🥶', 'chilly', 'is chilly in the winter cold. The shelter, a Thermo potion or a Somnus potion to hibernate will help.', 'chilly', 'shiver', 1, t.has('heat') ? 'A desert body is made for heat, not cold' : 'It has no thick fur');
  }
  if (x.season === 'Summer' && t.has('warm') && !t.has('heat') && !t.has('swim') && !t.has('magic') && x.biome !== 'snow') {
    return hurt('🥵', 'too hot', 'is too hot in its thick fur. The shelter or an Umbra potion gives it shade.', 'hot', 'shiver', 1, 'Thick fur is made for cold');
  }
  if (x.night) return t.has('night') ? ok('🌙', 'explores', 'wakes up and explores: it is a night creature.', 'glow', 'night') : ok('💤', 'sleeps', 'curls up to sleep for the night.', 'sleep');
  if (x.season === 'Spring') {
    if (breedsIn(c) === 'Spring') return ok('🥚', t.has('swim') ? 'spawning' : 'nesting', t.has('swim') ? 'lays eggs in the spring water. It is spawning time!' : 'builds a nest. Spring is its nesting time!', 'none', t.has('swim') ? 'swim' : 'fly');
    if (c.eats === 'plants' || c.eats === 'both') return ok('🌸', 'munches', 'munches fresh spring flowers and new leaves.', 'none');
  }
  if (x.season === 'Summer') {
    if (t.has('heat') || t.has('fire')) return ok('☀️', 'basks', 'basks in the long, hot summer days.', 'bask', t.has('heat') ? 'heat' : 'fire');
    if (t.has('swim')) return ok('💦', 'cools off', 'cools off in the summer pond.', 'splash', 'swim');
  }
  if (x.season === 'Fall') {
    if (t.has('fly')) return ok('🍂', 'gets ready', 'flies on the cool fall wind, getting ready for winter.', 'none', 'fly');
    if (t.has('warm')) return ok('🍂', 'thick coat', 'starts growing its thick winter coat.', 'fluff', 'warm');
    if (c.eats === 'plants' || c.eats === 'both') return ok('🌰', 'gathers', 'gathers seeds and nuts to save for winter.', 'none');
  }
  if (!c.likes.includes(x.biome as Biome) && !t.has('swim')) return { icon: '🏠', word: 'homesick', text: `${n} misses its favorite land: ${c.likes.join(', ')}.`, hit: 0, status: 'homesick', pose: 'none' };
  if (x.biome === 'desert' && t.has('heat')) return ok('☀️', 'basks', 'soaks up the hot sun.', 'bask', 'heat');
  return ok('😊', 'at home', `feels at home in the ${x.biome}.`, 'none');
}
