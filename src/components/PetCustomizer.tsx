import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, useGLTF, useAnimations } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { useStore } from '../store/store';
import { PET_CATALOG, PET_TRICKS, petDefById, thumbnailFor, type PetDef } from '../lib/petCatalog';
import { formatMoney } from '../lib/money';

// Full-screen pet viewer, modeled on the teacher-supplied Boddle
// "Customize your Boddle" reference: the pet big in the middle on a bright
// patterned background, a ribbon title, a back button top-left, icon tabs
// above one scrolling strip of big choices (‹ ›), a green check on the
// current choice, and Reset. One component, two uses:
//   - student: customize one of their own pets (color, tricks, name, and
//     switch between their pets); every change saves right away through
//     the same store actions Home Room's pet card already uses.
//   - teacher: browse the whole adoptable pet catalog in the same viewer,
//     with a color preview (preview only, nothing saved).

// Same 12-color palette as Home Room's pet card and Build Mode's paint tool.
const PET_SWATCHES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#78350f', '#64748b', '#ffffff'];

function PetModel({ def, tint }: { def: PetDef; tint: string | null }) {
  const { scene, animations } = useGLTF(def.modelPath);
  const cloned = useMemo(() => {
    const c = cloneSkinned(scene);
    if (tint) {
      const color = new THREE.Color(tint);
      c.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const applyTint = (mat: THREE.Material) => {
          const m = mat.clone();
          if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhongMaterial || m instanceof THREE.MeshBasicMaterial) m.color = color;
          return m;
        };
        child.material = Array.isArray(child.material) ? child.material.map(applyTint) : applyTint(child.material);
      });
    }
    return c;
  }, [scene, tint]);
  // Every pet fills the same stage regardless of its raw export size.
  const { scale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = Math.max(size.x, size.y, size.z) > 0 ? 2 / Math.max(size.x, size.y, size.z) : 1;
    return { scale: s, offset: new THREE.Vector3(-center.x * s, -box.min.y * s, -center.z * s) };
  }, [scene]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  useEffect(() => {
    const idleKey = Object.keys(actions).find((k) => k.toLowerCase().includes('idle'));
    const idle = idleKey ? actions[idleKey] : undefined;
    idle?.reset().play();
    return () => { idle?.stop(); };
  }, [actions]);
  return (
    <group ref={group} position={offset}>
      <primitive object={cloned} scale={scale} />
    </group>
  );
}

function PetStage({ def, tint }: { def: PetDef; tint: string | null }) {
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return (
    <Canvas camera={{ position: [0, 1.4, 4], fov: 38 }} dpr={[1, 2]}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={1.2} />
      <Suspense fallback={null}>
        <PetModel key={def.id} def={def} tint={tint} />
      </Suspense>
      <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={5} blur={2.5} far={3} />
      <OrbitControls target={[0, 0.9, 0]} enablePan={false} enableZoom={false} autoRotate={!reduceMotion} autoRotateSpeed={1.2} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 2} />
    </Canvas>
  );
}

function Thumb({ def }: { def: PetDef }) {
  const [broken, setBroken] = useState(false);
  return broken ? (
    <span className="pc-thumb-fallback" aria-hidden="true">🐾</span>
  ) : (
    <img className="pc-thumb" src={thumbnailFor(def)} alt="" onError={() => setBroken(true)} />
  );
}

type Tab = 'pets' | 'color' | 'tricks' | 'name';
const TAB_META: Record<Tab, { icon: string; label: string }> = {
  pets: { icon: '🐾', label: 'Pets' },
  color: { icon: '🎨', label: 'Color' },
  tricks: { icon: '⭐', label: 'Tricks' },
  name: { icon: '✏️', label: 'Name' },
};

export type PetCustomizerProps =
  | { mode: 'student'; studentId: string; initialPetId: string; onClose: () => void }
  | { mode: 'teacher'; onClose: () => void };

export default function PetCustomizer(props: PetCustomizerProps) {
  const allPets = useStore((s) => s.pets);
  const tintPet = useStore((s) => s.tintPet);
  const teachTrick = useStore((s) => s.teachTrick);
  const renamePet = useStore((s) => s.renamePet);

  const ownPets = props.mode === 'student' ? allPets.filter((p) => p.studentId === props.studentId) : [];
  const [petId, setPetId] = useState(props.mode === 'student' ? props.initialPetId : '');
  const [catalogId, setCatalogId] = useState(PET_CATALOG[0]?.id ?? '');
  const [previewTint, setPreviewTint] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(props.mode === 'student' ? 'color' : 'pets');
  const stripRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  const pet = ownPets.find((p) => p.id === petId) ?? ownPets[0];
  const def = props.mode === 'student' ? (pet ? petDefById(pet.petDefId) : undefined) : PET_CATALOG.find((p) => p.id === catalogId);
  const tint = props.mode === 'student' ? pet?.tintColor ?? null : previewTint;
  const displayName = props.mode === 'student' ? pet?.customName || def?.name || 'pet' : def?.name ?? 'pet';

  // Focus the back button on open, Escape closes, return focus after.
  // (onClose read through a ref so a parent passing an inline arrow
  // doesn't re-run this and steal focus on every render.)
  const { onClose } = props;
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    backRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, []);

  const tabs: Tab[] = props.mode === 'student' ? ['color', 'tricks', 'name', ...(ownPets.length > 1 ? (['pets'] as Tab[]) : [])] : ['pets', 'color'];

  const setTint = (c: string | null) => {
    if (props.mode === 'student') { if (pet) tintPet(pet.id, c); } else setPreviewTint(c);
  };

  const scrollStrip = (dir: 1 | -1) => {
    const el = stripRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const commitName = (input: HTMLInputElement) => {
    const trimmed = input.value.trim();
    if (!pet) return;
    if (!trimmed) { input.value = pet.customName; return; }
    if (trimmed !== pet.customName) renamePet(pet.id, trimmed);
  };

  let strip: React.ReactNode = null;
  if (tab === 'color') {
    strip = (
      <>
        <button type="button" className="pc-tile pc-tile-swatch pc-original" aria-pressed={!tint} onClick={() => setTint(null)}>
          <span>Original</span>
          {!tint && <span className="pc-check" aria-hidden="true">✓</span>}
        </button>
        {PET_SWATCHES.map((c) => (
          <button key={c} type="button" className="pc-tile pc-tile-swatch" style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={tint === c} onClick={() => setTint(c)}>
            {tint === c && <span className="pc-check" aria-hidden="true">✓</span>}
          </button>
        ))}
        <label className="pc-tile pc-tile-swatch pc-custom" style={tint && !PET_SWATCHES.includes(tint) ? { background: tint } : undefined}>
          <span>🌈 Any color</span>
          <input type="color" value={tint ?? '#ffffff'} onChange={(e) => setTint(e.target.value)} aria-label="Pick any color" />
          {tint && !PET_SWATCHES.includes(tint) && <span className="pc-check" aria-hidden="true">✓</span>}
        </label>
      </>
    );
  } else if (tab === 'tricks' && pet) {
    strip = PET_TRICKS.map((t) => {
      const learned = (pet.tricksLearned ?? []).includes(t.id);
      return (
        <button key={t.id} type="button" className="pc-tile" aria-pressed={learned} onClick={() => { if (!learned) teachTrick(pet.id, t.id); }}>
          <span className="pc-tile-icon" aria-hidden="true">{t.icon}</span>
          <span className="pc-tile-label">{learned ? t.label : `Teach ${t.label}`}</span>
          {learned && <span className="pc-check" aria-hidden="true">✓</span>}
        </button>
      );
    });
  } else if (tab === 'name' && pet) {
    strip = (
      <div className="pc-name">
        <label htmlFor="pc-name-input">Your pet's name</label>
        <input
          id="pc-name-input"
          key={`${pet.id}:${pet.customName}`}
          defaultValue={pet.customName}
          maxLength={24}
          onBlur={(e) => commitName(e.target)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
      </div>
    );
  } else if (tab === 'pets') {
    strip = props.mode === 'student'
      ? ownPets.map((p) => {
          const d = petDefById(p.petDefId);
          if (!d) return null;
          return (
            <button key={p.id} type="button" className="pc-tile" aria-pressed={p.id === pet?.id} onClick={() => setPetId(p.id)}>
              <Thumb def={d} />
              <span className="pc-tile-label">{p.customName || d.name}</span>
              {p.id === pet?.id && <span className="pc-check" aria-hidden="true">✓</span>}
            </button>
          );
        })
      : PET_CATALOG.map((d) => (
          <button key={d.id} type="button" className="pc-tile" aria-pressed={d.id === catalogId} onClick={() => { setCatalogId(d.id); setPreviewTint(null); }}>
            <Thumb def={d} />
            <span className="pc-tile-label">{d.name}</span>
            <span className="pc-tile-sub">{formatMoney(d.priceCents)}</span>
            {d.id === catalogId && <span className="pc-check" aria-hidden="true">✓</span>}
          </button>
        ));
  }

  return createPortal(
    <div className="pc-root" role="dialog" aria-modal="true" aria-labelledby="pc-title">
      <button ref={backRef} type="button" className="pc-back" onClick={() => onCloseRef.current()} aria-label="Back">‹</button>
      <h2 id="pc-title" className="pc-ribbon">
        {props.mode === 'student' ? `Customize your ${displayName}` : 'Pet Catalog'}
      </h2>
      <div className="pc-stage">
        {def ? <PetStage def={def} tint={tint} /> : <p className="pc-empty">No pet to show yet.</p>}
      </div>
      {props.mode === 'teacher' && def && (
        <p className="pc-caption">{def.name} · {def.category} · {formatMoney(def.priceCents)}{previewTint ? ' · color preview only' : ''}</p>
      )}
      <div className="pc-bottom">
        <div className="pc-tabs-row">
          <div className="pc-tabs" role="tablist" aria-label="Customize">
            {tabs.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={`pc-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)} title={TAB_META[t].label}>
                <span aria-hidden="true">{TAB_META[t].icon}</span>
                <span className="pc-tab-label">{TAB_META[t].label}</span>
              </button>
            ))}
          </div>
          {tab === 'color' && (
            <button type="button" className="pc-reset" onClick={() => setTint(null)} disabled={!tint}>Reset</button>
          )}
        </div>
        <div className="pc-strip-row">
          <button type="button" className="pc-arrow" onClick={() => scrollStrip(-1)} aria-label="Scroll left">‹</button>
          <div className="pc-strip" ref={stripRef} role="tabpanel" aria-label={TAB_META[tab].label}>{strip}</div>
          <button type="button" className="pc-arrow" onClick={() => scrollStrip(1)} aria-label="Scroll right">›</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
