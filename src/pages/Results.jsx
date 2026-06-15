import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLobby } from '../hooks/useLobby';
import { resetLobby, shortName } from '../services/lobby';
import { recordGameResult } from '../services/users';
import { rememberCoPlayers } from '../services/friends';
import { shareOrCopy } from '../services/share';
import { track } from '../services/analytics';
import { STAGES } from '../services/scoring';
import { getPack, packName } from '../data/packs';
import { useT, useLocale } from '../i18n';
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
  const t = useT();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const recordedRef = useRef(false);
  const finishTrackedRef = useRef(false);
  const [shareMsg, setShareMsg] = useState('');

  // Записываем результат в таблицу лидеров. Аналитику game_finish шлём один раз для всех,
  // а в лидерборд пишем только не-гостя — поэтому если гость войдёт через Google (uid тот
  // же), эффект перезапустится с не-анонимным user и запишет партию.
  useEffect(() => {
    if (!lobby || lobby.status !== 'finished' || !lobby.gameId) return;
    const players = lobby.players || {};
    const me = players[user.uid];
    if (!me) return;
    const maxScore = Math.max(...Object.values(players).map((p) => p.score || 0));
    if (!finishTrackedRef.current) {
      finishTrackedRef.current = true;
      rememberCoPlayers(lobby, user.uid); // для «недавно играли вместе»
      track('game_finish', {
        score: me.score || 0,
        solo: Object.keys(players).length === 1,
        won: me.score === maxScore,
      });
    }
    if (!recordedRef.current && !user.isAnonymous) {
      recordedRef.current = true;
      recordGameResult(user, lobby.gameId, me.score || 0, me.score === maxScore).catch(() => {});
    }
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
          <p>{t('results.notFound')}</p>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>{t('common.home')}</button>
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
    ? (players[0].packs || []).map((id) => packName(getPack(id), locale)).filter(Boolean).join(', ')
    : '';

  // Гость нажал «сохранить результат»: уходим на Google (редирект). После возврата
  // вход завершается, эффект выше видит не-анонимного user (uid тот же) и пишет партию.
  const handleSignInToSave = () => {
    signIn().catch(() => {});
  };

  const handleAgain = async () => {
    await resetLobby(code).catch(() => {});
    navigate(`/lobby/${code}`);
  };

  const handleShareResult = async () => {
    const myScore = lobby.players[user.uid]?.score || 0;
    const res = await shareOrCopy({
      title: 'Egorii',
      text: solo
        ? t('results.shareSolo', { score: myScore })
        : t('results.shareDuel', { line: scoreLine, score: myScore }),
      url: window.location.origin,
    });
    if (res === 'copied') setShareMsg(t('results.shareCopied'));
    else if (res === 'failed') setShareMsg(t('lobby.shareFailed'));
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
            <span className="eyebrow">{t('results.over')}</span>
            <h1>{t('results.score', { n: players[0].score })}</h1>
            <p className="sub-line">{t('results.roundsN', { n: rounds })}{soloPacks && ` · ${soloPacks}`}</p>
          </>
        ) : tie ? (
          <>
            <span className="eyebrow">{t('results.matchResult')}</span>
            <h1>{t('results.tie')}</h1>
            <p className="sub-line">{scoreLine} · {t('results.roundsN', { n: rounds })}</p>
          </>
        ) : (
          <>
            <span className="eyebrow">{t('results.winner')}</span>
            <h1><span className="winner-name">{shortName(winner.name)}</span></h1>
            <p className="sub-line">{scoreLine} · {t('results.roundsN', { n: rounds })}</p>
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
                      {shortName(p.name)}
                      {isWinner && <Icon name="crown" size={14} className="crown" />}
                    </div>
                    <div className="big-score">{p.score}</div>
                  </>
                )}
                <div className="stat-line"><span>{t('results.guessed')}</span><b>{s.correct} / {rounds}</b></div>
                <div className="stat-line"><span>{t('results.fast')}</span><b>{s.fast}</b></div>
                <div className="stat-line">
                  <span>{t('results.avgTime')}</span>
                  <b>{s.avgTime != null ? `${(s.avgTime / 1000).toFixed(1)}${locale === 'en' ? 's' : 'с'}` : '—'}</b>
                </div>
              </div>
            );
          })}
        </div>

        {user.isAnonymous && (
          <div className="save-cta">
            <p className="muted">{t('results.saveCta')}</p>
            <button className="btn btn-google" onClick={handleSignInToSave}>
              <span className="g">G</span> {t('results.saveResult')}
            </button>
          </div>
        )}

        <div className="actions">
          {isHost ? (
            <button className="btn btn-primary" onClick={handleAgain}><Icon name="rotate" size={18} /> {t('results.again')}</button>
          ) : (
            <p className="muted">{t('results.hostAgain')}</p>
          )}
          <button className="btn btn-outline" onClick={() => navigate('/')}><Icon name="home" size={18} /> {t('common.home')}</button>
        </div>

        <button className="share-link" onClick={handleShareResult}><Icon name="share" size={15} /> {t('results.share')}</button>
        {shareMsg && <p className="share-toast">{shareMsg}</p>}
      </div>
    </div>
  );
}
