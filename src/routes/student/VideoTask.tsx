import { useEffect, useRef, useState } from 'react';
import ReadAloud from '../../components/ReadAloud';
import TheaterFrame from '../../components/TheaterFrame';
import { extractYouTubeId, loadYouTubeApi } from '../../lib/youtube';
import { taskDisplayTitle } from '../../lib/taskOrder';
import type { Student, Task } from '../../types';

interface Props {
  student: Student;
  task: Task;
  onDone: () => void;
}

// The video always requires a real manual tap to start (no autoplay param),
// and "I watched it!" stays disabled until the player itself reports the
// video played all the way through — so finishing here is never just a
// button someone can tap without actually watching.
export default function VideoTask({ student, task, onDone }: Props) {
  const rawUrl = task.video?.youtubeUrl ?? null;
  const videoId = rawUrl ? extractYouTubeId(rawUrl) : null;
  // A school network blocking youtube.com is a real, reported case, not
  // hypothetical — see ActivityLibrary.tsx's Video-type editor, which now
  // offers an "upload a file instead" escape hatch for exactly this. When
  // the URL isn't a YouTube link, it's a direct file (uploaded, or pasted)
  // and this renders a plain native <video> instead of the YouTube player.
  const directUrl = rawUrl && !videoId ? rawUrl : null;
  const [watched, setWatched] = useState(false);
  const frameId = `yt-player-${task.id}`;
  const playerRef = useRef<any>(null);

  useEffect(() => {
    setWatched(false);
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
  }, [task.id, videoId]);

  return (
    <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
      <div className="row">
        <h3 style={{ margin: 0 }}>{taskDisplayTitle(task)}</h3>
        <ReadAloud text={`${taskDisplayTitle(task)}. ${task.studentDescription ?? task.video?.note ?? ''}`} settings={student.ttsSettings} />
      </div>
      {task.studentDescription && <p>{task.studentDescription}</p>}
      {task.video?.note && <p>{task.video.note}</p>}

      {videoId ? (
        <TheaterFrame>
          <div style={{ width: '100%', aspectRatio: '16 / 9' }}>
            <iframe
              id={frameId}
              width="100%"
              height="100%"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&playsinline=1`}
              title={taskDisplayTitle(task)}
              style={{ border: 'none', display: 'block' }}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </TheaterFrame>
      ) : directUrl ? (
        <TheaterFrame>
          <div style={{ width: '100%', aspectRatio: '16 / 9' }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={directUrl}
              controls
              playsInline
              onEnded={() => setWatched(true)}
              style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
            />
          </div>
        </TheaterFrame>
      ) : (
        <p>Ask your teacher to add a video link!</p>
      )}

      {(videoId || directUrl) && !watched && (
        <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>▶️ Press play above and watch the whole thing to finish.</p>
      )}

      <button className="btn btn-primary btn-lg pulse-cta" disabled={!!(videoId || directUrl) && !watched} onClick={onDone}>
        ✅ I watched it!
      </button>
    </div>
  );
}
