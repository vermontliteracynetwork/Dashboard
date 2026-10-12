import { useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import type { MCQuestion } from '../../types';
import { useGameQuestions } from '../../games/mini/useAsk';
import { useRoundSettings } from '../../lib/gameRounds';
import RoundSettings from '../../components/RoundSettings';
import { payForAnswers } from '../../lib/gameEarnings';
import { recordStreakCorrect } from '../../lib/streak';
import { speak } from '../../components/ReadAloud';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest } from '../../components/MyBest';
import { recordBestGame } from '../../lib/personalBoard';

// Memory Match (her student-favorite genres list, 2026-09-30: "library or curio shop; questions pair
// with answers"). Twelve face-down cards: six question cards (blue) and six answer cards (green).
// Flip two; a question and its right answer stay face up as a match. Question cards say "Question"
// and answer cards say "Answer" on the front, so a student always knows which kind they flipped.
// $1 per matched pair (each match is a right answer).

interface Card { id: number; kind: 'q' | 'a'; text: string; img?: string; key: string; matched: boolean }
// Her rule (2026-10-08): kids choose how many questions a board holds; an assignment locks it.
const PAIR_RANGE = { per: { min: 3, max: 8, def: 6 } };
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

export default function MemoryMatch() {
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const { next, right: countRight, notice, assignment } = useGameQuestions('memoryMatch');
  const rs = useRoundSettings('memoryMatch', PAIR_RANGE, assignment?.task);
  const PAIRS = rs.perRound;
  const [gear, setGear] = useState(false);
  const pairQ = useRef<Record<string, MCQuestion>>({});
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const deal = (): Card[] => {
    // Six questions with different prompts and different right answers, so every match is clear.
    const qs: MCQuestion[] = [];
    for (let tries = 0; qs.length < PAIRS && tries < 60; tries++) {
      const q = next();
      const ans = q.choices[q.correctIndex];
      if (!ans || qs.some((x) => x.prompt === q.prompt || x.choices[x.correctIndex] === ans)) continue;
      qs.push(q);
    }
    let id = 0;
    pairQ.current = Object.fromEntries(qs.map((q, i) => [`p${i}`, q]));
    return shuffle(qs.flatMap((q, i) => [
      { id: id++, kind: 'q' as const, text: q.prompt, img: q.imageUrl, key: `p${i}`, matched: false },
      { id: id++, kind: 'a' as const, text: q.choices[q.correctIndex], key: `p${i}`, matched: false },
    ]));
  };
  const [cards, setCards] = useState<Card[]>(deal);
  const [up, setUp] = useState<number[]>([]);
  const [flips, setFlips] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [won, setWon] = useState(false);
  const unpaid = useRef(0);
  const busy = useRef(false);
  if (!student) return null;
  const owner = `memory:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { best?: number; boards?: number } | undefined) ?? {};
  const pay = () => { if (unpaid.current > 0) payForAnswers(student.id, unpaid.current, 'Memory Match', '🃏'); unpaid.current = 0; };

  const flip = (c: Card) => {
    if (busy.current || c.matched || up.includes(c.id)) return;
    const now = [...up, c.id];
    setUp(now); setFlips((f) => f + 1); sfx.pop();
    if (now.length < 2) { setNote(c.kind === 'q' ? 'Now find the answer card for this question.' : 'Now find the question this answers.'); return; }
    const [a, b] = now.map((id) => cards.find((x) => x.id === id)!);
    if (a.kind !== b.kind && a.key === b.key) {
      unpaid.current += 1; recordStreakCorrect(student.id);
      if (pairQ.current[a.key]) countRight(pairQ.current[a.key]);
      const next = cards.map((x) => (x.key === a.key ? { ...x, matched: true } : x));
      setCards(next); setUp([]);
      sfx.chime(); setNote('✨ A match! The answer goes with the question.');
      if (next.every((x) => x.matched)) {
        const f = flips + 1;
        mergeStyleRow(owner, { best: saved.best ? Math.min(saved.best, f) : f, boards: (saved.boards ?? 0) + 1 });
        recordBestGame(student.id, 'memoryMatch', -f, `${cards.length / 2} pairs`);
        pay(); playCheer();
        window.setTimeout(() => setWon(true), 700);
      }
    } else {
      busy.current = true;
      setNote(a.kind === b.kind ? `Those are both ${a.kind === 'q' ? 'questions' : 'answers'}. A match is one question and one answer.` : 'Not a match. Remember where they are!');
      window.setTimeout(() => { setUp([]); busy.current = false; }, 1500);
    }
  };
  const readUp = () => {
    const shown = up.map((id) => cards.find((x) => x.id === id)!).map((c) => `${c.kind === 'q' ? 'Question' : 'Answer'}: ${c.text}`);
    if (shown.length) speak(shown.join('. '), student.ttsSettings);
  };
  const again = () => { setWon(false); setCards(deal()); setUp([]); setFlips(0); setNote(null); };
  const matched = cards.filter((c) => c.matched).length / 2;
  const pairs = cards.length / 2; // fewer than 6 when her starred sets have fewer than 6 different questions

  return (
    <div className="mm">
      <header className="fd-head mm-head">
        <LeaveButton onLeave={() => { pay(); back.go(); }} note="This board stops here. Your matches so far are paid." />
        <h1>🃏 Memory Match</h1>
        <SfxToggle />
        <button type="button" className="btn game-settings-btn" onClick={() => setGear(true)} aria-label="Game settings">⚙️</button>
        <MyBest game="memoryMatch" format={(e) => `${-e.score} flips${e.detail ? ` (${e.detail})` : ''}`} />
        <span className="mc-hud">✨ {matched} / {pairs} · 🔄 {flips}</span>
      </header>
      <div className="mm-main">
        <div className="mm-top">
          <p className="fd-msg mm-msg" aria-live="polite">{note ?? 'Flip two cards. Match each blue question card with its green answer card.'}</p>
          <button type="button" className="btn mm-listen" onClick={readUp} disabled={!up.length}>🔊 Read the cards</button>
        </div>
        <div className="mm-grid">
          {cards.map((c) => {
            const open = c.matched || up.includes(c.id);
            return (
              <button key={c.id} type="button" className={`mm-card${open ? ' open' : ''}${c.matched ? ' matched' : ''} ${c.kind}`} onClick={() => flip(c)} aria-label={open ? `${c.kind === 'q' ? 'Question' : 'Answer'}: ${c.text}` : 'Face down card'}>
                <span className="mm-inner">
                  <span className="mm-back" aria-hidden>✦</span>
                  <span className="mm-front">
                    <small>{c.kind === 'q' ? '❓ Question' : '✅ Answer'}</small>
                    {c.img && <img src={c.img} alt="" />}
                    <b>{c.text}</b>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {won && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <div className="fd-fish" aria-hidden>🏆</div>
            <h2>You matched them all!</h2>
            <p>All {pairs} questions found their answers in {flips} flips. {saved.best && saved.best <= flips ? `Your best is ${saved.best} flips.` : 'That is your best board yet!'}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={again}>🃏 New cards</button>
          </div>
        </div>
      )}
      {gear && (
        <div className="pf-overlay" onClick={() => setGear(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>⚙️ Game settings</h2>
            <RoundSettings ranges={PAIR_RANGE} rounds={0} perRound={rs.perRound} onRounds={() => {}} onPerRound={rs.setPerRound} locked={rs.locked} perLabel="Questions on each board" />
            <p>The new number starts with your next board.</p>
            <div className="pf-detail-actions"><button type="button" className="btn btn-lg" onClick={() => setGear(false)}>Done</button><button type="button" className="btn btn-primary btn-lg" onClick={() => { setGear(false); again(); }}>🃏 New board now</button></div>
          </div>
        </div>
      )}
      {notice}
    </div>
  );
}
