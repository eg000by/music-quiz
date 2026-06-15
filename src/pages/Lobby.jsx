import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLobby } from '../hooks/useLobby';
import { useT, useLocale } from '../i18n';
import { getPack, PACKS, packName } from '../data/packs';
import {
  setReady,
  startGame,
  joinLobby,
  leaveLobby,
  setLobbyRounds,
  setLobbyMode,
  togglePlayerPack,
  combinedSongs,
  shortName,
} from '../services/lobby';
import { syncClock } from '../services/clock';
import { shareOrCopy } from '../services/share';
import { getRecentPlayers, sendInvite } from '../services/friends';
import { track } from '../services/analytics';
import Icon from '../components/Icon';

const MIN_ROUNDS = 3;
const MAX_ROUNDS = 15;
const MODES = [
  { id: 'normal', key: 'lobby.modeNormal' },
  { id: 'evolution', key: 'lobby.modeEvolution' },
];

export default function Lobby() {
  const { code } = useParams();
  const { user, displayName } = useAuth();
  const { lobby, loading } = useLobby(code);
  const navigate = useNavigate();
  const t = useT();
  const { locale } = useLocale();
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [invited, setInvited] = useState(() => new Set());
  const joiningRef = useRef(false);
  const leavingRef = useRef(false);

  // Заход по ссылке-приглашению (/lobby/CODE) ведёт сюда напрямую, минуя join с
  // главной. Если игрока ещё нет в составе — добавляем его сам (один раз).
  useEffect(() => {
    if (!lobby || !user?.uid || leavingRef.current) return;
    if (lobby.players?.[user.uid]) { joiningRef.current = false; return; }
    if (joiningRef.current) return;
    joiningRef.current = true;
    track('invite_open', { code });
    joinLobby(code, user, user.isAnonymous ? undefined : displayName).catch((e) => setError(e.message || t('lobby.joinError')));
  }, [lobby, user, code, displayName, t]);

  // заранее измеряем смещение часов, чтобы хост стартовал раунды в серверном времени
  useEffect(() => {
    if (code && user?.uid) syncClock(code, user.uid);
  }, [code, user?.uid]);

  // как только игра началась — переходим на экран игры
  useEffect(() => {
    if (lobby?.status === 'playing' || lobby?.status === 'loading') {
      navigate(`/game/${code}`, { replace: true });
    }
    if (lobby?.status === 'finished') {
      navigate(`/results/${code}`, { replace: true });
    }
  }, [lobby?.status, code, navigate]);

  const handleShareInvite = async () => {
    const url = `${window.location.origin}/lobby/${code}`;
    const res = await shareOrCopy({
      title: t('lobby.shareTitle'),
      text: t('lobby.shareText', { code }),
      url,
    });
    if (res === 'copied') setShareMsg(t('lobby.linkCopied'));
    else if (res === 'failed') setShareMsg(t('lobby.shareFailed'));
    else setShareMsg('');
    if (res === 'copied' || res === 'failed') setTimeout(() => setShareMsg(''), 2500);
    if (res !== 'failed') track('share', { content_type: 'invite', method: res });
  };

  if (loading || leaving) {
    return <div className="screen center"><div className="spinner" /></div>;
  }
  if (!lobby) {
    return (
      <div className="screen center">
        <div className="card center-card">
          <p>{t('lobby.notFound')}</p>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>{t('common.home')}</button>
        </div>
      </div>
    );
  }

  const me = lobby.players[user.uid];
  if (!me) {
    return (
      <div className="screen center">
        {error ? (
          <div className="card center-card">
            <p>{error}</p>
            <button className="btn btn-secondary" onClick={() => navigate('/')}>{t('common.home')}</button>
          </div>
        ) : (
          <>
            <div className="spinner" />
            <p className="muted">{t('lobby.entering')}</p>
          </>
        )}
      </div>
    );
  }

  const isHost = lobby.hostId === user.uid;
  const players = lobby.playerOrder.map((uid) => lobby.players[uid]).filter(Boolean);
  const myPacks = me.packs || [];
  const roundCount = lobby.roundCount || 8;
  const mode = lobby.mode || 'normal';
  const everyoneReady = players.length >= 1 && players.every((p) => p.ready);

  // объединённый пул паков всех игроков
  const selectedPackIds = new Set();
  players.forEach((p) => (p.packs || []).forEach((id) => selectedPackIds.add(id)));
  const poolSongs = combinedSongs(lobby).length;
  const hasPacks = selectedPackIds.size > 0;
  const manyPacks = PACKS.length > 6;

  const toggleReady = () => setReady(code, user.uid, !me.ready).catch(() => {});
  const toggleMyPack = (packId) =>
    togglePlayerPack(code, user.uid, packId, !myPacks.includes(packId)).catch(() => {});

  // выбранные паки всплывают в начало списка (sort стабильный — внутри групп порядок исходный)
  const sortedPacks = [...PACKS].sort(
    (a, b) => (myPacks.includes(b.id) ? 1 : 0) - (myPacks.includes(a.id) ? 1 : 0)
  );

  // «недавно играли вместе», кто ещё не в этом лобби — приглашение в один клик
  const invitable = getRecentPlayers().filter((r) => !lobby.players[r.uid]).slice(0, 6);
  const inviteRecent = (r) => {
    sendInvite(r.uid, code, user, me.name)
      .then(() => setInvited((prev) => new Set(prev).add(r.uid)))
      .catch(() => {});
  };

  const handleLeave = async () => {
    leavingRef.current = true;
    setLeaving(true);
    await leaveLobby(code, user.uid).catch(() => {});
    navigate('/');
  };

  const handleStart = async () => {
    setError('');
    setStarting(true);
    try {
      await startGame(code);
    } catch (e) {
      setError(e.message || t('lobby.startErr'));
      setStarting(false);
    }
  };

  return (
    <div className="screen center">
      <div className="card lobby-card">
        <span className="eyebrow">{t('lobby.codeLabel')}</span>
        <div className="code-display">{lobby.code}</div>
        <p className="meta-line">
          {hasPacks
            ? t('lobby.inGame', { songs: poolSongs, rounds: roundCount })
            : t('lobby.pickPacks', { rounds: roundCount })}
          {mode === 'evolution' && ` · ${t('lobby.modeEvolution')}`}
        </p>

        <div className="players-list">
          {players.map((p) => (
            <div key={p.uid} className="player-row">
              {p.photo
                ? <img src={p.photo} alt="" className="avatar" />
                : <div className="avatar ph">{(p.name || 'И')[0]}</div>}
              <div className="player-main">
                <span className="player-name">
                  {p.name}{p.uid === lobby.hostId && <Icon name="crown" size={14} className="host-mark" />}
                </span>
                <div className="player-tags">
                  {(p.packs || []).length === 0
                    ? <span className="no-packs">{t('lobby.noPacks')}</span>
                    : (p.packs || []).map((id) => {
                        const pk = getPack(id);
                        if (!pk) return null;
                        // свой бейдж — кнопка: клик убирает пак
                        return p.uid === user.uid ? (
                          <button
                            key={id}
                            className="pack-chip mine"
                            onClick={() => togglePlayerPack(code, user.uid, id, false).catch(() => {})}
                            title={t('lobby.removePack')}
                          >
                            <Icon name={pk.icon} size={12} /> {packName(pk, locale)} <Icon name="x" size={11} />
                          </button>
                        ) : (
                          <span key={id} className="pack-chip"><Icon name={pk.icon} size={12} /> {packName(pk, locale)}</span>
                        );
                      })}
                </div>
              </div>
              <span className={`ready-badge${p.ready ? ' on' : ''}`}>{p.ready ? t('lobby.ready') : t('lobby.notReady')}</span>
            </div>
          ))}

          <button className="invite-row" onClick={handleShareInvite}>
            <Icon name="share" size={16} /> {t('lobby.inviteByCode')}
          </button>
        </div>
        {shareMsg && <p className="invite-toast">{shareMsg}</p>}

        {invitable.length > 0 && (
          <div className="recent-row">
            <span className="settings-label"><span>{t('lobby.recentTogether')}</span></span>
            <div className="recent-list">
              {invitable.map((r) => (
                <button
                  key={r.uid}
                  className={`recent-chip${invited.has(r.uid) ? ' sent' : ''}`}
                  disabled={invited.has(r.uid)}
                  onClick={() => inviteRecent(r)}
                >
                  {r.photo
                    ? <img className="rc-ava" src={r.photo} alt="" />
                    : <span className="rc-ava rc-ph">{(r.name || 'И')[0]}</span>}
                  {shortName(r.name)}
                  {invited.has(r.uid)
                    ? <><Icon name="check" size={13} /> {t('lobby.invited')}</>
                    : <Icon name="share" size={13} />}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="settings">
          <span className="settings-label">
            <span>{t('lobby.myPacks')}</span>
            <span className="lab-count">{myPacks.length}</span>
          </span>
          <div className={`pack-toggles${manyPacks ? ' scroll' : ''}`}>
            {sortedPacks.map((p) => {
              const on = myPacks.includes(p.id);
              return (
                <button
                  key={p.id}
                  className={`pack-toggle${on ? ' on' : ''}`}
                  onClick={() => toggleMyPack(p.id)}
                >
                  <Icon name={p.icon} size={15} />
                  {packName(p, locale)}
                  {on && <span className="pt-tick"><Icon name="check" size={14} /></span>}
                </button>
              );
            })}
          </div>

          {isHost && (
            <>
              <span className="settings-label"><span>{t('lobby.rounds')}</span><span className="lab-count">{roundCount}</span></span>
              <input
                className="rounds-slider"
                type="range"
                min={MIN_ROUNDS}
                max={MAX_ROUNDS}
                value={roundCount}
                onChange={(e) => setLobbyRounds(code, parseInt(e.target.value, 10)).catch(() => {})}
                aria-label={t('lobby.rounds')}
              />

              <span className="settings-label"><span>{t('lobby.mode')}</span></span>
              <div className="seg">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    className={`seg-btn${mode === m.id ? ' on' : ''}`}
                    onClick={() => setLobbyMode(code, m.id).catch(() => {})}
                  >
                    <span className="seg-tick"><Icon name="check" size={15} /></span>
                    {t(m.key)}
                  </button>
                ))}
              </div>
              {mode === 'evolution' && (
                <p className="muted mode-hint">{t('lobby.evolutionHint')}</p>
              )}
            </>
          )}
        </div>

        {me.ready ? (
          <button className="btn btn-ghost" onClick={toggleReady}>{t('lobby.cancelReady')}</button>
        ) : (
          <button className="btn btn-primary" onClick={toggleReady}>
            <Icon name="check" size={18} /> {t('lobby.iAmReady')}
          </button>
        )}

        {isHost ? (
          <>
            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={!everyoneReady || starting || !hasPacks}
            >
              {starting ? t('lobby.loadingTracks') : <><Icon name="play" size={18} /> {t('lobby.start')}</>}
            </button>
            {!hasPacks && <p className="muted" style={{ marginTop: 8 }}>{t('lobby.pickAtLeastOne')}</p>}
          </>
        ) : (
          <div className="wait-note"><span className="dot" /> {t('lobby.waitHost')}</div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="leave-wrap">
          <button className="leave-link" onClick={handleLeave}><Icon name="logout" size={15} /> {t('lobby.leave')}</button>
        </div>
      </div>
    </div>
  );
}
