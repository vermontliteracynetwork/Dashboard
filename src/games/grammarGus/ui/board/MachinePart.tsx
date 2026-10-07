import type { Kind } from './parts';
import { kindInfo, PART_H, partWidth, isWordKind, needsWord, BODY } from './parts';
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
    <rect x={0} y={PIPE_Y - 7} width={w} height={14} fill="#c98a4b" stroke={INK} strokeWidth={2.2} />
    <rect x={0} y={PIPE_Y - 7} width={w} height={4} fill="#e7b07a" />
    <rect x={2} y={PIPE_Y - 12} width={7} height={24} rx={1.5} fill="#e7b07a" stroke={INK} strokeWidth={2} />
    <rect x={w - 9} y={PIPE_Y - 12} width={7} height={24} rx={1.5} fill="#e7b07a" stroke={INK} strokeWidth={2} />
    <Nut x={5.5} y={PIPE_Y - 8} r={3} /><Nut x={5.5} y={PIPE_Y + 8} r={3} /><Nut x={w - 5.5} y={PIPE_Y - 8} r={3} /><Nut x={w - 5.5} y={PIPE_Y + 8} r={3} />
  </g>;
}
function Plate({ w, text, y = 138, blank = false }: { w: number; text: string; y?: number; blank?: boolean }) {
  const pw = Math.min(w - 8, Math.max(46, text.length * 10.5 + 24));
  const x = (w - pw) / 2;
  return <g>
    <line x1={x + 10} y1={y} x2={x + 10} y2={y - 10} stroke={INK} strokeWidth={2} /><line x1={x + pw - 10} y1={y} x2={x + pw - 10} y2={y - 10} stroke={INK} strokeWidth={2} />
    <rect x={x} y={y} width={pw} height={28} rx={6} fill={blank ? '#fff' : '#f3d27a'} stroke={INK} strokeWidth={2.6} strokeDasharray={blank ? '6 4' : undefined} />
    <circle cx={x + 6} cy={y + 14} r={2} fill={INK} /><circle cx={x + pw - 6} cy={y + 14} r={2} fill={INK} />
    <text x={w / 2} y={y + 20} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={800} fontSize={text.length > 14 ? 13 : 17} fill={INK}>{text}</text>
  </g>;
}
// A little cog on every stand: it whirs while the machine runs.
function Gear({ x, y, r = 10, color = '#c8ced8', rev = false }: { x: number; y: number; r?: number; color?: string; rev?: boolean }) {
  const teeth = Array.from({ length: 8 }, (_, i) => { const a = (Math.PI / 4) * i; return <rect key={i} x={x - 2.5} y={y - r - 4} width={5} height={6} rx={1} fill={color} stroke={INK} strokeWidth={1.4} transform={`rotate(${(a * 180) / Math.PI} ${x} ${y})`} />; });
  return <g className={`gwb-gear${rev ? ' rev' : ''}`} style={{ transformOrigin: `${x}px ${y}px` }}>{teeth}<circle cx={x} cy={y} r={r} fill={color} stroke={INK} strokeWidth={2} /><circle cx={x} cy={y} r={r * 0.35} fill="#7d8796" stroke={INK} strokeWidth={1.4} /></g>;
}
function Stand({ w, top }: { w: number; top: number }) {
  return <g>
    <rect x={w / 2 - 5} y={top} width={10} height={Math.max(0, 124 - top)} fill="#6b7383" stroke={INK} strokeWidth={2} />
    <rect x={w / 2 - 22} y={122} width={44} height={6} rx={2} fill="#8f98a8" stroke={INK} strokeWidth={2} />
    <Nut x={w / 2 - 14} y={125} r={2.6} /><Nut x={w / 2 + 14} y={125} r={2.6} />
  </g>;
}

function Contraption({ kind, w, color }: { kind: Kind; w: number; color: string }) {
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
    default: return null;
  }
}

export default function MachinePart({ kind, word, empty = false, scale = 1 }: { kind: Kind; word: string | null; empty?: boolean; scale?: number }) {
  const info = kindInfo(kind);
  const w = partWidth(kind, word);
  const H = PART_H;
  const base = info.color, dark = shade(base, -0.3), light = shade(base, 0.5);
  const svg = (children: React.ReactNode) => <svg width={w * scale} height={(H + 14) * scale} viewBox={`0 -14 ${w} ${H + 14}`} className="gwb-svg" aria-hidden>{children}</svg>;
  if (kind === 'blank') return svg(<>
    <rect x={6} y={10} width={w - 12} height={120} rx={14} fill="rgba(255,255,255,0.4)" stroke="#fff" strokeWidth={4} strokeDasharray="10 7" />
    <text x={w / 2} y={74} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={40} fill="#fff">+</text>
    <Plate w={w} text="blank" blank />
  </>);
  if (isWordKind(kind)) {
    const size = BODY[kind];
    const top = PIPE_Y - size * 0.58;
    return svg(<>
      <Pipes w={w} />
      <Stand w={w} top={top + size * 0.8} />
      <PartSvg pos={kind} word={word} ghost={empty} box={{ x: (w - size) / 2, y: top, w: size, h: size }} />
      <Gear x={13} y={PIPE_Y + 26} r={7} /><Gear x={w - 13} y={PIPE_Y + 26} r={7} rev />
      <Plate w={w} text={word ?? '?'} blank={empty} />
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
    <Plate w={w} text="Pixel TV" y={140} />
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
      <Plate w={w} text={t} />
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
    <Plate w={w} text="paragraph" />
  </>);
  if (kind === 'cap' || kind === 'stop' || kind === 'bang' || kind === 'comma') {
    const mark = kind === 'cap' ? 'Aa' : kind === 'stop' ? '.' : kind === 'bang' ? '!' : ',';
    return svg(<>
      <Pipes w={w} />
      {kind === 'cap' && <g>
        <rect x={w / 2 - 34} y={8} width={68} height={12} rx={3} fill="#6b7383" stroke={INK} strokeWidth={2.4} />
        <rect x={w / 2 - 34} y={18} width={8} height={104} fill="#6b7383" stroke={INK} strokeWidth={2} /><rect x={w / 2 + 26} y={18} width={8} height={104} fill="#6b7383" stroke={INK} strokeWidth={2} />
        <g className="gwb-piston"><rect x={w / 2 - 6} y={20} width={12} height={22} fill="#c8ced8" stroke={INK} strokeWidth={2} /><rect x={w / 2 - 22} y={40} width={44} height={22} rx={3} fill="#f3cf6b" stroke={INK} strokeWidth={2.6} />
          <text x={w / 2} y={57} textAnchor="middle" fontFamily="Lexend, sans-serif" fontWeight={900} fontSize={16} fill={INK}>A</text></g>
        <rect x={w / 2 - 26} y={94} width={52} height={14} rx={3} fill={base} stroke={INK} strokeWidth={2.4} />
      </g>}
      {(kind === 'stop' || kind === 'bang') && <g>
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
      <Plate w={w} text={kind === 'cap' ? 'capital' : kind === 'stop' ? 'period' : kind === 'bang' ? 'exclaim' : 'comma'} />
    </>);
  }
  // A fun part that holds a word shows it on its plate (? until picked).
  const plate = needsWord(kind) ? (word ?? (empty ? '?' : info.name.toLowerCase())) : info.name.toLowerCase();
  return svg(<><Contraption kind={kind} w={w} color={base} /><Plate w={w} text={plate} y={140} blank={needsWord(kind) && empty} />{void dark}{void light}</>);
}
