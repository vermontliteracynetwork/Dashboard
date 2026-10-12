import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';

// Post Office Sort (her native game list, 2026-09-30: "post office; sort letters and parcels into
// the right bins by answering"). Mail rides in on the conveyor belt. A right answer stamps it, then
// the student taps the bin whose picture matches the address label (a calm picture match, no
// reading needed). Eight pieces fill the mail truck, which drives off and brings back a new stamp
// for the Stamp Album.

interface Bin { id: string; name: string; icon: string; color: string }
const BINS: Bin[] = [
  { id: 'forest', name: 'Forest', icon: '🌲', color: '#2fa36b' },
  { id: 'beach', name: 'Beach', icon: '🏖️', color: '#f0a030' },
  { id: 'mountain', name: 'Mountain', icon: '⛰️', color: '#7a8a99' },
  { id: 'city', name: 'City', icon: '🏙️', color: '#5b8def' },
];
const KINDS = [
  { icon: '✉️', name: 'letter' }, { icon: '📦', name: 'parcel' }, { icon: '💌', name: 'love letter' },
  { icon: '🎁', name: 'gift box' }, { icon: '🗞️', name: 'newspaper' }, { icon: '🖼️', name: 'postcard' },
];
const TO = ['Grandma', 'Mr. Bear', 'Captain Fin', 'Dr. Owl', 'Aunt Rosa', 'the Mayor', 'Pip the Fox', 'Coach Moose'];
const STAMPS = ['🦋', '🌈', '🚀', '🦖', '🍩', '🐳', '🌋', '🎸', '🦉', '🍕', '🏰', '🌙'];
const TRUCK = 8;

interface Mail { kind: { icon: string; name: string }; to: string; bin: Bin; id: number }
const newMail = (id: number): Mail => ({
  kind: KINDS[Math.floor(Math.random() * KINDS.length)],
  to: TO[Math.floor(Math.random() * TO.length)],
  bin: BINS[Math.floor(Math.random() * BINS.length)],
  id,
});

export default function PostOfficeSort() {
  const back = useBack();
  const { ask, element, pay, student } = useAsk('Post Office Sort', '📮');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [mail, setMail] = useState<Mail>(() => newMail(1));
  const [stamped, setStamped] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [oops, setOops] = useState<string | null>(null);
  const [flying, setFlying] = useState<string | null>(null);
  const [truckGone, setTruckGone] = useState<{ stamp: string; isNew: boolean } | null>(null);
  const [album, setAlbum] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  if (!student) return null;
  const owner = `postoffice:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { stamps?: Record<string, number>; trucks?: number } | undefined) ?? {};
  const stamps = saved.stamps ?? {};

  const stamp = () => ask(`📮 Answer to stamp the ${mail.kind.name}!`, () => setStamped(true));
  const drop = (b: Bin) => {
    if (!stamped || flying) return;
    if (b.id !== mail.bin.id) { setOops(b.id); timers.current.push(window.setTimeout(() => setOops(null), 700)); return; }
    setFlying(b.id);
    timers.current.push(window.setTimeout(() => {
      setFlying(null); setStamped(false);
      const n = loaded + 1;
      if (n >= TRUCK) {
        // A full truck drives off and brings back a stamp, new ones first.
        const fresh = STAMPS.filter((s) => !stamps[s]);
        const s = (fresh.length ? fresh : STAMPS)[Math.floor(Math.random() * (fresh.length || STAMPS.length))];
        mergeStyleRow(owner, { stamps: { ...stamps, [s]: (stamps[s] ?? 0) + 1 }, trucks: (saved.trucks ?? 0) + 1 });
        pay(); playCheer();
        setTruckGone({ stamp: s, isNew: !stamps[s] });
        setLoaded(0);
      } else setLoaded(n);
      setMail((m) => newMail(m.id + 1));
    }, 650));
  };

  return (
    <div className="po">
      <header className="fd-head po-head">
        <button type="button" className="btn" onClick={() => { pay(); back.go(); }}>✕ Leave</button>
        <h1>📮 Post Office Sort</h1>
        <button type="button" className="btn" onClick={() => setAlbum(true)}>📒 Stamp Album ({Object.keys(stamps).length} / {STAMPS.length})</button>
      </header>
      <div className="po-main">
        <div className="po-truck" aria-label={`Mail truck: ${loaded} of ${TRUCK} loaded`}>
          <span className="po-truck-icon" aria-hidden>🚚</span>
          <span className="po-load">{Array.from({ length: TRUCK }, (_, i) => <i key={i} className={i < loaded ? 'on' : ''} />)}</span>
        </div>
        <div className="po-belt">
          <div className="po-rollers" aria-hidden />
          <div key={mail.id} className={`po-mail${stamped ? ' stamped' : ''}${flying ? ` fly-${BINS.findIndex((b) => b.id === flying)}` : ''}`}>
            <span className="po-mail-icon" aria-hidden>{mail.kind.icon}</span>
            <span className="po-label" style={{ borderColor: mail.bin.color }}>
              <span className="po-label-pic" aria-hidden>{mail.bin.icon}</span>
              <span>To: {mail.to}<br /><b>{mail.bin.name}</b></span>
            </span>
            {stamped && <span className="po-stamp" aria-hidden>✅</span>}
          </div>
        </div>
        <p className="fd-msg po-msg" aria-live="polite">
          {!stamped ? `A ${mail.kind.name} for ${mail.to}! Stamp it first.` : `Stamped! Tap the bin with the ${mail.bin.icon} picture.`}
        </p>
        {!stamped && <button type="button" className="btn btn-primary btn-lg fd-big po-stamp-btn" onClick={stamp}>📮 Stamp it</button>}
        <div className={`po-bins${stamped ? ' live' : ''}`}>
          {BINS.map((b) => (
            <button key={b.id} type="button" className={`po-bin${oops === b.id ? ' oops' : ''}`} style={{ background: b.color }} onClick={() => drop(b)} disabled={!stamped} aria-label={`${b.name} bin`}>
              <span aria-hidden>{b.icon}</span>{b.name}
            </button>
          ))}
        </div>
        {oops && <p className="po-oops" role="status">Not that one. Look at the picture on the label!</p>}
      </div>
      {truckGone && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <div className="po-drive" aria-hidden>🚚💨</div>
            <h2>The mail truck is full!</h2>
            <p>All {TRUCK} pieces of mail are on their way. Thank you, mail sorter! Here is a stamp for your album.</p>
            {truckGone.isNew && <span className="fd-new">✨ New stamp!</span>}
            <div className="fd-fish" aria-hidden>{truckGone.stamp}</div>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setTruckGone(null)}>📮 Sort more mail</button>
          </div>
        </div>
      )}
      {album && (
        <div className="pf-overlay" onClick={() => setAlbum(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>📒 Stamp Album</h2>
            <p style={{ marginTop: 0 }}>Every full mail truck brings back a stamp. Trucks sent: {saved.trucks ?? 0}</p>
            <div className="po-album">
              {STAMPS.map((s) => (
                <div key={s} className={`po-album-stamp${stamps[s] ? '' : ' locked'}`}>
                  <span>{stamps[s] ? s : '❔'}</span>
                  {stamps[s] ? <small>x{stamps[s]}</small> : null}
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setAlbum(false)}>Close</button>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
