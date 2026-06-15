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
import { ensureProfile, fetchProfile, saveNickname } from '../services/users';
import { track } from '../services/analytics';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // документ users/{uid} (nickname и т.п.)
  const [loading, setLoading] = useState(true);

  // Подтягиваем профиль зарегистрированного игрока, чтобы знать его никнейм.
  const loadProfile = (u) => {
    if (!u || u.isAnonymous) { setProfile(null); return; }
    fetchProfile(u.uid).then((p) => setProfile(p)).catch(() => {});
  };

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
      loadProfile(u);
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
        loadProfile(u);
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

  // Эффективное отображаемое имя: никнейм → имя Google → «Игрок».
  const nickname = profile?.nickname || null;
  const displayName = nickname || user?.displayName || 'Игрок';

  // Сохранить никнейм и сразу отразить локально (без перезагрузки профиля).
  const updateNickname = async (n) => {
    await saveNickname(user, n);
    const clean = (n || '').trim().slice(0, 24);
    setProfile((p) => ({ ...(p || { uid: user.uid }), nickname: clean }));
  };

  return (
    <AuthContext.Provider value={{ user, profile, nickname, displayName, loading, signIn, signOut, updateNickname }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
