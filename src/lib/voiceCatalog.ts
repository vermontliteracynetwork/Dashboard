const HUMANLIKE = /premium|enhanced|natural|neural/i;
const NOVELTY = /bells|bubbles|whisper|zarvox|trinoids|albert|bad news|good news|jester|organ|cellos|boing|superstar|wobble|grandma|grandpa|eddy|flo\b|reed|rocko|sandy|shelley|junior|ralph|kathy|fred/i;
const FEMALE = /female|samantha|victoria|karen|moira|tessa|fiona|serena|kate|susan|allison|ava\b|zoe|nicky|aria|jenny|michelle|emma|sonia|libby|hazel|martha|google us english/i;

// The most human-sounding English voice on the device: Premium, then Enhanced or Natural voices,
// US English first, preferred names next, never the novelty voices. With `male`, female voices
// drop to the bottom.
export const isRobotVoice = (v: SpeechSynthesisVoice) => NOVELTY.test(v.name);
export function pickHumanVoice(names: string[], male?: boolean): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  let best: SpeechSynthesisVoice | null = null, bestScore = -Infinity;
  for (const v of window.speechSynthesis.getVoices()) {
    if (!/^en/i.test(v.lang) || NOVELTY.test(v.name)) continue;
    const n = v.name.toLowerCase();
    let s = /premium/.test(n) ? 12 : HUMANLIKE.test(n) ? 10 : /online/.test(n) ? 6 : 0;
    if (/en[-_]us/i.test(v.lang)) s += 4;
    if (names.some((h) => n.includes(h))) s += 5;
    if (male === true && FEMALE.test(n)) s -= 20;
    if (male === false && !FEMALE.test(n)) s -= 20;
    if (s > bestScore) { best = v; bestScore = s; }
  }
  return best;
}
