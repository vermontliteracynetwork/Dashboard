import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import MockupSpecies from './MockupSpecies';

// MOCK-UP ONLY: a stand-alone page (no login, no database) for the Style fit check sheets.
createRoot(document.getElementById('root')!).render(
  <HashRouter><Routes><Route path="*" element={<MockupSpecies />} /></Routes></HashRouter>,
);
