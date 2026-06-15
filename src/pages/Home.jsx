import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createLobby, joinLobby, shortName } from '../services/lobby';
import { dayNumber, getStreak, loadDailyState } from '../services/daily';
import { getRecentPlayers, sendInvite } from '../services/friends';
import { track } from '../services/analytics';

const DONATE_URL = import.meta.env.VITE_DONATE_URL;
import Icon from '../components/Icon';
import logoMark from '../assets/illustrations/logo-mark.svg';

export default function Home() {
  const { user, displayName, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recents] = useState(() => getRecentPlayers().slice(0, 6));

  // Эффективное имя (никнейм/Google) — только для зарегистрированных; у гостей
  // остаётся авто-«Игрок N», поэтому им передаём undefined.
  const myName = user.isAnonymous ? undefined : displayName;

  // Паки выбираются в лобби (свои у каждого игрока, объединяются) — тут только создание.
  const handleCreate = async () => {
    setError('');
    setBusy(true);
    try {
      const newCode = await createLobby(user, null, myName);
      navigate(`/lobby/${newCode}`);
    } catch (e) {
      setError(e.message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  // «Снова вместе»: создаём лобби и сразу зовём недавнего соигрока.
  const playWith = async (r) => {
    setError('');
    setBusy(true);
    try {
      const newCode = await createLobby(user, null, myName);
      await sendInvite(r.uid, newCode, user, myName).catch(() => {});
      navigate(`/lobby/${newCode}`);
    } catch (e) {
      setError(e.message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    setError('');
    if (!/^\d{4}$/.test(code)) {
      setError('Код состоит из 4 цифр');
      return;
    }
    setBusy(true);
    try {
      await joinLobby(code, user, myName);
      navigate(`/lobby/${code}`);
    } catch (e) {
      setError(e.message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const initial = (displayName || 'И').trim()[0];

  return (
    <div className="screen">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo-img" src={logoMark} alt="" />
          <span className="brand-name">Egorii</span>
        </div>
        <div className="user">
          <button className="iconbtn" onClick={() => navigate('/leaderboard')} title="Таблица лидеров" aria-label="Таблица лидеров">
            <Icon name="crown" size={18} />
          </button>
          <button className="avatar-btn" onClick={() => navigate('/profile')} title="Профиль" aria-label="Профиль">
            {user.photoURL
              ? <img src={user.photoURL} alt="" className="avatar" />
              : <div className="avatar ph">{initial}</div>}
          </button>
          {user.isAnonymous ? (
            <button className="iconbtn" onClick={() => signIn().catch(() => {})} title="Войти через Google — сохранять прогресс и попасть в таблицу лидеров" aria-label="Войти через Google">
              <span className="g-mark">G</span>
            </button>
          ) : (
            <button className="iconbtn" onClick={() => signOut()} title="Выйти" aria-label="Выйти">
              <Icon name="logout" size={18} />
            </button>
          )}
        </div>
      </header>

      <main className="home">
        <button className="daily-banner" onClick={() => navigate('/daily')}>
          <span className="db-ico"><Icon name="music" size={22} /></span>
          <span className="db-text">
            <b>Трек дня #{dayNumber()}</b>
            <span>{loadDailyState()?.done ? 'Сегодня сыграно — смотри результат' : 'Один трек · 5 попыток · новый каждый день'}</span>
          </span>
          {getStreak() > 1 && <span className="db-streak"><Icon name="flame" size={13} fill="currentColor" /> {getStreak()}</span>}
          <Icon name="arrowRight" size={18} />
        </button>

        <section className="card">
          <h2>Новая игра</h2>
          <p className="muted">Включаем 30 секунд трека — угадывай на скорость. Паки музыки выберете в лобби.</p>
          <button className="btn btn-primary" onClick={handleCreate} disabled={busy}>
            Создать игру <Icon name="arrowRight" size={18} />
          </button>
        </section>

        {recents.length > 0 && (
          <section className="card">
            <h2>Снова вместе</h2>
            <p className="muted">Недавно играли вместе — позови в новую игру одним нажатием.</p>
            <div className="recent-list">
              {recents.map((r) => (
                <button key={r.uid} className="recent-chip" disabled={busy} onClick={() => playWith(r)}>
                  {r.photo
                    ? <img className="rc-ava" src={r.photo} alt="" />
                    : <span className="rc-ava rc-ph">{(r.name || 'И')[0]}</span>}
                  {shortName(r.name)}
                  <Icon name="arrowRight" size={14} />
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="card">
          <h2>Игра по коду</h2>
          <p className="muted">Прислали код? Введи его и присоединяйся.</p>
          <input
            className="code-input"
            inputMode="numeric"
            maxLength={4}
            placeholder="1234"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
          />
          <button className="btn btn-secondary" onClick={handleJoin} disabled={busy}>
            Присоединиться
          </button>
        </section>

        {error && <div className="error">{error}</div>}

        <section className="seo-note">
          <h3>Что такое Egorii?</h3>
          <p>
            Egorii — бесплатная музыкальная викторина онлайн. Угадывай песню по 30-секундному
            отрывку и год её выпуска: создай лобби, отправь друзьям 4-значный код — и соревнуйтесь
            в реальном времени. Или заходи каждый день в «Трек дня», держи стрик и делись
            результатом. Паки на любой вкус: мировые хиты, рок-классика, русская эстрада, K-pop.
          </p>
        </section>

        <div className="foot-links">
          {DONATE_URL && (
            <a
              className="donate-link"
              href={DONATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('donate_click', { from: 'home' })}
            >
              <Icon name="heart" size={14} /> Поддержать проект
            </a>
          )}
          <button className="btn-link legal-link" onClick={() => navigate('/privacy')}>
            Политика конфиденциальности
          </button>
        </div>
      </main>
    </div>
  );
}
