// The Feelings Wheel login check-in (Build Queue 233 and 234). Her feelings wheel with her 8 words
// removed (aroused, intimate, disillusioned, persecuted, victimized, indignant, and Humiliated and
// Disappointed from the Disgusted branch), three rings deep: the seven center feelings, then each
// one's own feelings, then theirs. Every word carries a Zones of Regulation zone, so the check-in
// still drives the zone tools, the Neighbor re-check and the teacher's reports. Pictures are hers
// (`public/sel/feelings/<feeling>.jpg`).
import type { SelZone } from '../types';

export interface FeelingNode { w: string; core: string; zone: SelZone; kids: FeelingNode[]; parent: FeelingNode | null }

// [word, zone] pairs; B blue, G green, Y yellow, R red.
type Z = 'B' | 'G' | 'Y' | 'R';
type Leaf = [string, Z];
type Mid = [string, Z, Leaf[]];
const TREE: [string, Z, Mid[]][] = [
  ['Fearful', 'Y', [
    ['Scared', 'Y', [['Helpless', 'B'], ['Frightened', 'R']]],
    ['Anxious', 'Y', [['Distraught', 'R'], ['Worried', 'Y']]],
    ['Insecure', 'Y', [['Inadequate', 'B'], ['Inferior', 'B']]],
    ['Weak', 'B', [['Worthless', 'B'], ['Insignificant', 'B']]],
    ['Rejected', 'B', [['Excluded', 'B']]],
    ['Threatened', 'R', [['Nervous', 'Y'], ['Exposed', 'Y']]],
  ]],
  ['Angry', 'R', [
    ['Let down', 'B', [['Betrayed', 'Y'], ['Resentful', 'Y']]],
    ['Humiliated', 'Y', [['Disrespected', 'Y'], ['Ridiculed', 'Y']]],
    ['Bitter', 'Y', [['Violated', 'R']]],
    ['Mad', 'R', [['Furious', 'R'], ['Jealous', 'Y']]],
    ['Aggressive', 'R', [['Provoked', 'R'], ['Hostile', 'R']]],
    ['Frustrated', 'Y', [['Infuriated', 'R'], ['Annoyed', 'Y']]],
    ['Distant', 'B', [['Withdrawn', 'B'], ['Numb', 'B']]],
    ['Critical', 'Y', [['Skeptical', 'Y'], ['Dismissive', 'Y']]],
  ]],
  ['Disgusted', 'Y', [
    ['Disapproving', 'Y', [['Judgmental', 'Y'], ['Appalled', 'Y']]],
    ['Awful', 'B', [['Nauseated', 'B'], ['Detestable', 'Y']]],
    ['Repelled', 'Y', [['Horrified', 'R'], ['Hesitant', 'Y'], ['Revolted', 'Y']]],
  ]],
  ['Sad', 'B', [
    ['Hurt', 'B', [['Embarrassed', 'Y'], ['Disappointed', 'B']]],
    ['Depressed', 'B', [['Empty', 'B'], ['Unimportant', 'B']]],
    ['Guilty', 'B', [['Ashamed', 'B'], ['Remorseful', 'B']]],
    ['Despair', 'B', [['Grief', 'B'], ['Powerless', 'B']]],
    ['Vulnerable', 'B', [['Fragile', 'B']]],
    ['Lonely', 'B', [['Isolated', 'B'], ['Abandoned', 'B']]],
  ]],
  ['Happy', 'G', [
    ['Playful', 'Y', [['Cheeky', 'Y']]],
    ['Content', 'G', [['Free', 'G'], ['Joyful', 'G']]],
    ['Interested', 'G', [['Curious', 'G'], ['Inquisitive', 'G']]],
    ['Proud', 'G', [['Successful', 'G'], ['Confident', 'G']]],
    ['Accepted', 'G', [['Respected', 'G'], ['Valued', 'G']]],
    ['Powerful', 'G', [['Courageous', 'G'], ['Creative', 'G']]],
    ['Peaceful', 'G', [['Loving', 'G'], ['Thankful', 'G']]],
    ['Trusting', 'G', [['Sensitive', 'Y']]],
    ['Optimistic', 'G', [['Hopeful', 'G'], ['Inspired', 'G']]],
  ]],
  ['Surprised', 'Y', [
    ['Excited', 'Y', [['Eager', 'Y'], ['Energetic', 'Y']]],
    ['Amazed', 'Y', [['Astonished', 'Y'], ['Awe', 'G']]],
    ['Confused', 'Y', [['Perplexed', 'Y']]],
    ['Startled', 'Y', [['Shocked', 'R'], ['Dismayed', 'Y']]],
  ]],
  ['Bad', 'B', [
    ['Bored', 'B', [['Indifferent', 'B'], ['Apathetic', 'B']]],
    ['Busy', 'Y', [['Pressured', 'Y'], ['Rushed', 'Y']]],
    ['Stressed', 'Y', [['Overwhelmed', 'Y'], ['Out of control', 'R']]],
    ['Tired', 'B', [['Sleepy', 'B'], ['Unfocused', 'Y']]],
  ]],
];

const ZONE: Record<Z, SelZone> = { B: 'blue', G: 'green', Y: 'yellow', R: 'red' };

export const FEELING_ROOTS: FeelingNode[] = TREE.map(([core, cz, mids]) => {
  const root: FeelingNode = { w: core, core, zone: ZONE[cz], kids: [], parent: null };
  root.kids = mids.map(([m, mz, leaves]) => {
    const mid: FeelingNode = { w: m, core, zone: ZONE[mz], kids: [], parent: root };
    mid.kids = leaves.map(([l, lz]) => ({ w: l, core, zone: ZONE[lz], kids: [], parent: mid }));
    return mid;
  });
  return root;
});

// Slice colors per center feeling: [main, lighter, deeper], after her wheel picture.
export const FEELING_FAMILY: Record<string, [string, string, string]> = {
  Fearful: ['#f2a531', '#f6bd5e', '#d98c1c'],
  Angry: ['#e5533c', '#ee7a64', '#c93f29'],
  Disgusted: ['#1fa39a', '#4bbdb4', '#15847c'],
  Sad: ['#3f7fd4', '#6a9fe2', '#2d67b6'],
  Happy: ['#8a63d2', '#a184e6', '#6f4cba'],
  Surprised: ['#e0609b', '#ea86b5', '#c84a83'],
  Bad: ['#3fa86b', '#62bf87', '#2e8f57'],
};

export const feelingImg = (w: string) => `/sel/feelings/${w.toLowerCase().replace(/ /g, '-')}.jpg`;

export const feelingPath = (n: FeelingNode): string[] => {
  const out: string[] = [];
  for (let p: FeelingNode | null = n; p; p = p.parent) out.unshift(p.w);
  return out;
};

// The energy step after the feeling (same five faces as the Supernature Habitat check). Saved on the
// check-in's feeling word as "Furious | high energy" so no new database column is needed; the app
// splits it back apart when it reads the row (see splitSelEmotion).
export const ENERGY_SEP = ' | ';
export const joinSelEmotion = (emotion: string, energy?: string) => (energy ? `${emotion}${ENERGY_SEP}${energy} energy` : emotion);
export function splitSelEmotion(raw: string): { emotion: string; energy?: string } {
  const i = raw.indexOf(ENERGY_SEP);
  if (i < 0) return { emotion: raw };
  return { emotion: raw.slice(0, i), energy: raw.slice(i + ENERGY_SEP.length).replace(/ energy$/, '') };
}
