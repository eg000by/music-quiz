import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLobby } from '../hooks/useLobby';
import { getPack, PACKS } from '../data/packs';
import {
  setReady,
  startGame,
  leaveLobby,
  setLobbyRounds,
  setLobbyMode,
  togglePlayerPack,
  combinedSongs,
} from '../services/lobby';
import { syncClock } from '../services/clock';
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

  if (loading) {
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

  const isHost = lobby.hostId === user.uid;
  const players = lobby.playerOrder.map((uid) => lobby.players[uid]).filter(Boolean);
  const me = lobby.players[user.uid];
  const myPacks = me?.packs || [];
  const roundCount = lobby.roundCount || 8;
  const mode = lobby.mode || 'normal';
  const everyoneReady = players.length >= 1 && players.every((p) => p.ready);

  // объединённый пул паков всех игроков
  const selectedPackIds = new Set();
  players.forEach((p) => (p.packs || []).forEach((id) => selectedPackIds.add(id)));
  const poolSongs = combinedSongs(lobby).length;
  const hasPacks = selectedPackIds.size > 0;

  const toggleReady = () => setReady(code, user.uid, !me.ready).catch(() => {});
  const toggleMyPack = (packId) =>
    togglePlayerPack(code, user.uid, packId, !myPacks.includes(packId)).catch(() => {});

  const handleLeave = async () => {
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
        <p className="muted pack-line">
          {hasPacks
            ? `В игре: ${poolSongs} песен · ${roundCount} раундов`
            : `Выберите паки · ${roundCount} раундов`}
          {mode === 'evolution' && ' · режим: Эволюция трека'}
        </p>

        <div className="players-list">
          {players.map((p) => (
            <div key={p.uid} className="player-row">
              {p.photo ? <img src={p.photo} alt="" className="avatar" /> : <div className="avatar ph">{p.name[0]}</div>}
              <div className="player-main">
                <span className="player-name">
                  {p.name}{p.uid === lobby.hostId && <Icon name="crown" size={15} className="host-mark" />}
                </span>
                <div className="player-packs">
                  {(p.packs || []).length === 0
                    ? <span className="muted no-packs">паки не выбраны</span>
                    : (p.packs || []).map((id) => {
                        const pk = getPack(id);
                        return pk ? (
                          <span key={id} className="pack-chip"><Icon name={pk.icon} size={12} /> {pk.name}</span>
                        ) : null;
                      })}
                </div>
              </div>
              <span className={`ready-badge ${p.ready ? 'on' : ''}`}>{p.ready ? 'готов' : 'не готов'}</span>
            </div>
          ))}
          {players.length < 4 && (
            <div className="player-row empty">Ждём игроков… (до 4)</div>
          )}
        </div>

        <div className="lobby-settings">
          <span className="settings-label">Мои паки (объединяются у всех)</span>
          <div className="pack-grid">
            {PACKS.map((p) => (
              <button
                key={p.id}
                className={`pack ${myPacks.includes(p.id) ? 'pack-active' : ''}`}
                onClick={() => toggleMyPack(p.id)}
              >
                <span className="pack-emoji"><Icon name={p.icon} size={21} /></span>
                <span className="pack-name">{p.name}</span>
                <span className="pack-count">{p.songs.length} песен</span>
              </button>
            ))}
          </div>

          {isHost && (
            <>
              <span className="settings-label">Раундов: {roundCount}</span>
              <input
                className="rounds-slider"
                type="range"
                min={MIN_ROUNDS}
                max={MAX_ROUNDS}
                value={roundCount}
                onChange={(e) => setLobbyRounds(code, parseInt(e.target.value, 10)).catch(() => {})}
                aria-label="Количество раундов"
              />

              <span className="settings-label">Режим</span>
              <div className="rounds-row">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    className={`round-opt mode-opt ${mode === m.id ? 'on' : ''}`}
                    onClick={() => setLobbyMode(code, m.id).catch(() => {})}
                  >
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

        <button className={`btn ${me.ready ? 'btn-secondary' : 'btn-primary'}`} onClick={toggleReady}>
          {me.ready ? 'Отменить готовность' : <><Icon name="check" size={18} /> Я готов</>}
        </button>

        {isHost && (
          <button
            className="btn btn-primary"
            onClick={handleStart}
            disabled={!everyoneReady || starting || !hasPacks}
          >
            {starting ? 'Загрузка треков…' : <><Icon name="play" size={18} /> Начать игру</>}
          </button>
        )}
        {isHost && !hasPacks && <p className="muted">Нужно выбрать хотя бы один пак</p>}
        {!isHost && <p className="muted">Хост запустит игру, когда все будут готовы</p>}

        {error && <div className="error">{error}</div>}
        <button className="btn-link" onClick={handleLeave}>выйти из лобби</button>
      </div>
    </div>
  );
}
