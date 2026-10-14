import { useState, type ReactNode } from 'react';
import { snSound } from '../../lib/supernature';
import { PERIODIC, FAMILIES, ELEMENT_USES, elementBySym } from '../../games/scienceLab/elements';
import { ELEM, ELEMENTS, REACTIONS, isLabMade, isRadioactive, potionsWith, reactionsOf, stateOf, type Elem } from '../../lib/supernatureAlchemy';
import { Icon } from './SupernatureWriting';

// The periodic table, the element card and the Element Book (Build Queue 177, her words 2026-10-14: "make sure full
// table of elements view is collapsable and that they can click elemnts with in periodic table view. give the element
// name, the magical recongizable name, and the chemical mixing formula on click views. ensure not too much text is show
// at once. allow students to view an enclyapdia like book of all elemements, their features, how they interact with
// potions in the game, and their real life role").
const LISTEN = 'M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8';
const STATE_ICON: Record<string, string> = { gas: '💨 Gas', liquid: '💧 Liquid', solid: '🪨 Solid' };
const fam = (sym: string) => { const p = elementBySym.get(sym); return p ? FAMILIES[p.family] : null; };
const realOf = (e: Elem) => ELEMENT_USES[e.id] ?? e.real;
const nameIn = (id: string) => ELEM.get(id)?.magic ?? id;
const reactionsWith = (id: string) => REACTIONS.filter((r) => r.needs.includes(id));

export function PeriodicTable({ sel, onPick, children }: { sel: string | null; onPick: (sym: string) => void; children?: ReactNode }) {
  return (
    <div className="el-table" role="grid" aria-label="Periodic table">
      {PERIODIC.map((p) => (
        <button key={p.sym} type="button" className={`el-cell${sel === p.sym ? ' on' : ''}${isRadioactive(p.sym) ? ' hot' : ''}`} style={{ gridColumn: p.col, gridRow: p.row > 7 ? p.row : p.row, background: FAMILIES[p.family].color }}
          onClick={() => { snSound('tap'); onPick(p.sym); }} aria-label={`${p.name}, ${ELEM.get(p.sym)?.magic ?? ''}`} aria-pressed={sel === p.sym}>
          <img src={ELEM.get(p.sym)?.img} alt="" /><b>{p.sym}</b>
        </button>
      ))}
      {children && <div className="el-gap">{children}</div>}
    </div>
  );
}

// What shows when an element is tapped: its name, its magic name and its mixing formula. Short on purpose.
export function ElementInfo({ id, say, onAdd, onBook }: { id: string; say: (t: string) => void; onAdd?: (id: string) => void; onBook?: (id: string) => void }) {
  const e = ELEM.get(id); if (!e) return null;
  const uses = potionsWith(id);
  const mix = uses[0] ? `${uses[0].name} = ${uses[0].formula}` : reactionsOf(id)[0] ?? 'Not in a recipe yet. Try it in a free experiment!';
  const text = `${e.name}, ${e.magic}. Formula: ${e.sym}. ${mix}`;
  return (
    <div className="el-info">
      <img src={e.img} alt="" />
      <div className="el-info-text">
        <b className="el-info-name">{e.name} <span>{e.sym}</span></b>
        <em>✨ {e.magic}</em>
        <small>{mix}{uses.length > 1 ? ` (+${uses.length - 1} more)` : ''}</small>
      </div>
      <div className="el-info-btns">
        <button type="button" className="sn-listen" onClick={() => say(text)} aria-label="Listen"><Icon d={LISTEN} /></button>
        {onAdd && <button type="button" className="sn-btn2 small go" onClick={() => onAdd(id)}>➕ Pot</button>}
        {onBook && <button type="button" className="sn-btn2 small" onClick={() => onBook(id)}>📖 Book</button>}
      </div>
    </div>
  );
}

// The Element Book: one element per spread. Left page is what it is; right page is what it does in potions and in real life.
export function ElementBook({ say, start, found, onAdd, onClose }: { say: (t: string) => void; start?: string; found: string[]; onAdd?: (id: string) => void; onClose?: () => void }) {
  const [i, setI] = useState(() => Math.max(0, ELEMENTS.findIndex((e) => e.id === start)));
  const [toc, setToc] = useState(!start);
  const e = ELEMENTS[i];
  const f = fam(e.id);
  const uses = potionsWith(e.id).slice(0, 3);
  const rx = reactionsWith(e.id);
  const turn = (d: number) => { snSound('page'); setI((x) => (x + d + ELEMENTS.length) % ELEMENTS.length); };
  const pageText = `${e.name}, the ${e.magic}. ${f ? f.name : 'Kitchen chemical'}, a ${stateOf(e.id)}. ${uses.length ? `In potions: ${uses.map((u) => `${u.name} is ${u.formula}`).join('. ')}.` : 'No potion recipe uses it yet.'} Real life: ${realOf(e)}`;
  return (
    <div className="el-book">
      <div className="el-book-top">
        <button type="button" className={`sn-btn2 small${toc ? ' go' : ''}`} onClick={() => { snSound('page'); setToc(!toc); }}>{toc ? '📖 Open the page' : '▦ All elements'}</button>
        <b className="el-book-title">📖 Element Book</b>
        {onClose && <button type="button" className="sn-btn2 small" onClick={onClose}>✕ Close</button>}
      </div>
      {toc ? (
        <div className="el-book-toc">
          <PeriodicTable sel={e.id} onPick={(sym) => { setI(ELEMENTS.findIndex((x) => x.id === sym)); setToc(false); }}>
            <p className="el-toc-hint">Tap any element to open its page.</p>
          </PeriodicTable>
          <div className="el-kitchen">{ELEMENTS.filter((x) => !x.n).map((x) => <button key={x.id} type="button" className="el-kbtn" onClick={() => { snSound('tap'); setI(ELEMENTS.indexOf(x)); setToc(false); }}><img src={x.img} alt="" />{x.name}</button>)}</div>
        </div>
      ) : (
        <div className="el-spread">
          <section className="el-page left">
            <img src={e.img} alt="" className="el-big" />
            <h2>{e.name} <span>{e.sym}</span></h2>
            <p className="el-magic">✨ {e.magic}</p>
            <div className="el-chips">
              {e.n && <span>#{e.n}</span>}
              <span style={{ background: f?.color }}>{f ? f.name : 'Kitchen chemical'}</span>
              <span>{STATE_ICON[stateOf(e.id)]}</span>
              {isLabMade(e.id) && <span>🔬 Made in a lab</span>}
              {isRadioactive(e.id) && <span>☢️ Radioactive</span>}
            </div>
          </section>
          <section className="el-page right">
            <div className="el-sec"><b>🧪 In potions</b>
              {uses.length ? uses.map((u) => <p key={u.name}><strong>{u.name}</strong>{u.role === 'key' ? ' (key)' : ''}: {u.formula}</p>) : <p>No recipe uses it yet. Try it in a free experiment!</p>}
            </div>
            <div className="el-sec"><b>⚗️ Reactions</b>
              {rx.length ? rx.slice(0, 3).map((r) => found.includes(r.id)
                ? <p key={r.id}><strong>{r.magic.name}</strong>: {r.equation}</p>
                : <p key={r.id} className="el-guess">❓ {r.needs.filter((n) => n !== e.id && n !== 'heat').length ? `${nameIn(e.id)} + ???` : 'Heat it and see'}. Guess and check!</p>)
                : <p>{reactionsOf(e.id)[0] ?? 'Calm. No wild reactions in the pot.'}</p>}
            </div>
            <div className="el-sec"><b>🌍 Real life</b><p>{realOf(e)}</p></div>
            <div className="el-row">
              <button type="button" className="sn-listen" onClick={() => say(pageText)} aria-label="Read the page aloud"><Icon d={LISTEN} /></button>
              {onAdd && !isRadioactive(e.id) && <button type="button" className="sn-btn2 small go" onClick={() => onAdd(e.id)}>➕ Put in the pot</button>}
            </div>
          </section>
          <button type="button" className="el-turn prev" onClick={() => turn(-1)} aria-label="Previous element"><Icon d="M15 5l-7 7 7 7" /></button>
          <button type="button" className="el-turn next" onClick={() => turn(1)} aria-label="Next element"><Icon d="M9 5l7 7-7 7" /></button>
          <span className="el-pg">{i + 1} of {ELEMENTS.length}</span>
        </div>
      )}
    </div>
  );
}
