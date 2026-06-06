import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { trackPage } from './services/analytics';

// Экраны грузятся лениво (code-splitting): стартовый бандл не тянет код игры
// (с аудио-движком), лобби, результатов и лидерборда, пока они не нужны.
const Login = lazy(() => import('./pages/Login'));
const Home = lazy(() => import('./pages/Home'));
const Lobby = lazy(() => import('./pages/Lobby'));
const Game = lazy(() => import('./pages/Game'));
const Results = lazy(() => import('./pages/Results'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));

function Spinner() {
  return (
    <div className="screen center">
      <div className="spinner" />
    </div>
  );
}

// Гостевой вход без экрана логина: пока идёт анонимный вход — спиннер; пользователь
// всегда есть (анонимный или Google). Login показываем только как фолбэк, если
// анонимный вход недоступен (провайдер выключен в консоли).
function Gate({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Login />;
  return children;
}

export default function App() {
  const location = useLocation();
  useEffect(() => { trackPage(location.pathname); }, [location.pathname]);

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<Gate><Home /></Gate>} />
        <Route path="/lobby/:code" element={<Gate><Lobby /></Gate>} />
        <Route path="/game/:code" element={<Gate><Game /></Gate>} />
        <Route path="/results/:code" element={<Gate><Results /></Gate>} />
        <Route path="/leaderboard" element={<Gate><Leaderboard /></Gate>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
