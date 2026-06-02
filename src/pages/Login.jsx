import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  return (
    <div className="screen center">
      <div className="card login-card">
        <div className="logo-big">🎵</div>
        <h1>Музыкальная викторина</h1>
        <p className="muted">Угадай песню быстрее соперника</p>
        <button className="btn btn-google" onClick={() => signIn().catch(() => {})}>
          <span className="g">G</span> Войти через Google
        </button>
      </div>
    </div>
  );
}
