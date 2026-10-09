import { useMemo, useState } from 'react';
import { CER_LABS, type CerLab } from '../data/cer';
import type { HelpLevel } from '../engine/types';
import { gusSound } from './sound';

// CER Lab Report (Claudia's Phase 2 writing machines, Build Queue 2026-10-09). Three linked machines:
// the 💥 Claim Cannon, the 📦 Evidence Conveyor and the 🌉 Reasoning Bridge. The report only runs when
// the bridge connects the claim and the evidence. SRSD style fade ladder, as Claudia planned:
// Full, Gus models it (the right choice glows and he says why); Guided, sentence starters and choices;
// Challenge, they also build the data card themselves: pick the number AND the right unit (a wrong
// unit sparks). The finished report is read aloud and saved in the Journal. A gear for each report
// built with no wrong picks.

interface Props { calm: boolean; level: HelpLevel; onClose: () => void; onEarn: (gears: number, reports: string[]) => void; say: (m: string, mood: string) => void; speak: (t: string) => void }
const shuffle = <T,>(xs: T[]) => [...xs].map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const ROUNDS = 3;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1).replace(/\.$/, '');

export default function CerLab({ calm, level, onClose, onEarn, say, speak }: Props) {
  const labs = useMemo(() => shuffle(CER_LABS).slice(0, ROUNDS), []);
  const [k, setK] = useState(0);
  const lab: CerLab | undefined = labs[k];
  const [claim, setClaim] = useState<string | null>(null);
  const [row, setRow] = useState<number | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [missed, setMissed] = useState(false);
  const [firsts, setFirsts] = useState(0);
  const [reports, setReports] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);
  const [spark, setSpark] = useState<string | null>(null);
  const claims = useMemo(() => (lab ? shuffle(lab.claims) : []), [lab]);
  const reasons = useMemo(() => (lab ? shuffle(lab.reasons) : []), [lab]);
  const units = useMemo(() => (lab ? shuffle(lab.units) : []), [lab]);
  const done = k >= labs.length;
  const model = level === 'full';
  const needUnit = level === 'challenge';
  const evidenceOk = row !== null && (!needUnit || unit === lab?.rows[row].unit);
  const step = !claim ? 'claim' : !evidenceOk ? 'evidence' : !reason ? 'reason' : 'run';
  const report = lab && claim && row !== null && reason ? `${claim} ${lab.rows[row].text} This shows that ${lower(claim)} because ${reason}.` : '';

  const oops = (m: string) => { gusSound.ahem(); setMissed(true); say(m, 'Look again'); };
  const pickClaim = (c: string) => {
    if (claim) return;
    if (c !== lab!.claims[0]) { oops('Check the data card. Which answer do the numbers show?'); return; }
    setClaim(c); gusSound.gun(); say('Claim fired! A claim answers the question in one sentence.', '💥 Claim Cannon');
  };
  const pickRow = (i: number) => {
    if (evidenceOk) return;
    if (i !== lab!.best) { oops('That row is true, but it does not prove your claim the best. Which number backs it up?'); return; }
    setRow(i); gusSound.clank();
    if (!needUnit) say('Evidence loaded! Evidence is data: a number with its unit.', '📦 Evidence Conveyor');
    else say('Now snap on the right unit for that number.', '📦 Evidence Conveyor');
  };
  const pickUnit = (u: string) => {
    if (row === null || evidenceOk) return;
    if (u !== lab!.rows[row].unit) { setSpark(u); window.setTimeout(() => setSpark(null), 600); gusSound.zap(); setMissed(true); say(`${lab!.rows[row].value} ${u}? That unit sparks! What did we measure?`, 'Zzzap'); return; }
    setUnit(u); gusSound.clank(); say('Evidence loaded! A number always needs its unit.', '📦 Evidence Conveyor');
  };
  const pickReason = (r: string) => {
    if (reason) return;
    if (r !== lab!.reasons[0]) { oops('A reason uses science to explain WHY the evidence proves the claim.'); return; }
    setReason(r); gusSound.creak(); say('The bridge connects! Reasoning explains why the evidence proves the claim.', '🌉 Reasoning Bridge');
  };
  const run = () => {
    if (step !== 'run' || running) return;
    setRunning(true); gusSound.horn();
    window.setTimeout(() => { setRunning(false); setRan(true); gusSound.tada(); speak(report); setReports((r) => [...r, report]); if (!missed) setFirsts((f) => f + 1); }, calm ? 200 : 1600);
  };
  const next = () => { setK((x) => x + 1); setClaim(null); setRow(null); setUnit(null); setReason(null); setMissed(false); setRan(false); };
  const finish = () => { onEarn(firsts, reports); onClose(); };
  const glow = (right: boolean) => (model && right ? ' gwb-cer-model' : '');

  return (
    <div className="gus-journal-backdrop" onClick={finish}>
      <div className="gus-journal gwb-mini gwb-cer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="CER Lab Report">
        <h2>🔬 CER Lab Report</h2>
        {done ? <>
          <p className="gwb-mini-big">{reports.length} lab report{reports.length === 1 ? '' : 's'} written! They are saved in your Journal.</p>
          <p>Scientists explain with a Claim (the answer), Evidence (the data, a number and a unit) and Reasoning (why the data proves it).</p>
          <button type="button" className="gus-btn gus-btn-primary" onClick={finish}>Done</button>
        </> : lab && <>
          <p className="gwb-mini-progress">Report {k + 1} of {labs.length}</p>
          <div className="gwb-cer-q"><span aria-hidden>{lab.icon}</span><div><strong>{lab.question}</strong><small>{lab.setup}</small></div>
            <button type="button" className="gwb-hear" onClick={() => speak(`${lab.question} ${lab.setup}`)} aria-label="Hear the question">🔈</button></div>
          <table className="gwb-cer-data"><caption>📋 Data card</caption><tbody>
            {lab.rows.map((r, i) => <tr key={r.label} className={row === i ? 'on' : ''}><th scope="row">{r.label}</th><td>{r.value} {needUnit && row !== i ? '___' : r.unit}</td></tr>)}
          </tbody></table>

          <div className={`gwb-cer-line${running ? ' running' : ''}${ran ? ' ran' : ''}`}>
            <section className={`gwb-cer-machine${step === 'claim' ? ' active' : ''}${claim ? ' done' : ''}`}>
              <h3><span className="gwb-cer-ico cannon" aria-hidden>💥</span> Claim Cannon</h3>
              {claim ? <p className="gwb-cer-said">{claim}</p> : <>
                <p className="gwb-cer-starter">{model ? 'Gus: My claim answers the question.' : 'My claim:'}</p>
                <div className="gwb-cer-opts">{claims.map((c) => <button key={c} type="button" className={`gwb-chute${glow(c === lab.claims[0])}`} onClick={() => pickClaim(c)}>{c}</button>)}</div>
              </>}
            </section>
            <section className={`gwb-cer-machine${step === 'evidence' ? ' active' : ''}${evidenceOk ? ' done' : ''}`}>
              <h3><span className="gwb-cer-ico belt" aria-hidden>📦</span> Evidence Conveyor</h3>
              {evidenceOk ? <p className="gwb-cer-said">{lab.rows[row!].text}</p> : claim ? <>
                <p className="gwb-cer-starter">{model ? 'Gus: Pick the number that proves it.' : 'My evidence (pick a row of data):'}</p>
                <div className="gwb-cer-opts">{lab.rows.map((r, i) => <button key={r.label} type="button" className={`gwb-chute${row === i ? ' right' : ''}${glow(i === lab.best)}`} onClick={() => pickRow(i)}>{r.label}: {r.value}{needUnit ? '' : ` ${r.unit}`}</button>)}</div>
                {needUnit && row !== null && <div className="gwb-cer-opts units" role="group" aria-label="Pick the unit">{units.map((u) => <button key={u} type="button" className={`gwb-chute${spark === u ? ' wrong' : ''}`} onClick={() => pickUnit(u)}>{lab.rows[row].value} {u}</button>)}</div>}
              </> : <p className="gwb-cer-wait">Waiting for a claim...</p>}
            </section>
            <section className={`gwb-cer-machine${step === 'reason' ? ' active' : ''}${reason ? ' done' : ''}`}>
              <h3><span className="gwb-cer-ico bridge" aria-hidden>🌉</span> Reasoning Bridge</h3>
              {reason ? <p className="gwb-cer-said">This shows that {lower(claim!)} because {reason}.</p> : evidenceOk ? <>
                <p className="gwb-cer-starter">This shows that {lower(claim!)} because...</p>
                <div className="gwb-cer-opts">{reasons.map((r) => <button key={r} type="button" className={`gwb-chute${glow(r === lab.reasons[0])}`} onClick={() => pickReason(r)}>...{r}.</button>)}</div>
              </> : <p className="gwb-cer-wait">The bridge is up. It needs a claim and evidence to connect.</p>}
            </section>
          </div>

          {step === 'run' && !ran && <button type="button" className="gus-btn gus-btn-primary gwb-cer-run" onClick={run} disabled={running}>{running ? '⚙️ Running...' : '▶ Run my lab report'}</button>}
          {ran && <>
            <div className="gwb-cer-report"><strong>📄 My lab report</strong><p>{report}</p><button type="button" className="gwb-hear" onClick={() => speak(report)} aria-label="Hear my report">🔈</button></div>
            <button type="button" className="gus-btn gus-btn-primary" onClick={next}>{k + 1 < labs.length ? 'Next experiment ▶' : 'Finish ▶'}</button>
          </>}
        </>}
        <button type="button" className="gus-btn" onClick={finish}>✕ Close</button>
      </div>
    </div>
  );
}
