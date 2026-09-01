import { useStore } from '../store/store';

interface Props {
  studentId: string;
}

export default function Onboarding({ studentId }: Props) {
  const onboardedIds = useStore((s) => s.onboardedIds);
  const markOnboarded = useStore((s) => s.markOnboarded);

  if (onboardedIds.includes(studentId)) return null;

  return (
    <div className="overlay-backdrop">
      <div className="overlay-panel chrome-frame" style={{ padding: 24 }}>
        <div className="content-well stack">
          <h2>👋 Welcome!</h2>
          <p>🗺️ You'll walk a path of stepping stones — one task glows at a time, so you always know what's next.</p>
          <p>🧰 Your tools (calculator, read-aloud, and more) are always nearby if you need them.</p>
          <p>🧘 See the orange button? Tap it any time you need a break to breathe.</p>
          <p>✅ Tap "I'm done!" when you finish a task — no rushing, no timers, ever.</p>
          <button
            className="btn btn-primary btn-lg"
            style={{ alignSelf: 'center' }}
            onClick={() => markOnboarded(studentId)}
          >
            Let's go! 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
