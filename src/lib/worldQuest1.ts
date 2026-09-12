// Data for Homeplot's launch quest, "Meet the Neighbors" (§First quest in
// the Homeplot plan) — the capped, sequenced set of 4 Neighbors a
// brand-new student meets, guided by the Fox. Kept as plain data (not
// scattered through the scene component) so authoring/editing the quest
// later never means touching rendering code.

export interface Quest1Neighbor {
  id: string;
  name: string;
  role: string;
  greeting: string;
  // One short, real fall/autumn-themed house item per Neighbor — the
  // per-step reward described in the plan. No real decor-catalog item
  // exists yet to attach this to, so it's paid as its cash equivalent for
  // now; swapping in a real placeable item is a follow-up, not a new
  // system (§Sequencing & handoff, Phase 0's "fully autonomous" lane).
  itemLabel: string;
  itemRewardCents: number;
  // Position in the demo room (meters, x/z on the floor plane).
  position: [number, number];
  // A real Kenney Mini Characters model (CC0) — swapped in for the
  // placeholder capsule. Scale/facing were set without being able to see
  // this render live in this environment (no local Supabase credentials
  // to get past student login here), so treat the exact size/rotation as
  // a first guess worth a quick visual check, not a verified value.
  modelPath: string;
}

export const QUEST1_NEIGHBORS: Quest1Neighbor[] = [
  {
    id: 'scout',
    name: 'Scout',
    role: 'shows you around',
    greeting: "Hi, I'm Scout! I show new folks around Yoglandia. Walk with WASD or the arrows, and press E near someone to talk!",
    itemLabel: 'a little pile of fall leaves',
    itemRewardCents: 25,
    position: [-8, -6],
    modelPath: '/world/models/characters/neighbor-scout.glb',
  },
  {
    id: 'penny',
    name: 'Penny',
    role: 'the Banker',
    greeting: "Welcome! I'm Penny, I run the Bank. Every bit of Class Cash you earn is real and it's yours. Come see me anytime.",
    itemLabel: 'a cozy autumn welcome mat',
    itemRewardCents: 25,
    position: [8, -6],
    modelPath: '/world/models/characters/neighbor-penny.glb',
  },
  {
    id: 'pip',
    name: 'Pip',
    role: 'the Shopkeeper',
    greeting: "Hiya, I'm Pip! I run the Store. Same stuff every day, so you always know what you'll find.",
    itemLabel: 'a small pumpkin for your shelf',
    itemRewardCents: 25,
    position: [-8, 6],
    modelPath: '/world/models/characters/neighbor-pip.glb',
  },
  {
    id: 'wren',
    name: 'Wren',
    role: 'the Mail Carrier',
    greeting: "Hey there, I'm Wren! I deliver the mail all over town. Keep an eye on your mailbox, I'll have something for you soon.",
    itemLabel: 'a string of fall leaf garland',
    itemRewardCents: 25,
    position: [8, 6],
    modelPath: '/world/models/characters/neighbor-wren.glb',
  },
];

export const QUEST1_NEIGHBOR_COUNT = QUEST1_NEIGHBORS.length;
export const QUEST1_GRAND_PRIZE_CENTS = 20000; // $200
