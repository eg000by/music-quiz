import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';
import logoMark from '../assets/illustrations/logo-mark.svg';
import vinyl from '../assets/illustrations/vinyl.svg';

// Фолбэк-экран входа. В обычном потоке не показывается (гостевой анонимный вход
// происходит автоматически), но если анонимный провайдер недоступен — отсюда можно
// войти через Google. Как только появится пользователь, Gate сам покажет приложение.
export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const t = useT();

  return (
    <div className="screen center">
      <div className="card login-card">
        <div className="brand brand-lg">
          <img className="brand-logo-img" src={logoMark} alt="" />
          <span className="brand-name">Egorii</span>
        </div>
        <div className="login-illo"><img src={vinyl} alt="" /></div>
        <span className="eyebrow">{t('login.eyebrow')}</span>
        <h1>{t('login.title')}</h1>
        <p className="muted">{t('login.lead')}</p>
        <button className="btn btn-google" onClick={() => signIn().catch(() => {})}>
          <span className="g">G</span> {t('login.google')}
        </button>
        <p className="muted">{t('login.googleNote')}</p>
        <button className="btn-link legal-link" onClick={() => navigate('/privacy')}>
          {t('common.privacy')}
        </button>
      </div>
    </div>
  );
}
