// Вся работа с лобби и игровым состоянием в Firestore.
// Один документ lobbies/{code} хранит всё состояние партии.
// Хост (создатель лобби) управляет сменой раундов; игроки пишут только свои ответы.
import {
  doc,
  collection,
  query,
  where,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  increment,
  arrayUnion,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';
import { db } from '../firebase';
import { searchTrack } from './tracksService';
import { serverNow } from './clock';
import { getPack } from '../data/packs';

const DEFAULT_ROUNDS = 8;
const MAX_PLAYERS = 4;

// Лобби живёт ограниченное время. Партия идёт минуты, поэтому всё, что старше
// нескольких часов — это заброшенные/завершённые лобби, которые можно удалять.
const LOBBY_TTL_MS = 6 * 60 * 60 * 1000; // 6 часов

// Удаляет старые лобби. Вызывается при создании нового лобби (ленивая сборка мусора),
// чтобы база не копила брошенные документы. Ошибки игнорируем — это фоновая чистка.
export async function cleanupOldLobbies() {
  try {
    const cutoff = Timestamp.fromMillis(Date.now() - LOBBY_TTL_MS);
    const q = query(collection(db, 'lobbies'), where('createdAt', '<', cutoff));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch {
    // не критично
  }
}

function genCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function playerObj(user) {
  return {
    uid: user.uid,
    name: user.displayName || 'Игрок',
    photo: user.photoURL || null,
    score: 0,
    ready: false,
    packs: [], // предпочитаемые паки этого игрока (объединяются в общий пул игры)
  };
}

// Собирает общий пул песен из паков, выбранных всеми игроками (объединение, без дублей).
export function combinedSongs(lobby) {
  const ids = new Set();
  Object.values(lobby?.players || {}).forEach((p) => {
    (p.packs || []).forEach((id) => ids.add(id));
  });
  const songs = [];
  const seen = new Set();
  [...ids].map(getPack).filter(Boolean).forEach((pk) => {
    pk.songs.forEach((s) => {
      const key = `${s.title}|${s.artist}`.toLowerCase();
      if (!seen.has(key)) { seen.add(key); songs.push(s); }
    });
  });
  return songs;
}

export async function createLobby(user, pack) {
  cleanupOldLobbies(); // фоновая чистка старых лобби, не ждём результата
  for (let i = 0; i < 10; i++) {
    const code = genCode();
    const ref = doc(db, 'lobbies', code);
    const snap = await getDoc(ref);
    if (snap.exists()) continue;
    await setDoc(ref, {
      code,
      hostId: user.uid,
      hostName: user.displayName || 'Игрок',
      status: 'waiting', // waiting | loading | playing | finished
      players: { [user.uid]: { ...playerObj(user), ready: true, packs: pack ? [pack.id] : [] } },
      playerOrder: [user.uid],
      roundCount: DEFAULT_ROUNDS,
      mode: 'normal', // normal | evolution

      totalRounds: 0,
      rounds: [],
      current: null,
      answers: {},
      log: [],
      createdAt: serverTimestamp(),
    });
    return code;
  }
  throw new Error('Не удалось создать лобби, попробуй ещё раз');
}

export async function joinLobby(code, user) {
  const ref = doc(db, 'lobbies', code);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Лобби с таким кодом не найдено');
  const data = snap.data();
  const players = data.players || {};
  const already = !!players[user.uid];
  if (!already && data.status !== 'waiting') throw new Error('Игра уже началась');
  if (!already && Object.keys(players).length >= MAX_PLAYERS) throw new Error(`Лобби заполнено (${MAX_PLAYERS} игрока)`);
  if (!already) {
    await updateDoc(ref, {
      [`players.${user.uid}`]: playerObj(user),
      playerOrder: arrayUnion(user.uid),
    });
  }
  return code;
}

export function subscribeLobby(code, cb, onError) {
  const ref = doc(db, 'lobbies', code);
  return onSnapshot(
    ref,
    (snap) => cb(snap.exists() ? snap.data() : null),
    (err) => onError && onError(err)
  );
}

export async function setReady(code, uid, ready) {
  await updateDoc(doc(db, 'lobbies', code), { [`players.${uid}.ready`]: ready });
}

// Игрок добавляет/убирает свой предпочитаемый пак. Паки всех игроков объединяются
// в общий пул для игры.
export async function togglePlayerPack(code, uid, packId, selected) {
  await updateDoc(doc(db, 'lobbies', code), {
    [`players.${uid}.packs`]: selected ? arrayUnion(packId) : arrayRemove(packId),
  });
}

// Хост меняет число раундов в лобби до старта игры.
export async function setLobbyRounds(code, n) {
  await updateDoc(doc(db, 'lobbies', code), { roundCount: n });
}

// Хост меняет режим игры (обычный / эволюция трека) до старта.
export async function setLobbyMode(code, mode) {
  await updateDoc(doc(db, 'lobbies', code), { mode });
}

async function buildRounds(songs, n) {
  const pool = shuffle(songs);
  const resolved = [];
  for (const song of pool) {
    if (resolved.length >= n) break;
    try {
      const track = await searchTrack(song);
      if (track && track.previewUrl) {
        resolved.push({ ...track, packTitle: song.title });
      }
    } catch {
      // трек не найден — пропускаем
    }
  }

  const allTitles = songs.map((s) => s.title);
  return resolved.map((t) => {
    const correctTitle = t.packTitle;
    const distractors = shuffle(allTitles.filter((x) => x !== correctTitle)).slice(0, 3);
    const options = shuffle([correctTitle, ...distractors]);
    return {
      title: correctTitle,
      artist: t.artist,
      artwork: t.artwork || null,
      previewUrl: t.previewUrl,
      year: t.year ?? null, // год выпуска для второго шага; null — шаг отключён для раунда
      offset: Math.floor(Math.random() * 10), // 0..9 сек, чтобы окно в 20с влезло в 30с превью
      options,
      correctIndex: options.indexOf(correctTitle),
    };
  });
}

// Хост запускает игру: собирает общий пул из паков всех игроков, грузит треки и
// переводит лобби в playing.
export async function startGame(code) {
  const ref = doc(db, 'lobbies', code);
  const pre = await getDoc(ref);
  const lobby = pre.data();
  const songs = combinedSongs(lobby);
  if (songs.length < 1) {
    throw new Error('Выберите хотя бы один пак музыки');
  }
  const totalRounds = lobby.roundCount || DEFAULT_ROUNDS;

  await updateDoc(ref, { status: 'loading' });

  let rounds;
  try {
    rounds = await buildRounds(songs, totalRounds);
  } catch {
    rounds = [];
  }
  if (rounds.length < 1) {
    await updateDoc(ref, { status: 'waiting' });
    throw new Error('Не удалось загрузить треки из iTunes. Проверь интернет и попробуй снова.');
  }

  // сбрасываем счёт игроков
  const snap = await getDoc(ref);
  const players = snap.data().players || {};
  const scoreReset = {};
  Object.keys(players).forEach((uid) => {
    scoreReset[`players.${uid}.score`] = 0;
  });

  await updateDoc(ref, {
    ...scoreReset,
    status: 'playing',
    gameId: `${code}-${Date.now()}`,
    rounds,
    totalRounds: rounds.length,
    log: [],
    answers: {},
    current: { index: 0, phase: 'playing', startedAt: serverNow() },
  });
}

// Игрок отправляет (или меняет) свой ответ. Очки здесь не начисляем — ответ можно
// поменять, поэтому итог считаем один раз на фазе reveal.
export async function submitAnswer(code, uid, answer) {
  await updateDoc(doc(db, 'lobbies', code), {
    [`answers.${uid}`]: answer,
  });
}

// Хост: показать правильный ответ (фаза reveal) и начислить очки по финальным ответам.
// Транзакция гарантирует, что очки начислятся ровно один раз, даже если два таймера
// хоста (полное время раунда и «ответили оба + пауза») сработают почти одновременно.
export async function revealRound(code) {
  const ref = doc(db, 'lobbies', code);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!data || !data.current || data.current.phase !== 'playing') return;
    const answers = data.answers || {};
    const updates = { 'current.phase': 'reveal' };
    Object.entries(answers).forEach(([uid, a]) => {
      // Итог раунда = очки за название + очки за год (год может быть и при неверном названии).
      const total = (a?.points || 0) + (a?.yearPoints || 0);
      if (total) updates[`players.${uid}.score`] = increment(total);
    });
    tx.update(ref, updates);
  });
}

// Хост: перейти к следующему раунду либо завершить игру.
export async function advanceRound(code) {
  const ref = doc(db, 'lobbies', code);
  const snap = await getDoc(ref);
  const data = snap.data();
  if (!data || !data.current) return;

  const idx = data.current.index;
  const round = data.rounds[idx];
  const logEntry = {
    index: idx,
    title: round.title,
    artist: round.artist,
    artwork: round.artwork || null,
    correctIndex: round.correctIndex,
    answers: data.answers || {},
  };
  const nextIdx = idx + 1;

  if (nextIdx >= data.rounds.length) {
    await updateDoc(ref, {
      status: 'finished',
      log: arrayUnion(logEntry),
      answers: {},
      current: { index: idx, phase: 'done', startedAt: data.current.startedAt },
    });
  } else {
    await updateDoc(ref, {
      log: arrayUnion(logEntry),
      answers: {},
      current: { index: nextIdx, phase: 'playing', startedAt: serverNow() },
    });
  }
}

// Игрок выходит из лобби. Хост закрывает лобби целиком (удаляет документ),
// обычный игрок просто покидает состав.
export async function leaveLobby(code, uid) {
  const ref = doc(db, 'lobbies', code);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().hostId === uid) {
    await deleteDoc(ref);
  } else {
    await updateDoc(ref, {
      [`players.${uid}`]: deleteField(),
      playerOrder: arrayRemove(uid),
    });
  }
}

// Хост: сыграть заново с тем же составом.
export async function resetLobby(code) {
  const ref = doc(db, 'lobbies', code);
  const snap = await getDoc(ref);
  const players = snap.data().players || {};
  const reset = {};
  Object.keys(players).forEach((uid) => {
    reset[`players.${uid}.score`] = 0;
  });
  await updateDoc(ref, {
    ...reset,
    status: 'waiting',
    rounds: [],
    totalRounds: 0,
    current: null,
    answers: {},
    log: [],
  });
}
