import { useEffect, useRef, useState } from 'react';
import ReadAloud from '../../components/ReadAloud';
import { extractYouTubeId } from '../../lib/youtube';
import type { Student, Task } from '../../types';

interface Props {
  student: Student;
  task: Task;
  onDone: () => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevReady?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

// The video always requires a real manual tap to start (no autoplay param),
// and "I watched it!" stays disabled until the YouTube player itself reports
// the video played all the way through — so finishing here is never just a
// button someone can tap without actually watching.
export default function VideoTask({ student, task, onDone }: Props) {
  const videoId = task.video?.youtubeUrl ? extractYouTubeId(task.video.youtubeUrl) : null;
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
        <h3 style={{ margin: 0 }}>{task.title}</h3>
        <ReadAloud text={`${task.title}. ${task.video?.note ?? ''}`} settings={student.ttsSettings} />
      </div>
      {task.video?.note && <p>{task.video.note}</p>}

      {videoId ? (
        <div style={{ width: '100%', maxWidth: 560, aspectRatio: '16 / 9' }}>
          <iframe
            id={frameId}
            width="100%"
            height="100%"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&playsinline=1`}
            title={task.title}
            style={{ border: '3px solid var(--ink)', borderRadius: 14 }}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <p>Ask your teacher to add a video link!</p>
      )}

      {videoId && !watched && (
        <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>▶️ Press play above and watch the whole thing to finish.</p>
      )}

      <button className="btn btn-primary btn-lg pulse-cta" disabled={!!videoId && !watched} onClick={onDone}>
        ✅ I watched it!
      </button>
    </div>
  );
}
