import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLobby } from '../hooks/useLobby';
import { resetLobby } from '../services/lobby';
import Icon from '../components/Icon';
import trophy from '../assets/illustrations/trophy.svg';

function statsForPlayer(log, uid) {
  let correct = 0;
  let totalTime = 0;
  let fast = 0; // ответы на этапе 1
  let answered = 0;
  for (const r of log) {
    const a = r.answers?.[uid];
    if (!a) continue;
    if (a.correct) {
      correct += 1;
      totalTime += a.atMs;
      answered += 1;
      if (a.atMs < 3000) fast += 1;
    }
  }
  return {
    correct,
    fast,
    avgTime: answered ? totalTime / answered : null,
  };
}

export default function Results() {
  const { code } = useParams();
  const { user } = useAuth();
  const { lobby, loading } = useLobby(code);
  const navigate = useNavigate();

  if (loading) return <div className="screen center"><div className="spinner" /></div>;
  if (!lobby) {
    return (
      <div className="screen center">
        <div className="card center-card">
          <p>Игра не найдена.</p>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>На главную</button>
        </div>
      </div>
    );
  }

  const isHost = lobby.hostId === user.uid;
  const log = lobby.log || [];
  const players = lobby.playerOrder
    .map((uid) => lobby.players[uid])
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const winner = players.length > 0 ? players[0] : null;
  const tie = players.length === 2 && players[0].score === players[1].score;

  const handleAgain = async () => {
    await resetLobby(code).catch(() => {});
    navigate(`/lobby/${code}`);
  };

  return (
    <div className="screen center">
      <div className="card results-card">
        <div className="results-illo"><img src={trophy} alt="" /></div>
        <span className="eyebrow">{tie ? 'Итог матча' : 'Победитель'}</span>
        <h1>{tie ? 'Ничья!' : `Победил ${winner?.name?.split(' ')[0]}`}</h1>

        <div className="results-grid">
          {players.map((p) => {
            const s = statsForPlayer(log, p.uid);
            return (
              <div key={p.uid} className={`result-col ${p.uid === winner?.uid && !tie ? 'winner' : ''}`}>
                <div className="result-head">
                  {p.photo ? <img src={p.photo} alt="" className="avatar" /> : <div className="avatar ph">{p.name[0]}</div>}
                  <span>{p.name.split(' ')[0]}</span>
                </div>
                <div className="big-score">{p.score}</div>
                <div className="stat-line"><span>Угадано</span><b>{s.correct} / {log.length}</b></div>
                <div className="stat-line"><span>Молниеносных (≤3с)</span><b>{s.fast}</b></div>
                <div className="stat-line">
                  <span>Среднее время</span>
                  <b>{s.avgTime != null ? `${(s.avgTime / 1000).toFixed(1)}с` : '—'}</b>
                </div>
              </div>
            );
          })}
        </div>

        <div className="results-actions">
          {isHost ? (
            <button className="btn btn-primary" onClick={handleAgain}><Icon name="rotate" size={18} /> Играть снова</button>
          ) : (
            <p className="muted">Хост может запустить новую игру</p>
          )}
          <button className="btn btn-secondary" onClick={() => navigate('/')}>На главную</button>
        </div>
      </div>
    </div>
  );
}
