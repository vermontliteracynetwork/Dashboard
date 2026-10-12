import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest, useVisitScore } from '../../components/MyBest';

// Gem Mine (her native game list, 2026-09-30: "cave or shop; answers dig up gems that fill
// collection pages"). A cave wall of dirt and rock tiles with gems hidden inside. Each right answer
// gives three pickaxe swings; tapping a tile chips it (rock takes two swings) and opens it to show
// what is behind. Gems fill three collection pages (Common, Rare, Legendary). Clearing the wall's
// gems brings a fresh wall.

interface Gem { id: string; name: string; color: string; tier: 0 | 1 | 2; fact: string }
const GEMS: Gem[] = [
  { id: 'quartz', name: 'Quartz', color: '#eef0f8', tier: 0, fact: 'Quartz is one of the most common minerals on Earth.' },
  { id: 'jasper', name: 'Jasper', color: '#c0503a', tier: 0, fact: 'Jasper often has stripes and spots like a painting.' },
  { id: 'agate', name: 'Agate', color: '#d98c4a', tier: 0, fact: 'Agates grow in rings inside hollow rocks.' },
  { id: 'jade', name: 'Jade', color: '#3fae6a', tier: 0, fact: 'Jade is so tough that people once made tools from it.' },
  { id: 'amber', name: 'Amber', color: '#f0a030', tier: 0, fact: 'Amber is old tree sap. Some pieces have bugs inside!' },
  { id: 'rose', name: 'Rose Quartz', color: '#f4a6c0', tier: 0, fact: 'Rose quartz gets its pink color from tiny bits of other minerals.' },
  { id: 'ruby', name: 'Ruby', color: '#d6223a', tier: 1, fact: 'Rubies are red because of a metal called chromium.' },
  { id: 'sapphire', name: 'Sapphire', color: '#2a5fd6', tier: 1, fact: 'Sapphires can be blue, yellow, pink and even green.' },
  { id: 'emerald', name: 'Emerald', color: '#1f9e5a', tier: 1, fact: 'Emeralds were a favorite gem of Queen Cleopatra.' },
  { id: 'amethyst', name: 'Amethyst', color: '#8a4fd0', tier: 1, fact: 'Amethyst is a purple kind of quartz.' },
  { id: 'topaz', name: 'Topaz', color: '#f2c230', tier: 1, fact: 'Topaz can grow into crystals as big as a refrigerator.' },
  { id: 'aqua', name: 'Aquamarine', color: '#5fd0e0', tier: 1, fact: 'Aquamarine is named after the color of sea water.' },
  { id: 'diamond', name: 'Diamond', color: '#e8f6ff', tier: 2, fact: 'Diamonds are the hardest natural thing on Earth.' },
  { id: 'opal', name: 'Opal', color: '#ffd6f0', tier: 2, fact: 'Opals flash every color of the rainbow when you tilt them.' },
  { id: 'blackopal', name: 'Black Opal', color: '#2b2b44', tier: 2, fact: 'Black opals are very rare and come mostly from Australia.' },
  { id: 'alex', name: 'Alexandrite', color: '#4f8a7a', tier: 2, fact: 'Alexandrite changes color from green to red in different light.' },
  { id: 'moon', name: 'Moonstone', color: '#cfd8f0', tier: 2, fact: 'Moonstone seems to glow from inside, like moonlight.' },
  { id: 'starruby', name: 'Star Ruby', color: '#ff4060', tier: 2, fact: 'A star ruby shows a shining six pointed star.' },
];
const TIER_NAME = ['Common', 'Rare', 'Legendary'];
const TIER_COLOR = ['#7a8a99', '#5b8def', '#c77dff'];
const COLS = 6, ROWS = 4, GEMS_PER_WALL = 5, SWINGS = 3;

interface Tile { hp: number; max: number; gem: string | null; open: boolean }
const rollGem = () => {
  const r = Math.random(), tier = r < 0.06 ? 2 : r < 0.32 ? 1 : 0;
  const pool = GEMS.filter((g) => g.tier === tier);
  return pool[Math.floor(Math.random() * pool.length)].id;
};
const newWall = (): Tile[] => {
  const tiles: Tile[] = Array.from({ length: COLS * ROWS }, () => { const rock = Math.random() < 0.35; return { hp: rock ? 2 : 1, max: rock ? 2 : 1, gem: null, open: false }; });
  const spots = tiles.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, GEMS_PER_WALL);
  for (const i of spots) tiles[i].gem = rollGem();
  return tiles;
};

export function GemIcon({ color, size = 48 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="gm-gem">
      <polygon points="12,6 36,6 46,18 24,44 2,18" fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="2" strokeLinejoin="round" />
      <polygon points="12,6 18,18 2,18" fill="rgba(255,255,255,0.35)" />
      <polygon points="18,18 30,18 24,44" fill="rgba(255,255,255,0.18)" />
      <polygon points="36,6 30,18 46,18" fill="rgba(0,0,0,0.12)" />
      <polyline points="2,18 46,18" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" fill="none" />
      <polygon points="12,6 36,6 30,18 18,18" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}

export default function GemMine() {
  const back = useBack();
  const { settings, ask, element, pay, student } = useAsk('Gem Mine', '💎', 'gemMine');
  const visit = useVisitScore('gemMine');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [wall, setWall] = useState<Tile[]>(newWall);
  const [swings, setSwings] = useState(0);
  const [hit, setHit] = useState<{ i: number; at: number } | null>(null);
  const [found, setFound] = useState<{ gem: Gem; isNew: boolean } | null>(null);
  const [pages, setPages] = useState(false);
  const [page, setPage] = useState(0);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!student) return null;
  const owner = `gemmine:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { gems?: Record<string, number> } | undefined) ?? {};
  const have = saved.gems ?? {};
  const left = wall.filter((t) => t.gem && !t.open).length;

  const getSwings = () => ask(`⛏️ Answer for ${SWINGS} pickaxe swings!`, () => setSwings((s) => s + SWINGS));
  const dig = (i: number) => {
    const t = wall[i];
    if (t.open || swings <= 0) return;
    setSwings((s) => s - 1);
    setHit({ i, at: Date.now() }); sfx.thud();
    clearTimeout(timer.current); timer.current = window.setTimeout(() => setHit(null), 400);
    const hp = t.hp - 1;
    const next = wall.map((x, k) => (k === i ? { ...x, hp, open: hp <= 0 } : x));
    setWall(next);
    if (hp <= 0 && t.gem) {
      const gem = GEMS.find((g) => g.id === t.gem)!;
      const isNew = !have[gem.id];
      mergeStyleRow(owner, { gems: { ...have, [gem.id]: (have[gem.id] ?? 0) + 1 } });
      sfx.chime(); visit.add(); if (isNew || gem.tier > 0) playCheer();
      setFound({ gem, isNew });
    }
  };
  const fresh = () => { pay(); setWall(newWall()); };
  const pageGems = GEMS.filter((g) => g.tier === page);

  return (
    <div className="gm">
      <header className="fd-head gm-head">
        <button type="button" className="btn" onClick={() => { pay(); back.go(); }}>✕ Leave</button>
        <h1>💎 Gem Mine</h1>
        <SfxToggle />
        {settings}
        <MyBest game="gemMine" unit="gems found" />
        <button type="button" className="btn" onClick={() => setPages(true)}>📔 Gem Pages ({Object.keys(have).length} / {GEMS.length})</button>
      </header>
      <div className="gm-main">
        <p className="fd-msg gm-msg" aria-live="polite">
          {left === 0 ? 'You found every gem in this wall!' : swings > 0 ? `⛏️ ${swings} swing${swings === 1 ? '' : 's'} left. Tap the wall to dig. ${left} gem${left === 1 ? ' is' : 's are'} hiding here.` : `${left} gem${left === 1 ? ' is' : 's are'} hiding in this wall. Answer a question for pickaxe swings!`}
        </p>
        <div className={`gm-wall${swings > 0 ? ' live' : ''}`} style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
          {wall.map((t, i) => {
            const gem = t.gem ? GEMS.find((g) => g.id === t.gem)! : null;
            return (
              <button key={i} type="button" className={`gm-tile${t.open ? ' open' : t.max === 2 ? ' rock' : ' dirt'}${!t.open && t.hp < t.max ? ' cracked' : ''}${hit?.i === i ? ' hit' : ''}`} onClick={() => dig(i)} disabled={t.open || swings <= 0} aria-label={t.open ? (gem ? `${gem.name} found` : 'Empty') : t.max === 2 ? 'Rock' : 'Dirt'}>
                {t.open && (gem ? <GemIcon color={gem.color} size={44} /> : <span className="gm-pebble" aria-hidden>·</span>)}
                {hit?.i === i && <span key={hit.at} className="gm-chips" aria-hidden><i /><i /><i /></span>}
              </button>
            );
          })}
        </div>
        {left === 0
          ? <button type="button" className="btn btn-primary btn-lg fd-big gm-go" onClick={fresh}>🪨 Dig a new wall</button>
          : <button type="button" className="btn btn-primary btn-lg fd-big gm-go" onClick={getSwings}>⛏️ Get pickaxe swings{swings > 0 ? ` (you have ${swings})` : ''}</button>}
      </div>
      {found && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            {found.isNew && <span className="fd-new">✨ New for your Gem Pages!</span>}
            <div className="gm-big" aria-hidden><GemIcon color={found.gem.color} size={110} /></div>
            <h2>You dug up {/^[AEIOU]/.test(found.gem.name) ? 'an' : 'a'} {found.gem.name}!</h2>
            <span className="fd-tier" style={{ background: TIER_COLOR[found.gem.tier] }}>{TIER_NAME[found.gem.tier]}</span>
            <p>{found.gem.fact}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setFound(null)}>⛏️ Keep digging</button>
          </div>
        </div>
      )}
      {pages && (
        <div className="pf-overlay" onClick={() => setPages(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>📔 Gem Pages</h2>
            <div className="gm-tabs" role="tablist">
              {TIER_NAME.map((n, i) => (
                <button key={n} type="button" role="tab" aria-selected={page === i} className={`btn${page === i ? ' btn-primary' : ''}`} onClick={() => setPage(i)}>
                  {n} ({GEMS.filter((g) => g.tier === i && have[g.id]).length} / 6)
                </button>
              ))}
            </div>
            <div className="fd-book">
              {pageGems.map((g) => (
                <div key={g.id} className={`fd-page gm-page${have[g.id] ? '' : ' locked'}`}>
                  {have[g.id] ? <GemIcon color={g.color} size={48} /> : <span className="fd-page-icon">❔</span>}
                  <strong>{have[g.id] ? g.name : '???'}</strong>
                  <small style={{ color: TIER_COLOR[g.tier] }}>{TIER_NAME[g.tier]}</small>
                  {have[g.id] ? <small>Found {have[g.id]}</small> : null}
                </div>
              ))}
            </div>
            {pageGems.every((g) => have[g.id]) && <p className="gm-full">🏆 This page is complete!</p>}
            <button type="button" className="btn btn-lg" onClick={() => setPages(false)}>Close</button>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
