import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoMark from '../assets/illustrations/logo-mark.svg';
import vinyl from '../assets/illustrations/vinyl.svg';

// Фолбэк-экран входа. В обычном потоке не показывается (гостевой анонимный вход
// происходит автоматически), но если анонимный провайдер недоступен — отсюда можно
// войти через Google. Как только появится пользователь, Gate сам покажет приложение.
export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="screen center">
      <div className="card login-card">
        <div className="brand brand-lg">
          <img className="brand-logo-img" src={logoMark} alt="" />
          <span className="brand-name">Egorii</span>
        </div>
        <div className="login-illo"><img src={vinyl} alt="" /></div>
        <span className="eyebrow">Игра · угадай трек быстрее</span>
        <h1>Музыкальная викторина</h1>
        <p className="muted">Включаем 30 секунд трека. Узнал песню быстрее — забрал очки. Играй один или с кем-то по коду.</p>
        <button className="btn btn-google" onClick={() => signIn().catch(() => {})}>
          <span className="g">G</span> Войти через Google
        </button>
        <p className="muted">Нужен только аккаунт Google.</p>
        <button className="btn-link legal-link" onClick={() => navigate('/privacy')}>
          Политика конфиденциальности
        </button>
      </div>
    </div>
  );
}
