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
  // Several complete conversations, not one fixed script — same reasoning
  // as Quest1Neighbor.dialogues (see worldQuest1.ts's pickDialogueVariant):
  // keeps jokes fresh across repeat talks and keeps some visits joke-free.
  dialogues: ConversationStep[][];
}

// Keyed by the same id used in TownSquare's AMBIENT_NPCS list.
export const TOWNSPEOPLE: Record<string, Townsperson> = {
  'amb-1': {
    id: 'amb-1',
    name: 'Miller',
    dialogues: [
      [
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
      [
        { npc: "Oh, hello again!", options: ["Hi Miller!", "Hey!"] },
        { npc: "One more for you. Why did the cookie go to the doctor?", options: ["Was it sick?", "No idea.", "Too many chips?"] },
        {
          npc: "It was feeling crumby, falling apart!",
          jokeId: 'miller-cookie-crumby',
          jokeBookEntry: { npcName: 'Miller', setup: 'Why did the cookie go to the doctor?', punchline: 'It was feeling crumby, falling apart!', explain: 'Crumby sounds like crummy (feeling bad), and cookies make crumbs. Another two-meaning word, just like the bread one.' },
          options: ["Ha, crumby!", "Good one, Miller."],
        },
        { npc: "I'll have a fresh one tomorrow. See you around!" },
      ],
      [
        { npc: "Hey there, good to see you.", options: ["Hi Miller!", "Hey!"] },
        { npc: "I'm just heading home for the day, nothing too exciting happening.", options: ["Have a good one!", "See you tomorrow."] },
        { npc: "You too. Take care!" },
      ],
    ],
  },
  'amb-2': {
    id: 'amb-2',
    name: 'Rosa',
    dialogues: [
      [
        { npc: "Hi there, I'm Rosa!", options: ["Hi Rosa!", "Nice to meet you."] },
        { npc: "I've been practicing a joke all morning. Do you want to be my test audience?", options: ["Yes please.", "You've been practicing?"] },
        { npc: "Knock knock.", options: ["Who's there?", "Who is it?"] },
        { npc: "Boo.", options: ["Boo who?"] },
        {
          npc: "Aw, don't cry, it's only a joke! Get it? Boo who sounds like boo hoo, and boo hoo is a crying sound.",
          jokeId: 'rosa-boo-hoo',
          jokeBookEntry: { npcName: 'Rosa', setup: "Knock knock. Who's there? Boo.", punchline: "Boo who? Aw, don't cry, it's only a joke!", explain: 'Boo who sounds like boo hoo, and boo hoo is a crying sound.' },
          options: ["That got me.", "Boo hoo!", "I'm not crying, you're crying."],
        },
        { npc: "Have you met Wren yet? They deliver the mail all over town, always easy to spot near the Post Office.", options: ["Thanks for the tip!"] },
        { npc: "I've been waiting all day to use that one. Worth it. Take care, I'll see you around!" },
      ],
      [
        { npc: "Hi again!", options: ["Hi Rosa!", "Hey!"] },
        { npc: "Want to hear another one I've been practicing?", options: ["Sure!", "Go ahead."] },
        { npc: "Knock knock.", options: ["Who's there?"] },
        { npc: "Lettuce.", options: ["Lettuce who?"] },
        {
          npc: "Lettuce in, it's cold out here! Get it? Lettuce sounds like let us.",
          jokeId: 'rosa-lettuce-in',
          jokeBookEntry: { npcName: 'Rosa', setup: "Knock knock. Who's there? Lettuce.", punchline: "Lettuce in, it's cold out here!", explain: 'Lettuce is a vegetable, and it sounds exactly like let us. Same sound, two meanings.' },
          options: ["Ha, lettuce!", "Good one, Rosa."],
        },
        { npc: "I've got more where that came from. See you around!" },
      ],
      [
        { npc: "Hey, nice to see you again.", options: ["Hi Rosa!", "Hey there!"] },
        { npc: "I'm just out enjoying the weather today.", options: ["Nice day for it.", "Same here."] },
        { npc: "It really is. Take care, see you soon!" },
      ],
    ],
  },
  'amb-3': {
    id: 'amb-3',
    name: 'Jasper',
    dialogues: [
      [
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
      [
        { npc: "Hey, you're back!", options: ["Hi Jasper!", "Hey!"] },
        {
          npc: "I've got another pond riddle. Why don't fish play basketball?",
          options: [
            { text: "They're bad at it?", next: 'jasper2-reveal' },
            { text: "No idea.", next: 'jasper2-reveal' },
          ],
        },
        {
          id: 'jasper2-reveal',
          npc: "They're afraid of the net!",
          jokeId: 'jasper-net',
          jokeBookEntry: { npcName: 'Jasper', setup: "Why don't fish play basketball?", punchline: "They're afraid of the net!", explain: 'A basketball hoop has a net, and fish get caught in nets too. Same word, two very different reasons to be afraid of it.' },
          options: ["Ha, the net!", "Good one."],
        },
        { npc: "Pond jokes really do write themselves. See you later!" },
      ],
      [
        { npc: "Hey, good to see you.", options: ["Hi Jasper!", "Hey there!"] },
        { npc: "Just watching the pond, it's pretty calm today.", options: ["Looks nice.", "Anything interesting?"] },
        { npc: "Not really, just a quiet day. Enjoy your walk!" },
      ],
    ],
  },
};
