import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import TeacherNav from '../../components/TeacherNav';
import { useStore } from '../../store/store';
import { StyleCharacter, type StyleCharacterHandle } from '../../style/StyleCharacter';
import { SPECIES, defaultLook, speciesById } from '../../style/species';
import { SLOT_LABEL, SLOT_ORDER, type WardrobeItem } from '../../style/wardrobe';
import { useStyleCatalog, useStyleSettings } from '../../style/catalog';
import { PATTERNS, patternSwatch } from '../../style/patterns';
import ColorWheel from '../../style/ColorWheel';
import { styleSound } from '../../style/styleSounds';
import type { Paint, SpeciesId, StyleLook, StyleMove, StyleOneShot, WardrobeSlot } from '../../style/types';

// Style (docs/STYLE.md). Teacher-only for now (direct teacher instruction:
// students don't get Style until she says it's ready; when she does, it
// opens from their pie menu). Two modes:
//  - Dress up: pick an animal, color every part of it, wear one outfit.
//  - Item workshop: every clothing item on its own (not on a character),
//    rename it and change its default colors and patterns, and preview it
//    on each animal (or all four at once) while editing.

type Tab = 'body' | WardrobeSlot;
type Mode = 'dress' | 'workshop';
type Preview = 'item' | SpeciesId | 'all';

function isLook(x: unknown): x is StyleLook {
  const l = x as StyleLook;
  return !!l && typeof l === 'object' && !!l.species && !!l.body && !!l.outfit && SPECIES.some((s) => s.id === l.species);
}

function loadInitial(rowLook: unknown, owner: string): StyleLook {
  if (isLook(rowLook)) return rowLook;
  try {
    const raw = localStorage.getItem(`style-look:${owner}`);
    const parsed = raw ? JSON.parse(raw) : null;
    if (isLook(parsed)) return parsed;
  } catch { /* ignore */ }
  return defaultLook('dog');
}

const rand = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
function toHex(css: string): string {
  const c = document.createElement('canvas').getContext('2d');
  if (!c) return '#888888';
  c.fillStyle = css;
  return c.fillStyle as string;
}
const randHex = () => toHex(`hsl(${Math.floor(Math.random() * 360)} 70% 55%)`);
const randomPaint = (): Paint => ({ pattern: Math.random() < 0.55 ? 'solid' : rand(PATTERNS).id, colors: [randHex(), randHex()] });

export default function StyleRoom() {
  return <StyleRoomView owner="teacher" />;
}

// Shared by the teacher's Style (owner 'teacher', with the Item workshop and
// the release switch) and the students' Style (owner = their student id,
// Dress up only), so both always look and work the same.
export function StyleRoomView({ owner, studentMode = false, backTo = '/world/town' }: { owner: string; studentMode?: boolean; backTo?: string }) {
  const navigate = useNavigate();
  const settings = useStyleSettings();
  const setStyleReleased = useStore((s) => s.setStyleReleased);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === owner));
  const saveStyleLook = useStore((s) => s.saveStyleLook);
  const saveStyleCatalog = useStore((s) => s.saveStyleCatalog);
  const { items: catalog, overrides } = useStyleCatalog();
  const itemFor = (id: string) => catalog.find((i) => i.id === id);

  const [mode, setMode] = useState<Mode>('dress');
  const [saved, setSaved] = useState<StyleLook>(() => loadInitial(row?.look, owner));
  const [look, setLook] = useState<StyleLook>(saved);
  const [tab, setTab] = useState<Tab>('body');
  const [move, setMove] = useState<StyleMove>('idle');
  const [talking, setTalking] = useState(false);
  const [spin, setSpin] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const charRefs = useRef<(StyleCharacterHandle | null)[]>([]);
  const dirty = useMemo(() => JSON.stringify(look) !== JSON.stringify(saved), [look, saved]);

  // Item workshop state: the item being edited and its working copy.
  const [wsSlot, setWsSlot] = useState<WardrobeSlot>('hat');
  const [wsItemId, setWsItemId] = useState<string>('cheesehat');
  const wsItem = itemFor(wsItemId);
  const [wsName, setWsName] = useState('');
  const [wsZones, setWsZones] = useState<Paint[]>([]);
  const [preview, setPreview] = useState<Preview>('all');
  useEffect(() => {
    if (!wsItem) return;
    setWsName(wsItem.name);
    setWsZones(wsItem.zones.map((z) => structuredClone(z.paint)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsItemId, overrides]);
  const wsDirty = !!wsItem && (wsName !== wsItem.name || JSON.stringify(wsZones) !== JSON.stringify(wsItem.zones.map((z) => z.paint)));

  useEffect(() => {
    if (row && isLook(row.look) && !dirty) { setSaved(row.look); setLook(row.look); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.updatedAt]);

  const flash = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 2000); };

  const play = (m: StyleOneShot) => {
    charRefs.current.forEach((c) => c?.play(m));
    if (m === 'jump') styleSound.boing();
    else if (m === 'cheer') styleSound.cheer();
    else styleSound.tap();
  };

  // Costumes students haven't earned yet (the teacher can use everything).
  const unlockedIds = useStore((s) => s.students.find((st) => st.id === owner)?.unlockedCharacterIds);
  const lockedReason = (item: WardrobeItem) =>
    studentMode && item.unlock && !(unlockedIds ?? []).includes(item.unlock.id) ? item.unlock.label : null;

  const equip = (slot: WardrobeSlot, itemId: string | null) => {
    const picked = itemId ? itemFor(itemId) : undefined;
    const reason = picked ? lockedReason(picked) : null;
    if (reason) { flash(`Earn it: ${reason}`); styleSound.tap(); return; }
    setLook((l) => {
      const outfit = { ...l.outfit };
      // A costume replaces everything else (the clothes stay saved under it
      // and come back when it comes off); picking clothes takes it off.
      if (slot !== 'costume' && itemId) delete outfit.costume;
      if (!itemId) delete outfit[slot];
      else {
        const item = itemFor(itemId)!;
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
    saveStyleLook(owner, look);
    setSaved(look);
    styleSound.save();
    play('cheer');
    flash('Look saved!');
  };

  const saveItem = () => {
    if (!wsItem) return;
    const next = { ...overrides, [wsItem.id]: { name: wsName.trim() || wsItem.name, zones: wsZones } };
    saveStyleCatalog(next);
    styleSound.save();
    play('cheer');
    flash(`${wsName.trim() || wsItem.name} saved!`);
  };
  const resetItem = () => {
    if (!wsItem) return;
    const next = { ...overrides };
    delete next[wsItem.id];
    saveStyleCatalog(next);
    styleSound.swish();
    flash('Back to the original');
  };

  const surprise = () => {
    const species = rand(SPECIES).id;
    const outfit: StyleLook['outfit'] = {};
    for (const slot of SLOT_ORDER) {
      if (slot === 'costume') continue;
      const options = catalog.filter((i) => i.slot === slot);
      const chance = slot === 'top' || slot === 'bottom' || slot === 'shoes' ? 0.9 : 0.4;
      if (options.length && Math.random() < chance) {
        const item = rand(options);
        outfit[slot] = { itemId: item.id, zones: item.zones.map(() => randomPaint()) };
      }
    }
    const body = structuredClone(speciesById(species).defaultBody);
    if (Math.random() < 0.5) body.fur = randomPaint();
    setLook({ species, body, outfit });
    styleSound.pop();
    play('dance');
  };

  // What the stage shows.
  const stageLooks: { look: StyleLook; x: number; bodyless?: boolean }[] = useMemo(() => {
    if (mode === 'dress') return [{ look, x: 0 }];
    if (!wsItem) return [];
    const outfitOnly: StyleLook['outfit'] = { [wsItem.slot]: { itemId: wsItem.id, zones: wsZones } };
    const on = (sp: SpeciesId): StyleLook => ({ species: sp, body: structuredClone(speciesById(sp).defaultBody), outfit: outfitOnly });
    if (preview === 'item') return [{ look: on('dog'), x: 0, bodyless: true }];
    if (preview === 'all') return SPECIES.map((sp, i) => ({ look: on(sp.id), x: (i - 1.5) * 1.15 }));
    return [{ look: on(preview), x: 0 }];
  }, [mode, look, wsItem, wsZones, preview]);
  const wide = stageLooks.length > 1;
  // "Item only" frames the item itself up close (a hat floats up where a
  // head would be, shoes sit on the floor).
  const itemOnly = mode === 'workshop' && preview === 'item';
  const focusY = !itemOnly || !wsItem ? 0.9 : ({ hat: 1.45, face: 1.25, gear: 1.25, top: 0.82, bottom: 0.4, shoes: 0.08, back: 0.8, costume: 0.8 } as Record<WardrobeSlot, number>)[wsItem.slot];
  const cam: [number, number, number] = wide ? [0, 1.5, 5.6] : itemOnly ? [0.9, focusY + 0.45, 1.9] : [0, 1.2, 3.3];

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'body', label: 'Body', emoji: '🐾' },
    ...SLOT_ORDER.map((s) => ({ id: s as Tab, label: SLOT_LABEL[s], emoji: catalog.find((i) => i.slot === s)?.emoji ?? '✨' })),
  ];

  return (
    <div className={studentMode ? 'style-student-shell' : 'app-shell'}>
      {!studentMode && <TeacherNav />}
      <div className="style-room">
        <header className="style-head">
          <div>
            {studentMode && (
              <button type="button" className="style-btn" style={{ marginBottom: 8 }} onClick={() => { if (dirty) save(); navigate(backTo); }}>
                ← {dirty ? 'Save and go back' : 'Back to Town Square'}
              </button>
            )}
            <h1>👗 Style</h1>
            {!studentMode && (
              <p className="style-note">
                {settings.released ? 'Students can use Style now (from their pie menu).' : 'Only you can see Style right now. Students get it (from their pie menu) when you turn it on.'}
                {' '}
                <button type="button" className={`style-release${settings.released ? ' on' : ''}`} onClick={() => setConfirmRelease(true)}>
                  {settings.released ? '✅ Students: ON' : '🔒 Students: OFF'}
                </button>
              </p>
            )}
          </div>
          {!studentMode && <div className="style-mode" role="tablist" aria-label="Style mode">
            <button type="button" role="tab" aria-selected={mode === 'dress'} className={`style-mode-btn${mode === 'dress' ? ' on' : ''}`} onClick={() => { setMode('dress'); styleSound.tap(); }}>🪞 Dress up</button>
            <button type="button" role="tab" aria-selected={mode === 'workshop'} className={`style-mode-btn${mode === 'workshop' ? ' on' : ''}`} onClick={() => { setMode('workshop'); styleSound.tap(); }}>🧵 Item workshop</button>
          </div>}
          {mode === 'dress' ? (
            <div className="style-head-actions">
              <button type="button" className="style-btn" onClick={surprise}>🎲 Surprise me</button>
              <button type="button" className="style-btn" onClick={() => { setLook(defaultLook(look.species)); styleSound.swish(); }}>↺ Start over</button>
              <button type="button" className="style-btn" disabled={!dirty} onClick={() => { setLook(saved); styleSound.swish(); }}>Undo changes</button>
              <button type="button" className="style-btn primary" onClick={save}>{dirty ? '💾 Save my look' : '✓ Saved'}</button>
            </div>
          ) : (
            <div className="style-head-actions">
              <button type="button" className="style-btn" disabled={!overrides[wsItemId]} onClick={resetItem}>↺ Back to original</button>
              <button type="button" className="style-btn" disabled={!wsDirty} onClick={() => { if (wsItem) { setWsName(wsItem.name); setWsZones(wsItem.zones.map((z) => structuredClone(z.paint))); styleSound.swish(); } }}>Undo changes</button>
              <button type="button" className="style-btn primary" disabled={!wsDirty} onClick={saveItem}>{wsDirty ? '💾 Save item' : '✓ Saved'}</button>
            </div>
          )}
        </header>

        <div className="style-main">
          <section className="style-stage">
            {mode === 'workshop' && (
              <div className="style-preview-row" aria-label="Preview on">
                <span>Preview:</span>
                {([['item', '🧵 Item only'], ...SPECIES.map((s) => [s.id, `${s.emoji} ${s.name}`]), ['all', '👥 All four']] as [Preview, string][]).map(([id, label]) => (
                  <button key={id} type="button" className={`style-chip${preview === id ? ' on' : ''}`} onClick={() => { setPreview(id); styleSound.tap(); }}>{label}</button>
                ))}
              </div>
            )}
            <div className="style-canvas">
              <Canvas camera={{ position: cam, fov: 40 }} shadows dpr={[1, 2]} key={`${wide}-${itemOnly}-${focusY}`}>
                <color attach="background" args={['#fde8ff']} />
                <ambientLight intensity={0.8} />
                <hemisphereLight args={['#ffffff', '#f3d6ff', 0.5]} />
                <directionalLight position={[2.5, 4, 3]} intensity={1.25} castShadow />
                <directionalLight position={[-3, 2, -2]} intensity={0.45} color="#b8d8ff" />
                <Suspense fallback={null}>
                  {stageLooks.map((s, i) => (
                    <group key={`${s.look.species}-${i}`} position={[s.x, 0, 0]} rotation={[0, spin, 0]}>
                      <StyleCharacter ref={(h) => { charRefs.current[i] = h; }} look={s.look} move={move} talking={talking} bodyless={s.bodyless} />
                    </group>
                  ))}
                </Suspense>
                <ContactShadows position={[0, 0.001, 0]} opacity={0.3} scale={wide ? 8 : 4} blur={2.4} far={2} />
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
                  <circleGeometry args={[wide ? 3 : 1.3, 48]} />
                  <meshStandardMaterial color="#ffffff" />
                </mesh>
                <OrbitControls target={[0, focusY, 0]} enablePan={false} minDistance={0.8} maxDistance={9} maxPolarAngle={Math.PI / 1.9} />
              </Canvas>
              {toast && <div className="style-toast">✨ {toast}</div>}
            </div>
            <div className="style-anim">
              <div className="style-anim-group">
                <span className="style-anim-label">Move</span>
                {(['idle', 'walk', 'run'] as StyleMove[]).map((m) => (
                  <button key={m} type="button" className={`style-chip${move === m ? ' on' : ''}`} onClick={() => { setMove(m); styleSound.tap(); }}>
                    {m === 'idle' ? '🧍 Stand' : m === 'walk' ? '🚶 Walk' : '🏃 Run'}
                  </button>
                ))}
                <button type="button" className="style-chip" onClick={() => play('jump')}>🦘 Jump</button>
                <button type="button" className="style-chip" onClick={() => setSpin((s) => s + Math.PI / 4)} aria-label="Turn left">⟲ Turn</button>
                <button type="button" className="style-chip" onClick={() => setSpin((s) => s - Math.PI / 4)} aria-label="Turn right">Turn ⟳</button>
              </div>
              <div className="style-anim-group">
                <span className="style-anim-label">Emotes</span>
                <button type="button" className="style-chip" onClick={() => play('wave')}>👋 Wave</button>
                <button type="button" className={`style-chip${talking ? ' on' : ''}`} onClick={() => { setTalking((v) => !v); styleSound.tap(); }}>💬 {talking ? 'Stop talking' : 'Talk'}</button>
                <button type="button" className="style-chip" onClick={() => play('cheer')}>🙌 Cheer</button>
                <button type="button" className="style-chip" onClick={() => play('dance')}>💃 Dance</button>
              </div>
            </div>
          </section>

          <section className="style-panel">
            {mode === 'dress' ? (
              <>
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
                          onClick={() => { setLook((l) => ({ ...l, species: sp.id, body: structuredClone(sp.defaultBody) })); styleSound.pop(); play('wave'); }}>
                          <span className="style-tile-emoji">{sp.emoji}</span>{sp.name}
                        </button>
                      ))}
                    </div>
                    <PaintEditor label="Fur" paint={look.body.fur} onChange={(p) => setLook((l) => ({ ...l, body: { ...l.body, fur: p } }))} />
                    <PaintEditor label={look.species === 'frog' ? 'Tummy & chin' : 'Tummy & muzzle'} paint={look.body.belly} onChange={(p) => setLook((l) => ({ ...l, body: { ...l.body, belly: p } }))} />
                    <PaintEditor label={look.species === 'frog' ? 'Spots & feet' : look.species === 'capybara' ? 'Nose tip, ears & feet' : 'Ears, paws & feet'} paint={look.body.accent} onChange={(p) => setLook((l) => ({ ...l, body: { ...l.body, accent: p } }))} />
                    <ColorOnlyEditor label="Eyes" color={look.body.eyes} onChange={(c) => setLook((l) => ({ ...l, body: { ...l.body, eyes: c } }))} />
                    <ColorOnlyEditor label="Nose" color={look.body.nose} onChange={(c) => setLook((l) => ({ ...l, body: { ...l.body, nose: c } }))} />
                  </div>
                ) : (
                  <div className="style-section">
                    <h2>{SLOT_LABEL[tab]}{tab === 'gear' ? ' (always free)' : ''}</h2>
                    {tab === 'costume' && <p className="style-note">A costume turns your character into someone new, from head to toe. Your clothes are kept and come back when you take it off.</p>}
                    {tab !== 'costume' && look.outfit.costume && <p className="style-note">You are wearing a costume. Picking something here takes the costume off.</p>}
                    <ItemGrid items={catalog.filter((i) => i.slot === tab)} selected={look.outfit[tab]?.itemId ?? null} onPick={(id) => equip(tab, id)} allowNone locked={lockedReason} />
                    {(() => {
                      const eq = look.outfit[tab];
                      const item = eq ? itemFor(eq.itemId) : undefined;
                      if (!eq || !item) return null;
                      return item.zones.map((z, i) => (
                        <PaintEditor key={`${item.id}-${i}`} label={`${item.name}: ${z.label}`} paint={eq.zones[i] ?? z.paint} onChange={(p) => setZone(tab, i, p)} />
                      ));
                    })()}
                  </div>
                )}
              </>
            ) : (
              <>
                <nav className="style-tabs" aria-label="Item categories">
                  {SLOT_ORDER.map((s) => (
                    <button key={s} type="button" className={`style-tab${wsSlot === s ? ' on' : ''}`} onClick={() => { setWsSlot(s); styleSound.tap(); }}>
                      <span aria-hidden="true">{catalog.find((i) => i.slot === s)?.emoji ?? '✨'}</span>{SLOT_LABEL[s]}
                    </button>
                  ))}
                </nav>
                <div className="style-section">
                  <h2>All {SLOT_LABEL[wsSlot]}</h2>
                  <ItemGrid items={catalog.filter((i) => i.slot === wsSlot)} selected={wsItemId} onPick={(id) => { if (id) { setWsItemId(id); styleSound.pop(); } }} edited={overrides} />
                  {wsItem && (
                    <>
                      <div className="style-paint">
                        <h3>Item name</h3>
                        <input className="style-name-input" value={wsName} maxLength={40} onChange={(e) => setWsName(e.target.value.replace(/—/g, '-'))} aria-label="Item name" />
                      </div>
                      {wsItem.zones.map((z, i) => (
                        <PaintEditor key={`${wsItem.id}-${i}`} label={`Default ${z.label.toLowerCase()}`} paint={wsZones[i] ?? z.paint} onChange={(p) => setWsZones((zs) => { const next = zs.slice(); next[i] = p; return next; })} />
                      ))}
                      <p className="style-note">Saved changes become this item's new look for everyone, including students who already own it.</p>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
      {confirmRelease && (
        <div className="style-confirm-backdrop" onClick={() => setConfirmRelease(false)}>
          <div className="style-confirm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {settings.released ? (
              <>
                <h2>Turn Style off for students?</h2>
                <p>Students go back to their old characters and the Style button leaves their pie menu. Their saved looks are kept.</p>
              </>
            ) : (
              <>
                <h2>Turn Style on for students?</h2>
                <p>Students get a Style button in their pie menu, and the character they walk around Town Square with becomes their Style animal. You can turn it off again any time.</p>
              </>
            )}
            <div className="style-head-actions">
              <button type="button" className="style-btn" onClick={() => setConfirmRelease(false)}>Cancel</button>
              <button type="button" className="style-btn primary" onClick={() => { setStyleReleased(!settings.released); setConfirmRelease(false); styleSound.save(); }}>
                {settings.released ? 'Turn off' : 'Turn on'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemGrid({ items, selected, onPick, allowNone, edited, locked }: { items: WardrobeItem[]; selected: string | null; onPick: (id: string | null) => void; allowNone?: boolean; edited?: Record<string, unknown>; locked?: (item: WardrobeItem) => string | null }) {
  return (
    <div className="style-grid">
      {allowNone && (
        <button type="button" className={`style-tile${!selected ? ' on' : ''}`} onClick={() => onPick(null)}>
          <span className="style-tile-emoji">🚫</span>None
        </button>
      )}
      {items.map((item) => (
        <button key={item.id} type="button" className={`style-tile${selected === item.id ? ' on' : ''}${locked?.(item) ? ' locked' : ''}`} onClick={() => onPick(item.id)}>
          <span className="style-tile-emoji">{item.emoji}</span>{item.name}
          {edited?.[item.id] ? <span className="style-tile-badge">edited</span> : null}
          {locked?.(item) ? <span className="style-tile-badge">🔒 earn it</span> : null}
                  </button>
      ))}
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
