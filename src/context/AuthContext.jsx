import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup,
  signInAnonymously,
  linkWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { ensureProfile } from '../services/users';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setLoading(false);
        ensureProfile(u).catch(() => {});
      } else {
        // Гостевой вход без экрана логина: если пользователя нет — входим анонимно.
        // Следующий onAuthStateChanged придёт уже с анонимным user (loading снимется там).
        signInAnonymously(auth).catch(() => setLoading(false));
      }
    });
  }, []);

  // Вход через Google. Если сейчас гость (анонимный) — привязываем Google к тому же
  // аккаунту, чтобы сохранить uid и накопленный счёт; иначе обычный вход.
  const signIn = async () => {
    const cur = auth.currentUser;
    if (cur && cur.isAnonymous) {
      try {
        const res = await linkWithPopup(cur, googleProvider);
        setUser(res.user);
        ensureProfile(res.user).catch(() => {});
        return;
      } catch (e) {
        // этот Google уже привязан к другому профилю — тогда просто входим им
        if (e?.code !== 'auth/credential-already-in-use' && e?.code !== 'auth/email-already-in-use') {
          throw e;
        }
      }
    }
    const res = await signInWithPopup(auth, googleProvider);
    setUser(res.user);
    ensureProfile(res.user).catch(() => {});
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
