// Build Queue 397 (her words: "the current pet assets will need to be updated due to incorrectly applied animations,
// glitches in movement including walking through the ground and assets. this happens for both cats and dogs").
// Pet packs name their clips very differently ("Idle", "Armature|Idle", "AnimalArmature|Idle", "iddle"), and some packs
// list reaction clips first ("Idle_HitReact_Left"), so a plain "contains idle" search picked a hit reaction as the
// Husky and Shiba Inu's resting loop. These pick the real idle and the real walk, never a reaction, attack or death.
const BAD = /hit|react|death|die|attack|eat|jump|headlow|sent/i;
const base = (n: string) => n.split('|').pop()!.toLowerCase();
export function pickIdle(names: string[]): string | undefined {
  const ok = names.filter((n) => !BAD.test(base(n)));
  return ok.find((n) => base(n) === 'idle') ?? ok.find((n) => base(n) === 'iddle') ?? ok.find((n) => /^idle/.test(base(n))) ?? ok.find((n) => /idle|iddle/.test(base(n)));
}
export function pickWalk(names: string[]): string | undefined {
  const ok = names.filter((n) => !BAD.test(base(n)));
  return ok.find((n) => base(n) === 'walk') ?? ok.find((n) => /^walk/.test(base(n))) ?? ok.find((n) => /walk|trot/.test(base(n))) ?? ok.find((n) => /gallop|run/.test(base(n)));
}
// How far to raise (or lower) a model so its lowest point sits exactly on the ground, in world units after scaling.
// Some pets are modeled around their middle (the Poodle and Beagle hang half below their origin), and some float above
// it (the Great Dane), which made them walk through the ground or hover over it.
export const footLiftFor = (minY: number, scale: number) => (isFinite(minY) ? -minY * scale : 0);
