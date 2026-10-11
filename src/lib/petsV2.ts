import { useMemo } from 'react';
import { useStore } from '../store/store';
import { PET_CATALOG, petDefById, type PetDef } from './petCatalog';
import { todayISO } from './dates';
import type { SelZone } from '../types';

// Pets v2 (her spec, 2026-10-11, dev plan Build Queue 19): the shared daily shelter behind the
// Pet Finder app, pet ages, coats and the adoption records. Every student sees the same shelter
// on the same day, because the whole roster is worked out from the date alone; only adoptions
// are saved (one small row per adopted shelter pet, so two adoptions never overwrite each other).

export type PetAge = 'baby' | 'juvenile' | 'adult';
export const PET_AGES: PetAge[] = ['baby', 'juvenile', 'adult'];
export const AGE_LABEL: Record<PetAge, string> = { baby: 'Baby', juvenile: 'Juvenile', adult: 'Adult' };
// Her prototype (Buff Doge's Gym): a pet is a Juvenile from 10 training and an Adult from 25.
// A Juvenile or Adult adopted from the shelter starts at that training, so its age is right.
export const AGE_TRAINING: Record<PetAge, number> = { baby: 0, juvenile: 10, adult: 25 };
export function ageForTraining(training: number): PetAge {
  return training >= AGE_TRAINING.adult ? 'adult' : training >= AGE_TRAINING.juvenile ? 'juvenile' : 'baby';
}
// Babies and Juveniles are smaller versions of the adult (her prototype: 0.55, 0.78, 1).
export const AGE_SCALE: Record<PetAge, number> = { baby: 0.55, juvenile: 0.78, adult: 1 };

// Her spec: "Standard pet cost is $300 for both cats and dogs. all pets should be the same."
export const PET_PRICE_CENTS = 30000;
export const MYSTERY_BOX_CENTS = 20000;
export const PET_CAP = 10; // "Students can have a total of 10 pets"

// Fur color of each breed's model, for the Pet Finder color filter and the cards.
export const COAT: Record<string, { label: string; group: string }> = {
  'pet-pug': { label: 'Fawn', group: 'Tan' },
  'pet-husky': { label: 'Black and gray', group: 'Gray' },
  'pet-poodle': { label: 'White', group: 'White' },
  'pet-beagle': { label: 'Tricolor', group: 'Tricolor' },
  'pet-great-dane': { label: 'Harlequin spots', group: 'Spotted' },
  'pet-shiba-inu': { label: 'Red', group: 'Brown' },
  'pet-cat-2': { label: 'Gray', group: 'Gray' },
  'pet-cat-bicolor': { label: 'Orange and white', group: 'Orange' },
  'pet-cat-black': { label: 'Black', group: 'Black' },
  'pet-cat-ragdoll': { label: 'Cream', group: 'Tan' },
  'pet-cat-bengal': { label: 'Spotted gold', group: 'Spotted' },
  'pet-cat-maine-coon': { label: 'Brown tabby', group: 'Brown' },
};
export const COAT_GROUPS = ['Black', 'White', 'Gray', 'Brown', 'Orange', 'Tan', 'Spotted', 'Tricolor'];
export const coatFor = (defId: string) => COAT[defId] ?? { label: 'Mixed', group: 'Tricolor' };

const NAMES = [
  'Rue', 'Sprinkles', 'Pickles', 'Azalea', 'Biscuit', 'Waffles', 'Pepper', 'Mochi', 'Noodle', 'Juniper',
  'Clover', 'Peanut', 'Maple', 'Ziggy', 'Nugget', 'Olive', 'Pumpkin', 'Scout', 'Hazel', 'Bean',
  'Cinnamon', 'Daisy', 'Echo', 'Fudge', 'Ginger', 'Honey', 'Indigo', 'Jellybean', 'Kiwi', 'Luna',
  'Marshmallow', 'Nova', 'Oreo', 'Pip', 'Quinn', 'Rocket', 'Sunny', 'Toffee', 'Umi', 'Velvet',
  'Willow', 'Yuki', 'Zuzu', 'Acorn', 'Bubbles', 'Cocoa', 'Dot', 'Ember', 'Fern', 'Gizmo',
  'Hopper', 'Iggy', 'Jasper', 'Kona', 'Lemon', 'Milo', 'Nala', 'Otis', 'Poppy', 'Rosie',
  'Sage', 'Tater', 'Waffle', 'Bandit', 'Chewie', 'Dumpling', 'Frankie', 'Gumdrop', 'Koda', 'Lulu',
  'Mango', 'Nacho', 'Pixel', 'Ramen', 'Snickers', 'Taco', 'Wally', 'Yoyo', 'Ziggy Jr', 'Bento',
];

// Small seeded random numbers, so every device works out the same shelter.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ShelterPet {
  id: string; // stable for its whole stay, e.g. "sh-dog-3-17"
  defId: string;
  name: string;
  age: PetAge;
  sex: 'Boy' | 'Girl';
  arrivedDay: number;
  leavesDay: number; // first day it is no longer listed
}

const EPOCH = Date.UTC(2026, 9, 1); // 2026-10-01
export function dayIndex(iso: string = todayISO()): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - EPOCH) / 86400000);
}
export function isoForDay(day: number): string {
  return new Date(EPOCH + day * 86400000).toISOString().slice(0, 10);
}

// Her numbers: 20 pets a day, 10 dogs and 10 cats, each 2 adults, 4 juveniles and 4 babies; an
// even mix of breeds showing about 60 to 80 percent of the breeds; each pet stays 1 to 5 days.
const SLOT_AGES: PetAge[] = ['adult', 'adult', 'juvenile', 'juvenile', 'juvenile', 'juvenile', 'baby', 'baby', 'baby', 'baby'];
const SPECIES = ['dog', 'cat'] as const;

const cache = new Map<number, ShelterPet[]>();
export function shelterRoster(day: number = dayIndex()): ShelterPet[] {
  const hit = cache.get(day);
  if (hit) return hit;
  const breeds = { dog: PET_CATALOG.filter((p) => p.category === 'dog').map((p) => p.id), cat: PET_CATALOG.filter((p) => p.category === 'cat').map((p) => p.id) };
  type Slot = { species: 'dog' | 'cat'; idx: number; age: PetAge; seq: number; pet: ShelterPet | null };
  const slots: Slot[] = SPECIES.flatMap((species) => SLOT_AGES.map((age, idx) => ({ species, idx, age, seq: 0, pet: null as ShelterPet | null })));
  // Always worked out from the first shelter day, so a pet is the same pet for its whole stay.
  const start = 0;
  for (let d = start; d <= day; d++) {
    // The breeds featured on this day (4 or 5 of the 6), so the mix stays between about 60 and 80%.
    const featured: Record<string, string[]> = {};
    for (const sp of SPECIES) {
      const r = rng(`feat-${sp}-${d}`);
      const list = [...breeds[sp]].sort(() => r() - 0.5);
      featured[sp] = list.slice(0, r() < 0.7 ? 4 : 5);
    }
    const used = new Set(slots.map((s) => s.pet?.name).filter(Boolean) as string[]);
    for (const s of slots) {
      if (s.pet && d < s.pet.leavesDay) continue;
      if (s.pet) used.delete(s.pet.name);
      s.seq++;
      const r = rng(`slot-${s.species}-${s.idx}-${s.seq}-${d}`);
      const counts = new Map<string, number>();
      slots.forEach((o) => { if (o.species === s.species && o.pet && d < o.pet.leavesDay) counts.set(o.pet.defId, (counts.get(o.pet.defId) ?? 0) + 1); });
      const pool = featured[s.species];
      const least = Math.min(...pool.map((b) => counts.get(b) ?? 0));
      const choices = pool.filter((b) => (counts.get(b) ?? 0) === least);
      const defId = choices[Math.floor(r() * choices.length)];
      // On the first simulated day pets are partway through their stay, like a real shelter.
      const stay = 1 + Math.floor(r() * 5);
      let name = NAMES[Math.floor(r() * NAMES.length)];
      for (let k = 0; used.has(name) && k < NAMES.length; k++) name = NAMES[(NAMES.indexOf(name) + 1) % NAMES.length];
      used.add(name);
      s.pet = { id: `sh-${s.species}-${s.idx}-${s.seq}-${d}`, defId, name, age: s.age, sex: r() < 0.5 ? 'Boy' : 'Girl', arrivedDay: d, leavesDay: d + stay };
    }
  }
  const out = slots.map((s) => s.pet!).filter(Boolean);
  cache.set(day, out);
  return out;
}

// ---- adoption records (style rows, one per adopted shelter pet) ----
export const ADOPTED_PREFIX = 'shelter:';
export interface AdoptedRow { studentId: string; petId: string; at: string }
export function useAdoptedShelterIds(): Map<string, AdoptedRow> {
  const rows = useStore((s) => s.styleLooks);
  return useMemo(() => {
    const m = new Map<string, AdoptedRow>();
    for (const r of rows) if (r.ownerId.startsWith(ADOPTED_PREFIX)) m.set(r.ownerId.slice(ADOPTED_PREFIX.length), r.look as unknown as AdoptedRow);
    return m;
  }, [rows]);
}

// Her spec: "On launch of new pet version, students receive one free pet coupon".
export const COUPON_PREFIX = 'petcoupon2:';
export function useCouponUsed(studentId: string | null | undefined): boolean {
  return useStore((s) => !!studentId && s.styleLooks.some((r) => r.ownerId === COUPON_PREFIX + studentId && (r.look as { used?: boolean }).used));
}

// Each adopted pet's adoption certificate details (shown again from the Pet Book).
export const CERT_PREFIX = 'petcert:';
export interface PetCertificate { petId: string; studentName: string; petName: string; breed: string; sex: string; date: string; via: 'shelter' | 'mystery' | 'coupon' | 'stray' }
export function useCertificate(petId: string | null | undefined): PetCertificate | null {
  return useStore((s) => (petId ? ((s.styleLooks.find((r) => r.ownerId === CERT_PREFIX + petId)?.look as unknown as PetCertificate) ?? null) : null));
}

// A random breed for the Mystery Adoption Box: always a pet, never an empty box, and a breed the
// student does not have yet when there is one.
export function rollMysteryBreed(ownedDefIds: Set<string>): PetDef {
  const fresh = PET_CATALOG.filter((p) => !ownedDefIds.has(p.id));
  const pool = fresh.length ? fresh : PET_CATALOG;
  return pool[Math.floor(Math.random() * pool.length)];
}
export function randomPetName(): string {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}
export function breedName(defId: string): string {
  return petDefById(defId)?.name ?? 'Pet';
}

// ---- feelings (her spec: "Pets have same ABA/zones of regulation emotion system as players") ----
export interface PetFeeling { zone: SelZone; emotion: string; face: string; says: string; need?: 'feed' | 'pet' | 'play' }
// Worked out from the pet's bars, using the same Zones of Regulation words students use.
export function petFeeling(p: { food: number; social: number; health: number; customName: string }): PetFeeling {
  if (p.health < 40) return { zone: 'blue', emotion: 'Sick', face: '🤒', says: `I feel sick. I am in the Blue Zone. A cuddle and a snack would help me feel better.`, need: 'pet' };
  if (p.food < 40) return { zone: 'yellow', emotion: 'Frustrated', face: '😤', says: `My tummy is rumbling and I feel frustrated. I am in the Yellow Zone. Can I have a snack?`, need: 'feed' };
  if (p.social < 40) return { zone: 'blue', emotion: 'Lonely', face: '🥺', says: `I feel lonely. I am in the Blue Zone. Can we talk or play together?`, need: 'play' };
  if (p.food < 60 || p.social < 60) return { zone: 'blue', emotion: 'Bored', face: '😑', says: `I feel a little bored. I am in the Blue Zone. Want to play?`, need: p.food < p.social ? 'feed' : 'play' };
  if (p.food >= 85 && p.social >= 85 && p.health >= 85) return { zone: 'green', emotion: 'Happy', face: '😃', says: `I feel happy! I am in the Green Zone. Thanks for taking care of me.` };
  return { zone: 'green', emotion: 'Calm', face: '😌', says: `I feel calm. I am in the Green Zone.` };
}
// What the pet says back when the student tells it how they feel.
export const PET_REPLY: Record<SelZone, string[]> = {
  green: ['Yay! We are both ready to learn and play.', 'The Green Zone is a great place to be. Let us keep it going!'],
  yellow: ['Thanks for telling me. When I feel wiggly, I take 5 deep breaths. Want to try with me?', 'I get that way too. Let us count to 10 together, slowly.'],
  blue: ['Thanks for telling me. I am right here with you. A drink of water and a stretch can help.', 'I will sit with you for a bit. Want to think of a happy memory together?'],
  red: ['Thank you for telling me. Let us stop and breathe. In, and out. I am not going anywhere.', 'Big feelings are okay. Squeeze your hands tight, then let go, with me.'],
};

// ---- companions on the left and right (her spec: "Two companions can walk with students on either
// side (right and left) as assigned") ----
export function useCompanions(studentId: string | null | undefined): { left: string | null; right: string | null } {
  const row = useStore((s) => (studentId ? (s.styleLooks.find((r) => r.ownerId === `companions:${studentId}`)?.look as { left?: string | null; right?: string | null } | undefined) : undefined));
  return useMemo(() => ({ left: row?.left ?? null, right: row?.right ?? null }), [row]);
}
