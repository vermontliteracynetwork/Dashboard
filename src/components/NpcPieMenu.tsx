// The conversation-starter pie menu that opens when a student taps a
// Neighbor or Townsperson (teacher direction 2026-10-04): big round wedges
// around the character's name, iPad-sized, with Cancel underneath.
export type NpcWedge = { id: string; icon: string; label: string; bg: string; onSelect: () => void };

export default function NpcPieMenu({ name, title, wedges, onClose }: { name: string; title?: string; wedges: NpcWedge[]; onClose: () => void }) {
  return (
    <div className="npc-pie-backdrop" role="dialog" aria-modal="true" aria-label={`Talk with ${name}`} onClick={onClose}>
      <div className="npc-pie" onClick={(e) => e.stopPropagation()}>
        <div className="npc-pie-center">
          <strong>{name}</strong>
          {title && <span>{title}</span>}
        </div>
        {wedges.map((w, i) => {
          const angle = (i / wedges.length) * Math.PI * 2 - Math.PI / 2;
          const r = 112;
          return (
            <button
              key={w.id}
              type="button"
              className="npc-pie-wedge"
              style={{ left: `calc(50% + ${Math.cos(angle) * r}px)`, top: `calc(50% + ${Math.sin(angle) * r}px)`, background: w.bg }}
              onClick={() => { onClose(); w.onSelect(); }}
            >
              <span className="npc-pie-icon" aria-hidden="true">{w.icon}</span>
              <span className="npc-pie-label">{w.label}</span>
            </button>
          );
        })}
        <button type="button" className="npc-pie-cancel" onClick={onClose}>✕ Not right now</button>
      </div>
    </div>
  );
}
