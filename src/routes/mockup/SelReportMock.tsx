import SelTeamReport from '../teacher/SelTeamReport';
import type { SelCheckIn, SelZone } from '../../types';

// Test page for the SEL team report (Build Queue 268) with sample check-ins: mockup.html#/sel-report
const WORDS: Record<SelZone, string[]> = { blue: ['Tired', 'Bored', 'Lonely'], green: ['Calm', 'Happy', 'Proud'], yellow: ['Frustrated', 'Worried', 'Excited'], red: ['Furious', 'Scared'] };
const EN = ['very high', 'high', 'just right', 'low', 'very low'];
let seed = 7; const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
const rows: SelCheckIn[] = [];
for (let d = 0; d < 10; d++) for (const h of [8.5, 11, 13.5]) {
  if (r() < 0.25) continue;
  const z: SelZone = (['green', 'green', 'yellow', 'blue', 'red'] as SelZone[])[Math.floor(r() * 5)];
  const t = new Date(2026, 9, 6 + d + (d > 4 ? 2 : 0), Math.floor(h), Math.round((h % 1) * 60 + r() * 20));
  rows.push({ id: `c${d}${h}`, studentId: 's', timestamp: t.toISOString(), zone: z, emotion: WORDS[z][Math.floor(r() * WORDS[z].length)], energy: r() < 0.1 ? undefined : EN[Math.floor(r() * 5)], toolsUsedLabels: z === 'green' ? [] : ['Take 5 deep breaths'],
    noteText: r() < 0.2 ? 'I did not like recess because nobody played with me.' : undefined,
    ...(z !== 'green' ? { recheckDueAt: t.toISOString(), recheckDelayMin: 15, neighborId: 'roscoe', recheckCompleted: true, recheckZone: 'green' as SelZone, recheckEmotion: 'Calm', recheckTimestamp: new Date(+t + 16 * 60000).toISOString() } : {}) });
}
export default function SelReportMock() { return <SelTeamReport studentName="Sample Student" rows={rows} from="2026-10-06" to="2026-10-19" zones={['blue', 'green', 'yellow', 'red']} onClose={() => {}} />; }
