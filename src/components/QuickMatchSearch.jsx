import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLobby } from '../hooks/useLobby';
import { useT } from '../i18n';
import { startGame, leaveLobby } from '../services/lobby';
import Icon from './Icon';

// Если за это время соперник не нашёлся — предлагаем запасной вариант.
const FALLBACK_MS = 25000;

// Оверлей поиска соперника для «Быстрого матча». Хост сам стартует дуэль, когда
// приходит второй игрок; оба уходят на игровой экран, как только статус сменится.
export default function QuickMatchSearch({ code, role, onCancel, onFallback }) {
  const { user } = useAuth();
  const { lobby } = useLobby(code);
  const navigate = useNavigate();
  const t = useT();
  const [timedOut, setTimedOut] = useState(false);
  const startedRef = useRef(false);

  // авто-старт у хоста, как только в лобби двое
  useEffect(() => {
    if (role !== 'host' || !lobby || startedRef.current) return;
    if (lobby.status === 'waiting' && Object.keys(lobby.players || {}).length >= 2) {
      startedRef.current = true;
      startGame(code).catch(() => {});
    }
  }, [lobby, role, code]);

  // игра пошла — на игровой экран
  useEffect(() => {
    if (lobby?.status === 'loading' || lobby?.status === 'playing') {
      navigate(`/game/${code}`, { replace: true });
    }
  }, [lobby?.status, code, navigate]);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), FALLBACK_MS);
    return () => clearTimeout(id);
  }, []);

  const cancel = () => { leaveLobby(code, user.uid).catch(() => {}); onCancel(); };

  return (
    <div className="quick-overlay">
      <div className="quick-card">
        {!timedOut ? (
          <>
            <div className="spinner" />
            <b>{t('quick.searching')}</b>
            <p className="muted">{t('quick.searchingHint')}</p>
            <button className="btn btn-ghost" onClick={cancel}>{t('quick.cancel')}</button>
          </>
        ) : (
          <>
            <span className="quick-ico"><Icon name="zap" size={26} /></span>
            <b>{t('quick.noneTitle')}</b>
            <p className="muted">{t('quick.noneHint')}</p>
            <button className="btn btn-primary" onClick={onFallback}>{t('quick.createNormal')}</button>
            <button className="btn btn-ghost" onClick={cancel}>{t('quick.cancel')}</button>
          </>
        )}
      </div>
    </div>
  );
}
