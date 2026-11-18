import { useEffect, useRef, useState } from 'react';
import { ANIMS, HERO_LOOKS, THEMES, THINGS, heroEmoji, type GameProject } from '../../lib/gameBuilder/model';
import { pathAt } from '../../games/gameBuilder/runtime';
import { PictureLibrary } from './GameBuilderLibrary';
import { ART_STYLES, PALETTE, PALETTE_NAMES, colorsOf, costumeKey, emojiToSprite, emptySprite, isSprite, makeArtist, resizeSprite, spriteHasInk, type Sprite } from '../../games/gameBuilder/art';

// The Art tab in Game Builder (Build Queue 664, her words 2026-11-18: "preset design themes (pixel, 3d low poly)
// but i also want them to be able to have a design creator similar to the Gamify theme builder ... I want to have a
// sprite designer/editer so they can work on the design of the game"). Like the Plinko theme builder: a live
// preview on top, then the art style, the colors (with hex codes) and a 16 by 16 sprite editor for the hero and
// every thing in the game.

const ICONS: Record<string, string> = { coin: '🪙', enemy: '🐌', spike: '🔺', star: '⭐', flag: '🚩', dot: '•', power: '●', ghost: '👻', fruit: '🍒', big: '', up1: '⬆️', up2: '⬆️', up3: '⬆️' };
const TILE_HEX: Record<string, string> = { red: '#ff5a5f', blue: '#4c97ff', green: '#3fbf6f', yellow: '#ffcc33', purple: '#9966ff' };
type Update = (f: (q: GameProject) => GameProject) => void;

// A small picture of one thing in the game, drawn the way the game draws it (no emoji text in the menus, her
// rule 2026-11-18 for Game Builder: "no emojis").
export function ArtThumb({ p, k, emoji, size = 44 }: { p: GameProject; k: string; emoji: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current; if (!c) return; const g = c.getContext('2d')!; g.clearRect(0, 0, 64, 64); makeArtist(p).thing(g, k, emoji, 32, 32, 56, false); }, [p, k, emoji]);
  return <canvas ref={ref} width={64} height={64} style={{ width: size, height: size, imageRendering: 'pixelated' }} aria-hidden />;
}

export const HERO_NAMES: Record<string, string> = { cat: 'Cat', dog: 'Dog', robot: 'Robot', frog: 'Frog', chicken: 'Chicken', dino: 'Dinosaur', ghost: 'Alien', ball: 'Ball', rocket: 'Rocket', cookie: 'Cookie', pizza: 'Pizza', gem: 'Gem' };
export function HeroPicker({ p, update }: { p: GameProject; update: Update }) {
  return (
    <div className="gbx-pick">
      {HERO_LOOKS.map(([id, e]) => (
        <button key={id} type="button" className={p.design.hero === id ? 'on' : ''} onClick={() => update((q) => ({ ...q, design: { ...q.design, hero: id } }))}>
          <ArtThumb p={{ ...p, design: { ...p.design, hero: id, sprites: {}, anim: {} } }} k="hero" emoji={e} />
          <span>{HERO_NAMES[id] ?? id}</span>
        </button>
      ))}
    </div>
  );
}

export function slotsFor(p: GameProject): { key: string; label: string; emoji: string }[] {
  const hero = { key: 'hero', label: p.kind === 'clicker' ? 'big button' : 'hero', emoji: heroEmoji(p.design.hero) };
  if (p.kind === 'match3') return THINGS.match3.filter(([k]) => k !== 'any').map(([k, l]) => ({ key: k, label: l, emoji: '' }));
  if (p.kind === 'clicker') return [hero];
  return [hero, ...THINGS[p.kind].filter(([k]) => k !== 'dot' && k !== 'power').map(([k, l]) => ({ key: k, label: l, emoji: ICONS[k] ?? '❓' }))];
}

export function Preview({ p }: { p: GameProject }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const g = c.getContext('2d')!; const W = c.width, H = c.height;
    const A = makeArtist(p); A.sky(g, W, H);
    if (p.kind === 'match3') {
      const cols = THINGS.match3.filter(([k]) => k !== 'any').slice(0, p.settings.tileColors);
      cols.forEach(([k], i) => { const x = 40 + i * 92; g.fillStyle = TILE_HEX[k]; g.beginPath(); g.roundRect(x, 60, 78, 78, 12); g.fill(); A.thing(g, k, '', x + 39, 99, 48); });
    } else {
      A.block(g, 0, H - 44, W, 44); A.block(g, W * 0.55, H - 110, 140, 16);
      const things = slotsFor(p).filter((s) => s.key !== 'hero');
      things.forEach((t, i) => A.thing(g, t.key, t.emoji, 170 + i * 70, H - 70, 34));
      A.thing(g, 'hero', heroEmoji(p.design.hero), 70, H - 68, 44);
    }
    g.font = 'bold 22px system-ui'; g.fillStyle = A.colors.ink; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(p.design.title || p.name, 14, 12);
  }, [p]);
  return <canvas ref={ref} width={560} height={200} className="gba-preview" aria-label="Preview of your game's look" />;
}

export default function ArtPanel({ p, update }: { p: GameProject; update: Update }) {
  const slots = slotsFor(p);
  const [slot, setSlot] = useState(slots[0]?.key ?? 'hero');
  const cur = slots.find((s) => s.key === slot) ?? slots[0];
  const colors = colorsOf(p);
  const setDesign = (patch: Partial<GameProject['design']>) => update((q) => ({ ...q, design: { ...q.design, ...patch } }));
  const setColor = (k: 'sky' | 'ground' | 'ink' | 'accent', v: string) => update((q) => ({ ...q, design: { ...q.design, colors: { ...q.design.colors, [k]: v } } }));
  const [costume, setCostume] = useState(0);
  const [lib, setLib] = useState(false);
  const setPic = (u: string | null) => update((q) => { const pictures = { ...(q.design.pictures ?? {}) }; if (u) pictures[cur.key] = u; else delete pictures[cur.key]; return { ...q, design: { ...q.design, pictures } }; });
  const allSprites = p.design.sprites ?? {};
  const costumeCount = cur ? Math.max(1, ...[0, 1, 2, 3].filter((i) => isSprite(allSprites[costumeKey(cur.key, i)])).map((i) => i + 1)) : 1;
  const ck = cur ? costumeKey(cur.key, Math.min(costume, costumeCount)) : '';
  const sprite = allSprites[ck];
  const size = isSprite(allSprites[cur?.key ?? '']) ? allSprites[cur!.key].length : 16;
  const saveSprite = (s: Sprite | null) => update((q) => { const sprites = { ...(q.design.sprites ?? {}) }; if (s) sprites[ck] = s; else delete sprites[ck]; return { ...q, design: { ...q.design, sprites } }; });
  // Every costume of this sprite switches between 16 and 32 pixels together.
  const setSize = (n: number) => update((q) => { const sprites = { ...(q.design.sprites ?? {}) }; for (let i = 0; i < 4; i++) { const k = costumeKey(cur.key, i); const sp = sprites[k]; sprites[k] = isSprite(sp) ? resizeSprite(sp, n) : emptySprite(n); if (!spriteHasInk(sprites[k]) && i > 0) delete sprites[k]; } if (!spriteHasInk(sprites[cur.key])) sprites[cur.key] = emptySprite(n); return { ...q, design: { ...q.design, sprites } }; });
  const addCostume = () => { if (costumeCount >= 4) return; const from = allSprites[costumeKey(cur.key, costumeCount - 1)]; update((q) => ({ ...q, design: { ...q.design, sprites: { ...(q.design.sprites ?? {}), [costumeKey(cur.key, costumeCount)]: isSprite(from) && spriteHasInk(from) ? from : emojiToSprite(cur.emoji || '⭐') } } })); setCostume(costumeCount); };
  const removeCostume = () => { if (costume === 0) return; update((q) => { const sprites = { ...(q.design.sprites ?? {}) }; for (let i = costume; i < 3; i++) { const nx = sprites[costumeKey(cur.key, i + 1)]; if (nx) sprites[costumeKey(cur.key, i)] = nx; else delete sprites[costumeKey(cur.key, i)]; } delete sprites[costumeKey(cur.key, 3)]; return { ...q, design: { ...q.design, sprites } }; }); setCostume(costume - 1); };

  return (
    <div className="gb-design gba">
      <Preview p={p} />
      <h3>Art style</h3>
      <div className="gba-styles">
        {ART_STYLES.map((s) => (
          <button key={s.id} type="button" className={(p.design.style || 'classic') === s.id ? 'on' : ''} onClick={() => setDesign({ style: s.id })}>
            <b>{s.label}</b><small>{s.blurb}</small>
          </button>
        ))}
      </div>
      {p.kind !== 'custom' && <>
        <h3>World and colors</h3>
        <div className="gb-pick gb-themes">{THEMES.map((t) => <button key={t.id} type="button" className={p.design.theme === t.id && !p.design.colors ? 'on' : ''} style={{ background: `linear-gradient(${t.sky} 60%, ${t.ground} 60%)`, color: t.ink }} onClick={() => setDesign({ theme: t.id, colors: undefined })}>{t.label}</button>)}</div>
        <div className="gba-colors">
          {([['sky', 'Sky'], ['ground', 'Ground and walls'], ['ink', 'Words'], ['accent', 'Extra color']] as const).map(([k, l]) => (
            <label key={k}><input type="color" value={colors[k]} onChange={(e) => setColor(k, e.target.value)} /> <span>{l}<small>{colors[k].toUpperCase()}</small></span></label>
          ))}
          {p.design.colors && <button type="button" className="gb-btn" onClick={() => setDesign({ colors: undefined })}>Use the world's colors</button>}
        </div>
        <h3>Sprites: draw your own</h3>
        <div className="gba-slots">
          {slots.map((s) => {
            const own = p.design.sprites?.[s.key];
            return (
              <button key={s.key} type="button" className={slot === s.key ? 'on' : ''} onClick={() => { setSlot(s.key); setCostume(0); }}>
                <span className="gba-slot-pic">{isSprite(own) ? <SpriteThumb s={own} /> : s.emoji ? <ArtThumb p={p} k={s.key} emoji={s.emoji} size={34} /> : <i style={{ background: TILE_HEX[s.key] }} />}</span>
                {s.label}{isSprite(own) && <small>drawn</small>}
              </button>
            );
          })}
        </div>
        {cur && (
          <div className="gba-row">
            <button type="button" className="gb-btn" onClick={() => setLib(true)}>Use a picture from the library</button>
            {p.design.pictures?.[cur.key] && <><img src={p.design.pictures[cur.key]} alt="" className="gba-libpic" /><button type="button" className="gb-btn" onClick={() => setPic(null)}>Stop using it</button></>}
            <span className="gb-muted">A drawing you make below is used instead of a library picture.</span>
          </div>
        )}
        {lib && cur && <PictureLibrary onClose={() => setLib(false)} onPick={(u) => { setPic(u); setLib(false); }} />}
        {cur && (
          <div className="gba-costumes">
            <span>Costumes:</span>
            {Array.from({ length: costumeCount }, (_, i) => <button key={i} type="button" className={`gb-btn ${Math.min(costume, costumeCount - 1) === i ? 'gb-primary' : ''}`} onClick={() => setCostume(i)}>{i + 1}</button>)}
            {costumeCount < 4 && <button type="button" className="gb-btn" onClick={addCostume}>+ Add a costume</button>}
            {costume > 0 && <button type="button" className="gb-btn" onClick={removeCostume}>Delete costume {costume + 1}</button>}
            <span className="gba-size">Size: <button type="button" className={`gb-btn ${size === 16 ? 'gb-primary' : ''}`} onClick={() => setSize(16)}>16</button><button type="button" className={`gb-btn ${size === 32 ? 'gb-primary' : ''}`} onClick={() => setSize(32)}>32 (more detail)</button></span>
          </div>
        )}
        {cur && costumeCount > 1 && <p className="gb-muted">Your {cur.label} flips between its costumes while it moves, like walking.</p>}
        {cur && <SpriteEditor key={`${ck}-${size}`} size={size} label={cur.label} start={isSprite(sprite) ? sprite : null} emoji={cur.emoji} onSave={saveSprite} />}
        {cur && <><h3>Moves for the {cur.label}</h3><MovesPanel key={`m-${cur.key}`} p={p} update={update} slotKey={cur.key} emoji={cur.emoji} label={cur.label} /></>}
        {p.kind !== 'match3' && <>
          <h3>Or pick a hero picture</h3>
          <HeroPicker p={p} update={update} />
        </>}
      </>}
    </div>
  );
}

function SpriteThumb({ s }: { s: Sprite }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current; if (!c) return; const g = c.getContext('2d')!; g.clearRect(0, 0, 16, 16); s.forEach((row, y) => [...row].forEach((ch, x) => { const col = PALETTE[parseInt(ch, 16)]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } })); }, [s]);
  return <canvas ref={ref} width={16} height={16} className="gba-thumb" />;
}

export function SpriteEditor({ size, label, start, emoji, onSave }: { size: number; label: string; start: Sprite | null; emoji: string; onSave: (s: Sprite | null) => void }) {
  const SPRITE_SIZE = size;
  const [grid, setGrid] = useState<Sprite>(start && start.length === size ? start : emptySprite(size));
  const [color, setColor] = useState(1);
  const [tool, setTool] = useState<'pen' | 'fill'>('pen');
  const [undo, setUndo] = useState<Sprite[]>([]);
  const painting = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const latest = useRef(grid); latest.current = grid;

  const commit = (g: Sprite) => { setGrid(g); onSave(g.some((r) => /[1-9a-f]/.test(r)) ? g : null); };
  const remember = () => setUndo((u) => [...u.slice(-29), latest.current]);
  const setCell = (g: Sprite, x: number, y: number, v: string) => g.map((row, yy) => (yy === y ? row.slice(0, x) + v + row.slice(x + 1) : row));
  const fill = (g: Sprite, x: number, y: number, v: string) => {
    const target = g[y][x]; if (target === v) return g; const rows = g.map((r) => r.split('')); const st = [[x, y]];
    while (st.length) { const [cx, cy] = st.pop()!; if (cx < 0 || cy < 0 || cx >= SPRITE_SIZE || cy >= SPRITE_SIZE || rows[cy][cx] !== target) continue; rows[cy][cx] = v; st.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]); }
    return rows.map((r) => r.join(''));
  };
  const cellAt = (e: React.PointerEvent) => {
    const b = gridRef.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - b.left) / b.width) * SPRITE_SIZE), y = Math.floor(((e.clientY - b.top) / b.height) * SPRITE_SIZE);
    return x >= 0 && y >= 0 && x < SPRITE_SIZE && y < SPRITE_SIZE ? [x, y] : null;
  };
  const v = color.toString(16);
  const down = (e: React.PointerEvent) => {
    const c = cellAt(e); if (!c) return; e.preventDefault(); remember();
    if (tool === 'fill') { commit(fill(latest.current, c[0], c[1], v)); return; }
    painting.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setGrid(setCell(latest.current, c[0], c[1], v));
  };
  const move = (e: React.PointerEvent) => { if (!painting.current) return; const c = cellAt(e); if (c && latest.current[c[1]][c[0]] !== v) setGrid(setCell(latest.current, c[0], c[1], v)); };
  const up = () => { if (!painting.current) return; painting.current = false; commit(latest.current); };

  return (
    <div className="gba-editor">
      <div className="gba-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }} ref={gridRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="grid" aria-label={`Drawing grid for the ${label}`}>
        {grid.map((row, y) => [...row].map((ch, x) => <i key={`${x},${y}`} style={{ background: PALETTE[parseInt(ch, 16)] || undefined }} />))}
      </div>
      <div className="gba-tools">
        <div className="gba-palette" role="radiogroup" aria-label="Colors">
          {PALETTE.map((c, i) => <button key={i} type="button" role="radio" aria-checked={color === i} aria-label={PALETTE_NAMES[i]} title={PALETTE_NAMES[i]} className={`${color === i ? 'on' : ''} ${i === 0 ? 'gba-erase' : ''}`} style={c ? { background: c } : undefined} onClick={() => setColor(i)}>{i === 0 ? 'Erase' : ''}</button>)}
        </div>
        <div className="gba-row">
          <button type="button" className={`gb-btn ${tool === 'pen' ? 'gb-primary' : ''}`} onClick={() => setTool('pen')}>Pencil</button>
          <button type="button" className={`gb-btn ${tool === 'fill' ? 'gb-primary' : ''}`} onClick={() => setTool('fill')}>Fill bucket</button>
          <button type="button" className="gb-btn" disabled={!undo.length} onClick={() => { const last = undo[undo.length - 1]; setUndo((u) => u.slice(0, -1)); commit(last); }}>Undo</button>
        </div>
        <div className="gba-row">
          <button type="button" className="gb-btn" onClick={() => { remember(); commit(grid.map((r) => [...r].reverse().join(''))); }}>Flip</button>
          {emoji && <button type="button" className="gb-btn" onClick={() => { remember(); commit(resizeSprite(emojiToSprite(emoji), size)); }}>Start from the picture</button>}
          <button type="button" className="gb-btn" onClick={() => { remember(); commit(emptySprite(size)); }}>Clear</button>
        </div>
        <p className="gb-muted">Tip: drag your finger to draw. An empty grid uses the picture instead.</p>
      </div>
    </div>
  );
}

// ---------- Moves: a preset animation, or a path drawn with a finger (her words: "draw an animation path like
// custom animations on canva") ----------
export function MovesPanel({ p, update, slotKey, emoji, label }: { p: GameProject; update: Update; slotKey: string; emoji: string; label: string }) {
  const cur = p.design.anim?.[slotKey] ?? '';
  const setAnim = (v: string) => update((q) => { const anim = { ...(q.design.anim ?? {}) }; if (v) anim[slotKey] = v; else delete anim[slotKey]; return { ...q, design: { ...q.design, anim } }; });
  const canPath = p.kind === 'platformer' && slotKey !== 'hero';
  return (
    <div className="gba-moves">
      <div className="gba-row">{ANIMS.map(([id, l]) => <button key={id || 'none'} type="button" className={`gb-btn ${cur === id ? 'gb-primary' : ''}`} onClick={() => setAnim(id)}>{l}</button>)}</div>
      {canPath && <PathEditor p={p} update={update} slotKey={slotKey} emoji={emoji} label={label} />}
    </div>
  );
}

function PathEditor({ p, update, slotKey, emoji, label }: { p: GameProject; update: Update; slotKey: string; emoji: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const saved = p.design.paths?.[slotKey];
  const [pts, setPts] = useState<number[][]>(saved?.pts ?? []);
  const [secs, setSecs] = useState(saved?.secs ?? 3);
  const drawing = useRef(false);
  const W = 420, H = 220, cx = W / 2, cy = H / 2;
  const save = (np: number[][], s: number) => update((q) => { const paths = { ...(q.design.paths ?? {}) }; if (np.length > 1) paths[slotKey] = { pts: np, secs: s }; else delete paths[slotKey]; return { ...q, design: { ...q.design, paths } }; });
  useEffect(() => {
    const c = ref.current; if (!c) return; const g = c.getContext('2d')!; const A = makeArtist(p); let raf = 0;
    const frame = () => {
      A.sky(g, W, H); A.block(g, 0, H - 24, W, 24);
      if (pts.length > 1) { g.strokeStyle = '#7c3aed'; g.lineWidth = 3; g.setLineDash([8, 6]); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(cx + x, cy + y) : g.moveTo(cx + x, cy + y))); g.stroke(); g.setLineDash([]); }
      let ox = 0, oy = 0;
      if (pts.length > 1 && !drawing.current) [ox, oy] = pathAt({ pts, secs }, performance.now() / 1000);
      else if (pts.length) [ox, oy] = [pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]];
      A.thing(g, slotKey, emoji, cx + (pts[0]?.[0] ?? 0) + ox, cy + (pts[0]?.[1] ?? 0) + oy, 36);
      raf = requestAnimationFrame(frame);
    };
    frame(); return () => cancelAnimationFrame(raf);
  }, [p, pts, secs, slotKey, emoji, cx, cy]);
  const at = (e: React.PointerEvent) => { const b = ref.current!.getBoundingClientRect(); return [Math.round((e.clientX - b.left) * (W / b.width) - cx), Math.round((e.clientY - b.top) * (H / b.height) - cy)]; };
  return (
    <div className="gba-path">
      <p className="gb-muted">Draw a path with your finger. The {label} will follow it in the game, over and over.</p>
      <canvas ref={ref} width={W} height={H} className="gba-path-canvas" aria-label={`Draw a path for the ${label}`}
        onPointerDown={(e) => { e.preventDefault(); drawing.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setPts([at(e)]); }}
        onPointerMove={(e) => { if (!drawing.current) return; const q = at(e); setPts((old) => { const l = old[old.length - 1]; return l && Math.hypot(q[0] - l[0], q[1] - l[1]) < 6 ? old : [...old, q].slice(0, 120); }); }}
        onPointerUp={() => { if (!drawing.current) return; drawing.current = false; setPts((cur) => { save(cur, secs); return cur; }); }} />
      <div className="gba-row">
        <label className="gba-speed">Time for one trip: <b>{secs} seconds</b><input type="range" min={1} max={10} value={secs} onChange={(e) => { const v = Number(e.target.value); setSecs(v); if (pts.length > 1) save(pts, v); }} /></label>
        <button type="button" className="gb-btn" disabled={!pts.length} onClick={() => { setPts([]); save([], secs); }}>Clear path</button>
      </div>
    </div>
  );
}
