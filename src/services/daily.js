// «Трек дня» — ежедневный челлендж в духе Heardle: один общий трек в день для всех,
// с каждой попыткой открывается более длинный кусок превью. Трек выбирается
// детерминированно по номеру дня из пула всех паков — сервера и записей в Firestore
// не нужно (важно для квоты Spark). Прогресс и стрик живут в localStorage.
import { PACKS } from '../data/packs';
import { searchTrack } from './tracksService';

// Секунды открытого превью на каждую попытку и очки за угадывание с этой попытки.
export const SNIPPETS = [2, 4, 7, 11, 16];
export const POINTS = [100, 75, 50, 30, 15];
export const MAX_TRIES = SNIPPETS.length;

// День #1 — 9 июня 2026. Месяцы в Date с нуля.
const EPOCH = new Date(2026, 5, 8);

const STATE_KEY = 'mq_daily_state';
const STREAK_KEY = 'mq_daily_streak';

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayNumber(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // round, а не floor — съедает сдвиг на час при переходе на летнее/зимнее время
  return Math.round((start - EPOCH) / 864e5);
}

// Детерминированный PRNG: одинаковый день → одинаковый трек у всех игроков.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Общий пул: все песни всех паков без дублей. ВАЖНО: добавление паков меняет
// раскладку треков по дням — это ок, но не редактируй пул ради «подмены» трека дня.
export function allSongs() {
  const seen = new Set();
  const songs = [];
  PACKS.forEach((p) => {
    p.songs.forEach((s) => {
      const key = `${s.title}|${s.artist}`.toLowerCase();
      if (!seen.has(key)) { seen.add(key); songs.push(s); }
    });
  });
  return songs;
}

// Песня дня + её трек из iTunes. Если трек дня не нашёлся (iTunes мог не отдать
// превью) — детерминированно пробуем следующих кандидатов, чтобы у всех игроков
// всё равно совпал итоговый трек.
export async function resolveDailyTrack(day = dayNumber()) {
  const pool = allSongs();
  const idx = Math.floor(mulberry32(day)() * pool.length);
  for (let i = 0; i < Math.min(10, pool.length); i++) {
    const song = pool[(idx + i) % pool.length];
    try {
      const track = await searchTrack(song);
      if (track?.previewUrl) return { song, track };
    } catch {
      // кандидат не нашёлся — пробуем следующего
    }
  }
  throw new Error('Не удалось загрузить трек дня');
}

// Состояние сегодняшней партии: { date, day, guesses: [{t:'s'|'w'|'c', title?}], done, won, score }.
export function loadDailyState() {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY));
    return s && s.date === dateKey() ? s : null;
  } catch {
    return null;
  }
}

export function saveDailyState(s) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// Стрик — подряд сыгранные дни (не обязательно победные: ценность в ритуале).
export function getStreak() {
  try {
    const s = JSON.parse(localStorage.getItem(STREAK_KEY));
    if (!s) return 0;
    const today = dateKey();
    const yesterday = dateKey(new Date(Date.now() - 864e5));
    return s.last === today || s.last === yesterday ? s.count : 0;
  } catch {
    return 0;
  }
}

// Слияние стрика из профиля (другое устройство) с локальным. Берём более «живой»
// и длинный; если сегодня уже сыграно локально, а профиль кончается вчера —
// профильный стрик продолжается сегодняшней партией (+1).
export function adoptStreak(last, count) {
  try {
    const today = dateKey();
    const yesterday = dateKey(new Date(Date.now() - 864e5));
    if (!count || (last !== today && last !== yesterday)) return;
    const s = JSON.parse(localStorage.getItem(STREAK_KEY) || 'null');
    const localAlive = s && (s.last === today || s.last === yesterday);
    if (!localAlive) {
      localStorage.setItem(STREAK_KEY, JSON.stringify({ last, count }));
    } else if (s.last === today && last === yesterday) {
      localStorage.setItem(STREAK_KEY, JSON.stringify({ last: today, count: Math.max(s.count, count + 1) }));
    } else {
      const newLast = s.last >= last ? s.last : last;
      localStorage.setItem(STREAK_KEY, JSON.stringify({ last: newLast, count: Math.max(s.count, count) }));
    }
  } catch { /* ignore */ }
}

// Засчитывает сегодняшнюю партию в стрик. Идемпотентно в рамках дня.
export function bumpStreak() {
  try {
    const today = dateKey();
    const yesterday = dateKey(new Date(Date.now() - 864e5));
    const s = JSON.parse(localStorage.getItem(STREAK_KEY) || 'null');
    const count = s && s.last === today ? s.count
      : s && s.last === yesterday ? s.count + 1
      : 1;
    localStorage.setItem(STREAK_KEY, JSON.stringify({ last: today, count }));
    return count;
  } catch {
    return 1;
  }
}

// Emoji-результат для шеринга: ⬛ пропуск, 🟥 мимо, 🟩 угадал, ⬜ не понадобилось.
export function shareText(state) {
  const cell = { s: '⬛', w: '🟥', c: '🟩' };
  const row = state.guesses.map((g) => cell[g.t] || '⬜').join('')
    + '⬜'.repeat(Math.max(0, MAX_TRIES - state.guesses.length));
  const tail = state.won ? `${state.score} очков` : 'не угадал';
  return `Egorii · Трек дня #${state.day}\n${row} · ${tail}`;
}
