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
      { npc: "Nice day out today, isn't it?", options: ["Sure is!", "A little chilly.", "I hadn't noticed!"] },
      { npc: "I was just heading over to the Store to see what Pip's got in today.", options: ["Say hi to Pip for me.", "What do they usually sell?"] },
      { npc: "Same good stuff every day, so you always know what to expect there.", options: ["Good to know!"] },
      { npc: "Well, I should get going. See you around town!" },
    ],
  },
  'amb-2': {
    id: 'amb-2',
    name: 'Rosa',
    dialogue: [
      { npc: "Hi there, I'm Rosa!", options: ["Hi Rosa!", "Nice to meet you."] },
      { npc: "How's your day going?", options: ["Pretty good!", "Kind of a long day.", "Great so far!"] },
      { npc: "That's good to hear. Have you met Wren yet? They deliver the mail all over town.", options: ["Yes, I met Wren!", "Not yet, I'll look for them."] },
      { npc: "They're always easy to spot near the Post Office.", options: ["Thanks for the tip!"] },
      { npc: "Take care, I'll see you around!" },
    ],
  },
  'amb-3': {
    id: 'amb-3',
    name: 'Jasper',
    dialogue: [
      { npc: "Hey, I'm Jasper.", options: ["Hi Jasper!", "Hey!"] },
      { npc: "Beautiful day for a walk around the square, don't you think?", options: ["It really is.", "I like the pond over there."], },
      { npc: "The pond's my favorite spot too. Penny told me the Bank's been busy lately.", options: ["I should visit the Bank.", "What's the Bank like?"] },
      { npc: "Penny runs it. Every coin you earn is really yours to keep there.", options: ["Good to know!"] },
      { npc: "Anyway, enjoy your walk. See you later!" },
    ],
  },
};
