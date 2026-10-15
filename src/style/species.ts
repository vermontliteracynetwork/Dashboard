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
  // The eyes (glasses are fitted in front of them in hats.ts, as are hats
  // to each head's real shape).
  eye: { spread: number; y: number; z: number; size: number };
  // How far the arms rest out from the body when standing, so they never
  // look like they sink into the round tummy (the dog's white arms sit a
  // little wider still, to stand out against its white body).
  armOut: number;
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
    eye: { spread: 0.12, y: 0.12, z: 0.26, size: 0.072 },
    armOut: 0.3,
    gear: { w: 0.345, h: 0.355 },
    defaultBody: { fur: solid('#f4efe6'), belly: solid('#ffffff'), accent: solid('#3b2a20'), eyes: '#1d1414', nose: '#1d1414' },
  },
  {
    id: 'cat',
    name: 'Cat',
    emoji: '🐱',
    eye: { spread: 0.12, y: 0.07, z: 0.26, size: 0.085 },
    armOut: 0.22,
    gear: { w: 0.37, h: 0.34 },
    defaultBody: { fur: { pattern: 'stripes', colors: ['#f2a65a', '#d9772b'] }, belly: solid('#fff3e3'), accent: solid('#ffb3c7'), eyes: '#3f8f3a', nose: '#ff7fa0' },
  },
  {
    id: 'frog',
    name: 'Frog',
    emoji: '🐸',
    eye: { spread: 0.17, y: 0.22, z: 0.18, size: 0.09 },
    armOut: 0.22,
    gear: { w: 0.415, h: 0.29 },
    defaultBody: { fur: solid('#5cbf4a'), belly: solid('#e8f5a8'), accent: solid('#2f8a2c'), eyes: '#1b1b1b', nose: '#2f8a2c' },
  },
  {
    id: 'capybara',
    name: 'Capybara',
    emoji: '🦫',
    eye: { spread: 0.205, y: 0.12, z: 0.215, size: 0.046 },
    armOut: 0.22,
    gear: { w: 0.335, h: 0.36 },
    defaultBody: { fur: solid('#d88b2e'), belly: solid('#f4e6cf'), accent: solid('#7a4a28'), eyes: '#141010', nose: '#4a3530' },
  },
  // Mock-up (2026-10-15): three new animals on the same shared body, so every piece of clothing fits.
  {
    id: 'chicken',
    name: 'Chicken',
    emoji: '🐔',
    eye: { spread: 0.165, y: 0.08, z: 0.235, size: 0.058 },
    armOut: 0.22,
    gear: { w: 0.335, h: 0.37 },
    // Fur = feathers, belly = chest, accent = beak, wing tips and feet, nose = comb and wattle.
    defaultBody: { fur: solid('#fbf7ee'), belly: solid('#fff1d6'), accent: solid('#f5a524'), eyes: '#141010', nose: '#e0352b' },
  },
  {
    id: 'squirrel',
    name: 'Squirrel',
    emoji: '🐿️',
    eye: { spread: 0.135, y: 0.09, z: 0.25, size: 0.08 },
    armOut: 0.22,
    gear: { w: 0.35, h: 0.34 },
    defaultBody: { fur: solid('#b06a3b'), belly: solid('#fbeedb'), accent: solid('#7a4426'), eyes: '#141010', nose: '#3b2620' },
  },
  {
    id: 'fox',
    name: 'Fox',
    emoji: '🦊',
    eye: { spread: 0.125, y: 0.08, z: 0.25, size: 0.072 },
    armOut: 0.22,
    gear: { w: 0.36, h: 0.33 },
    defaultBody: { fur: solid('#e8742c'), belly: solid('#fff8ef'), accent: solid('#3a2418'), eyes: '#5a3a12', nose: '#1d1414' },
  },
];

// MOCK-UP ONLY (Build Queue 195, her words 2026-10-15: "I want to also add a regular person figure... for boys
// and girls, it'll be the same basic figure... Do not push this to the students"). One person on the same shared
// body, so every piece of clothing fits; hair comes from the hair slot (wigs). Not in SPECIES, so no Style picker,
// Seamstress or Neighbors screen offers it; only the fit-check mock-up page (mockup.html) shows it.
// Fur, belly and accent are all skin; the nose color is the eyebrows.
export const PERSON: SpeciesDef = {
  id: 'person',
  name: 'Person',
  emoji: '🧑',
  eye: { spread: 0.115, y: 0.05, z: 0.265, size: 0.062 },
  armOut: 0.22,
  gear: { w: 0.33, h: 0.37 },
  defaultBody: { fur: solid('#e0ac69'), belly: solid('#e0ac69'), accent: solid('#e0ac69'), eyes: '#3b2a20', nose: '#4a3226' },
};
export const SKIN_TONES = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'];
export const ALL_SPECIES: SpeciesDef[] = [...SPECIES, PERSON];

export const speciesById = (id: SpeciesId) => ALL_SPECIES.find((s) => s.id === id) ?? SPECIES[0];

export function defaultLook(species: SpeciesId = 'dog'): StyleLook {
  return {
    species,
    body: structuredClone(speciesById(species).defaultBody),
    // Direct teacher instruction: characters start with no clothes.
    outfit: {},
  };
}
