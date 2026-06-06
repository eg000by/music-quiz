// Профили игроков и таблица лидеров.
// Документ users/{uid} хранит накопительную статистику по всем сыгранным партиям.
import {
  doc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

// Создаёт/обновляет профиль игрока при входе, чтобы он попадал в таблицу лидеров
// ещё до первой партии. Статистику не трогает: при существующем документе обновляем
// только имя и фото, при новом — инициализируем счётчики нулями.
export async function ensureProfile(user) {
  // Гостей (анонимный вход) в таблицу лидеров не добавляем: иначе она забьётся
  // безымянными «Игрок», да и это лишние записи в Firestore на каждого посетителя.
  // Профиль появляется при входе через Google (после link uid и счёт сохраняются).
  if (!user || user.isAnonymous) return;
  const ref = doc(db, 'users', user.uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const base = {
      uid: user.uid,
      name: user.displayName || 'Игрок',
      photo: user.photoURL || null,
      updatedAt: serverTimestamp(),
    };
    if (snap.exists()) {
      tx.set(ref, base, { merge: true });
    } else {
      tx.set(ref, { ...base, totalScore: 0, gamesPlayed: 0, wins: 0, recordedGames: [] });
    }
  });
}

// Засчитывает результат завершённой партии в статистику игрока.
// Идемпотентно по gameId: повторный вызов (перезаход на экран результатов,
// второй игрок и т.п.) не задваивает очки. Транзакция гарантирует это и на разных
// устройствах. recordedGames ограничиваем по длине, чтобы массив не рос бесконечно.
export async function recordGameResult(user, gameId, score, won) {
  // Результаты гостей не записываем — они не в таблице лидеров (см. ensureProfile).
  if (!user || user.isAnonymous || !gameId) return;
  const ref = doc(db, 'users', user.uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const recorded = data.recordedGames || [];
    if (recorded.includes(gameId)) return;
    tx.set(
      ref,
      {
        uid: user.uid,
        name: user.displayName || 'Игрок',
        photo: user.photoURL || null,
        totalScore: (data.totalScore || 0) + score,
        gamesPlayed: (data.gamesPlayed || 0) + 1,
        wins: (data.wins || 0) + (won ? 1 : 0),
        recordedGames: [...recorded, gameId].slice(-100),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });
}

// Топ игроков по сумме очков.
export async function fetchLeaderboard(max = 100) {
  const q = query(collection(db, 'users'), orderBy('totalScore', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}
