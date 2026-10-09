import { useMemo } from 'react';
import { PERIODIC } from './elements';

// Atom Builder in the Science Lab (Build Queue 2026-10-09, from her link to PhET "Build an Atom"):
// add and take away protons, neutrons and electrons. The number of protons decides the element, the
// electrons decide the charge, and protons plus neutrons are the mass number. Real stable isotopes for
// the first 20 elements say whether the nucleus is stable. Every element built lights up on the
// periodic table board. iPad first: big + and - buttons, nothing to drag.

// Neutron counts of the stable isotopes, hydrogen to calcium.
const STABLE: number[][] = [[0, 1], [1, 2], [3, 4], [5], [5, 6], [6, 7], [7, 8], [8, 9, 10], [10], [10, 11, 12], [12], [12, 13, 14], [14], [14, 15, 16], [16], [16, 17, 18, 20], [18, 20], [18, 20, 22], [20, 22], [20, 22, 23, 24, 26, 28]];
const SHELLS = [2, 8, 8, 18];
export const ATOM_MAX = { p: 20, n: 28, e: 20 };
export function atomInfo(p: number, n: number, e: number) {
  const el = p > 0 ? PERIODIC[p - 1] : null;
  const charge = p - e;
  const stable = p > 0 && p <= 20 ? STABLE[p - 1].includes(n) : null;
  return { el, charge, mass: p + n, stable };
}

export default function AtomBuilder({ p, n, e, onChange, magic }: { p: number; n: number; e: number; onChange: (p: number, n: number, e: number) => void; magic: boolean }) {
  const { el, charge, mass, stable } = atomInfo(p, n, e);
  // Nucleus: protons and neutrons packed in a little spiral.
  const nucleons = useMemo(() => {
    const list = [...Array(p).fill('p'), ...Array(n).fill('n')].map((k, i) => ({ k, i }));
    // Mix them so the nucleus looks like a real ball of both.
    list.sort((a, b) => ((a.i * 7919) % 13) - ((b.i * 7919) % 13));
    return list.map((x, i) => { const r = 3.2 * Math.sqrt(i), a = i * 2.4; return { k: x.k, x: 100 + r * Math.cos(a), y: 100 + r * Math.sin(a) }; });
  }, [p, n]);
  const electrons: { x: number; y: number; s: number }[] = [];
  let left = e;
  SHELLS.forEach((cap, s) => {
    const here = Math.min(cap, left); left -= here;
    const R = 38 + s * 18;
    for (let i = 0; i < here; i++) { const a = (i / here) * Math.PI * 2 - Math.PI / 2; electrons.push({ x: 100 + R * Math.cos(a), y: 100 + R * Math.sin(a), s }); }
  });
  const ink = magic ? '#e9d8ff' : '#24406b';
  const btn = (label: string, on: () => void, disabled: boolean, aria: string) => <button type="button" className="lab-btn atom-pm" onClick={on} disabled={disabled} aria-label={aria}>{label}</button>;
  const row = (name: string, color: string, val: number, max: number, set: (v: number) => void) => (
    <div className="atom-row">
      <span className="atom-dot" style={{ background: color }} aria-hidden />
      <strong>{name}</strong>
      {btn('－', () => set(val - 1), val <= 0, `Take away a ${name.toLowerCase().replace(/s$/, '')}`)}
      <b className="atom-count">{val}</b>
      {btn('＋', () => set(val + 1), val >= max, `Add a ${name.toLowerCase().replace(/s$/, '')}`)}
    </div>
  );
  return (
    <div className="atom">
      <svg viewBox="0 0 200 200" className="atom-svg" role="img" aria-label={el ? `An atom of ${el.name}` : 'An empty atom'}>
        {SHELLS.map((_, s) => <circle key={s} cx="100" cy="100" r={38 + s * 18} fill="none" stroke={ink} strokeWidth="1" strokeDasharray="3 3" opacity={0.5} />)}
        <g className="atom-spin">{electrons.map((x, i) => <circle key={i} cx={x.x} cy={x.y} r="4.5" fill="#3b7be8" stroke="#fff" strokeWidth="1" />)}</g>
        {nucleons.map((x, i) => <circle key={i} cx={x.x} cy={x.y} r="4.6" fill={x.k === 'p' ? '#e8483b' : '#9aa3ad'} stroke={ink} strokeWidth="0.6" />)}
        {!p && !n && <text x="100" y="104" textAnchor="middle" fontSize="9" fill={ink}>Add a proton</text>}
      </svg>
      <div className="atom-side">
        {row('Protons', '#e8483b', p, ATOM_MAX.p, (v) => onChange(v, n, e))}
        {row('Neutrons', '#9aa3ad', n, ATOM_MAX.n, (v) => onChange(p, v, e))}
        {row('Electrons', '#3b7be8', e, ATOM_MAX.e, (v) => onChange(p, n, v))}
        <div className="atom-card">
          {el ? <>
            <div className="atom-el"><small>{el.n}</small><b>{el.sym}</b><span>{el.name}</span></div>
            <p><strong>Element:</strong> {el.name}, because it has {p} proton{p === 1 ? '' : 's'}.</p>
            <p><strong>Charge:</strong> {charge === 0 ? '0, a neutral atom (protons and electrons are equal)' : `${charge > 0 ? '+' : ''}${charge}, an ion (${charge > 0 ? 'fewer electrons than protons' : 'more electrons than protons'})`}</p>
            <p><strong>Mass number:</strong> {mass} ({p} protons + {n} neutrons)</p>
            {stable !== null && <p><strong>Nucleus:</strong> {stable ? `✅ stable. ${el.name}-${mass} is real and lasts.` : `⚠️ unstable. Try ${STABLE[p - 1].map((k) => k).join(' or ')} neutron${STABLE[p - 1].length === 1 && STABLE[p - 1][0] === 1 ? '' : 's'}.`}</p>}
          </> : <p>An atom needs protons. The number of protons decides which element it is.</p>}
        </div>
      </div>
    </div>
  );
}
