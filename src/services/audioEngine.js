// Движок режима «Эволюция трека» на Web Audio API.
// Превью грузится как AudioBuffer и играется через лоупасс-фильтр, частота среза
// которого экспоненциально растёт по ходу раунда: старт — глухой звук (как из-за
// стены), к концу — полный спектр. Автоматизация привязана к прошедшему серверному
// времени раунда, поэтому у всех игроков одинаковая «чёткость» в один и тот же момент.

const MIN_FREQ = 250;    // Гц — самый глухой старт
const MAX_FREQ = 20000;  // Гц — чистый звук

let ctx = null;
function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

// iOS не запускает Web Audio, пока в рамках пользовательского жеста не проиграть
// хоть какой-то звук. Дёргаем это на первом касании/клике — после этого режим
// «Эволюция трека» (Web Audio) играет и в последующих раундах без overlay.
let unlocked = false;
export function unlockAudio() {
  if (unlocked) return;
  const c = audioCtx();
  try {
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  } catch { /* ignore */ }
  if (c.state === 'suspended') c.resume().catch(() => {});
  unlocked = true;
}

const cache = new Map(); // url -> AudioBuffer | Promise<AudioBuffer>

// Загружает и декодирует превью (с кешем). CORS у превью iTunes разрешён (`*`).
export async function preload(url) {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url);
  const p = fetch(url)
    .then((r) => r.arrayBuffer())
    .then((a) => audioCtx().decodeAudioData(a));
  cache.set(url, p);
  try {
    const buf = await p;
    cache.set(url, buf);
    return buf;
  } catch (e) {
    cache.delete(url);
    throw e;
  }
}

// Частота среза для прогресса 0..1 (экспоненциально — частоты слышим логарифмически).
function freqForProgress(progress) {
  const p = Math.min(1, Math.max(0, progress));
  return MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, p);
}

export class EvolutionPlayer {
  constructor() {
    const c = audioCtx();
    this.ctx = c;
    this.gain = c.createGain();
    this.filter = c.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0.7;
    this.filter.connect(this.gain);
    this.gain.connect(c.destination);
    this.source = null;
    this.volume = 1;
  }

  setVolume(v) {
    this.volume = v;
    try {
      this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    } catch {
      this.gain.gain.value = v;
    }
  }

  async resume() {
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch { /* заблокировано до жеста пользователя */ }
    }
    return this.ctx.state === 'running';
  }

  // Запуск/перезапуск раунда синхронно по времени. Возвращает true, если звук пошёл
  // (false → автоплей заблокирован, нужен жест пользователя).
  async play(url, { elapsedMs, roundMs, offsetSec }) {
    // resume() инициируем СИНХРОННО, до await preload — иначе на iOS теряется
    // пользовательский жест и AudioContext остаётся suspended (звук не идёт).
    const resuming = this.resume();
    let buffer;
    try {
      buffer = await preload(url);
    } catch {
      return false;
    }
    if (!buffer) return false;
    const running = await resuming;
    this._stopSource();

    const now = this.ctx.currentTime;
    const progress = roundMs > 0 ? elapsedMs / roundMs : 1;
    const remainingSec = Math.max(0, (roundMs - elapsedMs) / 1000);

    const f = this.filter.frequency;
    f.cancelScheduledValues(now);
    f.setValueAtTime(freqForProgress(progress), now);
    if (remainingSec > 0.05) f.exponentialRampToValueAtTime(MAX_FREQ, now + remainingSec);
    else f.setValueAtTime(MAX_FREQ, now);

    this.gain.gain.setValueAtTime(this.volume, now);

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.filter);
    const into = Math.min(
      offsetSec + Math.max(0, elapsedMs / 1000),
      Math.max(0, buffer.duration - 0.05)
    );
    try { src.start(now, into); } catch { /* ignore */ }
    this.source = src;
    return running;
  }

  // Reveal: быстро уводим фильтр в чистый звук, песня доигрывает.
  reveal() {
    const now = this.ctx.currentTime;
    const f = this.filter.frequency;
    try { f.cancelAndHoldAtTime(now); } catch { f.cancelScheduledValues(now); }
    f.exponentialRampToValueAtTime(MAX_FREQ, now + 0.35);
  }

  _stopSource() {
    if (this.source) {
      try { this.source.onended = null; this.source.stop(); } catch { /* ignore */ }
      try { this.source.disconnect(); } catch { /* ignore */ }
      this.source = null;
    }
  }

  stop() { this._stopSource(); }

  dispose() {
    this._stopSource();
    try { this.filter.disconnect(); } catch { /* ignore */ }
    try { this.gain.disconnect(); } catch { /* ignore */ }
  }
}
