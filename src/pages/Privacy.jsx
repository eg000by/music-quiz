import { useNavigate } from 'react-router-dom';
import { useT, useLocale } from '../i18n';
import Icon from '../components/Icon';

// Политика конфиденциальности. Доступна без входа (вне Gate), чтобы её могли
// открыть краулеры и пользователи. Контактный e-mail можно поменять при необходимости.
const CONTACT_EMAIL = 'gladiator030576@gmail.com';
const UPDATED = { ru: '8 июня 2026', en: 'June 8, 2026' };

export default function Privacy() {
  const navigate = useNavigate();
  const t = useT();
  const { locale } = useLocale();
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <div className="screen">
      <div className="card legal">
        <h1>{t('privacy.title')}</h1>
        <p className="muted">{t('privacy.updated', { date: UPDATED[locale] || UPDATED.ru })}</p>

        <p>{t('privacy.intro')}</p>

        <h2>{t('privacy.h.data')}</h2>
        <ul>
          <li><b>{t('privacy.data.guestLabel')}</b> {t('privacy.data.guest')}</li>
          <li><b>{t('privacy.data.googleLabel')}</b> {t('privacy.data.google')}</li>
          <li><b>{t('privacy.data.gameLabel')}</b> {t('privacy.data.game')}</li>
          <li><b>{t('privacy.data.techLabel')}</b> {t('privacy.data.tech')}</li>
        </ul>

        <h2>{t('privacy.h.third')}</h2>
        <ul>
          <li>{t('privacy.third.firebase')}</li>
          <li>{t('privacy.third.ga')}</li>
          <li>{t('privacy.third.itunes')}</li>
        </ul>

        <h2>{t('privacy.h.cookies')}</h2>
        <p>{t('privacy.cookies.body')}</p>

        <h2>{t('privacy.h.storage')}</h2>
        <p>{t('privacy.storage.body')}</p>

        <h2>{t('privacy.h.transfer')}</h2>
        <p>{t('privacy.transfer.body')}</p>

        <h2>{t('privacy.h.age')}</h2>
        <p>{t('privacy.age.body')}</p>

        <h2>{t('privacy.h.rights')}</h2>
        <p>{t('privacy.rights.body')} {mail}{t('privacy.rights.body2')}</p>

        <h2>{t('privacy.h.contact')}</h2>
        <p>{t('privacy.contact.body')} {mail}.</p>

        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          <Icon name="home" size={18} /> {t('common.home')}
        </button>
      </div>
    </div>
  );
}
