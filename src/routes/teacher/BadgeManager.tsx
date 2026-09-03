import { useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { BADGE_RULE_LABELS, BADGE_RULE_SUBJECT_AWARE } from '../../types';
import type { BadgeDef, BadgeRule, BadgeRuleType, Subject } from '../../types';

function BadgeRow({ badge }: { badge: BadgeDef }) {
  const updateBadge = useStore((s) => s.updateBadge);
  const deleteBadge = useStore((s) => s.deleteBadge);
  const [expanded, setExpanded] = useState(false);

  const rule = badge.rule;
  const setRulePatch = (patch: Partial<BadgeRule>) => {
    const next: BadgeRule = { type: 'streak', threshold: 1, ...rule, ...patch };
    updateBadge(badge.id, { rule: next });
  };

  return (
    <div className="chrome-frame stack" style={{ padding: 14 }}>
      <div className="space-between">
        <div className="row" style={{ flex: 1 }}>
          <span style={{ fontSize: '1.8rem' }}>{badge.icon}</span>
          <input value={badge.name} onChange={(e) => updateBadge(badge.id, { name: e.target.value })} />
          <input value={badge.description} onChange={(e) => updateBadge(badge.id, { description: e.target.value })} style={{ flex: 1 }} />
        </div>
        <div className="row-wrap">
          <button className="btn btn-sm" onClick={() => setExpanded((v) => !v)}>
            {rule ? '⚙️ Auto-award rule' : '➕ Add auto-award rule'}
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => deleteBadge(badge.id)}>Delete</button>
        </div>
      </div>

      {expanded && (
        <div className="content-well stack" style={{ background: '#faf9ff' }}>
          <label className="row" style={{ gap: 6 }}>
            <input
              type="checkbox"
              checked={!!rule}
              onChange={(e) => updateBadge(badge.id, { rule: e.target.checked ? { type: 'streak', threshold: 1 } : undefined })}
            />
            Auto-award this badge when a rule is met (instead of only awarding it by hand)
          </label>
          {rule && (
            <div className="row-wrap" style={{ alignItems: 'center' }}>
              <strong>IF</strong>
              <select value={rule.type} onChange={(e) => setRulePatch({ type: e.target.value as BadgeRuleType })}>
                {(Object.keys(BADGE_RULE_LABELS) as BadgeRuleType[]).map((t) => (
                  <option key={t} value={t}>{BADGE_RULE_LABELS[t]}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                style={{ width: 70 }}
                value={rule.threshold}
                onChange={(e) => setRulePatch({ threshold: parseInt(e.target.value, 10) || 1 })}
              />
              {BADGE_RULE_SUBJECT_AWARE.includes(rule.type) && (
                <>
                  <strong>AND constraint:</strong>
                  <select
                    value={rule.subject ?? ''}
                    onChange={(e) => setRulePatch({ subject: (e.target.value || undefined) as Subject | undefined })}
                  >
                    <option value="">Any subject</option>
                    <option value="math">🔢 Math only</option>
                    <option value="literacy">📚 Literacy only</option>
                  </select>
                </>
              )}
              <strong>THEN award "{badge.name}"</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BadgeManager() {
  const badges = useStore((s) => s.badges);
  const students = useStore((s) => s.students);
  const addBadge = useStore((s) => s.addBadge);
  const awardBadge = useStore((s) => s.awardBadge);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🌟');
  const [awardStudent, setAwardStudent] = useState('');
  const [awardBadgeId, setAwardBadgeId] = useState('');

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>Badges</h1>

        <div className="chrome-frame stack" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>➕ New Badge</h3>
          <div className="row-wrap">
            <input placeholder="Icon (emoji)" style={{ width: 70 }} value={icon} onChange={(e) => setIcon(e.target.value)} />
            <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            <button
              className="btn btn-primary"
              disabled={!name.trim()}
              onClick={() => {
                addBadge({ name: name.trim(), description: description.trim(), icon: icon.trim() || '🌟' });
                setName('');
                setDescription('');
              }}
            >
              Add
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
            Every badge can be awarded by hand below, or you can set an auto-award rule on it — tap "➕ Add auto-award
            rule" on any badge to build one (IF a metric reaches a number, optionally constrained to one subject,
            THEN it's awarded automatically).
          </p>
        </div>

        <div className="stack">
          {badges.map((b) => <BadgeRow key={b.id} badge={b} />)}
        </div>

        <div className="chrome-frame stack" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>🎁 Award a Badge by Hand</h3>
          <div className="row-wrap">
            <select value={awardStudent} onChange={(e) => setAwardStudent(e.target.value)}>
              <option value="">Choose a student</option>
              {students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
            <select value={awardBadgeId} onChange={(e) => setAwardBadgeId(e.target.value)}>
              <option value="">Choose a badge</option>
              {badges.map((b) => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
            </select>
            <button
              className="btn btn-primary"
              disabled={!awardStudent || !awardBadgeId}
              onClick={() => awardBadge(awardStudent, awardBadgeId)}
            >
              Award
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
