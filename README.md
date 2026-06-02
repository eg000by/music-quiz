# 🎵 Музыкальная викторина для двоих

Реалтайм-игра: двое игроков заходят в одно лобби по 4-значному коду, слышат одну песню одновременно и наперегонки выбирают название из 4 вариантов. Кто ответил раньше — тот получает больше очков.

- **Стек:** React + Vite, Firebase (Auth + Firestore + Hosting)
- **Музыка:** 30-секундные превью из бесплатного **iTunes Search API** (без ключей и без прокси)
- **Очки:** ответ за `<3с` → **100**, за `3–10с` → **60**, за `10–20с` → **30**, не успел → **0**

## Как играть

1. Вход через Google.
2. Игрок создаёт лобби и выбирает пак музыки → получает код.
3. Второй игрок вводит код и заходит.
4. Оба жмут «Я готов», хост запускает игру.
5. Играет случайный отрывок песни, постепенно открывается всё больше. Выбираешь ответ — раньше = больше очков.
6. В конце — статистика по игре и победитель.

---

## Локальный запуск

### 1. Создай проект Firebase
- Зайди на https://console.firebase.google.com → **Add project** (бесплатный план Spark подходит).
- Включи **Authentication** → Sign-in method → **Google** → Enable.
- Включи **Firestore Database** → Create database (production или test mode — правила зальём ниже).

### 2. Подключи конфиг
- В Firebase: **Project settings → General → Your apps → Web app (</>)** — создай веб-приложение и скопируй объект `firebaseConfig`.
- Скопируй `.env.example` в `.env` и подставь значения:

```bash
cp .env.example .env
```

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3. Запусти
```bash
npm install
npm run dev
```
Открой http://localhost:5173

> Для теста на одном компьютере открой второе окно в режиме инкогнито и войди другим Google-аккаунтом.

---

## Деплой на Firebase Hosting (бесплатно)

```bash
npm install -g firebase-tools   # один раз
firebase login

# впиши свой Project ID в .firebaserc вместо YOUR_FIREBASE_PROJECT_ID
npm run build
firebase deploy
```

Это зальёт и сайт (`dist`), и правила Firestore (`firestore.rules`).

После деплоя добавь домен `*.web.app` (его выдаст Firebase) в **Authentication → Settings → Authorized domains**, чтобы работал вход через Google.

---

## Как добавить свою музыку

Открой [src/data/packs.js](src/data/packs.js) и редактируй паки. Каждая песня — это `{ title, artist }`:
- `title` — правильный ответ, который видят игроки;
- `artist` — нужен только для поиска трека в iTunes (не показывается);
- аудио и обложка подтягиваются автоматически.

Требования:
- минимум **6 песен** в паке (нужно для 4 вариантов ответа);
- если трек не найдётся в iTunes — он молча пропустится.

Количество раундов задаётся в [src/services/lobby.js](src/services/lobby.js) (`DEFAULT_ROUNDS`, по умолчанию 8).

---

## Заметки

- **Свою загруженную музыку** (mp3) пока не используем: на бесплатном плане Firebase для Storage с конца 2024 нужен платный план Blaze. При желании позже можно добавить Firebase Storage (Blaze) или хостить файлы в другом месте.
- Синхронизация времени между устройствами идёт по часам хоста — для дружеской игры точности достаточно.
- Хост-клиент управляет сменой раундов, поэтому окно хоста должно оставаться открытым во время партии.
