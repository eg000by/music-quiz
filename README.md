# 🎵 Egorii — music quiz

> Угадай трек по короткому отрывку и год его выпуска. Один, с друзьями или со случайным соперником.

**[egorii.fun](https://egorii.fun)** — a fast, real-time music quiz. Guess a song from a short preview (and the year it came out) — solo, with friends by lobby code, or against a random opponent. Built as a free, no-backend web app on Firebase's Spark (free) plan.

The UI is bilingual (Russian / English, auto-detected).

## Features

- **Multiplayer lobbies** — create a lobby, share a 4-digit code, race in real time (2–4 players). Live "leadership pyramid" shows who's winning mid-match.
- **Быстрый матч / Quick match** — client-side matchmaking pairs you with a random opponent for a short duel (no server).
- **Daily challenge («Трек дня»)** — one shared track per day, Heardle-style: 5 tries, each unlocking a longer snippet, with a streak and shareable emoji grid.
- **Year guessing** — a second step per round: place the release year on a slider; the reveal zooms the scale to the players' guesses.
- **«Эволюция трека» mode** — the audio starts muffled and clears toward the end of the round (Web Audio API).
- **Music packs** — 16 curated packs (world hits, rock classics, Russian pop/rock, K-pop, anime openings, movie soundtracks, 90s/2000s/2010s…). Easy to extend.
- **Profiles & nicknames** — sign in with Google to set a nickname, keep a leaderboard score, and persist your daily streak across devices.
- **Friends-light** — recent co-players + one-click "play again" invites with realtime in-app toasts.
- **Leaderboard**, **privacy policy + consent banner**, **donate** button.

## Tech

- **Frontend:** React 19, Vite 8 (Rolldown), react-router-dom 7, plain JavaScript. No UI framework; a small hand-rolled i18n and icon set.
- **Backend:** Firebase — Auth (Anonymous + Google), Firestore (real-time game state), Hosting. **Spark plan only** (no Cloud Functions / Storage).
- **Audio & artwork:** the free [iTunes Search API](https://performance-partners.apple.com/search-api) (30-second previews via JSONP — no keys, no proxy).
- **Security:** App Check (reCAPTCHA v3), hardened Firestore Security Rules, strict CSP + security headers, analytics gated behind cookie consent.
- **Perf:** code-splitting, self-hosted fonts, parallel track resolution.

## Local setup

```bash
cp .env.example .env      # fill in your Firebase web config (+ optional App Check / GA / donate URL)
npm install
npm run dev               # http://localhost:5173
```

Create a Firebase project (Spark is enough), enable **Authentication → Google + Anonymous** and **Firestore Database**, then copy the web app's `firebaseConfig` values into `.env`. To test multiplayer on one machine, open a second window in a private/incognito profile.

## Deploy (Firebase Hosting, free)

```bash
npm install -g firebase-tools     # once
firebase login
# set your Project ID in .firebaserc
npm run build
firebase deploy                   # ships dist/ + firestore.rules
```

After the first deploy, add the `*.web.app` domain (and your custom domain) under **Authentication → Settings → Authorized domains** so Google sign-in works.

## Project structure

```
src/
├── pages/        Home, Lobby, Game, Results, Leaderboard, Daily, Profile, Login, Privacy
├── components/   Icon, ConsentBanner, InviteToast, QuickMatchSearch
├── context/      AuthContext (Google + anonymous, profile/nickname)
├── services/     lobby, daily, users, friends, itunes, audioEngine, clock, scoring, share, analytics
├── i18n/         ru.js, en.js, index.js (LocaleProvider, t())
├── data/         packs.js (music packs)
└── hooks/        useLobby
firestore.rules   hardened security rules
firebase.json     hosting headers + CSP, Firestore rules ref
```

## Adding music

Edit [src/data/packs.js](src/data/packs.js). Each song is `{ title, artist }` — `title` is the answer shown to players, `artist` is only used to find the track on iTunes. Min 6 songs per pack; tracks not found on iTunes are silently skipped. Give each pack a `name` (RU) and `nameEn` (EN). Duel/quick-match defaults and round counts live in [src/services/lobby.js](src/services/lobby.js).

## Notes

- Time is synced to Firestore server time so both players' round timers match.
- The host client drives round transitions, so the host's tab must stay open during a match.
- Custom mp3 uploads aren't used — Firebase Storage requires the paid Blaze plan; previews come from iTunes instead.

## License

[MIT](LICENSE) © 2026 Egorii
