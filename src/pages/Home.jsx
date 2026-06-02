import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PACKS } from '../data/packs';
import { createLobby, joinLobby } from '../services/lobby';

export default function Home() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [packId, setPackId] = useState(PACKS[0].id);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setError('');
    setBusy(true);
    try {
      const pack = PACKS.find((p) => p.id === packId);
      const newCode = await createLobby(user, pack);
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
      await joinLobby(code, user);
      navigate(`/lobby/${code}`);
    } catch (e) {
      setError(e.message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <header className="topbar">
        <div className="brand">🎵 Викторина</div>
        <div className="user">
          {user.photoURL && <img src={user.photoURL} alt="" className="avatar" />}
          <span>{user.displayName}</span>
          <button className="btn-link" onClick={() => signOut()}>выйти</button>
        </div>
      </header>

      <main className="home">
        <section className="card">
          <h2>Создать лобби</h2>
          <p className="muted">Выбери пак музыки и пригласи друга по коду</p>
          <div className="pack-grid">
            {PACKS.map((p) => (
              <button
                key={p.id}
                className={`pack ${packId === p.id ? 'pack-active' : ''}`}
                onClick={() => setPackId(p.id)}
              >
                <span className="pack-emoji">{p.emoji}</span>
                <span className="pack-name">{p.name}</span>
                <span className="pack-count">{p.songs.length} песен</span>
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={handleCreate} disabled={busy}>
            Создать лобби
          </button>
        </section>

        <section className="card">
          <h2>Присоединиться</h2>
          <p className="muted">Введи 4-значный код лобби</p>
          <input
            className="code-input"
            inputMode="numeric"
            maxLength={4}
            placeholder="1234"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          <button className="btn btn-secondary" onClick={handleJoin} disabled={busy}>
            Войти в лобби
          </button>
        </section>

        {error && <div className="error">{error}</div>}
      </main>
    </div>
  );
}
