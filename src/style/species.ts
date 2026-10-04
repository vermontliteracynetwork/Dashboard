import type { Paint, SpeciesId, StyleBody, StyleLook } from './types';

// The one shared body template every species uses (all numbers in the
// character's own units; the whole character is about 1.7 tall and gets
// scaled to the world's player height where it's shown). Because torso,
// arms, legs and every joint are identical across species, a shirt or a
// pair of shoes made once fits a dog, a cat, a frog and a capybara.
export const BODY = {
  footH: 0.07,
  legLen: 0.4,
  legR: 0.1,
  legX: 0.13,
  torsoW: 0.5,
  torsoH: 0.56,
  torsoD: 0.36,
  shoulderX: 0.3,
  shoulderInset: 0.07, // shoulders sit this far below the torso top
  armLen: 0.4,
  armR: 0.085,
  headR: 0.33,
  neck: 0.05,
};

export const HIP_Y = BODY.footH + BODY.legLen;
export const TORSO_TOP = HIP_Y + BODY.torsoH;
export const HEAD_Y = TORSO_TOP + BODY.neck + BODY.headR;
export const SHOULDER_Y = TORSO_TOP - BODY.shoulderInset;

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  emoji: string;
  // Where hats sit (relative to the head center) and how big they are,
  // and where glasses sit, since a frog's eyes are on top of its head and
  // a capybara's are high on a long face.
  hat: { y: number; z: number; scale: number };
  face: { y: number; z: number; scale: number };
  defaultBody: StyleBody;
}

const solid = (c: string): Paint => ({ pattern: 'solid', colors: [c, '#ffffff'] });

export const SPECIES: SpeciesDef[] = [
  {
    id: 'dog',
    name: 'Dog',
    emoji: '🐶',
    hat: { y: 0.28, z: -0.02, scale: 1 },
    face: { y: 0.06, z: 0.3, scale: 1 },
    defaultBody: { fur: solid('#c98b4f'), belly: solid('#f3dcc0'), accent: solid('#7a4a24'), eyes: '#2b1a0e', nose: '#1d1414' },
  },
  {
    id: 'cat',
    name: 'Cat',
    emoji: '🐱',
    hat: { y: 0.28, z: -0.02, scale: 1 },
    face: { y: 0.06, z: 0.3, scale: 1 },
    defaultBody: { fur: { pattern: 'stripes', colors: ['#f2a65a', '#d9772b'] }, belly: solid('#fff3e3'), accent: solid('#ffb3c7'), eyes: '#3f8f3a', nose: '#ff7fa0' },
  },
  {
    id: 'frog',
    name: 'Frog',
    emoji: '🐸',
    hat: { y: 0.27, z: -0.1, scale: 1.05 },
    face: { y: 0.22, z: 0.2, scale: 1.15 },
    defaultBody: { fur: solid('#5cbf4a'), belly: solid('#e8f5a8'), accent: solid('#2f8a2c'), eyes: '#1b1b1b', nose: '#2f8a2c' },
  },
  {
    id: 'capybara',
    name: 'Capybara',
    emoji: '🦫',
    hat: { y: 0.26, z: -0.06, scale: 1 },
    face: { y: 0.1, z: 0.3, scale: 1 },
    defaultBody: { fur: solid('#b07c4f'), belly: solid('#d2a77a'), accent: solid('#8a5f3a'), eyes: '#1b130c', nose: '#3a2a1c' },
  },
];

export const speciesById = (id: SpeciesId) => SPECIES.find((s) => s.id === id) ?? SPECIES[0];

export function defaultLook(species: SpeciesId = 'dog'): StyleLook {
  return {
    species,
    body: structuredClone(speciesById(species).defaultBody),
    outfit: {
      top: { itemId: 'tee', zones: [{ pattern: 'solid', colors: ['#4a90e2', '#ffffff'] }] },
      bottom: { itemId: 'pants', zones: [{ pattern: 'solid', colors: ['#34495e', '#ffffff'] }] },
      shoes: { itemId: 'sneakers', zones: [{ pattern: 'solid', colors: ['#ffffff', '#e74c3c'] }, { pattern: 'solid', colors: ['#e74c3c', '#ffffff'] }] },
    },
  };
}
