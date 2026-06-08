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
    // ВАЖНО: при возврате с Google onAuthStateChanged может сработать с null ДО того,
    // как getRedirectResult завершит вход. Если в этот момент сразу войти анонимно —
    // результат входа через Google потеряется (и вход «молча не работает»). Поэтому
    // анонимный вход откладываем до завершения обработки редиректа.
    let redirectResolved = false;
    let pendingAnon = false;

    const anonIfNeeded = () => {
      if (!auth.currentUser) signInAnonymously(auth).catch(() => setLoading(false));
    };

    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          // setUser напрямую: при linkWithRedirect uid не меняется, поэтому
          // onAuthStateChanged может не сработать, и UI остался бы «гостевым».
          setUser(res.user);
          setLoading(false);
          ensureProfile(res.user).catch(() => {});
          track('sign_in', { method: 'google' });
        }
      })
      .catch(() => { /* напр. credential-already-in-use при link гостя — игнорируем */ })
      .finally(() => {
        redirectResolved = true;
        if (pendingAnon) anonIfNeeded();
      });

    return onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setLoading(false);
        ensureProfile(u).catch(() => {});
      } else if (redirectResolved) {
        anonIfNeeded();
      } else {
        // ждём getRedirectResult, чтобы не перебить незавершённый вход через Google
        pendingAnon = true;
      }
    });
  }, []);

  // Вход через Google редиректом (надёжно на мобильных, в отличие от попапа).
  // Гостя привязываем к тому же аккаунту через linkWithRedirect — uid и счёт сохраняются.
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
