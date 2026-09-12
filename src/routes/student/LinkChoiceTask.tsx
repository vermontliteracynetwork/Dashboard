import { useEffect, useRef, useState } from 'react';
import ReadAloud from '../../components/ReadAloud';
import InternalBrowser from '../../components/InternalBrowser';
import ToolsPanel from '../../components/ToolsPanel';
import { extractYouTubeId, loadYouTubeApi } from '../../lib/youtube';
import type { LinkChoiceOption, Student, Subject, Task } from '../../types';

interface Props {
  student: Student;
  subject: Subject;
  task: Task;
  onDone: () => void;
}

// A "pick one" alternative to a whole-subject choice board, scoped to a
// single activity: the teacher offers 2-4 videos/links, and the student
// picks exactly one — never asked to do all of them. Not persisted; if a
// student navigates away before finishing, they just see the picker again.
export default function LinkChoiceTask({ student, subject, task, onDone }: Props) {
  const options = task.linkChoice?.options ?? [];
  const [chosen, setChosen] = useState<LinkChoiceOption | null>(null);

  if (options.length === 0) {
    return <p style={{ opacity: 0.7 }}>Ask your teacher to add some options to choose from!</p>;
  }

  if (!chosen) {
    return (
      <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="row">
          <h3 style={{ margin: 0 }}>{task.title}</h3>
          <ReadAloud text={`${task.title}. ${task.linkChoice?.prompt ?? ''}`} settings={student.ttsSettings} />
        </div>
        <p style={{ fontWeight: 700, fontSize: '1.05rem', margin: 0 }}>
          👉 {task.linkChoice?.prompt || 'Pick ONE, you don\'t have to do them all!'}
        </p>
        <div className="row-wrap" style={{ justifyContent: 'center', gap: 14 }}>
          {options.map((opt) => (
            <button
              key={opt.id}
              className="chrome-frame stack"
              style={{ width: 200, padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left', background: 'white' }}
              onClick={() => setChosen(opt)}
            >
              <div style={{ width: '100%', aspectRatio: '16 / 9', background: '#e5e1f7', position: 'relative' }}>
                {opt.thumbnailUrl ? (
                  <img src={opt.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.4rem' }}>
                    🎬
                  </div>
                )}
                {opt.durationLabel && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      right: 6,
                      background: 'rgba(0,0,0,0.75)',
                      color: '#fff',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 6,
                    }}
                  >
                    ⏱ {opt.durationLabel}
                  </span>
                )}
              </div>
              <div className="stack" style={{ padding: '10px 12px', gap: 6 }}>
                <strong style={{ fontSize: '0.9rem' }}>{opt.label || '(untitled)'}</strong>
                <span className="btn btn-sm btn-primary" style={{ alignSelf: 'flex-start', minHeight: 40, pointerEvents: 'none' }}>
                  ▶️ Pick this one
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return <ChosenOptionView student={student} subject={subject} option={chosen} onChangeChoice={() => setChosen(null)} onDone={onDone} />;
}

function ChosenOptionView({
  student,
  subject,
  option,
  onChangeChoice,
  onDone,
}: {
  student: Student;
  subject: Subject;
  option: LinkChoiceOption;
  onChangeChoice: () => void;
  onDone: () => void;
}) {
  const videoId = extractYouTubeId(option.url);
  const [watched, setWatched] = useState(false);
  const frameId = `linkchoice-yt-${option.id}`;
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled) return;
      playerRef.current = new window.YT.Player(frameId, {
        events: {
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.ENDED) setWatched(true);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // player may already be torn down
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option.id, videoId]);

  if (!videoId) {
    return (
      <InternalBrowser
        url={option.url}
        title={option.label}
        embed={option.embed}
        onClose={onChangeChoice}
        onMarkDone={onDone}
        toolsButton={<ToolsPanel student={student} subject={subject} variant="inline" />}
      />
    );
  }

  return (
    <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
      <h3 style={{ margin: 0 }}>{option.label}</h3>
      <div style={{ width: '100%', maxWidth: 560, aspectRatio: '16 / 9' }}>
        <iframe
          id={frameId}
          width="100%"
          height="100%"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&playsinline=1`}
          title={option.label}
          style={{ border: '3px solid var(--ink)', borderRadius: 14 }}
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {!watched && <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>▶️ Press play above and watch the whole thing to finish.</p>}
      <div className="row-wrap" style={{ justifyContent: 'center' }}>
        <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={onChangeChoice}>⬅️ Pick a different one</button>
        <button className="btn btn-primary btn-lg pulse-cta" disabled={!watched} onClick={onDone}>
          ✅ I watched it!
        </button>
      </div>
    </div>
  );
}
