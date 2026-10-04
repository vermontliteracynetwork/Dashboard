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
import BawkGuide from '../../components/BawkGuide';
import { NPC_ROSTER, useNpcProfiles, type NpcProfile } from '../../style/npcs';
import { SPECIES_PRICE, PATTERN_PRICE, FREE_PATTERNS, asInventory, inventoryOwner, itemLock, money, patternLocked, speciesLocked, type Lock } from '../../style/shop';
import type { Paint, PatternId, SpeciesId, StyleLook, StyleMove, StyleOneShot, WardrobeSlot } from '../../style/types';

// Style (docs/STYLE.md). Teacher-only for now (direct teacher instruction:
// students don't get Style until she says it's ready; when she does, it
// opens from their pie menu). Two modes:
//  - Dress up: pick an animal, color every part of it, wear one outfit.
//  - Item workshop: every clothing item on its own (not on a character),
//    rename it and change its default colors and patterns, and preview it
//    on each animal (or all four at once) while editing.

type Tab = 'body' | WardrobeSlot;
type Mode = 'dress' | 'workshop' | 'neighbors';
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
const randomPaint = (allowed?: PatternId[]): Paint => ({ pattern: Math.random() < 0.55 ? 'solid' : rand(allowed ?? PATTERNS.map((p) => p.id)), colors: [randHex(), randHex()] });

// Bawk's guided walkthrough (required the first time a student opens the
// Seamstress). Each step unlocks only the controls that step needs.
type WtStep = { id: string; text: string; allow: string[]; next?: boolean; finish?: boolean };
const WT_STEPS: WtStep[] = [
  { id: 'hello', text: "Bawk bawk! I'm Bawk. Welcome to the Seamstress, where you make your very own character! Tap Next to start.", allow: [], next: true },
  { id: 'animal', text: 'First, pick your animal. Your first animal is free! Tap the one you want.', allow: ['species'] },
  { id: 'fur', text: 'Make it yours! Under Fur, tap a color button, then drag on the color wheel. Tap Next when you like it.', allow: ['fur'], next: true },
  { id: 'tops', text: 'Time to get dressed! Tap Tops.', allow: ['tab:top'] },
  { id: 'shirt', text: 'Tap a shirt to put it on. The T-Shirt, Tank Top and Long Sleeve are free!', allow: ['items'] },
  { id: 'pattern', text: 'Pick a pattern for your shirt. Solid, Stripes and Polka Dots are free. Patterns with a gray lock cost $5 each. Tap Next when you are done.', allow: ['zones'], next: true },
  { id: 'locks', text: 'See the items with a gray lock? You can try them on to see how they look, but you have to buy them with your Class Cash before you can save them. Tap Next.', allow: [], next: true },
  { id: 'wave', text: "Let's see your character move! Tap Wave.", allow: ['wave'] },
  { id: 'save', text: 'Looking great! Tap Save my look to keep it.', allow: ['save'] },
  { id: 'done', text: 'Bawk! You did it! Your character is ready. Come back to the Seamstress any time to change your look. Tap Finish.', allow: [], finish: true },
];

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
  // Teacher's Neighbors tab: which Neighbor is shown, and (when dressing
  // one) whose look the Dress up screen is editing.
  const npcProfiles = useNpcProfiles();
  const saveNpcProfile = useStore((s) => s.saveNpcProfile);
  const setNpcTitleOverride = useStore((s) => s.setNpcTitleOverride);
  const [npcSel, setNpcSel] = useState<string>(NPC_ROSTER[0]?.id ?? 'scout');
  const [dressNpc, setDressNpc] = useState<string | null>(null);
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
    if (!dressNpc && row && isLook(row.look) && !dirty) { setSaved(row.look); setLook(row.look); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.updatedAt]);

  const flash = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 2000); };

  const play = (m: StyleOneShot) => {
    charRefs.current.forEach((c) => c?.play(m));
    if (m === 'wave' && wtStep?.id === 'wave') wtNext();
    if (m === 'jump') styleSound.boing();
    else if (m === 'cheer') styleSound.cheer();
    else styleSound.tap();
  };

  // --- Students at the Seamstress: what they own and what's locked
  // (src/style/shop.ts). The teacher always has everything.
  const student = useStore((s) => s.students.find((st) => st.id === owner));
  const invRow = useStore((s) => s.styleLooks.find((r) => r.ownerId === inventoryOwner(owner)));
  const inv = useMemo(() => asInventory(invRow?.look), [invRow]);
  const buyStyle = useStore((s) => s.buyStyle);
  const updateInv = useStore((s) => s.updateStyleInventory);
  const unlockedIds = student?.unlockedCharacterIds ?? [];
  const lockOf = (item: WardrobeItem) => (studentMode ? itemLock(item, inv, unlockedIds) : null);
  const patLocked = (p: PatternId) => studentMode && patternLocked(p, inv);
  const spLocked = (sp: SpeciesId) => studentMode && speciesLocked(sp, inv);
  type Buy = { kind: 'species' | 'item' | 'pattern'; id: string; label: string; emoji: string; price: number; after?: () => void };
  const [buying, setBuying] = useState<Buy | null>(null);
  const confirmBuy = () => {
    if (!buying || !student) return;
    if (!buyStyle(owner, buying.kind, buying.id, buying.price, buying.label)) return;
    styleSound.buy();
    buying.after?.();
    flash(`You bought ${buying.label}!`);
    setBuying(null);
  };
  // Locked things the student is trying on right now (preview only).
  type LockedThing = { key: string; label: string; emoji: string; buy?: Buy; earn?: string };
  const lockedInLook: LockedThing[] = [];
  if (studentMode) {
    if (spLocked(look.species)) {
      const sp = speciesById(look.species);
      lockedInLook.push({ key: `sp-${sp.id}`, label: sp.name, emoji: sp.emoji, buy: { kind: 'species', id: sp.id, label: `the ${sp.name}`, emoji: sp.emoji, price: SPECIES_PRICE } });
    }
    for (const eq of Object.values(look.outfit)) {
      const item = eq ? itemFor(eq.itemId) : undefined;
      const lock = item ? lockOf(item) : null;
      if (!item || !lock) continue;
      lockedInLook.push(lock.kind === 'buy'
        ? { key: item.id, label: item.name, emoji: item.emoji, buy: { kind: 'item', id: item.id, label: `the ${item.name}`, emoji: item.emoji, price: lock.price } }
        : { key: item.id, label: item.name, emoji: item.emoji, earn: lock.label });
    }
  }
  const canSave = lockedInLook.length === 0;
  const takeOffLocked = () => {
    setLook((l) => {
      const outfit = { ...l.outfit };
      for (const [slot, eq] of Object.entries(outfit)) {
        const item = eq ? itemFor(eq.itemId) : undefined;
        if (item && lockOf(item)) delete outfit[slot as WardrobeSlot];
      }
      const species = spLocked(l.species) ? (inv.species[0] ?? saved.species) : l.species;
      return { ...l, species, body: species === l.species ? l.body : structuredClone(speciesById(species).defaultBody), outfit };
    });
    styleSound.swish();
  };
  const buyPattern = (p: PatternId, apply: () => void) => {
    const label = PATTERNS.find((x) => x.id === p)?.label ?? p;
    setBuying({ kind: 'pattern', id: p, label: `the ${label} pattern`, emoji: '🎨', price: PATTERN_PRICE, after: apply });
  };

  // --- Bawk's walkthrough
  const wtActive = studentMode && !inv.walkthroughDone;
  const [wtIndex, setWtIndex] = useState(0);
  const wtStep = wtActive ? WT_STEPS[Math.min(wtIndex, WT_STEPS.length - 1)] : null;
  const allow = (key: string) => !wtStep || wtStep.allow.includes(key);
  const lk = (key: string) => (allow(key) ? '' : ' wt-locked');
  // Bring the control this step needs into view (on an iPad in portrait it
  // may be below the fold, under Bawk's chat bar).
  useEffect(() => {
    const key = wtStep?.allow[0];
    if (!key) return;
    const t = window.setTimeout(() => document.querySelector(`[data-wt="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
    return () => window.clearTimeout(t);
  }, [wtStep?.id]);
  const wtNext = () => setWtIndex((i) => Math.min(i + 1, WT_STEPS.length - 1));
  const [freePick, setFreePick] = useState<SpeciesId | null>(null);
  useEffect(() => {
    if (!wtStep) return;
    if (wtStep.id === 'animal' || wtStep.id === 'fur') setTab('body');
    if (wtStep.id === 'tops' && tab === 'top') wtNext();
    if (wtStep.id === 'shirt') {
      const eq = look.outfit.top;
      const item = eq ? itemFor(eq.itemId) : undefined;
      if (item && !lockOf(item)) wtNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wtStep?.id, tab, look.outfit.top?.itemId]);
  const finishWalkthrough = () => {
    updateInv(owner, { walkthroughDone: true });
    styleSound.save();
    navigate(backTo);
  };

  const equip = (slot: WardrobeSlot, itemId: string | null) => {
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

  const startDressNpc = (id: string) => {
    const p = npcProfiles[id];
    if (!p) return;
    setDressNpc(id);
    setSaved(p.look);
    setLook(p.look);
    setTab('body');
    setMode('dress');
    styleSound.pop();
  };
  const stopDressNpc = (toMode: Mode) => {
    const mine = loadInitial(row?.look, owner);
    setDressNpc(null);
    setSaved(mine);
    setLook(mine);
    setMode(toMode);
  };
  const save = () => {
    if (!canSave) { flash('Buy or take off the locked items first'); return; }
    if (dressNpc) {
      saveNpcProfile(dressNpc, { look });
      setSaved(look);
      styleSound.save();
      play('cheer');
      flash(`${npcProfiles[dressNpc]?.name ?? 'Neighbor'}'s look saved!`);
      return;
    }
    saveStyleLook(owner, look);
    if (wtStep?.id === 'save') wtNext();
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
    const species = studentMode && inv.species.length ? rand(inv.species) : rand(SPECIES).id;
    const outfit: StyleLook['outfit'] = {};
    for (const slot of SLOT_ORDER) {
      if (slot === 'costume') continue;
      const options = catalog.filter((i) => i.slot === slot && !lockOf(i));
      const chance = slot === 'top' || slot === 'bottom' || slot === 'shoes' ? 0.9 : 0.4;
      if (options.length && Math.random() < chance) {
        const item = rand(options);
        outfit[slot] = { itemId: item.id, zones: item.zones.map(() => randomPaint(studentMode ? [...FREE_PATTERNS, ...inv.patterns] : undefined)) };
      }
    }
    const body = structuredClone(speciesById(species).defaultBody);
    if (Math.random() < 0.5) body.fur = randomPaint(studentMode ? [...FREE_PATTERNS, ...inv.patterns] : undefined);
    setLook({ species, body, outfit });
    styleSound.pop();
    play('dance');
  };

  // What the stage shows.
  const stageLooks: { look: StyleLook; x: number; bodyless?: boolean }[] = useMemo(() => {
    if (mode === 'dress') return [{ look, x: 0 }];
    if (mode === 'neighbors') return npcProfiles[npcSel] ? [{ look: npcProfiles[npcSel].look, x: 0 }] : [];
    if (!wsItem) return [];
    const outfitOnly: StyleLook['outfit'] = { [wsItem.slot]: { itemId: wsItem.id, zones: wsZones } };
    const on = (sp: SpeciesId): StyleLook => ({ species: sp, body: structuredClone(speciesById(sp).defaultBody), outfit: outfitOnly });
    if (preview === 'item') return [{ look: on('dog'), x: 0, bodyless: true }];
    if (preview === 'all') return SPECIES.map((sp, i) => ({ look: on(sp.id), x: (i - 1.5) * 1.15 }));
    return [{ look: on(preview), x: 0 }];
  }, [mode, look, wsItem, wsZones, preview, npcProfiles, npcSel]);
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
      <div className={`style-room${wtActive ? ' wt-on' : ''}`}>
        <header className="style-head">
          <div>
            {studentMode && (
              <button type="button" className="style-btn" style={{ marginBottom: 8 }} onClick={() => { if (!wtActive && dirty && canSave) save(); navigate(backTo); }}>
                ← {wtActive ? 'Finish later' : dirty && canSave ? 'Save and go back' : 'Back to Town Square'}
              </button>
            )}
            <h1>{studentMode ? '🧵 The Seamstress' : '👗 Style'}</h1>
            {studentMode && student && <p className="style-note">💵 You have {money(student.coins)}</p>}
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
            <button type="button" role="tab" aria-selected={mode === 'dress' && !dressNpc} className={`style-mode-btn${mode === 'dress' && !dressNpc ? ' on' : ''}`} onClick={() => { if (dressNpc) stopDressNpc('dress'); else setMode('dress'); styleSound.tap(); }}>🪞 Dress up</button>
            <button type="button" role="tab" aria-selected={mode === 'workshop'} className={`style-mode-btn${mode === 'workshop' ? ' on' : ''}`} onClick={() => { if (dressNpc) stopDressNpc('workshop'); else setMode('workshop'); styleSound.tap(); }}>🧵 Item workshop</button>
            <button type="button" role="tab" aria-selected={mode === 'neighbors' || !!dressNpc} className={`style-mode-btn${mode === 'neighbors' || dressNpc ? ' on' : ''}`} onClick={() => { if (dressNpc) stopDressNpc('neighbors'); else setMode('neighbors'); styleSound.tap(); }}>🏘️ Neighbors</button>
          </div>}
          {mode === 'neighbors' ? (
            <div className="style-head-actions"><span className="style-note">Edit each Neighbor's name, title, facts and look.</span></div>
          ) : mode === 'dress' ? (
            <div className="style-head-actions">
              {dressNpc && (
                <span className="style-dressing">
                  🎨 Dressing {npcProfiles[dressNpc]?.name}
                  <button type="button" className="style-btn" onClick={() => { stopDressNpc('neighbors'); styleSound.swish(); }}>← Back to Neighbors</button>
                </span>
              )}
              <button type="button" className={`style-btn${lk('surprise')}`} onClick={surprise}>🎲 Surprise me</button>
              <button type="button" className={`style-btn${lk('reset')}`} onClick={() => { setLook(defaultLook(look.species)); styleSound.swish(); }}>↺ Start over</button>
              <button type="button" className={`style-btn${lk('undo')}`} disabled={!dirty} onClick={() => { setLook(saved); styleSound.swish(); }}>Undo changes</button>
              <button type="button" data-wt="save" className={`style-btn primary${lk('save')}`} disabled={!canSave} onClick={save}>{!canSave ? '🔒 Locked items on' : dirty || wtStep?.id === 'save' ? (dressNpc ? `💾 Save ${npcProfiles[dressNpc]?.name}'s look` : '💾 Save my look') : '✓ Saved'}</button>
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
              {lockedInLook.length > 0 && (
                <div className="style-locked-note" role="status">
                  <strong>🔒 You are wearing locked items. Want to purchase?</strong>
                  <div className="style-locked-list">
                    {lockedInLook.map((t) => t.buy ? (
                      <button key={t.key} type="button" className="style-btn primary" onClick={() => setBuying(t.buy!)}>{t.emoji} Buy {t.label} {money(t.buy.price)}</button>
                    ) : (
                      <span key={t.key} className="style-earn">{t.emoji} {t.label}: {t.earn}</span>
                    ))}
                    <button type="button" className="style-btn" onClick={takeOffLocked}>Take them off</button>
                  </div>
                </div>
              )}
            </div>
            <div className="style-anim">
              <div className={`style-anim-group${lk('move')}`}>
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
                <button type="button" data-wt="wave" className={`style-chip${lk('wave')}`} onClick={() => play('wave')}>👋 Wave</button>
                <button type="button" className={`style-chip${talking ? ' on' : ''}${lk('emote')}`} onClick={() => { setTalking((v) => !v); styleSound.tap(); }}>💬 {talking ? 'Stop talking' : 'Talk'}</button>
                <button type="button" className={`style-chip${lk('emote')}`} onClick={() => play('cheer')}>🙌 Cheer</button>
                <button type="button" className={`style-chip${lk('emote')}`} onClick={() => play('dance')}>💃 Dance</button>
              </div>
            </div>
          </section>

          <section className="style-panel">
            {mode === 'neighbors' ? (
              <NeighborsPanel
                profiles={NPC_ROSTER.map((e) => npcProfiles[e.id]).filter(Boolean)}
                selected={npcSel}
                onSelect={(id) => { setNpcSel(id); styleSound.tap(); }}
                onDress={startDressNpc}
                onSaveDetails={(id, name, title, facts) => {
                  saveNpcProfile(id, { name: name.trim(), facts });
                  setNpcTitleOverride(id, title.trim() === NPC_ROSTER.find((e) => e.id === id)?.defaultTitle ? null : title);
                  styleSound.save();
                  flash(`${name.trim() || 'Neighbor'} saved!`);
                }}
              />
            ) : mode === 'dress' ? (
              <>
                <nav className="style-tabs" aria-label="Style categories">
                  {tabs.map((t) => (
                    <button key={t.id} type="button" data-wt={`tab:${t.id}`} className={`style-tab${tab === t.id ? ' on' : ''}${lk(`tab:${t.id}`)}`} onClick={() => { setTab(t.id); styleSound.tap(); }}>
                      <span aria-hidden="true">{t.emoji}</span>{t.label}
                    </button>
                  ))}
                </nav>
                {tab === 'body' ? (
                  <div className="style-section">
                    <h2>Pick your animal</h2>
                    <div data-wt="species" className={`style-grid${lk('species')}`}>
                      {SPECIES.map((sp) => (
                        <button key={sp.id} type="button" className={`style-tile${look.species === sp.id ? ' on' : ''}${spLocked(sp.id) ? ' locked' : ''}`}
                          onClick={() => {
                            setLook((l) => ({ ...l, species: sp.id, body: structuredClone(sp.defaultBody) })); styleSound.pop(); play('wave');
                            if (wtStep?.id === 'animal') setFreePick(sp.id);
                          }}>
                          <span className="style-tile-emoji">{sp.emoji}</span>{sp.name}
                          {spLocked(sp.id) ? <span className="style-tile-lock" aria-label="Locked">🔒 {money(SPECIES_PRICE)}</span> : null}
                        </button>
                      ))}
                    </div>
                    {studentMode && !wtActive && inv.species.length > 0 && <p className="style-note">Your first animal was free. Each new animal costs {money(SPECIES_PRICE)}.</p>}
                    <div data-wt="fur" className={lk('fur')}>
                      <PaintEditor label="Fur" paint={look.body.fur} onChange={(p) => setLook((l) => ({ ...l, body: { ...l.body, fur: p } }))} isLocked={patLocked} onLocked={(pt) => buyPattern(pt, () => setLook((l) => ({ ...l, body: { ...l.body, fur: { ...l.body.fur, pattern: pt } } })))} />
                    </div>
                    <div className={lk('belly')}>
                      <PaintEditor label={look.species === 'frog' ? 'Tummy & chin' : 'Tummy & muzzle'} paint={look.body.belly} onChange={(p) => setLook((l) => ({ ...l, body: { ...l.body, belly: p } }))} isLocked={patLocked} onLocked={(pt) => buyPattern(pt, () => setLook((l) => ({ ...l, body: { ...l.body, belly: { ...l.body.belly, pattern: pt } } })))} />
                      <PaintEditor label={look.species === 'frog' ? 'Spots & feet' : look.species === 'capybara' ? 'Nose tip, ears & feet' : 'Ears, paws & feet'} paint={look.body.accent} onChange={(p) => setLook((l) => ({ ...l, body: { ...l.body, accent: p } }))} isLocked={patLocked} onLocked={(pt) => buyPattern(pt, () => setLook((l) => ({ ...l, body: { ...l.body, accent: { ...l.body.accent, pattern: pt } } })))} />
                      <ColorOnlyEditor label="Eyes" color={look.body.eyes} onChange={(c) => setLook((l) => ({ ...l, body: { ...l.body, eyes: c } }))} />
                      <ColorOnlyEditor label="Nose" color={look.body.nose} onChange={(c) => setLook((l) => ({ ...l, body: { ...l.body, nose: c } }))} />
                    </div>
                  </div>
                ) : (
                  <div className="style-section">
                    <h2>{SLOT_LABEL[tab]}</h2>
                    {tab === 'costume' && <p className="style-note">A costume turns your character into someone new, from head to toe. Your clothes are kept and come back when you take it off.</p>}
                    {tab !== 'costume' && look.outfit.costume && <p className="style-note">You are wearing a costume. Picking something here takes the costume off.</p>}
                    <div data-wt="items" className={lk('items')}>
                      <ItemGrid items={catalog.filter((i) => i.slot === tab)} selected={look.outfit[tab]?.itemId ?? null} onPick={(id) => equip(tab, id)} allowNone locked={studentMode ? lockOf : undefined} />
                    </div>
                    <div data-wt="zones" className={lk('zones')}>
                      {(() => {
                        const eq = look.outfit[tab];
                        const item = eq ? itemFor(eq.itemId) : undefined;
                        if (!eq || !item) return null;
                        const lock = lockOf(item);
                        if (lock) return <p className="style-note">🔒 This is a preview in its own colors. {lock.kind === 'buy' ? `Buy it for ${money(lock.price)} to change its colors and save it.` : lock.label + ' to earn it.'}</p>;
                        return item.zones.map((z, i) => (
                          <PaintEditor key={`${item.id}-${i}`} label={`${item.name}: ${z.label}`} paint={eq.zones[i] ?? z.paint} onChange={(p) => setZone(tab, i, p)}
                            isLocked={patLocked} onLocked={(pt) => buyPattern(pt, () => setZone(tab, i, { ...(eq.zones[i] ?? z.paint), pattern: pt }))} />
                        ));
                      })()}
                    </div>
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
      {buying && student && (
        <div className="style-confirm-backdrop" onClick={() => setBuying(null)}>
          <div className="style-confirm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{buying.emoji} Buy {buying.label}?</h2>
            <p>It costs <strong>{money(buying.price)}</strong>. You have {money(student.coins)}.</p>
            {student.coins < buying.price && <p>You need {money(buying.price - student.coins)} more. Keep working to earn more Class Cash!</p>}
            <div className="style-head-actions">
              <button type="button" className="style-btn" onClick={() => setBuying(null)}>Not now</button>
              {student.coins >= buying.price && <button type="button" className="style-btn primary" onClick={confirmBuy}>Buy it for {money(buying.price)}</button>}
            </div>
          </div>
        </div>
      )}
      {freePick && (
        <div className="style-confirm-backdrop" onClick={() => setFreePick(null)}>
          <div className="style-confirm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{speciesById(freePick).emoji} Pick the {speciesById(freePick).name}?</h2>
            <p>Your first animal is free, and it is yours to keep. More animals cost {money(SPECIES_PRICE)} each later.</p>
            <div className="style-head-actions">
              <button type="button" className="style-btn" onClick={() => setFreePick(null)}>Look at the others</button>
              <button type="button" className="style-btn primary" onClick={() => { updateInv(owner, { species: [freePick] }); setFreePick(null); styleSound.cheer(); play('cheer'); wtNext(); }}>
                Yes, the {speciesById(freePick).name}!
              </button>
            </div>
          </div>
        </div>
      )}
      {wtStep && (
        <BawkGuide message={wtStep.text} talkKey={wtStep.id} step={`Step ${Math.min(wtIndex, WT_STEPS.length - 1) + 1} of ${WT_STEPS.length}`}>
          {wtStep.next && <button type="button" className="style-btn primary" onClick={wtNext}>Next ➜</button>}
          {wtStep.finish && <button type="button" className="style-btn primary" onClick={finishWalkthrough}>Finish 🎉</button>}
        </BawkGuide>
      )}
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

// The teacher's Neighbors table: every Neighbor and Townsperson with their
// name, title and facts (shown on their character sheet in Town Square),
// plus a button to dress them in Style.
function NeighborsPanel({ profiles, selected, onSelect, onDress, onSaveDetails }: {
  profiles: NpcProfile[];
  selected: string;
  onSelect: (id: string) => void;
  onDress: (id: string) => void;
  onSaveDetails: (id: string, name: string, title: string, facts: string[]) => void;
}) {
  return (
    <div className="style-section">
      <h2>Neighbors</h2>
      <p className="style-note">Tap a row to see them on the stage. Facts show on their character sheet when students tap "About" in Town Square. One fact per line.</p>
      <div className="npc-table" role="table" aria-label="Neighbors">
        <div className="npc-row npc-head" role="row">
          <span role="columnheader">Look</span><span role="columnheader">Name</span><span role="columnheader">Title / role</span><span role="columnheader">Facts</span><span role="columnheader" />
        </div>
        {profiles.map((p) => <NeighborRow key={`${p.id}-${p.name}-${p.title}-${p.facts.join('|')}`} p={p} on={selected === p.id} onSelect={onSelect} onDress={onDress} onSave={onSaveDetails} />)}
      </div>
    </div>
  );
}

function NeighborRow({ p, on, onSelect, onDress, onSave }: {
  p: NpcProfile; on: boolean; onSelect: (id: string) => void; onDress: (id: string) => void;
  onSave: (id: string, name: string, title: string, facts: string[]) => void;
}) {
  const [name, setName] = useState(p.name);
  const [title, setTitle] = useState(p.title);
  const [facts, setFacts] = useState(p.facts.join('\n'));
  const clean = (t: string) => t.replace(/—/g, '-');
  const factList = facts.split('\n').map((f) => f.trim()).filter(Boolean);
  const changed = name !== p.name || title !== p.title || factList.join('|') !== p.facts.join('|');
  return (
    <div className={`npc-row${on ? ' on' : ''}`} role="row" onClick={() => onSelect(p.id)}>
      <span role="cell" className="npc-look">{speciesById(p.look.species).emoji}<small>{p.kind === 'neighbor' ? 'Neighbor' : 'Townsperson'}</small></span>
      <input role="cell" className="style-name-input" value={name} maxLength={30} aria-label={`${p.name}'s name`} onChange={(e) => setName(clean(e.target.value))} />
      <input role="cell" className="style-name-input" value={title} maxLength={40} aria-label={`${p.name}'s title`} onChange={(e) => setTitle(clean(e.target.value))} />
      <textarea role="cell" className="style-name-input npc-facts" value={facts} rows={3} aria-label={`Facts about ${p.name}`} placeholder="Loves pancakes&#10;Has a pet goldfish" onChange={(e) => setFacts(clean(e.target.value))} />
      <span role="cell" className="npc-actions">
        <button type="button" className="style-btn primary" disabled={!changed || !name.trim()} onClick={(e) => { e.stopPropagation(); onSave(p.id, name, title, factList); }}>💾 Save</button>
        <button type="button" className="style-btn" onClick={(e) => { e.stopPropagation(); onDress(p.id); }}>🎨 Dress</button>
      </span>
    </div>
  );
}

function ItemGrid({ items, selected, onPick, allowNone, edited, locked }: { items: WardrobeItem[]; selected: string | null; onPick: (id: string | null) => void; allowNone?: boolean; edited?: Record<string, unknown>; locked?: (item: WardrobeItem) => Lock | null }) {
  return (
    <div className="style-grid">
      {allowNone && (
        <button type="button" className={`style-tile${!selected ? ' on' : ''}`} onClick={() => onPick(null)}>
          <span className="style-tile-emoji">🚫</span>None
        </button>
      )}
      {items.map((item) => {
        const lock = locked?.(item) ?? null;
        return (
          <button key={item.id} type="button" className={`style-tile${selected === item.id ? ' on' : ''}${lock ? ' locked' : ''}`} onClick={() => onPick(item.id)}>
            <span className="style-tile-emoji">{item.emoji}</span>{item.name}
            {edited?.[item.id] ? <span className="style-tile-badge">edited</span> : null}
            {lock ? <span className="style-tile-lock" aria-label="Locked">🔒 {lock.kind === 'buy' ? money(lock.price) : 'Earn it'}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// One color zone: pattern chips plus its two colors on the color wheel.
function PaintEditor({ label, paint, onChange, isLocked, onLocked }: { label: string; paint: Paint; onChange: (p: Paint) => void; isLocked?: (p: PatternId) => boolean; onLocked?: (p: PatternId) => void }) {
  const [which, setWhich] = useState<0 | 1 | null>(null);
  return (
    <div className="style-paint">
      <h3>{label}</h3>
      <div className="style-patterns">
        {PATTERNS.map((pt) => {
          const locked = isLocked?.(pt.id) ?? false;
          return (
            <button key={pt.id} type="button" className={`style-pattern${paint.pattern === pt.id ? ' on' : ''}${locked ? ' locked' : ''}`}
              aria-label={locked ? `${pt.label}, locked, $5` : pt.label}
              onClick={() => { if (locked) { onLocked?.(pt.id); styleSound.tap(); return; } onChange({ ...paint, pattern: pt.id }); styleSound.pop(); }}>
              <img src={patternSwatch({ pattern: pt.id, colors: paint.colors })} alt="" />
              {locked && <span className="style-pattern-lock" aria-hidden="true">🔒</span>}
              <span>{pt.label}</span>
            </button>
          );
        })}
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
