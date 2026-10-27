import { useState } from 'react';
import { AFTERSCHOOL_CODE, AFTERSCHOOL_GAMES, setAfterschool, useAfterschool } from '../lib/afterschool';
import { speak } from './ReadAloud';
import { sfx } from '../lib/miniSfx';

// Build Queue 381: the Afterschool mode switch, in Settings. A parent or teacher types the 4 digit code to turn it on.
export default function AfterschoolSettings({ studentId }: { studentId: string }) {
  const on = useAfterschool(studentId);
  const [entering, setEntering] = useState(false);
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const games = AFTERSCHOOL_GAMES.map((g) => g.name).join(', ');
  const press = (d: string) => {
    sfx.tick();
    const next = (code + d).slice(0, 4);
    setCode(next); setWrong(false);
    if (next.length === 4) {
      if (next === AFTERSCHOOL_CODE) { setAfterschool(studentId, true); setEntering(false); setCode(''); sfx.coin(); speak(`Afterschool mode is on. ${games} plays without questions.`); }
      else { setWrong(true); setCode(''); sfx.pop(); }
    }
  };
  return (
    <section className="as-set" aria-label="Afterschool mode">
      <div className="as-head">
        <b>🏠 Afterschool mode</b>
        <span className={`as-pill${on ? ' on' : ''}`}>{on ? 'On' : 'Off'}</span>
      </div>
      <p>{on ? `These games play without questions on this iPad: ${games}.` : `For home time. A parent or teacher types the code, and ${games} plays without questions.`}</p>
      {on && <button type="button" className="btn" onClick={() => { setAfterschool(studentId, false); sfx.tick(); }}>Turn off Afterschool mode</button>}
      {!on && !entering && <button type="button" className="btn btn-primary" onClick={() => { setEntering(true); setCode(''); setWrong(false); }}>Turn on (grown-up code)</button>}
      {!on && entering && (
        <div className="as-pad">
          <div className="as-dots" aria-label={`${code.length} of 4 numbers typed`}>{[0, 1, 2, 3].map((i) => <i key={i} className={i < code.length ? 'full' : ''} />)}</div>
          {wrong && <p className="as-wrong" role="alert">That code is not right. Try again.</p>}
          <div className="as-keys">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} type="button" onClick={() => press(d)}>{d}</button>)}
            <button type="button" onClick={() => { setEntering(false); setCode(''); }} aria-label="Cancel">✕</button>
            <button type="button" onClick={() => press('0')}>0</button>
            <button type="button" onClick={() => { sfx.tick(); setCode(code.slice(0, -1)); }} aria-label="Delete">⌫</button>
          </div>
        </div>
      )}
    </section>
  );
}
