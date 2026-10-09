import { useStore } from '../../store/store';
import type { HelpLevel } from './engine/types';
import type { SceneKey } from './engine/orders';

// Grammar Gus teacher settings (plan 3.6, 3.9, 3.18.7, 6.3), saved as the
// `gus-settings` style_looks row (no new SQL). Defaults are the plan's.
export interface GusSettings {
  levels: Record<string, HelpLevel>; // per student; missing = Full help
  strictness: 'cartoon' | 'real';
  videoThreshold: 2 | 3;
  gentleOnly: boolean; // hides attack and other rough verbs
  grownUp: 'never' | 'tap' | 'always'; // grown-up grammar words on the checklist
  focusMode: boolean; // checklist shows only the next three items
  rumble: 'off' | 'soft' | 'normal';
  packs: string[]; // interest word packs in the Parts Bin (plan 17.5)
  finishParts: 'required' | 'auto';
  contraptions: 'collapsed' | 'open' | 'off';
  // "Do it for me" after 2 hints (plan 3.x teacher settings, 25); missing = allowed.
  doItForMe?: boolean;
  // Teacher word tool (Build Queue 2026-10-09): a student's special-interest words, with their forms and a picture.
  teacherWords?: TeacherWord[];
  // Her own recipe cards (Build Queue 2026-10-09).
  teacherOrders?: { id: string; text: string; key: SceneKey }[]; // Workboard Fun parts (Rube Goldberg) in the parts menu // Workboard: students plug in the Capital Letter Press, punctuation and Pixel TV themselves
}
export interface TeacherWord { pos: 'N' | 'V' | 'J' | 'D'; word: string; emoji?: string; plural?: string; past?: string }
export const GUS_SETTINGS_OWNER = 'gus-settings';
export const GUS_DEFAULTS: GusSettings = { levels: {}, strictness: 'cartoon', videoThreshold: 3, gentleOnly: false, grownUp: 'tap', focusMode: false, rumble: 'soft', packs: ['space', 'ocean', 'dinos', 'food', 'heroes', 'wheels'], finishParts: 'required', contraptions: 'collapsed' };

export function useGusSettings(): GusSettings {
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === GUS_SETTINGS_OWNER));
  return { ...GUS_DEFAULTS, ...((row?.look as Partial<GusSettings> | undefined) ?? {}) };
}
export const levelFor = (s: GusSettings, studentId: string | null | undefined): HelpLevel => (studentId ? s.levels[studentId] : undefined) ?? 'full';
