import { createContext, useContext } from 'react';
import type { Kind } from './parts';
import { kindInfo, PART_H, partWidth, isWordKind, wordPosOf, BODY } from './parts';
import PartSvg from '../PartSvg';
import { nounByWord } from '../../data/wordbank';

// One factory machine (teacher 2026-10-07: "each grammar symbol should
// become the physical shape of that machine part"). A word machine IS its
// symbol: the noun is a big red triangle boiler, the verb a big green
// flywheel, the article a small pink cone, and so on, mounted on a copper
// pipe line with hex-nut flanges, standing on a little stand, with a brass
// nameplate for the word. Capital letter, punctuation, Pixel TV, Start
// Lever and the Rube Goldberg contraption parts are machines too.
const INK = '#1f2f4d';
const PIPE_Y = 78;
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`;
}
function Nut({ x, y, r = 5 }: { x: number; y: number; r?: number }) {
  const pts = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i + Math.PI / 6; return `${x + Math.cos(a) * r},${y + Math.sin(a) * r}`; }).join(' ');
  return <g><polygon points={pts} fill="#c8ced8" stroke={INK} strokeWidth={1.6} /><circle cx={x} cy={y} r={r * 0.38} fill="#7d8796" /></g>;
}
// The copper pipe line every machine sits on. Flanges at both ends meet
// the neighbor's flange when parts snap together.
function Pipes({ w }: { w: number }) {
  return <g>
    {/* Pipe paint from Gus's Paint Shop (CSS variables on the Workboard); copper by default. */}
    <rect x={0} y={PIPE_Y - 7} width={w} height={14} style={{ fill: 'var(--gwb-pipe, #c98a4b)' }} stroke={INK} strokeWidth={2.2} />
    <rect x={0} y={PIPE_Y - 7} width={w} height={4} style={{ fill: 'var(--gwb-pipe-light, #e7b07a)' }} />
    <rect x={2} y={PIPE_Y - 12} width={7} height={24} rx={1.5} style={{ fill: 'var(--gwb-pipe-light, #e7b07a)' }} stroke={INK} strokeWidth={2} />
    <rect x={w - 9} y={PIPE_Y - 12} width={7} height={24} rx={1.5} style={{ fill: 'var(--gwb-pipe-light, #e7b07a)' }} stroke={INK} strokeWidth={2} />
    <Nut x={5.5} y={PIPE_Y - 8} r={3} /><Nut x={5.5} y={PIPE_Y + 8} r={3} /><Nut x={w - 5.5} y={PIPE_Y - 8} r={3} /><Nut x={w - 5.5} y={PIPE_Y + 8} r={3} />
  </g>;
}
// The word tag under a word machine, in that word's own grammar color
// (teacher 2026-10-07: "make the word tags under the same color as the
// corresponding machine/grammar symbols"). Parts that hold no word get no
// tag at all: "dont have title tags underneath each machine part that
// isnt a word becuase it is confusing".
const inkOn = (hex: string) => { const n = parseInt(hex.slice(1), 16); const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l > 0.6 ? INK : '#fff'; };
function Plate({ w, text, y = 138, blank = false, color = '#f3d27a' }: { w: number; text: string; y?: number; blank?: boolean; color?: string }) {
  const pw = Math.min(w - 8, Math.max(46, text.length * 10.5 + 24));
  const x = (w - pw) / 2;
  return <g>
    <line x1={x + 10} y1={y} x2={x + 10} y2={y - 10} stroke={INK} strokeWidth={2} /><line x1={x + pw - 10} y1={y} x2={x + pw - 10} y2={y - 10} stroke={INK} strokeWidth={2} />
    <rect x={x} y={y} width={pw} height={28} rx={6} fill={blank ? '#fff' : color} stroke={INK} strokeWidth={2.6} strokeDasharray={blank ? '6 4' : undefined} />
    <circle cx={x + 6} cy={y + 14} r={2} fill={blank ? INK : inkOn(color)} /><circle cx={x + pw - 6} cy={y + 14} r={2} fill={blank ? INK : inkOn(color)} />
    <text x={w / 2} y={y + 20} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={800} fontSize={text.length > 14 ? 13 : 17} fill={blank ? INK : inkOn(color)}>{text}</text>
  </g>;
}
// A little cog on every stand: it whirs while the machine runs.
function Gear({ x, y, r = 10, color = '#c8ced8', rev = false }: { x: number; y: number; r?: number; color?: string; rev?: boolean }) {
  const teeth = Array.from({ length: 8 }, (_, i) => { const a = (Math.PI / 4) * i; return <rect key={i} x={x - 2.5} y={y - r - 4} width={5} height={6} rx={1} fill={color} stroke={INK} strokeWidth={1.4} transform={`rotate(${(a * 180) / Math.PI} ${x} ${y})`} />; });
  return <g className={`gwb-gear${rev ? ' rev' : ''}`} style={{ transformOrigin: `${x}px ${y}px` }}>{teeth}<circle cx={x} cy={y} r={r} fill={color} stroke={INK} strokeWidth={2} /><circle cx={x} cy={y} r={r * 0.35} fill="#7d8796" stroke={INK} strokeWidth={1.4} /></g>;
}
// Machine legs from Gus's Paint Shop (Garage part variants, plan 8.7, 2026-10-09): a small config,
// not a new drawing, so a word machine keeps its grammar shape and color in every style.
export const LegsContext = createContext<string>('stand');
function Stand({ w, top }: { w: number; top: number }) {
  const legs = useContext(LegsContext);
  const c = w / 2;
  if (legs === 'wheels') return <g>
    <rect x={c - 5} y={top} width={10} height={Math.max(0, 114 - top)} fill="#6b7383" stroke={INK} strokeWidth={2} />
    <rect x={c - 24} y={110} width={48} height={7} rx={3} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    <g className="gwb-wheel" style={{ transformOrigin: `${c - 15}px 123px` }}><circle cx={c - 15} cy={123} r={7} fill="#3c455e" stroke={INK} strokeWidth={2} /><line x1={c - 21} y1={123} x2={c - 9} y2={123} stroke="#c8ced8" strokeWidth={2} /></g>
    <g className="gwb-wheel" style={{ transformOrigin: `${c + 15}px 123px` }}><circle cx={c + 15} cy={123} r={7} fill="#3c455e" stroke={INK} strokeWidth={2} /><line x1={c + 9} y1={123} x2={c + 21} y2={123} stroke="#c8ced8" strokeWidth={2} /></g>
  </g>;
  if (legs === 'springs') {
    const h = Math.max(8, 120 - top), n = 6;
    const pts = Array.from({ length: n + 1 }, (_, i) => `${c + (i === 0 || i === n ? 0 : i % 2 ? -9 : 9)},${top + (h * i) / n}`).join(' ');
    return <g className="gwb-spring">
      <polyline points={pts} fill="none" stroke="#6b7383" strokeWidth={4} strokeLinejoin="round" /><polyline points={pts} fill="none" stroke="#c8ced8" strokeWidth={1.5} strokeLinejoin="round" />
      <rect x={c - 22} y={121} width={44} height={6} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
  }
  if (legs === 'feet') return <g>
    <rect x={c - 13} y={top} width={7} height={Math.max(0, 118 - top)} fill="#6b7383" stroke={INK} strokeWidth={2} />
    <rect x={c + 6} y={top} width={7} height={Math.max(0, 118 - top)} fill="#6b7383" stroke={INK} strokeWidth={2} />
    <ellipse cx={c - 14} cy={123} rx={11} ry={6} fill="#f39c3d" stroke={INK} strokeWidth={2} /><ellipse cx={c + 14} cy={123} rx={11} ry={6} fill="#f39c3d" stroke={INK} strokeWidth={2} />
  </g>;
  if (legs === 'rocket') return <g>
    <rect x={c - 6} y={top} width={12} height={Math.max(0, 116 - top)} fill="#d8dde6" stroke={INK} strokeWidth={2} />
    <path d={`M${c - 6} ${100} L${c - 20} ${124} L${c - 6} ${118} Z`} fill="#e8483b" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    <path d={`M${c + 6} ${100} L${c + 20} ${124} L${c + 6} ${118} Z`} fill="#e8483b" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    <path d={`M${c - 5} 116 L${c + 5} 116 L${c} 128 Z`} className="gwb-flame" fill="#f3cf6b" stroke="#f39c3d" strokeWidth={1.5} />
  </g>;
  return <g>
    <rect x={w / 2 - 5} y={top} width={10} height={Math.max(0, 124 - top)} fill="#6b7383" stroke={INK} strokeWidth={2} />
    <rect x={w / 2 - 22} y={122} width={44} height={6} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    <Nut x={w / 2 - 14} y={125} r={2.6} /><Nut x={w / 2 + 14} y={125} r={2.6} />
  </g>;
}

function Contraption({ kind, w, color, word, status }: { kind: Kind; w: number; color: string; word: string | null; status?: string }) {
  const c = w / 2;
  const dark = shade(color, -0.3), light = shade(color, 0.45);
  switch (kind) {
    case 'spring': return <g>
      <g className="gwb-spring">{Array.from({ length: 6 }, (_, i) => <ellipse key={i} cx={c} cy={112 - i * 7} rx={30} ry={4} fill="none" stroke="#8f98a8" strokeWidth={3} />)}</g>
      <rect x={c - 38} y={64} width={76} height={10} rx={4} fill={color} stroke={INK} strokeWidth={2.6} />
      <rect x={c - 40} y={116} width={80} height={10} rx={3} fill="#6b7383" stroke={INK} strokeWidth={2.4} />
    </g>;
    case 'pulley': return <g>
      <rect x={c - 4} y={6} width={8} height={120} fill="#8b5a2b" stroke={INK} strokeWidth={2} />
      <rect x={c - 34} y={4} width={68} height={8} fill="#8b5a2b" stroke={INK} strokeWidth={2} />
      <g className="gwb-spin" style={{ transformOrigin: `${c + 22}px 20px` }}><circle cx={c + 22} cy={20} r={11} fill={light} stroke={INK} strokeWidth={2.4} /><line x1={c + 12} y1={20} x2={c + 32} y2={20} stroke={INK} strokeWidth={2} /><circle cx={c + 22} cy={20} r={3} fill={INK} /></g>
      <line x1={c + 33} y1={20} x2={c + 33} y2={92} stroke="#c9a46e" strokeWidth={2.4} />
      <g className="gwb-hoist"><path d={`M${c + 22} 92 L${c + 44} 92 L${c + 41} 112 L${c + 25} 112Z`} fill={color} stroke={INK} strokeWidth={2.4} /></g>
      <rect x={c - 30} y={120} width={60} height={8} rx={2} fill="#6b7383" stroke={INK} strokeWidth={2} />
    </g>;
    case 'ramp': return <g>
      <path d={`M10 40 L${w - 10} 112 L${w - 10} 124 L10 124Z`} fill={color} stroke={INK} strokeWidth={2.8} strokeLinejoin="round" />
      <line x1={10} y1={40} x2={w - 10} y2={112} stroke={light} strokeWidth={3} />
      <Nut x={24} y={110} r={4} /><Nut x={w - 24} y={116} r={4} /><Nut x={30} y={66} r={4} />
    </g>;
    case 'conveyor': return <g>
      <rect x={10} y={88} width={w - 20} height={24} rx={12} fill="#3c455e" stroke={INK} strokeWidth={2.6} />
      {Array.from({ length: Math.floor((w - 30) / 22) }, (_, i) => <g key={i} className="gwb-spin" style={{ transformOrigin: `${24 + i * 22}px 100px` }}><circle cx={24 + i * 22} cy={100} r={8} fill={light} stroke={INK} strokeWidth={2} /><line x1={18 + i * 22} y1={100} x2={30 + i * 22} y2={100} stroke={INK} strokeWidth={1.5} /></g>)}
      <rect x={20} y={112} width={8} height={14} fill="#6b7383" stroke={INK} strokeWidth={2} /><rect x={w - 28} y={112} width={8} height={14} fill="#6b7383" stroke={INK} strokeWidth={2} />
    </g>;
    case 'fan': return <g>
      <circle cx={c} cy={56} r={34} fill="#e9eef3" stroke={INK} strokeWidth={3} />
      <g className="gwb-spin" style={{ transformOrigin: `${c}px 56px` }}>{[0, 120, 240].map((a) => <ellipse key={a} cx={c} cy={38} rx={8} ry={16} fill={color} stroke={INK} strokeWidth={2} transform={`rotate(${a} ${c} 56)`} />)}<circle cx={c} cy={56} r={5} fill={dark} stroke={INK} strokeWidth={2} /></g>
      <rect x={c - 5} y={90} width={10} height={32} fill="#6b7383" stroke={INK} strokeWidth={2} /><rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'bell': return <g>
      <rect x={c - 34} y={8} width={68} height={8} fill="#8b5a2b" stroke={INK} strokeWidth={2} /><rect x={c - 32} y={8} width={6} height={118} fill="#8b5a2b" stroke={INK} strokeWidth={2} /><rect x={c + 26} y={8} width={6} height={118} fill="#8b5a2b" stroke={INK} strokeWidth={2} />
      <g className="gwb-ring" style={{ transformOrigin: `${c}px 16px` }}><path d={`M${c - 22} 74 Q${c - 20} 30 ${c} 28 Q${c + 20} 30 ${c + 22} 74Z`} fill={color} stroke={INK} strokeWidth={3} /><circle cx={c} cy={80} r={6} fill={dark} stroke={INK} strokeWidth={2} /><ellipse cx={c - 8} cy={44} rx={4} ry={8} fill="#fff" opacity={0.5} /></g>
    </g>;
    case 'dominoes': return <g>
      {Array.from({ length: 5 }, (_, i) => <g key={i} className="gwb-domino" style={{ transformOrigin: `${22 + i * 24 + 6}px 124px`, animationDelay: `${i * 0.08}s` }}><rect x={22 + i * 24} y={70} width={12} height={54} rx={2} fill={i % 2 ? '#fff' : color} stroke={INK} strokeWidth={2.4} /><circle cx={28 + i * 24} cy={86} r={2} fill={INK} /><circle cx={28 + i * 24} cy={106} r={2} fill={INK} /></g>)}
      <rect x={10} y={124} width={w - 20} height={4} fill="#6b7383" />
    </g>;
    case 'bucket': return <g>
      <rect x={c - 4} y={20} width={8} height={106} fill="#6b7383" stroke={INK} strokeWidth={2} />
      <g className="gwb-tip" style={{ transformOrigin: `${c}px 30px` }}><path d={`M${c - 28} 30 L${c + 28} 30 L${c + 22} 64 L${c - 22} 64Z`} fill={color} stroke={INK} strokeWidth={2.8} /><rect x={c - 30} y={26} width={60} height={6} rx={2} fill={light} stroke={INK} strokeWidth={2} /></g>
      <rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'horn': return <g>
      <Pipes w={30} />
      <circle className="gwb-bulb" cx={18} cy={PIPE_Y - 26} r={13} fill="#e8483b" stroke={INK} strokeWidth={2.6} style={{ transformOrigin: `18px ${PIPE_Y - 16}px` }} />
      <rect x={14} y={PIPE_Y - 16} width={8} height={10} fill="#8f98a8" stroke={INK} strokeWidth={2} />
      <g className="gwb-honk" style={{ transformOrigin: `30px ${PIPE_Y}px` }}>
        <path d={`M24 ${PIPE_Y - 6} L${c - 4} ${PIPE_Y - 14} Q${c + 30} ${PIPE_Y - 26} ${w - 12} 8 L${w - 12} ${PIPE_Y + 52} Q${c + 30} ${PIPE_Y + 14} ${c - 4} ${PIPE_Y + 10} L24 ${PIPE_Y + 6}Z`} fill={color} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        <path d={`M${c - 4} ${PIPE_Y - 10} Q${c + 30} ${PIPE_Y - 20} ${w - 16} 14`} fill="none" stroke={light} strokeWidth={3} />
        <ellipse cx={w - 12} cy={(8 + PIPE_Y + 52) / 2} rx={11} ry={(PIPE_Y + 44) / 2} fill={dark} stroke={INK} strokeWidth={3} />
        <ellipse cx={w - 10} cy={(8 + PIPE_Y + 52) / 2} rx={5} ry={(PIPE_Y + 20) / 2} fill="#3a2a10" />
      </g>
      <rect x={c - 5} y={PIPE_Y + 8} width={10} height={124 - PIPE_Y - 8} fill="#6b7383" stroke={INK} strokeWidth={2} />
      <rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'duplicator': return <g>
      <Pipes w={w} />
      <rect x={c - 38} y={14} width={76} height={92} rx={10} fill={color} stroke={INK} strokeWidth={3} />
      <rect x={c - 30} y={22} width={44} height={26} rx={4} fill="#111" stroke={INK} strokeWidth={2} />
      <text x={c - 8} y={42} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={17} fill="#7dff8a" className="gwb-blink">x2</text>
      <g className="gwb-spin" style={{ transformOrigin: `${c + 24}px 34px` }}><circle cx={c + 24} cy={34} r={8} fill={light} stroke={INK} strokeWidth={2} /><line x1={c + 24} y1={34} x2={c + 24} y2={22} stroke={INK} strokeWidth={3} strokeLinecap="round" /></g>
      <rect x={c - 30} y={92} width={22} height={18} rx={3} fill={light} stroke={INK} strokeWidth={2} /><rect x={c + 8} y={92} width={22} height={18} rx={3} fill={light} stroke={INK} strokeWidth={2} />
      <g className="gwb-copy"><rect x={c - 26} y={96} width={14} height={10} fill="#fff" stroke={INK} strokeWidth={1.4} /><rect x={c + 12} y={96} width={14} height={10} fill="#fff" stroke={INK} strokeWidth={1.4} /></g>
      <Nut x={c - 32} y={20} r={3.5} /><Nut x={c + 32} y={20} r={3.5} /><Nut x={c - 32} y={100} r={3.5} /><Nut x={c + 32} y={100} r={3.5} />
      <rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'trapdoor': return <g>
      <Pipes w={w} />
      <rect x={c - 30} y={50} width={60} height={56} rx={6} fill={color} stroke={INK} strokeWidth={3} />
      <g className="gwb-lid" style={{ transformOrigin: `${c - 30}px 50px` }}><rect x={c - 32} y={42} width={64} height={10} rx={3} fill={light} stroke={INK} strokeWidth={2.4} /></g>
      {[[-18, 30, '#e8483b'], [0, 20, '#3fbf5a'], [16, 32, '#5b8def'], [-6, 8, '#f3cf6b'], [22, 12, '#b48ad6']].map(([dx, y, f], i) => <rect key={i} className="gwb-confetti-bit" x={c + (dx as number)} y={y as number} width={6} height={8} rx={1} fill={f as string} stroke={INK} strokeWidth={1} transform={`rotate(${i * 37} ${c + (dx as number)} ${y as number})`} />)}
      <text x={c} y={86} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={26} fill={INK}>!</text>
      <rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'mood': {
      const big = word === 'big';
      return <g>
        <Pipes w={w} />
        <path d={`M${c - 40} 70 A40 40 0 0 1 ${c + 40} 70Z`} fill="#fff8e6" stroke={INK} strokeWidth={3} />
        <path d={`M${c - 34} 70 A34 34 0 0 1 ${c} 36`} fill="none" stroke="#3fbf5a" strokeWidth={7} />
        <path d={`M${c} 36 A34 34 0 0 1 ${c + 34} 70`} fill="none" stroke="#e8483b" strokeWidth={7} />
        <g className="gwb-mood-needle" style={{ transformOrigin: `${c}px 68px`, transform: `rotate(${big ? 55 : -55}deg)` }}><line x1={c} y1={68} x2={c} y2={38} stroke={INK} strokeWidth={4} strokeLinecap="round" /></g>
        <circle cx={c} cy={68} r={5} fill={color} stroke={INK} strokeWidth={2} />
        <text x={c - 26} y={88} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={800} fontSize={11} fill={INK}>calm .</text>
        <text x={c + 26} y={88} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={11} fill={INK}>BIG !</text>
        <rect x={c - 5} y={92} width={10} height={30} fill="#6b7383" stroke={INK} strokeWidth={2} /><rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
      </g>;
    }
    case 'tunnel': return <g>
      <Pipes w={w} />
      <path d={`M14 124 L14 62 Q${c} 0 ${w - 14} 62 L${w - 14} 124Z`} fill={color} stroke={INK} strokeWidth={3} />
      <path d={`M30 124 L30 70 Q${c} 22 ${w - 30} 70 L${w - 30} 124Z`} fill="#1d1430" stroke={INK} strokeWidth={2} />
      <g className="gwb-spin" style={{ transformOrigin: `${c}px 82px` }}>{[0, 120, 240].map((a, i) => <path key={a} d={`M${c} 82 q 14 -22 28 0`} fill="none" stroke={['#8c6a3c', '#f3cf6b', '#3b7be8'][i]} strokeWidth={4} transform={`rotate(${a} ${c} 82)`} />)}</g>
      <text x={c - 30} y={56} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff" fontFamily="Lexend, sans-serif">past</text>
      <text x={c + 30} y={56} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff" fontFamily="Lexend, sans-serif">future</text>
    </g>;
    case 'slingshot': return <g>
      <path d={`M${c} 124 L${c} 80 L${c - 26} 30 M${c} 80 L${c + 26} 30`} fill="none" stroke="#8b5a2b" strokeWidth={9} strokeLinecap="round" />
      <path d={`M${c} 124 L${c} 80 L${c - 26} 30 M${c} 80 L${c + 26} 30`} fill="none" stroke={light} strokeWidth={3} strokeLinecap="round" />
      <g className="gwb-band"><path d={`M${c - 26} 32 Q${c} 70 ${c + 26} 32`} fill="none" stroke="#e8483b" strokeWidth={4} /><circle cx={c} cy={56} r={8} fill="#c8ced8" stroke={INK} strokeWidth={2} /></g>
      <rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'dial': {
      const sp = Math.max(0.4, Math.min(2, Number(status ?? 1)));
      const ang = -80 + ((sp - 0.4) / 1.6) * 160;
      return <g>
        <Pipes w={w} />
        <circle cx={c} cy={52} r={40} fill={color} stroke={INK} strokeWidth={3} /><circle cx={c} cy={52} r={32} fill="#fff8e6" stroke={INK} strokeWidth={2} />
        <text x={c - 22} y={70} textAnchor="middle" fontSize={14}>🐌</text><text x={c + 22} y={70} textAnchor="middle" fontSize={14}>🚀</text>
        <g style={{ transformOrigin: `${c}px 52px`, transform: `rotate(${ang}deg)`, transition: 'transform 0.4s' }}><line x1={c} y1={52} x2={c} y2={26} stroke="#e8483b" strokeWidth={4} strokeLinecap="round" /></g>
        <circle cx={c} cy={52} r={4} fill={INK} />
        <rect x={c - 5} y={92} width={10} height={30} fill="#6b7383" stroke={INK} strokeWidth={2} /><rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
      </g>;
    }
    case 'switch': {
      const wd = (word ?? '').toLowerCase();
      return <g>
        <rect x={6} y={110} width={w - 12} height={6} fill="#8b5a2b" stroke={INK} strokeWidth={1.6} />
        {Array.from({ length: Math.floor((w - 12) / 14) }, (_, i) => <rect key={i} x={10 + i * 14} y={116} width={6} height={8} fill="#6b4a2b" />)}
        {wd === 'over' || wd === 'across' || wd === 'on' || wd === 'onto'
          ? <path d={`M10 108 Q${c} 10 ${w - 10} 108`} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />
          : wd === 'under' || wd === 'below' || wd === 'beneath'
            ? <><rect x={c - 30} y={40} width={60} height={70} rx={8} fill={color} stroke={INK} strokeWidth={3} /><path d={`M${c - 18} 110 L${c - 18} 82 Q${c} 64 ${c + 18} 82 L${c + 18} 110Z`} fill="#1d1430" /></>
            : wd === 'through' || wd === 'in' || wd === 'into' || wd === 'inside'
              ? <circle cx={c} cy={80} r={28} fill="none" stroke={color} strokeWidth={8} />
              : <path d={`M16 90 L${w - 30} 90 L${w - 30} 78 L${w - 12} 96 L${w - 30} 114 L${w - 30} 102 L16 102Z`} fill={color} stroke={INK} strokeWidth={2.4} />}
        <g className="gwb-knob" style={{ transformOrigin: '20px 110px' }}><line x1={20} y1={110} x2={30} y2={84} stroke={INK} strokeWidth={4} /><circle cx={30} cy={82} r={6} fill="#e8483b" stroke={INK} strokeWidth={2} /></g>
      </g>;
    }
    case 'funnel': return <g>
      <Pipes w={w} />
      <path d={`M${c - 46} 14 L${c + 46} 14 L${c + 10} 66 L${c + 10} 96 L${c - 10} 96 L${c - 10} 66Z`} fill={color} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <ellipse cx={c} cy={14} rx={46} ry={8} fill={light} stroke={INK} strokeWidth={2.4} />
      <circle cx={c - 16} cy={10} r={7} fill="#c8ced8" stroke={INK} strokeWidth={1.6} className="gwb-drop" /><circle cx={c + 16} cy={10} r={7} fill="#c8ced8" stroke={INK} strokeWidth={1.6} className="gwb-drop" />
      <rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'bridge': {
      const down = status !== 'up';
      return <g>
        <Pipes w={w} />
        <rect x={10} y={30} width={22} height={94} fill={color} stroke={INK} strokeWidth={2.6} /><rect x={w - 32} y={30} width={22} height={94} fill={color} stroke={INK} strokeWidth={2.6} />
        <path d={`M8 30 l6 -8 l6 8 l6 -8 l6 8`} fill="none" stroke={INK} strokeWidth={2} /><path d={`M${w - 34} 30 l6 -8 l6 8 l6 -8 l6 8`} fill="none" stroke={INK} strokeWidth={2} />
        <g style={{ transformOrigin: `32px 60px`, transform: `rotate(${down ? 0 : -62}deg)`, transition: 'transform 0.5s' }}><rect x={32} y={56} width={w - 64} height={10} fill={light} stroke={INK} strokeWidth={2.4} /><line x1={32} y1={60} x2={w - 34} y2={60} stroke={dark} strokeWidth={1.5} strokeDasharray="6 4" /></g>
        <line x1={20} y1={34} x2={down ? w - 34 : 60} y2={down ? 58 : 10} stroke="#8f98a8" strokeWidth={2} />
        <text x={c} y={104} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={30} fill={INK}>,</text>
      </g>;
    }
    case 'gears': return <g>
      <Pipes w={w} />
      <Gear x={c - 22} y={56} r={22} color={shade(color, 0.3)} /><Gear x={c + 24} y={70} r={16} color="#c8ced8" rev />
      <rect x={c - 5} y={92} width={10} height={30} fill="#6b7383" stroke={INK} strokeWidth={2} /><rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'sniffer': return <g>
      <Pipes w={w} />
      <rect x={c - 40} y={50} width={52} height={56} rx={10} fill={color} stroke={INK} strokeWidth={3} />
      <path d={`M${c + 12} 66 C${c + 40} 66 ${c + 30} 30 ${c + 46} 26`} fill="none" stroke="#6b7383" strokeWidth={9} strokeDasharray="3 3" />
      <g className="gwb-sniff" style={{ transformOrigin: `${c + 46}px 26px` }}><ellipse cx={c + 46} cy={24} rx={12} ry={8} fill="#f4b6c9" stroke={INK} strokeWidth={2.4} /><circle cx={c + 42} cy={25} r={2} fill={INK} /><circle cx={c + 50} cy={25} r={2} fill={INK} /></g>
      <text x={c - 14} y={84} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={16} fill="#fff">a/an</text>
      <rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} /><rect x={c - 18} y={106} width={8} height={14} fill="#6b7383" /><rect x={c - 4} y={106} width={8} height={14} fill="#6b7383" />
    </g>;
    case 'sorter': return <g>
      <path d={`M10 24 L${w - 10} 70`} stroke={color} strokeWidth={10} strokeLinecap="round" />
      {['feel', 'size', 'look', 'color'].map((lb, i) => { const x = 18 + i * ((w - 36) / 4); return <g key={lb}><rect x={x} y={84} width={(w - 36) / 4 - 4} height={36} rx={4} fill={['#f3cf6b', '#8fd18f', '#9ec7f0', '#e8483b'][i]} stroke={INK} strokeWidth={2} /><text x={x + ((w - 36) / 4 - 4) / 2} y={106} textAnchor="middle" fontSize={8.5} fontWeight={800} fontFamily="Lexend, sans-serif" fill={INK}>{lb}</text></g>; })}
      <g className="gwb-roll"><circle cx={30} cy={26} r={7} fill="#c8ced8" stroke={INK} strokeWidth={2} /></g>
      <rect x={10} y={120} width={w - 20} height={6} fill="#6b7383" />
    </g>;
    case 'teleporter': return <g>
      <Pipes w={w} />
      {[0, 1, 2].map((i) => <ellipse key={i} className="gwb-ring-glow" cx={c} cy={104 - i * 26} rx={36 - i * 4} ry={7} fill="none" stroke={color} strokeWidth={3} style={{ animationDelay: `${i * 0.2}s` }} />)}
      <ellipse cx={c} cy={112} rx={42} ry={10} fill={color} stroke={INK} strokeWidth={3} />
      <text x={c} y={50} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={14} fill={INK}>he she it they</text>
      <rect x={c - 30} y={120} width={60} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'detector': {
      const closed = status === 'closed';
      return <g>
        <rect x={c - 4} y={44} width={8} height={80} fill="#6b7383" stroke={INK} strokeWidth={2} />
        <rect x={c - 44} y={12} width={88} height={40} rx={6} fill={closed ? '#e8483b' : '#3fbf5a'} stroke={INK} strokeWidth={3} />
        <text x={c} y={30} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={12} fill="#fff">{closed ? 'ROAD' : 'ROAD'}</text>
        <text x={c} y={45} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={12} fill="#fff">{closed ? 'CLOSED' : 'OPEN'}</text>
        <circle cx={c} cy={64} r={7} fill={closed ? '#f3cf6b' : '#c8ced8'} stroke={INK} strokeWidth={2} />
        <rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
      </g>;
    }
    case 'flag': return <g>
      <rect x={c - 22} y={10} width={6} height={114} fill="#6b7383" stroke={INK} strokeWidth={2} />
      <g className="gwb-wave" style={{ transformOrigin: `${c - 16}px 14px` }}>{Array.from({ length: 12 }, (_, i) => <rect key={i} x={c - 16 + (i % 4) * 11} y={14 + Math.floor(i / 4) * 11} width={11} height={11} fill={(i + Math.floor(i / 4)) % 2 ? '#fff' : INK} />)}<rect x={c - 16} y={14} width={44} height={33} fill="none" stroke={INK} strokeWidth={2} /></g>
      <rect x={c - 30} y={120} width={36} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'stamp': return <g>
      <Pipes w={w} />
      <rect x={c - 34} y={6} width={68} height={10} rx={3} fill="#6b7383" stroke={INK} strokeWidth={2.4} />
      <rect x={c - 34} y={14} width={8} height={110} fill="#6b7383" stroke={INK} strokeWidth={2} /><rect x={c + 26} y={14} width={8} height={110} fill="#6b7383" stroke={INK} strokeWidth={2} />
      <g className="gwb-piston"><rect x={c - 5} y={16} width={10} height={18} fill="#c8ced8" stroke={INK} strokeWidth={2} /><rect x={c - 20} y={32} width={40} height={14} rx={3} fill="#8b5a2b" stroke={INK} strokeWidth={2.2} /><rect x={c - 22} y={46} width={44} height={10} rx={2} fill={color} stroke={INK} strokeWidth={2.2} /></g>
      <text x={c} y={96} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={22} fill="#f3cf6b" stroke={INK} strokeWidth={1}>{(word ?? 'Name').charAt(0).toUpperCase()}</text>
    </g>;
    case 'crusher': return <g>
      <Pipes w={w} />
      <rect x={c - 36} y={8} width={72} height={12} rx={3} fill="#6b7383" stroke={INK} strokeWidth={2.4} />
      <g className="gwb-crush"><rect x={c - 30} y={20} width={60} height={26} rx={4} fill={color} stroke={INK} strokeWidth={2.6} />{[-18, -6, 6, 18].map((dx) => <path key={dx} d={`M${c + dx - 5} 46 l5 8 l5 -8`} fill="#c8ced8" stroke={INK} strokeWidth={1.4} />)}</g>
      <rect x={c - 34} y={92} width={68} height={28} rx={4} fill="#3c455e" stroke={INK} strokeWidth={2.4} />
      <text x={c} y={112} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={13} fill="#f3cf6b">x → ?!</text>
    </g>;
    case 'pastpress': return <g>
      <Pipes w={w} />
      <rect x={c - 40} y={10} width={80} height={12} rx={3} fill="#6b7383" stroke={INK} strokeWidth={2.4} />
      <g className="gwb-piston"><rect x={c - 30} y={22} width={60} height={30} rx={4} fill={color} stroke={INK} strokeWidth={2.6} /><text x={c} y={42} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={12} fill="#fff">PAST</text></g>
      <rect x={c - 40} y={92} width={80} height={10} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
      <text x={c - 22} y={88} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={800} fontSize={11} fill="#c0392b" textDecoration="line-through">-ed</text>
      <text x={c + 22} y={88} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={13} fill="#1e7a44">✓</text>
      <rect x={c - 34} y={102} width={8} height={22} fill="#6b7383" /><rect x={c + 26} y={102} width={8} height={22} fill="#6b7383" />
    </g>;
    case 'listtrain': return <g>
      <rect x={6} y={112} width={w - 12} height={5} fill="#8b5a2b" />
      {[0, 1, 2].map((i) => { const x = 10 + i * ((w - 20) / 3); const cw = (w - 20) / 3 - 10; return <g key={i} className="gwb-chug" style={{ animationDelay: `${i * 0.08}s` }}>
        <rect x={x} y={i === 0 ? 50 : 70} width={cw} height={i === 0 ? 56 : 36} rx={4} fill={i === 0 ? color : light} stroke={INK} strokeWidth={2.4} />
        {i === 0 && <rect x={x + cw - 14} y={36} width={10} height={16} fill={dark} stroke={INK} strokeWidth={2} />}
        <circle cx={x + 8} cy={110} r={6} fill="#3c455e" stroke={INK} strokeWidth={2} /><circle cx={x + cw - 8} cy={110} r={6} fill="#3c455e" stroke={INK} strokeWidth={2} />
        {i < 2 && <text x={x + cw + 5} y={98} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={22} fill={INK}>,</text>}
      </g>; })}
    </g>;
    case 'turnstile': return <g>
      <Pipes w={w} />
      <rect x={c - 6} y={30} width={12} height={94} fill="#6b7383" stroke={INK} strokeWidth={2} />
      <g className="gwb-spin" style={{ transformOrigin: `${c}px 52px` }}>{[0, 120, 240].map((a) => <rect key={a} x={c - 3} y={18} width={6} height={34} rx={3} fill={color} stroke={INK} strokeWidth={1.8} transform={`rotate(${a} ${c} 52)`} />)}<circle cx={c} cy={52} r={7} fill={light} stroke={INK} strokeWidth={2} /></g>
      <rect x={c - 52} y={88} width={36} height={18} rx={4} fill="#3fbf5a" stroke={INK} strokeWidth={2} /><text x={c - 34} y={101} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={10} fill="#fff">he</text>
      <rect x={c + 16} y={88} width={36} height={18} rx={4} fill="#5b8def" stroke={INK} strokeWidth={2} /><text x={c + 34} y={101} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={10} fill="#fff">him</text>
      <rect x={c - 30} y={120} width={60} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'crane': return <g>
      <Pipes w={w} />
      <rect x={14} y={14} width={10} height={110} fill={color} stroke={INK} strokeWidth={2.4} />
      {[0, 1, 2, 3].map((i) => <line key={i} x1={14} y1={24 + i * 24} x2={24} y2={36 + i * 24} stroke={INK} strokeWidth={1.5} />)}
      <g className="gwb-swing" style={{ transformOrigin: '19px 16px' }}>
        <rect x={14} y={10} width={w - 26} height={9} fill={color} stroke={INK} strokeWidth={2.4} />
        <line x1={w - 22} y1={19} x2={w - 22} y2={58} stroke="#6b7383" strokeWidth={2} />
        <path d={`M${w - 28} 58 q 6 12 12 0`} fill="none" stroke={INK} strokeWidth={3} />
        <rect x={w - 46} y={66} width={44} height={22} rx={4} fill="#f3cf6b" stroke={INK} strokeWidth={2} /><text x={w - 24} y={81} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={11} fill={INK}>does?</text>
      </g>
      <rect x={4} y={120} width={36} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'taggun': return <g>
      <Pipes w={w} />
      <path d={`M${c - 30} 40 L${c + 20} 40 L${c + 20} 58 L${c - 8} 58 L${c - 14} 90 L${c - 30} 90Z`} fill={color} stroke={INK} strokeWidth={2.8} strokeLinejoin="round" />
      <rect x={c + 20} y={44} width={14} height={8} fill="#6b7383" stroke={INK} strokeWidth={2} />
      <g className="gwb-tag"><path d={`M${c + 36} 34 l18 0 l6 8 l-6 8 l-18 0Z`} fill="#fff8e6" stroke={INK} strokeWidth={2} /><text x={c + 46} y={46} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={11} fill={INK}>'s</text></g>
    </g>;
    case 'inflator': {
      const er = word === 'er';
      return <g>
        <Pipes w={w} />
        <rect x={c - 34} y={60} width={14} height={60} fill="#6b7383" stroke={INK} strokeWidth={2} /><rect x={c - 40} y={56} width={26} height={6} fill="#8f98a8" stroke={INK} strokeWidth={2} />
        <path d={`M${c - 27} 62 Q${c - 10} 30 ${c + 4} 40`} fill="none" stroke="#3c455e" strokeWidth={3} />
        <g className="gwb-inflate" style={{ transformOrigin: `${c + 18}px 56px` }}><ellipse cx={c + 18} cy={40} rx={er ? 14 : 22} ry={er ? 17 : 26} fill={color} stroke={INK} strokeWidth={2.4} /><ellipse cx={c + 12} cy={32} rx={4} ry={6} fill="#fff" opacity={0.5} /></g>
        <text x={c + 18} y={er ? 46 : 48} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={er ? 12 : 15} fill="#fff">-{er ? 'er' : 'est'}</text>
      </g>;
    }
    case 'seesaw': return <g>
      <Pipes w={w} />
      <path d={`M${c - 14} 122 L${c} 92 L${c + 14} 122Z`} fill="#8f98a8" stroke={INK} strokeWidth={2.4} />
      <g className="gwb-tilt" style={{ transformOrigin: `${c}px 92px` }}><rect x={10} y={86} width={w - 20} height={8} rx={3} fill={color} stroke={INK} strokeWidth={2.4} transform={`rotate(-10 ${c} 92)`} />
        <rect x={16} y={60} width={26} height={26} rx={4} fill="#f3cf6b" stroke={INK} strokeWidth={2} transform={`rotate(-10 ${c} 92)`} /><text x={29} y={78} textAnchor="middle" fontSize={10} fontWeight={900} fontFamily="Lexend, sans-serif" transform={`rotate(-10 ${c} 92)`}>why</text></g>
    </g>;
    case 'bubble': return <g>
      <Pipes w={w} />
      <rect x={c - 30} y={84} width={18} height={36} fill="#8b5a2b" stroke={INK} strokeWidth={2} />
      <path d={`M${c - 21} 84 L${c - 10} 66`} stroke="#8b5a2b" strokeWidth={6} />
      <g className="gwb-float"><path d={`M${c - 10} 14 h56 a10 10 0 0 1 10 10 v26 a10 10 0 0 1 -10 10 h-36 l-12 12 l2 -12 h-10 a10 10 0 0 1 -10 -10 v-26 a10 10 0 0 1 10 -10z`} fill="#fff" stroke={INK} strokeWidth={2.4} />
        <text x={c + 18} y={44} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={20} fill={color}>" "</text></g>
    </g>;
    case 'crate': return <g>
      <Pipes w={w} />
      <g className="gwb-lid" style={{ transformOrigin: `${c - 34}px 30px` }}><rect x={c - 36} y={24} width={72} height={10} rx={2} fill={light} stroke={INK} strokeWidth={2.4} /></g>
      <rect x={c - 34} y={34} width={68} height={60} rx={3} fill={color} stroke={INK} strokeWidth={2.8} />
      <line x1={c - 34} y1={34} x2={c + 34} y2={94} stroke={dark} strokeWidth={3} /><line x1={c + 34} y1={34} x2={c - 34} y2={94} stroke={dark} strokeWidth={3} />
      <text x={c} y={74} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={30} fill="#f3cf6b" stroke={INK} strokeWidth={1.2}>?</text>
      <rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'megaphone': return <g>
      <Pipes w={w} />
      <g className="gwb-honk" style={{ transformOrigin: `${c - 20}px 56px` }}><path d={`M${c - 30} 46 L${c + 20} 26 L${c + 20} 86 L${c - 30} 66Z`} fill={color} stroke={INK} strokeWidth={3} strokeLinejoin="round" /><rect x={c - 40} y={46} width={12} height={20} rx={3} fill="#3c455e" stroke={INK} strokeWidth={2} /></g>
      {[0, 1, 2].map((i) => <path key={i} className="gwb-echo" d={`M${c + 28 + i * 9} ${40 - i * 4} q 8 16 0 32`} fill="none" stroke={INK} strokeWidth={2.4} style={{ animationDelay: `${i * 0.12}s` }} />)}
      <rect x={c - 5} y={90} width={10} height={32} fill="#6b7383" stroke={INK} strokeWidth={2} /><rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'toaster': return <g>
      <Pipes w={w} />
      <rect x={c - 36} y={46} width={72} height={58} rx={14} fill={color} stroke={INK} strokeWidth={3} />
      <rect x={c - 24} y={42} width={18} height={8} rx={2} fill="#3c455e" /><rect x={c + 6} y={42} width={18} height={8} rx={2} fill="#3c455e" />
      <g className="gwb-toast"><rect x={c - 23} y={22} width={16} height={24} rx={4} fill="#e0b070" stroke={INK} strokeWidth={2} /><rect x={c + 7} y={22} width={16} height={24} rx={4} fill="#c8894a" stroke={INK} strokeWidth={2} /></g>
      <text x={c} y={84} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={8.5} fill={INK}>past·present·future</text>
      <rect x={c + 36} y={64} width={8} height={14} rx={2} fill="#e8483b" stroke={INK} strokeWidth={1.6} />
      <rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'cannon': return <g>
      <Pipes w={w} />
      <g className="gwb-recoil"><path d={`M${c - 40} 50 L${c + 30} 34 L${c + 34} 58 L${c - 36} 72Z`} fill={color} stroke={INK} strokeWidth={3} strokeLinejoin="round" /><ellipse cx={c + 32} cy={46} rx={6} ry={12} fill="#111" stroke={INK} strokeWidth={2} /></g>
      <circle cx={c - 10} cy={88} r={18} fill="#8b5a2b" stroke={INK} strokeWidth={3} /><circle cx={c - 10} cy={88} r={5} fill={INK} />
      {[0, 60, 120, 180, 240, 300].map((a) => <line key={a} x1={c - 10} y1={88} x2={c - 10} y2={72} stroke={INK} strokeWidth={2} transform={`rotate(${a} ${c - 10} 88)`} />)}
    </g>;
    case 'slots': return <g>
      <Pipes w={w} />
      <rect x={c - 40} y={22} width={80} height={86} rx={10} fill={color} stroke={INK} strokeWidth={3} />
      <rect x={c - 32} y={36} width={64} height={30} rx={4} fill="#fff" stroke={INK} strokeWidth={2} />
      {[0, 1, 2].map((i) => <text key={i} className="gwb-reelspin" x={c - 21 + i * 21} y={57} textAnchor="middle" fontSize={15} style={{ animationDelay: `${i * 0.1}s` }}>{['🐸', '⚡', '🍕'][i]}</text>)}
      <line x1={c + 40} y1={64} x2={c + 50} y2={30} stroke="#c8ced8" strokeWidth={4} /><circle cx={c + 50} cy={28} r={6} fill="#e8483b" stroke={INK} strokeWidth={2} />
      <text x={c} y={88} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={11} fill={INK}>SPIN</text>
      <rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'gate': {
      const wd = (word ?? '').toLowerCase();
      const pipe = wd === 'because' ? '#f3cf6b' : wd === 'but' ? '#e8483b' : wd === 'so' ? '#3fbf5a' : '#c8ced8';
      return <g>
        <Pipes w={w} />
        <rect x={c - 40} y={20} width={80} height={56} rx={8} fill={color} stroke={INK} strokeWidth={3} />
        <g className="gwb-swing" style={{ transformOrigin: `${c}px 48px` }}><rect x={c - 4} y={24} width={8} height={48} rx={3} fill="#fff" stroke={INK} strokeWidth={2} transform={`rotate(${wd === 'because' ? -35 : wd === 'so' ? 35 : 0} ${c} 48)`} /></g>
        {[['why', -26, '#f3cf6b'], ['but', 0, '#e8483b'], ['so', 26, '#3fbf5a']].map(([t, dx, col]) => <g key={t as string}><circle cx={c + (dx as number)} cy={92} r={8} fill={pipe === col ? (col as string) : '#3c455e'} stroke={INK} strokeWidth={2} /><text x={c + (dx as number)} y={110} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={800} fontSize={9} fill={INK}>{t as string}</text></g>)}
      </g>;
    }
    case 'clamp': {
      // status: "<tabs>|<auto|glow|plain>". Tab 1 is the comma before the fact, tab 2 the one after.
      const [t, mode] = (status ?? '0|plain').split('|');
      const tabs = Number(t) || 0;
      const fact = (word ?? '?').length > 20 ? `${(word ?? '').slice(0, 19)}…` : (word ?? '?');
      const tab = (x: number, bit: number) => {
        const on = mode === 'auto' || (tabs & bit) === bit;
        return <g key={bit} className={!on && mode === 'glow' ? 'gwb-tab-glow' : undefined}>
          <rect x={x - 11} y={44} width={22} height={34} rx={5} fill={on ? '#fff8e6' : 'none'} stroke={on ? INK : '#8f98a8'} strokeWidth={on ? 2.2 : 2} strokeDasharray={on ? undefined : '4 3'} />
          {on && <text x={x} y={72} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={30} fill={INK}>,</text>}
        </g>;
      };
      return <g>
        <Pipes w={w} />
        <path d={`M24 18 H${w - 24} V100 H24 V86 H${w - 38} V32 H24Z`} fill={color} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
        <g className="gwb-swing" style={{ transformOrigin: `${c}px 18px` }}><rect x={c - 3} y={2} width={6} height={22} fill="#8f98a8" stroke={INK} strokeWidth={1.6} /><rect x={c - 16} y={0} width={32} height={6} rx={3} fill={light} stroke={INK} strokeWidth={1.6} /></g>
        <rect x={34} y={44} width={w - 76} height={34} rx={6} fill="#fff" stroke={INK} strokeWidth={2} />
        <text x={34 + (w - 76) / 2} y={66} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={800} fontSize={11} fill={INK}>{fact}</text>
        {tab(14, 1)}{tab(w - 14, 2)}
        <rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
      </g>;
    }
    case 'flip': return <g>
      <Pipes w={w} />
      <rect x={c - 30} y={30} width={60} height={60} rx={10} fill={color} stroke={INK} strokeWidth={3} />
      <g className="gwb-spin" style={{ transformOrigin: `${c}px 60px` }}><path d={`M${c - 16} 52 a16 16 0 0 1 30 -4 l4 -8 l2 14 l-14 -2 l6 -3 a10 10 0 0 0 -20 3z`} fill="#fff" stroke={INK} strokeWidth={1.6} /><path d={`M${c + 16} 68 a16 16 0 0 1 -30 4 l-4 8 l-2 -14 l14 2 l-6 3 a10 10 0 0 0 20 -3z`} fill="#fff" stroke={INK} strokeWidth={1.6} /></g>
      <rect x={c - 5} y={90} width={10} height={32} fill="#6b7383" stroke={INK} strokeWidth={2} /><rect x={c - 24} y={120} width={48} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    </g>;
    case 'equals': return <g>
      <Pipes w={w} />
      <path d={`M${c - 6} 122 L${c} 70 L${c + 6} 122Z`} fill="#8f98a8" stroke={INK} strokeWidth={2} />
      <g className="gwb-tilt" style={{ transformOrigin: `${c}px 70px` }}><rect x={c - 46} y={66} width={92} height={7} rx={3} fill={color} stroke={INK} strokeWidth={2} />
        <path d={`M${c - 44} 66 l-8 -22 h28 l-8 22`} fill="#fff8e6" stroke={INK} strokeWidth={1.6} /><path d={`M${c + 44} 66 l8 -22 h-28 l8 22`} fill="#fff8e6" stroke={INK} strokeWidth={1.6} /></g>
      <rect x={c - 18} y={18} width={36} height={30} rx={6} fill="#fff" stroke={INK} strokeWidth={2.4} />
      <text x={c} y={42} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={26} fill={color}>=</text>
    </g>;
    case 'command': return <g>
      <rect x={8} y={84} width={w - 16} height={22} rx={11} fill="#3c455e" stroke={INK} strokeWidth={2.4} />
      {Array.from({ length: Math.floor((w - 24) / 22) }, (_, i) => <g key={i} className="gwb-spin" style={{ transformOrigin: `${20 + i * 22}px 95px` }}><circle cx={20 + i * 22} cy={95} r={7} fill="#c8ced8" stroke={INK} strokeWidth={1.6} /></g>)}
      <rect x={c - 34} y={22} width={68} height={50} rx={8} fill={color} stroke={INK} strokeWidth={3} />
      <text x={c} y={45} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={13} fill="#fff">DO IT!</text>
      <text x={c} y={63} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={700} fontSize={9.5} fill="#fff">(you)</text>
      <rect x={20} y={106} width={8} height={18} fill="#6b7383" /><rect x={w - 28} y={106} width={8} height={18} fill="#6b7383" />
    </g>;
    case 'hypo': return <g>
      <Pipes w={w} />
      <rect x={c - 22} y={10} width={44} height={20} rx={4} fill="#c8ced8" stroke={INK} strokeWidth={2} />
      <path d={`M${c - 10} 30 L${c - 10} 50 L${c - 32} 100 Q${c} 116 ${c + 32} 100 L${c + 10} 50 L${c + 10} 30Z`} fill="#e9f3ff" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d={`M${c - 24} 86 Q${c} 96 ${c + 24} 86 L${c + 30} 100 Q${c} 114 ${c - 30} 100Z`} fill={color} />
      {[0, 1, 2].map((i) => <circle key={i} className="gwb-drop" cx={c - 8 + i * 8} cy={78 - i * 10} r={3 + i} fill="#fff" stroke={INK} strokeWidth={1} />)}
    </g>;
    case 'rig': {
      const lit = status ?? '000000';
      return <g>
        <Pipes w={w} />
        <rect x={8} y={14} width={w - 16} height={96} rx={10} fill={color} stroke={INK} strokeWidth={3} />
        {['who', 'what', 'when', 'where', 'why', 'how'].map((q, i) => { const x = 22 + (i % 3) * ((w - 44) / 2); const y = 38 + Math.floor(i / 3) * 40; const on = lit[i] === '1'; return <g key={q}><circle cx={x} cy={y} r={10} fill={on ? '#f3cf6b' : '#3c455e'} stroke={INK} strokeWidth={2} /><text x={x} y={y + 22} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={800} fontSize={10} fill="#fff">{q}</text></g>; })}
      </g>;
    }
    default: return null;
  }
}

export default function MachinePart({ kind, word, empty = false, scale = 1, status }: { kind: Kind; word: string | null; empty?: boolean; scale?: number; status?: string }) {
  const info = kindInfo(kind);
  const w = partWidth(kind, word);
  const H = PART_H;
  const base = info.color, dark = shade(base, -0.3), light = shade(base, 0.5);
  const svg = (children: React.ReactNode) => <svg width={w * scale} height={(H + 14) * scale} viewBox={`0 -14 ${w} ${H + 14}`} className="gwb-svg" aria-hidden>{children}</svg>;
  if (kind === 'blank') return svg(<>
    <rect x={6} y={10} width={w - 12} height={120} rx={14} fill="rgba(255,255,255,0.4)" stroke="#fff" strokeWidth={4} strokeDasharray="10 7" />
    <text x={w / 2} y={74} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={40} fill="#fff">+</text>
  </>);
  // The Proper Noun machine (teacher 2026-10-08): the Noun Boiler with a floating golden crown.
  if (kind === 'proper') {
    const size = BODY.N;
    const top = PIPE_Y - size * 0.58;
    const cx = w / 2;
    return svg(<>
      <Pipes w={w} />
      <Stand w={w} top={top + size * 0.8} />
      <PartSvg pos="N" word={word} ghost={empty} box={{ x: (w - size) / 2, y: top, w: size, h: size }} />
      <g className="gwb-crown"><path d={`M${cx - 15} ${8} L${cx - 18} ${-9} L${cx - 8} ${-1} L${cx} ${-13} L${cx + 8} ${-1} L${cx + 18} ${-9} L${cx + 15} ${8} Z`} fill="#f5c331" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
        <rect x={cx - 15} y={3} width={30} height={5} fill="#e0a020" stroke={INK} strokeWidth={1.6} />
        <circle cx={cx} cy={-13} r={2.6} fill="#e8483b" stroke={INK} strokeWidth={1.2} /><circle cx={cx - 18} cy={-9} r={2.2} fill="#5bc0eb" stroke={INK} strokeWidth={1.2} /><circle cx={cx + 18} cy={-9} r={2.2} fill="#5bc0eb" stroke={INK} strokeWidth={1.2} /></g>
      <Gear x={13} y={PIPE_Y + 26} r={7} /><Gear x={w - 13} y={PIPE_Y + 26} r={7} rev />
      <Plate w={w} text={word ?? '?'} blank={empty} color={base} />
    </>);
  }
  if (isWordKind(kind)) {
    const size = BODY[kind];
    const top = PIPE_Y - size * 0.58;
    return svg(<>
      <Pipes w={w} />
      <Stand w={w} top={top + size * 0.8} />
      <PartSvg pos={kind} word={word} ghost={empty} box={{ x: (w - size) / 2, y: top, w: size, h: size }} />
      <Gear x={13} y={PIPE_Y + 26} r={7} /><Gear x={w - 13} y={PIPE_Y + 26} r={7} rev />
      <Plate w={w} text={word ?? '?'} blank={empty} color={base} />
      {kind === 'N' && word && nounByWord.get(word) && <text x={w - 14} y={134} textAnchor="end" fontSize={15}>{nounByWord.get(word)!.emoji}</text>}
    </>);
  }
  if (kind === 'tv') return svg(<>
    <rect x={0} y={PIPE_Y - 7} width={14} height={14} fill="#c98a4b" stroke={INK} strokeWidth={2.2} />
    <line x1={w / 2 - 6} y1={6} x2={w / 2 - 28} y2={-12} stroke={INK} strokeWidth={3} /><line x1={w / 2 + 6} y1={6} x2={w / 2 + 30} y2={-10} stroke={INK} strokeWidth={3} />
    <circle cx={w / 2 - 28} cy={-12} r={3.5} fill="#e8483b" stroke={INK} strokeWidth={1.5} /><circle cx={w / 2 + 30} cy={-10} r={3.5} fill="#e8483b" stroke={INK} strokeWidth={1.5} />
    <rect x={8} y={6} width={w - 16} height={116} rx={14} fill={base} stroke={INK} strokeWidth={4} />
    <rect x={16} y={12} width={w - 32} height={100} rx={8} fill="#111" stroke={INK} strokeWidth={2} />
    <rect x={24} y={122} width={14} height={10} fill="#6b7383" stroke={INK} strokeWidth={2} /><rect x={w - 38} y={122} width={14} height={10} fill="#6b7383" stroke={INK} strokeWidth={2} />
    <Nut x={14} y={12} r={4} /><Nut x={w - 14} y={12} r={4} /><Nut x={14} y={116} r={4} /><Nut x={w - 14} y={116} r={4} />
  </>);
  if (kind === 'lever') return svg(<>
    <rect x={w - 14} y={PIPE_Y - 7} width={14} height={14} fill="#c98a4b" stroke={INK} strokeWidth={2.2} />
    <rect x={6} y={6} width={w - 18} height={124} rx={14} fill="#7f8ba0" stroke={INK} strokeWidth={4} />
    <rect x={12} y={10} width={w - 30} height={8} rx={4} fill="#fff" opacity={0.25} />
    <Nut x={16} y={16} r={4} /><Nut x={w - 22} y={16} r={4} /><Nut x={16} y={120} r={4} /><Nut x={w - 22} y={120} r={4} />
    <rect x={18} y={22} width={w - 42} height={70} rx={10} fill="#2c3348" stroke={INK} strokeWidth={2.4} />
    <line x1={(w - 6) / 2} y1={74} x2={(w - 6) / 2 - 12} y2={40} stroke="#c8ced8" strokeWidth={6} strokeLinecap="round" />
    <circle cx={(w - 6) / 2 - 12} cy={38} r={9} fill="#e8483b" stroke={INK} strokeWidth={2} />
    <text x={(w - 6) / 2} y={88} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={10} fill="#fff">START</text>
  </>);
  if (kind === 'clock') {
    // Past: the hands are wound back; present: straight up; future: wound forward.
    const t = word === 'past' ? 'past' : word === 'future' ? 'future' : 'present';
    const cx = w / 2, cy = 58;
    const minute = t === 'past' ? -90 : t === 'future' ? 90 : 0;
    const hour = t === 'past' ? -40 : t === 'future' ? 40 : 0;
    return svg(<>
      <Pipes w={w} />
      <Stand w={w} top={100} />
      <circle cx={cx} cy={cy} r={48} fill="#e6b54a" stroke={INK} strokeWidth={4} />
      <circle cx={cx} cy={cy} r={40} fill="#fff8e6" stroke={INK} strokeWidth={2.4} />
      {Array.from({ length: 12 }, (_, i) => <line key={i} x1={cx} y1={cy - 36} x2={cx} y2={cy - (i % 3 ? 32 : 28)} stroke={INK} strokeWidth={i % 3 ? 1.6 : 3} transform={`rotate(${i * 30} ${cx} ${cy})`} />)}
      {t !== 'present' && <path d={t === 'past' ? `M${cx + 22} ${cy - 30} A 36 36 0 0 0 ${cx - 30} ${cy - 20}` : `M${cx - 22} ${cy - 30} A 36 36 0 0 1 ${cx + 30} ${cy - 20}`} fill="none" stroke={t === 'past' ? '#8c6a3c' : '#3b7be8'} strokeWidth={3.5} strokeDasharray="5 4" />}
      <g className="gwb-hands" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - 22} stroke={INK} strokeWidth={5} strokeLinecap="round" transform={`rotate(${hour} ${cx} ${cy})`} />
        <line x1={cx} y1={cy} x2={cx} y2={cy - 32} stroke="#e8483b" strokeWidth={3} strokeLinecap="round" transform={`rotate(${minute} ${cx} ${cy})`} />
      </g>
      <circle cx={cx} cy={cy} r={4.5} fill={INK} />
      <rect x={cx - 6} y={4} width={12} height={8} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
      <rect x={cx - 30} y={cy + 14} width={60} height={15} rx={4} fill={t === 'past' ? '#8c6a3c' : t === 'future' ? '#3b7be8' : '#3fbf5a'} stroke={INK} strokeWidth={1.5} />
      <text x={cx} y={cy + 25.5} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={10} fill="#fff">{t.toUpperCase()}</text>
    </>);
  }
  if (kind === 'link') return svg(<>
    <Pipes w={w} />
    <rect x={w / 2 - 28} y={34} width={56} height={56} rx={10} fill={base} stroke={INK} strokeWidth={3} />
    <circle cx={w / 2} cy={54} r={13} fill={light} stroke={INK} strokeWidth={2.6} />
    <circle cx={w / 2} cy={54} r={4} fill={INK} />
    {Array.from({ length: 4 }, (_, i) => <ellipse key={i} cx={w / 2} cy={96 + i * 9} rx={i % 2 ? 3 : 6} ry={6} fill="none" stroke="#8f98a8" strokeWidth={3} />)}
    <path d={`M${w / 2} 128 q -10 4 -6 12 q 4 6 10 0`} fill="none" stroke="#8f98a8" strokeWidth={3.5} />
    <Nut x={w / 2 - 20} y={42} r={3.5} /><Nut x={w / 2 + 20} y={42} r={3.5} /><Nut x={w / 2 - 20} y={82} r={3.5} /><Nut x={w / 2 + 20} y={82} r={3.5} />
  </>);
  if (kind === 'cap' || kind === 'stop' || kind === 'bang' || kind === 'ask' || kind === 'comma') {
    const mark = kind === 'cap' ? 'Aa' : kind === 'stop' ? '.' : kind === 'bang' ? '!' : kind === 'ask' ? '?' : ',';
    return svg(<>
      <Pipes w={w} />
      {kind === 'cap' && <g>
        <rect x={w / 2 - 34} y={8} width={68} height={12} rx={3} fill="#6b7383" stroke={INK} strokeWidth={2.4} />
        <rect x={w / 2 - 34} y={18} width={8} height={104} fill="#6b7383" stroke={INK} strokeWidth={2} /><rect x={w / 2 + 26} y={18} width={8} height={104} fill="#6b7383" stroke={INK} strokeWidth={2} />
        <g className="gwb-piston"><rect x={w / 2 - 6} y={20} width={12} height={22} fill="#c8ced8" stroke={INK} strokeWidth={2} /><rect x={w / 2 - 22} y={40} width={44} height={22} rx={3} fill="#f3cf6b" stroke={INK} strokeWidth={2.6} />
          <text x={w / 2} y={57} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={16} fill={INK}>A</text></g>
        <rect x={w / 2 - 26} y={94} width={52} height={14} rx={3} fill={base} stroke={INK} strokeWidth={2.4} />
      </g>}
      {(kind === 'stop' || kind === 'bang' || kind === 'ask') && <g>
        <rect x={w / 2 - 5} y={6} width={10} height={30} fill="#8b5a2b" stroke={INK} strokeWidth={2} /><ellipse cx={w / 2} cy={8} rx={11} ry={6} fill="#a0703c" stroke={INK} strokeWidth={2} />
        <g className="gwb-piston"><rect x={w / 2 - 26} y={36} width={52} height={50} rx={10} fill={base} stroke={INK} strokeWidth={3} />
          <text x={w / 2} y={kind === 'stop' ? 74 : 76} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={kind === 'stop' ? 48 : 38} fill={INK}>{mark}</text></g>
        <Stand w={w} top={86} />
      </g>}
      {kind === 'comma' && <g>
        <path d={`M${w / 2 - 16} 96 L${w / 2 - 16} 40 Q${w / 2 - 16} 20 ${w / 2} 20 Q${w / 2 + 16} 20 ${w / 2 + 16} 40 L${w / 2 + 16} 96`} fill="none" stroke={INK} strokeWidth={10} />
        <path d={`M${w / 2 - 16} 96 L${w / 2 - 16} 40 Q${w / 2 - 16} 20 ${w / 2} 20 Q${w / 2 + 16} 20 ${w / 2 + 16} 40 L${w / 2 + 16} 96`} fill="none" stroke={base} strokeWidth={5} />
        <text x={w / 2} y={60} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={30} fill={INK}>,</text>
      </g>}
    </>);
  }
  // A fun part that holds a word shows it on a tag in that word's grammar
  // color (? until picked). Parts with no word get no tag.
  const wp = wordPosOf(kind);
  return svg(<><Contraption kind={kind} w={w} color={base} word={word} status={status} />{wp && <Plate w={w} text={word ?? '?'} y={140} blank={!word} color={kindInfo(wp).color} />}{void dark}{void light}</>);
}
