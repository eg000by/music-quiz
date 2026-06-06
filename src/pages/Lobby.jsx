import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLobby } from '../hooks/useLobby';
import { getPack, PACKS } from '../data/packs';
import {
  setReady,
  startGame,
  joinLobby,
  leaveLobby,
  setLobbyRounds,
  setLobbyMode,
  togglePlayerPack,
  combinedSongs,
} from '../services/lobby';
import { syncClock } from '../services/clock';
import { shareOrCopy } from '../services/share';
import Icon from '../components/Icon';

const MIN_ROUNDS = 3;
const MAX_ROUNDS = 15;
const MODES = [
  { id: 'normal', label: 'Обычный' },
  { id: 'evolution', label: 'Эволюция трека' },
];

export default function Lobby() {
  const { code } = useParams();
  const { user } = useAuth();
  const { lobby, loading } = useLobby(code);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [leaving, setLeaving] = useState(false);
  const joiningRef = useRef(false);
  const leavingRef = useRef(false);

  // Заход по ссылке-приглашению (/lobby/CODE) ведёт сюда напрямую, минуя join с
  // главной. Если игрока ещё нет в составе — добавляем его сам (один раз).
  useEffect(() => {
    if (!lobby || !user?.uid || leavingRef.current) return;
    if (lobby.players?.[user.uid]) { joiningRef.current = false; return; }
    if (joiningRef.current) return;
    joiningRef.current = true;
    joinLobby(code, user).catch((e) => setError(e.message || 'Не удалось войти в лобби'));
  }, [lobby, user, code]);

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
      title: 'Музыкальная викторина',
      text: `Заходи в музыкальную викторину! Код лобби: ${code}`,
      url,
    });
    if (res === 'copied') setShareMsg('Ссылка скопирована — отправь другу');
    else if (res === 'failed') setShareMsg('Не удалось поделиться');
    else setShareMsg('');
    if (res === 'copied' || res === 'failed') setTimeout(() => setShareMsg(''), 2500);
  };

  if (loading || leaving) {
    return <div className="screen center"><div className="spinner" /></div>;
  }
  if (!lobby) {
    return (
      <div className="screen center">
        <div className="card center-card">
          <p>Лобби не найдено.</p>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>На главную</button>
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
            <button className="btn btn-secondary" onClick={() => navigate('/')}>На главную</button>
          </div>
        ) : (
          <>
            <div className="spinner" />
            <p className="muted">Входим в лобби…</p>
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
      setError(e.message || 'Ошибка запуска');
      setStarting(false);
    }
  };

  return (
    <div className="screen center">
      <div className="card lobby-card">
        <span className="eyebrow">Код лобби</span>
        <div className="code-display">{lobby.code}</div>
        <p className="meta-line">
          {hasPacks
            ? `В игре: ${poolSongs} песен · ${roundCount} раундов`
            : `Выбери паки · ${roundCount} раундов`}
          {mode === 'evolution' && ' · Эволюция трека'}
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
                    ? <span className="no-packs">паки не выбраны</span>
                    : (p.packs || []).map((id) => {
                        const pk = getPack(id);
                        return pk ? (
                          <span key={id} className="pack-chip"><Icon name={pk.icon} size={12} /> {pk.name}</span>
                        ) : null;
                      })}
                </div>
              </div>
              <span className={`ready-badge${p.ready ? ' on' : ''}`}>{p.ready ? 'готов' : 'не готов'}</span>
            </div>
          ))}

          <button className="invite-row" onClick={handleShareInvite}>
            <Icon name="share" size={16} /> Позвать друзей по коду
          </button>
        </div>
        {shareMsg && <p className="invite-toast">{shareMsg}</p>}

        <div className="settings">
          <span className="settings-label">
            <span>Мои паки · объединяются у всех</span>
            <span className="lab-count">{myPacks.length}</span>
          </span>
          <div className={`pack-toggles${manyPacks ? ' scroll' : ''}`}>
            {PACKS.map((p) => {
              const on = myPacks.includes(p.id);
              return (
                <button
                  key={p.id}
                  className={`pack-toggle${on ? ' on' : ''}`}
                  onClick={() => toggleMyPack(p.id)}
                >
                  <Icon name={p.icon} size={15} />
                  {p.name}
                  {on && <span className="pt-tick"><Icon name="check" size={14} /></span>}
                </button>
              );
            })}
          </div>

          {isHost && (
            <>
              <span className="settings-label"><span>Раундов</span><span className="lab-count">{roundCount}</span></span>
              <input
                className="rounds-slider"
                type="range"
                min={MIN_ROUNDS}
                max={MAX_ROUNDS}
                value={roundCount}
                onChange={(e) => setLobbyRounds(code, parseInt(e.target.value, 10)).catch(() => {})}
                aria-label="Количество раундов"
              />

              <span className="settings-label"><span>Режим</span></span>
              <div className="seg">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    className={`seg-btn${mode === m.id ? ' on' : ''}`}
                    onClick={() => setLobbyMode(code, m.id).catch(() => {})}
                  >
                    <span className="seg-tick"><Icon name="check" size={15} /></span>
                    {m.label}
                  </button>
                ))}
              </div>
              {mode === 'evolution' && (
                <p className="muted mode-hint">Трек звучит глухо и проясняется к концу раунда — угадывай раньше.</p>
              )}
            </>
          )}
        </div>

        {me.ready ? (
          <button className="btn btn-ghost" onClick={toggleReady}>Отменить готовность</button>
        ) : (
          <button className="btn btn-primary" onClick={toggleReady}>
            <Icon name="check" size={18} /> Я готов
          </button>
        )}

        {isHost ? (
          <>
            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={!everyoneReady || starting || !hasPacks}
            >
              {starting ? 'Загрузка треков…' : <><Icon name="play" size={18} /> Начать игру</>}
            </button>
            {!hasPacks && <p className="muted" style={{ marginTop: 8 }}>Выбери хотя бы один пак</p>}
          </>
        ) : (
          <div className="wait-note"><span className="dot" /> Хост запустит игру, когда все будут готовы</div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="leave-wrap">
          <button className="leave-link" onClick={handleLeave}><Icon name="logout" size={15} /> Выйти из лобби</button>
        </div>
      </div>
    </div>
  );
}
