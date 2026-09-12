import { useStore } from '../store/store';

// A save that failed even after every retry (see pushWithRetry in
// sync.ts) — mounted globally so it's visible to whoever hit it, teacher
// or student, wherever they are in the app, instead of only a
// console.error nobody's watching. Positioned at the top so it never
// collides with the corner FABs (tools/help/what-now), which all sit at
// the bottom or top-right.
export default function SyncTroubleAlert() {
  const syncTrouble = useStore((s) => s.syncTrouble);
  const dismissSyncTrouble = useStore((s) => s.dismissSyncTrouble);
  const retrySyncNow = useStore((s) => s.retrySyncNow);

  if (!syncTrouble) return null;

  return (
    <div style={{ position: 'fixed', top: 16, left: 16, right: 16, zIndex: 200, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        className="chrome-frame row"
        style={{ pointerEvents: 'auto', background: 'var(--danger)', color: '#fff', padding: '12px 18px', maxWidth: 480, alignItems: 'center' }}
      >
        <span style={{ fontSize: '1.3rem' }}>⚠️</span>
        <p style={{ margin: 0, fontSize: '0.85rem', flex: 1 }}>
          A change didn't save after several tries. It's still saved on this screen and will keep trying in the
          background, so check the connection and tap Retry, or let your teacher/developer know if this keeps
          happening.
        </p>
        <button className="btn btn-sm" style={{ background: '#fff' }} onClick={retrySyncNow}>Retry</button>
        <button className="btn btn-sm" style={{ background: '#fff' }} onClick={dismissSyncTrouble} aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}
