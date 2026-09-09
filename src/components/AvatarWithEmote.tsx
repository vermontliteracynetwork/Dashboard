import { useState } from 'react';
import { useStore } from '../store/store';
import { AvatarGlyph } from './AvatarGlyph';
import { emoteById, EMOTE_CATALOG } from '../lib/emoteCatalog';
import type { Student } from '../types';

interface Props {
  student: Student;
  size?: number;
  // Teacher Live View: a pure read-only mirror, no click handlers at all.
  readOnly?: boolean;
  // Student Home passes its existing character-picker opener here. Left
  // unset (e.g. on the to-do list) the avatar itself isn't clickable, but
  // the mood bubble always is — swapping characters mid-task would add an
  // extra detour, but checking in on how you're feeling shouldn't.
  onChangeAvatar?: () => void;
}

// Avatar + a comic-style "thought bubble" showing the student's current
// mood emote, tappable to open a picker of just the emotes they own. Used
// everywhere an avatar is shown — Student Home, the to-do list header, and
// the teacher's Live View (read-only there) — so mood is always visible
// and always changeable from wherever the student happens to be.
export default function AvatarWithEmote({ student, size = 70, readOnly = false, onChangeAvatar }: Props) {
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const equipEmote = useStore((s) => s.equipEmote);
  const equipped = student.equippedEmoteId ? emoteById(student.equippedEmoteId) : null;
  const bubbleSize = Math.round(size * 0.46);
  const showBubble = equipped || !readOnly;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {onChangeAvatar && !readOnly ? (
        <button
          className="avatar-btn"
          style={{ width: size, height: size }}
          onClick={onChangeAvatar}
          aria-label="Change your avatar"
          title="Tap to change your avatar"
        >
          <AvatarGlyph value={student.avatar} />
        </button>
      ) : (
        <div className="avatar-btn" style={{ width: size, height: size, cursor: 'default' }}>
          <AvatarGlyph value={student.avatar} />
        </div>
      )}

      {showBubble && (
        <>
          {/* thought-bubble trail: two small dots stepping up toward the bubble */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#fff',
              border: '2px solid var(--ink)',
              bottom: size * 0.16,
              right: -2,
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#fff',
              border: '2px solid var(--ink)',
              top: size * 0.08,
              right: -6,
            }}
          />
          <button
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && setShowMoodPicker(true)}
            aria-label={equipped ? `Feeling: ${equipped.name}. Tap to change.` : 'Set how you are feeling'}
            title={readOnly ? undefined : 'How are you feeling?'}
            style={{
              position: 'absolute',
              top: -bubbleSize * 0.55,
              right: -bubbleSize * 0.45,
              width: bubbleSize,
              height: bubbleSize,
              borderRadius: '50%',
              background: '#fff',
              border: '2.5px solid var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              cursor: readOnly ? 'default' : 'pointer',
            }}
          >
            {equipped ? (
              <img src={equipped.src} alt="" style={{ width: '68%', height: '68%' }} />
            ) : (
              <span style={{ fontSize: bubbleSize * 0.5 }}>💭</span>
            )}
          </button>
        </>
      )}

      {showMoodPicker && (
        <div className="overlay-backdrop" onClick={() => setShowMoodPicker(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <h2 style={{ margin: 0 }}>How are you feeling today?</h2>
              {student.ownedEmoteIds.length === 0 ? (
                <p style={{ opacity: 0.75 }}>Earn coins and visit the 🛍️ Marketplace to get emotes!</p>
              ) : (
                <div className="row-wrap" style={{ justifyContent: 'center' }}>
                  {EMOTE_CATALOG.filter((e) => student.ownedEmoteIds.includes(e.id)).map((e) => (
                    <button
                      key={e.id}
                      className="avatar-btn stack"
                      style={{
                        width: 76,
                        height: 76,
                        flexDirection: 'column',
                        gap: 2,
                        outline: e.id === student.equippedEmoteId ? '4px solid var(--purple)' : 'none',
                      }}
                      aria-label={e.name}
                      onClick={() => {
                        equipEmote(student.id, e.id);
                        setShowMoodPicker(false);
                      }}
                    >
                      <img src={e.src} alt="" style={{ width: 32, height: 32 }} />
                      <span style={{ fontSize: '0.62rem', fontWeight: 700 }}>{e.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="row-wrap" style={{ justifyContent: 'center' }}>
                {student.equippedEmoteId && (
                  <button
                    className="btn btn-sm"
                    style={{ minHeight: 44 }}
                    onClick={() => {
                      equipEmote(student.id, null);
                      setShowMoodPicker(false);
                    }}
                  >
                    Clear mood
                  </button>
                )}
                <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setShowMoodPicker(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
