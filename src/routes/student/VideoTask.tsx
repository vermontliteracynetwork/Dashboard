import ReadAloud from '../../components/ReadAloud';
import { extractYouTubeId } from '../../lib/youtube';
import type { Student, Task } from '../../types';

interface Props {
  student: Student;
  task: Task;
  onDone: () => void;
}

export default function VideoTask({ student, task, onDone }: Props) {
  const videoId = task.video?.youtubeUrl ? extractYouTubeId(task.video.youtubeUrl) : null;

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
            width="100%"
            height="100%"
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            title={task.title}
            style={{ border: '3px solid var(--ink)', borderRadius: 14 }}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <p>Ask your teacher to add a video link!</p>
      )}

      <button className="btn btn-primary btn-lg pulse-cta" onClick={onDone}>
        ✅ I watched it!
      </button>
    </div>
  );
}
