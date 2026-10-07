import { useStore } from '../../store/store';
import type { HelpLevel } from './engine/types';

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
}
export const GUS_SETTINGS_OWNER = 'gus-settings';
export const GUS_DEFAULTS: GusSettings = { levels: {}, strictness: 'cartoon', videoThreshold: 3, gentleOnly: false, grownUp: 'tap', focusMode: false, rumble: 'soft', packs: ['space', 'ocean'] };

export function useGusSettings(): GusSettings {
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === GUS_SETTINGS_OWNER));
  return { ...GUS_DEFAULTS, ...((row?.look as Partial<GusSettings> | undefined) ?? {}) };
}
export const levelFor = (s: GusSettings, studentId: string | null | undefined): HelpLevel => (studentId ? s.levels[studentId] : undefined) ?? 'full';
