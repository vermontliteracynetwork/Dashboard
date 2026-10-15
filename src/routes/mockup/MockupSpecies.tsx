import { Suspense, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Html } from '@react-three/drei';
import { useSearchParams } from 'react-router-dom';
import { StyleCharacter } from '../../style/StyleCharacter';
import { SKIN_TONES, SKIN_TONE_LIST, SPECIES, defaultLook, speciesById } from '../../style/species';
import { HAIR_MOCKUP, WARDROBE, itemById } from '../../style/wardrobe';
import type { SpeciesId, StyleLook, WardrobeSlot } from '../../style/types';

// MOCK-UP ONLY: a fit check sheet for new Style characters (not part of the live build; open mockup.html).
// ?sp=fox&view=front|side|back shows that animal wearing every clothing and accessory item, one per cell;
// ?mode=outfits shows every animal in the same full outfits side by side (&sps=person,dog,... &o=0-3);
// ?mode=hair shows every hairstyle on the person in six skin tones (&view=; Build Queue 213: only the Person wears
// hair now); ?mode=skin the person in all twelve skin tones (Build Queue 214); ?mode=hairhats every hairstyle under every
// hat on the person; ?mode=people a class of people (skin tones, hair, outfits). Build Queue 195: the person
// always wears hair (Short Hair unless the cell says otherwise).
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
const dress = (species: SpeciesId, outfit: Partial<Record<WardrobeSlot, string>>, skin?: string): StyleLook => {
  const l = defaultLook(species);
  if (skin) { const p = { pattern: 'solid' as const, colors: [skin, '#ffffff'] as [string, string] }; l.body = { ...l.body, fur: p, belly: p, accent: p }; }
  const all = species === 'person' && !('hair' in outfit) ? { hair: 'hair-short', ...outfit } : outfit;
  for (const [slot, id] of Object.entries(all)) {
    const it = id ? itemById(id) : undefined; if (!it) continue;
    l.outfit[slot as WardrobeSlot] = { itemId: it.id, zones: it.zones.map((z) => z.paint) };
  }
  return l;
};
const HATS = WARDROBE.filter((w) => w.slot === 'hat');
const HAIR_COLORS = ['#5b3a24', '#2b2220', '#e8c26a', '#8a3b1f', '#c98a3a', '#1f1a18', '#a0522d', '#ff8fc8'];
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
      return OUTFITS.slice(a, b + 1).flatMap((o, r) => ids.map((id, c) => ({ key: `${r}-${id}`, look: dress(id, o), label: r === 0 ? speciesById(id).name : '', col: c, row: r })));
    }
    if (mode === 'hair') {
      const [a, b] = (q.get('o') ?? `0-${HAIR_MOCKUP.length - 1}`).split('-').map(Number);
      const tones = [0, 2, 4, 6, 8, 10].map((i) => SKIN_TONES[i]);
      return HAIR_MOCKUP.slice(a, b + 1).flatMap((hr, r) => tones.map((tone, c) => ({ key: `${hr.id}-${c}`, look: dress('person', { hair: hr.id }, tone), label: c === 0 ? hr.name : '', col: c, row: r })));
    }
    if (mode === 'skin') {
      return SKIN_TONE_LIST.map((t, i) => ({ key: t.hex, look: dress('person', { ...OUTFITS[1 + (i % 7)], hair: HAIR_MOCKUP[i % HAIR_MOCKUP.length].id }, t.hex), label: t.name, col: i % 6, row: Math.floor(i / 6) }));
    }
    if (mode === 'hairhats') {
      const [a, b] = (q.get('o') ?? `0-${HAIR_MOCKUP.length - 1}`).split('-').map(Number);
      return HAIR_MOCKUP.slice(a, b + 1).flatMap((hr, r) => HATS.map((hat, c) => ({ key: `${hr.id}-${hat.id}`, look: dress('person', { hair: hr.id, hat: hat.id }, SKIN_TONES[(r + c) % SKIN_TONES.length]), label: `${hr.name} + ${hat.name}`, col: c, row: r })));
    }
    if (mode === 'people') {
      return HAIR_MOCKUP.map((hr, i) => {
        const look = dress('person', { ...OUTFITS[i], hair: hr.id }, SKIN_TONES[i % SKIN_TONES.length]);
        if (look.outfit.hair) look.outfit.hair.zones = [{ pattern: 'solid', colors: [HAIR_COLORS[i], '#ffffff'] }];
        return { key: hr.id, look, label: hr.name, col: i % 4, row: Math.floor(i / 4) };
      });
    }
    const items = [{ id: '', name: 'No clothes', slot: '' as WardrobeSlot | '' }, ...WARDROBE.map((w) => ({ id: w.id, name: w.name, slot: w.slot }))];
    return items.map((it, i) => ({ key: it.id || 'none', look: it.id ? dress(sp, { [it.slot]: it.id }) : dress(sp, {}), label: it.name, col: i % 6, row: Math.floor(i / 6) }));
  }, [mode, sp, q]);
  const cols = Math.max(...cells.map((c) => c.col)) + 1;
  const rows = Math.max(...cells.map((c) => c.row)) + 1;
  const DX = 1.45, DY = 2.25;
  const w = cols * 260, h = rows * 400;
  return (
    <div style={{ width: w, height: h + 60, background: '#f4f1fb', fontFamily: 'Nunito, sans-serif' }}>
      <div style={{ height: 60, display: 'flex', alignItems: 'center', padding: '0 20px', fontSize: 26, fontWeight: 800, color: '#2b2350' }}>
        {mode === 'outfits' ? 'Every character in the same outfits' : mode === 'hair' ? `Every hairstyle on the Person, in six skin tones (${view} view)` : mode === 'skin' ? 'The Person in twelve skin tones' : mode === 'hairhats' ? 'Hair under every hat' : mode === 'people' ? `People (${view} view)` : `${speciesById(sp).emoji} ${speciesById(sp).name}: every item (${view} view)`}
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
