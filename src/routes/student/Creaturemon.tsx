import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { speak } from '../../components/ReadAloud';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest } from '../../components/MyBest';
import { MenuItems } from '../../lib/mainMenu';
import Battle from '../../games/creaturemon/Battle';
import { CreatureCard, Sprite } from '../../games/creaturemon/Card';
import { AbilityScene, EvoScene, RevealScene, XpBar, uiSound, useCmSave } from '../../games/creaturemon/shared';
import { ABILITIES, FORMS, HABITAT_NAME, IMG, LINES, STARTERS, TYPE_COLOR, displayName, form, line, nextForm, xpToNext, type Form, type Mon } from '../../games/creaturemon/data';

// Creaturemon on the Computer (Build Queue 710 to 712, then 725 to 730, 2026-11-19). Her 725 words: "instead of
// creating a new world, lets have it so the creaturemon is like a pokemon go style game ... if they've clicked on the
// creaturemon app on their computer, they should see a menu with seeing all their collected cards or like a pokemon
// go style where they should see a border around their regular world view." This app is that menu: turn Creaturemon on
// (Town Square then gets the border and wild creatures, see src/games/creaturemon/Go.tsx), see every card, the team,
// battles (turn based like the pet battles, fueled by questions in Learn mode, 728), training and orbs. 61 creatures
// in 20 evolution lines, each named from its body shape (711), each evolution with its own card (712).
const UI = `${IMG}ui/`;

export default function Creaturemon() {
  const back = useBack(); const navigate = useNavigate();
  const cm = useCmSave(); const S = cm.S; const team = cm.team; const student = cm.student;
  const { ask, element, pay, settingsPanel, learn } = useAsk('Creaturemon', '🐉', 'creaturemon', { startCard: false, perLabel: 'Questions for each move, orb or training' });
  const [panel, setPanel] = useState<'' | 'team' | 'cards' | 'train' | 'help' | 'gear' | 'battle'>('');
  const [cardOpen, setCardOpen] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ formId: string; isNew: boolean; title: string } | null>(null);
  const [toast, setToast] = useState('');
  const [trainRun, setTrainRun] = useState<{ uid: string; left: number; hits: number; spot: number } | null>(null);
  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? '' : x)), 2600); };

  const goCatch = () => { uiSound('popup-open-1'); cm.put({ active: true }); sfx.chime(); speak('Creaturemon is on! Walk around Town Square to find creatures.', student?.ttsSettings); navigate('/world/town'); };
  const turnOff = () => { cm.put({ active: false }); sfx.click(); say('Creaturemon is off.'); };
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
  const howTo = 'Tap Turn on Creaturemon. Town Square gets a Creaturemon border, and wild creatures appear on glowing rings near you. Walk up to one: tap Throw orb to catch it, or Battle it first. A creature tired out from a battle is easy to catch, and sneaking up behind one helps too. Battles take turns: tap a move, and in Learn mode answer a question to fuel it. Battles and training give XP. At the right level your creature evolves, and every evolution is a new card!';
  if (!student) return null;
  const leave = () => { pay(); back.go(); };
  const caughtSet = new Set(S.caught); const seenSet = new Set(S.seen);
  const tiles: { id: string; icon: string; label: string; sub: string; on: () => void; off?: boolean }[] = [
    { id: 'cards', icon: 'card', label: 'My cards', sub: `${S.caught.length} of ${FORMS.length}`, on: () => setPanel('cards') },
    { id: 'team', icon: 'bag', label: 'My team', sub: `${team.length} on the team`, on: () => setPanel('team') },
    { id: 'battle', icon: 'sword', label: 'Battle', sub: 'Turn based battles', on: () => setPanel('battle'), off: !team.length },
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
            <h2>{S.active ? 'Creaturemon is on' : 'Catch creatures in Town Square'}</h2>
            <p>{S.active ? 'Town Square has the Creaturemon border and wild creatures. Go find them!' : 'Turn it on, then walk around Town Square. Creatures appear on glowing rings near you.'}</p>
            <div className="cm-row" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="cm-big orb" onClick={goCatch} disabled={!S.starterPicked}>{S.active ? 'Go to Town Square' : 'Turn on Creaturemon'}</button>
              {S.active && <button type="button" className="btn btn-lg" onClick={turnOff}>Turn off</button>}
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
          <p className="cm-note">Your first creature is the leader. Up to 6 on your team; the rest wait in the box. Tap Follow me to have a creature walk with you in Town Square. Each creature can learn up to 3 abilities in battles, by evolving and by meditating.</p>
          <div className="cm-team">
            {[...team, ...S.mons.filter((m) => !S.team.includes(m.uid))].map((m) => {
              const f = form(m.formId); const inTeam = S.team.includes(m.uid); const nx = nextForm(m.formId);
              return (
                <div key={m.uid} className={`cm-mon${inTeam ? '' : ' boxed'}`} style={{ borderColor: TYPE_COLOR[line(f.id).type] }}>
                  <Sprite f={f} px={56} />
                  <div className="cm-mon-txt">
                    <b>{displayName(m)}</b><small>Lv {m.level} · {line(f.id).type}{S.team[0] === m.uid ? ' · Leader' : ''}</small>
                    <XpBar m={m} />
                    <small>{nx ? `Evolves into ? ? ? at Lv ${f.evolvesAt}` : 'Final form'}</small>
                    <Abilities m={m} />
                    <MonStatsLine m={m} />
                  </div>
                  <div className="cm-mon-btns">
                    {inTeam && S.team[0] !== m.uid && <button type="button" className="btn" onClick={() => cm.put({ team: [m.uid, ...S.team.filter((u) => u !== m.uid)] })}>Lead</button>}
                    {inTeam && S.team.length > 1 && <button type="button" className="btn" onClick={() => cm.put({ team: S.team.filter((u) => u !== m.uid) })}>To box</button>}
                    {!inTeam && S.team.length < 6 && <button type="button" className="btn" onClick={() => cm.put({ team: [...S.team, m.uid] })}>To team</button>}
                    {inTeam && <button type="button" className={`btn${m.follow ? ' btn-primary' : ''}`} title="Walk with you in Town Square (up to 2)"
                      onClick={() => { const on = !m.follow; if (on && S.mons.filter((x) => x.follow).length >= 2) { say('Two creatures can follow you at a time.'); uiSound('error-1'); return; } cm.put({ mons: S.mons.map((x) => (x.uid === m.uid ? { ...x, follow: on } : x)) }); uiSound('select-1'); }}>{m.follow ? 'Following' : 'Follow me'}</button>}
                    <button type="button" className="btn" onClick={() => setCardOpen(m.formId)}>Card</button>
                  </div>
                </div>
              );
            })}
            {!S.mons.length && <p>No creatures yet.</p>}
          </div>
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

      {panel === 'cards' && (
        <Panel title={`My cards: ${S.caught.length} of ${FORMS.length}`} onClose={() => setPanel('')} wide>
          <p className="cm-note">Every evolution has its own card. Catch a creature or evolve one to fill its card.</p>
          <div className="cm-lines">
            {LINES.map((l) => (
              <div key={l.id} className="cm-line">
                {l.forms.map((f, i) => (
                  <div key={f.id} className="cm-line-step">
                    {i > 0 && <span className="cm-arrow" aria-label={`evolves at level ${l.forms[i - 1].evolvesAt}`}>Lv {l.forms[i - 1].evolvesAt} ▶</span>}
                    <CreatureCard f={f} scale={0.62} state={caughtSet.has(f.id) ? 'caught' : seenSet.has(f.id) ? 'seen' : 'unknown'} onClick={() => caughtSet.has(f.id) && setCardOpen(f.id)} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {cardOpen && <CardView f={form(cardOpen)} onClose={() => setCardOpen(null)} tts={student.ttsSettings} level={S.mons.filter((m) => m.formId === cardOpen).reduce((a, m) => Math.max(a, m.level), 1)} />}

      {panel === 'help' && (
        <Panel title="How to play" onClose={() => setPanel('')}>
          <p>{howTo} <button type="button" className="btn" onClick={() => speak(howTo, student.ttsSettings)} aria-label="Listen">🔊</button></p>
          <p className="cm-note">Types: {Object.keys(TYPE_COLOR).join(', ')}. A special move is extra strong against some types: Fire beats Leaf and Frost, Water beats Fire and Stone, Leaf beats Water and Stone, and Light and Shadow beat each other.</p>
        </Panel>
      )}
      {panel === 'gear' && <Panel title="Settings" onClose={() => setPanel('')}>{settingsPanel}</Panel>}

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

function CardView({ f, onClose, tts, level }: { f: Form; onClose: () => void; tts: Parameters<typeof speak>[1]; level: number }) {
  const [flip, setFlip] = useState(false); const l = line(f.id);
  const words = `${f.name}. ${l.type} type, stage ${f.stage} of ${l.forms.length}. ${f.desc} Its name comes from ${f.nameFrom}. Its special move is ${l.special.name}.`;
  return (
    <div className="pf-overlay" onClick={onClose}>
      <div className="cm-cardview" onClick={(e) => e.stopPropagation()}>
        <div className={`cm-flip${flip ? ' back' : ''}`} onClick={() => setFlip((x) => !x)}>
          {flip ? (
            <div className="cm-card-backside">
              <h3>{f.name}</h3>
              <p>{f.desc}</p>
              <p><b>Name:</b> {f.nameFrom}.</p>
              <p><b>Special move:</b> {l.special.name}</p>
              <p><b>Lives in:</b> {HABITAT_NAME[l.habitat]}</p>
            </div>
          ) : <CreatureCard f={f} scale={1.5} level={level} />}
        </div>
        <div className="cm-row">
          <button type="button" className="btn" onClick={() => speak(words, tts)} aria-label="Listen">🔊</button>
          <button type="button" className="btn" onClick={() => setFlip((x) => !x)}>Flip card</button>
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// Up to 3 abilities for this one creature (732).
function Abilities({ m }: { m: Mon }) {
  const abs = m.abilities ?? [];
  if (!abs.length) return <small className="cm-note" style={{ margin: 0 }}>No abilities yet (up to 3)</small>;
  return <span className="cm-abs">{abs.map((a) => <span key={a} className="cm-ab" title={ABILITIES[a].how}>{ABILITIES[a].name}</span>)}</span>;
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
