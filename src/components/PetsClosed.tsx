import { useNavigate } from 'react-router-dom';

// Pets overhaul (teacher 2026-10-06): every pet screen shows this while
// PETS_PAUSED is on. Student-facing, so it reads as exciting, not broken.
export default function PetsClosed({ title = 'Pet Shelter' }: { title?: string }) {
  const navigate = useNavigate();
  return (
    <div className="center-screen" style={{ padding: 16 }}>
      <div className="chrome-frame stack" style={{ padding: 28, maxWidth: 520, alignItems: 'center', textAlign: 'center', gap: 14 }}>
        <span style={{ fontSize: '3rem' }} aria-hidden>🚧🐾</span>
        <h2 style={{ margin: 0 }}>The {title} is closed for a big upgrade!</h2>
        <p style={{ margin: 0, fontSize: '1.05rem' }}>
          Pets are getting a full overhaul and will be back bigger and better than ever. If you had a pet, the money it was worth is already in your bank.
        </p>
        <button className="btn btn-primary btn-lg" style={{ minHeight: 52 }} onClick={() => navigate('/world/town')}>
          🏘️ Back to Town
        </button>
      </div>
    </div>
  );
}
