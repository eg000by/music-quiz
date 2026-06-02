// Паки музыки. Это курируемые списки песен.
// Аудио (30-сек превью) и обложки подтягиваются из iTunes по полям title + artist.
//
// Как редактировать:
//  - В каждом паке должно быть минимум 6 песен (нужно для 4 вариантов ответа).
//  - title — это правильный ответ, который увидят игроки.
//  - artist используется только для поиска нужного трека в iTunes (игрокам не показывается).
//  - Если какой-то трек не найдётся в iTunes — он просто пропустится.

export const PACKS = [
  {
    id: 'world-hits',
    name: 'Мировые хиты',
    icon: 'globe',
    songs: [
      { title: 'Billie Jean', artist: 'Michael Jackson' },
      { title: 'Bohemian Rhapsody', artist: 'Queen' },
      { title: 'Shape of You', artist: 'Ed Sheeran' },
      { title: 'Rolling in the Deep', artist: 'Adele' },
      { title: 'Smells Like Teen Spirit', artist: 'Nirvana' },
      { title: 'Bad Guy', artist: 'Billie Eilish' },
      { title: 'Uptown Funk', artist: 'Mark Ronson Bruno Mars' },
      { title: 'Believer', artist: 'Imagine Dragons' },
      { title: 'Blinding Lights', artist: 'The Weeknd' },
      { title: 'Hey Jude', artist: 'The Beatles' },
    ],
  },
  {
    id: 'rock-classics',
    name: 'Рок-классика',
    icon: 'zap',
    songs: [
      { title: 'Sweet Child O Mine', artist: 'Guns N Roses' },
      { title: 'Back In Black', artist: 'AC/DC' },
      { title: 'Stairway to Heaven', artist: 'Led Zeppelin' },
      { title: 'Enter Sandman', artist: 'Metallica' },
      { title: 'Highway to Hell', artist: 'AC/DC' },
      { title: 'Wonderwall', artist: 'Oasis' },
      { title: 'Numb', artist: 'Linkin Park' },
      { title: 'Seven Nation Army', artist: 'The White Stripes' },
      { title: 'Zombie', artist: 'The Cranberries' },
      { title: 'Should I Stay or Should I Go', artist: 'The Clash' },
    ],
  },
  {
    id: 'ru-pop',
    name: 'Русская эстрада и поп',
    icon: 'star',
    songs: [
      { title: 'Я свободен', artist: 'Кипелов' },
      { title: 'Звезда по имени Солнце', artist: 'Кино' },
      { title: 'Владимирский централ', artist: 'Михаил Круг' },
      { title: 'Розовое вино', artist: 'Элджей Feduk' },
      { title: 'Экспонат', artist: 'Ленинград' },
      { title: 'Лабиринт', artist: 'ВИА Гра' },
      { title: 'Тает лёд', artist: 'Грибы' },
      { title: 'Минимал', artist: 'Therr Maitz' },
      { title: 'Лети за солнцем', artist: 'Винтаж' },
      { title: 'Сансара', artist: 'Баста' },
    ],
  },
];

export function getPack(id) {
  return PACKS.find((p) => p.id === id) || null;
}
