import { useState } from 'react';
import NpcPieMenu from '../../components/NpcPieMenu';
import { useStore } from '../../store/store';
import { KNOCK_MS, answerKnock, useKnock } from './homeLots';

// The host's side of a knock: a pie menu like a Neighbor conversation, "Come in!" or "Not now".
// Shown wherever the host is (Town Square or at home) while the knock is fresh.
export function KnockListener() {
  const me = useStore((s) => s.currentStudentId);
  const k = useKnock(me);
  const [closedAt, setClosedAt] = useState<string | null>(null);
  if (!me || !k?.at || k.answer || k.at === closedAt || Date.now() - Date.parse(k.at) > KNOCK_MS) return null;
  return (
    <NpcPieMenu
      name={k.fromName || 'A friend'}
      title="is knocking at your door"
      wedges={[
        { id: 'yes', icon: '🚪', label: 'Come in!', bg: '#bbf7d0', onSelect: () => answerKnock(me, true) },
        { id: 'no', icon: '🙅', label: 'Not now', bg: '#fecaca', onSelect: () => answerKnock(me, false) },
      ]}
      onClose={() => setClosedAt(k.at!)}
    />
  );
}
