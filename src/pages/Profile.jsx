import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchProfile } from '../services/users';
import Icon from '../components/Icon';

export default function Profile() {
  const { user, displayName, nickname, signIn, signOut, updateNickname } = useAuth();
  const navigate = useNavigate();
  const [value, setValue] = useState(nickname || (user && !user.isAnonymous ? user.displayName : '') || '');
  const [stats, setStats] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    fetchProfile(user.uid).then((p) => p && setStats(p)).catch(() => {});
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      await updateNickname(value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleSignOut = () => { signOut(); navigate('/'); };

  const initial = (displayName || 'И').trim()[0];

  return (
    <div className="screen center">
      <div className="card profile-card">
        <button className="back-link" onClick={() => navigate('/')}><Icon name="home" size={15} /> На главную</button>

        <div className="profile-head">
          {user.photoURL
            ? <img src={user.photoURL} alt="" className="profile-ava" />
            : <div className="profile-ava ph">{initial}</div>}
          <div className="profile-name">{displayName}</div>
        </div>

        {user.isAnonymous ? (
          <div className="save-cta">
            <p className="muted">Войди через Google, чтобы выбрать никнейм, сохранять очки и попасть в таблицу лидеров.</p>
            <button className="btn btn-google" onClick={() => signIn().catch(() => {})}>
              <span className="g">G</span> Войти через Google
            </button>
          </div>
        ) : (
          <>
            <div className="profile-field">
              <span className="settings-label"><span>Никнейм</span></span>
              <input
                className="daily-input"
                style={{ paddingLeft: 14 }}
                value={value}
                maxLength={24}
                placeholder="Твоё имя в игре"
                onChange={(e) => setValue(e.target.value)}
              />
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saved ? <><Icon name="check" size={18} /> Сохранено</> : 'Сохранить никнейм'}
              </button>
            </div>

            <div className="profile-stats">
              <div className="pstat"><b>{(stats?.totalScore || 0).toLocaleString('ru-RU')}</b><span>очков</span></div>
              <div className="pstat"><b>{stats?.gamesPlayed || 0}</b><span>игр</span></div>
              <div className="pstat"><b>{stats?.wins || 0}</b><span>побед</span></div>
            </div>

            <button className="btn btn-ghost" onClick={handleSignOut}><Icon name="logout" size={18} /> Выйти</button>
          </>
        )}
      </div>
    </div>
  );
}
