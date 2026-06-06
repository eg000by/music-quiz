// Тонкая обёртка над Google Analytics 4 (gtag.js). Грузится только если задан
// VITE_GA_ID — без него все вызовы безопасно превращаются в no-op (как App Check).
const GA_ID = import.meta.env.VITE_GA_ID;
let loaded = false;

export function initAnalytics() {
  if (loaded || !GA_ID || typeof document === 'undefined') return;
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

// Произвольное событие воронки. Безопасно вызывать всегда (no-op без GA_ID).
export function track(event, params) {
  if (!GA_ID || typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', event, params || {});
}

// Просмотр экрана в SPA при смене маршрута.
export function trackPage(path) {
  track('page_view', { page_path: path });
}
