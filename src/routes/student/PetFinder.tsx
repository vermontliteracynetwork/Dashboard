import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { petDefById, thumbnailFor, bioFor } from '../../lib/petCatalog';
import {
  shelterRoster, dayIndex, useAdoptedShelterIds, useCouponUsed, coatFor, COAT_GROUPS, AGE_LABEL, PET_AGES,
  PET_PRICE_CENTS, MYSTERY_BOX_CENTS, PET_CAP, rollMysteryBreed, randomPetName, type ShelterPet, type PetAge, type PetCertificate,
} from '../../lib/petsV2';
import { formatMoney } from '../../lib/money';
import { playCashRegister } from '../../lib/chime';
import { playAnticipation, playReveal, playCheer } from '../../lib/petSounds';
import { todayISO } from '../../lib/dates';
import { useBack } from '../../lib/navTrail';

// Pet Finder (her Pets v2 spec, 2026-10-11): "The pet shelter should be a 2D screen similar to pet
// finder and other online pet apps. it should be an app in the students computer. Students can
// click "Pet Finder" an app in their computer, or a pet shelter building in live mode." The cards
// follow the Webkinz "My Pets" picture she sent; the certificate follows her Webkinz "Certificate
// of Adoption" picture. Adoption is a ceremony: name your pet, then the certificate with confetti,
// fireworks and a cheer. The Mystery Adoption Box opens with a wiggling gift box.

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function PetPortrait({ defId, size, alt }: { defId: string; size: number; alt?: string }) {
  const def = petDefById(defId);
  const [failed, setFailed] = useState(false);
  if (!def || failed) return <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>🐾</span>;
  return <img src={thumbnailFor(def)} alt={alt ?? def.name} onError={() => setFailed(true)} style={{ width: size, height: size, objectFit: 'contain' }} draggable={false} />;
}

// Confetti and fireworks over the whole screen for a few seconds.
export function Celebration() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv || reduceMotion()) return;
    const g = cv.getContext('2d'); if (!g) return;
    const W = (cv.width = window.innerWidth), H = (cv.height = window.innerHeight);
    const colors = ['#f25f5c', '#ffe066', '#70c1b3', '#5b8def', '#c77dff', '#ff9f1c'];
    type P = { x: number; y: number; vx: number; vy: number; c: string; s: number; r: number; vr: number; spark?: boolean; life: number };
    const ps: P[] = [];
    for (let i = 0; i < 160; i++) ps.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, c: colors[i % colors.length], s: 6 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, life: 1 });
    const burst = (x: number, y: number) => { const c = colors[Math.floor(Math.random() * colors.length)]; for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, sp = 2 + Math.random() * 4; ps.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, c, s: 3, r: 0, vr: 0, spark: true, life: 1 }); } };
    const timers = [200, 700, 1200, 1700, 2300].map((t) => window.setTimeout(() => burst(W * (0.2 + Math.random() * 0.6), H * (0.15 + Math.random() * 0.3)), t));
    let raf = 0; const t0 = performance.now();
    const step = () => {
      const el = performance.now() - t0;
      g.clearRect(0, 0, W, H);
      for (const p of ps) {
        if (p.spark) { p.vy += 0.05; p.vx *= 0.98; p.life -= 0.012; } else { p.vy += 0.02; p.r += p.vr; }
        p.x += p.vx; p.y += p.vy;
        if (p.life <= 0) continue;
        g.globalAlpha = Math.max(0, Math.min(1, p.life * (el > 4000 ? (5000 - el) / 1000 : 1)));
        g.fillStyle = p.c;
        if (p.spark) { g.beginPath(); g.arc(p.x, p.y, p.s, 0, Math.PI * 2); g.fill(); }
        else { g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66); g.restore(); }
      }
      if (el < 5000) raf = requestAnimationFrame(step); else g.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, []);
  return <canvas ref={ref} className="pf-celebrate" aria-hidden="true" />;
}

// Her Webkinz "Certificate of Adoption" picture, as a Yoglandia certificate.
export function AdoptionCertificate({ cert, defId, onClose, children }: { cert: PetCertificate; defId: string; onClose?: () => void; children?: React.ReactNode }) {
  const date = new Date(cert.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  return (
    <div className="pf-cert" role="dialog" aria-label="Certificate of Adoption">
      <div className="pf-cert-ribbon">Certificate of Adoption</div>
      <div className="pf-cert-body">
        <div className="pf-cert-frame"><PetPortrait defId={defId} size={150} alt={cert.petName} /></div>
        <div className="pf-cert-text">
          <p>Congratulations <b className="pf-cert-name">{cert.studentName}</b> on your adoption of</p>
          <p className="pf-cert-pet">{cert.petName}!</p>
          <p>a {cert.sex} {cert.breed} on {date}.</p>
          <p>We welcome another happy pet into Yoglandia!</p>
          <p className="pf-cert-sign">Miss Kayden</p>
        </div>
      </div>
      <div className="pf-cert-actions">
        {children}
        {onClose && <button type="button" className="btn btn-lg" onClick={onClose}>Close</button>}
      </div>
    </div>
  );
}

type Flow =
  | { kind: 'detail'; pet: ShelterPet }
  | { kind: 'name'; defId: string; age: PetAge; sex: string; name: string; via: 'shelter' | 'mystery' | 'coupon'; price: number; shelterId?: string; petId?: string }
  | { kind: 'cert'; petId: string; defId: string; cert: PetCertificate }
  | { kind: 'box'; stage: 'confirm' | 'wiggle' | 'burst'; defId?: string; sex?: string; petId?: string; name?: string };

export default function PetFinder() {
  const navigate = useNavigate();
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const pets = useStore((s) => s.pets);
  const adoptPetV2 = useStore((s) => s.adoptPetV2);
  const updateStudent = useStore((s) => s.updateStudent);
  const renamePet = useStore((s) => s.renamePet);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const adopted = useAdoptedShelterIds();
  const couponUsed = useCouponUsed(student?.id);
  const [day] = useState(() => dayIndex());
  const roster = useMemo(() => shelterRoster(day), [day]);
  const [age, setAge] = useState<PetAge | 'all'>('all');
  const [animal, setAnimal] = useState<'all' | 'dog' | 'cat'>('all');
  const [color, setColor] = useState<string>('all');
  const [flow, setFlow] = useState<Flow | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  const busy = useRef(false);
  const stopMusic = useRef<() => void>(() => {});
  useEffect(() => () => stopMusic.current(), []);

  if (!student) return null;
  const mine = pets.filter((p) => p.studentId === student.id);
  const full = mine.length >= PET_CAP;
  const hasCoupon = !couponUsed;
  const mysteryToday = student.lastMysteryPackOpenedDate === todayISO();

  const colorsPresent = COAT_GROUPS.filter((g) => roster.some((p) => coatFor(p.defId).group === g));
  const shown = roster
    .filter((p) => (age === 'all' || p.age === age) && (animal === 'all' || petDefById(p.defId)?.category === animal) && (color === 'all' || coatFor(p.defId).group === color))
    .sort((a, b) => Number(adopted.has(a.id)) - Number(adopted.has(b.id)) || PET_AGES.indexOf(a.age) - PET_AGES.indexOf(b.age));

  const startAdopt = (pet: ShelterPet) => {
    const useCoupon = hasCoupon;
    setFlow({ kind: 'name', defId: pet.defId, age: pet.age, sex: pet.sex, name: pet.name, via: useCoupon ? 'coupon' : 'shelter', price: useCoupon ? 0 : PET_PRICE_CENTS, shelterId: pet.id });
  };
  const finishAdopt = (f: Extract<Flow, { kind: 'name' }>) => {
    if (busy.current) return;
    busy.current = true;
    let id: string | null = f.petId ?? null;
    if (id) {
      // A Mystery Box pet is already adopted (paid when the box opened); this only names it.
      renamePet(id, f.name);
      mergeStyleRow(`petcert:${id}`, { petName: f.name.trim() });
    } else {
      id = adoptPetV2(student.id, { defId: f.defId, name: f.name, age: f.age, sex: f.sex, via: f.via, priceCents: f.price, shelterId: f.shelterId });
      if (id && f.price > 0) playCashRegister();
    }
    busy.current = false;
    if (!id) return;
    playCheer();
    setCelebrate((n) => n + 1);
    const def = petDefById(f.defId);
    setFlow({ kind: 'cert', petId: id, defId: f.defId, cert: { petId: id, studentName: student.name, petName: f.name.trim() || def?.name || 'Pet', breed: def?.name ?? 'Pet', sex: f.sex, date: new Date().toISOString(), via: f.via } });
  };
  const openBox = () => {
    if (busy.current || full || mysteryToday || student.coins < MYSTERY_BOX_CENTS) return;
    busy.current = true;
    const def = rollMysteryBreed(new Set(mine.map((p) => p.petDefId)));
    const sex = Math.random() < 0.5 ? 'Boy' : 'Girl';
    // Paid and adopted when the box is opened, so leaving during the reveal never loses the money
    // or the pet; the name step after the reveal only renames it.
    const name = randomPetName();
    const petId = adoptPetV2(student.id, { defId: def.id, name, age: 'baby', sex, via: 'mystery', priceCents: MYSTERY_BOX_CENTS });
    if (!petId) { busy.current = false; return; }
    playCashRegister();
    updateStudent(student.id, { lastMysteryPackOpenedDate: todayISO() });
    const wait = reduceMotion() ? 1200 : 5000;
    setFlow({ kind: 'box', stage: 'wiggle', defId: def.id, sex, petId, name });
    stopMusic.current = playAnticipation(wait);
    window.setTimeout(() => {
      playReveal();
      setCelebrate((n) => n + 1);
      setFlow({ kind: 'box', stage: 'burst', defId: def.id, sex, petId, name });
      busy.current = false;
    }, wait);
  };

  return (
    <div className="pf">
      {celebrate > 0 && <Celebration key={celebrate} />}
      <header className="pf-head">
        <button type="button" className="btn pf-back" onClick={back.go} aria-label={`Back to ${back.label}`}>← {back.label}</button>
        <h1 className="pf-title">Pet Finder</h1>
        <span className="pf-chip" title="Your money">💵 {formatMoney(student.coins)}</span>
        <span className="pf-chip" title="Your pets">🏠 {mine.length} / {PET_CAP} pets</span>
      </header>

      {hasCoupon && <div className="pf-coupon">🎟️ You have a free pet coupon! Pick any pet below and adopt it for free.</div>}
      {full && <div className="pf-note">Your home is full ({PET_CAP} pets). Every pet here still loves a visit!</div>}

      <section className="pf-box-card">
        <div className={`pf-gift${reduceMotion() ? '' : ' idle'}`} aria-hidden="true"><i className="pf-gift-lid" /><i className="pf-gift-bow" /><i className="pf-gift-body" /></div>
        <div className="pf-box-text">
          <h2>Mystery Adoption Box</h2>
          <p>Always a pet inside. Which one is the surprise! One box a day.</p>
        </div>
        <button type="button" className="btn btn-primary btn-lg pf-box-btn" disabled={full || mysteryToday || student.coins < MYSTERY_BOX_CENTS} onClick={() => setFlow({ kind: 'box', stage: 'confirm' })}>
          {mysteryToday ? 'Come back tomorrow!' : full ? 'Home is full' : `Open for ${formatMoney(MYSTERY_BOX_CENTS)}`}
        </button>
      </section>

      <section className="pf-filters" aria-label="Filters">
        <div className="pf-filter-row"><span>Age</span>
          {(['all', ...PET_AGES] as const).map((a) => <button key={a} type="button" className={`pf-pill${age === a ? ' on' : ''}`} onClick={() => setAge(a)}>{a === 'all' ? 'All' : AGE_LABEL[a]}</button>)}
        </div>
        <div className="pf-filter-row"><span>Animal</span>
          {(['all', 'dog', 'cat'] as const).map((a) => <button key={a} type="button" className={`pf-pill${animal === a ? ' on' : ''}`} onClick={() => setAnimal(a)}>{a === 'all' ? 'All' : a === 'dog' ? 'Dogs' : 'Cats'}</button>)}
        </div>
        <div className="pf-filter-row"><span>Fur color</span>
          {['all', ...colorsPresent].map((c) => <button key={c} type="button" className={`pf-pill${color === c ? ' on' : ''}`} onClick={() => setColor(c)}>{c === 'all' ? 'All' : c}</button>)}
        </div>
      </section>

      <p className="pf-count">{shown.length} {shown.length === 1 ? 'pet' : 'pets'} looking for a home in the present. New pets arrive every day.</p>
      <div className="pf-grid">
        {shown.map((p) => {
          const def = petDefById(p.defId);
          const isAdopted = adopted.has(p.id);
          const lastDay = p.leavesDay - day === 1;
          const isNew = p.arrivedDay === day;
          return (
            <article key={p.id} className={`pf-card${isAdopted ? ' adopted' : ''}`}>
              <h3 className="pf-card-name">{p.name}</h3>
              <button type="button" className="pf-card-portrait" onClick={() => !isAdopted && setFlow({ kind: 'detail', pet: p })} disabled={isAdopted} aria-label={isAdopted ? `${p.name} was adopted` : `Meet ${p.name}`}>
                <PetPortrait defId={p.defId} size={118} alt={p.name} />
                {isAdopted && <span className="pf-hearts" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ transform: `rotate(${i * 36}deg) translateY(-70px) rotate(${-i * 36}deg)` }}>💗</i>)}</span>}
                {!isAdopted && isNew && <span className="pf-badge new">New!</span>}
                {!isAdopted && !isNew && lastDay && <span className="pf-badge last">Pending adoption</span>}
              </button>
              <div className="pf-card-facts">
                <span className={`pf-age ${p.age}`}>{AGE_LABEL[p.age]}</span>
                <span>{def?.name}</span>
                <span>{p.sex} · {coatFor(p.defId).label}</span>
              </div>
              {isAdopted
                ? <div className="pf-adopted-stamp">💕 Adopted!</div>
                : <button type="button" className="btn btn-primary pf-adopt" disabled={full || (!hasCoupon && student.coins < PET_PRICE_CENTS)} onClick={() => startAdopt(p)}>
                    {hasCoupon ? 'Adopt free' : `Adopt ${formatMoney(PET_PRICE_CENTS)}`}
                  </button>}
            </article>
          );
        })}
        {shown.length === 0 && <p className="pf-empty">No pets match these filters in the present. Try another age, animal or color.</p>}
      </div>

      {flow && (
        <div className="pf-overlay" onClick={() => (flow.kind === 'detail' || (flow.kind === 'box' && flow.stage === 'confirm')) && setFlow(null)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            {flow.kind === 'detail' && (() => {
              const p = flow.pet, def = petDefById(p.defId);
              return (
                <div className="pf-detail">
                  <div className="pf-detail-portrait"><PetPortrait defId={p.defId} size={220} alt={p.name} /></div>
                  <div className="pf-detail-text">
                    <h2>Meet {p.name}!</h2>
                    <p className="pf-detail-facts"><span className={`pf-age ${p.age}`}>{AGE_LABEL[p.age]}</span> {p.sex} {def?.name}, {coatFor(p.defId).label.toLowerCase()}</p>
                    {def && <p>{p.name} {bioFor(def).slice(def.name.length + 1)}</p>}
                    <p className="pf-detail-stay">{p.leavesDay - day === 1 ? `${p.name} has an adoption pending. Adopt ${p.name} soon if you want this pet!` : `${p.name} will be at the shelter for ${p.leavesDay - day} more days.`}</p>
                    <div className="pf-detail-actions">
                      <button type="button" className="btn btn-primary btn-lg" disabled={full || (!hasCoupon && student.coins < PET_PRICE_CENTS)} onClick={() => startAdopt(p)}>{hasCoupon ? `Adopt ${p.name} free` : `Adopt ${p.name} for ${formatMoney(PET_PRICE_CENTS)}`}</button>
                      <button type="button" className="btn btn-lg" onClick={() => setFlow(null)}>Keep looking</button>
                    </div>
                    {!full && !hasCoupon && student.coins < PET_PRICE_CENTS && <p className="pf-detail-stay">You need {formatMoney(PET_PRICE_CENTS - student.coins)} more to adopt.</p>}
                  </div>
                </div>
              );
            })()}

            {flow.kind === 'name' && (
              <form className="pf-name" onSubmit={(e) => { e.preventDefault(); finishAdopt(flow); }}>
                <PetPortrait defId={flow.defId} size={160} />
                <h2>What will you name your new {flow.age === 'baby' ? (petDefById(flow.defId)?.category === 'cat' ? 'kitten' : 'puppy') : 'friend'}?</h2>
                <input id="pf-pet-name" className="pf-name-input" value={flow.name} maxLength={16} onChange={(e) => setFlow({ ...flow, name: e.target.value })} aria-label="Pet name" autoFocus />
                <div className="pf-detail-actions">
                  <button type="submit" className="btn btn-primary btn-lg" disabled={!flow.name.trim()}>{flow.petId ? `Name my pet ${flow.name.trim() || '...'}` : flow.price > 0 ? `Adopt for ${formatMoney(flow.price)}` : flow.via === 'coupon' ? 'Use my coupon' : 'Adopt!'}</button>
                  {flow.via !== 'mystery' && <button type="button" className="btn btn-lg" onClick={() => setFlow(null)}>Not yet</button>}
                </div>
              </form>
            )}

            {flow.kind === 'cert' && (
              <AdoptionCertificate cert={flow.cert} defId={flow.defId}>
                <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/world/home-room')}>Take {flow.cert.petName} home</button>
                <button type="button" className="btn btn-lg" onClick={() => setFlow(null)}>Keep looking</button>
              </AdoptionCertificate>
            )}

            {flow.kind === 'box' && flow.stage === 'confirm' && (
              <div className="pf-name">
                <div className="pf-gift big" aria-hidden="true"><i className="pf-gift-lid" /><i className="pf-gift-bow" /><i className="pf-gift-body" /></div>
                <h2>Open a Mystery Adoption Box for {formatMoney(MYSTERY_BOX_CENTS)}?</h2>
                <p>There is always a baby pet inside.</p>
                <div className="pf-detail-actions">
                  <button type="button" className="btn btn-primary btn-lg" onClick={openBox}>Open it!</button>
                  <button type="button" className="btn btn-lg" onClick={() => setFlow(null)}>Not yet</button>
                </div>
              </div>
            )}
            {flow.kind === 'box' && flow.stage !== 'confirm' && flow.defId && (
              <div className="pf-name">
                <div className={`pf-gift big ${flow.stage}`} aria-hidden="true">
                  <i className="pf-gift-lid" /><i className="pf-gift-bow" /><i className="pf-gift-body" />
                  {flow.stage === 'burst' && <span className="pf-gift-pet"><PetPortrait defId={flow.defId} size={190} /></span>}
                </div>
                {flow.stage === 'wiggle' ? <h2 aria-live="polite">Something is wiggling in there...</h2> : (
                  <>
                    <h2 aria-live="polite">It's a {petDefById(flow.defId)?.name}!</h2>
                    <button type="button" className="btn btn-primary btn-lg" onClick={() => {
                      setFlow({ kind: 'name', defId: flow.defId!, age: 'baby', sex: flow.sex ?? 'Girl', name: flow.name ?? randomPetName(), via: 'mystery', price: 0, petId: flow.petId });
                    }}>Name your new pet</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
