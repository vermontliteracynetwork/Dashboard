import { useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../store/store';
import { StyleCharacter } from './StyleCharacter';
import { defaultLook } from './species';
import type { StyleLook, StyleMove } from './types';

// The student's own Seamstress character (docs/STYLE.md), walking or
// standing still. One shared component so every place the student walks
// around shows the same new design: Town Square, their home, and Creative
// Island (teacher 2026-10-08: "make sure new character design applies
// everywhere, for students (in their home)").
// 0.62 matches the old player model at its 2.6 scale; pass a smaller
// scale where the world is built smaller.
export const STYLE_IN_WORLD_SCALE = 0.62;
export function StyleAvatar({ isMoving, scale = STYLE_IN_WORLD_SCALE }: { isMoving: React.RefObject<boolean>; scale?: number }) {
  const currentStudentId = useStore((s) => s.currentStudentId);
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === currentStudentId));
  const look = useMemo<StyleLook>(() => {
    const l = row?.look as StyleLook | undefined;
    return l && l.species && l.body && l.outfit ? l : defaultLook('dog');
  }, [row]);
  const [move, setMove] = useState<StyleMove>('idle');
  useFrame(() => {
    const next: StyleMove = isMoving.current ? 'walk' : 'idle';
    if (next !== move) setMove(next);
  });
  return <StyleCharacter look={look} move={move} scale={scale} />;
}
