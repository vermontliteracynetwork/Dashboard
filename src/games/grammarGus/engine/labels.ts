import type { HousingId } from './machine';
import { SLOT_BY_KEY, HOUSINGS } from './machine';

// Brackets and Label It! (plan 18.7). The bracket plates come straight
// from the machine: every housing on the machine is one plate, and the
// plate covers the words in that housing.
export interface Plate { housing: HousingId; label: string; indices: number[] }
const housingOf = (key: string): HousingId => (key === 'who.pron' ? 'who' : SLOT_BY_KEY.get(key)!.housing);
export function platesFor(keys: string[]): Plate[] {
  const out: Plate[] = [];
  keys.forEach((k, i) => {
    const h = housingOf(k);
    const p = out.find((x) => x.housing === h);
    if (p) p.indices.push(i);
    else out.push({ housing: h, label: HOUSINGS.find((x) => x.id === h)!.label, indices: [i] });
  });
  return out;
}

// Kid hints for a wrong drop (plan 18.7: no score loss, Gus helps).
export const PLATE_HINTS: Record<HousingId, string> = {
  shout: 'SHOUT is the word someone yells, with its own !',
  who: 'WHO is the one doing it. Which pieces tell WHO?',
  did: 'WHAT THEY DID is the action word.',
  obj: 'WHAT IT HAPPENED TO comes right after the action. What got it?',
  how: 'HOW THEY DID IT is the word that tells how. It often ends in -ly.',
  where: 'WHERE starts with a where-word like over or under, then names a place.',
};
