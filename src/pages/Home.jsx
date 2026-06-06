import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PACKS } from '../data/packs';
import { createLobby, joinLobby } from '../services/lobby';
import Icon from '../components/Icon';
import logoMark from '../assets/illustrations/logo-mark.svg';

// Выбор пака свёрнут в выпадающий список, чтобы не занимать весь первый экран.
function PackPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const sel = PACKS.find((p) => p.id === value) || PACKS[0];
  return (
    <div className="pack-picker">
      <button
        type="button"
        className={`pack-select${open ? ' open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="pack-emoji"><Icon name={sel.icon} size={20} /></span>
        <span className="ps-text">
          <span className="ps-name">{sel.name}</span>
          <span className="ps-count">{sel.songs.length} песен</span>
        </span>
        <span className="ps-chev"><Icon name="chevronDown" size={16} /></span>
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <ul className="pack-menu" role="listbox">
            {PACKS.map((p) => (
              <li
                key={p.id}
                role="option"
                aria-selected={p.id === value}
                className={`pack-row${p.id === value ? ' sel' : ''}`}
                onClick={() => { onChange(p.id); setOpen(false); }}
              >
                <span className="pack-emoji"><Icon name={p.icon} size={20} /></span>
                <span className="ps-text">
                  <span className="ps-name">{p.name}</span>
                  <span className="ps-count">{p.songs.length} песен</span>
                </span>
                {p.id === value && <span className="tick"><Icon name="check" size={18} /></span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

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

  const initial = (user.displayName || 'И').trim()[0];

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
          {user.photoURL
            ? <img src={user.photoURL} alt="" className="avatar" />
            : <div className="avatar ph">{initial}</div>}
          <button className="iconbtn" onClick={() => signOut()} title="Выйти" aria-label="Выйти">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </header>

      <main className="home">
        <section className="card">
          <h2>Новая игра</h2>
          <p className="muted">Выбери пак и наслаждайся — включаем 30 секунд трека, угадывай на скорость.</p>
          <span className="settings-label">Пак</span>
          <PackPicker value={packId} onChange={setPackId} />
          <button className="btn btn-primary" onClick={handleCreate} disabled={busy}>
            Создать игру <Icon name="arrowRight" size={18} />
          </button>
        </section>

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
          />
          <button className="btn btn-secondary" onClick={handleJoin} disabled={busy}>
            Присоединиться
          </button>
        </section>

        {error && <div className="error">{error}</div>}
      </main>
    </div>
  );
}
