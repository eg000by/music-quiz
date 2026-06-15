// Профили игроков и таблица лидеров.
// Документ users/{uid} хранит накопительную статистику по всем сыгранным партиям.
import {
  doc,
  collection,
  query,
  orderBy,
  limit,
  getDoc,
  getDocs,
  setDoc,
  increment,
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
  // Без транзакции: merge обновляет имя/фото, а increment(0) создаёт счётчики при
  // первом входе и не меняет их потом. Идемпотентно и устойчиво к гонкам — двойной
  // вызов при входе (signIn + onAuthStateChanged после link) больше не роняет commit
  // с failed-precondition, как это делала транзакция.
  await setDoc(
    ref,
    {
      uid: user.uid,
      name: user.displayName || 'Игрок',
      photo: user.photoURL || null,
      totalScore: increment(0),
      gamesPlayed: increment(0),
      wins: increment(0),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
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

// Никнейм зарегистрированного игрока (анонимам не пишем — у них авто «Игрок N»).
// Имя в users.{name} остаётся именем из Google (это ключ-идентичность лидерборда);
// отображаем nickname || name.
export async function saveNickname(user, nickname) {
  if (!user || user.isAnonymous) return;
  const clean = (nickname || '').trim().slice(0, 24);
  await setDoc(
    doc(db, 'users', user.uid),
    { uid: user.uid, nickname: clean, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// Профиль игрока (нужен «Треку дня», чтобы подтянуть стрик с другого устройства).
export async function fetchProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

// Сохраняет стрик «Трека дня» в профиль зарегистрированного игрока, чтобы он
// не терялся при смене устройства/браузера. Гостям профиль не пишем (см. ensureProfile).
export async function saveDailyStreak(user, count, last) {
  if (!user || user.isAnonymous || !count || !last) return;
  await setDoc(
    doc(db, 'users', user.uid),
    { uid: user.uid, dailyStreak: count, dailyLast: last, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// Топ игроков по сумме очков.
export async function fetchLeaderboard(max = 100) {
  const q = query(collection(db, 'users'), orderBy('totalScore', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}
