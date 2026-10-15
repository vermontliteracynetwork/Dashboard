import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import MockupSpecies from './MockupSpecies';
import ScienceLab from '../student/ScienceLab';
import '../../index.css';

// MOCK-UP ONLY: a stand-alone page (no login, no database) for the Style fit check sheets, plus a no-login
// preview of the Science Lab (#/lab) for checking its layout.
createRoot(document.getElementById('root')!).render(
  <HashRouter><Routes><Route path="/lab" element={<ScienceLab />} /><Route path="*" element={<MockupSpecies />} /></Routes></HashRouter>,
);
