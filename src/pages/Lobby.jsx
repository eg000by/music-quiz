import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLobby } from '../hooks/useLobby';
import { getPack, PACKS } from '../data/packs';
import { setReady, startGame, leaveLobby, setLobbyPack, setLobbyRounds } from '../services/lobby';
import { syncClock } from '../services/clock';
import Icon from '../components/Icon';

const ROUND_OPTIONS = [5, 8, 10];

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
  const pack = getPack(lobby.packId);
  const roundCount = lobby.roundCount || 8;
  const everyoneReady = players.length >= 1 && players.every((p) => p.ready);

  const toggleReady = () => setReady(code, user.uid, !me.ready).catch(() => {});

  const handleLeave = async () => {
    await leaveLobby(code, user.uid).catch(() => {});
    navigate('/');
  };

  const handleStart = async () => {
    setError('');
    setStarting(true);
    try {
      await startGame(code, pack, roundCount);
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
        <p className="muted pack-line">{pack && <Icon name={pack.icon} size={15} />} {lobby.packName} · {roundCount} раундов</p>

        {isHost ? (
          <div className="lobby-settings">
            <span className="settings-label">Пак музыки</span>
            <div className="pack-grid">
              {PACKS.map((p) => (
                <button
                  key={p.id}
                  className={`pack ${lobby.packId === p.id ? 'pack-active' : ''}`}
                  onClick={() => setLobbyPack(code, p).catch(() => {})}
                >
                  <span className="pack-emoji"><Icon name={p.icon} size={21} /></span>
                  <span className="pack-name">{p.name}</span>
                  <span className="pack-count">{p.songs.length} песен</span>
                </button>
              ))}
            </div>

            <span className="settings-label">Раундов</span>
            <div className="rounds-row">
              {ROUND_OPTIONS.map((n) => (
                <button
                  key={n}
                  className={`round-opt ${roundCount === n ? 'on' : ''}`}
                  onClick={() => setLobbyRounds(code, n).catch(() => {})}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="muted">Пак и число раундов выбирает хост</p>
        )}

        <div className="players-list">
          {players.map((p) => (
            <div key={p.uid} className="player-row">
              {p.photo ? <img src={p.photo} alt="" className="avatar" /> : <div className="avatar ph">{p.name[0]}</div>}
              <span className="player-name">{p.name}{p.uid === lobby.hostId && <Icon name="crown" size={15} className="host-mark" />}</span>
              <span className={`ready-badge ${p.ready ? 'on' : ''}`}>{p.ready ? 'готов' : 'не готов'}</span>
            </div>
          ))}
          {players.length < 2 && (
            <div className="player-row empty">Ждём второго игрока…</div>
          )}
        </div>

        <button className={`btn ${me.ready ? 'btn-secondary' : 'btn-primary'}`} onClick={toggleReady}>
          {me.ready ? 'Отменить готовность' : <><Icon name="check" size={18} /> Я готов</>}
        </button>

        {isHost && (
          <button
            className="btn btn-primary"
            onClick={handleStart}
            disabled={!everyoneReady || starting}
          >
            {starting ? 'Загрузка треков…' : <><Icon name="play" size={18} /> Начать игру</>}
          </button>
        )}
        {!isHost && <p className="muted">Хост запустит игру, когда все будут готовы</p>}

        {error && <div className="error">{error}</div>}
        <button className="btn-link" onClick={handleLeave}>выйти из лобби</button>
      </div>
    </div>
  );
}
