import type { Pos } from '../engine/types';
import { SYMBOLS } from '../data/symbols';
import { adjByWord } from '../data/wordbank';
import { hashString } from '../engine/rng';

// Cartoon Industrial machine parts (plan sections 4.2 and 8). Each part of
// speech is its own little factory piece, built from the teacher's symbol
// silhouette and inflated into a bubbly, riveted, slightly worn machine:
//   noun     Noun Boiler      red triangle tank with a porthole
//   article  Pop Valve / Spotlight Lamp (a / the), small pink triangle
//   adjective Dab Sprayer     blue triangle paint tank with a pump or dial
//   pronoun  Swap Valve       yellow upside-down triangle with a Y pipe
//   verb     Verb Engine      green round engine, flywheel and piston
//   adverb   Pressure Gauge   dark blue dial with a swinging needle
//   preposition Arch Pipe     brown copper arch with flanges
//   conjunction Union Coupling purple double-arrow clamp
//   interjection Steam Whistle orange drop-shaped whistle
// Every word gets one of three looks (variant), so no two machines look
// quite the same, but the shape and color always match the symbol.

const INK = '#1f2f4d';
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`;
}

const COLOR_WORDS: Record<string, string> = { red: '#e8483b', blue: '#3b7be8', green: '#3fbf5a', yellow: '#f7d23e', white: '#ffffff', black: '#2a2a30', pink: '#f39bc0', purple: '#9b5de5', orange: '#f08a2c', brown: '#8a5a2b', gray: '#8b8f99' };

export const variantFor = (word: string | null) => (word ? hashString(word) % 3 : 0);

function Rivets({ pts, fill }: { pts: [number, number][]; fill: string }) {
  return <>{pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.4} fill={fill} stroke={INK} strokeWidth={1.6} />)}</>;
}

export default function PartSvg({ pos, word, ghost = false, className = '' }: { pos: Pos; word: string | null; ghost?: boolean; className?: string }) {
  const base = SYMBOLS[pos].color;
  const dark = shade(base, -0.28);
  const light = shade(base, 0.45);
  const v = variantFor(word);
  const gid = `gp-${pos}-${v}-${ghost ? 'g' : 'f'}`;
  const fill = ghost ? 'rgba(255,255,255,0.35)' : `url(#${gid})`;
  const stroke = ghost ? 'rgba(31,47,77,0.55)' : INK;
  const dash = ghost ? '7 6' : undefined;
  const body = { fill, stroke, strokeWidth: 4.5, strokeLinejoin: 'round' as const, strokeDasharray: dash };
  const hi = ghost ? null : <ellipse cx={36} cy={30} rx={12} ry={6} fill="#fff" opacity={0.28} transform="rotate(-25 36 30)" />;
  const scuffs = ghost ? null : <g stroke={INK} strokeWidth={1.2} opacity={0.14}><line x1={62} y1={70} x2={70} y2={68} /><line x1={30} y1={74} x2={35} y2={77} /></g>;
  let shape: React.ReactNode = null;
  let detail: React.ReactNode = null;

  switch (pos) {
    case 'N': {
      shape = <path d="M50 8 Q55 8 58 14 L92 78 Q96 88 85 88 L15 88 Q4 88 8 78 L42 14 Q45 8 50 8Z" {...body} />;
      if (!ghost) detail = <>
        <circle cx={50} cy={60} r={14} fill="#bfe3f2" stroke={INK} strokeWidth={4} />
        <path d="M43 54 Q47 50 52 51" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" />
        {v === 1 && <rect x={62} y={22} width={10} height={14} rx={2} fill="#c98a4b" stroke={INK} strokeWidth={3} />}
        {v === 2 && <><circle cx={28} cy={74} r={6} fill="#fff" stroke={INK} strokeWidth={2.5} /><line x1={28} y1={74} x2={31} y2={70} stroke="#e8483b" strokeWidth={2} /></>}
        <Rivets pts={v === 0 ? [[20, 80], [80, 80], [50, 22]] : [[20, 80], [80, 80]]} fill={light} />
      </>;
      break;
    }
    case 'A': {
      shape = <path d="M50 26 Q54 26 56 31 L80 80 Q83 88 74 88 L26 88 Q17 88 20 80 L44 31 Q46 26 50 26Z" {...body} />;
      if (!ghost) detail = word === 'the'
        ? <><circle cx={50} cy={20} r={11} fill="#ffe680" stroke={INK} strokeWidth={3.5} /><g stroke="#e6b54a" strokeWidth={3} strokeLinecap="round"><line x1={50} y1={3} x2={50} y2={0} /><line x1={35} y1={9} x2={32} y2={6} /><line x1={65} y1={9} x2={68} y2={6} /></g><rect x={44} y={29} width={12} height={6} fill="#8b8f99" stroke={INK} strokeWidth={2.5} /></>
        : <><rect x={42} y={14} width={16} height={14} rx={3} fill={dark} stroke={INK} strokeWidth={3} /><circle cx={50} cy={12} r={5} fill="#ff5a4e" stroke={INK} strokeWidth={2.5} /></>;
      if (!ghost) detail = <>{detail}<Rivets pts={[[32, 80], [68, 80]]} fill={light} /></>;
      break;
    }
    case 'J': {
      shape = <path d="M48 16 Q52 16 55 21 L84 80 Q88 88 79 88 L19 88 Q10 88 14 80 L42 21 Q45 16 48 16Z" {...body} />;
      const kind = adjByWord.get(word ?? '')?.kind;
      const paint = COLOR_WORDS[word ?? ''] ?? (kind === 'size' ? '#ffffff' : '#ffe14d');
      if (!ghost) detail = <>
        {kind === 'feeling'
          ? <><circle cx={48} cy={60} r={12} fill="#fff" stroke={INK} strokeWidth={3} /><path d="M41 62 Q48 69 55 62" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" /></>
          : <><rect x={38} y={52} width={20} height={22} rx={4} fill={paint} stroke={INK} strokeWidth={3} /><line x1={41} y1={58} x2={55} y2={58} stroke={INK} strokeWidth={1.5} opacity={0.4} /></>}
        <g className="gp-pump"><line x1={48} y1={16} x2={48} y2={4} stroke={INK} strokeWidth={4} /><rect x={36} y={0} width={24} height={7} rx={3} fill="#4a5865" stroke={INK} strokeWidth={2.5} /></g>
        <rect x={80} y={58} width={14} height={9} rx={2} fill="#8b8f99" stroke={INK} strokeWidth={3} />
        {kind === 'color' && <circle cx={97} cy={63} r={3.5} fill={paint} stroke={INK} strokeWidth={1.5} />}
        <Rivets pts={v === 2 ? [[24, 80], [72, 80], [48, 30]] : [[24, 80], [72, 80]]} fill={light} />
      </>;
      break;
    }
    case 'R': {
      shape = <path d="M14 14 L86 14 Q96 14 91 23 L57 84 Q50 94 43 84 L9 23 Q4 14 14 14Z" {...body} />;
      if (!ghost) detail = <>
        <path d="M50 64 L50 48 M50 48 L38 32 M50 48 L62 32" stroke="#c98a4b" strokeWidth={7} strokeLinecap="round" fill="none" />
        <path d="M50 64 L50 48 M50 48 L38 32 M50 48 L62 32" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.5} />
        <g className="gp-flip"><rect x={44} y={42} width={12} height={12} rx={3} fill="#ff5a4e" stroke={INK} strokeWidth={2.5} /></g>
        <Rivets pts={[[22, 22], [78, 22]]} fill={light} />
      </>;
      break;
    }
    case 'V': {
      shape = <circle cx={50} cy={54} r={36} {...body} />;
      if (!ghost) detail = <>
        <rect x={42} y={4} width={16} height={18} rx={3} fill="#8b8f99" stroke={INK} strokeWidth={3} className="gp-piston" />
        {v !== 2 && <rect x={70} y={10} width={9} height={14} rx={2} fill="#c98a4b" stroke={INK} strokeWidth={2.5} />}
        <g className="gp-fly" style={{ transformOrigin: '50px 56px' }}>
          <circle cx={50} cy={56} r={18} fill={dark} stroke={INK} strokeWidth={3.5} />
          {Array.from({ length: v === 1 ? 3 : 4 }, (_, i) => <line key={i} x1={50} y1={56} x2={50 + 15 * Math.cos((i * 2 * Math.PI) / (v === 1 ? 3 : 4))} y2={56 + 15 * Math.sin((i * 2 * Math.PI) / (v === 1 ? 3 : 4))} stroke={light} strokeWidth={3.5} strokeLinecap="round" />)}
          <circle cx={50} cy={56} r={5} fill="#e6b54a" stroke={INK} strokeWidth={2.5} />
        </g>
        {v === 2 && <g fill="#f08a2c" stroke={INK} strokeWidth={2}><rect x={18} y={44} width={6} height={22} rx={3} /><rect x={76} y={44} width={6} height={22} rx={3} /></g>}
        <Rivets pts={[[24, 32], [76, 32], [24, 78], [76, 78]]} fill={light} />
      </>;
      break;
    }
    case 'D': {
      shape = <circle cx={50} cy={56} r={32} {...body} />;
      if (!ghost) detail = <>
        <circle cx={50} cy={56} r={22} fill="#fff" stroke={INK} strokeWidth={3} />
        {[-60, -30, 0, 30, 60].map((a) => <line key={a} x1={50 + 17 * Math.sin((a * Math.PI) / 180)} y1={56 - 17 * Math.cos((a * Math.PI) / 180)} x2={50 + 21 * Math.sin((a * Math.PI) / 180)} y2={56 - 21 * Math.cos((a * Math.PI) / 180)} stroke={INK} strokeWidth={2} />)}
        <path d="M34 66 A18 18 0 0 1 40 44" stroke="#3fbf5a" strokeWidth={3} fill="none" />
        <path d="M60 44 A18 18 0 0 1 66 66" stroke="#e8483b" strokeWidth={3} fill="none" />
        <g className="gp-needle" style={{ transformOrigin: '50px 56px', transform: `rotate(${v === 0 ? -35 : v === 1 ? 10 : 40}deg)` }}><line x1={50} y1={56} x2={50} y2={38} stroke="#e8483b" strokeWidth={3.5} strokeLinecap="round" /></g>
        <circle cx={50} cy={56} r={4} fill={INK} />
        <rect x={80} y={50} width={12} height={12} rx={6} fill="#e6b54a" stroke={INK} strokeWidth={2.5} />
      </>;
      break;
    }
    case 'P': {
      shape = <path d="M10 88 L10 60 Q10 18 50 18 Q90 18 90 60 L90 88 L70 88 L70 62 Q70 40 50 40 Q30 40 30 62 L30 88 Z" {...body} />;
      if (!ghost) detail = <>
        <rect x={5} y={80} width={30} height={10} rx={3} fill="#e6b54a" stroke={INK} strokeWidth={3} />
        <rect x={65} y={80} width={30} height={10} rx={3} fill="#e6b54a" stroke={INK} strokeWidth={3} />
        {v !== 1 && <circle cx={50} cy={26} r={5} fill="#bfe3f2" stroke={INK} strokeWidth={2.5} />}
        <Rivets pts={[[20, 50], [80, 50]]} fill={light} />
      </>;
      break;
    }
    case 'C': {
      shape = <path d="M4 54 L24 30 L24 42 L76 42 L76 30 L96 54 L76 78 L76 66 L24 66 L24 78 Z" {...body} />;
      if (!ghost) detail = <>
        <rect x={40} y={36} width={20} height={36} rx={5} fill="#8b8f99" stroke={INK} strokeWidth={3} className="gp-clamp" />
        <circle cx={50} cy={44} r={3} fill="#e6b54a" stroke={INK} strokeWidth={1.5} /><circle cx={50} cy={64} r={3} fill="#e6b54a" stroke={INK} strokeWidth={1.5} />
      </>;
      break;
    }
    case 'I': {
      shape = <path d="M50 10 Q78 46 78 64 A28 28 0 0 1 22 64 Q22 46 50 10Z" {...body} />;
      if (!ghost) detail = <>
        <rect x={44} y={84} width={12} height={10} fill="#c98a4b" stroke={INK} strokeWidth={3} />
        <rect x={38} y={56} width={24} height={6} rx={3} fill={INK} opacity={0.6} />
        <g className="gp-steam" fill="#fff" stroke={INK} strokeWidth={1.5}><circle cx={68} cy={14} r={5} /><circle cx={78} cy={8} r={3.5} /></g>
      </>;
      break;
    }
  }
  return (
    <svg viewBox="-2 -2 104 100" className={`gp gp-${pos}${ghost ? ' gp-ghost' : ''} ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} /><stop offset="0.18" stopColor={base} /><stop offset="0.74" stopColor={base} /><stop offset="0.74" stopColor={dark} /><stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      {shape}
      {hi}
      {scuffs}
      {detail}
    </svg>
  );
}
