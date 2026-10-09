// Label and Unit Maker (Claudia's Phase 2 writing machines, Build Queue 2026-10-09): label a science
// diagram from a word bank, write a measurement with a number AND a unit (a wrong unit sparks), and
// see the science word split into colored word parts with what each part means.

export interface LabelSpot { word: string; x: number; y: number; hint: string }
export interface LabelDiagram {
  id: string; title: string; spots: LabelSpot[]; extras: string[];
  measure: { sentence: string; answer: string; wrong: string[]; wrongNumbers: string[] };
  parts?: { word: string; parts: [string, string][] };
}
export const LABEL_DIAGRAMS: LabelDiagram[] = [
  { id: 'plant', title: 'A bean plant', extras: ['wing', 'wheel'],
    spots: [{ word: 'flower', x: 50, y: 14, hint: '🌸' }, { word: 'leaf', x: 76, y: 38, hint: '🍃' }, { word: 'stem', x: 50, y: 52, hint: '🌱' }, { word: 'roots', x: 50, y: 90, hint: '🫚' }],
    measure: { sentence: 'The ruler shows the plant is ___ tall.', answer: '12 cm', wrong: ['12 kg', '12 mL'], wrongNumbers: ['21 cm'] },
    parts: { word: 'photosynthesis', parts: [['photo', 'light'], ['synthesis', 'putting together']] } },
  { id: 'thermo', title: 'A thermometer', extras: ['roots', 'crater'],
    spots: [{ word: 'bulb', x: 50, y: 88, hint: '🔴' }, { word: 'tube', x: 50, y: 46, hint: '🧪' }, { word: 'scale', x: 74, y: 30, hint: '📏' }],
    measure: { sentence: 'The thermometer reads ___.', answer: '20 °C', wrong: ['20 cm', '20 kg'], wrongNumbers: ['30 °C'] },
    parts: { word: 'thermometer', parts: [['thermo', 'heat'], ['meter', 'measure']] } },
  { id: 'volcano', title: 'A volcano', extras: ['stem', 'bulb'],
    spots: [{ word: 'ash cloud', x: 50, y: 8, hint: '☁️' }, { word: 'crater', x: 50, y: 30, hint: '🕳️' }, { word: 'lava', x: 30, y: 60, hint: '🔥' }, { word: 'magma', x: 50, y: 88, hint: '🟠' }],
    measure: { sentence: 'The sign says the volcano is ___ tall.', answer: '3 km', wrong: ['3 kg', '3 mL'], wrongNumbers: ['30 km'] },
    parts: { word: 'volcanology', parts: [['volcano', 'a mountain that erupts'], ['logy', 'the study of']] } },
  { id: 'water', title: 'The water cycle', extras: ['magma', 'gear'],
    spots: [{ word: 'evaporation', x: 22, y: 60, hint: '♨️' }, { word: 'condensation', x: 50, y: 14, hint: '☁️' }, { word: 'precipitation', x: 80, y: 44, hint: '🌧️' }, { word: 'collection', x: 50, y: 88, hint: '🌊' }],
    measure: { sentence: 'The rain gauge filled with ___ of rain.', answer: '5 mm', wrong: ['5 kg', '5 °C'], wrongNumbers: ['50 mm'] },
    parts: { word: 'evaporation', parts: [['e', 'out'], ['vapor', 'steam'], ['tion', 'the act of']] } },
  { id: 'machine', title: "Gus's machine", extras: ['leaf', 'lava'],
    spots: [{ word: 'lever', x: 12, y: 40, hint: '🕹️' }, { word: 'gear', x: 38, y: 70, hint: '⚙️' }, { word: 'pipe', x: 62, y: 52, hint: '🔧' }, { word: 'screen', x: 86, y: 34, hint: '📺' }],
    measure: { sentence: 'The tape measure shows the pipe is ___ long.', answer: '30 cm', wrong: ['30 kg', '30 mL'], wrongNumbers: ['13 cm'] },
    parts: { word: 'machinery', parts: [['machine', 'a tool with moving parts'], ['ry', 'a group of']] } },
];
