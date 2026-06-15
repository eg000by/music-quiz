import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getConsent, setConsent } from '../services/analytics';
import { useT } from '../i18n';

// Баннер согласия на аналитику. Показывается, пока выбор не сделан. До «Принять»
// Google Analytics не подключается и cookie не ставятся (см. analytics.js).
export default function ConsentBanner() {
  const navigate = useNavigate();
  const t = useT();
  const [decided, setDecided] = useState(() => getConsent() !== null);

  if (decided) return null;

  const choose = (granted) => {
    setConsent(granted);
    setDecided(true);
  };

  return (
    <div className="consent" role="dialog" aria-label={t('consent.aria')}>
      <p className="consent-text">
        {t('consent.text')}
        <button className="consent-link" onClick={() => navigate('/privacy')}>{t('consent.more')}</button>
      </p>
      <div className="consent-actions">
        <button className="btn btn-ghost" onClick={() => choose(false)}>{t('consent.decline')}</button>
        <button className="btn btn-primary" onClick={() => choose(true)}>{t('consent.accept')}</button>
      </div>
    </div>
  );
}
