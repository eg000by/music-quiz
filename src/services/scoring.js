// Логика очков и этапов отгадывания.
// Песня играет с случайного места превью. Чем раньше ответил — тем больше очков.
export const ROUND_MS = 20000;

export const STAGES = [
  { maxMs: 3000, points: 100, label: 'Этап 1 · 3 сек', short: '3с' },
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
