// The Creaturemon card deck (Build Queue 745, her words: "REQUIRE NO SCROLL AND CHANGE SO NOTHING IS HIDDEN BY
// SCROLL.. ALL CREATUREMON SHOULD BE IN A FLIP/PAGE TURN CARD DECK LIKE FLASHCARDS. ALL TEXT SHOULD ALWAYS BE SHOWING.
// MAKE INFO MENU TO THE RIGHT THE SAME SIZE AS THE CARD ON THE LEFT"). All 61 cards in one deck, one at a time like
// flashcards: the card on the left, its info page on the right at exactly the card's size, sized to the screen so
// nothing ever scrolls. Previous and Next (or a swipe, or the arrow keys) turn the page; tapping the card flips it.
import { useEffect, useRef, useState } from 'react';
import { speak } from '../../components/ReadAloud';
import { CreatureCard, Sprite } from './Card';
import { uiSound } from './shared';
import { FORMS, HABITAT_NAME, IMG, STRONG, TYPE_COLOR, abName, displayName, line, statsAt, type Mon } from './data';

const CW = 195, CH = 284; // her card frame, in pixels

function useFit(ref: React.RefObject<HTMLDivElement | null>) {
  const [k, setK] = useState(1.6);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const fit = () => { const r = el.getBoundingClientRect(); const byH = (r.height - 8) / CH; const byW = (r.width - 24) / (CW * 2 + 24); setK(Math.max(1, Math.min(byH, byW, 3))); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, [ref]);
  return k;
}

export default function Deck({ caught, seen, mons, startId, onClose, tts }: { caught: string[]; seen: string[]; mons: Mon[]; startId?: string | null; onClose: () => void; tts?: Parameters<typeof speak>[1] }) {
  const [i, setI] = useState(() => Math.max(0, FORMS.findIndex((f) => f.id === startId)));
  const [turn, setTurn] = useState<'' | 'next' | 'prev'>('');
  const [flipped, setFlipped] = useState(false);
  const stage = useRef<HTMLDivElement>(null); const k = useFit(stage);
  const f = FORMS[i]; const l = line(f.id); const has = caught.includes(f.id); const saw = seen.includes(f.id);
  const state = has ? 'caught' : saw ? 'seen' : 'unknown';
  const mine = mons.filter((m) => m.formId === f.id).sort((a, b) => b.level - a.level)[0];
  const level = mine?.level ?? 1; const st = statsAt(f, level); const top = statsAt(l.forms[l.forms.length - 1], 50);
  const go = (d: 1 | -1) => { uiSound('cursor-1'); setTurn(d > 0 ? 'next' : 'prev'); setFlipped(false); window.setTimeout(() => { setI((x) => (x + d + FORMS.length) % FORMS.length); setTurn(''); }, 180); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sx = useRef<number | null>(null);
  const words = has ? `${f.name}. ${l.type} type, stage ${f.stage} of ${l.forms.length}. ${f.desc} Its name comes from ${f.nameFrom}. Its special move is ${l.special.name}.` : saw ? `A card you have seen but not caught yet. It lives in ${HABITAT_NAME[l.habitat]}.` : 'A card not found yet. Keep exploring!';
  const bar = (label: string, icon: string, v: number, max: number) => (
    <div className="dk-stat"><img src={`${IMG}cards/${icon}.png`} alt="" /><span>{label}</span><i><b style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></i><em>{v}</em></div>
  );
  const firstSeen = FORMS.findIndex((x, n) => n > i && (caught.includes(x.id)));
  return (
    <div className="dk" role="dialog" aria-label="Card deck">
      <div className="dk-top">
        <b className="dk-title">My cards</b>
        <span className="dk-count">{caught.length} of {FORMS.length} caught</span>
        <span className="dk-prog"><i style={{ width: `${(caught.length / FORMS.length) * 100}%` }} /></span>
        <button type="button" className="btn" onClick={() => speak(words, tts)} aria-label="Listen">🔊</button>
        <button type="button" className="btn btn-primary" onClick={() => { uiSound('popup-close-1'); onClose(); }}>Done</button>
      </div>
      <div className="dk-stage" ref={stage}
        onPointerDown={(e) => { sx.current = e.clientX; }} onPointerUp={(e) => { if (sx.current != null && Math.abs(e.clientX - sx.current) > 60) go(e.clientX < sx.current ? 1 : -1); sx.current = null; }}>
        <div className={`dk-pair ${turn}`} style={{ ['--k' as string]: k, ['--tc' as string]: TYPE_COLOR[l.type] }}>
          <div className={`dk-flip${flipped ? ' on' : ''}`} style={{ width: CW * k, height: CH * k }} onClick={() => { uiSound('select-1'); setFlipped((x) => !x); }}>
            <div className="dk-face front"><CreatureCard f={f} scale={k} level={level} state={state} /></div>
            <div className="dk-face back"><img src={`${IMG}cards/back${f.stage === 1 ? 1 : f.stage === 2 ? 2 : 3}.png`} alt="" /></div>
          </div>
          <div className="dk-info" style={{ width: CW * k, height: CH * k }}>
            {has ? (
              <>
                <h2>{f.name}</h2>
                <p className="dk-tags"><span className="dk-type">{l.type}</span><span>Stage {f.stage} of {l.forms.length}</span><span>{HABITAT_NAME[l.habitat]}</span>{mine && <span>Lv {mine.level}</span>}</p>
                <p className="dk-desc">{f.desc}</p>
                <p className="dk-small"><b>Its name:</b> {f.nameFrom}.</p>
                <div className="dk-stats">{bar('Health', 'sym_heart', st.hp, top.hp)}{bar('Attack', 'sym_sword', st.atk, top.atk)}{bar('Defense', 'sym_shield', st.def, top.def)}{bar('Speed', 'sym_energy', st.spd, top.spd)}</div>
                <p className="dk-small"><b>Special move:</b> {l.special.name}, strong vs {STRONG[l.type].join(' and ')}</p>
                {mine && (mine.abilities ?? []).length > 0 && <p className="dk-small"><b>{displayName(mine)}'s abilities:</b> {(mine.abilities ?? []).map((a) => abName(a, f.stage)).join(', ')}</p>}
              </>
            ) : (
              <>
                <h2>{saw ? '? ? ?' : 'Not found yet'}</h2>
                <p className="dk-tags"><span className="dk-type">{l.type}</span><span>Stage {f.stage} of {l.forms.length}</span></p>
                <p className="dk-desc">{saw ? `You have seen this creature but not caught it yet. Look in ${HABITAT_NAME[l.habitat]}!` : f.stage > 1 ? 'This card comes from evolving a creature. Train and battle to find it.' : `Explore ${HABITAT_NAME[l.habitat]} to find it.`}</p>
              </>
            )}
            <div className="dk-chain" aria-label="Evolution line">
              {l.forms.map((x, n) => {
                const got = caught.includes(x.id);
                return (
                  <span key={x.id} className={`dk-step${x.id === f.id ? ' on' : ''}`}>
                    {n > 0 && <small className="dk-lv">Lv {l.forms[n - 1].evolvesAt}</small>}
                    <Sprite f={x} px={30} fitW={44} className={got ? '' : 'cm-shadow'} />
                    <small>{got ? x.name : '? ? ?'}</small>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="dk-nav">
        <button type="button" className="dk-arrow" onClick={() => go(-1)} aria-label="Previous card">◀</button>
        <span className="dk-pos"><b>{i + 1}</b> of {FORMS.length}<small>{l.forms[0].name} family</small></span>
        <button type="button" className="dk-arrow" onClick={() => go(1)} aria-label="Next card">▶</button>
        {firstSeen > 0 && <button type="button" className="btn" onClick={() => { uiSound('cursor-1'); setI(firstSeen); setFlipped(false); }}>Next caught card</button>}
      </div>
    </div>
  );
}
