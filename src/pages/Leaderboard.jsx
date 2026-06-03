import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchLeaderboard } from '../services/users';
import Icon from '../components/Icon';

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
        <button className="brand brand-back" onClick={() => navigate('/')}>
          <span className="brand-logo"><Icon name="music" size={16} /></span> Викторина
        </button>
        <button className="btn-link" onClick={() => navigate('/')}>на главную</button>
      </header>

      <main className="home">
        <section className="card">
          <span className="eyebrow">Рейтинг</span>
          <h2><Icon name="crown" size={22} /> Таблица лидеров</h2>
          <p className="muted">Сумма очков по всем сыгранным партиям</p>

          {error && <div className="error">{error}</div>}

          {!rows && !error && (
            <div className="center" style={{ padding: '24px 0' }}><div className="spinner" /></div>
          )}

          {rows && rows.length === 0 && (
            <p className="muted" style={{ marginTop: 12 }}>Пока никто не сыграл ни одной партии.</p>
          )}

          {rows && rows.length > 0 && (
            <div className="lb-list">
              {rows.map((p, i) => (
                <div key={p.uid} className={`lb-row ${p.uid === user?.uid ? 'me' : ''}`}>
                  <span className={`lb-rank rank-${i + 1}`}>{i + 1}</span>
                  {p.photo
                    ? <img src={p.photo} alt="" className="avatar" />
                    : <div className="avatar ph">{(p.name || '?')[0]}</div>}
                  <span className="lb-name">{p.name || 'Игрок'}</span>
                  <span className="lb-meta">{p.gamesPlayed || 0} игр · {p.wins || 0} побед</span>
                  <span className="lb-score">{p.totalScore || 0}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
