// Every creature acts like itself (Build Queue 135, her words, 2026-10-14: "make sure creatures have their
// interactions specific to them, like anubis the god should not act the same as a regular dog"). Each
// creature has a way of moving (gods glide with a glow, giants stomp, tricksters prowl) and its own
// actions from its story, some with a real effect in the Habitat: healing a friend, helping plants
// grow, a splash, a flash of lightning, a rumble. Made creatures and anyone not listed act from their
// bodies.
import type { Creature } from './supernatureCreatures';
import { tagsOf } from './supernatureAdapt';

export type Style = 'divine' | 'stomp' | 'prowl' | 'hop' | 'glide' | 'none';
export type Fx = 'heal' | 'grow' | 'splash' | 'flash' | 'rumble' | 'glow' | 'hide' | 'howl';
export interface Act { icon: string; text: string; fx?: Fx; night?: boolean }
interface B { style: Style; acts: Act[] }
const BEHAVIOR: Record<string, B> = {
  zeus: { style: 'divine', acts: [{ icon: '⚡', text: 'throws a tiny thunderbolt into the sky', fx: 'flash' }, { icon: '🏛️', text: 'watches over everyone from a cloud', fx: 'glow' }] },
  athena: { style: 'divine', acts: [{ icon: '🦉', text: 'shares wise advice with a young creature', fx: 'heal' }, { icon: '🫒', text: 'plants an olive tree seed', fx: 'grow' }] },
  poseidon: { style: 'divine', acts: [{ icon: '🔱', text: 'taps his trident and makes a wave', fx: 'splash' }, { icon: '🐎', text: 'calls a sea horse to play', fx: 'glow' }] },
  artemis: { style: 'divine', acts: [{ icon: '🏹', text: 'keeps watch over the wild animals', fx: 'glow' }, { icon: '🌙', text: 'walks in the moonlight with her deer', fx: 'glow', night: true }] },
  ra: { style: 'divine', acts: [{ icon: '☀️', text: 'makes the sun glow a little brighter', fx: 'glow' }, { icon: '🌅', text: 'sails his sun boat across the sky', fx: 'glow' }] },
  anubis: { style: 'divine', acts: [{ icon: '⚖️', text: 'weighs a feather on his golden scale', fx: 'glow' }, { icon: '🛡️', text: 'guards the shelter so everyone inside is safe', fx: 'glow' }, { icon: '🌙', text: 'guides lost creatures home in the dark', fx: 'heal', night: true }] },
  isis: { style: 'divine', acts: [{ icon: '🪽', text: 'spreads her wings and heals a friend', fx: 'heal' }, { icon: '✨', text: 'whispers a magic word of protection', fx: 'glow' }] },
  bastet: { style: 'divine', acts: [{ icon: '🐈', text: 'protects the homes like a guardian cat', fx: 'glow' }, { icon: '🎵', text: 'shakes her sistrum rattle and everyone feels happy', fx: 'heal' }] },
  jupiter: { style: 'divine', acts: [{ icon: '⚡', text: 'rumbles the sky with thunder', fx: 'flash' }, { icon: '🦅', text: 'sends his eagle to look around', fx: 'glow' }] },
  mars: { style: 'divine', acts: [{ icon: '🛡️', text: 'stands guard in shining armor', fx: 'glow' }, { icon: '🌾', text: 'helps the fields grow (he was a farm god first)', fx: 'grow' }] },
  janus: { style: 'divine', acts: [{ icon: '🚪', text: 'looks to the past and the future at the same time', fx: 'glow' }, { icon: '🔑', text: 'opens a new door for the new season', fx: 'glow' }] },
  cerberus: { style: 'prowl', acts: [{ icon: '👃', text: 'sniffs with all three noses at once', fx: 'glow' }, { icon: '🛡️', text: 'guards the gate and will not let predators in', fx: 'glow' }] },
  cyclops: { style: 'stomp', acts: [{ icon: '🔨', text: 'hammers on his forge', fx: 'rumble' }, { icon: '👁️', text: 'looks very closely with his one big eye', fx: 'glow' }] },
  ogre: { style: 'stomp', acts: [{ icon: '🪵', text: 'stomps around and the ground shakes', fx: 'rumble' }, { icon: '🍲', text: 'stirs a big pot of swamp stew', fx: 'glow' }] },
  minotaur: { style: 'stomp', acts: [{ icon: '🌀', text: 'walks a maze path only he knows', fx: 'glow' }, { icon: '🐂', text: 'snorts and paws the ground', fx: 'rumble' }] },
  medusa: { style: 'glide', acts: [{ icon: '🐍', text: 'her snake hair hisses hello', fx: 'glow' }, { icon: '🕶️', text: 'wears sunglasses so nobody turns to stone', fx: 'glow' }] },
  demon: { style: 'prowl', acts: [{ icon: '🔥', text: 'juggles little flames', fx: 'glow' }, { icon: '😈', text: 'plays a harmless trick', fx: 'hide' }] },
  jinn: { style: 'glide', acts: [{ icon: '🌪️', text: 'swirls out of the air in a puff of smoke', fx: 'hide' }, { icon: '✨', text: 'grants a tiny wish: a friend feels better', fx: 'heal' }] },
  unicorn: { style: 'glide', acts: [{ icon: '🦄', text: 'touches a friend with its horn and heals it', fx: 'heal' }, { icon: '🌈', text: 'leaves a rainbow trail', fx: 'glow' }] },
  dragon: { style: 'stomp', acts: [{ icon: '🔥', text: 'breathes a warm puff of fire into the sky', fx: 'glow' }, { icon: '💎', text: 'counts its treasure', fx: 'glow' }] },
  longdragon: { style: 'glide', acts: [{ icon: '🌧️', text: 'brings gentle rain for the plants', fx: 'grow' }, { icon: '🐉', text: 'dances through the clouds', fx: 'glow' }] },
  fairy: { style: 'glide', acts: [{ icon: '✨', text: 'sprinkles fairy dust and a plant grows', fx: 'grow' }, { icon: '🌸', text: 'paints a flower a new color', fx: 'glow' }] },
  pixie: { style: 'glide', acts: [{ icon: '🫣', text: 'hides and giggles', fx: 'hide' }, { icon: '🍄', text: 'dances in a mushroom ring and a plant sprouts', fx: 'grow' }] },
  golem: { style: 'stomp', acts: [{ icon: '⛰️', text: 'sinks into the ground with earth magic', fx: 'hide' }, { icon: '🪨', text: 'stomps and the ground rumbles', fx: 'rumble' }] },
  troll: { style: 'stomp', acts: [{ icon: '🌉', text: 'guards a bridge and asks for a riddle', fx: 'glow' }, { icon: '🪨', text: 'stands so still he looks like a rock', fx: 'hide' }] },
  raven: { style: 'glide', acts: [{ icon: '🧩', text: 'solves a puzzle to get a snack', fx: 'glow' }, { icon: '✨', text: 'collects something shiny', fx: 'glow' }] },
  thunderbird: { style: 'glide', acts: [{ icon: '⚡', text: 'flaps its giant wings and thunder rolls', fx: 'flash' }, { icon: '🌩️', text: 'brings the rain clouds', fx: 'grow' }] },
  siren: { style: 'glide', acts: [{ icon: '🎵', text: 'sings a song that calms everyone', fx: 'heal' }, { icon: '🌊', text: 'splashes on a rock', fx: 'splash' }] },
  pegasus: { style: 'glide', acts: [{ icon: '🪽', text: 'gallops across the sky', fx: 'glow' }, { icon: '💧', text: 'stamps a hoof and a spring of water appears', fx: 'grow' }] },
  phoenix: { style: 'glide', acts: [{ icon: '🔥', text: 'glows bright and warm', fx: 'glow' }, { icon: '💛', text: 'sheds a healing tear on a friend', fx: 'heal' }] },
  hydra: { style: 'prowl', acts: [{ icon: '🐍', text: 'all its heads argue about which way to go', fx: 'glow' }, { icon: '🌊', text: 'splashes in the water', fx: 'splash' }] },
  kraken: { style: 'glide', acts: [{ icon: '🐙', text: 'hides in a cloud of ink', fx: 'hide' }, { icon: '🌊', text: 'waves a giant arm and makes waves', fx: 'splash' }] },
  nessie: { style: 'glide', acts: [{ icon: '🫧', text: 'peeks its head out of the water', fx: 'splash' }, { icon: '🫣', text: 'dives before anyone can take a picture', fx: 'hide' }] },
  champ: { style: 'glide', acts: [{ icon: '🫧', text: 'swims up from the bottom of Lake Champlain', fx: 'splash' }, { icon: '🫣', text: 'hides from the boats', fx: 'hide' }] },
  kappa: { style: 'hop', acts: [{ icon: '🥒', text: 'eats a cucumber, its favorite snack', fx: 'glow' }, { icon: '🙇', text: 'bows politely (careful: the water on its head!)', fx: 'glow' }] },
  umibozu: { style: 'glide', acts: [{ icon: '🌊', text: 'rises out of the sea like a giant wave', fx: 'splash' }, { icon: '🌫️', text: 'fades into the sea mist', fx: 'hide' }] },
  mermaid: { style: 'glide', acts: [{ icon: '🐚', text: 'sings into a seashell', fx: 'heal' }, { icon: '🌊', text: 'flips her tail and splashes', fx: 'splash' }] },
  bunyip: { style: 'prowl', acts: [{ icon: '🔊', text: 'booms a deep call from the billabong', fx: 'howl', night: true }, { icon: '🫣', text: 'hides in the reeds', fx: 'hide' }] },
  sphinx: { style: 'divine', acts: [{ icon: '❓', text: 'asks a riddle and waits for an answer', fx: 'glow' }, { icon: '🏜️', text: 'rests in the warm sand like a guardian', fx: 'glow' }] },
  centaur: { style: 'prowl', acts: [{ icon: '🔭', text: 'reads the stars', fx: 'glow', night: true }, { icon: '📚', text: 'teaches a young creature something new', fx: 'heal' }] },
  chimera: { style: 'prowl', acts: [{ icon: '🦁', text: 'roars, bleats and hisses all at once', fx: 'howl' }, { icon: '🔥', text: 'puffs a little flame', fx: 'glow' }] },
  griffin: { style: 'glide', acts: [{ icon: '💎', text: 'guards a nest of golden treasure', fx: 'glow' }, { icon: '🦅', text: 'soars high and looks for trouble', fx: 'glow' }] },
  jackalope: { style: 'hop', acts: [{ icon: '🎵', text: 'sings along in a copy-cat voice', fx: 'glow' }, { icon: '🫣', text: 'hops away and hides', fx: 'hide' }] },
  werewolf: { style: 'prowl', acts: [{ icon: '🌕', text: 'howls at the full moon', fx: 'howl', night: true }, { icon: '👃', text: 'sniffs the air for trouble', fx: 'glow' }] },
  selkie: { style: 'hop', acts: [{ icon: '🦭', text: 'slips off its seal coat and walks on the beach', fx: 'glow' }, { icon: '🌊', text: 'dives back into the sea', fx: 'splash' }] },
  curupira: { style: 'prowl', acts: [{ icon: '👣', text: 'leaves backward footprints to trick predators', fx: 'hide' }, { icon: '🌳', text: 'protects the forest and a plant grows', fx: 'grow' }] },
  kitsune: { style: 'prowl', acts: [{ icon: '🦊', text: 'plays a clever fox trick', fx: 'hide' }, { icon: '🔥', text: 'lights a little foxfire', fx: 'glow', night: true }] },
  anansi: { style: 'prowl', acts: [{ icon: '🕸️', text: 'spins a web and tells a story', fx: 'glow' }, { icon: '🧠', text: 'thinks up a clever plan', fx: 'glow' }] },
  yeti: { style: 'stomp', acts: [{ icon: '❄️', text: 'makes a snow angel', fx: 'glow' }, { icon: '👣', text: 'leaves giant footprints in the snow', fx: 'rumble' }] },
  bigfoot: { style: 'stomp', acts: [{ icon: '👣', text: 'leaves big footprints in the mud', fx: 'rumble' }, { icon: '🌲', text: 'hides behind a tree', fx: 'hide' }] },
};
export function behaviorOf(c: Creature): B {
  if (BEHAVIOR[c.id]) return BEHAVIOR[c.id];
  const t = tagsOf(c);
  const acts: Act[] = [];
  if (t.has('swim')) acts.push({ icon: '🌊', text: 'splashes around', fx: 'splash' });
  if (t.has('fly')) acts.push({ icon: '🪽', text: 'flies a loop in the sky', fx: 'glow' });
  if (t.has('fire')) acts.push({ icon: '🔥', text: 'glows warm', fx: 'glow' });
  if (t.has('night')) acts.push({ icon: '🌙', text: 'explores in the dark', fx: 'glow', night: true });
  if (c.eats === 'plants' || c.eats === 'both') acts.push({ icon: '🌿', text: 'looks for tasty plants', fx: 'glow' });
  if (!acts.length) acts.push({ icon: '👀', text: 'looks around its home', fx: 'glow' });
  return { style: t.has('fly') || t.has('float') ? 'glide' : 'none', acts };
}
