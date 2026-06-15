import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchLeaderboard } from '../services/users';
import { useT, useLocale } from '../i18n';
import Icon from '../components/Icon';
import logoMark from '../assets/illustrations/logo-mark.svg';
import trophy from '../assets/illustrations/trophy.svg';

const MEDALS = ['#FFB300', '#B8BCC6', '#CD7F4B']; // золото / серебро / бронза

export default function Leaderboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const { locale } = useLocale();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLeaderboard(100)
      .then(setRows)
      .catch(() => setError(t('lb.loadError')));
  }, [t]);

  return (
    <div className="screen">
      <header className="topbar">
        <button className="brand" onClick={() => navigate('/')}>
          <img className="brand-logo-img" src={logoMark} alt="" />
          <span className="brand-name">Egorii</span>
        </button>
        <button className="iconbtn" onClick={() => navigate('/')} title={t('common.home')} aria-label={t('common.home')}>
          <Icon name="home" size={18} />
        </button>
      </header>

      <section className="card">
        <div className="lb-head">
          <span className="lb-badge"><Icon name="crown" size={22} /></span>
          <h2>{t('lb.title')}</h2>
        </div>
        <p className="muted lb-sub">{t('lb.sub')}</p>

        {error && <div className="error">{error}</div>}

        {!rows && !error && (
          <div className="center" style={{ padding: '24px 0' }}><div className="spinner" /></div>
        )}

        {rows && rows.length === 0 && (
          <div className="empty">
            <div className="empty-illo"><img src={trophy} alt="" /></div>
            <p className="muted">{t('lb.empty')}</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              <Icon name="play" size={16} /> {t('lb.playOne')}
            </button>
          </div>
        )}

        {rows && rows.length > 0 && (
          <div className="lb-list">
            {rows.map((p, i) => {
              const top = i < 3;
              const me = p.uid === user?.uid;
              return (
                <div key={p.uid} className={`lb-row${me ? ' me' : ''}${top ? ' top' : ''}`}>
                  {top
                    ? <span className="medal"><Icon name="crown" size={20} style={{ color: MEDALS[i] }} /></span>
                    : <span className="lb-rank">{i + 1}</span>}
                  {p.photo
                    ? <img src={p.photo} alt="" className="avatar" />
                    : <span className={`avatar${me ? ' flame' : ''}`}>{(p.nickname || p.name || 'И')[0]}</span>}
                  <div className="lb-main">
                    <span className="lb-name">{p.nickname || p.name || 'Игрок'}{me && <span className="you-tag">{t('common.you')}</span>}</span>
                    <span className="lb-meta">{t('lb.meta', { games: p.gamesPlayed || 0, wins: p.wins || 0 })}</span>
                  </div>
                  <span className="lb-score">{(p.totalScore || 0).toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
