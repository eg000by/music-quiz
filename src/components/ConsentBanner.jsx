import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getConsent, setConsent } from '../services/analytics';

// Баннер согласия на аналитику. Показывается, пока выбор не сделан. До «Принять»
// Google Analytics не подключается и cookie не ставятся (см. analytics.js).
export default function ConsentBanner() {
  const navigate = useNavigate();
  const [decided, setDecided] = useState(() => getConsent() !== null);

  if (decided) return null;

  const choose = (granted) => {
    setConsent(granted);
    setDecided(true);
  };

  return (
    <div className="consent" role="dialog" aria-label="Согласие на аналитику">
      <p className="consent-text">
        Мы используем cookie и Google Analytics, чтобы понимать, как улучшать игру.{' '}
        <button className="consent-link" onClick={() => navigate('/privacy')}>Подробнее</button>
      </p>
      <div className="consent-actions">
        <button className="btn btn-ghost" onClick={() => choose(false)}>Отклонить</button>
        <button className="btn btn-primary" onClick={() => choose(true)}>Принять</button>
      </div>
    </div>
  );
}
