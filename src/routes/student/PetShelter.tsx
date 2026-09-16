import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { PET_CATALOG, PET_OWNERSHIP_CAP, MYSTERY_PACK_PRICE_CENTS, bioFor, rarityFor, thumbnailFor } from '../../lib/petCatalog';
import { formatMoney } from '../../lib/money';
import { playCashRegister } from '../../lib/chime';
import type { PetDef } from '../../lib/petCatalog';

// A real rendered picture of the pet, per direct teacher instruction
// ("make sure students can see images of pets in pet store"). Not every
// model has a thumbnail PNG yet, so this falls back to the plain paw icon
// on a 404 rather than a broken image, same pattern as Build Mode's own
// AssetThumb (WorldEditor.tsx).
function PetThumb({ pet, size }: { pet: PetDef; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span style={{ fontSize: size * 0.55, lineHeight: 1 }}>🐾</span>;
  }
  return (
    <img
      src={thumbnailFor(pet)}
      alt={pet.name}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}

// The Pet Shelter — a real place in Town Square (WorldObjectRole
// 'pet-shelter'), not a tab buried in the Marketplace. Direct teacher
// spec, researched by Claudia: pets belong somewhere a student walks to
// and interacts with, the way a real animal shelter or Webkinz's own
// adoption moment works, not a plain shop grid. Every pet shown here is
// "up for adoption" and pettable whether or not a student can afford it
// yet — the interaction isn't gated behind purchase.

const DONATION_AMOUNTS = [500, 1000, 2500]; // $5 / $10 / $25 — a real, reward-free coin sink

const RARITY_LABEL: Record<string, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', ultra: 'Ultra-Rare' };
// Darkened from the initial palette after a contrast review found white text
// on the first three tiers fell below WCAG AA (4.5:1) at this small a size.
const RARITY_COLOR: Record<string, string> = { common: '#5f6f64', uncommon: '#3e7c6b', rare: '#6d3fd1', ultra: '#b8492f' };

export default function PetShelter() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const pets = useStore((s) => s.pets);
  const adoptPet = useStore((s) => s.adoptPet);
  const openMysteryPack = useStore((s) => s.openMysteryPack);
  const donateToShelter = useStore((s) => s.donateToShelter);
  const updateStudent = useStore((s) => s.updateStudent);

  const [pattedId, setPattedId] = useState<string | null>(null);
  const [adoptedFlash, setAdoptedFlash] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [reveal, setReveal] = useState<{ pet: PetDef; isNew: boolean } | null>(null);
  const [thankYou, setThankYou] = useState(false);
  // Claudia's review: Donate was sitting shoulder-to-shoulder with the
  // Mystery Box as an equally-weighted primary action, which put four
  // different decision types (adopt / mystery pull / donate / pat) on one
  // screen. Tucking it behind a toggle keeps Adopt + Mystery Box as the
  // page's one real primary action.
  const [donateOpen, setDonateOpen] = useState(false);

  const student = students.find((s) => s.id === currentStudentId);
  if (!student) return null;
  const studentId = student.id;

  const ownedPets = pets.filter((p) => p.studentId === studentId);
  const petHomeFull = ownedPets.length >= PET_OWNERSHIP_CAP;
  const canAdoptFree = !student.petCouponRedeemed;

  const givePat = (petId: string) => {
    setPattedId(petId);
    window.setTimeout(() => setPattedId((cur) => (cur === petId ? null : cur)), 700);
  };

  // Guards against a double-charge from a rapid double-tap (the button's
  // own `disabled` only updates once React re-renders with the new
  // balance, so two taps inside that window could otherwise both go
  // through and draw the price twice — easy to hit on a touchscreen).
  const adoptingRef = useRef(false);
  const handleAdopt = (pet: PetDef) => {
    if (adoptingRef.current) return;
    adoptingRef.current = true;
    const ok = adoptPet(studentId, pet.id, !canAdoptFree);
    adoptingRef.current = false;
    if (!ok) return;
    if (canAdoptFree) updateStudent(studentId, { petCouponRedeemed: true });
    else playCashRegister();
    setAdoptedFlash(pet.name);
    window.setTimeout(() => setAdoptedFlash(null), 4000);
  };

  const handleOpenPack = () => {
    if (opening || petHomeFull || student.coins < MYSTERY_PACK_PRICE_CENTS) return;
    setOpening(true);
    // A brief beat before the reveal — the actual "unboxing moment" Claudia's
    // plan calls out as the transferable Webkinz/Pokémon mechanic, not just
    // instant resolution.
    window.setTimeout(() => {
      const before = new Set(student.discoveredPetDefIds ?? []);
      const won = openMysteryPack(studentId);
      setOpening(false);
      if (won) {
        playCashRegister();
        setReveal({ pet: won, isNew: !before.has(won.id) });
      }
    }, 900);
  };

  const handleDonate = (amount: number) => {
    const ok = donateToShelter(studentId, amount);
    if (!ok) return;
    setThankYou(true);
    window.setTimeout(() => setThankYou(false), 3000);
  };

  return (
    <div className="container stack">
      {reveal && (
        <div className="overlay-backdrop" onClick={() => setReveal(null)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              {reveal.isNew && (
                <span className="tag-pill" style={{ background: 'var(--success)', color: '#fff', fontWeight: 800 }}>✨ New species!</span>
              )}
              <PetThumb pet={reveal.pet} size={96} />
              <h2 style={{ margin: 0 }}>{reveal.pet.name}</h2>
              <span className="tag-pill" style={{ background: RARITY_COLOR[rarityFor(reveal.pet)], color: '#fff' }}>
                {RARITY_LABEL[rarityFor(reveal.pet)]}
              </span>
              <p style={{ margin: 0, opacity: 0.85 }}>{bioFor(reveal.pet)}</p>
              <p style={{ fontSize: '0.78rem', opacity: 0.7, margin: 0 }}>Head to your Home Room to feed, play, and name your new pet.</p>
              <button className="btn btn-primary btn-lg" onClick={() => setReveal(null)}>Yay!</button>
            </div>
          </div>
        </div>
      )}

      <div className="shop-panel">
        <div className="shop-header">
          <span className="shop-ribbon">🐾 PET SHELTER</span>
          <div className="row" style={{ gap: 8 }}>
            <span className="shop-balance-chip" title="Your Piggy Bank balance">🐷 {formatMoney(student.coins)}</span>
            <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => navigate('/student/pet-journal')}>📖 Journal</button>
            <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => navigate('/world/town')} aria-label="Go to Town Square">🌳 Town Square</button>
            <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => navigate('/student/home')}>🏠 Home</button>
          </div>
        </div>

        <div className="stack" style={{ gap: 16, padding: '12px 0' }}>
          {canAdoptFree && (
            <div className="content-well" style={{ background: 'linear-gradient(120deg, var(--yellow), var(--orange))', textAlign: 'center' }}>
              <strong>🎁 You have a free pet coupon! Pick any pet below to redeem it.</strong>
            </div>
          )}
          {petHomeFull && (
            <div className="content-well" style={{ textAlign: 'center', opacity: 0.85 }}>
              🏠 Your pet home is full ({PET_OWNERSHIP_CAP}/{PET_OWNERSHIP_CAP}). Visit Home to care for, rename, or sell a pet before adopting another.
            </div>
          )}
          {adoptedFlash && (
            <div className="content-well" style={{ background: 'var(--success)', color: '#fff', textAlign: 'center' }}>
              🎉 {adoptedFlash} is home! Head to your Home Room to feed, play, and name your new pet.
            </div>
          )}

          {/* Mystery Adoption Box — the page's one featured action, per Claudia's review */}
          <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
            <strong>🎁 Mystery Adoption Box</strong>
            <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>You'll always get a pet. Which one is the surprise!</p>
            <button
              className="btn btn-primary btn-lg"
              disabled={opening || petHomeFull || student.coins < MYSTERY_PACK_PRICE_CENTS}
              onClick={handleOpenPack}
            >
              {opening ? 'Opening…' : petHomeFull ? '🏠 Pet home full' : `🎁 Open for ${formatMoney(MYSTERY_PACK_PRICE_CENTS)}`}
            </button>
          </div>

          {/* Donate — a secondary, reward-free coin sink, tucked behind a toggle */}
          <div className="content-well stack" style={{ gap: 8 }}>
            <button className="btn btn-sm" style={{ minHeight: 44, alignSelf: 'flex-start' }} onClick={() => setDonateOpen((v) => !v)}>
              {donateOpen ? '▾' : '▸'} 💛 Donate to the Shelter
            </button>
            {donateOpen && (
              <div className="stack" style={{ gap: 8, alignItems: 'center', textAlign: 'center' }}>
                <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
                  {thankYou ? 'Thank you for your donation! 💛' : `Lifetime donated: ${formatMoney(student.shelterDonationsCents ?? 0)}`}
                </p>
                <div className="row" style={{ gap: 6 }}>
                  {DONATION_AMOUNTS.map((amt) => (
                    <button key={amt} className="btn btn-sm" style={{ minHeight: 44 }} disabled={student.coins < amt} onClick={() => handleDonate(amt)}>
                      {formatMoney(amt)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Kennel grid — every catalog pet, pettable whether or not you can afford it */}
          <div className="shop-item-grid">
            {PET_CATALOG.map((pet) => {
              const affordable = student.coins >= pet.priceCents;
              const disabled = petHomeFull || (!canAdoptFree && !affordable);
              const isPatted = pattedId === pet.id;
              return (
                <div key={pet.id} className="shop-item-card" style={{ width: 150 }}>
                  <div
                    className="shop-item-icon-frame"
                    style={{ position: 'relative', transform: isPatted ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.2s' }}
                  >
                    <PetThumb pet={pet} size={56} />
                    {isPatted && (
                      <span style={{ position: 'absolute', top: -4, right: -4, fontSize: '1.2rem' }}>💛</span>
                    )}
                  </div>
                  <strong style={{ fontSize: '0.75rem' }}>{pet.name}</strong>
                  <span className="tag-pill" style={{ fontSize: '0.58rem', background: RARITY_COLOR[rarityFor(pet)], color: '#fff' }}>
                    {RARITY_LABEL[rarityFor(pet)]}
                  </span>
                  <button className="btn btn-sm" style={{ minHeight: 44, fontSize: '0.68rem' }} onClick={() => givePat(pet.id)}>
                    🤗 Give a pat
                  </button>
                  <button
                    className={`shop-price-chip ${canAdoptFree ? 'btn-primary' : ''}`}
                    style={{
                      border: '2px solid var(--ink)',
                      minHeight: 44,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.5 : 1,
                      background: canAdoptFree && !disabled ? 'var(--success)' : undefined,
                      color: canAdoptFree && !disabled ? '#fff' : undefined,
                    }}
                    disabled={disabled}
                    onClick={() => handleAdopt(pet)}
                  >
                    {canAdoptFree ? '🎁 Adopt free!' : `🐾 ${formatMoney(pet.priceCents)}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
