import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLobby } from '../hooks/useLobby';
import { submitAnswer, revealRound, advanceRound, pauseRound, resumeRound, shortName } from '../services/lobby';
import { ROUND_MS, STAGES, stageForElapsed, pointsForElapsed, BOTH_ANSWERED_EXTRA_MS, REVEAL_MS, MIN_YEAR, yearPoints } from '../services/scoring';
import { serverNow, syncClock } from '../services/clock';
import { EvolutionPlayer, preload as preloadBuffer, unlockAudio } from '../services/audioEngine';
import { useT } from '../i18n';
import Icon from '../components/Icon';

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_YEAR = 2010; // стартовое положение ползунка года (большинство треков из этой эпохи)

// Границы шкалы лет на reveal. При кучных ответах (все попали рядом с правильным
// годом) полная шкала 1950–сегодня слепляет маркеры в одну точку — поэтому зумим
// окно вокруг ответов: отступы по краям, минимум 10 лет, границы кратны 5
// (например, трек 2011 и ответы 2009–2011 дадут окно 2005–2015). Если разброс
// и так почти во всю шкалу — оставляем полную.
function yearScaleBounds(target, guesses) {
  const years = [target, ...guesses];
  let lo = Math.min(...years);
  let hi = Math.max(...years);
  const pad = Math.max(2, Math.round((hi - lo) * 0.25));
  lo -= pad;
  hi += pad;
  const MIN_WINDOW = 10;
  if (hi - lo < MIN_WINDOW) {
    const extra = MIN_WINDOW - (hi - lo);
    lo -= Math.ceil(extra / 2);
    hi += Math.floor(extra / 2);
  }
  lo = Math.max(MIN_YEAR, Math.floor(lo / 5) * 5);
  hi = Math.min(CURRENT_YEAR, Math.ceil(hi / 5) * 5);
  if (hi - lo > (CURRENT_YEAR - MIN_YEAR) * 0.7) return [MIN_YEAR, CURRENT_YEAR];
  return [lo, hi];
}

export default function Game() {
  const { code } = useParams();
  const { user } = useAuth();
  const { lobby } = useLobby(code);
  const navigate = useNavigate();
  const t = useT();

  const audioRef = useRef(null);
  const engineRef = useRef(null);
  const [now, setNow] = useState(serverNow());
  const [myAnswer, setMyAnswer] = useState(null);
  const [yearGuess, setYearGuess] = useState(DEFAULT_YEAR);
  const [needTap, setNeedTap] = useState(false);
  const [volume, setVolume] = useState(() => {
    const v = parseFloat(localStorage.getItem('mq_volume'));
    return Number.isFinite(v) ? v : 1;
  });
  const prevVolRef = useRef(volume || 1);
  const yearTimerRef = useRef(null);
  const myAnswerRef = useRef(null);

  const current = lobby?.current;
  const round = current ? lobby?.rounds?.[current.index] : null;
  const isHost = lobby?.hostId === user?.uid;
  const phase = current?.phase;
  const idx = current?.index;
  const mode = lobby?.mode || 'normal';
  const paused = !!current?.pausedAt;

  // reveal инициирует только хост и ровно один раз за раунд (оба таймера ниже могут
  // сработать почти одновременно — этот guard не даёт начислить очки дважды).
  const revealFiredRef = useRef(-1);
  const fireReveal = (roundIdx) => {
    if (revealFiredRef.current === roundIdx) return;
    revealFiredRef.current = roundIdx;
    revealRound(code).catch(() => {});
  };

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

  // iOS: разблокируем Web Audio на первом касании/клике в игре (для режима «Эволюция»)
  useEffect(() => {
    const h = () => unlockAudio();
    document.addEventListener('touchend', h, { once: true });
    document.addEventListener('click', h, { once: true });
    return () => {
      document.removeEventListener('touchend', h);
      document.removeEventListener('click', h);
    };
  }, []);

  // измеряем смещение часов этого устройства относительно сервера для честного тайминга
  useEffect(() => {
    if (code && user?.uid) syncClock(code, user.uid);
  }, [code, user?.uid]);

  // сброс своего ответа при смене раунда + снятие фокуса с кнопки прошлого раунда
  useEffect(() => {
    setMyAnswer(null);
    setYearGuess(DEFAULT_YEAR);
    if (yearTimerRef.current) clearTimeout(yearTimerRef.current);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [idx]);

  // держим актуальный ответ в ref — чтобы отложенное сохранение года не затирало
  // только что выбранное название и не зависело от устаревшего замыкания
  useEffect(() => { myAnswerRef.current = myAnswer; }, [myAnswer]);

  // управление аудио (два пути: обычный <audio> и движок «Эволюция трека»)
  useEffect(() => {
    if (!round || !current) return;

    if (mode === 'evolution') {
      const engine = getEngine();
      if (phase === 'playing') {
        if (paused) { engine.stop(); return; }
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
      if (paused) { audio.pause(); return; }
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
  }, [idx, phase, mode, paused]);

  // Прелоад следующего раунда, чтобы он начинался без буферизации (на медленной
  // сети иначе теряются первые «дорогие» секунды): эволюция декодирует буфер,
  // обычный режим прогревает HTTP-кэш — <audio> потом берёт превью из кэша.
  // Заодно префетчим обложку текущего раунда: reveal показывает её мгновенно.
  const warmedRef = useRef(new Set());
  useEffect(() => {
    if (!lobby?.rounds || !current) return;
    const cur = lobby.rounds[idx];
    if (cur?.artwork) { new Image().src = cur.artwork; }
    const next = lobby.rounds[idx + 1];
    if (!next?.previewUrl || warmedRef.current.has(next.previewUrl)) return;
    warmedRef.current.add(next.previewUrl);
    if (mode === 'evolution') {
      preloadBuffer(next.previewUrl).catch(() => {});
    } else {
      fetch(next.previewUrl).then((r) => r.arrayBuffer()).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!isHost || !current || lobby?.status !== 'playing' || paused) return;
    let t;
    if (phase === 'playing') {
      const remaining = ROUND_MS - (serverNow() - current.startedAt) + 300;
      t = setTimeout(() => fireReveal(idx), Math.max(0, remaining));
    } else if (phase === 'reveal') {
      t = setTimeout(() => advanceRound(code).catch(() => {}), REVEAL_MS);
    }
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, idx, phase, lobby?.status, paused]);

  // ХОСТ: когда ответили все — даём ещё несколько секунд (можно поменять ответ),
  // затем показываем правильный ответ.
  useEffect(() => {
    if (!isHost || !current || phase !== 'playing' || paused) return;
    if (answerCount >= playerCount && playerCount > 0) {
      const t = setTimeout(() => fireReveal(idx), BOTH_ANSWERED_EXTRA_MS);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, answerCount, playerCount, phase, idx, paused]);

  if (!lobby || lobby.status === 'loading') {
    return (
      <div className="screen center">
        <div className="spinner" />
        <p className="muted">{t('game.loadingTracks')}</p>
      </div>
    );
  }
  if (!current || !round) {
    return <div className="screen center"><p className="muted">{t('game.preparing')}</p></div>;
  }

  const reveal = phase === 'reveal';
  const hasYear = round.year != null; // у некоторых треков iTunes нет releaseDate — тогда шаг года пропускаем
  // на паузе таймер замирает в серверной точке остановки — одинаково у всех игроков
  const elapsed = reveal ? ROUND_MS : Math.min(ROUND_MS, (paused ? current.pausedAt : now) - current.startedAt);
  const stage = stageForElapsed(elapsed);
  const stageInfo = stage === -1 ? null : STAGES[stage];
  const progress = Math.min(100, (elapsed / ROUND_MS) * 100);
  const livePoints = pointsForElapsed(elapsed);

  const playerList = lobby.playerOrder.map((uid) => lobby.players[uid]).filter(Boolean);
  // «Пирамида лидерства»: игроки по убыванию очков, с местами (равный счёт — одно место).
  const ranked = [...playerList].sort((a, b) => (b.score || 0) - (a.score || 0));
  const standings = ranked.map((p, i) => ({
    ...p,
    // место = 1 + число игроков со строго бо́льшим счётом
    pos: 1 + ranked.filter((o) => (o.score || 0) > (p.score || 0)).length,
    rowIndex: i,
  }));
  const multiplayer = standings.length > 1;

  const pick = (i) => {
    if (reveal || paused) return;
    if (myAnswer && myAnswer.choice === i) return; // тот же вариант — ничего не меняем
    const e = serverNow() - current.startedAt;
    const correct = i === round.correctIndex;
    const ans = {
      choice: i,
      atMs: Math.round(e),
      points: correct ? pointsForElapsed(e) : 0,
      correct,
      // год — это всегда текущее положение ползунка (сохраняется автоматически, без кнопки)
      year: yearGuess,
      yearPoints: yearPoints(yearGuess, round.year),
    };
    setMyAnswer(ans);
    submitAnswer(code, user.uid, ans).catch(() => {});
  };

  // Второй шаг: год выпуска. Кнопки подтверждения нет — год сохраняется сам.
  const commitYear = (year) => {
    const cur = myAnswerRef.current;
    if (phase === 'reveal' || paused || !cur) return;
    const ans = { ...cur, year, yearPoints: yearPoints(year, round.year) };
    setMyAnswer(ans);
    submitAnswer(code, user.uid, ans).catch(() => {});
  };

  // onChange ползунка обновляет число сразу, а год сохраняем с дебаунсом после остановки
  // движения — на Android событие «отпускания» (pointerup) часто не срабатывает.
  const onYearChange = (e) => {
    const v = parseInt(e.target.value, 10);
    setYearGuess(v);
    if (yearTimerRef.current) clearTimeout(yearTimerRef.current);
    yearTimerRef.current = setTimeout(() => commitYear(v), 300);
  };

  const resumeAudio = () => {
    if (mode === 'evolution') {
      unlockAudio();
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
        <span className="round-counter">{t('game.round', { n: current.index + 1, total: lobby.totalRounds })}</span>
        {isHost && phase === 'playing' && (
          <button
            className="vol-btn"
            onClick={() => (paused ? resumeRound(code) : pauseRound(code)).catch(() => {})}
            aria-label={paused ? t('game.resume') : t('game.pause')}
            title={paused ? t('game.resume') : t('game.pause')}
          >
            <Icon name={paused ? 'play' : 'pause'} size={18} />
          </button>
        )}
        <div className="vol">
          <button className="vol-btn" onClick={toggleMute} aria-label={t('game.volume')}>
            <Icon name={volume === 0 ? 'volumeX' : 'volume'} size={18} />
          </button>
          <input
            className="vol-slider"
            type="range" min="0" max="1" step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            aria-label={t('game.volumeLevel')}
          />
        </div>
        <div className={`standings${multiplayer ? '' : ' solo'}`}>
          {standings.map((p) => (
            <span
              key={p.uid}
              className={`rank-row${multiplayer && p.pos === 1 ? ' lead' : ''}${p.uid === user?.uid ? ' me' : ''}`}
            >
              {multiplayer && (
                <span className="rank-pos">
                  {p.pos === 1 ? <Icon name="crown" size={13} /> : p.pos}
                </span>
              )}
              <span className="rank-name">{shortName(p.name)}</span>
              <b className="rank-score">{p.score}</b>
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
                <>{t('game.stageLabel', { n: stage + 1, sec: stageInfo.maxMs / 1000 })} · <b>{livePoints}</b> {t('game.ptsWord')}</>
              ) : (
                <>{t('game.timeUp')}</>
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
                <Icon name="volume" size={14} /> {t('game.evolutionHint', { pct: Math.round(progress) })}
              </div>
            )}
          </>
        )}

        {reveal && (
          <div className="reveal-info">
            <div className="reveal-title">{round.title}</div>
            <div className="reveal-artist">{round.artist}</div>
            {hasYear && <div className="reveal-year">{round.year}</div>}
          </div>
        )}

        {/* Шкала лет: правильный год + маркеры догадок. Окно зумится по разбросу ответов. */}
        {reveal && hasYear && (() => {
          const guessYears = playerList.map((p) => answers[p.uid]?.year).filter((y) => y != null);
          const [lo, hi] = yearScaleBounds(round.year, guessYears);
          const pct = (y) => Math.max(0, Math.min(100, ((y - lo) / (hi - lo)) * 100));
          // промежуточные отметки лет; рядом с флажком правильного года не рисуем
          const step = hi - lo <= 30 ? 5 : 20;
          const ticks = [];
          for (let y = Math.ceil((lo + 1) / step) * step; y < hi; y += step) {
            if (Math.abs(pct(y) - pct(round.year)) > 8) ticks.push(y);
          }
          return (
            <div className="year-reveal">
              <div className="yr-bar">
                {ticks.map((y) => (
                  <span key={y} className="yr-tick" style={{ left: `${pct(y)}%` }}>
                    <span>{y}</span>
                  </span>
                ))}
                <span className="yr-target" style={{ left: `${pct(round.year)}%` }}>
                  <span className="yr-flag">{round.year}</span>
                </span>
                {playerList.map((p, i) => {
                  const a = answers[p.uid];
                  if (!a || a.year == null) return null;
                  return (
                    <span
                      key={p.uid}
                      className={`yr-mark c${i % 4}${a.year === round.year ? ' hit' : ''}`}
                      style={{ left: `${pct(a.year)}%` }}
                    >
                      <span className={`yr-name${i % 2 ? ' up' : ''}`}>{shortName(p.name)}</span>
                      <span className="yr-dot" />
                    </span>
                  );
                })}
              </div>
              <div className="yscale"><span>{lo}</span><span>{hi}</span></div>
            </div>
          );
        })()}

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

        {!reveal && myAnswer && hasYear && (
          <div className="yearB">
            <span className="yb-cap">{t('game.yearLabel')}</span>
            <span className="yb-num">{yearGuess}</span>
            <input
              className="yslider"
              type="range" min={MIN_YEAR} max={CURRENT_YEAR} step="1"
              value={yearGuess}
              onChange={onYearChange}
              onPointerUp={(e) => commitYear(parseInt(e.target.value, 10))}
              onTouchEnd={(e) => commitYear(parseInt(e.target.value, 10))}
              aria-label={t('game.yearLabel')}
            />
            <div className="yscale"><span>{MIN_YEAR}</span><span>{CURRENT_YEAR}</span></div>
            <span className="auto-note"><span className="ico"><Icon name="check" size={13} /></span> {t('game.yearAuto')}</span>
          </div>
        )}

        {!reveal && myAnswer && (
          <p className="muted waiting">
            {answerCount >= playerCount && playerCount > 0
              ? t('game.allAnswered')
              : t('game.answerAccepted')}
          </p>
        )}

        {reveal && (
          <div className="round-results">
            {playerList.map((p) => {
              const a = answers[p.uid];
              const yd = hasYear && a && a.year != null ? a.year - round.year : null;
              return (
                <div key={p.uid} className="rr-row">
                  <span>{shortName(p.name)}</span>
                  {a ? (
                    <span className={a.correct ? 'ok' : 'bad'}>
                      {a.correct ? t('game.scoreAt', { points: a.points, sec: (a.atMs / 1000).toFixed(1) }) : t('game.miss')}
                    </span>
                  ) : (
                    <span className="bad">{t('game.tooLate')}</span>
                  )}
                  {yd != null && (
                    <span className="rr-year">
                      {a.year} · {yd === 0 ? t('game.exact') : `${yd > 0 ? '+' : '−'}${Math.abs(yd)}`} · <b>+{a.yearPoints || 0}</b>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {needTap && !reveal && !paused && (
        <button className="tap-overlay" onClick={resumeAudio}>
          <Icon name="play" size={15} /> {t('game.tapToListen')}
        </button>
      )}

      {paused && !reveal && (
        <div className="pause-overlay">
          <div className="pause-card">
            <span className="pause-ico"><Icon name="pause" size={26} /></span>
            <b>{t('game.pause')}</b>
            {isHost ? (
              <button className="btn btn-primary" onClick={() => resumeRound(code).catch(() => {})}>
                <Icon name="play" size={18} /> {t('game.resume')}
              </button>
            ) : (
              <p className="muted">{t('game.pausedByHost')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
