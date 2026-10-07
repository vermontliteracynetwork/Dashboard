import type { Kind } from './parts';
import { kindInfo, PART_H, partWidth, isWordKind } from './parts';
import { SYMBOLS } from '../../data/symbols';
import { nounByWord } from '../../data/wordbank';

// One factory machine (teacher 2026-10-07: "old factory looking machines
// with pipes and screws, nuts and bolts ... the color that each symbol
// is"). Copper pipe stubs on both sides line up when parts snap
// together, hex nuts on the corners, a little dial or lever on every
// machine, and a topper that tells the part of speech apart.
const INK = '#1f2f4d';
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`;
}
function Nut({ x, y, r = 5.5 }: { x: number; y: number; r?: number }) {
  const pts = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i + Math.PI / 6; return `${x + Math.cos(a) * r},${y + Math.sin(a) * r}`; }).join(' ');
  return <g><polygon points={pts} fill="#c8ced8" stroke={INK} strokeWidth={1.8} /><circle cx={x} cy={y} r={r * 0.38} fill="#7d8796" /></g>;
}
function Gear({ cx, cy, r, fill, cls }: { cx: number; cy: number; r: number; fill: string; cls?: string }) {
  const teeth = Array.from({ length: 10 }, (_, i) => <rect key={i} x={cx - 3.5} y={cy - r - 5} width={7} height={8} rx={1.5} fill={fill} stroke={INK} strokeWidth={1.8} transform={`rotate(${i * 36} ${cx} ${cy})`} />);
  return <g className={cls} style={{ transformOrigin: `${cx}px ${cy}px` }}>{teeth}<circle cx={cx} cy={cy} r={r} fill={fill} stroke={INK} strokeWidth={2.4} /><circle cx={cx} cy={cy} r={r * 0.35} fill="#fff" stroke={INK} strokeWidth={2} /></g>;
}

function Topper({ kind, w, base, dark, light }: { kind: Kind; w: number; base: string; dark: string; light: string }) {
  const c = w / 2;
  switch (kind) {
    case 'N': return <g>
      <rect x={c + 18} y={4} width={14} height={34} rx={2} fill="#6b7383" stroke={INK} strokeWidth={2.4} />
      <rect x={c + 15} y={2} width={20} height={7} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2.2} />
      <g className="gwb-smoke"><circle cx={c + 25} cy={-6} r={5} fill="#fff" opacity={0.85} /><circle cx={c + 31} cy={-14} r={4} fill="#fff" opacity={0.7} /></g>
      <path d={`M${c - 32} 42 Q${c - 32} 14 ${c} 14 Q${c + 22} 14 ${c + 26} 30 L${c + 26} 42Z`} fill={base} stroke={INK} strokeWidth={3} />
      <ellipse cx={c - 12} cy={24} rx={7} ry={3} fill="#fff" opacity={0.35} />
    </g>;
    case 'V': return <Gear cx={c} cy={26} r={15} fill={light} cls="gwb-spin" />;
    case 'J': return <g>
      <rect x={c - 16} y={10} width={32} height={32} rx={8} fill={base} stroke={INK} strokeWidth={3} />
      <rect x={c - 4} y={2} width={8} height={10} fill="#8f98a8" stroke={INK} strokeWidth={2} />
      <path d={`M${c + 4} 6 L${c + 22} 6 L${c + 26} 2 L${c + 26} 12 L${c + 22} 8`} fill="#c8ced8" stroke={INK} strokeWidth={2} />
      <g className="gwb-spray"><circle cx={c + 32} cy={5} r={2} fill={light} /><circle cx={c + 36} cy={9} r={1.6} fill={light} /><circle cx={c + 35} cy={1} r={1.4} fill={light} /></g>
    </g>;
    case 'D': return <g>
      <circle cx={c} cy={24} r={18} fill="#fff8e6" stroke={INK} strokeWidth={3} />
      {[-60, -30, 0, 30, 60].map((a) => <line key={a} x1={c} y1={10} x2={c} y2={13} stroke={INK} strokeWidth={2} transform={`rotate(${a} ${c} 24)`} />)}
      <line className="gwb-needle" x1={c} y1={24} x2={c} y2={11} stroke="#e8483b" strokeWidth={3} strokeLinecap="round" style={{ transformOrigin: `${c}px 24px` }} />
      <circle cx={c} cy={24} r={3} fill={INK} />
    </g>;
    case 'A': return <g>
      <rect x={c - 4} y={22} width={8} height={20} fill="#8f98a8" stroke={INK} strokeWidth={2} />
      <g className="gwb-spin" style={{ transformOrigin: `${c}px 20px` }}>
        <circle cx={c} cy={20} r={14} fill="none" stroke={dark} strokeWidth={5} />
        <line x1={c - 14} y1={20} x2={c + 14} y2={20} stroke={dark} strokeWidth={4} /><line x1={c} y1={6} x2={c} y2={34} stroke={dark} strokeWidth={4} />
        <circle cx={c} cy={20} r={4} fill={light} stroke={INK} strokeWidth={2} />
      </g>
    </g>;
    case 'R': return <g fill="none" strokeLinecap="round">
      <path d={`M${c - 20} 6 L${c} 26 L${c + 20} 6 M${c} 26 L${c} 44`} stroke={INK} strokeWidth={13} />
      <path d={`M${c - 20} 6 L${c} 26 L${c + 20} 6 M${c} 26 L${c} 44`} stroke={base} strokeWidth={8} />
      <rect x={c - 7} y={18} width={14} height={10} rx={3} fill={light} stroke={INK} strokeWidth={2} />
    </g>;
    case 'P': return <g fill="none">
      <path d={`M${c - 26} 44 L${c - 26} 22 Q${c - 26} 6 ${c} 6 Q${c + 26} 6 ${c + 26} 22 L${c + 26} 44`} stroke={INK} strokeWidth={14} />
      <path d={`M${c - 26} 44 L${c - 26} 22 Q${c - 26} 6 ${c} 6 Q${c + 26} 6 ${c + 26} 22 L${c + 26} 44`} stroke={base} strokeWidth={9} />
      <rect x={c - 33} y={30} width={14} height={6} fill={light} stroke={INK} strokeWidth={2} /><rect x={c + 19} y={30} width={14} height={6} fill={light} stroke={INK} strokeWidth={2} />
    </g>;
    case 'C': return <g>
      <path d={`M${c - 28} 24 L${c - 10} 10 L${c - 10} 38Z`} fill={base} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      <path d={`M${c + 28} 24 L${c + 10} 10 L${c + 10} 38Z`} fill={base} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      <rect x={c - 10} y={18} width={20} height={12} rx={3} fill={light} stroke={INK} strokeWidth={2.4} />
    </g>;
    case 'I': return <g>
      <path d={`M${c} 2 Q${c + 16} 22 ${c + 12} 34 Q${c} 44 ${c - 12} 34 Q${c - 16} 22 ${c} 2Z`} fill={base} stroke={INK} strokeWidth={3} />
      <rect x={c - 3} y={28} width={6} height={16} fill="#8f98a8" stroke={INK} strokeWidth={2} />
      <g className="gwb-smoke"><circle cx={c} cy={-8} r={5} fill="#fff" opacity={0.85} /></g>
    </g>;
    case 'cap': return <g>
      <rect x={c - 30} y={2} width={60} height={10} rx={3} fill="#6b7383" stroke={INK} strokeWidth={2.4} />
      <g className="gwb-piston"><rect x={c - 6} y={10} width={12} height={20} fill="#c8ced8" stroke={INK} strokeWidth={2} />
        <rect x={c - 20} y={28} width={40} height={14} rx={2} fill="#f3cf6b" stroke={INK} strokeWidth={2.6} />
        <text x={c} y={39.5} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={12} fill={INK}>Aa</text></g>
    </g>;
    case 'stop': case 'bang': return <g>
      <rect x={c - 5} y={4} width={10} height={20} fill="#8b5a2b" stroke={INK} strokeWidth={2} />
      <ellipse cx={c} cy={6} rx={10} ry={6} fill="#a0703c" stroke={INK} strokeWidth={2} />
      <rect className="gwb-piston" x={c - 18} y={24} width={36} height={18} rx={4} fill={dark} stroke={INK} strokeWidth={2.6} />
    </g>;
    case 'comma': return <g>
      <path d={`M${c - 12} 42 L${c - 12} 14 Q${c - 12} 4 ${c} 4 Q${c + 12} 4 ${c + 12} 14 L${c + 12} 42`} fill="none" stroke={INK} strokeWidth={7} />
      <path d={`M${c - 12} 42 L${c - 12} 14 Q${c - 12} 4 ${c} 4 Q${c + 12} 4 ${c + 12} 14 L${c + 12} 42`} fill="none" stroke={base} strokeWidth={3.5} />
    </g>;
    default: return null;
  }
}

export default function MachinePart({ kind, word, empty = false, scale = 1 }: { kind: Kind; word: string | null; empty?: boolean; scale?: number }) {
  const info = kindInfo(kind);
  const w = partWidth(kind, word);
  const base = info.color;
  const dark = shade(base, -0.3);
  const light = shade(base, 0.5);
  const gid = `gwb-g-${kind}`;
  const H = PART_H;
  if (kind === 'tv') {
    return (
      <svg width={w * scale} height={(H + 14) * scale} viewBox={`0 -14 ${w} ${H + 14}`} className="gwb-svg" aria-hidden>
        <line x1={w / 2 - 6} y1={6} x2={w / 2 - 28} y2={-12} stroke={INK} strokeWidth={3} /><line x1={w / 2 + 6} y1={6} x2={w / 2 + 30} y2={-10} stroke={INK} strokeWidth={3} />
        <circle cx={w / 2 - 28} cy={-12} r={3.5} fill="#e8483b" stroke={INK} strokeWidth={1.5} /><circle cx={w / 2 + 30} cy={-10} r={3.5} fill="#e8483b" stroke={INK} strokeWidth={1.5} />
        <rect x={0} y={68} width={14} height={16} fill="#c98a4b" stroke={INK} strokeWidth={2.4} />
        <rect x={8} y={6} width={w - 16} height={112} rx={14} fill={base} stroke={INK} strokeWidth={4} />
        <rect x={16} y={12} width={w - 32} height={100} rx={8} fill="#111" stroke={INK} strokeWidth={2} />
        <rect x={20} y={120} width={14} height={8} fill="#6b7383" stroke={INK} strokeWidth={2} /><rect x={w - 34} y={120} width={14} height={8} fill="#6b7383" stroke={INK} strokeWidth={2} />
        <Nut x={14} y={12} r={4} /><Nut x={w - 14} y={12} r={4} /><Nut x={14} y={112} r={4} /><Nut x={w - 14} y={112} r={4} />
      </svg>
    );
  }
  const fill = empty ? '#f4f1ea' : `url(#${gid})`;
  const label = word ?? (isWordKind(kind) ? '?' : kind === 'stop' ? '.' : kind === 'bang' ? '!' : kind === 'comma' ? ',' : 'Aa');
  const plateW = Math.max(44, w - 46);
  return (
    <svg width={w * scale} height={(H + 14) * scale} viewBox={`0 -14 ${w} ${H + 14}`} className="gwb-svg" aria-hidden>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={light} /><stop offset="0.35" stopColor={base} /><stop offset="1" stopColor={dark} /></linearGradient></defs>
      {/* pipe stubs: line up with the neighbors when parts snap together */}
      <rect x={0} y={70} width={14} height={16} fill="#c98a4b" stroke={INK} strokeWidth={2.4} />
      <rect x={w - 14} y={70} width={14} height={16} fill="#c98a4b" stroke={INK} strokeWidth={2.4} />
      <rect x={10} y={66} width={6} height={24} rx={1.5} fill="#e7b07a" stroke={INK} strokeWidth={2} />
      <rect x={w - 16} y={66} width={6} height={24} rx={1.5} fill="#e7b07a" stroke={INK} strokeWidth={2} />
      <Topper kind={kind} w={w} base={base} dark={dark} light={light} />
      {/* body */}
      <rect x={14} y={42} width={w - 28} height={74} rx={12} fill={fill} stroke={INK} strokeWidth={4} strokeDasharray={empty ? '8 6' : undefined} />
      {!empty && <rect x={20} y={46} width={w - 40} height={8} rx={4} fill="#fff" opacity={0.25} />}
      <Nut x={24} y={52} /><Nut x={w - 24} y={52} /><Nut x={24} y={106} /><Nut x={w - 24} y={106} />
      {/* symbol badge or finishing badge */}
      {isWordKind(kind) && <image href={SYMBOLS[kind].asset} x={w / 2 - 11} y={44} width={22} height={18} />}
      {/* word plate */}
      <rect x={(w - plateW) / 2} y={62} width={plateW} height={32} rx={7} fill={empty ? '#fff' : '#fff8e6'} stroke={INK} strokeWidth={2.4} />
      <text x={w / 2} y={84} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={800} fontSize={label.length > 14 ? 14 : 18} fill={INK}>{label}</text>
      {kind === 'N' && word && nounByWord.get(word) && <text x={w - 30} y={108} textAnchor="middle" fontSize={13}>{nounByWord.get(word)!.emoji}</text>}
      {/* a little lever and a dial on every machine */}
      <g className="gwb-knob" style={{ transformOrigin: `32px 108px` }}><line x1={32} y1={108} x2={40} y2={98} stroke={INK} strokeWidth={3} strokeLinecap="round" /><circle cx={40} cy={98} r={3.5} fill="#e8483b" stroke={INK} strokeWidth={1.5} /></g>
      <circle cx={w - 42} cy={104} r={6} fill="#fff8e6" stroke={INK} strokeWidth={1.8} /><line className="gwb-needle" x1={w - 42} y1={104} x2={w - 42} y2={99.5} stroke="#e8483b" strokeWidth={1.8} style={{ transformOrigin: `${w - 42}px 104px` }} />
      {/* feet */}
      <rect x={22} y={116} width={18} height={10} rx={2} fill="#6b7383" stroke={INK} strokeWidth={2} />
      <rect x={w - 40} y={116} width={18} height={10} rx={2} fill="#6b7383" stroke={INK} strokeWidth={2} />
    </svg>
  );
}
