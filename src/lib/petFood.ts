import { useStore } from '../store/store';

// Pet food (her words, 2026-10-12: "food needs to be purchased in the marketplace to give to pets. (or
// earned in spins or games or otherwise). show a small inventory under the health bars. allow students
// to drag the food to the pet in this pause view to fill food."). Food is bought in the Marketplace's
// Pet food tab, or earned: Farm Grow harvests give that crop and Doc Fishing catches give a fish. Feeding
// always uses one food from the student's own inventory (`petfood:<studentId>` style row, no new SQL).

export interface PetFood { id: string; name: string; img: string; fills: number; priceCents: number }
export const PET_FOODS: PetFood[] = [
  { id: 'apple', name: 'Apple', img: '/games/farm/crops/apple-item.png', fills: 15, priceCents: 300 },
  { id: 'tomato', name: 'Tomato', img: '/games/farm/crops/tomato-item.png', fills: 15, priceCents: 300 },
  { id: 'corn', name: 'Corn', img: '/games/farm/crops/corn-item.png', fills: 20, priceCents: 400 },
  { id: 'grapes', name: 'Grapes', img: '/games/farm/crops/grapes-item.png', fills: 20, priceCents: 400 },
  { id: 'fish', name: 'Fish', img: '/games/fishing/fish/bluegill.png', fills: 30, priceCents: 600 },
  { id: 'pumpkin', name: 'Pumpkin', img: '/games/farm/crops/pumpkin-item.png', fills: 35, priceCents: 800 },
];
export const foodById = (id: string) => PET_FOODS.find((f) => f.id === id);
const owner = (studentId: string) => `petfood:${studentId}`;
type Row = { items?: Record<string, number> };
const itemsOf = (studentId: string): Record<string, number> =>
  ((useStore.getState().styleLooks.find((r) => r.ownerId === owner(studentId))?.look as Row | undefined)?.items) ?? {};

export function usePetFood(studentId: string | null | undefined): Record<string, number> {
  const row = useStore((s) => (studentId ? s.styleLooks.find((r) => r.ownerId === owner(studentId)) : undefined));
  return ((row?.look as Row | undefined)?.items) ?? EMPTY;
}
const EMPTY: Record<string, number> = {};
export function addPetFood(studentId: string, foodId: string, n = 1) {
  if (!foodById(foodId)) return;
  const items = itemsOf(studentId);
  useStore.getState().mergeStyleRow(owner(studentId), { items: { ...items, [foodId]: Math.max(0, (items[foodId] ?? 0) + n) } });
}
// Feeds one of this food (or the first food they have) to the pet. False when there is none.
export function feedFromInventory(studentId: string, petId: string, foodId?: string): PetFood | null {
  const items = itemsOf(studentId);
  const food = foodId ? foodById(foodId) : PET_FOODS.find((f) => (items[f.id] ?? 0) > 0);
  if (!food || (items[food.id] ?? 0) < 1) return null;
  addPetFood(studentId, food.id, -1);
  useStore.getState().feedPet(petId, food.fills);
  return food;
}
export const totalFood = (items: Record<string, number>) => Object.values(items).reduce((a, b) => a + b, 0);
