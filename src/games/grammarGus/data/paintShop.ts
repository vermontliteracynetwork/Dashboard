// Gus's Paint Shop (Claudia's Phase 2, Build Queue 2026-10-09): new factory floors and pipe paint
// for the Workboard. Claudia planned it as a gear sink, but the teacher removed gear coins on
// 2026-10-08 ("coins in grammar gus need to be removed, they dont equart to anything"), so nothing is
// bought: each look unlocks with the stickers earned from finished jobs. It never unlocks or gates
// hints, help or calm mode, and the grammar colors of the word machines never change.

export interface Floor { id: string; name: string; icon: string; stickers: number; bg: { backgroundColor: string; backgroundImage: string; backgroundSize: string } }
export interface PipePaint { id: string; name: string; stickers: number; color: string; light: string }

export const FLOORS: Floor[] = [
  { id: 'factory', name: 'Factory floor', icon: '🏭', stickers: 0, bg: { backgroundColor: '#8fb3c9', backgroundImage: 'radial-gradient(rgba(31,47,77,0.22) 1.6px, transparent 1.7px), linear-gradient(rgba(255,255,255,0.08) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.08) 2px, transparent 2px)', backgroundSize: '24px 24px, 96px 96px, 96px 96px' } },
  { id: 'lab', name: 'Science lab', icon: '🧪', stickers: 2, bg: { backgroundColor: '#eef4f8', backgroundImage: 'linear-gradient(rgba(31,143,191,0.18) 2px, transparent 2px), linear-gradient(90deg, rgba(31,143,191,0.18) 2px, transparent 2px)', backgroundSize: '48px 48px, 48px 48px' } },
  { id: 'junkyard', name: 'Junkyard', icon: '🔩', stickers: 5, bg: { backgroundColor: '#a98c6a', backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(80,60,40,0.5) 3px, transparent 4px), radial-gradient(circle at 70% 80%, rgba(200,206,216,0.7) 2.5px, transparent 3.5px), radial-gradient(circle at 50% 50%, rgba(60,45,30,0.25) 10px, transparent 11px)', backgroundSize: '60px 60px, 44px 44px, 120px 120px' } },
  { id: 'space', name: 'Space station', icon: '🚀', stickers: 10, bg: { backgroundColor: '#1b2340', backgroundImage: 'radial-gradient(#ffffff 1.2px, transparent 1.6px), radial-gradient(#9fd8ff 1px, transparent 1.4px), linear-gradient(rgba(127,180,255,0.12) 2px, transparent 2px), linear-gradient(90deg, rgba(127,180,255,0.12) 2px, transparent 2px)', backgroundSize: '70px 70px, 43px 43px, 96px 96px, 96px 96px' } },
  { id: 'candy', name: 'Candy factory', icon: '🍬', stickers: 15, bg: { backgroundColor: '#ffe3f0', backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.7) 0 14px, transparent 14px 28px)', backgroundSize: 'auto' } },
  { id: 'jungle', name: 'Jungle workshop', icon: '🌴', stickers: 20, bg: { backgroundColor: '#5f9e4a', backgroundImage: 'radial-gradient(ellipse at 30% 40%, rgba(40,90,30,0.55) 8px, transparent 9px), radial-gradient(ellipse at 75% 70%, rgba(150,210,110,0.45) 6px, transparent 7px)', backgroundSize: '50px 40px, 64px 52px' } },
];
export const PIPE_PAINTS: PipePaint[] = [
  { id: 'copper', name: 'Copper', stickers: 0, color: '#c98a4b', light: '#e7b07a' },
  { id: 'chrome', name: 'Chrome', stickers: 1, color: '#a9b4c2', light: '#e3e8ee' },
  { id: 'gold', name: 'Gold', stickers: 3, color: '#d4a62a', light: '#f7d774' },
  { id: 'emerald', name: 'Emerald', stickers: 6, color: '#2e9e6a', light: '#7fd8a8' },
  { id: 'neon', name: 'Neon pink', stickers: 9, color: '#e0459b', light: '#ff9be8' },
  { id: 'ocean', name: 'Ocean blue', stickers: 12, color: '#2f6fd0', light: '#8fc3ff' },
];
export const floorById = (id?: string) => FLOORS.find((f) => f.id === id) ?? FLOORS[0];
export const pipeById = (id?: string) => PIPE_PAINTS.find((p) => p.id === id) ?? PIPE_PAINTS[0];
