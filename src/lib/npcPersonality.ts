import type { ConversationStep } from './worldQuest1';

// Neighbor personalities (Build Queue 228, her words 2026-10-15: "add a personality type selector that will drive
// their conversations, tone, and general interactions with students. for example, this fox is sassy, mischevious,
// and a little mean. lets add more emotions and peersonality behind the neighbors"). The teacher picks one in Style,
// Neighbors. In Town Square it adds the Neighbor's own hello at the start of every chat and a line of small talk
// before goodbye, so the same Neighbor always sounds like themselves.
// Guardrail (Claudia, high-support learners): "a little mean" is playful teasing about games and about the Neighbor
// themselves, never about the student's looks, abilities, family or feelings, and every chat still ends kindly.

export type PersonalityId = 'friendly' | 'sassy' | 'grumpy' | 'shy' | 'silly' | 'wise' | 'dramatic' | 'worried' | 'brave' | 'sleepy';
type Line = { npc: string; options?: string[] };
export interface Personality { id: PersonalityId; label: string; short: string; hello: Line[]; talk: Line[] }

export const PERSONALITIES: Personality[] = [
  { id: 'friendly', label: 'Friendly', short: 'Warm, kind and happy to see you.',
    hello: [{ npc: 'Oh, hi there! I was hoping I would see you.', options: ['Hi!', 'Hello!'] }, { npc: 'Hey, friend! Your visit just made my day better.', options: ['Aw, thanks!', 'Hi!'] }],
    talk: [{ npc: 'I hope you know you are doing a great job.', options: ['Thanks!', 'You too!'] }, { npc: 'If you ever need a friend in town, you know where to find me.', options: ['Thank you!', 'I will!'] }] },
  { id: 'sassy', label: 'Sassy and mischievous', short: 'Teases, plays tricks, a little bit mean but never hurtful.',
    hello: [{ npc: 'Oh. It is you. Kidding! Mostly.', options: ['Hey!', 'Very funny.'] }, { npc: 'Well, well, well. Look who finally showed up.', options: ['I am here now!', 'Hi to you too.'] }, { npc: 'Shh. I was about to do something sneaky. Do not tell anyone.', options: ['What is it?', 'My lips are sealed.'] }],
    talk: [{ npc: 'I bet I could beat you at any game. Want to prove me wrong?', options: ['You are on!', 'Maybe later.'] }, { npc: 'I hid something in Town Square. Just kidding. Or am I?', options: ['Tell me!', 'Hmm...'] }, { npc: 'Did you notice my new look? Obviously you did. It is amazing.', options: ['It is!', 'It is okay.'] }] },
  { id: 'grumpy', label: 'Grumpy but kind inside', short: 'Grumbles and sighs, secretly glad you came.',
    hello: [{ npc: 'Hmph. Oh, it is you. I guess that is fine.', options: ['Hi!', 'Nice to see you too.'] }, { npc: 'Too loud out here today. But you are not too loud. You can stay.', options: ['Thanks!', 'I will be quiet.'] }],
    talk: [{ npc: 'Do not tell anyone, but I am glad you stopped by.', options: ['I won\'t!', 'Me too.'] }, { npc: 'Everybody is so cheerful. It is exhausting. Except you. You are alright.', options: ['Thanks, I think!', 'Ha!'] }] },
  { id: 'shy', label: 'Shy and quiet', short: 'Speaks softly and opens up slowly.',
    hello: [{ npc: 'Oh... um, hi. I did not think anyone would talk to me.', options: ['Hi! I wanted to.', 'Hello!'] }, { npc: 'H-hello. It is nice that you came over.', options: ['Of course!', 'Hi!'] }],
    talk: [{ npc: 'I get nervous meeting new people. Talking to you is easier, though.', options: ['I am glad!', 'Me too, sometimes.'] }, { npc: 'Can I tell you a secret? I like it when you visit.', options: ['I like visiting!', 'Aw!'] }] },
  { id: 'silly', label: 'Silly and goofy', short: 'Jokes around, says funny things, loves to laugh.',
    hello: [{ npc: 'Ahoy! Wait, I am not a pirate. Hello!', options: ['Ha! Hi!', 'Ahoy!'] }, { npc: 'Beep boop. Just kidding, I am not a robot. Hi!', options: ['Beep boop!', 'Hi!'] }],
    talk: [{ npc: 'I tried to juggle three pancakes this morning. Now they are on the ceiling.', options: ['Ha!', 'Oh no!'] }, { npc: 'Want to know a secret? My socks do not match. On purpose. Fashion!', options: ['Love it!', 'Mine neither!'] }] },
  { id: 'wise', label: 'Calm and wise', short: 'Slow, thoughtful and full of good advice.',
    hello: [{ npc: 'Welcome, young friend. Take a slow breath with me.', options: ['Okay.', 'Hi.'] }, { npc: 'Ah, hello. The best part of the day is a good friend.', options: ['I agree.', 'Hi!'] }],
    talk: [{ npc: 'When something is hard, try a little at a time. Small steps add up.', options: ['I will try.', 'Good idea.'] }, { npc: 'Mistakes are how our brains grow. Never be afraid of them.', options: ['Okay!', 'Thanks.'] }] },
  { id: 'dramatic', label: 'Dramatic and excitable', short: 'Everything is the BEST or the WORST.',
    hello: [{ npc: 'You are HERE! This is the best moment of my whole entire day!', options: ['Wow, hi!', 'Ha, hello!'] }, { npc: 'Gasp! A visitor! I must fix my hair at once!', options: ['You look great!', 'Hi!'] }],
    talk: [{ npc: 'I dropped my sandwich this morning. It was a TRAGEDY. A total disaster!', options: ['Oh no!', 'It is okay!'] }, { npc: 'Today the sun came out and I almost fainted from joy!', options: ['Ha!', 'Same!'] }] },
  { id: 'worried', label: 'Worried and nervous', short: 'Frets a lot, feels better with a friend.',
    hello: [{ npc: 'Oh! Hi. Sorry, I jumped. I am a little nervous today.', options: ['It is okay.', 'Want to talk?'] }, { npc: 'Hello! Is it going to rain? I hope not. Hi!', options: ['It will be fine.', 'Hi!'] }],
    talk: [{ npc: 'When I feel worried, I count my breaths. One, two, three. It helps a little.', options: ['That is smart.', 'I will try that.'] }, { npc: 'Talking to you makes me feel calmer. Thank you.', options: ['Any time!', 'I am glad.'] }] },
  { id: 'brave', label: 'Brave and adventurous', short: 'Loves exploring, cheers you on to try new things.',
    hello: [{ npc: 'Adventurer! Ready for something new today?', options: ['Ready!', 'Maybe!'] }, { npc: 'Hey! I just got back from exploring the forest. What a trip!', options: ['Cool!', 'What did you find?'] }],
    talk: [{ npc: 'Trying something new is scary and exciting. You can do hard things!', options: ['I can!', 'Thanks!'] }, { npc: 'Want to explore together sometime? I know a secret path.', options: ['Yes!', 'Show me!'] }] },
  { id: 'sleepy', label: 'Sleepy and slow', short: 'Yawns a lot, takes things easy.',
    hello: [{ npc: 'Yawn... oh, hello. I was just resting my eyes.', options: ['Hi, sleepyhead!', 'Hello!'] }, { npc: 'Mmm, hi there. Is it nap time yet?', options: ['Not yet!', 'Ha!'] }],
    talk: [{ npc: 'Did you know resting helps your brain remember things? That is my excuse.', options: ['Ha!', 'Good to know.'] }, { npc: 'I am slow, but I always get there. Slow is okay too.', options: ['Yes it is!', 'Nice.'] }] },
];
export const personalityById = (id?: string) => PERSONALITIES.find((p) => p.id === id);

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

// Wrap a chat in the Neighbor's personality: their own hello first, and one line of small talk before the goodbye.
export function withPersonality(steps: ConversationStep[], id?: string): ConversationStep[] {
  const p = personalityById(id);
  if (!p || !steps.length) return steps;
  const hello = pick(p.hello);
  const talk = pick(p.talk);
  const out: ConversationStep[] = [{ npc: hello.npc, options: hello.options ?? ['Hi!'] }, ...steps];
  if (steps.length >= 3) out.splice(out.length - 1, 0, { npc: talk.npc, options: talk.options ?? ['Okay!'] });
  return out;
}
