// Логика очков и этапов отгадывания.
// Песня играет с случайного места превью. Чем раньше ответил — тем больше очков.
export const ROUND_MS = 20000;

// Когда ответили оба игрока, раунд не завершается мгновенно: музыка играет ещё
// немного, и за это время можно поменять свой ответ.
export const BOTH_ANSWERED_EXTRA_MS = 5000;

// Длительность фазы показа правильного ответа (чтобы успеть прочитать результат).
export const REVEAL_MS = 5000;

export const STAGES = [
  { maxMs: 5000, points: 100, label: 'Этап 1 · 5 сек', short: '5с' },
  { maxMs: 10000, points: 60, label: 'Этап 2 · 10 сек', short: '10с' },
  { maxMs: 20000, points: 30, label: 'Этап 3 · 20 сек', short: '20с' },
];

// Возвращает индекс этапа (0,1,2) или -1 если время вышло.
export function stageForElapsed(ms) {
  if (ms < STAGES[0].maxMs) return 0;
  if (ms < STAGES[1].maxMs) return 1;
  if (ms < STAGES[2].maxMs) return 2;
  return -1;
}

export function pointsForElapsed(ms) {
  const s = stageForElapsed(ms);
  return s === -1 ? 0 : STAGES[s].points;
}

// === Второй шаг раунда: угадывание года выпуска ===
// Очки за год начисляются отдельно и складываются с очками за название.
// Шкала ползунка: 1950 — текущий год.
export const MIN_YEAR = 1950;
export const MAX_YEAR_POINTS = 50; // вдвое меньше максимума за мгновенный ответ по названию
export const YEAR_TOLERANCE = 10;  // за пределами ±10 лет промах не приносит очков

// Близостный (не бинарный) балл: точное попадание — максимум, дальше линейно
// −5 очков за каждый год промаха, за пределами допуска — 0.
// 0 лет → 50, ±1 → 45, ±2 → 40, … ±9 → 5, ≥±10 → 0.
// Линейная шкала выбрана намеренно: её легко объяснить игроку прямо в UI
// («точный год +50, дальше меньше»).
export function yearPoints(guess, actual) {
  if (guess == null || actual == null) return 0;
  const diff = Math.abs(guess - actual);
  if (diff >= YEAR_TOLERANCE) return 0;
  return Math.round(MAX_YEAR_POINTS * (1 - diff / YEAR_TOLERANCE));
}
