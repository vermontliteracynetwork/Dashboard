import type { Paint, SpeciesId, StyleBody, StyleLook } from './types';

// The one shared body template every species uses (all numbers in the
// character's own units; the whole character is about 1.7 tall and gets
// scaled to the world's player height where it's shown). Because torso,
// arms, legs and every joint are identical across species, a shirt or a
// pair of shoes made once fits a dog, a cat, a frog and a capybara.
export const BODY = {
  footH: 0.08,
  legLen: 0.24,
  legR: 0.115,
  legX: 0.15,
  torsoW: 0.5,
  torsoH: 0.56,
  torsoD: 0.36,
  shoulderX: 0.26,
  shoulderInset: 0.07, // shoulders sit this far below the torso top
  armLen: 0.34,
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
  // Where hats sit (relative to the head center, y measured so 0.28 is a
  // plain round head's crown) and how big they are, sized per species so a
  // hat sits ON the head instead of sinking into it; and where glasses sit
  // (at eye level, in front of the eyes), since a frog's eyes are on top
  // of its head and a capybara's are wide apart on a long face.
  hat: { y: number; z: number; scale: number };
  face: { y: number; z: number; scale: number };
  // Headphones and ear defenders: half the head's width at ear level and
  // the height of the crown above it, so the band hugs the head.
  gear: { w: number; h: number };
  defaultBody: StyleBody;
}

const solid = (c: string): Paint => ({ pattern: 'solid', colors: [c, '#ffffff'] });

export const SPECIES: SpeciesDef[] = [
  {
    id: 'dog',
    name: 'Dog',
    emoji: '🐶',
    hat: { y: 0.28, z: -0.01, scale: 1.03 },
    face: { y: 0.11, z: 0.36, scale: 1 },
    gear: { w: 0.345, h: 0.355 },
    defaultBody: { fur: solid('#f4efe6'), belly: solid('#ffffff'), accent: solid('#3b2a20'), eyes: '#1d1414', nose: '#1d1414' },
  },
  {
    id: 'cat',
    name: 'Cat',
    emoji: '🐱',
    hat: { y: 0.274, z: 0.0, scale: 1.09 },
    face: { y: 0.06, z: 0.36, scale: 1.05 },
    gear: { w: 0.37, h: 0.34 },
    defaultBody: { fur: { pattern: 'stripes', colors: ['#f2a65a', '#d9772b'] }, belly: solid('#fff3e3'), accent: solid('#ffb3c7'), eyes: '#3f8f3a', nose: '#ff7fa0' },
  },
  {
    id: 'frog',
    name: 'Frog',
    emoji: '🐸',
    hat: { y: 0.26, z: -0.06, scale: 0.86 },
    face: { y: 0.24, z: 0.27, scale: 1.25 },
    gear: { w: 0.415, h: 0.29 },
    defaultBody: { fur: solid('#5cbf4a'), belly: solid('#e8f5a8'), accent: solid('#2f8a2c'), eyes: '#1b1b1b', nose: '#2f8a2c' },
  },
  {
    id: 'capybara',
    name: 'Capybara',
    emoji: '🦫',
    hat: { y: 0.274, z: -0.04, scale: 1.08 },
    face: { y: 0.13, z: 0.3, scale: 1.4 },
    gear: { w: 0.335, h: 0.36 },
    defaultBody: { fur: solid('#d88b2e'), belly: solid('#f4e6cf'), accent: solid('#7a4a28'), eyes: '#141010', nose: '#4a3530' },
  },
];

export const speciesById = (id: SpeciesId) => SPECIES.find((s) => s.id === id) ?? SPECIES[0];

export function defaultLook(species: SpeciesId = 'dog'): StyleLook {
  return {
    species,
    body: structuredClone(speciesById(species).defaultBody),
    // Direct teacher instruction: characters start with no clothes.
    outfit: {},
  };
}
