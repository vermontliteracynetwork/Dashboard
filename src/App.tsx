import { useEffect } from 'react';
import { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useStore } from './store/store';
import { isSupabaseConfigured } from './lib/supabaseClient';
import SetupNeeded from './routes/SetupNeeded';
import RequireTeacherAuth from './components/RequireTeacherAuth';
import RoleSelect from './routes/RoleSelect';
import StudentLogin from './routes/student/StudentLogin';
import StudentHome from './routes/student/StudentHome';
import SubjectDashboard from './routes/student/SubjectDashboard';
import Marketplace from './components/Marketplace';
import PiggyBank from './components/PiggyBank';
import Mailbox from './components/Mailbox';
import Passport from './components/Passport';
import PetFinder from './routes/student/PetFinder';
import BuffDogeGym from './routes/student/BuffDogeGym';
import PetJournal from './routes/student/PetJournal';
import Cinema from './routes/student/Cinema';
import FarmersMarket from './routes/student/FarmersMarket';
import BakeryMatch3 from './routes/student/BakeryMatch3';
import GamesHub from './routes/student/GamesHub';
import QuizMode from './routes/student/QuizMode';
import StreakLayer from './components/StreakLayer';
import PetTrainedToast from './components/PetTrainedToast';
import GymWatcher from './components/GymWatcher';
import CheckOnPetHost from './components/CheckOnPet';
import { usePetOverhaulRefunds } from './lib/petOverhaul';
import CastleDefense from './routes/student/CastleDefense';
import LiteracyManipulativesEmbed from './routes/student/LiteracyManipulativesEmbed';
import TeacherLogin from './routes/teacher/TeacherLogin';
import TeacherHome from './routes/teacher/TeacherHome';
import StudentManager from './routes/teacher/StudentManager';
import AssignmentsIndex from './routes/teacher/AssignmentsIndex';
import LessonPlanBuilder from './routes/teacher/LessonPlanBuilder';
import ReviewInbox from './routes/teacher/ReviewInbox';
import GameManager from './routes/teacher/GameManager';
import QuestionSetDetail from './routes/teacher/QuestionSetDetail';
import BadgeManager from './routes/teacher/BadgeManager';
import MarketplaceManager from './routes/teacher/MarketplaceManager';
import TeacherStudentBank from './routes/teacher/TeacherStudentBank';
import ScoreHistory from './routes/teacher/ScoreHistory';
import SelCheckInLog from './routes/teacher/SelCheckInLog';
import StudentLiveView from './routes/teacher/StudentLiveView';
import TeacherHelpAlert from './components/TeacherHelpAlert';
import StudentChatAlert from './components/StudentChatAlert';
import SelRecheckPrompt from './components/SelRecheckPrompt';
import SelLoginGate from './components/SelLoginGate';
import { lazyFresh } from './lib/freshBuild';
import GlobalMusicPlayer from './components/GlobalMusicPlayer';

// Lazy-loaded: Three.js/react-three-fiber are heavy, and only the world
// route (and the teacher's 3D Build Mode) needs them — every existing 2D
// screen should stay unaffected.
const TownSquare = lazyFresh(() => import('./routes/world/TownSquare'));
const HomeRoom = lazyFresh(() => import('./routes/world/HomeRoom'));
const IslandBuild = lazyFresh(() => import('./routes/world/IslandBuild'));
const SlimeChess = lazyFresh(() => import('./routes/student/SlimeChess'));
const SpaceBowling = lazyFresh(() => import('./routes/student/SpaceBowling'));
// The native games from her 2026-09-30 lists load on demand, like the other big games (Build Queue 61).
const RescueShelter = lazyFresh(() => import('./routes/student/RescueShelter'));
const FishingDock = lazyFresh(() => import('./routes/student/FishingDock'));
const FarmGrow = lazyFresh(() => import('./routes/student/FarmGrow'));
const PostOfficeSort = lazyFresh(() => import('./routes/student/PostOfficeSort'));
const LighthouseSignal = lazyFresh(() => import('./routes/student/LighthouseSignal'));
const KitchenCookOff = lazyFresh(() => import('./routes/student/KitchenCookOff'));
const MineCartRun = lazyFresh(() => import('./routes/student/MineCartRun'));
const TrainDispatch = lazyFresh(() => import('./routes/student/TrainDispatch'));
const GemMine = lazyFresh(() => import('./routes/student/GemMine'));
const LibraryQuest = lazyFresh(() => import('./routes/student/LibraryQuest'));
const DungeonRooms = lazyFresh(() => import('./routes/student/DungeonRooms'));
const ConstructionSite = lazyFresh(() => import('./routes/student/ConstructionSite'));
const WhackAMole = lazyFresh(() => import('./routes/student/WhackAMole'));
const MemoryMatch = lazyFresh(() => import('./routes/student/MemoryMatch'));
const WordSearch = lazyFresh(() => import('./routes/student/WordSearch'));
const PlinkoDrop = lazyFresh(() => import('./routes/student/PlinkoDrop'));
const CrossyHopper = lazyFresh(() => import('./routes/student/CrossyHopper'));
const IdleTycoon = lazyFresh(() => import('./routes/student/IdleTycoon'));
const DinerDash = lazyFresh(() => import('./routes/student/DinerDash'));
const PetShowRing = lazyFresh(() => import('./routes/student/PetShowRing'));
const GrammarGusMachine = lazyFresh(() => import('./games/grammarGus/ui/GrammarGusMachine'));
const GusWorkboard = lazyFresh(() => import('./games/grammarGus/ui/GusWorkboard'));
const GusLibrary = lazyFresh(() => import('./games/grammarGus/reading/Library'));
const ShapeDash = lazyFresh(() => import('./routes/student/ShapeDash'));
const BubbleShooter = lazyFresh(() => import('./routes/student/BubbleShooter'));
const Alchemy = lazyFresh(() => import('./routes/student/Alchemy'));
const ScienceLab = lazyFresh(() => import('./routes/student/ScienceLab'));
const WorldEditor = lazyFresh(() => import('./routes/teacher/WorldEditor'));
const StyleRoom = lazyFresh(() => import('./routes/teacher/StyleRoom'));
const StudentStyle = lazyFresh(() => import('./routes/student/StudentStyle'));
import CoinDropOverlay from './components/CoinDropOverlay';
import SyncTroubleAlert from './components/SyncTroubleAlert';
import { TrailTracker } from './lib/navTrail';

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  usePetOverhaulRefunds();
  const hydrationError = useStore((s) => s.hydrationError);
  const initSync = useStore((s) => s.initSync);
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);

  useEffect(() => {
    initSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // App-wide (not just one screen) so the dyslexia-friendly toggle covers
  // every route a student can be on — quiz questions, task instructions,
  // the world, all of it — from the one place it's set.
  useEffect(() => {
    const student = students.find((s) => s.id === currentStudentId);
    document.body.classList.toggle('dyslexia-font', !!student?.dyslexiaFont);
  }, [currentStudentId, students]);

  if (!isSupabaseConfigured) {
    return (
      <div className="app-shell">
        <SetupNeeded />
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="app-shell center-screen">
        <p>Loading your dashboard…</p>
      </div>
    );
  }

  if (hydrationError) {
    return (
      <div className="app-shell center-screen">
        <div className="chrome-frame stack" style={{ padding: 28, maxWidth: 560 }}>
          <h2 style={{ marginTop: 0 }}>⚠️ Couldn't load the dashboard</h2>
          <p>{hydrationError}</p>
          <p style={{ fontSize: '0.9rem', opacity: 0.75 }}>
            Double-check the SQL in SETUP.md has been run in your Supabase project, then reload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="app-shell">
        <NotOnBoard>
        <TeacherHelpAlert />
        <StudentChatAlert />
        <SelRecheckPrompt />
        <SelLoginGate />
        <CoinDropOverlay />
        <StreakLayer />
        <PetTrainedToast />
        <GymWatcher />
        <CheckOnPetHost />
        <SyncTroubleAlert />
        </NotOnBoard>
        {/* Direct teacher instruction: music keeps playing across every
            route, including while doing an assignment — mounted once here
            (not inside TownSquare, which used to own it and die on
            navigation) so it survives every route change. */}
        <GlobalMusicPlayer />
        <TrailTracker />
        <Routes>
          <Route path="/" element={<RoleSelect />} />
          <Route
            path="/world/town"
            element={
              <Suspense fallback={<div className="app-shell center-screen"><p>Loading Yoglandia…</p></div>}>
                <TownSquare />
              </Suspense>
            }
          />
          <Route
            path="/world/home-room"
            element={
              <Suspense fallback={<div className="app-shell center-screen"><p>Loading your room…</p></div>}>
                <HomeRoom />
              </Suspense>
            }
          />
          <Route
            path="/world/island"
            element={
              <Suspense fallback={<div className="app-shell center-screen"><p>Sailing to your island…</p></div>}>
                <IslandBuild />
              </Suspense>
            }
          />
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/student/home" element={<StudentHome />} />
          <Route path="/student/:subject" element={<SubjectDashboard />} />
          <Route path="/student/marketplace" element={<Marketplace />} />
          <Route path="/student/piggy-bank" element={<PiggyBank />} />
          <Route path="/student/mailbox" element={<Mailbox />} />
          <Route path="/student/passport" element={<Passport />} />
          <Route path="/student/farmers-market" element={<FarmersMarket />} />
          <Route path="/student/bakery" element={<BakeryMatch3 />} />
          <Route path="/student/games" element={<GamesHub />} />
          <Route path="/student/grammar-gus" element={<Suspense fallback={<div className="app-shell center-screen"><p>Warming up the machine…</p></div>}><GusWorkboard /></Suspense>} />
          <Route path="/student/bubble-shooter" element={<Suspense fallback={<div className="app-shell center-screen"><p>Blowing bubbles…</p></div>}><BubbleShooter /></Suspense>} />
          <Route path="/student/shape-dash" element={<Suspense fallback={<div className="app-shell center-screen"><p>Warming up the dash…</p></div>}><ShapeDash /></Suspense>} />
          <Route path="/student/science-lab" element={<Suspense fallback={<div className="app-shell center-screen"><p>Setting up the lab…</p></div>}><ScienceLab /></Suspense>} />
          <Route path="/student/alchemy" element={<Suspense fallback={<div className="app-shell center-screen"><p>Mixing the elements…</p></div>}><Alchemy /></Suspense>} />
          <Route path="/student/library" element={<Suspense fallback={<div className="app-shell center-screen"><p>Opening the Library…</p></div>}><GusLibrary /></Suspense>} />
          <Route path="/student/grammar-gus/classic" element={<Suspense fallback={<div className="app-shell center-screen"><p>Warming up the machine…</p></div>}><GrammarGusMachine /></Suspense>} />
          <Route path="/student/quiz-mode" element={<QuizMode />} />
          <Route path="/student/castle-defense" element={<CastleDefense />} />
          <Route path="/student/space-bowling" element={<Suspense fallback={<div className="app-shell center-screen"><p>Fueling the rocket…</p></div>}><SpaceBowling /></Suspense>} />
          <Route
            path="/student/chess"
            element={
              <Suspense fallback={<div className="app-shell center-screen"><p>Squishing the chess pieces…</p></div>}>
                <SlimeChess />
              </Suspense>
            }
          />
          <Route
            path="/student/style"
            element={
              <Suspense fallback={<div className="center-screen"><p>Loading Style…</p></div>}>
                <StudentStyle />
              </Suspense>
            }
          />
          <Route path="/student/pet-shelter" element={<PetFinder />} />
          <Route path="/student/pet-finder" element={<PetFinder />} />
          <Route path="/student/gym" element={<BuffDogeGym />} />
          <Route path="/student/pet-show" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><PetShowRing /></Suspense>} />
          <Route path="/student/diner" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><DinerDash /></Suspense>} />
          <Route path="/student/cupcake-tycoon" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><IdleTycoon /></Suspense>} />
          <Route path="/student/crossy" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><CrossyHopper /></Suspense>} />
          <Route path="/student/plinko" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><PlinkoDrop /></Suspense>} />
          <Route path="/student/word-search" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><WordSearch /></Suspense>} />
          <Route path="/student/memory-match" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><MemoryMatch /></Suspense>} />
          <Route path="/student/whack-a-mole" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><WhackAMole /></Suspense>} />
          <Route path="/student/construction" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><ConstructionSite /></Suspense>} />
          <Route path="/student/dungeon" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><DungeonRooms /></Suspense>} />
          <Route path="/student/library-quest" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><LibraryQuest /></Suspense>} />
          <Route path="/student/gem-mine" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><GemMine /></Suspense>} />
          <Route path="/student/train-dispatch" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><TrainDispatch /></Suspense>} />
          <Route path="/student/mine-cart" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><MineCartRun /></Suspense>} />
          <Route path="/student/kitchen" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><KitchenCookOff /></Suspense>} />
          <Route path="/student/lighthouse" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><LighthouseSignal /></Suspense>} />
          <Route path="/student/post-office" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><PostOfficeSort /></Suspense>} />
          <Route path="/student/farm-grow" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><FarmGrow /></Suspense>} />
          <Route path="/student/fishing-dock" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><FishingDock /></Suspense>} />
          <Route path="/student/rescue-shelter" element={<Suspense fallback={<div className="app-shell center-screen"><p>Loading the game…</p></div>}><RescueShelter /></Suspense>} />
          <Route path="/student/pet-journal" element={<PetJournal />} />
          <Route path="/student/cinema" element={<Cinema />} />
          <Route path="/student/arcade" element={<GamesHub />} />
          <Route path="/student/grammar" element={<LiteracyManipulativesEmbed />} />
          <Route path="/teacher/login" element={<TeacherLogin />} />
          <Route element={<RequireTeacherAuth />}>
            <Route path="/teacher" element={<TeacherHome />} />
            <Route path="/teacher/students" element={<StudentManager />} />
            <Route path="/teacher/assignments" element={<AssignmentsIndex />} />
            <Route path="/teacher/lesson-plan/:studentId" element={<LessonPlanBuilder />} />
            <Route path="/teacher/live/:studentId" element={<StudentLiveView />} />
            <Route path="/teacher/inbox" element={<ReviewInbox />} />
            <Route path="/teacher/activities" element={<Navigate to="/teacher/assignments" replace />} />
            <Route path="/teacher/game" element={<GameManager />} />
            <Route path="/teacher/question-sets/:setId" element={<QuestionSetDetail />} />
            <Route path="/teacher/badges" element={<BadgeManager />} />
            <Route path="/teacher/marketplace" element={<MarketplaceManager />} />
            <Route path="/teacher/bank/:studentId" element={<TeacherStudentBank />} />
            <Route path="/teacher/scores" element={<ScoreHistory />} />
            <Route path="/teacher/sel-checkins" element={<SelCheckInLog />} />
            <Route path="/teacher/grammar-gus" element={<TeacherGusRoute />} />
            {/* A teacher's Grammar Gus board on its own page (teacher 2026-10-09): no back button,
                no way into student views, nothing else on the page. */}
            <Route path="/gus-board/:boardId" element={<GusBoardPage />} />
            <Route
              path="/teacher/style"
              element={
                <Suspense fallback={<div className="app-shell center-screen"><p>Loading Style…</p></div>}>
                  <StyleRoom />
                </Suspense>
              }
            />
            <Route
              path="/teacher/world-editor"
              element={
                <Suspense fallback={<div className="app-shell center-screen"><p>Loading Build Mode…</p></div>}>
                  <WorldEditor />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </div>
    </HashRouter>
  );
}

// Grammar Gus boards live at /gus-board/<id> (teacher 2026-10-09: "when i open a grammar gus board,
// i should be on a url that is just that. no back button to a computer and no way to navigate into
// student views"). Old /teacher/grammar-gus?board= links forward there.
const GUS_FALLBACK = <div className="app-shell center-screen"><p>Warming up the machine…</p></div>;
function GusBoardPage() {
  const { boardId } = useParams();
  return <Suspense fallback={GUS_FALLBACK}><GusWorkboard key={boardId} host board={boardId} /></Suspense>;
}
function TeacherGusRoute() {
  const q = new URLSearchParams(useLocation().search);
  const board = q.get('board');
  if (board) return <Navigate to={`/gus-board/${board}${q.get('live') === '1' ? '?live=1' : ''}`} replace />;
  return <Suspense fallback={GUS_FALLBACK}><GusWorkboard host /></Suspense>;
}
// Pop-ups for students (chat, check-ins, streaks...) never show over a teacher's board page.
function NotOnBoard({ children }: { children: React.ReactNode }) {
  return useLocation().pathname.startsWith('/gus-board/') ? null : <>{children}</>;
}
