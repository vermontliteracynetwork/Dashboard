import { useBack } from '../../lib/navTrail';

// Build Queue 447 (her words: "lets totally delete the diner dash game . we are going to replace it with something the
// students have requested ... We'll call the new game Restaurant"). Diner Dash is gone. Any Town Square building that
// still points here shows this note until the Restaurant game is built.
export default function RestaurantSoon() {
  const back = useBack();
  return (
    <div className="app-shell center-screen">
      <div className="pf-panel" style={{ maxWidth: 460, textAlign: 'center', display: 'grid', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Restaurant</h1>
        <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>A brand new restaurant game is being built, with your ideas! Check back soon.</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => back.go()}>Go back</button>
      </div>
    </div>
  );
}
