// «Недавно играли вместе» + приглашение в лобби в один клик.
// Список соигроков живёт в localStorage (ноль затрат Firestore). Приглашение —
// один документ invites/{uid получателя}: клиент получателя слушает свой документ
// и показывает тост. Без пушей: работает, пока приложение открыто (Spark-friendly).
import { doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { track } from './analytics';

const KEY = 'mq_recent_players';
const MAX_RECENT = 12;

export function getRecentPlayers() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

// Запоминаем соигроков завершённой партии (кроме себя): свежие — в начало списка.
export function rememberCoPlayers(lobby, myUid) {
  try {
    const others = Object.values(lobby?.players || {}).filter((p) => p.uid && p.uid !== myUid);
    if (!others.length) return;
    const fresh = others.map((p) => ({ uid: p.uid, name: p.name, photo: p.photo || null, at: Date.now() }));
    const rest = getRecentPlayers().filter((r) => !others.some((p) => p.uid === r.uid));
    localStorage.setItem(KEY, JSON.stringify([...fresh, ...rest].slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

// Шлёт приглашение. Последующее приглашение перезаписывает предыдущее — у игрока
// актуален только один зов. fromName передаём явно (в лобби у гостя есть ник).
export async function sendInvite(toUid, code, fromUser, fromName) {
  await setDoc(doc(db, 'invites', toUid), {
    code,
    fromUid: fromUser.uid,
    fromName: fromName || fromUser.displayName || 'Игрок',
    at: serverTimestamp(),
  });
  track('friend_invite_sent');
}

export function subscribeInvite(uid, cb) {
  return onSnapshot(
    doc(db, 'invites', uid),
    (snap) => cb(snap.exists() ? snap.data() : null),
    () => {}
  );
}

export function clearInvite(uid) {
  return deleteDoc(doc(db, 'invites', uid)).catch(() => {});
}
