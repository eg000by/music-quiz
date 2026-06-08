import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithRedirect,
  linkWithRedirect,
  getRedirectResult,
  signInAnonymously,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { ensureProfile } from '../services/users';
import { track } from '../services/analytics';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Завершаем редирект-вход, если вернулись от Google (попапы на мобильных блокируются).
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          ensureProfile(res.user).catch(() => {});
          track('sign_in', { method: 'google' });
        }
      })
      .catch(() => { /* напр. credential-already-in-use при link гостя — игнорируем */ });

    return onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setLoading(false);
        ensureProfile(u).catch(() => {});
      } else {
        // Гостевой вход без экрана логина: если пользователя нет — входим анонимно.
        signInAnonymously(auth).catch(() => setLoading(false));
      }
    });
  }, []);

  // Вход через Google редиректом (надёжно на мобильных, в отличие от попапа).
  // Гостя привязываем к тому же аккаунту через linkWithRedirect — uid и счёт сохраняются.
  // Оба метода уводят страницу на Google и возвращают обратно; завершает вход
  // getRedirectResult выше.
  const signIn = async () => {
    const cur = auth.currentUser;
    if (cur && cur.isAnonymous) {
      await linkWithRedirect(cur, googleProvider);
    } else {
      await signInWithRedirect(auth, googleProvider);
    }
  };

  const signOut = () => fbSignOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
