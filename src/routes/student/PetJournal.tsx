import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { PET_CATALOG, type PetCategory, bioFor, rarityFor } from '../../lib/petCatalog';

// The Pet Journal — a Pokédex/Webkinz-shelf hybrid (Claudia's plan, Phase
// 1). Every species a student has EVER discovered stays a filled card
// forever, even after that exact pet is sold; everything else shows as a
// silhouette with just a category hint. This is what makes "collect them
// all" mean something even though only 4 pets can be live-owned at once.

const CATEGORY_LABEL: Record<PetCategory, string> = {
  dog: 'Dog', cat: 'Cat', small: 'Small Critter', farm: 'Farm', bird: 'Bird', aquatic: 'Aquatic', wild: 'Wild', fun: 'Fun & Silly',
};
const RARITY_LABEL: Record<string, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', ultra: 'Ultra-Rare' };
// Darkened from the initial palette after a contrast review found white text
// on the first three tiers fell below WCAG AA (4.5:1) at this small a size.
const RARITY_COLOR: Record<string, string> = { common: '#5f6f64', uncommon: '#3e7c6b', rare: '#6d3fd1', ultra: '#b8492f' };

export default function PetJournal() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const [category, setCategory] = useState<PetCategory | ''>('');

  const student = students.find((s) => s.id === currentStudentId);
  if (!student) return null;

  const discovered = new Set(student.discoveredPetDefIds ?? []);
  const filtered = category ? PET_CATALOG.filter((p) => p.category === category) : PET_CATALOG;
  const categories = Array.from(new Set(PET_CATALOG.map((p) => p.category)));
  const discoveredCount = PET_CATALOG.filter((p) => discovered.has(p.id)).length;

  return (
    <div className="container stack">
      <div className="shop-panel">
        <div className="shop-header">
          <span className="shop-ribbon">📖 PET JOURNAL</span>
          <div className="row" style={{ gap: 8 }}>
            <span className="shop-balance-chip" title="Species discovered so far">
              {discoveredCount} / {PET_CATALOG.length} discovered
            </span>
            <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => navigate('/student/pet-shelter')}>🐾 Shelter</button>
            <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => navigate('/world/town')} aria-label="Go to Town Square">🌳 Town Square</button>
            <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => navigate('/student/home')}>🏠 Home</button>
          </div>
        </div>

        <div className="row-wrap" style={{ gap: 4, padding: '10px 0' }}>
          <button className="btn btn-sm" style={{ minHeight: 44, background: category === '' ? 'var(--purple)' : undefined, color: category === '' ? '#fff' : undefined }} onClick={() => setCategory('')}>
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className="btn btn-sm"
              style={{ minHeight: 44, background: category === c ? 'var(--purple)' : undefined, color: category === c ? '#fff' : undefined }}
              onClick={() => setCategory(category === c ? '' : c)}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        <div className="shop-item-grid" style={{ paddingBottom: 16 }}>
          {filtered.map((pet) => {
            const isDiscovered = discovered.has(pet.id);
            return (
              <div key={pet.id} className="shop-item-card" style={{ width: 160, opacity: isDiscovered ? 1 : 0.55 }}>
                <div className="shop-item-icon-frame" style={{ background: isDiscovered ? undefined : 'repeating-linear-gradient(45deg, #ddd, #ddd 6px, #eee 6px, #eee 12px)' }}>
                  <span style={{ fontSize: '2rem' }}>{isDiscovered ? '🐾' : '❓'}</span>
                </div>
                {isDiscovered ? (
                  <>
                    <strong style={{ fontSize: '0.78rem' }}>{pet.name}</strong>
                    <span className="tag-pill" style={{ fontSize: '0.58rem', background: RARITY_COLOR[rarityFor(pet)], color: '#fff' }}>
                      {RARITY_LABEL[rarityFor(pet)]}
                    </span>
                    <p style={{ fontSize: '0.68rem', opacity: 0.75, margin: '4px 0 0' }}>{bioFor(pet)}</p>
                  </>
                ) : (
                  <>
                    <strong style={{ fontSize: '0.78rem', opacity: 0.6 }}>???</strong>
                    <span className="tag-pill" style={{ fontSize: '0.58rem' }}>{CATEGORY_LABEL[pet.category]}</span>
                    <p style={{ fontSize: '0.68rem', opacity: 0.6, margin: '4px 0 0' }}>A {CATEGORY_LABEL[pet.category].toLowerCase()}... somewhere out there.</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
