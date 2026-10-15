import { Suspense, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Html } from '@react-three/drei';
import { useSearchParams } from 'react-router-dom';
import { StyleCharacter } from '../../style/StyleCharacter';
import { SPECIES, defaultLook } from '../../style/species';
import { WARDROBE } from '../../style/wardrobe';
import type { SpeciesId, StyleLook, WardrobeSlot } from '../../style/types';

// MOCK-UP ONLY (2026-10-15, local branch mockup/new-species, never merged): a fit check sheet for new Style animals.
// ?sp=fox&view=front|side|back shows that animal wearing every clothing and accessory item, one per cell;
// ?mode=outfits shows every animal in the same full outfits side by side.
const OUTFITS: Partial<Record<WardrobeSlot, string>>[] = [
  {},
  { top: 'tee', bottom: 'pants', shoes: 'sneakers', hat: 'cap', back: 'backpack' },
  { top: 'dress', shoes: 'boots', hat: 'crown', face: 'heartglasses', back: 'wings' },
  { top: 'hoodie', bottom: 'shorts', shoes: 'rainboots', hat: 'beanie', gear: 'headphones' },
  { top: 'longsleeve', bottom: 'skirt', hat: 'tophat', face: 'roundglasses', back: 'cape' },
  { top: 'tank', bottom: 'shorts', hat: 'partyhat', face: 'starglasses', gear: 'eardefenders' },
  { top: 'tee', bottom: 'pants', hat: 'buckethat', face: 'squareglasses', shoes: 'boots' },
  { top: 'longsleeve', bottom: 'pants', hat: 'cheesehat', shoes: 'sneakers' },
];
const dress = (species: SpeciesId, outfit: Partial<Record<WardrobeSlot, string>>): StyleLook => {
  const l = defaultLook(species);
  for (const [slot, id] of Object.entries(outfit)) {
    const it = WARDROBE.find((w) => w.id === id); if (!it) continue;
    l.outfit[slot as WardrobeSlot] = { itemId: it.id, zones: it.zones.map((z) => z.paint) };
  }
  return l;
};
const ROT: Record<string, number> = { front: 0, side: Math.PI / 2, back: Math.PI, three: Math.PI / 5 };

// Draw a handful of frames (enough for the pose and every hat to settle), then stop, so a slow test browser can take the picture.
function Kick({ cx, cy }: { cx: number; cy: number }) {
  const invalidate = useThree((st) => st.invalidate);
  const camera = useThree((st) => st.camera);
  useEffect(() => { camera.position.set(cx, cy, 20); camera.lookAt(cx, cy, 0); camera.updateProjectionMatrix(); invalidate(); }, [camera, cx, cy, invalidate]);
  useEffect(() => { let n = 0; const t = window.setInterval(() => { invalidate(); if (++n > 40) { window.clearInterval(t); (window as unknown as { mockDone?: boolean }).mockDone = true; } }, 250); return () => window.clearInterval(t); }, [invalidate]);
  return null;
}

export default function MockupSpecies() {
  const [q] = useSearchParams();
  const mode = q.get('mode') ?? 'items';
  const sp = (q.get('sp') ?? 'fox') as SpeciesId;
  const view = q.get('view') ?? 'front';
  const cells = useMemo(() => {
    if (mode === 'outfits') {
      const ids = (q.get('sps') ?? SPECIES.map((s) => s.id).join(',')).split(',') as SpeciesId[];
      const [a, b] = (q.get('o') ?? `0-${OUTFITS.length - 1}`).split('-').map(Number);
      return OUTFITS.slice(a, b + 1).flatMap((o, r) => ids.map((id, c) => ({ key: `${r}-${id}`, look: dress(id, o), label: r === 0 ? SPECIES.find((s) => s.id === id)!.name : '', col: c, row: r })));
    }
    const items = [{ id: '', name: 'No clothes', slot: '' as WardrobeSlot | '' }, ...WARDROBE.map((w) => ({ id: w.id, name: w.name, slot: w.slot }))];
    return items.map((it, i) => ({ key: it.id || 'none', look: it.id ? dress(sp, { [it.slot]: it.id }) : defaultLook(sp), label: it.name, col: i % 6, row: Math.floor(i / 6) }));
  }, [mode, sp, q]);
  const cols = Math.max(...cells.map((c) => c.col)) + 1;
  const rows = Math.max(...cells.map((c) => c.row)) + 1;
  const DX = 1.45, DY = 2.25;
  const w = cols * 260, h = rows * 400;
  return (
    <div style={{ width: w, height: h + 60, background: '#f4f1fb', fontFamily: 'Nunito, sans-serif' }}>
      <div style={{ height: 60, display: 'flex', alignItems: 'center', padding: '0 20px', fontSize: 26, fontWeight: 800, color: '#2b2350' }}>
        {mode === 'outfits' ? 'Every animal in the same outfits' : `${SPECIES.find((s) => s.id === sp)?.emoji} ${SPECIES.find((s) => s.id === sp)?.name}: every item (${view} view)`}
      </div>
      <Canvas style={{ width: w, height: h }} orthographic dpr={1} frameloop="demand" gl={{ preserveDrawingBuffer: true, antialias: true }}
        camera={{ position: [((cols - 1) * DX) / 2, -((rows - 1) * DY) / 2 + 0.85, 20], zoom: 260 / DX, near: 0.1, far: 100 }}>
        <ambientLight intensity={0.85} />
        <hemisphereLight args={['#ffffff', '#f3d6ff', 0.5]} />
        <directionalLight position={[2.5, 4, 6]} intensity={1.2} />
        <directionalLight position={[-3, 2, -4]} intensity={0.45} color="#b8d8ff" />
        <Suspense fallback={null}>
          <Kick cx={((cols - 1) * DX) / 2} cy={-((rows - 1) * DY) / 2 + 0.85} />
          {cells.map((c) => (
            <group key={c.key} position={[c.col * DX, -c.row * DY, 0]}>
              <group rotation={[0, ROT[view] ?? 0, 0]}><StyleCharacter look={c.look} move="idle" reduceMotion /></group>
              {c.label && <Html position={[0, -0.12, 0]} center style={{ whiteSpace: 'nowrap', fontWeight: 800, fontSize: 17, color: '#2b2350', background: '#ffffffcc', padding: '1px 8px', borderRadius: 8 }}>{c.label}</Html>}
            </group>
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
}
