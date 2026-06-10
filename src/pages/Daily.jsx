import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SNIPPETS, POINTS, MAX_TRIES,
  dayNumber, dateKey, allSongs, resolveDailyTrack,
  loadDailyState, saveDailyState, getStreak, bumpStreak, adoptStreak, shareText,
} from '../services/daily';
import { useAuth } from '../context/AuthContext';
import { fetchProfile, saveDailyStreak } from '../services/users';
import { shareOrCopy } from '../services/share';
import { track as trackEvent } from '../services/analytics';
import Icon from '../components/Icon';

const FULL_SNIPPET = SNIPPETS[MAX_TRIES - 1];
const DONATE_URL = import.meta.env.VITE_DONATE_URL;

export default function Daily() {
  const navigate = useNavigate();
  const { user, signIn } = useAuth();
  const [phase, setPhase] = useState('loading'); // loading | error | play | done
  const [answer, setAnswer] = useState(null);    // песня из пака (title — правильный ответ)
  const [meta, setMeta] = useState(null);        // трек из iTunes (превью, обложка, год, ссылка)
  const [st, setSt] = useState(null);            // состояние сегодняшней партии
  const [streak, setStreak] = useState(getStreak());
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const audioRef = useRef(null);
  const stopRef = useRef(null);

  const pool = useMemo(() => allSongs(), []);
  // быстрый поиск исполнителя по названию — для строк с неверными догадками
  const poolByTitle = useMemo(() => {
    const m = new Map();
    pool.forEach((s) => { if (!m.has(s.title)) m.set(s.title, s); });
    return m;
  }, [pool]);

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

  // Привязываем превью к <audio> сразу, как только трек получен. На холодной
  // странице (зашёл и сразу в «Трек дня») установка src и play() в один тик
  // часто не стартует — особенно на мобильных; предзагрузка это чинит.
  useEffect(() => {
    const a = audioRef.current;
    if (a && meta?.previewUrl && a.src !== meta.previewUrl) {
      a.src = meta.previewUrl;
      a.load();
    }
  }, [meta]);

  // Стрик зарегистрированного игрока живёт и в профиле: подтягиваем его с другого
  // устройства и дописываем обратно, если локальный «живее» (в т.ч. после входа
  // через Google уже сыгранным днём).
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    let cancelled = false;
    (async () => {
      const p = await fetchProfile(user.uid);
      if (cancelled) return;
      if (p?.dailyLast && p.dailyStreak) adoptStreak(p.dailyLast, p.dailyStreak);
      const cur = getStreak();
      setStreak(cur);
      const today = loadDailyState();
      if (today?.done && cur && (p?.dailyLast !== dateKey() || (p?.dailyStreak || 0) < cur)) {
        saveDailyStreak(user, cur, dateKey()).catch(() => {});
      }
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

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
    // Стрик за участие: любой сыгранный день продолжает стрик (проигрыш не сбрасывает).
    const count = bumpStreak();
    setStreak(count);
    saveDailyStreak(user, count, dateKey()).catch(() => {});
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

  // Таймлайн попыток — источник правды для строк. Каждая из MAX_TRIES попыток — строка.
  const rows = st ? Array.from({ length: MAX_TRIES }, (_, i) => {
    const g = st.guesses[i];
    if (g?.t === 'c') return { kind: 'right', label: answer?.title || '', sub: meta?.artist, pts: `+${st.score}` };
    if (g?.t === 'w') return { kind: 'wrong', label: g.title, sub: poolByTitle.get(g.title)?.artist };
    if (g?.t === 's') return { kind: 'skip', label: 'Пропуск' };
    if (!st.done && i === st.guesses.length) return { kind: 'cur', label: 'Твой ход — слушай и угадывай', pts: `+${POINTS[i]}` };
    return { kind: 'empty', label: '—' };
  }) : [];

  const rowIcon = (kind) =>
    kind === 'wrong' ? <Icon name="x" size={13} />
    : kind === 'right' ? <Icon name="check" size={13} />
    : kind === 'skip' ? '—' : null;

  const eyebrow = phase === 'done'
    ? (st.won ? 'Угадал!' : 'Не угадал · загаданный трек')
    : 'Трек дня';

  return (
    <div className="screen center">
      <audio ref={audioRef} preload="auto" playsInline onEnded={() => setPlaying(false)} />
      <div className="card daily-card">
        <div className="daily-head">
          <button className="back-link" onClick={() => navigate('/')}><Icon name="home" size={15} /> На главную</button>
          <span className={`daily-streak-pill${streak > 0 ? ' on' : ''}`}>
            <Icon name="flame" size={14} fill="currentColor" /> {streak}
          </span>
        </div>
        <span className="eyebrow daily-eyebrow">{eyebrow}</span>

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
            <div className="daily-scrub">
              <button
                className="dscrub-pp"
                onClick={playing ? stopAudio : () => playSnippet(unlocked)}
                aria-label={playing ? 'Стоп' : `Слушать ${unlocked} сек`}
              >
                <Icon name={playing ? 'pause' : 'play'} size={18} fill="currentColor" />
              </button>
              <div className="dscrub-bar">
                <i style={{ width: `${(unlocked / FULL_SNIPPET) * 100}%` }} />
                {SNIPPETS.map((s, i) => (
                  <span key={i} className="dscrub-tick" style={{ left: `${(s / FULL_SNIPPET) * 100}%` }} />
                ))}
              </div>
              <span className="dscrub-secs">0:{String(unlocked).padStart(2, '0')}</span>
            </div>

            <div className="daily-rows">
              {rows.map((r, i) => (
                <div key={i} className={`drow ${r.kind}`}>
                  <span className="drow-num">{i + 1}</span>
                  <span className="drow-ico">{rowIcon(r.kind)}</span>
                  <span className="drow-lbl">{r.label}{r.sub && <span> · {r.sub}</span>}</span>
                  {r.pts && <span className="drow-pts">{r.pts}</span>}
                </div>
              ))}
            </div>

            <div className="daily-search">
              <span className="ds-ic"><Icon name="search" size={17} /></span>
              <input
                className={`daily-input${focused ? ' focus' : ''}`}
                placeholder="Название или исполнитель…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoComplete="off"
              />
            </div>
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

            <button
              className={`daily-skip${st.guesses.length >= MAX_TRIES - 1 ? ' give' : ''}`}
              onClick={skip}
            >
              {st.guesses.length >= MAX_TRIES - 1
                ? 'Сдаюсь'
                : `Пропустить · открыть ещё ${SNIPPETS[st.guesses.length + 1] - unlocked} сек`}
            </button>
          </>
        )}

        {phase === 'done' && st && meta && (
          <>
            <div className="daily-reveal">
              <button className="daily-art" onClick={playing ? stopAudio : () => playSnippet(0)} aria-label="Послушать трек">
                {meta.artwork
                  ? <img src={meta.artwork} alt="" />
                  : <span className="da-ph"><Icon name="music" size={34} /></span>}
                <span className="da-play"><Icon name={playing ? 'pause' : 'play'} size={16} fill="currentColor" /></span>
              </button>
              <div className="daily-track">
                <span className="dt-ttl">{answer.title}</span>
                <span className="dt-art">{meta.artist}{meta.year ? ` · ${meta.year}` : ''}</span>
              </div>
              {st.won && <span className="daily-bigscore">+{st.score}</span>}
            </div>

            <div className="daily-rows">
              {rows.map((r, i) => (
                <div key={i} className={`drow ${r.kind}`}>
                  <span className="drow-num">{i + 1}</span>
                  <span className="drow-ico">{rowIcon(r.kind)}</span>
                  <span className="drow-lbl">{r.label}{r.sub && <span> · {r.sub}</span>}</span>
                  {r.pts && <span className="drow-pts">{r.pts}</span>}
                </div>
              ))}
            </div>

            <p className="daily-cap">
              {st.won
                ? 'Новый трек — завтра. Возвращайся, чтобы не потерять стрик!'
                : streak > 0
                  ? 'День засчитан — стрик продолжается. Новый трек завтра.'
                  : 'Сыграй завтра и начни новый стрик.'}
            </p>

            <div className="daily-actions">
              <button className="daily-btn primary" onClick={handleShare}>
                <Icon name="share" size={17} /> Поделиться результатом
              </button>
              <button className="daily-btn dark" onClick={() => navigate('/')}>
                Сыграть с друзьями <Icon name="arrowRight" size={16} />
              </button>
            </div>
            {shareMsg && <p className="share-toast">{shareMsg}</p>}

            {user?.isAnonymous && streak > 0 && (
              <button className="btn-link" onClick={() => signIn().catch(() => {})}>
                Войди через Google — стрик сохранится в профиле
              </button>
            )}

            {DONATE_URL && (
              <a
                className="donate-link"
                href={DONATE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent('donate_click', { from: 'daily' })}
              >
                <Icon name="heart" size={14} /> Поддержать проект
              </a>
            )}

            <p className="daily-courtesy">
              {meta.url ? (
                <a href={meta.url} target="_blank" rel="noopener noreferrer">Слушать целиком в Apple Music</a>
              ) : null}
              <span>Превью предоставлено iTunes</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
