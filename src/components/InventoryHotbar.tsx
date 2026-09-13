import { useState } from 'react';
import { useStore } from '../store/store';
import { AVATAR_CATALOG } from '../store/badges';
import { AvatarGlyph } from './AvatarGlyph';
import { EMOTE_CATALOG } from '../lib/emoteCatalog';
import { ALL_JOKES } from '../lib/worldJokes';
import { QUEST1_NEIGHBORS } from '../lib/worldQuest1';
import { TOWNSPEOPLE } from '../lib/worldTownspeople';
import type { Student } from '../types';

// Direct teacher instruction: the backpack button was opening the full
// Marketplace (shop tabs, prices, cart still one click away) even on its
// "My Stuff" tab — this is a separate, much smaller view that only ever
// shows what the student already owns, with no way to reach the shop from
// it, styled as a game-style hotbar strip rather than a full-page screen.
export default function InventoryHotbar({ student, onClose }: { student: Student; onClose: () => void }) {
  const updateStudent = useStore((s) => s.updateStudent);
  const equipEmote = useStore((s) => s.equipEmote);
  const [tab, setTab] = useState<'stuff' | 'jokes' | 'friends'>('stuff');
  const [openJokeId, setOpenJokeId] = useState<string | null>(null);

  const ownedAvatars = AVATAR_CATALOG.filter((a) => student.ownedAvatarIds.includes(a.id));
  const ownedEmotes = EMOTE_CATALOG.filter((e) => student.ownedEmoteIds.includes(e.id));
  const heardJokes = student.worldJokesHeardIds.map((id) => ({ id, entry: ALL_JOKES[id] })).filter((j) => j.entry);
  // Direct teacher instruction: a Friends section listing every Neighbor and
  // Townsperson the student has talked to. worldNpcLastTalkDates is set the
  // first time each NPC id is talked to (and only ever updated, never
  // cleared) so its keys are a permanent "met" record for both Quest
  // Neighbors and ambient Townspeople, not just "talked to today."
  const metNpcs = Object.keys(student.worldNpcLastTalkDates)
    .map((id) => {
      const neighbor = QUEST1_NEIGHBORS.find((n) => n.id === id);
      if (neighbor) return { id, name: neighbor.name, role: neighbor.role, lastTalk: student.worldNpcLastTalkDates[id] };
      const townsperson = TOWNSPEOPLE[id];
      if (townsperson) return { id, name: townsperson.name, role: 'Townsperson', lastTalk: student.worldNpcLastTalkDates[id] };
      return null;
    })
    .filter((n): n is { id: string; name: string; role: string; lastTalk: string } => !!n)
    .sort((a, b) => b.lastTalk.localeCompare(a.lastTalk));

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
          <div className="row" style={{ gap: 6 }}>
            <button className={`btn btn-sm${tab === 'stuff' ? ' btn-primary' : ''}`} onClick={() => setTab('stuff')}>🎒 My Stuff</button>
            <button className={`btn btn-sm${tab === 'jokes' ? ' btn-primary' : ''}`} onClick={() => setTab('jokes')}>📖 Joke Book ({heardJokes.length})</button>
            <button className={`btn btn-sm${tab === 'friends' ? ' btn-primary' : ''}`} onClick={() => setTab('friends')}>🧑‍🤝‍🧑 Friends ({metNpcs.length})</button>
          </div>
          <button className="btn btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {tab === 'friends' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
            {metNpcs.length === 0 && (
              <p style={{ opacity: 0.7, fontSize: '0.85rem', margin: '10px 4px' }}>
                No friends yet. Talk to a Neighbor or Townsperson in Town Square!
              </p>
            )}
            {metNpcs.map((f) => (
              <div
                key={f.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f7f5ef', border: '2px solid var(--ink, #1f4238)', borderRadius: 10, padding: '8px 12px' }}
              >
                <span style={{ fontSize: '1.3rem' }}>🙂</span>
                <div>
                  <strong style={{ fontSize: '0.85rem' }}>{f.name}</strong>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{f.role}</div>
                </div>
              </div>
            ))}
            {/* Other students met in Town Square aren't listed yet — that
                needs real multiplayer presence, which doesn't exist in this
                game yet. This note keeps the tab honest instead of looking
                broken/incomplete once that's built. */}
            <p style={{ opacity: 0.55, fontSize: '0.75rem', margin: '6px 4px 0', fontStyle: 'italic' }}>
              Other students you meet in Town Square will show up here too, once that's ready.
            </p>
          </div>
        ) : tab === 'stuff' ? (
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
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
            {heardJokes.length === 0 && (
              <p style={{ opacity: 0.7, fontSize: '0.85rem', margin: '10px 4px' }}>
                No jokes yet. Talk to a Neighbor or Townsperson to hear one!
              </p>
            )}
            {heardJokes.map(({ id, entry }) => {
              const open = openJokeId === id;
              return (
                <button
                  key={id}
                  onClick={() => setOpenJokeId(open ? null : id)}
                  style={{ textAlign: 'left', background: '#f7f5ef', border: '2px solid var(--ink, #1f4238)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer' }}
                >
                  <strong style={{ fontSize: '0.85rem' }}>{entry.npcName}: {entry.setup}</strong>
                  {open && (
                    <div style={{ marginTop: 4, fontSize: '0.85rem' }}>
                      <p style={{ margin: '2px 0', fontWeight: 700 }}>{entry.punchline}</p>
                      <p style={{ margin: '2px 0', opacity: 0.75 }}>{entry.explain}</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
