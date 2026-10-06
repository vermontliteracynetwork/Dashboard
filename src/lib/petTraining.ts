import { useStore } from '../store/store';
import { PET_ANSWERS_PER_TRAINING } from './petCatalog';

// Pets review (teacher 2026-10-06): right answers anywhere (native games,
// Quiz mode, quizzes, the gas pump) train pets too, not only finished
// assignments. Every PET_ANSWERS_PER_TRAINING right answers = +1 training
// for every pet the student owns. The running count lives in the
// `pettrain:<studentId>` style_looks row (no new SQL).
const owner = (studentId: string) => `pettrain:${studentId}`;

export function recordPetTrainingAnswer(studentId: string) {
  const st = useStore.getState();
  if (!st.pets.some((p) => p.studentId === studentId)) return;
  const row = st.styleLooks.find((r) => r.ownerId === owner(studentId))?.look as { answers?: number } | undefined;
  const answers = (row?.answers ?? 0) + 1;
  st.mergeStyleRow(owner(studentId), { answers: answers % PET_ANSWERS_PER_TRAINING });
  if (answers >= PET_ANSWERS_PER_TRAINING) st.trainPets(studentId, 1, 'answers');
}

export function usePetTrainingAnswers(studentId: string | null | undefined): number {
  const row = useStore((s) => (studentId ? s.styleLooks.find((r) => r.ownerId === owner(studentId)) : undefined));
  return ((row?.look as { answers?: number } | undefined)?.answers ?? 0) % PET_ANSWERS_PER_TRAINING;
}
