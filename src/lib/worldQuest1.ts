// Data for Homeplot's launch quest, "Meet the Neighbors" (§First quest in
// the Homeplot plan) — the capped, sequenced set of 4 Neighbors a
// brand-new student meets, guided by the Fox. Kept as plain data (not
// scattered through the scene component) so authoring/editing the quest
// later never means touching rendering code.

// One back-and-forth turn of a conversation. If options is present the
// student picks one of 2-3 short responses instead of a plain Continue
// button — direct teacher instruction: real conversations, not a single
// greeting line, at least 4 exchanges, with the student given choices.
// Every option currently leads to the same next line (the content itself
// is placeholder flavor, not yet the real ABA-authored dialogue the
// teacher's curriculum will eventually drive) but the shape already
// supports a per-option reply later without changing the engine.
export interface ConversationStep {
  npc: string;
  options?: string[];
}

export interface Quest1Neighbor {
  id: string;
  name: string;
  role: string;
  dialogue: ConversationStep[];
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
    dialogue: [
      { npc: "Hi! I'm Scout. Welcome to Yoglandia!", options: ["Hi Scout!", "Nice to meet you."] },
      { npc: "How are you doing today?", options: ["Pretty good!", "A little tired.", "Excited to look around!"] },
      { npc: "Good to hear. I show new folks around here, so if you ever get turned around, come find me.", options: ["Thanks, I will.", "Good to know."] },
      { npc: "One tip: walk with WASD or the arrow keys, or click anywhere on the grass to walk there.", options: ["Got it!"] },
      { npc: "Have fun exploring Yoglandia. See you around town!" },
    ],
    itemLabel: 'a little pile of fall leaves',
    itemRewardCents: 25,
    position: [-8, -6],
    modelPath: '/world/models/characters/neighbor-scout.glb',
  },
  {
    id: 'penny',
    name: 'Penny',
    role: 'the Banker',
    dialogue: [
      { npc: "Well hello there! I'm Penny.", options: ["Hi Penny!", "Nice to meet you."] },
      { npc: "How's your day going so far?", options: ["Pretty good!", "It's okay.", "Great, thanks for asking!"] },
      { npc: "Glad to hear it. I run the Bank right over there. Every coin you earn is really yours to keep.", options: ["That's cool!", "How do I earn coins?"] },
      { npc: "Finish your tasks and you'll see your balance grow. Come find me anytime you want to check it.", options: ["I'll do that!"] },
      { npc: "See you around, and good luck out there!" },
    ],
    itemLabel: 'a cozy autumn welcome mat',
    itemRewardCents: 25,
    position: [8, -6],
    modelPath: '/world/models/characters/neighbor-penny.glb',
  },
  {
    id: 'pip',
    name: 'Pip',
    role: 'the Shopkeeper',
    dialogue: [
      { npc: "Hiya! I'm Pip.", options: ["Hi Pip!", "Hey there!"] },
      { npc: "How are you today?", options: ["Doing well!", "A bit sleepy.", "Ready for a good day!"] },
      { npc: "Nice. I run the Store just over there. Same stuff every day, so you always know what you'll find.", options: ["Cool, I'll check it out.", "What do you sell?"] },
      { npc: "A little bit of everything. You can spend the coins you earn there whenever you like.", options: ["Sounds fun!"] },
      { npc: "Stop by anytime. See you later!" },
    ],
    itemLabel: 'a small pumpkin for your shelf',
    itemRewardCents: 25,
    position: [-8, 6],
    modelPath: '/world/models/characters/neighbor-pip.glb',
  },
  {
    id: 'wren',
    name: 'Wren',
    role: 'the Mail Carrier',
    dialogue: [
      { npc: "Hey there! I'm Wren.", options: ["Hi Wren!", "Nice to meet you."] },
      { npc: "How's it going with you today?", options: ["Going great!", "Pretty normal.", "Happy to be here!"] },
      { npc: "Good to hear it. I deliver the mail all over town, and the Post Office is right over there.", options: ["That sounds like fun.", "Do I get any mail?"] },
      { npc: "Keep an eye on your mailbox. I'll have something for you soon.", options: ["I'll watch for it!"] },
      { npc: "Take care, see you around!" },
    ],
    itemLabel: 'a string of fall leaf garland',
    itemRewardCents: 25,
    position: [8, 6],
    modelPath: '/world/models/characters/neighbor-wren.glb',
  },
];

export const QUEST1_NEIGHBOR_COUNT = QUEST1_NEIGHBORS.length;
// Claudia's review: at $200 this paid 200x a single completed academic
// task (DEFAULT_TASK_REWARD_CENTS in money.ts is $1), which teaches that
// walking around and talking is worth vastly more than real work. Sized
// instead as a nice one-time "you met everyone" milestone bonus — a few
// times a single task's reward, not an order of magnitude beyond it.
export const QUEST1_GRAND_PRIZE_CENTS = 500; // $5
