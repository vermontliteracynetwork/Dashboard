// Finds the first installed system voice whose name contains any hint
// (case-insensitive); null if none match or there are no hints, so the
// caller falls back to the browser/OS default voice. Used to approximate a
// marketplace voice-skin item (e.g. "Santa") with the closest real voice
// the browser has installed, since there's no way to ship real branded
// voice audio in a web app.
export function pickSystemVoice(hints: string[]): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window) || hints.length === 0) return null;
  const voices = window.speechSynthesis.getVoices();
  for (const hint of hints) {
    const matches = voices.filter((v) => v.name.toLowerCase().includes(hint));
    // The downloadable Premium/Enhanced (Apple) and Natural (Microsoft) versions sound far more human.
    const match = matches.find((v) => HUMANLIKE.test(v.name)) ?? matches[0];
    if (match) return match;
  }
  return null;
}

const HUMANLIKE = /premium|enhanced|natural|neural/i;
const NOVELTY = /bells|bubbles|whisper|zarvox|trinoids|albert|bad news|good news|jester|organ|cellos|boing|superstar|wobble|grandma|grandpa|eddy|flo\b|reed|rocko|sandy|shelley|junior|ralph|kathy|fred/i;
const FEMALE = /female|samantha|victoria|karen|moira|tessa|fiona|serena|kate|susan|allison|ava\b|zoe|nicky|aria|jenny|michelle|emma|sonia|libby|hazel|martha|google us english/i;

// The most human-sounding English voice on the device: Premium, then Enhanced or Natural voices,
// US English first, preferred names next, never the novelty voices. With `male`, female voices
// drop to the bottom.
export function pickHumanVoice(names: string[], male = true): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  let best: SpeechSynthesisVoice | null = null, bestScore = -Infinity;
  for (const v of window.speechSynthesis.getVoices()) {
    if (!/^en/i.test(v.lang) || NOVELTY.test(v.name)) continue;
    const n = v.name.toLowerCase();
    let s = /premium/.test(n) ? 12 : HUMANLIKE.test(n) ? 10 : /online/.test(n) ? 6 : 0;
    if (/en[-_]us/i.test(v.lang)) s += 4;
    if (names.some((h) => n.includes(h))) s += 5;
    if (male && FEMALE.test(n)) s -= 20;
    if (s > bestScore) { best = v; bestScore = s; }
  }
  return best;
}
