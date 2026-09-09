export interface ColorOption {
  id: string;
  name: string;
  hex: string;
  price: number; // Class Cash, in cents; 0 = free starter, always owned
}

export const COLOR_CATALOG: ColorOption[] = [
  { id: 'color-black', name: 'Black', hex: '#1f1147', price: 0 },
  { id: 'color-blue', name: 'Blue', hex: '#3b82f6', price: 0 },
  { id: 'color-red', name: 'Red', hex: '#e63946', price: 200 },
  { id: 'color-green', name: 'Green', hex: '#2fae5d', price: 200 },
  { id: 'color-purple', name: 'Purple', hex: '#7c3aed', price: 200 },
  { id: 'color-orange', name: 'Orange', hex: '#fb923c', price: 200 },
  { id: 'color-pink', name: 'Pink', hex: '#ec4899', price: 200 },
  { id: 'color-teal', name: 'Teal', hex: '#14b8a6', price: 200 },
  { id: 'color-gold', name: 'Gold', hex: '#d4a017', price: 400 },
  { id: 'color-rainbow', name: 'Rainbow', hex: 'rainbow', price: 800 },
];

export const STARTER_COLOR_IDS: string[] = COLOR_CATALOG.filter((c) => c.price === 0).map((c) => c.id);

const BY_ID = new Map(COLOR_CATALOG.map((c) => [c.id, c]));
export function colorById(id: string): ColorOption | undefined {
  return BY_ID.get(id);
}
