// Data for Homeplot's launch quest, "Meet the Neighbors" (§First quest in
// the Homeplot plan) — the capped, sequenced set of 4 Neighbors a
// brand-new student meets, guided by the Fox. Kept as plain data (not
// scattered through the scene component) so authoring/editing the quest
// later never means touching rendering code.

// A response the student can pick. Plain text converges to the next step
// in the array (today's only shape, still fully supported). Passing an
// object with `next` instead branches to the step with that id, so a
// pick can lead somewhere genuinely different rather than everything
// funneling back into one shared line — the engine upgrade Claudia's
// conversation-frameworks guide flagged as the highest-leverage one (real
// reflection/consequence responses need this). No existing dialogue below
// uses it yet; it's here so future authoring doesn't need another engine
// change first.
export interface ConversationOption {
  text: string;
  next?: string;
}

// One back-and-forth turn of a conversation. If options is present the
// student picks one of 2-3 short responses instead of a plain Continue
// button — direct teacher instruction: real conversations, not a single
// greeting line, at least 4 exchanges, with the student given choices. A
// step with no options is a closing line: the button underneath ends the
// conversation (and, for a Neighbor's first conversation, grants the
// quest reward) rather than advancing further, regardless of which
// branch led there.
export interface ConversationStep {
  id?: string;
  npc: string;
  options?: (string | ConversationOption)[];
  // Marks this step as a joke's punchline. The first time a student
  // reaches it, the engine banks jokeBookEntry into their permanent Joke
  // Book (viewable from the inventory hotbar) and pays a small one-time
  // bonus — never again for the same jokeId, and never tied to which
  // option got them here (reinforce the attempt, not "the best answer").
  jokeId?: string;
  jokeBookEntry?: { npcName: string; setup: string; punchline: string; explain: string };
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
      { npc: "Before you run off, want to hear why my bike couldn't take me around town today?", options: ["Sure.", "What happened to it?"] },
      { npc: "It kept tipping over. Every single time. Want to guess why?", options: ["Flat tire?", "Is it broken?", "Why?"] },
      {
        npc: "It was two tired.",
        jokeId: 'scout-two-tired',
        jokeBookEntry: { npcName: 'Scout', setup: 'Why did my bike keep tipping over?', punchline: 'It was two tired.', explain: 'A bike has two tires, and too tired means you need a nap. Two and too sound exactly the same.' },
        options: ["Two tires!", "Too tired!", "Wait, which one?"],
      },
      { npc: "Both! A bike has two tires, and too tired means you need a nap. Two and too sound exactly the same.", options: ["Nice one, Scout.", "I get it."] },
      { npc: "So we're walking. Use WASD or the arrow keys, or just click the grass where you want to go. If you ever get turned around, come find me. See you out there!" },
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
      { npc: "I've been saving something for you. Not money this time, a riddle. Want to hear it?", options: ["A riddle? Okay!", "Let's hear it."] },
      { npc: "Why did the penny go to school?", options: ["To learn math?", "To get smarter?", "I give up, why?"] },
      {
        npc: "To get a little more cents!",
        jokeId: 'penny-more-cents',
        jokeBookEntry: { npcName: 'Penny', setup: 'Why did the penny go to school?', punchline: 'To get a little more cents!', explain: 'Cents is money, like five cents. Sense means being smart, like good sense. They sound exactly the same.' },
        options: ["Cents like coins?", "Oh! Cents and sense.", "Say that again?"],
      },
      { npc: "Cents is money, like five cents. Sense means being smart, like good sense. They sound exactly the same. That's the whole trick.", options: ["That's a good one.", "Got it."] },
      { npc: "Speaking of cents, I run the Bank right over there. Every coin you earn is really yours to keep, and you can come check your balance anytime.", options: ["I'll do that!"] },
      { npc: "I'll have a new joke tomorrow, free of charge. That's rare from a banker. See you around!" },
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
      {
        npc: "Oh good, a customer! Quick, guess which thing sold out at my store this morning.",
        options: [
          { text: "Snacks?", next: 'pip-snack' },
          { text: "Hats?", next: 'pip-hat' },
          { text: "No idea.", next: 'pip-shrug' },
        ],
      },
      { id: 'pip-snack', npc: "Snacks? Solid guess. But no, the snacks are still sitting right there looking lonely.", options: [{ text: "Okay, tell me.", next: 'pip-reveal' }] },
      { id: 'pip-hat', npc: "Hats? Not even close. Nobody's bought a hat since Tuesday and I'm taking it personally.", options: [{ text: "So what was it?", next: 'pip-reveal' }] },
      { id: 'pip-shrug', npc: "That's fair, it surprised me too and I own the place.", options: [{ text: "Tell me!", next: 'pip-reveal' }] },
      {
        id: 'pip-reveal',
        npc: "It was the brooms. Every single broom. They flew off the shelves.",
        jokeId: 'pip-brooms',
        jokeBookEntry: { npcName: 'Pip', setup: 'What sold out at my store?', punchline: 'The brooms. They flew off the shelves.', explain: 'When something sells fast, people say it flew off the shelves. And brooms fly. One sentence, two meanings.' },
        options: ["Wait, flew?", "Because brooms fly!", "Ha!"],
      },
      { npc: "Exactly. When something sells fast, people say it flew off the shelves. And brooms fly. One sentence, two meanings.", options: ["That's a good one, Pip.", "I'm using that later."] },
      { npc: "I run the Store just over there. Same stuff every day, so you always know what you'll find, and you can spend your coins there anytime.", options: ["Sounds fun!"] },
      { npc: "Take it with you, it's free. Everything else is full price. See you later!" },
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
      { npc: "Hey, perfect timing. I've got one knock knock joke in the bag today and it's got your name on it.", options: ["Let's hear it!", "A joke in the mail?"] },
      { npc: "Knock knock.", options: ["Who's there?", "Who is it?"] },
      { npc: "Letter.", options: ["Letter who?"] },
      {
        npc: "Letter go, I'm late for my route! Get it? Letter is a thing you mail, and let her sounds exactly the same.",
        jokeId: 'wren-letter-go',
        jokeBookEntry: { npcName: 'Wren', setup: 'Knock knock. Who\'s there? Letter.', punchline: 'Letter go, I\'m late for my route!', explain: 'Letter is a thing you mail, and let her sounds exactly the same.' },
        options: ["Ha, letter go.", "That's a good one.", "I saw that coming."],
      },
      { npc: "Good to hear it. I deliver the mail all over town, and the Post Office is right over there.", options: ["That sounds like fun.", "Do I get any mail?"] },
      { npc: "As a matter of fact, yes! Here, this is for you.", options: ["Thank you, Wren!"] },
      { npc: "Ten out of ten delivery. Come find me tomorrow, I'll have a fresh one. Take care!" },
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
