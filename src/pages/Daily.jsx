import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SNIPPETS, POINTS, MAX_TRIES,
  dayNumber, dateKey, allSongs, resolveDailyTrack,
  loadDailyState, saveDailyState, getStreak, bumpStreak, shareText,
} from '../services/daily';
import { shareOrCopy } from '../services/share';
import { track as trackEvent } from '../services/analytics';
import Icon from '../components/Icon';

const FULL_SNIPPET = SNIPPETS[MAX_TRIES - 1];

export default function Daily() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('loading'); // loading | error | play | done
  const [answer, setAnswer] = useState(null);    // песня из пака (title — правильный ответ)
  const [meta, setMeta] = useState(null);        // трек из iTunes (превью, обложка, год, ссылка)
  const [st, setSt] = useState(null);            // состояние сегодняшней партии
  const [streak, setStreak] = useState(getStreak());
  const [query, setQuery] = useState('');
  const [playing, setPlaying] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const audioRef = useRef(null);
  const stopRef = useRef(null);

  const pool = useMemo(() => allSongs(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { song, track } = await resolveDailyTrack();
        if (cancelled) return;
        setAnswer(song);
        setMeta(track);
        const existing = loadDailyState();
        if (existing) {
          setSt(existing);
          setPhase(existing.done ? 'done' : 'play');
        } else {
          const fresh = { date: dateKey(), day: dayNumber(), guesses: [], done: false, won: false, score: 0 };
          saveDailyState(fresh);
          setSt(fresh);
          setPhase('play');
          trackEvent('daily_start', { day: fresh.day });
        }
      } catch {
        if (!cancelled) setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // глушим аудио при уходе со страницы
  useEffect(() => () => {
    clearTimeout(stopRef.current);
    if (audioRef.current) audioRef.current.pause();
  }, []);

  const attempt = st ? Math.min(st.guesses.length, MAX_TRIES - 1) : 0;
  const unlocked = SNIPPETS[attempt];

  const playSnippet = (seconds) => {
    const a = audioRef.current;
    if (!a || !meta) return;
    if (a.src !== meta.previewUrl) a.src = meta.previewUrl;
    clearTimeout(stopRef.current);
    try { a.currentTime = 0; } catch { /* метаданные ещё не загружены */ }
    a.play().then(() => {
      setPlaying(true);
      if (seconds) {
        stopRef.current = setTimeout(() => { a.pause(); setPlaying(false); }, seconds * 1000);
      }
    }).catch(() => setPlaying(false));
  };

  const stopAudio = () => {
    clearTimeout(stopRef.current);
    if (audioRef.current) audioRef.current.pause();
    setPlaying(false);
  };

  const finish = (guesses, won, score) => {
    const next = { ...st, guesses, done: true, won, score };
    saveDailyState(next);
    setSt(next);
    setPhase('done');
    setStreak(bumpStreak());
    trackEvent('daily_finish', { day: next.day, won, attempts: guesses.length, score });
    playSnippet(0); // на финале даём послушать превью целиком
  };

  const step = (guesses) => {
    if (guesses.length >= MAX_TRIES) {
      finish(guesses, false, 0);
    } else {
      const next = { ...st, guesses };
      saveDailyState(next);
      setSt(next);
    }
  };

  const guess = (song) => {
    if (phase !== 'play') return;
    setQuery('');
    stopAudio();
    if (song.title === answer.title) {
      finish([...st.guesses, { t: 'c' }], true, POINTS[st.guesses.length]);
    } else {
      step([...st.guesses, { t: 'w', title: song.title }]);
    }
  };

  const skip = () => {
    if (phase !== 'play') return;
    stopAudio();
    step([...st.guesses, { t: 's' }]);
  };

  const handleShare = async () => {
    const res = await shareOrCopy({
      title: 'Egorii — Трек дня',
      text: shareText(st),
      url: `${window.location.origin}/daily`,
    });
    if (res === 'copied') setShareMsg('Результат скопирован — отправь друзьям');
    else if (res === 'failed') setShareMsg('Не удалось поделиться');
    else setShareMsg('');
    if (res === 'copied' || res === 'failed') setTimeout(() => setShareMsg(''), 2500);
    if (res !== 'failed') trackEvent('share', { content_type: 'daily', method: res });
  };

  const wrongTitles = new Set((st?.guesses || []).filter((g) => g.t === 'w').map((g) => g.title));
  const q = query.trim().toLowerCase();
  const suggestions = q.length < 1 ? [] : pool
    .filter((s) => !wrongTitles.has(s.title)
      && (s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)))
    .slice(0, 6);

  const cells = Array.from({ length: MAX_TRIES }, (_, i) => {
    const g = st?.guesses[i];
    if (g) return g.t;                                  // 's' | 'w' | 'c'
    return !st?.done && i === st?.guesses.length ? 'cur' : 'next';
  });

  return (
    <div className="screen center">
      <audio ref={audioRef} preload="auto" playsInline onEnded={() => setPlaying(false)} />
      <div className="card daily-card">
        <button className="back-link" onClick={() => navigate('/')}><Icon name="home" size={15} /> На главную</button>
        <span className="eyebrow">Трек дня #{dayNumber()}</span>

        {phase === 'loading' && (
          <div className="daily-center"><div className="spinner" /><p className="muted">Готовим трек…</p></div>
        )}

        {phase === 'error' && (
          <div className="daily-center">
            <p>Не получилось загрузить трек дня. Проверь интернет и попробуй ещё раз.</p>
            <button className="btn btn-secondary" onClick={() => window.location.reload()}>Повторить</button>
          </div>
        )}

        {phase === 'play' && st && (
          <>
            <h2 className="daily-title">Угадай трек</h2>
            <div className="daily-cells">
              {cells.map((c, i) => (
                <span key={i} className={`dc dc-${c}`}>
                  {c === 'w' ? <Icon name="x" size={14} /> : c === 's' ? '—' : ''}
                </span>
              ))}
            </div>

            <button className="daily-play" onClick={playing ? stopAudio : () => playSnippet(unlocked)}>
              <Icon name={playing ? 'x' : 'play'} size={20} />
              {playing ? 'Стоп' : `Слушать ${unlocked} сек`}
            </button>
            <div className="daily-meter">
              <div className="dm-fill" style={{ width: `${(unlocked / FULL_SNIPPET) * 100}%` }} />
            </div>
            <p className="muted daily-hint">
              Попытка {st.guesses.length + 1} из {MAX_TRIES} · угадаешь сейчас — <b>+{POINTS[st.guesses.length]}</b>
            </p>

            <input
              className="daily-input"
              placeholder="Название или исполнитель…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <ul className="daily-suggest">
                {suggestions.map((s) => (
                  <li key={`${s.title}|${s.artist}`}>
                    <button onClick={() => guess(s)}>
                      <b>{s.title}</b> <span className="muted">· {s.artist}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button className="btn btn-ghost daily-skip" onClick={skip}>
              {st.guesses.length >= MAX_TRIES - 1
                ? 'Сдаюсь'
                : `Пропустить · +${SNIPPETS[st.guesses.length + 1] - unlocked} сек`}
            </button>
          </>
        )}

        {phase === 'done' && st && meta && (
          <>
            <div className="daily-reveal">
              {meta.artwork
                ? <img className="daily-art" src={meta.artwork} alt="" />
                : <div className="daily-art ph"><Icon name="music" size={40} /></div>}
              <div className="daily-track">
                <b>{answer.title}</b>
                <span className="muted">{meta.artist}{meta.year ? ` · ${meta.year}` : ''}</span>
              </div>
            </div>

            <h2 className="daily-outcome">
              {st.won ? `+${st.score} очков!` : 'Сегодня не угадал'}
            </h2>
            <div className="daily-cells">
              {cells.map((c, i) => (
                <span key={i} className={`dc dc-${c}`}>
                  {c === 'c' ? <Icon name="check" size={14} /> : c === 'w' ? <Icon name="x" size={14} /> : c === 's' ? '—' : ''}
                </span>
              ))}
            </div>
            {streak > 0 && <p className="daily-streak">🔥 Стрик: {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}</p>}

            <button className="daily-play" onClick={playing ? stopAudio : () => playSnippet(0)}>
              <Icon name={playing ? 'x' : 'play'} size={20} />
              {playing ? 'Стоп' : 'Послушать превью'}
            </button>

            <button className="btn btn-primary" onClick={handleShare}>
              <Icon name="share" size={18} /> Поделиться результатом
            </button>
            {shareMsg && <p className="share-toast">{shareMsg}</p>}

            <button className="btn btn-secondary" onClick={() => navigate('/')}>
              Сыграть с друзьями <Icon name="arrowRight" size={18} />
            </button>

            <p className="daily-courtesy">
              {meta.url ? (
                <a href={meta.url} target="_blank" rel="noopener noreferrer">Слушать целиком в Apple Music</a>
              ) : null}
              <span>Превью предоставлено iTunes</span>
            </p>

            <p className="muted daily-next">Новый трек — завтра. Возвращайся, чтобы не потерять стрик!</p>
          </>
        )}
      </div>
    </div>
  );
}
