// Data for the Townspeople — the always-wandering background characters in
// Town Square that aren't part of the Neighbors quest. Direct teacher
// instruction: every one of them should have a name, be clickable, and have
// small-talk chat (weather, the store, other townspeople) as a scaffold for
// real ABA/SEL content later. Kept as plain data, same pattern as
// worldQuest1.ts, so authoring conversations never means touching rendering
// code.

import type { ConversationStep } from './worldQuest1';

export interface Townsperson {
  id: string;
  name: string;
  dialogue: ConversationStep[];
}

// Keyed by the same id used in TownSquare's AMBIENT_NPCS list.
export const TOWNSPEOPLE: Record<string, Townsperson> = {
  'amb-1': {
    id: 'amb-1',
    name: 'Miller',
    dialogue: [
      { npc: "Oh, hello! I'm Miller.", options: ["Hi Miller!", "Hey there!"] },
      { npc: "I was just heading to the store but I've always got time for one joke. Want it?", options: ["Yes!", "One joke, go."] },
      { npc: "Why did the loaf of bread go to the doctor?", options: ["Was it sick?", "Too much butter?", "I don't know, why?"] },
      {
        npc: "It was feeling crummy!",
        jokeId: 'miller-crummy',
        jokeBookEntry: { npcName: 'Miller', setup: 'Why did the loaf of bread go to the doctor?', punchline: 'It was feeling crummy!', explain: 'Crummy means feeling bad or kind of lousy. And bread makes crumbs. One word, two meanings.' },
        options: ["Crumbs!", "Ha, crummy.", "Explain that one?"],
      },
      { npc: "Crummy means feeling bad or kind of lousy. And bread makes crumbs. One word, two meanings.", options: ["Got it.", "That's pretty good."] },
      { npc: "I was heading over to the Store to see what Pip's got in today. Same good stuff every day, so you always know what to expect there.", options: ["Say hi to Pip for me."] },
      { npc: "I'll find a new joke by tomorrow. Off to the store! See you around." },
    ],
  },
  'amb-2': {
    id: 'amb-2',
    name: 'Rosa',
    dialogue: [
      { npc: "Hi there, I'm Rosa!", options: ["Hi Rosa!", "Nice to meet you."] },
      { npc: "I've been practicing a joke all morning. Do you want to be my test audience?", options: ["Yes please.", "You've been practicing?"] },
      { npc: "Knock knock.", options: ["Who's there?", "Who is it?"] },
      { npc: "Boo.", options: ["Boo who?"] },
      {
        npc: "Aw, don't cry, it's only a joke! Get it? Boo who sounds like boo hoo, and boo hoo is a crying sound.",
        jokeId: 'rosa-boo-hoo',
        jokeBookEntry: { npcName: 'Rosa', setup: 'Knock knock. Who\'s there? Boo.', punchline: 'Boo who? Aw, don\'t cry, it\'s only a joke!', explain: 'Boo who sounds like boo hoo, and boo hoo is a crying sound.' },
        options: ["That got me.", "Boo hoo!", "I'm not crying, you're crying."],
      },
      { npc: "Have you met Wren yet? They deliver the mail all over town, always easy to spot near the Post Office.", options: ["Thanks for the tip!"] },
      { npc: "I've been waiting all day to use that one. Worth it. Take care, I'll see you around!" },
    ],
  },
  'amb-3': {
    id: 'amb-3',
    name: 'Jasper',
    dialogue: [
      { npc: "Hey, I'm Jasper.", options: ["Hi Jasper!", "Hey!"] },
      {
        npc: "I've been watching that pond all morning and I figured something out. Want to know why fish are so smart?",
        options: [
          { text: "They read a lot?", next: 'jasper-read' },
          { text: "Brain food?", next: 'jasper-food' },
          { text: "Just tell me!", next: 'jasper-reveal' },
        ],
      },
      { id: 'jasper-read', npc: "Reading! I like that answer. But have you ever seen a fish hold a book? No hands. Big problem.", options: [{ text: "Good point.", next: 'jasper-reveal' }] },
      { id: 'jasper-food', npc: "Brain food! Ha. Pretty sure they mostly eat bugs, and bugs are not on any brain food list I've seen.", options: [{ text: "So why then?", next: 'jasper-reveal' }] },
      {
        id: 'jasper-reveal',
        npc: "It's because they live in schools.",
        jokeId: 'jasper-fish-school',
        jokeBookEntry: { npcName: 'Jasper', setup: 'Why are fish so smart?', punchline: 'Because they live in schools.', explain: 'A school of fish is a big group swimming together. And school is where you go to learn. Same word doing two jobs.' },
        options: ["Schools of fish!", "Ohhh.", "That's sneaky."],
      },
      { npc: "Right? A school of fish is a big group swimming together. And school is where you go to learn. Same word doing two jobs.", options: ["I like that one.", "I'm telling that at lunch."] },
      { npc: "Penny told me the Bank's been busy lately. She runs it, and every coin you earn is really yours to keep there.", options: ["Good to know!"] },
      { npc: "Take it, pond jokes are free around here. Enjoy your walk. See you later!" },
    ],
  },
};
