import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { subscribeInvite, clearInvite } from '../services/friends';
import { track } from '../services/analytics';
import { useT } from '../i18n';
import Icon from './Icon';

// Приглашение актуально пару минут: дольше — отправитель скорее всего уже ушёл.
const FRESH_MS = 2 * 60 * 1000;

// Тост «X зовёт в игру»: слушает invites/{мой uid} и предлагает войти в лобби.
export default function InviteToast() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeInvite(user.uid, (d) => {
      // свежесть проверяем здесь, а не в рендере: устаревший зов просто не показываем
      const at = d?.at?.toMillis ? d.at.toMillis() : 0;
      setInvite(d?.code && at && Date.now() - at < FRESH_MS ? d : null);
    });
  }, [user?.uid]);

  if (!user || !invite?.code || invite.fromUid === user.uid) return null;
  if (location.pathname.includes(invite.code)) return null; // уже там

  const accept = () => {
    clearInvite(user.uid);
    track('friend_invite_accepted');
    navigate(`/lobby/${invite.code}`);
  };
  const dismiss = () => {
    setInvite(null);
    clearInvite(user.uid);
  };

  return (
    <div className="invite-pop" role="alert">
      <span className="ip-text"><b>{invite.fromName}</b> {t('invite.calls')}</span>
      <button className="ip-join" onClick={accept}><Icon name="play" size={14} /> {t('invite.join')}</button>
      <button className="ip-x" onClick={dismiss} aria-label={t('invite.hide')}><Icon name="x" size={16} /></button>
    </div>
  );
}
