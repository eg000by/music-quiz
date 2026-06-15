import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchProfile } from '../services/users';
import { useT, useLocale } from '../i18n';
import Icon from '../components/Icon';

export default function Profile() {
  const { user, displayName, nickname, signIn, signOut, updateNickname } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const { locale, setLocale } = useLocale();
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
        <button className="back-link" onClick={() => navigate('/')}><Icon name="home" size={15} /> {t('common.home')}</button>

        <div className="profile-head">
          {user.photoURL
            ? <img src={user.photoURL} alt="" className="profile-ava" />
            : <div className="profile-ava ph">{initial}</div>}
          <div className="profile-name">{displayName}</div>
        </div>

        {user.isAnonymous ? (
          <div className="save-cta">
            <p className="muted">{t('profile.signinCta')}</p>
            <button className="btn btn-google" onClick={() => signIn().catch(() => {})}>
              <span className="g">G</span> {t('login.google')}
            </button>
          </div>
        ) : (
          <>
            <div className="profile-field">
              <span className="settings-label"><span>{t('profile.nickname')}</span></span>
              <input
                className="daily-input"
                style={{ paddingLeft: 14 }}
                value={value}
                maxLength={24}
                placeholder={t('profile.nicknamePh')}
                onChange={(e) => setValue(e.target.value)}
              />
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saved ? <><Icon name="check" size={18} /> {t('profile.saved')}</> : t('profile.save')}
              </button>
            </div>

            <div className="profile-stats">
              <div className="pstat"><b>{(stats?.totalScore || 0).toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')}</b><span>{t('profile.statScore')}</span></div>
              <div className="pstat"><b>{stats?.gamesPlayed || 0}</b><span>{t('profile.statGames')}</span></div>
              <div className="pstat"><b>{stats?.wins || 0}</b><span>{t('profile.statWins')}</span></div>
            </div>

            <button className="btn btn-ghost" onClick={handleSignOut}><Icon name="logout" size={18} /> {t('profile.logout')}</button>
          </>
        )}

        <div className="profile-lang">
          <span className="settings-label"><span>{t('profile.language')}</span></span>
          <div className="seg">
            <button className={`seg-btn${locale === 'ru' ? ' on' : ''}`} onClick={() => setLocale('ru')}>Русский</button>
            <button className={`seg-btn${locale === 'en' ? ' on' : ''}`} onClick={() => setLocale('en')}>English</button>
          </div>
        </div>
      </div>
    </div>
  );
}
