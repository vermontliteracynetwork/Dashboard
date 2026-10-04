import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import TeacherNav from '../../components/TeacherNav';
import { useStore } from '../../store/store';
import { StyleCharacter, type StyleCharacterHandle } from '../../style/StyleCharacter';
import { SPECIES, defaultLook, speciesById } from '../../style/species';
import { WARDROBE, SLOT_LABEL, SLOT_ORDER, itemById } from '../../style/wardrobe';
import { PATTERNS, patternSwatch } from '../../style/patterns';
import ColorWheel from '../../style/ColorWheel';
import { styleSound } from '../../style/styleSounds';
import type { Paint, StyleLook, StyleMove, StyleOneShot, WardrobeSlot } from '../../style/types';

// Style (docs/STYLE.md): the dress-up room. Teacher-only for now (direct
// teacher instruction: students don't get Style until she says it's ready;
// when she does, it opens from their pie menu). Pick an animal, color
// every part of it with the color wheel, and wear one outfit: a hat,
// glasses, comfort gear, a top, bottoms, shoes and a back item, each in
// any color and pattern.

const OWNER = 'teacher';
type Tab = 'body' | WardrobeSlot;

function isLook(x: unknown): x is StyleLook {
  const l = x as StyleLook;
  return !!l && typeof l === 'object' && !!l.species && !!l.body && !!l.outfit && SPECIES.some((s) => s.id === l.species);
}

function loadInitial(rowLook: unknown): StyleLook {
  if (isLook(rowLook)) return rowLook;
  try {
    const raw = localStorage.getItem(`style-look:${OWNER}`);
    const parsed = raw ? JSON.parse(raw) : null;
    if (isLook(parsed)) return parsed;
  } catch { /* ignore */ }
  return defaultLook('dog');
}

const rand = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const randHex = () => {
  const h = Math.floor(Math.random() * 360);
  return `hsl(${h} 70% 55%)`;
};
// Convert any CSS color to #rrggbb (the color wheel works in hex).
function toHex(css: string): string {
  const c = document.createElement('canvas').getContext('2d');
  if (!c) return '#888888';
  c.fillStyle = css;
  return c.fillStyle as string;
}
const randomPaint = (): Paint => ({ pattern: Math.random() < 0.55 ? 'solid' : rand(PATTERNS).id, colors: [toHex(randHex()), toHex(randHex())] });

export default function StyleRoom() {
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === OWNER));
  const saveStyleLook = useStore((s) => s.saveStyleLook);
  const [saved, setSaved] = useState<StyleLook>(() => loadInitial(row?.look));
  const [look, setLook] = useState<StyleLook>(saved);
  const [tab, setTab] = useState<Tab>('body');
  const [move, setMove] = useState<StyleMove>('idle');
  const [talking, setTalking] = useState(false);
  const [spin, setSpin] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const charRef = useRef<StyleCharacterHandle>(null);
  const dirty = useMemo(() => JSON.stringify(look) !== JSON.stringify(saved), [look, saved]);
  // The saved look can arrive from the database after this screen opens.
  useEffect(() => {
    if (row && isLook(row.look) && !dirty) { setSaved(row.look); setLook(row.look); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.updatedAt]);

  const play = (m: StyleOneShot) => {
    charRef.current?.play(m);
    if (m === 'jump') styleSound.boing();
    else if (m === 'cheer') styleSound.cheer();
    else styleSound.tap();
  };

  const equip = (slot: WardrobeSlot, itemId: string | null) => {
    setLook((l) => {
      const outfit = { ...l.outfit };
      if (!itemId) delete outfit[slot];
      else {
        const item = itemById(itemId)!;
        outfit[slot] = { itemId, zones: item.zones.map((z) => structuredClone(z.paint)) };
      }
      return { ...l, outfit };
    });
    if (itemId) styleSound.pop(); else styleSound.swish();
  };

  const setZone = (slot: WardrobeSlot, i: number, paint: Paint) => {
    setLook((l) => {
      const eq = l.outfit[slot];
      if (!eq) return l;
      const zones = eq.zones.slice();
      zones[i] = paint;
      return { ...l, outfit: { ...l.outfit, [slot]: { ...eq, zones } } };
    });
  };

  const save = () => {
    saveStyleLook(OWNER, look);
    setSaved(look);
    styleSound.save();
    charRef.current?.play('cheer');
    setToast('Look saved!');
    window.setTimeout(() => setToast(null), 2000);
  };

  const surprise = () => {
    const species = rand(SPECIES).id;
    const outfit: StyleLook['outfit'] = {};
    for (const slot of SLOT_ORDER) {
      const options = WARDROBE.filter((i) => i.slot === slot);
      const chance = slot === 'top' || slot === 'bottom' || slot === 'shoes' ? 0.95 : 0.45;
      if (options.length && Math.random() < chance) {
        const item = rand(options);
        outfit[slot] = { itemId: item.id, zones: item.zones.map(() => randomPaint()) };
      }
    }
    const body = structuredClone(speciesById(species).defaultBody);
    if (Math.random() < 0.5) body.fur = randomPaint();
    setLook({ species, body, outfit });
    styleSound.pop();
    charRef.current?.play('dance');
  };

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'body', label: 'Body', emoji: '🐾' },
    ...SLOT_ORDER.map((s) => ({ id: s as Tab, label: SLOT_LABEL[s], emoji: WARDROBE.find((i) => i.slot === s)?.emoji ?? '✨' })),
  ];

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="style-room">
        <header className="style-head">
          <div>
            <h1>👗 Style</h1>
            <p className="style-note">Only you can see Style right now. Students get it (from their pie menu) when you say it is ready.</p>
          </div>
          <div className="style-head-actions">
            <button type="button" className="style-btn" onClick={surprise}>🎲 Surprise me</button>
            <button type="button" className="style-btn" onClick={() => { setLook(defaultLook(look.species)); styleSound.swish(); }}>↺ Start over</button>
            <button type="button" className="style-btn" disabled={!dirty} onClick={() => { setLook(saved); styleSound.swish(); }}>Undo changes</button>
            <button type="button" className="style-btn primary" onClick={save}>{dirty ? '💾 Save my look' : '✓ Saved'}</button>
          </div>
        </header>

        <div className="style-main">
          <section className="style-stage">
            <div className="style-canvas">
              <Canvas camera={{ position: [0, 1.25, 3.4], fov: 40 }} shadows dpr={[1, 2]}>
                <color attach="background" args={['#fde8ff']} />
                <ambientLight intensity={0.75} />
                <directionalLight position={[2.5, 4, 3]} intensity={1.4} castShadow />
                <directionalLight position={[-3, 2, -2]} intensity={0.45} color="#b8d8ff" />
                <Suspense fallback={null}>
                  <group rotation={[0, spin, 0]}>
                    <StyleCharacter ref={charRef} look={look} move={move} talking={talking} />
                  </group>
                </Suspense>
                <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={4} blur={2.4} far={2} />
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
                  <circleGeometry args={[1.3, 48]} />
                  <meshStandardMaterial color="#ffffff" />
                </mesh>
                <OrbitControls target={[0, 0.95, 0]} enablePan={false} minDistance={1.6} maxDistance={6} maxPolarAngle={Math.PI / 1.9} />
              </Canvas>
              {toast && <div className="style-toast">✨ {toast}</div>}
            </div>
            <div className="style-moves">
              <button type="button" className="style-chip" onClick={() => setSpin((s) => s + Math.PI / 4)} aria-label="Turn left">⟲ Turn</button>
              <button type="button" className="style-chip" onClick={() => setSpin((s) => s - Math.PI / 4)} aria-label="Turn right">Turn ⟳</button>
              {(['idle', 'walk', 'run'] as StyleMove[]).map((m) => (
                <button key={m} type="button" className={`style-chip${move === m ? ' on' : ''}`} onClick={() => { setMove(m); styleSound.tap(); }}>
                  {m === 'idle' ? '🧍 Stand' : m === 'walk' ? '🚶 Walk' : '🏃 Run'}
                </button>
              ))}
              <button type="button" className="style-chip" onClick={() => play('jump')}>🦘 Jump</button>
              <button type="button" className="style-chip" onClick={() => play('wave')}>👋 Wave</button>
              <button type="button" className="style-chip" onClick={() => play('cheer')}>🙌 Cheer</button>
              <button type="button" className="style-chip" onClick={() => play('dance')}>💃 Dance</button>
              <button type="button" className={`style-chip${talking ? ' on' : ''}`} onClick={() => { setTalking((v) => !v); styleSound.tap(); }}>💬 {talking ? 'Stop talking' : 'Talk'}</button>
            </div>
          </section>

          <section className="style-panel">
            <nav className="style-tabs" aria-label="Style categories">
              {tabs.map((t) => (
                <button key={t.id} type="button" className={`style-tab${tab === t.id ? ' on' : ''}`} onClick={() => { setTab(t.id); styleSound.tap(); }}>
                  <span aria-hidden="true">{t.emoji}</span>{t.label}
                </button>
              ))}
            </nav>

            {tab === 'body' ? (
              <div className="style-section">
                <h2>Pick your animal</h2>
                <div className="style-grid">
                  {SPECIES.map((sp) => (
                    <button key={sp.id} type="button" className={`style-tile${look.species === sp.id ? ' on' : ''}`}
                      onClick={() => { setLook((l) => ({ ...l, species: sp.id, body: structuredClone(sp.defaultBody) })); styleSound.pop(); charRef.current?.play('wave'); }}>
                      <span className="style-tile-emoji">{sp.emoji}</span>{sp.name}
                    </button>
                  ))}
                </div>
                <PaintEditor label="Fur" paint={look.body.fur} onChange={(p) => setLook((l) => ({ ...l, body: { ...l.body, fur: p } }))} />
                <PaintEditor label={look.species === 'frog' ? 'Tummy & chin' : 'Tummy & muzzle'} paint={look.body.belly} onChange={(p) => setLook((l) => ({ ...l, body: { ...l.body, belly: p } }))} />
                <PaintEditor label={look.species === 'frog' ? 'Spots & feet' : look.species === 'capybara' ? 'Snout, ears & feet' : 'Ears, paws & feet'} paint={look.body.accent} onChange={(p) => setLook((l) => ({ ...l, body: { ...l.body, accent: p } }))} />
                <ColorOnlyEditor label="Eyes" color={look.body.eyes} onChange={(c) => setLook((l) => ({ ...l, body: { ...l.body, eyes: c } }))} />
                <ColorOnlyEditor label="Nose" color={look.body.nose} onChange={(c) => setLook((l) => ({ ...l, body: { ...l.body, nose: c } }))} />
              </div>
            ) : (
              <div className="style-section">
                <h2>{SLOT_LABEL[tab]}{tab === 'gear' ? ' (always free)' : ''}</h2>
                <div className="style-grid">
                  <button type="button" className={`style-tile${!look.outfit[tab] ? ' on' : ''}`} onClick={() => equip(tab, null)}>
                    <span className="style-tile-emoji">🚫</span>None
                  </button>
                  {WARDROBE.filter((i) => i.slot === tab).map((item) => (
                    <button key={item.id} type="button" className={`style-tile${look.outfit[tab]?.itemId === item.id ? ' on' : ''}`} onClick={() => equip(tab, item.id)}>
                      <span className="style-tile-emoji">{item.emoji}</span>{item.name}
                    </button>
                  ))}
                </div>
                {(() => {
                  const eq = look.outfit[tab];
                  const item = eq ? itemById(eq.itemId) : undefined;
                  if (!eq || !item) return null;
                  return item.zones.map((z, i) => (
                    <PaintEditor key={`${item.id}-${i}`} label={`${item.name}: ${z.label}`} paint={eq.zones[i] ?? z.paint} onChange={(p) => setZone(tab, i, p)} />
                  ));
                })()}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// One color zone: pattern chips plus its two colors on the color wheel.
function PaintEditor({ label, paint, onChange }: { label: string; paint: Paint; onChange: (p: Paint) => void }) {
  const [which, setWhich] = useState<0 | 1 | null>(null);
  return (
    <div className="style-paint">
      <h3>{label}</h3>
      <div className="style-patterns">
        {PATTERNS.map((pt) => (
          <button key={pt.id} type="button" className={`style-pattern${paint.pattern === pt.id ? ' on' : ''}`}
            onClick={() => { onChange({ ...paint, pattern: pt.id }); styleSound.pop(); }}>
            <img src={patternSwatch({ pattern: pt.id, colors: paint.colors })} alt="" />
            <span>{pt.label}</span>
          </button>
        ))}
      </div>
      <div className="style-color-row">
        <button type="button" className={`style-color-btn${which === 0 ? ' on' : ''}`} onClick={() => setWhich(which === 0 ? null : 0)}>
          <span style={{ background: paint.colors[0] }} />{paint.pattern === 'solid' ? 'Color' : 'Main color'}
        </button>
        {paint.pattern !== 'solid' && (
          <button type="button" className={`style-color-btn${which === 1 ? ' on' : ''}`} onClick={() => setWhich(which === 1 ? null : 1)}>
            <span style={{ background: paint.colors[1] }} />Pattern color
          </button>
        )}
      </div>
      {which !== null && (
        <ColorWheel value={paint.colors[which]} onChange={(hex) => {
          const colors: [string, string] = [...paint.colors];
          colors[which] = hex;
          onChange({ ...paint, colors });
          styleSound.chirp();
        }} />
      )}
    </div>
  );
}

function ColorOnlyEditor({ label, color, onChange }: { label: string; color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="style-paint">
      <h3>{label}</h3>
      <div className="style-color-row">
        <button type="button" className={`style-color-btn${open ? ' on' : ''}`} onClick={() => setOpen((v) => !v)}>
          <span style={{ background: color }} />Pick a color
        </button>
      </div>
      {open && <ColorWheel value={color} onChange={(c) => { onChange(c); styleSound.chirp(); }} />}
    </div>
  );
}
