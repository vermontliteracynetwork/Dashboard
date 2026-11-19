// Creaturemon cards (Build Queue 702, her words: "make sure every evolution has its own card"). One card per form, on
// her NPC Quest TCG card frames: blue for a first stage, red for a second, purple for a third or fourth. The creature
// stands in the card's window on its type color, its name on the ribbon, its facts on the parchment. Cards not caught
// yet show as a dark shape (seen) or the card back (not seen yet).
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { IMG, TYPE_COLOR, formImg, line, nextForm, statsAt, type Form } from './data';

// A creature drawn in pixels, its idle (or move) strip played frame by frame.
export function Sprite({ f, px, anim = 'idle', className, style }: { f: Form; px: number; anim?: 'idle' | 'move' | 'hurt'; className?: string; style?: CSSProperties }) {
  const s = f.sprite; const n = Math.max(1, (anim === 'idle' ? s.idle : anim === 'move' ? s.move : s.hurt) ?? 1);
  const a = n > 1 ? anim : 'idle'; const nn = a === anim ? n : s.idle;
  const [fr, setFr] = useState(0);
  useEffect(() => { if (nn <= 1) return; const t = window.setInterval(() => setFr((x) => (x + 1) % nn), 130); return () => window.clearInterval(t); }, [nn]);
  // scale so the creature's own pixels are about px tall, in whole pixel steps
  const k = Math.max(1, Math.floor(px / Math.max(8, s.fh)));
  return (
    <span className={`cm-sprite ${className ?? ''}`} aria-hidden style={{
      width: s.w * k, height: s.h * k, backgroundImage: `url(${formImg(f.id, a)})`,
      backgroundSize: `${s.w * k * nn}px ${s.h * k}px`, backgroundPosition: `${-fr * s.w * k}px 0`, ...style,
    }} />
  );
}

export function CreatureCard({ f, state = 'caught', scale = 1, onClick, level }: { f: Form; state?: 'caught' | 'seen' | 'unknown'; scale?: number; onClick?: () => void; level?: number }) {
  const l = line(f.id); const frame = f.stage === 1 ? 1 : f.stage === 2 ? 2 : 3;
  const st = statsAt(f, level ?? 1); const nx = nextForm(f.id);
  const ref = useRef<HTMLButtonElement>(null);
  const body = state === 'unknown'
    ? <img className="cm-card-art" src={`${IMG}cards/back${frame}.png`} alt="" draggable={false} />
    : (
      <>
        <span className="cm-card-window" style={{ background: `radial-gradient(circle at 50% 60%, ${TYPE_COLOR[l.type]}cc, ${TYPE_COLOR[l.type]}55 55%, #1d2238 100%)` }}>
          <Sprite f={f} px={Math.min(104, 40 + f.stage * 22)} className={state === 'seen' ? 'cm-shadow' : ''} />
        </span>
        <img className="cm-card-art" src={`${IMG}cards/frame${frame}.png`} alt="" draggable={false} />
        <span className="cm-card-name">{state === 'seen' ? '? ? ?' : f.name}</span>
        <span className="cm-card-info">
          <span className="cm-card-type" style={{ background: TYPE_COLOR[l.type] }}>{l.type}</span>
          <span className="cm-card-stage">Stage {f.stage} of {l.forms.length}</span>
          {state === 'caught' ? (
            <>
              <span className="cm-card-stats"><img src={`${IMG}cards/sym_heart.png`} alt="Health" />{st.hp} <img src={`${IMG}cards/sym_sword.png`} alt="Attack" />{st.atk} <img src={`${IMG}cards/sym_shield.png`} alt="Defense" />{st.def} <img src={`${IMG}cards/sym_energy.png`} alt="Speed" />{st.spd}</span>
              <span className="cm-card-move">{l.special.name}</span>
              <span className="cm-card-evo">{nx ? `Evolves at Lv ${f.evolvesAt}` : 'Final form'}</span>
            </>
          ) : <span className="cm-card-evo">Catch one to fill this card</span>}
        </span>
      </>
    );
  return (
    <button ref={ref} type="button" className={`cm-card${state !== 'caught' ? ' locked' : ''}`} onClick={onClick} style={{ '--k': scale } as CSSProperties}
      aria-label={state === 'caught' ? `${f.name} card, ${l.type} type, stage ${f.stage}` : state === 'seen' ? 'A card you have seen but not caught' : 'A card not found yet'}>
      <span className="cm-card-in">{body}</span>
    </button>
  );
}
