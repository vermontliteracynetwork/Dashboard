import { useMemo, useState } from 'react';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { speak } from '../../components/ReadAloud';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest } from '../../components/MyBest';
import { MenuItems } from '../../lib/mainMenu';
import Battle from '../../games/creaturemon/Battle';
import Versus from '../../games/creaturemon/Versus';
import Explore from '../../games/creaturemon/Explore';
import Deck from '../../games/creaturemon/Deck';
import { CreatureCard, Sprite } from '../../games/creaturemon/Card';
import { AbilityScene, EvoScene, RevealScene, XpBar, uiSound, useCmSave } from '../../games/creaturemon/shared';
import { ABILITIES, FORMS, abName, IMG, STARTERS, TYPE_COLOR, displayName, form, line, nextForm, xpToNext, type Mon } from '../../games/creaturemon/data';

// Creaturemon on the Computer (Build Queue 710 to 712, then 725 to 730, 2026-11-19). Her 725 words: "instead of
// creating a new world, lets have it so the creaturemon is like a pokemon go style game ... if they've clicked on the
// creaturemon app on their computer, they should see a menu with seeing all their collected cards or like a pokemon
// go style where they should see a border around their regular world view." This app is that menu: turn Creaturemon on
// (Town Square then gets the border and wild creatures, see src/games/creaturemon/Go.tsx), see every card, the team,
// battles (turn based like the pet battles, fueled by questions in Learn mode, 728), training and orbs. 61 creatures
// in 20 evolution lines, each named from its body shape (711), each evolution with its own card (712).
const UI = `${IMG}ui/`;

export default function Creaturemon() {
  const back = useBack();
  const cm = useCmSave(); const S = cm.S; const team = cm.team; const student = cm.student;
  const { ask, element, pay, settingsPanel, learn } = useAsk('Creaturemon', '🐉', 'creaturemon', { startCard: false, perLabel: 'Questions for each move, orb or training' });
  const [panel, setPanel] = useState<'' | 'team' | 'cards' | 'train' | 'help' | 'gear' | 'battle' | 'versus'>('');
  const [cardOpen, setCardOpen] = useState<string | null>(null);
  const [teamPage, setTeamPage] = useState(0);
  const [reveal, setReveal] = useState<{ formId: string; isNew: boolean; title: string } | null>(null);
  const [toast, setToast] = useState('');
  const [trainRun, setTrainRun] = useState<{ uid: string; left: number; hits: number; spot: number } | null>(null);
  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? '' : x)), 2600); };

  // Build Queue 740: Creaturemon is back in its own 3D pixel world (no Town Square border any more).
  const [explore, setExplore] = useState(false);
  const goCatch = () => { uiSound('popup-open-1'); if (S.active) cm.put({ active: false }); sfx.chime(); setExplore(true); };
  const startTraining = (uid: string) => {
    setPanel(''); const m = S.mons.find((x) => x.uid === uid); if (!m) return;
    ask(`Creaturemon: answer to train ${displayName(m)}`, () => { setTrainRun({ uid, left: 12, hits: 0, spot: Math.floor(Math.random() * 9) }); sfx.pop(); });
  };
  const trainTap = (hit: boolean) => {
    const t = trainRun; if (!t) return;
    if (hit) sfx.pop(); else sfx.click();
    const n = { ...t, left: t.left - 1, hits: t.hits + (hit ? 1 : 0), spot: Math.floor(Math.random() * 9) };
    if (n.left > 0) { setTrainRun(n); return; }
    setTrainRun(null);
    const m = S.mons.find((x) => x.uid === t.uid); if (!m) return;
    const xp = Math.round(xpToNext(m.level) * (0.35 + n.hits * 0.09));
    const r = cm.train(m.uid, xp); cm.stat(m.uid, (st) => ({ ...st, trainings: st.trainings + 1 })); say(`${displayName(m)} got ${xp} XP${r?.levels ? ` and grew ${r.levels} level${r.levels > 1 ? 's' : ''}` : ''}!`);
  };
  const makeOrbs = () => ask('Creaturemon: answer to make 3 orbs', () => { cm.put({ orbs: cm.sRef.current.orbs + 3 }); sfx.coin(); say('3 new orbs!'); });
  const pickStarter = (formId: string) => {
    const r = cm.addMon(formId, 5, 'starter'); cm.put({ starterPicked: true, team: [r.mon.uid] });
    setReveal({ formId, isNew: true, title: `${form(formId).name} is your partner!` });
    speak(`${form(formId).name} is your partner! Turn on Creaturemon and walk around Town Square to catch more.`, student?.ttsSettings);
  };
  const menu = useMemo(() => [{ id: 'cm-help', icon: '❓', label: 'How to play', bg: '#3a4fb0', order: 5, onSelect: () => setPanel('help') }], []);
  const howTo = 'Tap Explore to walk around the Creaturemon world with the move pad (or the W A S D keys), and drag the screen to turn. Walk up to a wild creature: tap Throw orb to catch it, or Battle it first. A creature tired out from a battle is easy to catch, and sneaking up behind one helps too. Battles take turns: tap a move, and in Learn mode answer a question to fuel it. Battles and training give XP. At the right level your creature evolves, and every evolution is a new card!';
  if (!student) return null;
  const leave = () => { pay(); back.go(); };
  const gfx: 'low' | 'medium' | 'high' = S.gfx ?? 'medium';
  const tiles: { id: string; icon: string; label: string; sub: string; on: () => void; off?: boolean }[] = [
    { id: 'cards', icon: 'card', label: 'My cards', sub: `${S.caught.length} of ${FORMS.length}`, on: () => setPanel('cards') },
    { id: 'team', icon: 'bag', label: 'My team', sub: `${team.length} on the team`, on: () => setPanel('team') },
    { id: 'battle', icon: 'sword', label: 'Battle', sub: 'One creature or a team', on: () => setPanel('battle'), off: !team.length },
    { id: 'versus', icon: 'unlock', label: 'Battle a friend', sub: 'Make or join with a code', on: () => setPanel('versus'), off: !team.length },
    { id: 'train', icon: 'trophy', label: 'Train', sub: 'Tap berries for XP', on: () => setPanel('train'), off: !team.length },
    { id: 'orbs', icon: 'coin', label: 'Make orbs', sub: `${S.orbs} orbs now`, on: makeOrbs },
    { id: 'help', icon: 'magnifier', label: 'How to play', sub: 'Read or listen', on: () => setPanel('help') },
  ];

  return (
    <div className="cm cm-app">
      <MenuItems items={menu} />
      <header className="rc-head cm-head">
        <LeaveButton onLeave={leave} note="Your creatures and cards are saved, and your right answers are paid." />
        <strong className="cm-title">Creaturemon</strong>
        <span className="rc-pill cm-orbs"><i className="cm-orb-i" aria-hidden />{S.orbs} orbs</span>
        <span className={`rc-pill${learn ? ' rc-learn' : ''}`}>{learn ? 'Learn mode' : 'Play mode'}</span>
        <SfxToggle />
        <button type="button" className="btn game-settings-btn" onClick={() => setPanel('gear')} aria-label="Settings">⚙️</button>
        <MyBest game="creaturemon" unit="cards" />
      </header>
      <div className="cm-home">
        <div className={`cm-go${S.active ? ' on' : ''}`}>
          <div className="cm-go-art">{(team[0] ? [form(team[0].formId)] : STARTERS.map(form)).map((f) => <Sprite key={f.id} f={f} px={84} anim="move" />)}</div>
          <div className="cm-go-txt">
            <h2>Explore the Creaturemon world</h2>
            <p>Six places to explore in 3D pixel art. Find wild creatures, catch them, battle them, and sit with the calm ones.</p>
            <div className="cm-row" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="cm-big orb" onClick={goCatch} disabled={!S.starterPicked}>Explore</button>
            </div>
          </div>
        </div>
        <div className="cm-tiles">
          {tiles.map((t) => (
            <button key={t.id} type="button" className="cm-tile" onClick={t.on} disabled={t.off} style={{ borderImageSource: `url(${UI}btn_blue.png)` }}>
              <img src={`${UI}i_${t.icon}.png`} alt="" /><b>{t.label}</b><small>{t.sub}</small>
            </button>
          ))}
        </div>
        {team.length > 0 && (
          <div className="cm-teamstrip" aria-label="Your team">
            {team.map((m) => (
              <button key={m.uid} type="button" className="cm-mini" onClick={() => setCardOpen(m.formId)} style={{ borderColor: TYPE_COLOR[line(m.formId).type] }}>
                <Sprite f={form(m.formId)} px={48} /><b>{displayName(m)}</b><small>Lv {m.level}</small><XpBar m={m} />
              </button>
            ))}
          </div>
        )}
        {toast && <div className="cm-toast" role="status">{toast}</div>}
      </div>

      {panel === 'battle' && <div className="cmb-host"><Battle cm={cm} ask={ask} onClose={() => setPanel('')} /></div>}
      {explore && <div className="cmb-host"><Explore cm={cm} ask={ask} gfx={gfx} onClose={() => setExplore(false)} /></div>}
      {panel === 'versus' && <div className="cmb-host"><Versus cm={cm} ask={ask} onClose={() => setPanel('')} /></div>}

      {trainRun && (
        <div className="cm-over">
          <div className="pf-panel cm-train">
            <h2>Training: tap the berry! <small>{trainRun.left} left</small></h2>
            <div className="cm-train-grid">
              {Array.from({ length: 9 }, (_, i) => (
                <button key={`${trainRun.left}-${i}`} type="button" className={`cm-train-cell${i === trainRun.spot ? ' hot' : ''}`} onClick={() => trainTap(i === trainRun.spot)} aria-label={i === trainRun.spot ? 'Berry' : 'Empty grass'}>
                  {i === trainRun.spot && <img src={`${IMG}cards/apple.png`} alt="" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {panel === 'team' && (
        <Panel title="My team" onClose={() => setPanel('')} wide>
          <p className="cm-note">Your first creature is the leader. Up to 6 on your team; the rest wait in the box. Follow me makes a creature walk behind you when you explore. Each creature can learn up to 3 abilities.</p>
          {/* 746: each creature as a tall card: picture on top, name, description, buttons, then the rest */}
          <div className="cm-tms">
            {[...team, ...S.mons.filter((m) => !S.team.includes(m.uid))].slice(teamPage * 4, teamPage * 4 + 4).map((m) => {
              const f = form(m.formId); const inTeam = S.team.includes(m.uid); const nx = nextForm(m.formId); const tc = TYPE_COLOR[line(f.id).type];
              return (
                <div key={m.uid} className={`cm-tm${inTeam ? '' : ' boxed'}`} style={{ ['--tc' as string]: tc }}>
                  <span className="cm-tm-pic"><Sprite f={f} px={84} fitW={150} anim="idle" />{S.team[0] === m.uid && <span className="cm-tm-lead">Leader</span>}{!inTeam && <span className="cm-tm-lead box">In the box</span>}</span>
                  <b className="cm-tm-name">{displayName(m)}</b>
                  <p className="cm-tm-desc"><span className="cm-line-type">{line(f.id).type}</span> Lv {m.level} · {nx ? `evolves at Lv ${f.evolvesAt}` : 'final form'}</p>
                  <span className="cm-tm-xp"><small>XP</small><XpBar m={m} /></span>
                  <div className="cm-tm-btns">
                    {inTeam && S.team[0] !== m.uid && <button type="button" className="btn" onClick={() => cm.put({ team: [m.uid, ...S.team.filter((u) => u !== m.uid)] })}>Lead</button>}
                    {inTeam && S.team.length > 1 && <button type="button" className="btn" onClick={() => cm.put({ team: S.team.filter((u) => u !== m.uid) })}>To box</button>}
                    {!inTeam && S.team.length < 6 && <button type="button" className="btn" onClick={() => cm.put({ team: [...S.team, m.uid] })}>To team</button>}
                    {inTeam && <button type="button" className={`btn${m.follow ? ' btn-primary' : ''}`} title="Walks behind you when you explore (up to 2)"
                      onClick={() => { const on = !m.follow; if (on && S.mons.filter((x) => x.follow).length >= 2) { say('Two creatures can follow you at a time.'); uiSound('error-1'); return; } cm.put({ mons: S.mons.map((x) => (x.uid === m.uid ? { ...x, follow: on } : x)) }); uiSound('select-1'); }}>{m.follow ? 'Following' : 'Follow me'}</button>}
                    <button type="button" className="btn" onClick={() => setCardOpen(m.formId)}>Card</button>
                  </div>
                  <Abilities m={m} />
                  <MonStatsLine m={m} />
                </div>
              );
            })}
            {!S.mons.length && <p>No creatures yet.</p>}
          </div>
          {S.mons.length > 4 && (
            <div className="cm-pager">
              <button type="button" className="dk-arrow" disabled={teamPage === 0} onClick={() => setTeamPage((p) => p - 1)} aria-label="Previous page">◀</button>
              <span>Page {teamPage + 1} of {Math.ceil(S.mons.length / 4)}</span>
              <button type="button" className="dk-arrow" disabled={(teamPage + 1) * 4 >= S.mons.length} onClick={() => setTeamPage((p) => p + 1)} aria-label="Next page">▶</button>
            </div>
          )}
        </Panel>
      )}

      {panel === 'train' && (
        <Panel title="Who will train?" onClose={() => setPanel('')}>
          <p className="cm-note">{learn ? 'Answer, then tap the berries for XP.' : 'Tap the berries for XP.'}</p>
          <div className="cm-team">
            {team.map((m) => (
              <button key={m.uid} type="button" className="cm-mon pick" style={{ borderColor: TYPE_COLOR[line(m.formId).type] }} onClick={() => startTraining(m.uid)}>
                <Sprite f={form(m.formId)} px={56} />
                <div className="cm-mon-txt"><b>{displayName(m)}</b><small>Lv {m.level} · {line(m.formId).type}</small><XpBar m={m} /></div>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {(panel === 'cards' || cardOpen) && <div className="cmb-host"><Deck caught={S.caught} seen={S.seen} mons={S.mons} startId={cardOpen} tts={student.ttsSettings} onClose={() => { setPanel(''); setCardOpen(null); }} /></div>}

      {panel === 'help' && (
        <Panel title="How to play" onClose={() => setPanel('')}>
          <p>{howTo} <button type="button" className="btn" onClick={() => speak(howTo, student.ttsSettings)} aria-label="Listen">🔊</button></p>
          <p className="cm-note">Types: {Object.keys(TYPE_COLOR).join(', ')}. A special move is extra strong against some types: Fire beats Leaf and Frost, Water beats Fire and Stone, Leaf beats Water and Stone, and Light and Shadow beat each other.</p>
        </Panel>
      )}
      {panel === 'gear' && <Panel title="Settings" onClose={() => setPanel('')}><GfxMeter value={gfx} onChange={(g) => cm.put({ gfx: g })} />{settingsPanel}</Panel>}

      {!S.starterPicked && !reveal && (
        <div className="cm-over">
          <div className="pf-panel cm-starters">
            <h2>Pick your partner <button type="button" className="btn" onClick={() => speak('Pick your partner: Kindlit, a fire puff. Cubbloop, a water jelly. Or Sprotato, a leaf tater.', student.ttsSettings)} aria-label="Listen">🔊</button></h2>
            <div className="cm-row">{STARTERS.map((id) => <CreatureCard key={id} f={form(id)} scale={0.9} onClick={() => pickStarter(id)} />)}</div>
          </div>
        </div>
      )}
      {reveal && <RevealScene formId={reveal.formId} isNew={reveal.isNew} title={reveal.title} onClose={() => setReveal(null)} tts={student.ttsSettings} />}
      <EvoScene cm={cm} />
      <AbilityScene cm={cm} />
      {element}
    </div>
  );
}

function Panel({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="pf-overlay" onClick={onClose}>
      <div className={`pf-panel cm-panel${wide ? ' wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="cm-panel-head"><h2>{title}</h2><button type="button" className="btn btn-primary" onClick={onClose}>Done</button></div>
        {children}
      </div>
    </div>
  );
}

// Up to 3 abilities for this one creature (732).
function Abilities({ m }: { m: Mon }) {
  const abs = m.abilities ?? [];
  if (!abs.length) return <small className="cm-note" style={{ margin: 0 }}>No abilities yet (up to 3)</small>;
  const st = form(m.formId).stage;
  return <span className="cm-abs">{abs.map((a) => <span key={a} className="cm-ab" title={`${ABILITIES[a].how} It grows stronger when ${displayName(m)} evolves.`}>{abName(a, st)}</span>)}</span>;
}
// Her "stats should be kept track of for each individual" (732).
function MonStatsLine({ m }: { m: Mon }) {
  const st = m.stats; if (!st) return null;
  const how = st.how === 'starter' ? 'Your partner' : st.how === 'meditation' ? 'Joined by meditating' : 'Caught with an orb';
  return (
    <span className="cm-statgrid">
      <span>Battles</span><b>{st.battles} ({st.wins} won)</b>
      <span>Damage given</span><b>{st.dealt}</b>
      <span>Evolved</span><b>{st.evolutions} times</b>
      <span>Meditated</span><b>{st.meditations} times</b>
      <span>Trained</span><b>{st.trainings} times</b>
      <span>Joined</span><b>{how}, {new Date(m.caughtAt).toLocaleDateString()}</b>
    </span>
  );
}

function GfxMeter({ value, onChange }: { value: 'low' | 'medium' | 'high'; onChange: (g: 'low' | 'medium' | 'high') => void }) {
  const opts: { id: 'low' | 'medium' | 'high'; label: string; how: string }[] = [
    { id: 'low', label: 'Big pixels', how: 'Chunky pixels. Fastest on older iPads.' },
    { id: 'medium', label: 'Medium', how: 'The usual 3D pixel look.' },
    { id: 'high', label: 'Small pixels', how: 'Sharper. Best on newer iPads.' },
  ];
  return (
    <div className="rc-gfx" role="radiogroup" aria-label="Pixel size">
      <span className="rc-gfx-label">World pixels</span>
      <div className="rc-gfx-meter">
        {opts.map((o, i) => <button key={o.id} type="button" role="radio" aria-checked={value === o.id} title={o.how} className={`rc-gfx-btn${opts.findIndex((x) => x.id === value) >= i ? ' on' : ''}${value === o.id ? ' sel' : ''}`} onClick={() => onChange(o.id)}>{o.label}</button>)}
      </div>
      <small>{opts.find((o) => o.id === value)?.how}</small>
    </div>
  );
}
