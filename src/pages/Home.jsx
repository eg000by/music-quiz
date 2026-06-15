import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createLobby, joinLobby, quickMatch, leaveLobby, shortName } from '../services/lobby';
import { dayNumber, getStreak, loadDailyState } from '../services/daily';
import { getRecentPlayers, sendInvite } from '../services/friends';
import { track } from '../services/analytics';
import { useT } from '../i18n';
import Icon from '../components/Icon';
import QuickMatchSearch from '../components/QuickMatchSearch';
import logoMark from '../assets/illustrations/logo-mark.svg';

const DONATE_URL = import.meta.env.VITE_DONATE_URL;

export default function Home() {
  const { user, displayName, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recents] = useState(() => getRecentPlayers().slice(0, 6));
  const [match, setMatch] = useState(null); // { code, role } — идёт быстрый матч

  // Эффективное имя (никнейм/Google) — только для зарегистрированных; у гостей
  // остаётся авто-«Игрок N», поэтому им передаём undefined.
  const myName = user.isAnonymous ? undefined : displayName;

  // «Быстрый матч»: подбор случайного соперника (см. QuickMatchSearch).
  const handleQuick = async () => {
    setError('');
    setBusy(true);
    try {
      setMatch(await quickMatch(user, myName));
    } catch (e) {
      setError(e.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };
  const quickCancel = () => setMatch(null);
  const quickFallback = async () => {
    const prev = match?.code;
    setMatch(null);
    if (prev) await leaveLobby(prev, user.uid).catch(() => {});
    handleCreate();
  };

  // Паки выбираются в лобби (свои у каждого игрока, объединяются) — тут только создание.
  const handleCreate = async () => {
    setError('');
    setBusy(true);
    try {
      const newCode = await createLobby(user, null, myName);
      navigate(`/lobby/${newCode}`);
    } catch (e) {
      setError(e.message || t('common.error'));
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
      setError(e.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    setError('');
    if (!/^\d{4}$/.test(code)) {
      setError(t('home.codeErr'));
      return;
    }
    setBusy(true);
    try {
      await joinLobby(code, user, myName);
      navigate(`/lobby/${code}`);
    } catch (e) {
      setError(e.message || t('common.error'));
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
          <button className="iconbtn" onClick={() => navigate('/leaderboard')} title={t('lb.title')} aria-label={t('lb.title')}>
            <Icon name="crown" size={18} />
          </button>
          <button className="avatar-btn" onClick={() => navigate('/profile')} title={t('profile.nickname')} aria-label={t('profile.nickname')}>
            {user.photoURL
              ? <img src={user.photoURL} alt="" className="avatar" />
              : <div className="avatar ph">{initial}</div>}
          </button>
          {user.isAnonymous ? (
            <button className="iconbtn" onClick={() => signIn().catch(() => {})} title={t('login.google')} aria-label={t('login.google')}>
              <span className="g-mark">G</span>
            </button>
          ) : (
            <button className="iconbtn" onClick={() => signOut()} title={t('profile.logout')} aria-label={t('profile.logout')}>
              <Icon name="logout" size={18} />
            </button>
          )}
        </div>
      </header>

      <main className="home">
        <button className="daily-banner" onClick={() => navigate('/daily')}>
          <span className="db-ico"><Icon name="music" size={22} /></span>
          <span className="db-text">
            <b>{t('home.dailyTitle', { n: dayNumber() })}</b>
            <span>{loadDailyState()?.done ? t('home.dailyDone') : t('home.dailyHint')}</span>
          </span>
          {getStreak() > 1 && <span className="db-streak"><Icon name="flame" size={13} fill="currentColor" /> {getStreak()}</span>}
          <Icon name="arrowRight" size={18} />
        </button>

        <section className="card">
          <h2>{t('home.newGame')}</h2>
          <p className="muted">{t('home.newGameHint')}</p>
          <button className="btn btn-primary" onClick={handleCreate} disabled={busy}>
            {t('home.create')} <Icon name="arrowRight" size={18} />
          </button>
          <button className="btn btn-secondary" onClick={handleQuick} disabled={busy}>
            <Icon name="zap" size={18} /> {t('home.quickMatch')}
          </button>
          <p className="muted quick-sub">{t('home.quickMatchHint')}</p>
        </section>

        {recents.length > 0 && (
          <section className="card">
            <h2>{t('home.again')}</h2>
            <p className="muted">{t('home.againHint')}</p>
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
          <h2>{t('home.byCode')}</h2>
          <p className="muted">{t('home.byCodeHint')}</p>
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
            {t('home.join')}
          </button>
        </section>

        {error && <div className="error">{error}</div>}

        <section className="seo-note">
          <h3>{t('home.seoTitle')}</h3>
          <p>{t('home.seoBody')}</p>
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
              <Icon name="heart" size={14} /> {t('common.support')}
            </a>
          )}
          <button className="btn-link legal-link" onClick={() => navigate('/privacy')}>
            {t('common.privacy')}
          </button>
        </div>
      </main>

      {match && (
        <QuickMatchSearch
          code={match.code}
          role={match.role}
          onCancel={quickCancel}
          onFallback={quickFallback}
        />
      )}
    </div>
  );
}
