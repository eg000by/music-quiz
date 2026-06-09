// Тонкая обёртка над Google Analytics 4 (gtag.js). Грузится только если задан
// VITE_GA_ID И пользователь дал согласие на аналитику (cookie-баннер). Без согласия
// GA не подключается, cookie не ставятся, события — no-op.
const GA_ID = import.meta.env.VITE_GA_ID;
const CONSENT_KEY = 'mq_analytics_consent';
let loaded = false;
// Запасное согласие на текущую сессию: если localStorage недоступен (приватный
// режим), выбор хотя бы не теряется до перезагрузки и баннер не появляется снова.
let memoryConsent = null;

// 'granted' | 'denied' | null (ещё не выбрал)
export function getConsent() {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v) return v;
  } catch { /* ignore */ }
  return memoryConsent;
}

export function setConsent(granted) {
  const value = granted ? 'granted' : 'denied';
  memoryConsent = value;
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* ignore */ }
  if (granted) initAnalytics();
}

export function initAnalytics() {
  if (loaded || !GA_ID || getConsent() !== 'granted' || typeof document === 'undefined') return;
  loaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  // page_view шлём вручную при смене маршрута (SPA), чтобы не задваивать первый заход
  window.gtag('config', GA_ID, { send_page_view: false });
}

// Произвольное событие воронки. Безопасно вызывать всегда (no-op без согласия/GA_ID).
export function track(event, params) {
  if (!GA_ID || getConsent() !== 'granted' || typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', event, params || {});
}

// Просмотр экрана в SPA при смене маршрута.
export function trackPage(path) {
  track('page_view', { page_path: path });
}
