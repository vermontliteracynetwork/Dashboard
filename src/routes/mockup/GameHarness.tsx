import { Suspense, lazy, useState, type ComponentType, type LazyExoticComponent } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../../store/store';

// MOCK-UP ONLY (Build Queue 207 iPad check): opens one game with a throwaway test student and no login, so its
// layout can be checked at iPad sizes. Never linked from the app.
const GAMES: Record<string, LazyExoticComponent<ComponentType>> = {
  'fishing-dock': lazy(() => import('../student/FishingDock')),
  bakery: lazy(() => import('../student/BakeryMatch3')),
  'bubble-shooter': lazy(() => import('../student/BubbleShooter')),
  'shape-dash': lazy(() => import('../student/ShapeDash')),
  alchemy: lazy(() => import('../student/Alchemy')),
  'quiz-mode': lazy(() => import('../student/QuizMode')),
  'castle-defense': lazy(() => import('../student/CastleDefense')),
  'space-bowling': lazy(() => import('../student/SpaceBowling')),
  chess: lazy(() => import('../student/SlimeChess')),
  gym: lazy(() => import('../student/BuffDogeGym')),
  'pet-show': lazy(() => import('../student/PetShowRing')),
  diner: lazy(() => import('../student/DinerDash')),
  'cupcake-tycoon': lazy(() => import('../student/IdleTycoon')),
  crossy: lazy(() => import('../student/CrossyHopper')),
  plinko: lazy(() => import('../student/PlinkoDrop')),
  'wild-measures': lazy(() => import('../student/WildMeasures')),
  'word-search': lazy(() => import('../student/WordSearch')),
  'memory-match': lazy(() => import('../student/MemoryMatch')),
  'gem-mine': lazy(() => import('../student/GemMine')),
  kitchen: lazy(() => import('../student/KitchenCookOff')),
  lighthouse: lazy(() => import('../student/LighthouseSignal')),
  'farm-grow': lazy(() => import('../student/FarmGrow')),
  'rescue-shelter': lazy(() => import('../student/RescueShelter')),
  'farmers-market': lazy(() => import('../student/FarmersMarket')),
  supernature: lazy(() => import('../student/Supernature')),
  'grammar-gus': lazy(() => import('../../games/grammarGus/ui/GusWorkboard')),
};

export default function GameHarness() {
  const { id = '' } = useParams();
  const [ready] = useState(() => {
    const st = useStore.getState();
    if (!st.currentStudentId) {
      const sid = st.addStudent('Test', '🐶');
      useStore.setState({ currentStudentId: sid, role: 'student' } as never);
    }
    return true;
  });
  const Game = GAMES[id];
  if (!Game || !ready) return <p>No game called {id}</p>;
  return <Suspense fallback={<p>Loading</p>}><Game /></Suspense>;
}
