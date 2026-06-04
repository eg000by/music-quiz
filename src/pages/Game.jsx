import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLobby } from '../hooks/useLobby';
import { submitAnswer, revealRound, advanceRound } from '../services/lobby';
import { ROUND_MS, STAGES, stageForElapsed, pointsForElapsed, BOTH_ANSWERED_EXTRA_MS, REVEAL_MS } from '../services/scoring';
import { serverNow, syncClock } from '../services/clock';
import { EvolutionPlayer, preload as preloadBuffer } from '../services/audioEngine';
import Icon from '../components/Icon';

export default function Game() {
  const { code } = useParams();
  const { user } = useAuth();
  const { lobby } = useLobby(code);
  const navigate = useNavigate();

  const audioRef = useRef(null);
  const engineRef = useRef(null);
  const [now, setNow] = useState(serverNow());
  const [myAnswer, setMyAnswer] = useState(null);
  const [needTap, setNeedTap] = useState(false);
  const [volume, setVolume] = useState(() => {
    const v = parseFloat(localStorage.getItem('mq_volume'));
    return Number.isFinite(v) ? v : 1;
  });
  const prevVolRef = useRef(volume || 1);

  const current = lobby?.current;
  const round = current ? lobby?.rounds?.[current.index] : null;
  const isHost = lobby?.hostId === user?.uid;
  const phase = current?.phase;
  const idx = current?.index;
  const mode = lobby?.mode || 'normal';

  const getEngine = () => {
    if (!engineRef.current) engineRef.current = new EvolutionPlayer();
    return engineRef.current;
  };

  // тикающие часы для прогресс-бара и этапов (серверное время — одинаково у обоих игроков)
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 100);
    return () => clearInterval(id);
  }, []);

  // громкость — у каждого своя, применяем к аудио/движку и сохраняем в браузере
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (engineRef.current) engineRef.current.setVolume(volume);
    localStorage.setItem('mq_volume', String(volume));
  }, [volume]);

  // освобождаем аудио-движок при выходе из игры
  useEffect(() => () => { if (engineRef.current) engineRef.current.dispose(); }, []);

  // измеряем смещение часов этого устройства относительно сервера для честного тайминга
  useEffect(() => {
    if (code && user?.uid) syncClock(code, user.uid);
  }, [code, user?.uid]);

  // сброс своего ответа при смене раунда + снятие фокуса с кнопки прошлого раунда
  useEffect(() => {
    setMyAnswer(null);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [idx]);

  // управление аудио (два пути: обычный <audio> и движок «Эволюция трека»)
  useEffect(() => {
    if (!round || !current) return;

    if (mode === 'evolution') {
      const engine = getEngine();
      if (phase === 'playing') {
        engine.setVolume(volume);
        engine.play(round.previewUrl, {
          elapsedMs: serverNow() - current.startedAt,
          roundMs: ROUND_MS,
          offsetSec: round.offset,
        }).then((ok) => setNeedTap(!ok));
      } else if (phase === 'reveal') {
        engine.reveal();
      } else {
        engine.stop();
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    if (phase === 'playing') {
      if (audio.src !== round.previewUrl) {
        audio.src = round.previewUrl;
      }
      const seek = () => {
        const t = round.offset + Math.max(0, (serverNow() - current.startedAt) / 1000);
        try { audio.currentTime = t; } catch { /* ignore */ }
      };
      audio.volume = volume;
      seek();
      // play() сразу: на iOS метаданные не грузятся без жеста, поэтому ждать их нельзя.
      // Если автоплей заблокирован — поймаем ошибку и покажем кнопку «нажми, чтобы слушать».
      audio.play().then(() => { setNeedTap(false); seek(); }).catch(() => setNeedTap(true));
    } else if (phase === 'reveal') {
      // на показе ответа песня доигрывает ещё пару секунд, не обрываясь резко
    } else {
      audio.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, phase, mode]);

  // в режиме эволюции заранее декодируем следующий трек, чтобы раунд начался без паузы
  useEffect(() => {
    if (mode !== 'evolution' || !lobby?.rounds) return;
    const next = lobby.rounds[idx + 1];
    if (next?.previewUrl) preloadBuffer(next.previewUrl).catch(() => {});
  }, [idx, mode, lobby?.rounds]);

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
      t = setTimeout(() => advanceRound(code).catch(() => {}), REVEAL_MS);
    }
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, idx, phase, lobby?.status]);

  // ХОСТ: когда ответили все — даём ещё несколько секунд (можно поменять ответ),
  // затем показываем правильный ответ.
  useEffect(() => {
    if (!isHost || !current || phase !== 'playing') return;
    if (answerCount >= playerCount && playerCount > 0) {
      const t = setTimeout(() => revealRound(code).catch(() => {}), BOTH_ANSWERED_EXTRA_MS);
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
    if (reveal) return;
    if (myAnswer && myAnswer.choice === i) return; // тот же вариант — ничего не меняем
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
    if (mode === 'evolution') {
      getEngine().play(round.previewUrl, {
        elapsedMs: serverNow() - current.startedAt,
        roundMs: ROUND_MS,
        offsetSec: round.offset,
      }).then((ok) => setNeedTap(!ok));
      return;
    }
    const audio = audioRef.current;
    if (!audio || !round || !current) return;
    if (audio.src !== round.previewUrl) audio.src = round.previewUrl;
    audio.volume = volume;
    const seek = () => {
      const t = round.offset + Math.max(0, (serverNow() - current.startedAt) / 1000);
      try { audio.currentTime = t; } catch { /* ignore */ }
    };
    seek();
    audio.play().then(() => { setNeedTap(false); seek(); }).catch(() => {});
  };

  const toggleMute = () => {
    setVolume((v) => {
      if (v > 0) { prevVolRef.current = v; return 0; }
      return prevVolRef.current || 1;
    });
  };

  return (
    <div className="screen game">
      <audio ref={audioRef} preload="auto" playsInline />

      <header className="game-head">
        <span className="round-counter">Раунд {current.index + 1} / {lobby.totalRounds}</span>
        <div className="vol">
          <button className="vol-btn" onClick={toggleMute} aria-label="Громкость">
            <Icon name={volume === 0 ? 'volumeX' : 'volume'} size={18} />
          </button>
          <input
            className="vol-slider"
            type="range" min="0" max="1" step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            aria-label="Уровень громкости"
          />
        </div>
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
            {mode === 'evolution' && (
              <div className="muted clarity-hint">
                <Icon name="volume" size={14} /> Эволюция трека · чёткость {Math.round(progress)}%
              </div>
            )}
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
                disabled={reveal}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {!reveal && myAnswer && (
          <p className="muted waiting">
            {answerCount >= playerCount && playerCount > 0
              ? 'Все ответили — ещё можно передумать!'
              : 'Ответ принят, можно поменять. Ждём остальных…'}
          </p>
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
