// Синхронизация часов с серверным временем Firestore.
// Часы двух устройств могут расходиться на десятки–сотни миллисекунд. В игре «кто
// быстрее угадает» это даёт нечестное преимущество тому, чьи часы отстают. Поэтому
// все игровые тайминги (старт раунда, момент ответа, прогресс-бар) считаются не от
// локального Date.now(), а от общего серверного «сейчас» — serverNow(), одинакового
// для обоих игроков с точностью до измеренного смещения.
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

let offset = 0; // serverNow() - Date.now()

// Измеряет смещение локальных часов относительно сервера через запись и чтение
// серверной метки времени. Пишем в lobbies/{code}, чтобы остаться в рамках текущих
// правил безопасности (отдельная коллекция требовала бы новых правил).
export async function syncClock(code, uid) {
  try {
    const ref = doc(db, 'lobbies', code);
    const t0 = Date.now();
    await updateDoc(ref, { [`clockPings.${uid}`]: serverTimestamp() });
    const t1 = Date.now();
    const snap = await getDoc(ref);
    const serverMs = snap.data()?.clockPings?.[uid]?.toMillis?.();
    if (serverMs) {
      // серверная отметка ставится примерно в момент подтверждения записи — между t0 и t1
      offset = serverMs - (t0 + t1) / 2;
    }
  } catch {
    // оставляем прежнее смещение; по умолчанию 0 — поведение как раньше
  }
  return offset;
}

// Общее серверное «сейчас» в миллисекундах.
export function serverNow() {
  return Date.now() + offset;
}

export function clockOffset() {
  return offset;
}
