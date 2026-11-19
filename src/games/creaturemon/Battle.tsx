// Creaturemon battles (Build Queue 725, her words: "the students have requested separate battles for their
// creaturemons, similar to pokemon battles and similar to our pet battle format"). Turn based, in the same steps as the
// Supernature creature battles: 1 pick your creature, 2 pick an opponent (two cards; a wild creature is already
// picked), 3 battle. Each round: tap one move, answer a question to fuel it, then the other creature answers with its own
// move (Learn mode, 728). One clear "do this now" line at the top, read aloud, with a Listen. Nobody gets hurt: the
// creature that runs out of health taps out and gets a high five. Health bars, buttons, banners and icons are from
// her Pixel UI pack 3 and IconGodotNode packs (726).
import { useEffect, useRef, useState } from 'react';
import { speak } from '../../components/ReadAloud';
import { sfx } from '../../lib/miniSfx';
import { CreatureCard, Sprite } from './Card';
import { Fx, XpBar, uiSound, type CmApi } from './shared';
import { FightHud, IslandStage } from './Island';
import { IMG, abName, abv, LINES, STRONG, TYPE_COLOR, battleXp, displayName, form, line, rollAbility, statsAt, typeMult, type AbilityId, type CType, type Mon } from './data';

type MoveId = 'tackle' | 'special' | 'guard' | 'berry';
interface F { name: string; formId: string; level: number; type: CType; hp: number; max: number; atk: number; def: number; spd: number; guard: boolean; berry: boolean; abs: AbilityId[] }
const UI = `${IMG}ui/`;
const fighter = (formId: string, level: number, name: string, abs: AbilityId[] = []): F => {
  const s = statsAt(form(formId), level); const max = Math.round(s.hp * 1.5);
  return { name, formId, level, type: line(formId).type, hp: max, max, atk: s.atk, def: s.def, spd: s.spd, guard: false, berry: true, abs };
};
const has = (f: F, a: AbilityId) => f.abs.includes(a);
const stg = (f: F) => form(f.formId).stage;
const fxOf = (t: CType) => t.toLowerCase();
// Her battle song (733): "cinematic battle song" by theojt (Freesound).
const SONG = `${IMG}battle-song.mp3`;
// An opponent about the student's level, in the right evolution stage for that level.
export function foeAt(level: number) {
  const l = LINES[Math.floor(Math.random() * LINES.length)]; const lv = Math.max(1, level + Math.floor(Math.random() * 3) - 1);
  let f = l.forms[0]; for (let i = 1; i < l.forms.length; i++) if ((l.forms[i - 1].evolvesAt ?? 99) <= lv) f = l.forms[i];
  return { formId: f.id, level: lv };
}
export type BattleEnd = { won: boolean; foe: { formId: string; level: number } } | null;

export default function Battle({ cm, wildFoe, ask, onClose, learn = true }: {
  cm: CmApi; wildFoe?: { formId: string; level: number }; ask: (label: string, onRight: () => void, onCancel?: () => void, count?: number) => void; learn?: boolean;
  onClose: (r: BattleEnd) => void;
}) {
  const tts = cm.student?.ttsSettings;
  const [readOn, setReadOn] = useState(true);
  const readRef = useRef(readOn); readRef.current = readOn;
  const say = (t: string) => { if (readRef.current) speak(t, tts); };
  const [phase, setPhase] = useState<'pick' | 'foe' | 'fight' | 'done'>('pick');
  const [mine, setMine] = useState<Mon | null>(null);
  const [cards, setCards] = useState(() => { const lv = Math.max(1, ...cm.team.map((m) => m.level)); return [foeAt(lv), foeAt(lv)]; });
  const [foePick, setFoePick] = useState(wildFoe ?? null);
  const [me, setMe] = useState<F | null>(null);
  const [foe, setFoe] = useState<F | null>(null);
  const [stage, setStage] = useState<'choose' | 'mine' | 'theirs' | 'power'>('choose');
  const [round, setRound] = useState(1);
  const focusRef = useRef(0.6);
  const [lines, setLines] = useState<string[]>([]);
  const [fx, setFx] = useState<{ side: 'me' | 'foe'; hit: boolean; type: CType; name?: string } | null>(null);
  const [glow, setGlow] = useState<{ side: 'me' | 'foe'; name: string; key: number } | null>(null);
  const [shot, setShot] = useState<{ from: 'me' | 'foe'; type: CType; x: number; y: number; dx: number; dy: number } | null>(null);
  const [lunge, setLunge] = useState<'me' | 'foe' | null>(null);
  const dealt = useRef(0); const taken = useRef(0);
  const arenaRef = useRef<HTMLDivElement>(null); const meRef = useRef<HTMLDivElement>(null); const foeRef = useRef<HTMLDivElement>(null);
  const showGlow = (side: 'me' | 'foe', name: string) => { setGlow({ side, name, key: Date.now() }); window.setTimeout(() => setGlow((g) => (g?.name === name ? null : g)), 1300); };
  // Build Queue 733 (her words: "attacks should always come from the front of the player"): a special move leaves from the
  // front edge of the creature using it (yours faces right, toward the other creature; theirs faces left) and flies to
  // the other one; a Tackle lunges forward.
  const fire = (from: 'me' | 'foe', type: CType) => {
    const ar = arenaRef.current?.getBoundingClientRect(); const a = (from === 'me' ? meRef : foeRef).current?.getBoundingClientRect(); const b = (from === 'me' ? foeRef : meRef).current?.getBoundingClientRect();
    if (!ar || !a || !b) return;
    const x = (from === 'me' ? a.right - a.width * 0.12 : a.left + a.width * 0.12) - ar.left, y = a.top + a.height * 0.55 - ar.top;
    const tx = b.left + b.width / 2 - ar.left, ty = b.top + b.height * 0.55 - ar.top;
    setShot({ from, type, x, y, dx: tx - x, dy: ty - y });
  };
  // the battle song, while the battle is on
  const [music, setMusic] = useState(() => { try { return localStorage.getItem('cm-music') !== '0'; } catch { return true; } });
  const song = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (phase !== 'fight' || !music) { song.current?.pause(); return; }
    if (!song.current) { song.current = new Audio(SONG); song.current.loop = true; song.current.volume = 0.32; }
    void song.current.play().catch(() => {});
  }, [phase, music]);
  useEffect(() => () => { song.current?.pause(); song.current = null; }, []);
  const [won, setWon] = useState<boolean | null>(null);
  const [xp, setXp] = useState(0);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const wait = (ms: number, fn: () => void) => { timer.current = window.setTimeout(fn, cm.calm ? ms * 0.7 : ms); };
  const add = (t: string, read = true) => { setLines((l) => [...l.slice(-2), t]); if (read) say(t); };

  // Team battles (735, her words: "team battles where they would have multiple battles in a row ... (one at a time)"):
  // up to 3 creatures on each side; when one taps out, the next one comes in.
  const [teamMode, setTeamMode] = useState(false);
  // 754: a creature that loses a heart falls off the island, then drops back on
  const [falling, setFalling] = useState<{ me?: boolean; foe?: boolean }>({});
  const livesOf = (f: F | null) => (f ? (f.hp <= 0 ? 0 : Math.ceil(f.hp / (f.max / 3) - 1e-6)) : 3);
  const prevLives = useRef<{ me: number; foe: number; key: string }>({ me: 3, foe: 3, key: '' });
  useEffect(() => {
    const key = `${me?.name}|${foe?.name}`; const p = prevLives.current;
    const lm = livesOf(me), lf = livesOf(foe);
    if (p.key !== key) { prevLives.current = { me: lm, foe: lf, key }; return; }
    const drop = (side: 'me' | 'foe', name: string) => { setFalling((x) => ({ ...x, [side]: true })); sfx.boing(); add(`${name} falls off the island and loses a heart!`, false); window.setTimeout(() => setFalling((x) => ({ ...x, [side]: false })), cm.calm ? 900 : 1500); };
    if (me && lm < p.me) drop('me', me.name);
    if (foe && lf < p.foe) drop('foe', foe.name);
    prevLives.current = { me: lm, foe: lf, key };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.hp, foe?.hp, me?.name, foe?.name]);
  const [sel, setSel] = useState<Mon | null>(null);
  const [picks, setPicks] = useState<Mon[]>([]);
  const myQ = useRef<Mon[]>([]); const foeQ = useRef<{ formId: string; level: number }[]>([]); const used = useRef<Mon[]>([]);
  const foeAbs = () => (Math.random() < 0.35 ? [rollAbility({})!].filter(Boolean) : []);
  const mkMe = (m: Mon) => { const fresh = cm.sRef.current.mons.find((x) => x.uid === m.uid) ?? m; used.current.push(fresh); setMine(fresh); return fighter(fresh.formId, fresh.level, displayName(fresh), fresh.abilities ?? []); };
  const mkFoe = (f: { formId: string; level: number }) => fighter(f.formId, f.level, `${wildFoe ? 'Wild ' : ''}${form(f.formId).name}`, foeAbs());
  // Someone tapped out: the next creature on that side comes in, or the battle is over.
  const tapOut = (iLost: boolean, a: F, b: F): boolean => {
    if (iLost && myQ.current.length) { const n = mkMe(myQ.current.shift()!); setMe(n); meR.current = n; add(`${a.name} taps out. High five! Go, ${n.name}!`); wait(1500, () => next(n)); return true; }
    if (!iLost && foeQ.current.length) { const n = mkFoe(foeQ.current.shift()!); setFoe(n); foeR.current = n; add(`${b.name} taps out. High five! Here comes ${n.name}!`); wait(1500, () => next(a)); return true; }
    return false;
  };
  const beginTeam = (list: Mon[], foes: { formId: string; level: number }[]) => {
    used.current = []; myQ.current = list.slice(1); foeQ.current = foes.slice(1);
    const a = mkMe(list[0]), b = mkFoe(foes[0]);
    setMe(a); setFoe(b); setPhase('fight'); setStage('choose'); setRound(0); focusRef.current = 0.6; sfx.chime(); dealt.current = 0; taken.current = 0;
    meR.current = a; foeR.current = b;
    add(`Team battle! ${list.length} against ${foes.length}. ${a.name} faces ${b.name}! Ready, go!`);
    wait(1200, () => next(a));
  };
  const begin = (m: Mon, f: { formId: string; level: number }) => {
    used.current = []; myQ.current = []; foeQ.current = [];
    const fresh = cm.sRef.current.mons.find((x) => x.uid === m.uid) ?? m; used.current.push(fresh);
    const foeAb = Math.random() < 0.35 ? [rollAbility({})!].filter(Boolean) : [];
    const a = fighter(fresh.formId, fresh.level, displayName(fresh), fresh.abilities ?? []), b = fighter(f.formId, f.level, `${wildFoe ? 'Wild ' : ''}${form(f.formId).name}`, foeAb);
    setMe(a); setFoe(b); setPhase('fight'); setStage('choose'); setRound(0); focusRef.current = 0.6; sfx.chime(); dealt.current = 0; taken.current = 0;
    const abWords = a.abs.length ? ` ${a.name} is ${a.abs.map((x) => abName(x, stg(a))).join(' and ')}.` : '';
    meR.current = a; foeR.current = b;
    add(`${a.name} faces ${b.name}!${abWords} Ready, go!`);
    wait(1200, () => next(a));
  };
  const pickMine = (m: Mon) => { setMine(m); uiSound('cursor-1'); if (foePick) begin(m, foePick); else setPhase('foe'); };
  const pickFoe = (f: { formId: string; level: number }) => { setFoePick(f); if (mine) begin(mine, f); };

  const moveName = (f: F, m: MoveId) => (m === 'special' ? line(f.formId).special.name : m === 'tackle' ? 'Tackle' : m === 'guard' ? 'Guard' : 'Berry snack');
  // One move. Hits: power, type, focus (right answers), the other creature's guard, its abilities (732), a little luck.
  const doMove = (a: F, d: F, m: MoveId, side: 'me' | 'foe', foc: number): { a: F; d: F; text: string } => {
    const other = side === 'me' ? 'foe' : 'me';
    if (m === 'guard') { sfx.tick(); showGlow(side, 'guard'); return { a: { ...a, guard: true, hp: Math.min(a.max, a.hp + Math.round(a.max * 0.06)) }, d, text: `${a.name} uses Guard! It gets ready to block.` }; }
    if (m === 'berry') { sfx.coin(); showGlow(side, 'heal'); return { a: { ...a, berry: false, hp: Math.min(a.max, a.hp + Math.round(a.max * (has(a, 'snacky') ? abv('snacky', stg(a)) : 0.4))) }, d, text: `${a.name} eats a berry and gets health back!${has(a, 'snacky') ? ' Snacky: extra health!' : ''}` }; }
    const special = m === 'special';
    const miss = Math.random() > (special ? 0.88 : 0.96) - (has(d, 'speedy') ? abv('speedy', stg(d)) : 0);
    setFx({ side: other, hit: !miss, type: a.type, name: special ? fxOf(a.type) : 'stone' }); window.setTimeout(() => setFx(null), 1000);
    if (miss) { sfx.boing(); return { a, d: { ...d, guard: false }, text: `${a.name} uses ${moveName(a, m)}, but ${d.name} dodges!${has(d, 'speedy') ? ' So speedy!' : ''}` }; }
    const mult = special ? typeMult(a.type, d.type) : 1;
    let dmg = (special ? 1.45 : 1) * a.atk * mult * (0.75 + 0.5 * foc) * (9 / (d.def + 9)) * (0.85 + Math.random() * 0.3) * 1.3;
    const notes: string[] = [];
    if (has(a, 'brave') && a.hp < a.max / 2) { dmg *= abv('brave', stg(a)); notes.push(`${a.name} is ${abName('brave', stg(a))}!`); }
    // Build Queue 737: every creature hits harder as its hearts run low (20% under half, 45% under a quarter).
    const low = a.hp < a.max * 0.25 ? 1.45 : a.hp < a.max * 0.5 ? 1.2 : 1;
    if (low > 1) notes.push(`${a.name} fights back harder!`);
    dmg *= low;
    if (has(a, 'focused') && foc >= 1) dmg *= abv('focused', stg(a));
    if (has(d, 'tough')) dmg *= abv('tough', stg(d));
    if (d.guard) dmg *= has(d, 'zen') ? abv('zen', stg(d)) : 0.45;
    let n = Math.max(1, Math.round(dmg));
    if (has(a, 'lucky') && Math.random() < abv('lucky', stg(a))) { n *= 2; notes.push('A lucky double hit!'); }
    sfx.bonk();
    const extra = mult > 1 ? ' It is super strong!' : mult < 1 ? ' It is not very strong.' : '';
    let na = a;
    if (has(d, 'spiky')) { const poke = Math.max(1, Math.ceil(n * abv('spiky', stg(d)))); na = { ...a, hp: Math.max(1, a.hp - poke) }; notes.push(`Ouch, ${abName('spiky', stg(d))}! ${a.name} gets poked and loses ${poke}.`); window.setTimeout(() => showGlow(side, 'stone'), 400); if (side === 'me') taken.current += poke; else dealt.current += poke; }
    if (side === 'me') dealt.current += n; else taken.current += n;
    return { a: na, d: { ...d, hp: Math.max(0, d.hp - n), guard: false }, text: `${a.name} uses ${moveName(a, m)}!${extra} ${d.name} loses ${n} health.${notes.length ? ` ${notes.join(' ')}` : ''}` };
  };
  // Lazy (732): after its move, a tired creature sometimes takes a nap and gets health back.
  const nap = (f: F, side: 'me' | 'foe'): F => {
    if (!has(f, 'lazy') || f.hp >= f.max * 0.6 || f.hp <= 0 || Math.random() > abv('lazyChance', stg(f))) return f;
    showGlow(side, 'heal'); add(`${f.name} is ${abName('lazy', stg(f))} and takes a quick nap. Zzz. It gets health back!`, true);
    return { ...f, hp: Math.min(f.max, f.hp + Math.round(f.max * abv('lazyHeal', stg(f)))) };
  };
  const finish = (iWon: boolean, a: F, b: F) => {
    live.current = false; window.clearTimeout(foeLoop.current);
    setWon(iWon); setPhase('done'); setShot(null);
    const gain = Math.round(battleXp(b.level, iWon) * (has(a, 'cheerful') ? abv('cheerful', stg(a)) : 1)); setXp(gain);
    const all = used.current.length ? used.current : mine ? [mine] : [];
    all.forEach((m, i) => {
      cm.train(m.uid, gain);
      cm.stat(m.uid, (st) => ({ ...st, battles: st.battles + 1, wins: st.wins + (iWon ? 1 : 0), losses: st.losses + (iWon ? 0 : 1), dealt: st.dealt + (i === all.length - 1 ? dealt.current : 0), taken: st.taken + (i === all.length - 1 ? taken.current : 0) }));
    });
    // a win sometimes teaches a new ability (732)
    const last = all[all.length - 1]; if (iWon && last && Math.random() < 0.3) window.setTimeout(() => cm.learn(last.uid, 'in battle'), 2500);
    cm.put({ wins: cm.sRef.current.wins + (iWon ? 1 : 0), orbs: cm.sRef.current.orbs + (iWon ? 2 : 0) });
    sfx.chime();
    say(iWon ? `${b.name} taps out. ${a.name} wins! High fives! ${a.name} gets ${gain} XP.${wildFoe ? ' It is tired now. Throw an orb!' : ''}` : `${a.name} taps out. ${b.name} wins this time. That is okay, every battle is practice. ${a.name} still gets ${gain} XP.`);
  };
  // Build Queue 762 (her words: "for createmon, students want an active battle, not turn taking"): the battle is live.
  // Both creatures move at the same time: tap any move the moment it is ready (each one has a short recharge ring),
  // and the other creature attacks on its own clock (faster creatures attack more often). Guard blocks for 2 seconds.
  // Learn mode (728) still fuels the battle with questions: the special move needs a charge, and a right answer gives
  // 3 charges at full power (the battle waits while the question is open). Play mode has no questions; the special
  // move just has a longer recharge.
  const meR = useRef<F | null>(null); const foeR = useRef<F | null>(null);
  meR.current = me; foeR.current = foe;
  const live = useRef(false); const hold = useRef(false);
  const CD: Record<MoveId, number> = { tackle: 900, special: learn ? 1800 : 3200, guard: 3500, berry: 0 };
  const [ready, setReady] = useState<Record<MoveId, number>>({ tackle: 0, special: 0, guard: 0, berry: 0 });
  const [charges, setCharges] = useState(0); const chargesRef = useRef(0); chargesRef.current = charges;
  const [, setTick] = useState(0);
  useEffect(() => { if (phase !== 'fight') return; const t = window.setInterval(() => setTick((x) => x + 1), 120); return () => window.clearInterval(t); }, [phase]);
  const busy = useRef({ me: false, foe: false });
  const applyHit = (side: 'me' | 'foe', m: MoveId, foc: number) => {
    const a = side === 'me' ? meR.current : foeR.current, d = side === 'me' ? foeR.current : meR.current;
    if (!a || !d || !live.current || a.hp <= 0 || d.hp <= 0) { busy.current[side] = false; return; }
    if (m === 'special') fire(side, a.type); if (m === 'tackle') setLunge(side);
    window.setTimeout(() => {
      busy.current[side] = false;
      const a2 = side === 'me' ? meR.current : foeR.current, d2 = side === 'me' ? foeR.current : meR.current;
      setShot((sh) => (sh?.from === side ? null : sh)); setLunge((l) => (l === side ? null : l));
      if (!a2 || !d2 || !live.current || a2.hp <= 0 || d2.hp <= 0) return;
      const r = doMove({ ...a2, guard: m === 'guard' ? false : a2.guard }, d2, m, side, foc);
      const na = nap(r.a, side);
      if (side === 'me') { meR.current = na; foeR.current = r.d; setMe(na); setFoe(r.d); } else { foeR.current = na; meR.current = r.d; setFoe(na); setMe(r.d); }
      add(r.text, false);
      if (m === 'guard') window.setTimeout(() => { const cur = side === 'me' ? meR.current : foeR.current; if (cur?.guard) { const off = { ...cur, guard: false }; if (side === 'me') { meR.current = off; setMe(off); } else { foeR.current = off; setFoe(off); } } }, 2000);
      if (r.d.hp <= 0) knockOut(side === 'foe');
      else if (na.hp <= 0) knockOut(side === 'me');
    }, m === 'special' ? 650 : m === 'tackle' ? 350 : 120);
  };
  // Someone ran out of health: the battle stops for a moment, then the next creature comes in or it is over.
  const knockOut = (iLost: boolean) => {
    live.current = false;
    const a = meR.current!, b = foeR.current!;
    wait(1300, () => { if (!tapOut(iLost, a, b)) finish(!iLost, a, b); });
  };
  const act = (m: MoveId) => {
    const a = meR.current; if (!a || !live.current || hold.current || busy.current.me || (m === 'berry' && !a.berry) || Date.now() < ready[m]) return;
    uiSound('select-1');
    const go = (foc: number) => { busy.current.me = true; setReady((r) => ({ ...r, [m]: Date.now() + CD[m] })); if (foc >= 1 && m !== 'guard' && m !== 'berry') showGlow('me', 'power'); applyHit('me', m, foc); };
    if (m === 'special' && learn) {
      if (chargesRef.current > 0) { setCharges((c) => c - 1); go(1); return; }
      hold.current = true; setStage('power');
      ask(`Creaturemon: answer to charge ${moveName(a, m)}`, () => { hold.current = false; setStage('choose'); setCharges(2); add(`Charged! ${moveName(a, m)} is ready 3 times at full power.`); go(1); },
        () => { hold.current = false; setStage('choose'); add(`${a.name} has no charge, so the move is weak.`, false); go(0.35); });
      return;
    }
    go(m === 'special' ? 0.85 : 0.6);
  };
  // The other creature fights on its own clock and plays to win (737): its strongest move, a berry when low, a Guard
  // when your creature could finish it.
  const foeLoop = useRef(0);
  const foeThink = () => {
    window.clearTimeout(foeLoop.current);
    const a = meR.current, b = foeR.current; if (!a || !b) return;
    const gap = Math.max(900, 2300 - b.spd * 18) * (cm.calm ? 1.3 : 1) * (0.8 + Math.random() * 0.4);
    foeLoop.current = window.setTimeout(() => {
      if (live.current && !hold.current && !busy.current.foe) {
        const me2 = meR.current!, f2 = foeR.current!;
        const tm = typeMult(f2.type, me2.type);
        const myHit = me2.atk * 1.45 * typeMult(me2.type, f2.type) * (9 / (f2.def + 9)) * 1.3;
        const m: MoveId = f2.hp < f2.max * 0.4 && f2.berry ? 'berry'
          : f2.hp <= myHit && !f2.guard && Math.random() < 0.3 ? 'guard'
          : tm >= 1 && Math.random() < 0.45 ? 'special' : 'tackle';
        busy.current.foe = true; applyHit('foe', m, 0.75);
      }
      if (phaseRef.current === 'fight') foeThink();
    }, gap);
  };
  const phaseRef = useRef(phase); phaseRef.current = phase;
  useEffect(() => () => window.clearTimeout(foeLoop.current), []);
  const next = (a: F) => {
    setStage('choose'); setRound((x) => x + 1); busy.current = { me: false, foe: false };
    live.current = true; add(`Go, ${a.name}! Tap your moves.`); foeThink();
  };
  const again = () => { live.current = false; window.clearTimeout(foeLoop.current); setCharges(0); setReady({ tackle: 0, special: 0, guard: 0, berry: 0 }); setPhase('pick'); setMe(null); setFoe(null); setWon(null); setLines([]); setMine(null); setPicks([]); if (!wildFoe) setFoePick(null); };

  const step = phase === 'pick' ? 1 : phase === 'foe' ? 2 : 3;
  const doNow = phase === 'pick' ? (teamMode ? 'Tap up to 3 creatures for your team, then tap Start team battle.' : 'Tap the creature you want to battle with.')
    : phase === 'foe' ? 'Tap Battle under the creature you want to battle. Or tap New opponents.'
    : phase === 'done' ? (won ? (wildFoe ? 'You won! Tap Throw orb to catch it.' : 'You won! Tap Battle again or Done.') : 'Good try! Tap Battle again or Done.')
    : stage === 'power' ? 'Answer the question to charge your special move. The battle waits for you.'
    : learn ? `Battle! Tap moves when they are ready. Your special move needs a charge${charges ? ` (${charges} left)` : ': tap it to answer a question'}.`
    : 'Battle! Tap moves when they are ready. Guard blocks for 2 seconds.';
  useEffect(() => { if (phase === 'pick' || phase === 'foe') say(doNow); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [phase]);

  // Build Queue 729 (her words: "battles should be heart related and xp bar. show health meters on left and right sides.
  // left for the player, right for the opponent"): health is a column of her AXIALE hearts on each side of the screen,
  // each heart filling in quarters; the student's side also shows the XP bar to the next level.
  const side = (f: F, s: 'me' | 'foe') => {
    const ff = form(f.formId); const back = s === 'me' && !!ff.sprite.back;
    return (
      <div className={`cmb-side side-${s}${fx?.side === s ? (fx.hit ? ' hit' : ' miss') : ''}${lunge === s ? ' lunge' : ''}${falling[s] ? ' falling' : ''}`}>
        <div className="cmb-stand" ref={s === 'me' ? meRef : foeRef}>
          {back ? <img className="cmb-back" src={`${IMG}forms/${ff.id}_back.png`} alt="" style={{ height: Math.min(170, ff.sprite.fh * Math.max(1, Math.floor(150 / ff.sprite.fh))) }} />
            : <Sprite f={ff} px={Math.min(150, 60 + ff.stage * 26)} anim={fx?.side === s && fx.hit ? 'hurt' : 'idle'} style={s === 'me' ? { transform: 'scaleX(-1)' } : undefined} />}
          <span className="cmb-plat"><img src={`${UI}grass_basic_01.png`} alt="" className="cmb-tuft l" /><img src={`${UI}grass_basic_03.png`} alt="" className="cmb-tuft r" /></span>
          {fx?.side === s && !fx.hit && <span className="cmb-boom">Dodged!</span>}
          {fx?.side === s && fx.hit && <span className="cmb-fxat"><Fx name={fx.name ?? fxOf(fx.type)} size={170} /></span>}
          {glow?.side === s && <span className="cmb-fxat" key={glow.key}><Fx name={glow.name} size={190} /></span>}
        </div>
      </div>
    );
  };
  const cdPct = (m: MoveId) => { const left = ready[m] - Date.now(); return left > 0 && CD[m] ? Math.round((left / CD[m]) * 100) : 0; };
  const MOVES: { id: MoveId; icon: string; name: (f: F) => string; how: (f: F) => string; cls: string }[] = [
    { id: 'tackle', icon: 'sword', name: () => 'Tackle', how: () => 'A strong bump', cls: 'blue' },
    { id: 'special', icon: 'thunder', name: (f) => line(f.formId).special.name, how: (f) => `${f.type} move. Strong vs ${STRONG[f.type].join(' and ')}`, cls: 'orange' },
    { id: 'guard', icon: 'shield', name: () => 'Guard', how: () => 'Block most of the next hit', cls: 'grey' },
    { id: 'berry', icon: 'meat', name: () => 'Berry snack', how: (f) => (f.berry ? 'Get health back (once)' : 'Eaten'), cls: 'grey' },
  ];

  return (
    <div className="cmb" role="dialog" aria-label="Creaturemon battle">
      <div className={`cmb-guide${phase === 'fight' || phase === 'done' ? ' mini' : ''}`} role="status">
        <ol className="cmb-steps" aria-label={`Step ${step} of 3`}>
          {['Your creature', 'Opponent', 'Battle'].map((t, i) => <li key={t} className={i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}>{i + 1 < step ? '✓' : i + 1}<span>{t}</span></li>)}
        </ol>
        <p className="cmb-now">{doNow}</p>
        <button type="button" className="btn" onClick={() => speak(doNow, tts)} aria-label="Listen">🔊</button>
        <button type="button" className="btn" onClick={() => setReadOn((x) => !x)}>{readOn ? 'Read aloud: on' : 'Read aloud: off'}</button>
        <button type="button" className="btn" onClick={() => setMusic((x) => { const n = !x; try { localStorage.setItem('cm-music', n ? '1' : '0'); } catch { /* fine */ } return n; })}>{music ? 'Music: on' : 'Music: off'}</button>
        {phase !== 'fight' && <button type="button" className="btn" onClick={() => onClose(won === null || !foePick ? null : { won, foe: foePick })}>{phase === 'done' ? 'Done' : 'Leave'}</button>}
      </div>

      {phase === 'pick' && (() => {
        // 743: a loadout screen like her reference: the team on the left, the picked creature big in the middle, its
        // stats, special move and abilities on the right, and one big Confirm.
        const selM = sel ?? (teamMode ? picks[picks.length - 1] : null) ?? cm.team[0] ?? null;
        const sf = selM ? form(selM.formId) : null; const sst = sf && selM ? statsAt(sf, selM.level) : null; const top = sf ? statsAt(line(sf.id).forms[line(sf.id).forms.length - 1], 50) : null;
        const tap = (m: Mon) => { uiSound('cursor-1'); setSel(m); if (teamMode) setPicks((p) => (p.some((x) => x.uid === m.uid) ? p.filter((x) => x.uid !== m.uid) : p.length < 3 ? [...p, m] : p)); };
        const confirm = () => { if (teamMode) { if (!picks.length) return; const lv = Math.max(...picks.map((p) => p.level)); beginTeam(picks, Array.from({ length: Math.max(2, picks.length) }, () => foeAt(lv))); } else if (selM) pickMine(selM); };
        return (
          <div className="lo">
            <div className="lo-left">
              {!wildFoe && cm.team.length > 1 && (
                <div className="lo-modes" role="radiogroup" aria-label="Battle kind">
                  <button type="button" role="radio" aria-checked={!teamMode} className={!teamMode ? 'on' : ''} onClick={() => { setTeamMode(false); setPicks([]); }}>One creature</button>
                  <button type="button" role="radio" aria-checked={teamMode} className={teamMode ? 'on' : ''} onClick={() => { setTeamMode(true); setPicks([]); }}>Team (up to 3)</button>
                </div>
              )}
              <h3 className="lo-title">{teamMode ? 'Pick your team' : 'Pick your fighter'}</h3>
              {!cm.team.length && <p className="cmb-empty">Catch a creature first! Tap Explore in the menu.</p>}
              <div className="lo-grid">
                {cm.team.map((m) => {
                  const n = picks.findIndex((p) => p.uid === m.uid);
                  return (
                    <button key={m.uid} type="button" className={`lo-tile${selM?.uid === m.uid ? ' sel' : ''}${n >= 0 ? ' picked' : ''}`} style={{ ['--tc' as string]: TYPE_COLOR[line(m.formId).type] }} onClick={() => tap(m)} aria-pressed={selM?.uid === m.uid}>
                      <Sprite f={form(m.formId)} px={56} fitW={80} />
                      <b>{displayName(m)}</b><small>Lv {m.level}</small>
                      {teamMode && n >= 0 && <span className="lo-num">{n + 1}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="lo-hero">
              {sf && selM && (<><span className="lo-glow" style={{ background: `radial-gradient(circle, ${TYPE_COLOR[line(sf.id).type]}aa, transparent 65%)` }} /><Sprite f={sf} px={200} fitW={260} anim="move" /><span className="lo-ground" /><p className="lo-type"><span className="cm-line-type" style={{ ['--tc' as string]: TYPE_COLOR[line(sf.id).type] }}>{line(sf.id).type}</span> Stage {sf.stage} of {line(sf.id).forms.length}</p></>)}
            </div>
            <div className="lo-right">
              {sf && selM && sst && top && (
                <>
                  <h2 className="lo-name">{displayName(selM)}</h2>
                  {([['Health', 'sym_heart', sst.hp, top.hp, '#4caf50'], ['Attack', 'sym_sword', sst.atk, top.atk, '#e0482a'], ['Defense', 'sym_shield', sst.def, top.def, '#2f8fe0'], ['Speed', 'sym_energy', sst.spd, top.spd, '#ffd23f']] as [string, string, number, number, string][]).map(([lab, ic, v, mx, c]) => (
                    <div key={lab} className="lo-stat"><img src={`${IMG}cards/${ic}.png`} alt="" /><span className="lo-bar"><i style={{ width: `${Math.min(100, (v / mx) * 100)}%`, background: c }} /></span><b>{v}</b><small>{lab}</small></div>
                  ))}
                  <div className="lo-skill"><img src={`${UI}i_thunder.png`} alt="" /><span><small>Special move</small><b>{line(sf.id).special.name}</b><em>Strong vs {STRONG[line(sf.id).type].join(' and ')}</em></span></div>
                  <div className="lo-abs">{(selM.abilities ?? []).length ? (selM.abilities ?? []).map((a) => <span key={a} className="cm-ab">{abName(a, sf.stage)}</span>) : <small>No abilities yet</small>}</div>
                  <span className="lo-xp"><small>XP to Lv {selM.level + 1}</small><XpBar m={selM} /></span>
                  <button type="button" className="lo-go" disabled={teamMode ? !picks.length : false} onClick={confirm}>{teamMode ? `Confirm team (${picks.length})` : 'Confirm'}</button>
                </>
              )}
            </div>
          </div>
        );
      })()}
      {phase === 'foe' && (
        <div className="cmb-foes">
          {cards.map((c, i) => (
            <div key={i} className="cmb-foecard">
              <CreatureCard f={form(c.formId)} level={c.level} scale={0.95} />
              <b>Lv {c.level}</b>
              <button type="button" className="cm-big fight" onClick={() => pickFoe(c)}>Battle</button>
            </div>
          ))}
          <button type="button" className="btn btn-lg" onClick={() => { const lv = mine?.level ?? 5; setCards([foeAt(lv), foeAt(lv)]); sfx.pop(); }}>New opponents</button>
        </div>
      )}
      {(phase === 'fight' || phase === 'done') && me && foe && (
        <div className="cmb-arena" ref={arenaRef}>
          <IslandStage calm={cm.calm} falling={falling}>{side(foe, 'foe')}{side(me, 'me')}</IslandStage>
          <FightHud round={round} left={{ name: me.name, level: me.level, type: me.type, hp: me.hp, max: me.max, guard: me.guard, abs: me.abs, stage: stg(me), formId: me.formId, sub: myQ.current.length ? `${myQ.current.length} more` : undefined }}
            right={{ name: foe.name, level: foe.level, type: foe.type, hp: foe.hp, max: foe.max, guard: foe.guard, abs: foe.abs, stage: stg(foe), formId: foe.formId, sub: foeQ.current.length ? `${foeQ.current.length} more` : undefined }} />
          {mine && <span className="fh-xp"><img src={`${UI}i_star.png`} alt="" /><small>XP</small><XpBar m={cm.sRef.current.mons.find((m) => m.uid === mine.uid) ?? mine} /></span>}
          {shot && <span className="cmb-shot" style={{ left: shot.x - 23, top: shot.y - 23, background: TYPE_COLOR[shot.type], boxShadow: `0 0 24px ${TYPE_COLOR[shot.type]}`, ['--dx' as string]: `${shot.dx}px`, ['--dy' as string]: `${shot.dy}px` } as React.CSSProperties} />}
          <div className="cmb-log" aria-live="polite">{lines.map((l, i) => <p key={i}>{l}</p>)}</div>
          {phase === 'fight' && (
            <>
              {/* 743: round action buttons in the bottom corners, like her mobile fighter: Guard and Berry on the left,
                  the special move and a big Tackle on the right */}
              <div className="fb fb-left">
                {MOVES.filter((mv) => mv.id === 'guard' || mv.id === 'berry').map((mv) => (
                  <button key={mv.id} type="button" className={`fb-btn ${mv.id}`} disabled={stage !== 'choose' || (mv.id === 'berry' && !me.berry)} onClick={() => act(mv.id)} title={mv.how(me)} aria-label={`${mv.name(me)}: ${mv.how(me)}`}
                    style={{ ['--cd' as string]: `${cdPct(mv.id)}%` } as React.CSSProperties} data-cooling={cdPct(mv.id) > 0 || undefined}>
                    <img src={`${UI}i_${mv.icon}.png`} alt="" /><small>{mv.name(me)}</small>
                  </button>
                ))}
              </div>
              <div className="fb fb-right">
                {MOVES.filter((mv) => mv.id === 'special' || mv.id === 'tackle').map((mv) => (
                  <button key={mv.id} type="button" className={`fb-btn ${mv.id}`} disabled={stage !== 'choose'} onClick={() => act(mv.id)} title={mv.how(me)} aria-label={`${mv.name(me)}: ${mv.how(me)}`}
                    style={{ ['--cd' as string]: `${cdPct(mv.id)}%`, ...(mv.id === 'special' ? { background: `radial-gradient(circle at 35% 30%, #fff8, ${TYPE_COLOR[me.type]} 55%, #1d2238)` } : {}) } as React.CSSProperties} data-cooling={cdPct(mv.id) > 0 || undefined}>
                    <img src={`${UI}i_${mv.icon}.png`} alt="" /><small>{mv.name(me)}</small>
                    {mv.id === 'special' && learn && <span className="fb-charge" aria-label={`${charges} charges`}>{charges ? `x${charges}` : 'Q'}</span>}
                  </button>
                ))}
              </div>
            </>
          )}
          {phase === 'done' && (
            <div className="cmb-done">
              <div className="cmb-banner" style={{ backgroundImage: `url(${UI}${won ? 'wing_blue' : 'wing_silver'}.png)` }}><h2>{won ? 'You won!' : 'Good try!'}</h2></div>
              <p>{me.name} got <b>{xp} XP</b>{won ? <> and you found <b>2 orbs</b></> : null}.</p>
              <div className="cm-row">
                {won && wildFoe ? <button type="button" className="cm-big orb" onClick={() => onClose({ won: true, foe: foePick! })}>Throw orb</button>
                  : <button type="button" className="cm-big fight" onClick={again}>Battle again</button>}
                <button type="button" className="btn btn-lg" onClick={() => onClose(wildFoe ? { won: false, foe: foePick! } : { won: !!won, foe: foePick! })}>{won && wildFoe ? 'Let it go' : 'Done'}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
