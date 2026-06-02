import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import vinyl from '../assets/illustrations/vinyl.svg';

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  return (
    <div className="screen center">
      <div className="card login-card">
        <div className="login-illo"><img src={vinyl} alt="" /></div>
        <span className="eyebrow">Игра · угадай трек быстрее</span>
        <h1>Музыкальная викторина</h1>
        <p className="muted">Включаем 30 секунд трека. Кто быстрее узнаёт песню — тот и забирает очки.</p>
        <button className="btn btn-google" onClick={() => signIn().catch(() => {})}>
          <span className="g">G</span> Войти через Google
        </button>
        <p className="muted">Нужен только аккаунт Google и друг.</p>
      </div>
    </div>
  );
}
