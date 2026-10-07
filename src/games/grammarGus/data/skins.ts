// Machine skins and colorways (plan 8.7 and 19.2). A skin changes how the
// machine looks, never what it accepts or the video it makes. Free in v1:
// the plan's "basics are free" rule; pricing in gears waits for the teacher.
export interface Skin { id: string; name: string; note: string; swatch: string[]; workbench: string[] }
export const SKINS: Skin[] = [
  { id: 'brass', name: 'Brass Works', note: 'The classic factory look', swatch: ['#f3cf6b', '#7fcfb6', '#f2967a', '#8fb9ee'], workbench: ['#8cc7ec', '#a5dcc0', '#f2d58f', '#d3bdf0'] },
  { id: 'copper', name: 'Copper and Teal', note: 'Copper bodies, teal pipes', swatch: ['#e0a070', '#5fb3a8', '#d9825f', '#6fb0c9'], workbench: ['#b7e0d8', '#cfe6c4', '#f1d9b8', '#c8d8ee'] },
  { id: 'candy', name: 'Candy Factory', note: 'Pastel enamel and white pipes', swatch: ['#ffd6e8', '#c9f2e1', '#ffd1c1', '#d6e4ff'], workbench: ['#fdeaf3', '#e6f7ef', '#fff1d6', '#ece6ff'] },
  { id: 'night', name: 'Night Shift', note: 'Dark floor, warm lamps', swatch: ['#c9a646', '#4f9e86', '#c06a52', '#5f86c4'], workbench: ['#2b3a5c', '#2d4550', '#3d3550', '#323b4a'] },
  { id: 'flat', name: 'Calm Flat', note: 'Plain shapes, nothing busy', swatch: ['#efe3b8', '#cfe6dc', '#f0d4c8', '#d6e2f2'], workbench: ['#e4ecf2', '#e8efe8', '#f2efe4', '#ebe8f2'] },
];
export const skinById = (id?: string) => SKINS.find((s) => s.id === id) ?? SKINS[0];
