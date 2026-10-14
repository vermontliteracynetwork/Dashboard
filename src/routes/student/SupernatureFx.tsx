// Her three pixel effects packs (Build Queue 141, 2026-10-14): explosions (Sentient Dream Studio),
// Pixel Effect RPG Part 19 and Effects Pack 12, cut into strips by scripts/supernature-art/fx.py.
// <Fx> plays one strip with CSS steps, so it costs nothing while idle and stays crisp at any size.
import type { CSSProperties } from 'react';
import { SN } from '../../lib/supernature';
import type { Aff } from '../../lib/supernatureBattle';

const F = (n: number, w = 64, h = 64) => ({ n, w, h });
export const FX = {
  hit_fire: F(12), hit_water: F(14), hit_storm: F(9, 128, 128), hit_earth: F(11), hit_nature: F(14), hit_ice: F(12),
  hit_light: F(14), hit_shadow: F(14), hit_mind: F(14), hit_wind: F(14), hit_tackle: F(14), miss: F(10),
  orb_fire: F(14), orb_water: F(14), orb_earth: F(14), orb_ice: F(14), orb_light: F(14), orb_wind: F(14),
  orb_mind: F(30, 32, 32), orb_shadow: F(30, 32, 32), orb_storm: F(30, 32, 32),
  breath: F(14), heal: F(14), potion: F(14), poof: F(14),
  flame: F(15, 64, 128), blast: F(23), quake: F(11), twister: F(14), frost: F(7), splash: F(14), dust: F(14),
} as const;
export type FxKey = keyof typeof FX;

// Each power has its own hit and its own flying orb (nature keeps her Vine Whip strip).
export const HIT_FX: Record<Aff | 'tackle', FxKey> = {
  fire: 'hit_fire', water: 'hit_water', storm: 'hit_storm', earth: 'hit_earth', nature: 'hit_nature', ice: 'hit_ice',
  light: 'hit_light', shadow: 'hit_shadow', mind: 'hit_mind', wind: 'hit_wind', tackle: 'hit_tackle',
};
export const ORB_FX: Record<Aff | 'tackle', FxKey> = {
  fire: 'orb_fire', water: 'orb_water', storm: 'orb_storm', earth: 'orb_earth', nature: 'orb_earth', ice: 'orb_ice',
  light: 'orb_light', shadow: 'orb_shadow', mind: 'orb_mind', wind: 'orb_wind', tackle: 'orb_wind',
};

// size = on-screen width in px; loop keeps playing (disasters, breathing), otherwise it plays once.
export function Fx({ k, size = 128, loop = false, fps = 12, className = '', style, delay = 0 }: { k: FxKey; size?: number; loop?: boolean; fps?: number; className?: string; style?: CSSProperties; delay?: number }) {
  const f = FX[k];
  const h = Math.round((size * f.h) / f.w);
  return (
    <span
      aria-hidden="true"
      className={`snfx${loop ? ' loop' : ''}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: h, backgroundImage: `url(${SN}fx/${k}.png)`, backgroundSize: `${size * f.n}px ${h}px`, ['--fxw' as string]: `${-size * f.n}px`, animationTimingFunction: `steps(${f.n})`, animationDuration: `${f.n / fps}s`, animationDelay: `${delay}s`, ...style }}
    />
  );
}
