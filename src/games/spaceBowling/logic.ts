// Space Bowling rules (docs/SPACE_BOWLING_SPEC.pdf). Pure functions, no
// React, so the game screen stays readable.

export const LANE_X = [-1.0, -0.5, 0, 0.5, 1.0];
export const PIN_HEAD_Z = -3.6;
const ROW_GAP = 0.42;
const PIN_GAP = 0.48;

// Ten pins in the classic triangle, head pin nearest the player.
export const PIN_SPOTS: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) out.push([(i - r / 2) * PIN_GAP, PIN_HEAD_Z - r * ROW_GAP]);
  return out;
})();
const rowOf = (i: number) => (i === 0 ? 0 : i < 3 ? 1 : i < 6 ? 2 : 3);

export type PowerUp = 'shuttle' | 'ufo' | 'meteor';
export const POWER_INFO: Record<PowerUp, { name: string; icon: string; text: string }> = {
  shuttle: { name: 'Strike Shuttle', icon: '🚀', text: 'A guaranteed strike! The shuttle spins down the lane and knocks every pin over.' },
  ufo: { name: 'UFO', icon: '🛸', text: 'The UFO beams up two pins before you roll.' },
  meteor: { name: 'Meteor Shower', icon: '☄️', text: 'Send a meteor shower at the next player! Their 5 lanes smash into just 3, so aiming is harder.' },
};

// What hitting an asteroid gives you: the Strike Shuttle is very rare (5%),
// the UFO and Meteor Shower are common.
export function rollPowerUp(rand = Math.random): PowerUp {
  const r = rand();
  if (r < 0.05) return 'shuttle';
  return r < 0.525 ? 'ufo' : 'meteor';
}

// Which pins a roll down a lane knocks over. Pins in the ball's path go
// down, and each falling pin can tip over its neighbours behind and beside
// it, so the middle lane strikes often and the edges get a few.
// shaken: the roll comes right after a meteor shower hit this player, so
// fewer pins go down (teacher: "after a metor shower has been
// adminsitered, chances of hitting pins are less"): the ball wobbles off
// its line more, hits a narrower band, knocks fewer neighbors, and edge
// lanes gutter more often.
export function knockPins(laneX: number, standing: boolean[], rand = Math.random, shaken = false): { down: number[]; gutter: boolean } {
  const edge = Math.abs(laneX) >= 0.99;
  if (edge && rand() < (shaken ? 0.18 : 0.06)) return { down: [], gutter: true };
  const x = laneX + (rand() - 0.5) * (shaken ? 0.6 : 0.24);
  const down = new Set<number>();
  PIN_SPOTS.forEach(([px], i) => { if (standing[i] && Math.abs(px - x) < (shaken ? 0.26 : 0.36)) down.add(i); });
  const queue = [...down];
  while (queue.length) {
    const k = queue.shift()!;
    const [kx] = PIN_SPOTS[k];
    PIN_SPOTS.forEach(([px], i) => {
      if (!standing[i] || down.has(i)) return;
      const dr = rowOf(i) - rowOf(k);
      const dx = Math.abs(px - kx);
      const p = dr === 1 && dx <= 0.3 ? 0.72 : dr === 0 && dx <= 0.55 ? 0.3 : dr === 2 && dx <= 0.05 ? 0.4 : 0;
      if (p > 0 && rand() < p * (shaken ? 0.5 : 1)) { down.add(i); queue.push(i); }
    });
  }
  return { down: [...down], gutter: false };
}

// The meteor shower squeezes 5 lanes into 3 wider, less exact choices.
export const METEOR_LANES: { label: string; lanes: number[] }[] = [
  { label: 'L', lanes: [0, 1] },
  { label: 'M', lanes: [1, 2, 3] },
  { label: 'R', lanes: [3, 4] },
];

// The computer aims mostly for the middle.
export function cpuLane(rand = Math.random): number {
  const w = [0.1, 0.22, 0.36, 0.22, 0.1];
  let r = rand();
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return 2;
}

// Planet bowling balls (Kenney Planets, CC0) with silly names.
export const PLANETS: { id: string; name: string; src: string }[] = [
  { id: 'planet00', name: 'Bloopiter', src: '/games/space-bowling/planets/planet00.png' },
  { id: 'planet01', name: 'Marshmallow Mars', src: '/games/space-bowling/planets/planet01.png' },
  { id: 'planet02', name: 'Snoozeptune', src: '/games/space-bowling/planets/planet02.png' },
  { id: 'planet03', name: 'Gigglegonia', src: '/games/space-bowling/planets/planet03.png' },
  { id: 'planet04', name: 'Saturnoodle', src: '/games/space-bowling/planets/planet04.png' },
  { id: 'planet05', name: 'Plutoot', src: '/games/space-bowling/planets/planet05.png' },
  { id: 'planet06', name: 'Fizzbit Prime', src: '/games/space-bowling/planets/planet06.png' },
  { id: 'planet07', name: 'Jellybeanus', src: '/games/space-bowling/planets/planet07.png' },
  { id: 'planet08', name: 'Wobbleton', src: '/games/space-bowling/planets/planet08.png' },
  { id: 'planet09', name: 'Cosmic Meatball', src: '/games/space-bowling/planets/planet09.png' },
];

// The game's background is the teacher's own pink galaxy picture (direct
// instruction 2026-10-04: "use this image as the background for the space
// bowling game"). The Kenney space skyboxes stay in the folder, unused.
export const BACKGROUND = '/games/space-bowling/skybox/galaxy-pink.jpg';
export const SKYBOXES = [BACKGROUND];

// The Space Alien costume is earned with this many right answers here.
export const COSTUME_GOAL = 500;
