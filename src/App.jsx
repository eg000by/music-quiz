import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { trackPage } from './services/analytics';
import Login from './pages/Login';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Results from './pages/Results';
import Leaderboard from './pages/Leaderboard';

// Гостевой вход без экрана логина: пока идёт анонимный вход — спиннер; пользователь
// всегда есть (анонимный или Google). Login показываем только как фолбэк, если
// анонимный вход недоступен (провайдер выключен в консоли).
function Gate({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="screen center">
        <div className="spinner" />
      </div>
    );
  }
  if (!user) return <Login />;
  return children;
}

export default function App() {
  const location = useLocation();
  useEffect(() => { trackPage(location.pathname); }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<Gate><Home /></Gate>} />
      <Route path="/lobby/:code" element={<Gate><Lobby /></Gate>} />
      <Route path="/game/:code" element={<Gate><Game /></Gate>} />
      <Route path="/results/:code" element={<Gate><Results /></Gate>} />
      <Route path="/leaderboard" element={<Gate><Leaderboard /></Gate>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
