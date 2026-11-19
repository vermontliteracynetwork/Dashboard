// Creaturemon cards (Build Queue 712: "make sure every evolution has its own card"; redesigned in 741: "Formatting for
// cards, text, etc. need to be MASSIVELY improved"). One card per form, on her NPC Quest TCG card frames: blue for a
// first stage, red for a second, purple for a third or fourth. The creature stands big in the window on its type
// color with a shadow under its feet, a type badge and stage stars in the corners, its name on the ribbon, and the
// parchment shows the few facts that fit cleanly (type, stats as a 2 by 2 grid, the special move). Small cards (the
// card book) show only the picture, name, type and stage; tap one for the full card and its story. Cards not caught
// yet show as a dark shape (seen) or the card back (not seen yet).
import { useEffect, useState, type CSSProperties } from 'react';
import { IMG, TYPE_COLOR, formImg, line, nextForm, statsAt, type Form } from './data';

// A creature drawn in pixels, its idle (or move) strip played frame by frame. `px` is about how tall the creature
// itself is drawn; `fitW` keeps it inside a width. Always whole pixel steps, so it stays crisp.
export function Sprite({ f, px, fitW, anim = 'idle', className, style }: { f: Form; px: number; fitW?: number; anim?: 'idle' | 'move' | 'hurt'; className?: string; style?: CSSProperties }) {
  const s = f.sprite; const n = Math.max(1, (anim === 'idle' ? s.idle : anim === 'move' ? s.move : s.hurt) ?? 1);
  const a = n > 1 ? anim : 'idle'; const nn = a === anim ? n : s.idle;
  const [fr, setFr] = useState(0);
  useEffect(() => { if (nn <= 1) return; const t = window.setInterval(() => setFr((x) => (x + 1) % nn), 130); return () => window.clearInterval(t); }, [nn]);
  const k = Math.max(1, Math.floor(Math.min(px / Math.max(8, s.fh), fitW ? fitW / Math.max(8, s.fw) : 99)));
  return (
    <span className={`cm-sprite ${className ?? ''}`} aria-hidden style={{
      width: s.w * k, height: s.h * k, backgroundImage: `url(${formImg(f.id, a)})`,
      backgroundSize: `${s.w * k * nn}px ${s.h * k}px`, backgroundPosition: `${-fr * s.w * k}px 0`, ...style,
    }} />
  );
}

const TYPE_MARK: Record<string, string> = { Fire: 'F', Water: 'W', Leaf: 'L', Frost: 'Fr', Shadow: 'Sh', Stone: 'St', Light: 'Li', Spark: 'Sp', Sky: 'Sk' };

export function CreatureCard({ f, state = 'caught', scale = 1, onClick, level, compact }: { f: Form; state?: 'caught' | 'seen' | 'unknown' | 'mystery'; scale?: number; onClick?: () => void; level?: number; compact?: boolean }) {
  const l = line(f.id); const frame = f.stage === 1 ? 1 : f.stage === 2 ? 2 : 3;
  const st = statsAt(f, level ?? 1); const nx = nextForm(f.id); const col = TYPE_COLOR[l.type];
  const small = compact ?? scale < 0.8;
  // Build Queue 750: a card not earned yet shows only the creature's name and a gray question mark, no details.
  const body = state === 'mystery' ? (
      <>
        <span className="cm-card-window mystery"><span className="cm-card-q">?</span></span>
        <img className="cm-card-art" src={`${IMG}cards/frame${frame}.png`} alt="" draggable={false} />
        <span className="cm-card-name">{f.name}</span>
        <span className="cm-card-info small"><span className="cm-card-stage">Not earned yet</span></span>
      </>
    )
    : state === 'unknown'
    ? <img className="cm-card-art" src={`${IMG}cards/back${frame}.png`} alt="" draggable={false} />
    : (
      <>
        <span className="cm-card-window" style={{ background: `radial-gradient(ellipse at 50% 80%, #ffffff99 0 12%, ${col} 42%, ${col}99 64%, #141830 100%)` }}>
          <span className="cm-card-shadow" />
          <Sprite f={f} px={92} fitW={132} className={state === 'seen' ? 'cm-shadow' : ''} />
        </span>
        <img className="cm-card-art" src={`${IMG}cards/frame${frame}.png`} alt="" draggable={false} />
        <span className="cm-card-badge" style={{ background: col }} title={l.type}>{TYPE_MARK[l.type]}</span>
        <span className="cm-card-pips" aria-label={`Stage ${f.stage} of ${l.forms.length}`}>{l.forms.map((_, i) => <i key={i} className={i < f.stage ? 'on' : ''} />)}</span>
        <span className="cm-card-name">{state === 'seen' ? '? ? ?' : f.name}</span>
        <span className={`cm-card-info${small ? ' small' : ''}`}>
          <span className="cm-card-row"><span className="cm-card-type" style={{ background: col }}>{l.type}</span><span className="cm-card-stage">{small ? `Stage ${f.stage}/${l.forms.length}` : `Stage ${f.stage} of ${l.forms.length}`}</span></span>
          {state === 'caught' && !small && (
            <>
              <span className="cm-card-stats">
                <span><img src={`${IMG}cards/sym_heart.png`} alt="" />HP <b>{st.hp}</b></span>
                <span><img src={`${IMG}cards/sym_sword.png`} alt="" />ATK <b>{st.atk}</b></span>
                <span><img src={`${IMG}cards/sym_shield.png`} alt="" />DEF <b>{st.def}</b></span>
                <span><img src={`${IMG}cards/sym_energy.png`} alt="" />SPD <b>{st.spd}</b></span>
              </span>
              <span className="cm-card-move">{l.special.name}</span>
              <span className="cm-card-evo">{nx ? `Evolves at Lv ${f.evolvesAt}` : 'Final form'}</span>
            </>
          )}
          {state !== 'caught' && !small && <span className="cm-card-evo">Catch one to fill this card</span>}
        </span>
      </>
    );
  return (
    <button type="button" className={`cm-card${state !== 'caught' ? ' locked' : ''}`} onClick={onClick} style={{ '--k': scale } as CSSProperties}
      aria-label={state === 'caught' ? `${f.name} card, ${l.type} type, stage ${f.stage}` : state === 'mystery' ? `${f.name}, not earned yet` : state === 'seen' ? 'A card you have seen but not caught' : 'A card not found yet'}>
      <span className="cm-card-in">{body}</span>
    </button>
  );
}
