import { useLocation, useNavigate } from 'react-router-dom';
import { guardLeave, labelFor, useTrail } from '../lib/navTrail';

// The breadcrumb trail (teacher, 2026-10-08): where the student came from,
// one tappable step each, with the Computer always first.
export default function Breadcrumbs({ dark = false }: { dark?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const trail = useTrail();
  const here = trail.findIndex((s) => s.path === location.pathname);
  const steps = here >= 0 ? trail.slice(0, here + 1) : [...trail, { path: location.pathname, label: labelFor(location.pathname) }];
  const withComputer = steps[0]?.path === '/student/home' ? steps : [{ path: '/student/home', label: '🖥️ Computer' }, ...steps];
  return (
    <nav className={`crumbs${dark ? ' dark' : ''}`} aria-label="Where you are">
      {withComputer.map((s, i) => {
        const last = i === withComputer.length - 1;
        return (
          <span key={`${s.path}-${i}`} className="crumb-wrap">
            {i > 0 && <span className="crumb-sep" aria-hidden>›</span>}
            {last
              ? <span className="crumb here" aria-current="page">{s.label}</span>
              : <button type="button" className="crumb" onClick={() => guardLeave(() => navigate(s.path, { state: ('state' in s ? s.state : null) ?? null }))}>{s.label}</button>}
          </span>
        );
      })}
    </nav>
  );
}
