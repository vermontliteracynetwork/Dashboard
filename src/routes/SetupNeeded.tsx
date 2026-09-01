export default function SetupNeeded() {
  return (
    <div className="center-screen">
      <div className="chrome-frame stack" style={{ padding: 32, maxWidth: 620 }}>
        <h1 style={{ marginTop: 0, color: 'var(--purple)' }}>🔌 Almost there!</h1>
        <p>
          This app needs to be connected to its Supabase backend before it can be used — that's what makes it work
          across devices (teacher tablet, student Chromebooks, etc.) instead of just on one browser.
        </p>
        <p>
          Follow the steps in <code>SETUP.md</code> in the project repo: create a free Supabase project, run the
          included SQL to set up the database, then set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> (plus optionally <code>VITE_TEACHER_EMAIL</code>) as environment
          variables — in a local <code>.env</code> file for development, or in your hosting provider's project
          settings (e.g. Vercel → Project → Settings → Environment Variables) for a live deployment.
        </p>
        <p style={{ opacity: 0.75, fontSize: '0.9rem' }}>Once those are set, reload this page.</p>
      </div>
    </div>
  );
}
