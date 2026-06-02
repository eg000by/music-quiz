import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLobby } from '../hooks/useLobby';
import { submitAnswer, revealRound, advanceRound } from '../services/lobby';
import { ROUND_MS, STAGES, stageForElapsed, pointsForElapsed } from '../services/scoring';
import { serverNow, syncClock } from '../services/clock';
import Icon from '../components/Icon';

export default function Game() {
  const { code } = useParams();
  const { user } = useAuth();
  const { lobby } = useLobby(code);
  const navigate = useNavigate();

  const audioRef = useRef(null);
  const [now, setNow] = useState(serverNow());
  const [myAnswer, setMyAnswer] = useState(null);
  const [needTap, setNeedTap] = useState(false);

  const current = lobby?.current;
  const round = current ? lobby?.rounds?.[current.index] : null;
  const isHost = lobby?.hostId === user?.uid;
  const phase = current?.phase;
  const idx = current?.index;

  // тикающие часы для прогресс-бара и этапов (серверное время — одинаково у обоих игроков)
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 100);
    return () => clearInterval(id);
  }, []);

  // измеряем смещение часов этого устройства относительно сервера для честного тайминга
  useEffect(() => {
    if (code && user?.uid) syncClock(code, user.uid);
  }, [code, user?.uid]);

  // сброс своего ответа при смене раунда + снятие фокуса с кнопки прошлого раунда
  useEffect(() => {
    setMyAnswer(null);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [idx]);

  // управление аудио
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !round || !current) return;

    if (phase === 'playing') {
      if (audio.src !== round.previewUrl) {
        audio.src = round.previewUrl;
      }
      const start = () => {
        const target = round.offset + Math.max(0, (serverNow() - current.startedAt) / 1000);
        try { audio.currentTime = target; } catch { /* ignore */ }
        audio.play().then(() => setNeedTap(false)).catch(() => setNeedTap(true));
      };
      if (audio.readyState >= 1) start();
      else audio.onloadedmetadata = start;
    } else {
      audio.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, phase]);

  // переход на экран результатов
  useEffect(() => {
    if (lobby?.status === 'finished') navigate(`/results/${code}`, { replace: true });
  }, [lobby?.status, code, navigate]);

  // === ХОСТ: смена фаз раунда ===
  const answers = lobby?.answers || {};
  const players = lobby?.players || {};
  const answerCount = Object.keys(answers).length;
  const playerCount = Object.keys(players).length;

  useEffect(() => {
    if (!isHost || !current || lobby?.status !== 'playing') return;
    let t;
    if (phase === 'playing') {
      const remaining = ROUND_MS - (serverNow() - current.startedAt) + 300;
      t = setTimeout(() => revealRound(code).catch(() => {}), Math.max(0, remaining));
    } else if (phase === 'reveal') {
      t = setTimeout(() => advanceRound(code).catch(() => {}), 4000);
    }
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, idx, phase, lobby?.status]);

  // ХОСТ: показать ответ раньше, если ответили все
  useEffect(() => {
    if (!isHost || !current || phase !== 'playing') return;
    if (answerCount >= playerCount && playerCount > 0) {
      const t = setTimeout(() => revealRound(code).catch(() => {}), 500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, answerCount, playerCount, phase, idx]);

  if (!lobby || lobby.status === 'loading') {
    return (
      <div className="screen center">
        <div className="spinner" />
        <p className="muted">Загружаем треки…</p>
      </div>
    );
  }
  if (!current || !round) {
    return <div className="screen center"><p className="muted">Подготовка…</p></div>;
  }

  const reveal = phase === 'reveal';
  const elapsed = reveal ? ROUND_MS : Math.min(ROUND_MS, now - current.startedAt);
  const stage = stageForElapsed(elapsed);
  const stageInfo = stage === -1 ? null : STAGES[stage];
  const progress = Math.min(100, (elapsed / ROUND_MS) * 100);
  const livePoints = pointsForElapsed(elapsed);

  const playerList = lobby.playerOrder.map((uid) => lobby.players[uid]).filter(Boolean);

  const pick = (i) => {
    if (myAnswer || reveal) return;
    const e = serverNow() - current.startedAt;
    const correct = i === round.correctIndex;
    const ans = {
      choice: i,
      atMs: Math.round(e),
      points: correct ? pointsForElapsed(e) : 0,
      correct,
    };
    setMyAnswer(ans);
    submitAnswer(code, user.uid, ans).catch(() => {});
  };

  const resumeAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => setNeedTap(false)).catch(() => {});
  };

  return (
    <div className="screen game">
      <audio ref={audioRef} preload="auto" />

      <header className="game-head">
        <span className="round-counter">Раунд {current.index + 1} / {lobby.totalRounds}</span>
        <div className="scores">
          {playerList.map((p) => (
            <span key={p.uid} className="score-chip">
              {p.name.split(' ')[0]}: <b>{p.score}</b>
            </span>
          ))}
        </div>
      </header>

      <main className="game-main">
        {/* Обложка скрыта во время угадывания */}
        <div className="cover">
          {reveal && round.artwork ? (
            <img src={round.artwork} alt="" />
          ) : (
            <div className="cover-ph">{reveal ? <Icon name="music" size={88} /> : '?'}</div>
          )}
        </div>

        {!reveal && (
          <>
            <div className="stage-label">
              {stageInfo ? (
                <>{stageInfo.label} · <b>{livePoints}</b> очков</>
              ) : (
                <>Время вышло</>
              )}
            </div>
            <div className="progress">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
              {STAGES.slice(0, 2).map((s, i) => (
                <div key={i} className="marker" style={{ left: `${(s.maxMs / ROUND_MS) * 100}%` }} />
              ))}
            </div>
          </>
        )}

        {reveal && (
          <div className="reveal-info">
            <div className="reveal-title">{round.title}</div>
            <div className="reveal-artist">{round.artist}</div>
          </div>
        )}

        <div className="options">
          {round.options.map((opt, i) => {
            let cls = 'option';
            if (reveal) {
              if (i === round.correctIndex) cls += ' correct';
              else if (myAnswer && myAnswer.choice === i) cls += ' wrong';
            } else if (myAnswer && myAnswer.choice === i) {
              cls += ' picked';
            }
            return (
              <button
                key={i}
                className={cls}
                onClick={(e) => { e.currentTarget.blur(); pick(i); }}
                disabled={!!myAnswer || reveal}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {!reveal && myAnswer && (
          <p className="muted waiting">Ответ принят. Ждём соперника…</p>
        )}

        {reveal && (
          <div className="round-results">
            {playerList.map((p) => {
              const a = answers[p.uid];
              return (
                <div key={p.uid} className="rr-row">
                  <span>{p.name.split(' ')[0]}</span>
                  {a ? (
                    <span className={a.correct ? 'ok' : 'bad'}>
                      {a.correct ? `+${a.points} (${(a.atMs / 1000).toFixed(1)}с)` : 'мимо'}
                    </span>
                  ) : (
                    <span className="bad">не успел</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {needTap && !reveal && (
        <button className="tap-overlay" onClick={resumeAudio}>
          <Icon name="play" size={15} /> Нажми, чтобы слушать
        </button>
      )}
    </div>
  );
}
