import { useEffect } from 'react';
import { useStore } from '../store/store';
import { petDefById, PETS_PAUSED } from './petCatalog';

// Pets overhaul (teacher 2026-10-06, verbatim: "all pets pet functions
// and pet purchases that have been made in the game by students need to
// be completely paused. All student pets need to be removed. They need to
// be refunded for whatever amount those pets are currently in the
// marketplace, whether or not they purchased them. [...] It needs to be
// added to their bank register").
//
// Runs once the store has loaded: every pet still in the pets table is
// refunded at its catalog price (free, spin, Mystery Box and coupon pets
// included) as a bank register row, then deleted. The teacher's session
// handles every student; a student's own session handles only their own
// pets, so an iPad that logs in before the teacher opens her dashboard
// still gets its refund. A pet is processed once per session (the local
// set below) and disappears from every other client through the normal
// realtime delete, so it can't be refunded twice unless two clients load
// it in the same instant.
const done = new Set<string>();

export function usePetOverhaulRefunds() {
  const hydrated = useStore((s) => s.hydrated);
  const pets = useStore((s) => s.pets);
  const role = useStore((s) => s.role);
  const currentStudentId = useStore((s) => s.currentStudentId);
  useEffect(() => {
    if (!PETS_PAUSED || !hydrated || pets.length === 0) return;
    const st = useStore.getState();
    const mine = role === 'teacher' ? pets : pets.filter((p) => p.studentId === currentStudentId);
    for (const pet of mine) {
      if (done.has(pet.id)) continue;
      done.add(pet.id);
      const student = st.students.find((s) => s.id === pet.studentId);
      if (!student) continue;
      const def = petDefById(pet.petDefId);
      const refund = def?.priceCents ?? 0;
      st.refundPetForOverhaul(pet.id, refund, `🐾 Pet refund: ${pet.customName || def?.name || 'pet'} (pets are getting an upgrade!)`);
    }
  }, [hydrated, pets, role, currentStudentId]);
}
