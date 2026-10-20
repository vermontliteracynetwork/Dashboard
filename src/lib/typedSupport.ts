import { useStore } from '../store/store';

// How much help a student gets on typed answers (Build Queue 273, her words: "level 1: no support, level 2: spell
// check says if its wrong but doesnt corrrect. only says if it is or isnt part of the grammar. level 3: full spell
// check and correction list option, yes voice type. yes move help ladder based on responses. level of support should
// fluxiate based on student repsonses and whetehr they are right or wrong"). Everyone starts at level 2. Three
// sentences right on the first try in a row: one level less help. Two missed in a row: one level more help.
export type SupportLevel = 1 | 2 | 3;
export const SUPPORT_LABEL: Record<SupportLevel, string> = { 1: 'Level 1: on my own', 2: 'Level 2: word checks', 3: 'Level 3: full help' };
const UP_AFTER = 2, DOWN_AFTER = 3;

export function useTypedSupport() {
  const id = useStore((s) => s.currentStudentId);
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === `typedsupport:${id}`));
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const look = (row?.look ?? {}) as { level?: SupportLevel; rights?: number; misses?: number };
  const level: SupportLevel = look.level ?? 2;
  const record = (firstTry: boolean) => {
    if (!id) return;
    const rights = firstTry ? (look.rights ?? 0) + 1 : 0, misses = firstTry ? 0 : (look.misses ?? 0) + 1;
    let next = level;
    if (rights >= DOWN_AFTER && level > 1) next = (level - 1) as SupportLevel;
    if (misses >= UP_AFTER && level < 3) next = (level + 1) as SupportLevel;
    mergeStyleRow(`typedsupport:${id}`, { level: next, rights: next !== level ? 0 : rights, misses: next !== level ? 0 : misses, at: new Date().toISOString() });
  };
  return { level, record };
}
