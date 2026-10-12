import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { speak } from '../../components/ReadAloud';
import { sfxOn, SfxToggle } from '../../lib/miniSfx';
import { NPC_VOICE_PRESETS } from '../../lib/npcVoices';
import { MyBest } from '../../components/MyBest';
import { recordBestGame } from '../../lib/personalBoard';
import { addPetFood } from '../../lib/petFood';

// Doc Fishing, first called Fishing Dock (renamed and made all pixel art at her request, 2026-10-12:
// "the whole fishing dock game should become pixel theme. the game should have this cover and be renamed
// to Doc Fishing"). From her native game list, 2026-09-30: "Fishing Dock: pier or boat asset; answers power
// a timing-based cast; fish go in a collection book"). Her 2026-10-12 update, with her fishing art
// and sound packs: Doc Fishing hosts the dock and reads the game aloud in a slow, deep drawl; the rod
// casts first ("make sure the fishing poles cast in animation before the question pops up") and the
// question comes while the bobber floats, so a right answer hooks the fish. A better cast (the green
// part of the meter) reaches deeper water and rarer fish. New kinds of fish earn better rods (a wider
// green spot) and new bobbers. Her power-ups (same day): sometimes a potion comes up instead of a
// fish: a 30 second Diamond Rod with no questions (pixel timer at the top), free casts, and silly
// ones like a school of fish leaping out of the water.

const ART = '/games/fishing/';
const DOC_VOICE = NPC_VOICE_PRESETS['doc-drawl'];

// Her sound packs (Fishing Minigame SFX demo and Free Fishing Sounds), trimmed to small mono files.
type Snd = 'cast' | 'plunk' | 'bite' | 'hook' | 'reel' | 'catch' | 'legend' | 'escaped' | 'boot' | 'bucket' | 'tackle' | 'lure' | 'rod' | 'thrash' | 'gull';
const audio: Partial<Record<Snd, HTMLAudioElement>> = {};
const play = (n: Snd) => {
  if (!sfxOn()) return;
  try { const a = (audio[n] ??= new Audio(`${ART}sfx/${n}.wav`)); a.currentTime = 0; void a.play().catch(() => {}); } catch { /* fine */ }
};
const quick = () => document.body.classList.contains('calm-games') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

interface Fish { id: string; name: string; img?: string; icon?: string; tier: 0 | 1 | 2 | 3; min: number; max: number; fact: string; junk?: boolean; legacy?: boolean }
const f = (id: string, name: string, img: string, tier: Fish['tier'], min: number, max: number, fact: string, junk?: boolean): Fish => ({ id, name, img, tier, min, max, fact, junk });
const FISH: Fish[] = [
  f('perch', 'Yellow Perch', 'yellowperch', 0, 15, 30, 'Perch have stripes to hide among water plants.'),
  f('bluegill', 'Bluegill', 'bluegill', 0, 10, 25, 'Bluegills make nests in the sand for their eggs.'),
  f('sunfish', 'Pumpkinseed Sunfish', 'sunfish', 0, 8, 20, 'A sunfish guards its nest and chases away bigger fish.'),
  f('crappie', 'Crappie', 'crappie', 0, 15, 30, 'Crappies swim together in big groups called schools.'),
  f('carp', 'Carp', 'carp', 0, 30, 80, 'Carp can live for more than 40 years.'),
  f('guppy', 'Guppy', 'guppy', 0, 2, 5, 'A guppy is so small it could sit on your fingertip.'),
  f('crab', 'Pinchy Crab', 'crab1', 0, 8, 20, 'Crabs walk sideways because of how their legs bend.'),
  f('mussels', 'Mussels', 'mussels', 0, 4, 10, 'Mussels hold on to rocks with tiny, strong threads.'),
  f('boot', 'Old Boot', 'junkboot1', 0, 25, 30, 'Not a fish! Someone lost a boot. Keep the water clean!', true),
  f('sock', 'Soggy Sock', 'loot-junksock', 0, 15, 25, 'Somebody lost a sock! Socks go in the wash, not the lake.', true),
  f('wood', 'Driftwood', 'junkwood', 0, 20, 60, 'Driftwood floats because wood is lighter than water.', true),
  f('bag', 'Plastic Bag', 'plasticbag', 0, 20, 40, 'Plastic can hurt sea animals. Thank you for pulling it out!', true),
  f('trout', 'Rainbow Trout', 'rainbowtrout', 1, 30, 60, 'Rainbow trout have a pink stripe along each side.'),
  f('brooktrout', 'Brook Trout', 'brooktrout', 1, 20, 40, 'Brook trout love cold, clean streams, like the ones in Vermont.'),
  f('bass', 'Bigmouth Bass', 'bigmouthbass', 1, 25, 60, 'A bass can open its mouth wide enough to gulp a frog.'),
  f('pike', 'Northern Pike', 'northernpike', 1, 50, 100, 'A pike hides very still in the weeds, waiting for lunch to swim by.'),
  f('mackerel', 'Mackerel', 'mackerel', 1, 25, 45, 'Mackerel swim in huge shiny schools near the top of the sea.'),
  f('cod', 'Cod', 'cod', 1, 40, 90, 'A cod has a little whisker on its chin to feel for food.'),
  f('shrimp', 'Tiny Shrimp', 'shrimp', 1, 3, 8, 'Shrimp swim backward by flicking their tails.'),
  f('puffer', 'Pufferfish', 'pufferfish', 1, 10, 35, 'A pufferfish blows itself up like a balloon when it is scared.'),
  f('lobster', 'Lobster', 'lobster', 1, 25, 50, 'Lobsters can live for more than 50 years.'),
  f('hermit', 'Hermit Crab', 'hermitcrab', 1, 3, 10, 'A hermit crab moves into a bigger shell as it grows.'),
  f('starfish', 'Starfish', 'starfish', 1, 10, 25, 'A starfish can grow back a lost arm.'),
  f('sanddollar', 'Sand Dollar', 'sanddollar', 1, 5, 10, 'A sand dollar is a flat cousin of the sea urchin.'),
  f('clown', 'Clownfish', 'clownfish', 2, 6, 11, 'Clownfish live safely inside stinging sea anemones.'),
  f('squid', 'Squid', 'squid', 2, 30, 70, 'Squid squirt ink to escape from danger.'),
  f('octopus', 'Octopus', 'octopus', 2, 30, 90, 'An octopus has three hearts and blue blood.'),
  f('turtle', 'Sea Turtle', 'turtle', 2, 60, 120, 'Sea turtles return to the beach where they hatched.'),
  f('seahorse', 'Seahorse', 'seahorse', 2, 5, 15, 'Seahorse dads carry the babies in a pouch.'),
  f('jelly', 'Jellyfish', 'jellyfish', 2, 10, 40, 'A jellyfish has no brain, no heart and no bones.'),
  f('lionfish', 'Lionfish', 'lionfish', 2, 20, 35, 'A lionfish has long spiky fins, so other fish stay away.'),
  f('salmon', 'King Salmon', 'kingsalmon', 2, 60, 110, 'Salmon swim up rivers and even leap up waterfalls.'),
  f('axolotl', 'Axolotl', 'axolotl', 2, 15, 25, 'An axolotl can grow back its legs, and even part of its heart.'),
  f('goldfish', 'Goldfish', 'goldfish', 2, 5, 20, 'Goldfish can remember things for months, not just seconds.'),
  f('tench', 'Golden Tench', 'goldentench', 2, 20, 50, 'A tench is slimy on purpose. The slime keeps it healthy.'),
  f('shark', 'Friendly Shark', 'sandbarshark', 3, 120, 300, 'Sharks lose and grow back thousands of teeth.'),
  f('marlin', 'Blue Marlin', 'bluemarlin', 3, 200, 400, 'A marlin is one of the fastest fish in the whole ocean.'),
  f('sailfish', 'Sailfish', 'sailfish', 3, 150, 300, 'A sailfish raises the sail on its back to look bigger.'),
  f('tuna', 'Bluefin Tuna', 'tuna', 3, 100, 250, 'A tuna keeps its body warmer than the water around it.'),
  f('angler', 'Anglerfish', 'angler', 3, 10, 40, 'An anglerfish has a glowing light on its head to find food in the dark.'),
  f('sturgeon', 'Sturgeon', 'sturgeon', 3, 100, 250, 'Sturgeon were already swimming when dinosaurs were alive.'),
  f('gem', 'Sunken Treasure', 'ancientcoin', 3, 3, 5, 'This old coin could be hundreds of years old. It is yours!'),
  f('pearl', 'Rainbow Pearl', 'loot-rainbowpearl', 3, 1, 3, 'Pearls grow inside oysters, one thin layer at a time.'),
  // From the first version of the game: still shown in the book for anyone who caught one.
  { id: 'dolphin', name: 'Dolphin', icon: '🐬', tier: 3, min: 150, max: 250, fact: 'Dolphins call each other by special whistles, like names.', legacy: true },
  { id: 'whale', name: 'Baby Whale', icon: '🐋', tier: 3, min: 300, max: 500, fact: 'A blue whale is the biggest animal that ever lived.', legacy: true },
];
const CATCHABLE = FISH.filter((x) => !x.legacy);
const TIER_NAME = ['Common', 'Uncommon', 'Rare', 'Super rare'];
const TIER_COLOR = ['#7a8a99', '#2fa36b', '#5b8def', '#c77dff'];

// Her rod pack: each better rod widens the green part of the cast meter. Rods upgrade by XP (her idea,
// 2026-10-12: "rate the casts with XP have an xp chart like a growing meter, fill the meter and it
// upgrades your pole. xp from correct questions and catches too"). `xp` is the total XP that earns it.
const RODS = [
  { id: 'wooden', name: 'Wooden', xp: 0, sweet: 0.2 },
  { id: 'copper', name: 'Copper', xp: 150, sweet: 0.24 },
  { id: 'iron', name: 'Iron', xp: 400, sweet: 0.28 },
  { id: 'gold', name: 'Gold', xp: 800, sweet: 0.32 },
  { id: 'diamond', name: 'Diamond', xp: 1400, sweet: 0.36 },
];
type Rod = (typeof RODS)[number];
const rodAt = (xp: number): Rod => [...RODS].reverse().find((r) => xp >= r.xp) ?? RODS[0];
// XP: cast ratings (Perfect 30, Great 20, Good 10, Short 5), 10 for each right answer, and catches by
// rarity (10, 20, 35, 60; junk 5) with 25 more for a new kind and 15 for a power-up.
const CATCH_XP = [10, 20, 35, 60];
const BOBBERS = [
  { id: 'standard', name: 'Red and White', need: 0 }, { id: 'redbutton', name: 'Red Button', need: 2 }, { id: 'bluecork', name: 'Blue Cork', need: 3 },
  { id: 'striped-redwhiteblue', name: 'Stars and Stripes', need: 5 }, { id: 'clover', name: 'Lucky Clover', need: 7 }, { id: 'donut', name: 'Donut', need: 9 },
  { id: 'pizza', name: 'Pizza Slice', need: 11 }, { id: 'cupcake', name: 'Cupcake', need: 13 }, { id: 'rainbow', name: 'Rainbow Ball', need: 16 },
  { id: 'discoball', name: 'Disco Ball', need: 19 }, { id: 'potogold', name: 'Pot of Gold', need: 23 }, { id: 'crystal', name: 'Crystal', need: 27 },
  { id: 'rainbowcloud', name: 'Rainbow Cloud', need: 31 },
];

// Her power-up idea (2026-10-12), drawn with her potion pack.
type PowerId = 'diamond' | 'skip' | 'double' | 'school' | 'bubbles' | 'rainbow';
const POWERS: { id: PowerId; name: string; blurb: string }[] = [
  { id: 'diamond', name: 'Diamond Rod Potion', blurb: 'For 30 seconds you fish with the Diamond Rod and get no questions. Cast as fast as you can!' },
  { id: 'skip', name: 'Skip Potion', blurb: 'Your next cast skips its question.' },
  { id: 'double', name: 'Double Cast Potion', blurb: 'Your next two casts in a row have no questions.' },
  { id: 'school', name: 'School of Fish Potion', blurb: 'A whole school of fish leaps out of the water to say hello!' },
  { id: 'bubbles', name: 'Bubble Potion', blurb: 'Bubbles, bubbles, everywhere!' },
  { id: 'rainbow', name: 'Rainbow Water Potion', blurb: 'The water turns every color of the rainbow for a little while.' },
];
const DIAMOND_SECONDS = 30;
const SCHOOL = ['bluegill', 'yellowperch', 'mackerel', 'crappie', 'rainbowtrout', 'sunfish', 'cod', 'carp', 'pinksalmon', 'redsnapper', 'dorado', 'clownfish'];

type Phase = 'ready' | 'power' | 'casting' | 'ask' | 'wait' | 'bite' | 'leap' | 'caught' | 'away';
interface Book { caught?: Record<string, number>; biggest?: Record<string, number>; rod?: string; bobber?: string; met?: boolean; xp?: number; minutes?: number }
type Catch = { kind: 'fish'; fish: Fish; size: number; isNew: boolean; xp: number; newBobber?: string } | { kind: 'power'; power: (typeof POWERS)[number]; xp: number };

function Sprite({ fish, size }: { fish: Fish; size: number }) {
  return fish.img
    ? <img src={`${ART}fish/${fish.img}.png`} alt="" className="fdk-px" style={{ width: size, height: size }} />
    : <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{fish.icon}</span>;
}

export default function FishingDock() {
  const back = useBack();
  const [readAloud, setReadAloud] = useState(() => { try { return localStorage.getItem('story-tts') !== '0'; } catch { return true; } });
  const readRef = useRef(readAloud);
  readRef.current = readAloud;
  const { ask, element, pay, student, asking, rightSoFar } = useAsk('Doc Fishing', '🎣', 'fishingDock', { autoRead: readAloud, voice: DOC_VOICE, startCard: false });
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [phase, setPhase] = useState<Phase>('ready');
  const [power, setPower] = useState(0);
  const [cast, setCast] = useState(0); // 0..1, how far the bobber landed
  const [caughtNow, setCaught] = useState<Catch | null>(null);
  const [panel, setPanel] = useState<'book' | 'tackle' | null>(null);
  const [say, setSay] = useState('');
  const [docArt, setDocArt] = useState(true);
  const [diamondLeft, setDiamondLeft] = useState(0); // seconds
  const [freeCasts, setFreeCasts] = useState(0);
  const [show, setShow] = useState<{ kind: 'school' | 'bubbles'; at: number } | null>(null);
  const [rainbow, setRainbow] = useState(false);
  const [xpPop, setXpPop] = useState<{ n: number; why: string; at: number } | null>(null);
  const [rodUp, setRodUp] = useState<{ rod: Rod; at: number } | null>(null);
  const xpRef = useRef(0);
  // Her rule (2026-10-12): "make sure there is a time that the game ends. when they login it needs to have
  // instead of rounds, game time. min 1 minute max 10 min. no questions or round settings".
  const [stage, setStage] = useState<'start' | 'play' | 'end'>('start');
  const [minutes, setMinutes] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0); // seconds
  const run = useRef({ catches: 0, kinds: 0, xp: 0, best: null as null | { name: string; size: number } });
  const raf = useRef(0);
  const t0 = useRef(0);
  const timers = useRef<number[]>([]);
  const tipRef = useRef<HTMLSpanElement>(null);
  const bobRef = useRef<HTMLImageElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const doc = (text: string, read = true) => { setSay(text); if (read && readRef.current) speak(text, undefined, undefined, DOC_VOICE); };

  useEffect(() => () => { cancelAnimationFrame(raf.current); timers.current.forEach(clearTimeout); window.speechSynthesis?.cancel(); }, []);
  // A seagull now and then, far away.
  useEffect(() => { const id = window.setInterval(() => { if (Math.random() < 0.5) play('gull'); }, 26000); return () => clearInterval(id); }, []);
  // The Diamond Rod potion's 30 second countdown.
  useEffect(() => {
    if (diamondLeft <= 0) return;
    const id = window.setTimeout(() => {
      if (diamondLeft === 1) doc('That Diamond Rod potion wore off, partner. Back to questions!');
      setDiamondLeft(diamondLeft - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [diamondLeft]); // eslint-disable-line react-hooks/exhaustive-deps
  // The game clock.
  useEffect(() => {
    if (stage !== 'play' || timeLeft <= 0) return;
    const id = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [stage, timeLeft]);
  // Time is up: end at the next calm moment, so a cast already in the water gets to finish.
  const endRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (stage === 'play' && timeLeft <= 0 && (phase === 'ready' || phase === 'away' || phase === 'power')) endRef.current();
  }, [stage, timeLeft, phase]);
  // The fishing line runs from the rod tip to the bobber, following it as it flies and floats.
  const lineOn = phase === 'casting' || phase === 'ask' || phase === 'wait' || phase === 'bite';
  useEffect(() => {
    if (!lineOn) return;
    let id = 0;
    const loop = () => {
      const a = tipRef.current?.getBoundingClientRect(), b = bobRef.current?.getBoundingClientRect(), l = lineRef.current;
      if (a && b && l) { l.setAttribute('x1', `${a.left}`); l.setAttribute('y1', `${a.top}`); l.setAttribute('x2', `${b.left + b.width / 2}`); l.setAttribute('y2', `${b.top + b.height * 0.2}`); }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [lineOn]);
  const greeted = useRef(false);
  const owner = student ? `fishbook:${student.id}` : '';
  const saved = ((styleLooks.find((r) => r.ownerId === owner)?.look as Book | undefined) ?? {});
  xpRef.current = Math.max(xpRef.current, saved.xp ?? 0);
  useEffect(() => {
    if (!student || greeted.current) return;
    greeted.current = true;
    if (!saved.met) mergeStyleRow(owner, { met: true });
    doc(saved.met
      ? 'Howdy again, partner! The fish are biting today. How long do you want to fish? Pick your time, then tap Start fishing.'
      : 'Well, howdy there, partner! I am Doc Fishing. Let us catch us some fish. Pick how long you want to fish, then tap Start fishing.');
  }, [student]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!student) return null;

  const got = saved.caught ?? {};
  const kinds = Object.keys(got).length;
  const xpNow = xpRef.current;
  const ownedRods = RODS.filter((r) => xpNow >= r.xp);
  const myRod = diamondLeft > 0 ? RODS[4] : (ownedRods.find((r) => r.id === saved.rod) ?? ownedRods[ownedRods.length - 1]);
  const topRod = rodAt(xpNow), nextRod = RODS[RODS.indexOf(topRod) + 1];
  // Returns the new rod when this XP fills the meter.
  const gainXp = (n: number, why: string, speakUp = true): Rod | null => {
    const before = rodAt(xpRef.current);
    xpRef.current += n; run.current.xp += n;
    const now = rodAt(xpRef.current);
    const up = now.id !== before.id ? now : null;
    mergeStyleRow(owner, up ? { xp: xpRef.current, rod: up.id } : { xp: xpRef.current });
    setXpPop({ n, why, at: Date.now() });
    if (up) {
      setRodUp({ rod: up, at: Date.now() }); later(() => setRodUp(null), 4500);
      if (speakUp) { play('legend'); doc(`Yee haw! Your XP meter filled up, and your rod upgraded to the ${up.name} Rod. Its green spot is bigger!`); }
    }
    return up;
  };
  const myBobber = BOBBERS.find((b) => b.id === saved.bobber && kinds >= b.need) ?? BOBBERS[0];
  const sweetLo = Math.max(0, 0.82 - myRod.sweet / 2), sweetHi = Math.min(1, 0.82 + myRod.sweet / 2);
  const noQuestion = diamondLeft > 0 || freeCasts > 0;

  const startPower = () => {
    play('rod'); setPhase('power'); t0.current = performance.now();
    doc(`Watch the line slide. Tap Cast when it is in the green, and your bobber flies way out to the deep water where the rare fish swim.`, !noQuestion);
    const loop = () => { const t = (performance.now() - t0.current) / 1000; setPower((Math.sin(t * 2.6 - Math.PI / 2) + 1) / 2); raf.current = requestAnimationFrame(loop); };
    raf.current = requestAnimationFrame(loop);
  };
  const waitForBite = () => {
    setPhase('wait');
    doc('Hold real still, partner. Wait for that bobber to dip.', !noQuestion);
    later(() => {
      setPhase('bite'); play('bite');
      doc('There is a bite! Reel it in, quick!');
      // A generous 2.5 seconds to tap Reel it in.
      later(() => setPhase((ph) => {
        if (ph !== 'bite') return ph;
        play('escaped'); doc('Aw, shucks. That one got away. It happens to every fisher, even me. Let us cast again.');
        return 'away';
      }), 2500);
    }, 1200 + Math.random() * 1800);
  };
  const release = () => {
    cancelAnimationFrame(raf.current); play('cast');
    const p = power; setCast(p); setPhase('casting'); setSay('');
    const mid = (sweetLo + sweetHi) / 2, green = p >= sweetLo && p <= sweetHi;
    const [why, xp]: [string, number] = green && Math.abs(p - mid) <= myRod.sweet * 0.2 ? ['Perfect cast!', 30] : green ? ['Great cast!', 20] : p > 0.45 ? ['Good cast', 10] : ['Short cast', 5];
    // Her rule: the rod casts first, then the question pops up while the bobber floats.
    later(() => {
      play('plunk'); gainXp(xp, why);
      if (diamondLeft > 0) { waitForBite(); return; }
      if (freeCasts > 0) { setFreeCasts((n) => n - 1); doc('No question this cast. That potion is working!'); waitForBite(); return; }
      setPhase('ask');
      setSay('Ooh, a fish is sniffing around your bobber! Answer the question to hook it.');
      const rightBefore = rightSoFar();
      ask('🐟 A fish is sniffing your bobber! Answer to hook it!', () => {
        const n = Math.max(1, rightSoFar() - rightBefore);
        play('hook'); gainXp(10 * n, n > 1 ? `${n} right answers` : 'Right answer'); waitForBite();
      }, () => {
        play('reel'); setPhase('ready'); doc('No worries. I will reel your line back in.');
      });
    }, quick() ? 250 : 950);
  };
  const reel = () => {
    play('reel');
    // Sometimes one of her potions comes up instead of a fish (never during a Diamond Rod).
    if (diamondLeft <= 0 && Math.random() < 0.14) {
      const pw = POWERS[Math.floor(Math.random() * POWERS.length)];
      const up = gainXp(15, 'Power-up!', false);
      setCaught({ kind: 'power', power: pw, xp: 15 }); setPhase('leap');
      later(() => { setPhase('caught'); play('legend'); doc(`Well, what do you know! You fished up a ${pw.name}. ${pw.blurb}${up ? ` And your rod upgraded to the ${up.name} Rod!` : ''}`); }, quick() ? 200 : 1000);
      return;
    }
    // The sweet spot (the green part of the meter) reaches the rare fish.
    const sweet = cast >= sweetLo && cast <= sweetHi;
    const r = Math.random();
    const tier = sweet ? (r < 0.25 ? 3 : r < 0.6 ? 2 : r < 0.9 ? 1 : 0) : cast > 0.45 ? (r < 0.05 ? 3 : r < 0.25 ? 2 : r < 0.65 ? 1 : 0) : (r < 0.1 ? 2 : r < 0.4 ? 1 : 0);
    const pool = CATCHABLE.filter((x) => x.tier === tier);
    let fish = pool[Math.floor(Math.random() * pool.length)];
    if (fish.junk && Math.random() < 0.5) fish = pool[Math.floor(Math.random() * pool.length)];
    const size = Math.round(fish.min + Math.random() * (fish.max - fish.min));
    const isNew = !got[fish.id];
    const after = kinds + (isNew ? 1 : 0);
    const newBobber = isNew ? BOBBERS.find((x) => x.need > 0 && x.need === after) : undefined;
    mergeStyleRow(owner, {
      caught: { ...got, [fish.id]: (got[fish.id] ?? 0) + 1 },
      biggest: { ...(saved.biggest ?? {}), [fish.id]: Math.max(size, saved.biggest?.[fish.id] ?? 0) },
    });
    run.current.catches += 1; if (isNew) run.current.kinds += 1;
    if (!fish.junk && size > (run.current.best?.size ?? 0)) run.current.best = { name: fish.name, size };
    const cx = (fish.junk ? 5 : CATCH_XP[tier]) + (isNew ? 25 : 0);
    const newRod = gainXp(cx, isNew ? 'New kind!' : 'Nice catch!', false);
    recordBestGame(student.id, 'fishingDock', size, fish.name);
    // A real fish is also a fish snack for pets (her rule 2026-10-12: earn pet food in games).
    if (!fish.junk && tier <= 1) addPetFood(student.id, 'fish');
    setCaught({ kind: 'fish', fish, size, isNew, xp: cx, newBobber: newBobber?.name });
    setPhase('leap');
    later(() => {
      setPhase('caught');
      play(fish.junk ? 'boot' : tier >= 2 || isNew ? 'legend' : 'catch');
      const line = fish.junk ? `Ha! You reeled in ${fish.name === 'Mussels' ? 'some mussels' : `a ${fish.name}`}. ${fish.fact}` : `Well, look at that! A ${size} centimeter ${fish.name}. ${fish.fact}`;
      doc(`${line}${newRod ? ` And your XP meter filled up! Your rod upgraded to the ${newRod.name} Rod.` : ''}${newBobber ? ` You also got a new bobber for your tackle box.` : ''}`);
    }, quick() ? 200 : 1000);
  };
  const closeCatch = () => {
    const c = caughtNow;
    setCaught(null); setPhase('ready'); play('bucket');
    if (c?.kind !== 'power') { doc('Tap Cast your line to fish again.', false); return; }
    const id = c.power.id;
    if (id === 'diamond') { setDiamondLeft(DIAMOND_SECONDS); doc('Diamond Rod time! No questions for 30 seconds. Cast as fast as you can!'); }
    else if (id === 'skip') { setFreeCasts((n) => n + 1); doc('Your next cast skips its question.'); }
    else if (id === 'double') { setFreeCasts((n) => n + 2); doc('Your next two casts have no questions. Yee haw!'); }
    else if (id === 'rainbow') { setRainbow(true); later(() => setRainbow(false), 20000); doc('Would you look at that water! Every color of the rainbow.'); }
    else { setShow({ kind: id, at: Date.now() }); play(id === 'school' ? 'thrash' : 'plunk'); later(() => setShow(null), 4200); doc(id === 'school' ? 'Here they come! A whole school of fish, jumping to say hello!' : 'Bubbles, bubbles, everywhere!'); }
  };
  const chosen = minutes ?? saved.minutes ?? 5;
  const startGame = () => {
    run.current = { catches: 0, kinds: 0, xp: 0, best: null };
    if (saved.minutes !== chosen) mergeStyleRow(owner, { minutes: chosen });
    setTimeLeft(chosen * 60); setStage('play'); setPhase('ready'); play('tackle');
    doc(`Alrighty, ${chosen} ${chosen === 1 ? 'minute' : 'minutes'} on the clock. Tap Cast your line!`);
  };
  const endGame = () => {
    cancelAnimationFrame(raf.current); timers.current.forEach(clearTimeout); timers.current = [];
    setStage('end'); setPhase('ready'); setDiamondLeft(0); setFreeCasts(0); pay(); play('legend');
    const r = run.current;
    doc(`Time is up, partner! You caught ${r.catches} ${r.catches === 1 ? 'thing' : 'things'}${r.best ? `, and your biggest was a ${r.best.size} centimeter ${r.best.name}` : ''}. You earned ${r.xp} XP. Mighty fine fishing!`);
  };
  endRef.current = endGame;
  const clock = `${Math.floor(Math.max(0, timeLeft) / 60)}:${String(Math.max(0, timeLeft) % 60).padStart(2, '0')}`;
  const equip = (patch: Partial<Book>) => { play('lure'); mergeStyleRow(owner, patch); };
  const flipRead = () => { const v = !readAloud; setReadAloud(v); try { localStorage.setItem('story-tts', v ? '1' : '0'); } catch { /* fine */ } if (!v) window.speechSynthesis?.cancel(); };
  const bobberX = 34 + cast * 54; // percent across the water
  const rodClass = phase === 'power' ? 'power' : phase === 'casting' ? 'casting' : phase === 'bite' ? 'bite' : phase === 'leap' ? 'leap' : lineOn ? 'out' : '';
  const shadows = ['carp', 'bluegill', 'mackerel'];
  const leapImg = caughtNow?.kind === 'power' ? `${ART}potions/${caughtNow.power.id}.png` : caughtNow?.kind === 'fish' && caughtNow.fish.img ? `${ART}fish/${caughtNow.fish.img}.png` : null;
  const mm = `${Math.floor(diamondLeft / 60)}:${String(diamondLeft % 60).padStart(2, '0')}`;

  return (
    <>
    <div className={`fd fdk${rainbow ? ' rainbow' : ''}`}>
      <div className="fd-sky"><i className="fdk-sun" /><i className="fdk-cloud c1" /><i className="fdk-cloud c2" /></div>
      <div className="fdk-hills"><i className="far" /><i className="near" /></div>
      <div className="fd-water"><i /><i /><i />
        {shadows.map((s, i) => <img key={s} src={`${ART}fish/${s}.png`} alt="" className={`fdk-px fdk-shadow s${i}`} />)}
      </div>
      <div className="fdk-dock"><i /><i /></div>
      <div className="fdk-host">
        {say && !asking && (
          <div className="fdk-say" aria-live="polite">
            <p>{say}</p>
            <button type="button" className="btn fdk-listen" onClick={() => speak(say, undefined, undefined, DOC_VOICE)} aria-label="Listen to Doc Fishing">🔊</button>
          </div>
        )}
        <div className="fdk-doc">
          {docArt ? <img src={`${ART}doc-fishing.jpg`} alt="Doc Fishing" onError={() => setDocArt(false)} /> : <span className="fdk-doc-emoji" aria-hidden>🐶</span>}
          <span className="fdk-doc-name">Doc Fishing</span>
        </div>
      </div>
      <div className={`fdk-rod ${rodClass}`} aria-hidden>
        <img src={`${ART}rods/${myRod.id}-rod.png`} alt="" className="fdk-px" />
        <span ref={tipRef} className="fdk-tip" />
      </div>
      <svg className="fdk-line" aria-hidden><line ref={lineRef} style={{ visibility: lineOn ? 'visible' : 'hidden' }} /></svg>
      {lineOn && (
        <div className={`fdk-bob${phase === 'casting' ? ' fly' : ''}${phase === 'bite' ? ' bite' : ''}`} style={{ left: `${bobberX}%` }}>
          {phase !== 'casting' && <i className="fdk-ring" />}
          <img ref={bobRef} src={`${ART}fish/bobber-${myBobber.id}.png`} alt="" className="fdk-px" />
        </div>
      )}
      {phase === 'leap' && leapImg && (
        <div className="fdk-leap" style={{ ['--from' as string]: `${bobberX}%` }} aria-hidden><img src={leapImg} alt="" className="fdk-px" /></div>
      )}
      {show?.kind === 'school' && (
        <div key={show.at} className="fdk-school" aria-hidden>
          {SCHOOL.map((s, i) => <img key={s} src={`${ART}fish/${s}.png`} alt="" className="fdk-px" style={{ left: `${8 + i * 7.5}%`, animationDelay: `${(i % 4) * 0.18 + Math.floor(i / 4) * 0.5}s` }} />)}
        </div>
      )}
      {show?.kind === 'bubbles' && (
        <div key={show.at} className="fdk-bubbles" aria-hidden>
          {Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 96 + 2}%`, animationDelay: `${(i % 6) * 0.3}s`, width: 14 + (i % 4) * 10, height: 14 + (i % 4) * 10 }} />)}
        </div>
      )}
      {stage === 'play' && (
        <div className={`fdk-clock${timeLeft <= 15 ? ' low' : ''}`} role="timer" aria-label={`Game time left: ${clock}`}>⏰ {clock}</div>
      )}
      {stage === 'start' && (
        <div className="pf-overlay fdk-start">
          <div className="pf-panel fdk-start-card">
            <h2>Doc Fishing</h2>
            <img src={`${ART}doc-fishing.jpg`} alt="Doc Fishing" className="fdk-start-doc" />
            <p className="fdk-start-say">{say}</p>
            <label className="fdk-time" htmlFor="fdk-minutes">
              <span>Game time: <b>{chosen} {chosen === 1 ? 'minute' : 'minutes'}</b></span>
              <input id="fdk-minutes" type="range" min={1} max={10} step={1} value={chosen} onChange={(e) => setMinutes(Number(e.target.value))} />
              <small><span>1 min</span><span>10 min</span></small>
            </label>
            <button type="button" className="btn btn-primary btn-lg fd-big" onClick={startGame}>Start fishing</button>
          </div>
        </div>
      )}
      {stage === 'end' && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <button type="button" className="btn fdk-card-listen" onClick={() => doc(say)} aria-label="Listen">🔊</button>
            <h2>Time is up!</h2>
            <div className="fdk-end-stats">
              <p>🐟 Caught: <b>{run.current.catches}</b></p>
              <p>✨ New kinds: <b>{run.current.kinds}</b></p>
              <p>⭐ XP earned: <b>{run.current.xp}</b></p>
              {run.current.best && <p>📏 Biggest: <b>{run.current.best.size} cm {run.current.best.name}</b></p>}
            </div>
            <div className="pf-detail-actions">
              <button type="button" className="btn btn-lg" onClick={() => back.go()}>Leave</button>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => { setStage('start'); doc('Want to fish some more? Pick your time and tap Start fishing.'); }}>Fish again</button>
            </div>
          </div>
        </div>
      )}
      {diamondLeft > 0 && (
        <div className="fdk-timer" role="timer" aria-label={`Diamond Rod, ${diamondLeft} seconds left, no questions`}>
          <img src={`${ART}rods/diamond.png`} alt="" className="fdk-px" /><span>{mm}</span><small>NO QUESTIONS</small>
        </div>
      )}
      <header className="fd-head">
        <LeaveButton onLeave={() => { pay(); back.go(); }} />
        <h1 className="fdk-title">Doc Fishing</h1>
        <button type="button" className="btn fdk-icon" onClick={flipRead} aria-pressed={readAloud} aria-label={readAloud ? 'Doc Fishing reads aloud. Tap to turn it off.' : 'Reading aloud is off. Tap to turn it on.'}>{readAloud ? '🗣️' : '🤐'}</button>
        <SfxToggle />
        <MyBest game="fishingDock" unit="cm" />
        <button type="button" className="btn fdk-hbtn" onClick={() => { play('tackle'); setPanel('tackle'); doc('Here is your tackle box. Pick a rod and a bobber.'); }}><img src={`${ART}ui/chest.png`} alt="" className="fdk-px" /> Tackle box</button>
        <button type="button" className="btn fdk-hbtn" onClick={() => { play('tackle'); setPanel('book'); }}><img src={`${ART}ui/bucket.png`} alt="" className="fdk-px" /> Fish Book ({kinds} / {CATCHABLE.length})</button>
      </header>
      {xpPop && <div key={xpPop.at} className="fdk-xp-pop" aria-live="polite">+{xpPop.n} XP <small>{xpPop.why}</small></div>}
      {rodUp && (
        <div key={rodUp.at} className="fdk-rodup" role="status">
          <img src={`${ART}rods/${rodUp.rod.id}.png`} alt="" className="fdk-px" /><span>ROD UPGRADE!</span><b>{rodUp.rod.name} Rod</b>
        </div>
      )}
      <div className="fd-panel">
        <div className="fdk-xp" role="meter" aria-valuemin={topRod.xp} aria-valuemax={nextRod?.xp ?? xpNow} aria-valuenow={xpNow} aria-label={nextRod ? `XP meter: ${xpNow - topRod.xp} of ${nextRod.xp - topRod.xp}. Fill it to upgrade to the ${nextRod.name} Rod.` : `${xpNow} XP. You have the top rod.`}>
          <img src={`${ART}rods/${topRod.id}.png`} alt="" className="fdk-px" />
          <div className="fdk-xp-bar">
            <i style={{ width: `${nextRod ? ((xpNow - topRod.xp) / (nextRod.xp - topRod.xp)) * 100 : 100}%` }} />
            <span>{nextRod ? `XP ${xpNow - topRod.xp} / ${nextRod.xp - topRod.xp}` : `XP ${xpNow} · Top rod!`}</span>
          </div>
          {nextRod && <img src={`${ART}rods/${nextRod.id}.png`} alt="" className="fdk-px fdk-xp-next" />}
        </div>
        {stage === 'play' && freeCasts > 0 && diamondLeft <= 0 && phase === 'ready' && <p className="fd-msg">🧪 Free casts with no question: {freeCasts}</p>}
        {stage === 'play' && timeLeft <= 0 && phase !== 'ready' && <p className="fd-msg">⏰ Time is up! Finish this cast.</p>}
        {stage === 'play' && phase === 'ready' && timeLeft > 0 && <button type="button" className="btn btn-primary btn-lg fd-big" onClick={startPower}>Cast your line</button>}
        {phase === 'power' && (
          <>
            <div className="fd-meter" aria-label="Cast power"><i className="fd-sweet" style={{ left: `${sweetLo * 100}%`, width: `${(sweetHi - sweetLo) * 100}%` }} /><b style={{ left: `${power * 100}%` }} /></div>
            <button type="button" className="btn btn-primary btn-lg fd-big" onClick={release}>Cast! (stop in the green)</button>
          </>
        )}
        {phase === 'wait' && <p className="fd-msg">Waiting for a bite... 🤫</p>}
        {phase === 'bite' && <button type="button" className="btn btn-primary btn-lg fd-big fd-pulse" onClick={reel}>A bite! Reel it in!</button>}
        {phase === 'away' && <button type="button" className="btn btn-primary btn-lg fd-big" onClick={startPower}>Cast again</button>}
      </div>
      {phase === 'caught' && caughtNow && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <button type="button" className="btn fdk-card-listen" onClick={() => doc(say)} aria-label="Listen">🔊</button>
            {caughtNow.kind === 'fish' ? (
              <>
                {caughtNow.isNew && <span className="fd-new">✨ New for your Fish Book!</span>}
                <div className="fd-fish fdk-catch-img" aria-hidden><Sprite fish={caughtNow.fish} size={128} /></div>
                <h2>You caught {caughtNow.fish.id === 'mussels' ? 'some Mussels' : `a ${caughtNow.fish.name}`}!</h2>
                <span className="fd-tier" style={{ background: TIER_COLOR[caughtNow.fish.tier] }}>{TIER_NAME[caughtNow.fish.tier]}</span>
                <p><b>{caughtNow.size} cm</b> long. {caughtNow.fish.fact}</p>
                <p className="fdk-xpline">+{caughtNow.xp} XP</p>
                {caughtNow.newBobber && <p className="fdk-unlock">🎈 New bobber: <b>{caughtNow.newBobber}</b>. Find it in your tackle box.</p>}
              </>
            ) : (
              <>
                <span className="fd-new">🧪 A power-up!</span>
                <div className="fd-fish fdk-catch-img" aria-hidden><img src={`${ART}potions/${caughtNow.power.id}.png`} alt="" className="fdk-px" style={{ width: 128, height: 128 }} /></div>
                <h2>You fished up a {caughtNow.power.name}!</h2>
                <p>{caughtNow.power.blurb}</p>
                <p className="fdk-xpline">+{caughtNow.xp} XP</p>
              </>
            )}
            <div className="pf-detail-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={closeCatch}>{caughtNow.kind === 'power' ? 'Use it!' : 'Fish again'}</button>
            </div>
          </div>
        </div>
      )}
      {panel === 'book' && (
        <div className="pf-overlay" onClick={() => setPanel(null)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Fish Book</h2>
            <div className="fd-book">
              {FISH.filter((x) => !x.legacy || got[x.id]).map((x) => (
                <button type="button" key={x.id} className={`fd-page${got[x.id] ? '' : ' locked'}`} onClick={() => got[x.id] && doc(`${x.name}. ${x.fact}`)} aria-label={got[x.id] ? `${x.name}. Tap to hear about it.` : 'Not caught yet'}>
                  <span className="fd-page-icon">{got[x.id] ? <Sprite fish={x} size={48} /> : '❔'}</span>
                  <strong>{got[x.id] ? x.name : '???'}</strong>
                  <small style={{ color: TIER_COLOR[x.tier] }}>{TIER_NAME[x.tier]}</small>
                  {got[x.id] ? <small>Caught {got[x.id]}, biggest {saved.biggest?.[x.id] ?? 0} cm</small> : null}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setPanel(null)}>Close</button>
          </div>
        </div>
      )}
      {panel === 'tackle' && (
        <div className="pf-overlay" onClick={() => setPanel(null)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Tackle box</h2>
            <h3 className="fdk-sub">Rods <small>(fill your XP meter for the next rod; a better rod has a bigger green spot)</small></h3>
            <div className="fdk-tackle">
              {RODS.map((r) => {
                const has = xpNow >= r.xp;
                return (
                  <button key={r.id} type="button" className={`fdk-item${myRod.id === r.id ? ' on' : ''}`} disabled={!has} onClick={() => equip({ rod: r.id })}>
                    <img src={`${ART}rods/${r.id}.png`} alt="" className="fdk-px" style={{ opacity: has ? 1 : 0.3 }} />
                    <b>{r.name}</b><small>{has ? `Green spot ${Math.round(r.sweet * 100)}%` : `Reach ${r.xp} XP`}</small>
                  </button>
                );
              })}
            </div>
            <h3 className="fdk-sub">Bobbers</h3>
            <div className="fdk-tackle">
              {BOBBERS.map((b) => {
                const has = kinds >= b.need;
                return (
                  <button key={b.id} type="button" className={`fdk-item${myBobber.id === b.id ? ' on' : ''}`} disabled={!has} onClick={() => equip({ bobber: b.id })}>
                    <img src={`${ART}fish/bobber-${b.id}.png`} alt="" className="fdk-px" style={{ opacity: has ? 1 : 0.3, filter: has ? undefined : 'grayscale(1)' }} />
                    <b>{has ? b.name : '???'}</b><small>{has ? '' : `Catch ${b.need} kinds`}</small>
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setPanel(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
    {/* Her rule (2026-10-12): the question is the normal full screen in regular type, outside the pixel theme. */}
    {element}
    </>
  );
}
