// Инициализация Firebase. Значения берутся из .env (см. .env.example).
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// App Check: запросы к Firestore принимаются только от настоящего приложения, боты
// отсекаются — это главная защита бесплатной квоты от выжигания. Инициализируем сразу
// после приложения, до остальных сервисов. Без ключа reCAPTCHA (VITE_APPCHECK_SITE_KEY)
// блок пропускается, чтобы локальная сборка работала до настройки в консоли.
// Включается enforcement отдельно в Firebase Console → App Check.
const appCheckKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
if (appCheckKey) {
  // Для локальной разработки: VITE_APPCHECK_DEBUG=true печатает в консоль debug-токен,
  // который нужно один раз зарегистрировать в Console → App Check → Debug tokens.
  if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG === 'true') {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
