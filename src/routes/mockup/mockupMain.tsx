import { createRoot } from 'react-dom/client';
import SymbolMock from './SymbolMock';
import FeelingsWheel from '../../components/FeelingsWheel';
import { HashRouter, Route, Routes } from 'react-router-dom';
import MockupSpecies from './MockupSpecies';
import ScienceLab from '../student/ScienceLab';
import GameHarness from './GameHarness';
import MainMenu from '../../components/MainMenu';
import StreakLayer from '../../components/StreakLayer';
import GameReportBubble from '../../components/GameReportBubble';
import '../../index.css';

// MOCK-UP ONLY: a stand-alone page (no login, no database) for the Style fit check sheets, plus a no-login
// preview of the Science Lab (#/lab) for checking its layout.
createRoot(document.getElementById('root')!).render(
  <HashRouter><Routes><Route path="/lab" element={<ScienceLab />} /><Route path="/symbol" element={<SymbolMock />} /><Route path="/feelings" element={<FeelingsWheel studentName="Azalea" onChoose={(n) => { (window as unknown as { picked?: string }).picked = n.w; }} />} /><Route path="/game/:id" element={<GameHarness />} /><Route path="/student/:id" element={<><GameHarness /><StreakLayer /><GameReportBubble /><MainMenu /></>} /><Route path="*" element={<MockupSpecies />} /></Routes></HashRouter>,
);
