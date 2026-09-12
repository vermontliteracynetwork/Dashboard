import { useStore } from '../store/store';
import { AVATAR_CATALOG } from '../store/badges';
import { AvatarGlyph } from './AvatarGlyph';
import { EMOTE_CATALOG } from '../lib/emoteCatalog';
import type { Student } from '../types';

// Direct teacher instruction: the backpack button was opening the full
// Marketplace (shop tabs, prices, cart still one click away) even on its
// "My Stuff" tab — this is a separate, much smaller view that only ever
// shows what the student already owns, with no way to reach the shop from
// it, styled as a game-style hotbar strip rather than a full-page screen.
export default function InventoryHotbar({ student, onClose }: { student: Student; onClose: () => void }) {
  const updateStudent = useStore((s) => s.updateStudent);
  const equipEmote = useStore((s) => s.equipEmote);

  const ownedAvatars = AVATAR_CATALOG.filter((a) => student.ownedAvatarIds.includes(a.id));
  const ownedEmotes = EMOTE_CATALOG.filter((e) => student.ownedEmoteIds.includes(e.id));

  return (
    <div
      style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 210, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}
      role="dialog"
      aria-label="My Stuff"
    >
      <div
        className="chrome-frame"
        style={{
          pointerEvents: 'auto',
          background: 'rgba(255,255,255,0.97)',
          borderRadius: '16px 16px 0 0',
          padding: '10px 14px 14px',
          margin: '0 12px',
          width: '100%',
          maxWidth: 640,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.25)',
        }}
      >
        <div className="row space-between" style={{ alignItems: 'center', marginBottom: 6 }}>
          <strong style={{ fontSize: '0.95rem' }}>🎒 My Stuff</strong>
          <button className="btn btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
          {ownedAvatars.map((a) => {
            const equipped = student.avatar === a.id;
            return (
              <button
                key={a.id}
                onClick={() => updateStudent(student.id, { avatar: a.id })}
                title={a.name}
                style={{
                  flex: '0 0 auto', width: 64, height: 64, borderRadius: 12, cursor: 'pointer',
                  border: equipped ? '3px solid var(--purple, #7c5cff)' : '2px solid var(--ink, #1f4238)',
                  background: '#fff', padding: 4,
                }}
              >
                <AvatarGlyph value={a.id} />
              </button>
            );
          })}
          {ownedEmotes.map((e) => {
            const equipped = student.equippedEmoteId === e.id;
            return (
              <button
                key={e.id}
                onClick={() => equipEmote(student.id, equipped ? null : e.id)}
                title={e.name}
                style={{
                  flex: '0 0 auto', width: 64, height: 64, borderRadius: 12, cursor: 'pointer',
                  border: equipped ? '3px solid var(--purple, #7c5cff)' : '2px solid var(--ink, #1f4238)',
                  background: '#fff', padding: 8,
                }}
              >
                <img src={e.src} alt={e.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </button>
            );
          })}
          {ownedAvatars.length === 0 && ownedEmotes.length === 0 && (
            <p style={{ opacity: 0.7, fontSize: '0.85rem', margin: '10px 4px' }}>Nothing here yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
