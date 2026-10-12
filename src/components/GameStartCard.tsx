import type { ReactNode } from 'react';
import type { TTSSettings } from '../types';
import { useBack } from '../lib/navTrail';
import { speak } from './ReadAloud';

// The settings screen every game opens on (teacher 2026-10-12: "make sure all games have the initial
// screen for game settings (rounds, time, etc.)"): the game's name, what it is about (with a Listen),
// its settings sliders, a big Start, and a way back out.
export default function GameStartCard({ title, intro, children, onStart, startLabel = 'Start', ttsSettings }: {
  title: string; intro?: string; children?: ReactNode; onStart: () => void; startLabel?: string; ttsSettings?: TTSSettings;
}) {
  const back = useBack();
  return (
    <div className="pf-overlay game-start">
      <div className="pf-panel game-start-card">
        <h2>{title}</h2>
        {intro && (
          <div className="game-start-intro">
            <p>{intro}</p>
            <button type="button" className="btn game-start-listen" onClick={() => speak(intro, ttsSettings)} aria-label="Listen">🔊</button>
          </div>
        )}
        {children}
        <button type="button" className="btn btn-primary btn-lg game-start-go" onClick={onStart}>▶ {startLabel}</button>
        <button type="button" className="btn game-start-back" onClick={back.go}>← {back.label.replace(/^\S+\s/, '')}</button>
      </div>
    </div>
  );
}
