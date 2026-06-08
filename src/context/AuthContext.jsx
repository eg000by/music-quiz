import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithRedirect,
  linkWithRedirect,
  getRedirectResult,
  signInWithCredential,
  signInAnonymously,
  GoogleAuthProvider,
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
    // При возврате с Google onAuthStateChanged может сработать с null ДО завершения
    // getRedirectResult. Если в этот момент войти анонимно — результат Google потеряется.
    // Поэтому анонимный вход откладываем до завершения обработки редиректа.
    let redirectResolved = false;
    let pendingAnon = false;

    const anonIfNeeded = () => {
      if (!auth.currentUser) signInAnonymously(auth).catch(() => setLoading(false));
    };

    // setUser напрямую: при linkWithRedirect uid не меняется → onAuthStateChanged может
    // не сработать, и UI остался бы «гостевым».
    const applyGoogleUser = (u) => {
      setUser(u);
      setLoading(false);
      ensureProfile(u).catch(() => {});
      track('sign_in', { method: 'google' });
    };

    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) applyGoogleUser(res.user);
      })
      .catch((error) => {
        // Гость привязывает Google, который уже привязан к другому аккаунту (этот
        // пользователь раньше входил через Google) → входим в существующий аккаунт
        // по credential из ошибки.
        const cred = GoogleAuthProvider.credentialFromError(error);
        if (cred && (error?.code === 'auth/credential-already-in-use'
          || error?.code === 'auth/email-already-in-use')) {
          return signInWithCredential(auth, cred).then((res) => applyGoogleUser(res.user));
        }
      })
      .catch(() => { /* и тут не падаем — просто останемся гостем */ })
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
