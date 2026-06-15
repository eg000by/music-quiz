import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchLeaderboard } from '../services/users';
import Icon from '../components/Icon';
import logoMark from '../assets/illustrations/logo-mark.svg';
import trophy from '../assets/illustrations/trophy.svg';

const MEDALS = ['#FFB300', '#B8BCC6', '#CD7F4B']; // золото / серебро / бронза

export default function Leaderboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLeaderboard(100)
      .then(setRows)
      .catch(() => setError('Не удалось загрузить таблицу лидеров'));
  }, []);

  return (
    <div className="screen">
      <header className="topbar">
        <button className="brand" onClick={() => navigate('/')}>
          <img className="brand-logo-img" src={logoMark} alt="" />
          <span className="brand-name">Egorii</span>
        </button>
        <button className="iconbtn" onClick={() => navigate('/')} title="На главную" aria-label="На главную">
          <Icon name="home" size={18} />
        </button>
      </header>

      <section className="card">
        <div className="lb-head">
          <span className="lb-badge"><Icon name="crown" size={22} /></span>
          <h2>Таблица лидеров</h2>
        </div>
        <p className="muted lb-sub">Сумма очков по всем сыгранным партиям</p>

        {error && <div className="error">{error}</div>}

        {!rows && !error && (
          <div className="center" style={{ padding: '24px 0' }}><div className="spinner" /></div>
        )}

        {rows && rows.length === 0 && (
          <div className="empty">
            <div className="empty-illo"><img src={trophy} alt="" /></div>
            <p className="muted">Пока никто не сыграл ни одной партии. Сыграй первым — и займёшь вершину.</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              <Icon name="play" size={16} /> Сыграть партию
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
                    <span className="lb-name">{p.nickname || p.name || 'Игрок'}{me && <span className="you-tag">ты</span>}</span>
                    <span className="lb-meta">{p.gamesPlayed || 0} игр · {p.wins || 0} побед</span>
                  </div>
                  <span className="lb-score">{(p.totalScore || 0).toLocaleString('ru-RU')}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
