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
  // Several complete, independent conversations rather than one fixed
  // script — direct teacher feedback that every talk being a joke got
  // stale, and that jokes should stay fresh across repeat visits instead
  // of replaying the exact same punchline every time. pickDialogueVariant
  // below picks which one plays; every variant still carries the same
  // core informational content, so which one a student gets never means
  // missing something they needed to hear.
  dialogues: ConversationStep[][];
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

// Picks which conversation variant plays this time. Prioritizes a variant
// whose joke the student hasn't collected yet, so repeat visits keep
// surfacing something new (direct instruction: "keep fresh jokes every
// time, don't repeat") — this reads straight off the same worldJokesHeardIds
// already synced for the Joke Book, so it needs no extra Student field of
// its own. Once every joke a Neighbor/Townsperson knows has already been
// collected, it falls back to a day-varying pick across every variant
// (jokes and plain small talk alike) rather than only ever replaying the
// same one — which is also how the plain, joke-free variant naturally
// gets its turn instead of being permanently crowded out (the other half
// of that instruction: "not all communication needs to be jokes").
export function pickDialogueVariant(variants: ConversationStep[][], heardJokeIds: string[]): ConversationStep[] {
  const unheard = variants.find((v) => {
    const jokeStep = v.find((s) => s.jokeId);
    return jokeStep && !heardJokeIds.includes(jokeStep.jokeId!);
  });
  if (unheard) return unheard;
  const dayIndex = Math.floor(Date.now() / 86400000);
  return variants[dayIndex % variants.length];
}

export const QUEST1_NEIGHBORS: Quest1Neighbor[] = [
  {
    id: 'scout',
    name: 'Scout',
    role: 'shows you around',
    dialogues: [
      [
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
      [
        { npc: "Hey, you're back!", options: ["Hi Scout!", "Hey!"] },
        { npc: "I found a good one on my walk this morning. Want to hear it?", options: ["Sure!", "Go for it."] },
        { npc: "What do you call a bear with no teeth?", options: ["No idea.", "A gummy bear?", "Something silly?"] },
        {
          npc: "A gummy bear!",
          jokeId: 'scout-gummy-bear',
          jokeBookEntry: { npcName: 'Scout', setup: 'What do you call a bear with no teeth?', punchline: 'A gummy bear!', explain: 'Gummy bears are a chewy candy, and gummy also describes having no teeth. Same word, two meanings.' },
          options: ["Ha, gummy!", "Good one.", "I get it."],
        },
        { npc: "That's the whole joke. See you around town!" },
      ],
      [
        { npc: "Hey, good to see you out here.", options: ["Hi Scout!", "Hey Scout."] },
        { npc: "How's your day going so far?", options: ["Pretty good.", "Just exploring.", "Okay, I guess."] },
        { npc: "Good to hear. The roads through town got fixed up recently, so it's a lot easier to get around than it used to be.", options: ["Nice.", "I noticed that."] },
        { npc: "If you ever get turned around, just come find me. Have fun out there!" },
      ],
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
    dialogues: [
      [
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
      [
        { npc: "Back again! Welcome back to the Bank corner.", options: ["Hi Penny!", "Hey!"] },
        { npc: "Got a new one for you today. Why don't banks ever get robbed by ghosts?", options: ["No idea.", "Why?", "Are ghosts scared of banks?"] },
        {
          npc: "Because ghosts can't carry cash, they're too transparent!",
          jokeId: 'penny-transparent',
          jokeBookEntry: { npcName: 'Penny', setup: "Why don't banks ever get robbed by ghosts?", punchline: "They can't carry cash, they're too transparent!", explain: 'Transparent means see-through, like a ghost. It also means honest and easy to see through, like a plan. Same word, two ideas.' },
          options: ["Ha, transparent!", "Good one, Penny.", "I see what you did there."],
        },
        { npc: "That one took me all week. The Bank's right over there whenever you want to check your balance.", options: ["Thanks, Penny."] },
        { npc: "Come back tomorrow for another. See you around!" },
      ],
      [
        { npc: "Hello again! Come to check your balance?", options: ["Maybe later.", "Just saying hi."] },
        { npc: "That's alright, I'm always here. Business has been steady lately, nothing too exciting.", options: ["That's good, I guess.", "Boring is fine!"] },
        { npc: "Exactly, boring is good when it's money. Take care out there!" },
      ],
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
    dialogues: [
      [
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
      [
        { npc: "Oh, hey! Back for more?", options: ["Hi Pip!", "Hey there!"] },
        {
          npc: "Quick, before you go, why don't scarecrows ever get promoted at work?",
          options: [
            { text: "They're lazy?", next: 'pip2-lazy' },
            { text: "No idea.", next: 'pip2-reveal' },
          ],
        },
        { id: 'pip2-lazy', npc: "Nope, they work hard, always out in the field.", options: [{ text: "So why then?", next: 'pip2-reveal' }] },
        {
          id: 'pip2-reveal',
          npc: "They're outstanding in their field.",
          jokeId: 'pip-outstanding',
          jokeBookEntry: { npcName: 'Pip', setup: "Why don't scarecrows get promoted?", punchline: "They're outstanding in their field.", explain: 'Outstanding means excellent, and a scarecrow literally stands out in a field. Two meanings, one word.' },
          options: ["Ha, outstanding!", "Good one.", "I see it."],
        },
        { npc: "Told you it was a good one. The Store's right over there. Come back tomorrow!" },
      ],
      [
        { npc: "Hey, welcome back to the shop.", options: ["Hi Pip!", "Hey Pip."] },
        { npc: "Anything catch your eye today, or just browsing?", options: ["Just browsing.", "Maybe later."] },
        { npc: "No rush at all. Same stuff every day, so it'll still be here. See you around!" },
      ],
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
    dialogues: [
      [
        { npc: "Hey there! I'm Wren.", options: ["Hi Wren!", "Nice to meet you."] },
        { npc: "Hey, perfect timing. I've got one knock knock joke in the bag today and it's got your name on it.", options: ["Let's hear it!", "A joke in the mail?"] },
        { npc: "Knock knock.", options: ["Who's there?", "Who is it?"] },
        { npc: "Letter.", options: ["Letter who?"] },
        {
          npc: "Letter go, I'm late for my route! Get it? Letter is a thing you mail, and let her sounds exactly the same.",
          jokeId: 'wren-letter-go',
          jokeBookEntry: { npcName: 'Wren', setup: "Knock knock. Who's there? Letter.", punchline: "Letter go, I'm late for my route!", explain: 'Letter is a thing you mail, and let her sounds exactly the same.' },
          options: ["Ha, letter go.", "That's a good one.", "I saw that coming."],
        },
        { npc: "Good to hear it. I deliver the mail all over town, and the Post Office is right over there.", options: ["That sounds like fun.", "Do I get any mail?"] },
        { npc: "As a matter of fact, yes! Here, this is for you.", options: ["Thank you, Wren!"] },
        { npc: "Ten out of ten delivery. Come find me tomorrow, I'll have a fresh one. Take care!" },
      ],
      [
        { npc: "Oh, hi again!", options: ["Hi Wren!", "Hey!"] },
        { npc: "Got another one for the road. Ready?", options: ["Ready!", "Let's hear it."] },
        { npc: "Knock knock.", options: ["Who's there?"] },
        { npc: "Wooden.", options: ["Wooden who?"] },
        {
          npc: "Wooden you like to know! Get it? Wooden sounds just like wouldn't.",
          jokeId: 'wren-wooden',
          jokeBookEntry: { npcName: 'Wren', setup: "Knock knock. Who's there? Wooden.", punchline: "Wooden you like to know!", explain: "Wooden sounds just like wouldn't. Same sound, different spelling." },
          options: ["Ha, wooden!", "Good one.", "I saw it coming."],
        },
        { npc: "Ten out of ten. Catch you tomorrow!" },
      ],
      [
        { npc: "Hey, good timing, I was just passing through.", options: ["Hi Wren!", "Hey there!"] },
        { npc: "Big delivery day today, lots of packages.", options: ["Sounds busy.", "Need any help?"] },
        { npc: "I've got it covered, but thanks for asking. Take care!" },
      ],
    ],
    itemLabel: 'a string of fall leaf garland',
    itemRewardCents: 25,
    // Moved from [8,6] — Claudia's scale/layout review found Wren was
    // literally standing inside the pond's own collision circle (distance
    // to pond center 2.00 vs. the old POND_BLOCK_RADIUS 2.6), so walking
    // up to her pushed a student out to the shoreline. [10,6.5] puts her
    // on the East Park Path's own last tile instead.
    position: [10, 6.5],
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
