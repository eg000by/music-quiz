import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLobby } from '../hooks/useLobby';
import { resetLobby } from '../services/lobby';
import { recordGameResult } from '../services/users';
import { shareOrCopy } from '../services/share';
import { track } from '../services/analytics';
import { STAGES } from '../services/scoring';
import { getPack } from '../data/packs';
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
      if (a.atMs < STAGES[0].maxMs) fast += 1;
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
  const { user, signIn } = useAuth();
  const { lobby, loading } = useLobby(code);
  const navigate = useNavigate();
  const recordedRef = useRef(false);
  const [shareMsg, setShareMsg] = useState('');

  // Записываем результат партии в таблицу лидеров (один раз за gameId).
  useEffect(() => {
    if (!lobby || lobby.status !== 'finished' || !lobby.gameId || recordedRef.current) return;
    const players = lobby.players || {};
    const me = players[user.uid];
    if (!me) return;
    const maxScore = Math.max(...Object.values(players).map((p) => p.score || 0));
    recordedRef.current = true;
    track('game_finish', {
      score: me.score || 0,
      solo: Object.keys(players).length === 1,
      won: me.score === maxScore,
    });
    recordGameResult(user, lobby.gameId, me.score || 0, me.score === maxScore).catch(() => {});
  }, [lobby, user]);

  // хост нажал «Играть снова» (resetLobby → status waiting) — возвращаем в лобби всех,
  // не только хоста; заодно убираем мелькание «Ничья!» из-за обнулённого счёта
  useEffect(() => {
    if (lobby?.status === 'waiting') navigate(`/lobby/${code}`, { replace: true });
  }, [lobby?.status, code, navigate]);

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
  // ничья, если за первое место несколько игроков с одинаковым счётом
  const tie = players.length > 1 && players.filter((p) => p.score === winner.score).length > 1;
  const solo = players.length === 1;
  const rounds = log.length;
  const scoreLine = players.map((p) => p.score).join(' : ');
  const soloPacks = solo
    ? (players[0].packs || []).map((id) => getPack(id)?.name).filter(Boolean).join(', ')
    : '';

  // Гость нажал «сохранить результат»: вход через Google привязывается к тому же uid,
  // после чего разрешаем эффекту записать результат этой партии под аккаунтом.
  const handleSignInToSave = async () => {
    try {
      await signIn();
      recordedRef.current = false;
    } catch { /* отменили вход — ничего не делаем */ }
  };

  const handleAgain = async () => {
    await resetLobby(code).catch(() => {});
    navigate(`/lobby/${code}`);
  };

  const handleShareResult = async () => {
    const myScore = lobby.players[user.uid]?.score || 0;
    const res = await shareOrCopy({
      title: 'Музыкальная викторина',
      text: `Я набрал ${myScore} очков в музыкальной викторине! А ты сможешь лучше?`,
      url: window.location.origin,
    });
    if (res === 'copied') setShareMsg('Ссылка скопирована');
    else if (res === 'failed') setShareMsg('Не удалось поделиться');
    else setShareMsg('');
    if (res === 'copied' || res === 'failed') setTimeout(() => setShareMsg(''), 2500);
    if (res !== 'failed') track('share', { content_type: 'result', method: res });
  };

  return (
    <div className="screen center">
      <div className="card results-card">
        <div className="results-illo"><img src={trophy} alt="" /></div>

        {solo ? (
          <>
            <span className="eyebrow">Партия окончена</span>
            <h1>{players[0].score} очков</h1>
            <p className="sub-line">{rounds} раундов{soloPacks && ` · ${soloPacks}`}</p>
          </>
        ) : tie ? (
          <>
            <span className="eyebrow">Итог матча</span>
            <h1>Ничья!</h1>
            <p className="sub-line">{scoreLine} · {rounds} раундов</p>
          </>
        ) : (
          <>
            <span className="eyebrow">Победитель</span>
            <h1><span className="winner-name">{winner.name.split(' ')[0]}</span></h1>
            <p className="sub-line">{scoreLine} · {rounds} раундов</p>
          </>
        )}

        <div className={`results-grid${players.length > 1 ? ' two' : ''}`}>
          {players.map((p, idx) => {
            const s = statsForPlayer(log, p.uid);
            const isWinner = !tie && p.uid === winner.uid;
            return (
              <div key={p.uid} className={`result-col${isWinner || solo ? ' winner' : ''}`}>
                {!solo && (
                  <>
                    <div className="result-head">
                      {p.photo
                        ? <img src={p.photo} alt="" className="avatar" />
                        : <span className={`avatar ph${idx > 0 ? ' flame' : ''}`}>{(p.name || 'И')[0]}</span>}
                      {p.name.split(' ')[0]}
                      {isWinner && <Icon name="crown" size={14} className="crown" />}
                    </div>
                    <div className="big-score">{p.score}</div>
                  </>
                )}
                <div className="stat-line"><span>Угадано</span><b>{s.correct} / {rounds}</b></div>
                <div className="stat-line"><span>Молниеносных</span><b>{s.fast}</b></div>
                <div className="stat-line">
                  <span>Среднее время</span>
                  <b>{s.avgTime != null ? `${(s.avgTime / 1000).toFixed(1)}с` : '—'}</b>
                </div>
              </div>
            );
          })}
        </div>

        {user.isAnonymous && (
          <div className="save-cta">
            <p className="muted">Войди через Google, чтобы сохранить результат и попасть в таблицу лидеров.</p>
            <button className="btn btn-google" onClick={handleSignInToSave}>
              <span className="g">G</span> Сохранить результат
            </button>
          </div>
        )}

        <div className="actions">
          {isHost ? (
            <button className="btn btn-primary" onClick={handleAgain}><Icon name="rotate" size={18} /> Играть снова</button>
          ) : (
            <p className="muted">Хост может запустить новую игру</p>
          )}
          <button className="btn btn-outline" onClick={() => navigate('/')}><Icon name="home" size={18} /> На главную</button>
        </div>

        <button className="share-link" onClick={handleShareResult}><Icon name="share" size={15} /> Поделиться результатом</button>
        {shareMsg && <p className="share-toast">{shareMsg}</p>}
      </div>
    </div>
  );
}
