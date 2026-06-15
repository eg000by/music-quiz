// Лёгкий свой i18n (без библиотеки): два словаря ru/en, t(key, params) с
// подстановкой {param} и функциями-значениями для множественного числа.
import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react';
import ru from './ru';
import en from './en';

const DICTS = { ru, en };
const KEY = 'mq_locale';

function detect() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'ru' || saved === 'en') return saved;
  } catch { /* ignore */ }
  const nav = ((typeof navigator !== 'undefined' && navigator.language) || 'ru').toLowerCase();
  return nav.startsWith('en') ? 'en' : 'ru';
}

// Текущая локаль для не-React сервисов (daily.shareText): читаем из localStorage
// напрямую — setLocale пишет туда же, так что значение всегда актуально.
export function getLocale() { return detect(); }

export function translate(locale, key, params) {
  const dict = DICTS[locale] || DICTS.ru;
  let v = dict[key];
  if (v === undefined) v = DICTS.ru[key]; // фолбэк на русский
  if (v === undefined) return key;        // затем на сам ключ
  if (typeof v === 'function') return v(params || {});
  if (params) return v.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? params[k] : `{${k}}`));
  return v;
}

// Перевод для сервисов вне React.
export function tg(key, params) { return translate(detect(), key, params); }

const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(detect);
  useEffect(() => { try { document.documentElement.lang = locale; } catch { /* ignore */ } }, [locale]);
  const setLocale = (l) => {
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    setLocaleState(l);
  };
  const t = useCallback((key, params) => translate(locale, key, params), [locale]);
  // createElement, а не JSX, чтобы файл оставался .js (без JSX-трансформации).
  return createElement(LocaleContext.Provider, { value: { locale, setLocale, t } }, children);
}

export const useLocale = () => useContext(LocaleContext);
export const useT = () => useContext(LocaleContext).t;
export { ruPlural, enPlural } from './plural';
