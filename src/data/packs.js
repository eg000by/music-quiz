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
  {
    id: 'dota2-2025',
    name: 'Дота 2 2025',
    icon: 'zap',
    songs: [
      { title: 'автозаправка', artist: 'тёмный принц' },
      { title: 'цветы', artist: 'тёмный принц' },
      { title: 'New-York', artist: '9mice' },
      { title: 'sugar', artist: '9mice' },
      { title: 'CHAINSAW', artist: '9mice' },
      { title: 'GOD SYSTEM', artist: 'Kai Angel' },
      { title: 'Limousine Music', artist: 'Kai Angel' },
      { title: 'питер паркер', artist: 'madk1d' },
      { title: 'крылья', artist: 'greyrock' },
      { title: 'снайпер', artist: 'tewiq' },
    ],
  },
  {
    id: 'ru-2017',
    name: 'Русская музыка 2017',
    icon: 'music',
    songs: [
      { title: 'Кружит', artist: 'MONATIK' },
      { title: 'Навернопотомучто', artist: 'Время и Стекло' },
      { title: 'Тролль', artist: 'Время и Стекло' },
      { title: 'Невеста', artist: 'Егор Крид' },
      { title: 'Хлопья летят наверх', artist: 'Feduk' },
      { title: 'Улети', artist: 'T-Fest' },
      { title: 'Малиновый закат', artist: 'Макс Корж' },
      { title: 'Малиновый свет', artist: 'Леша Свик' },
      { title: 'Держи', artist: 'Дима Билан' },
      { title: 'Капкан', artist: 'Мот' },
    ],
  },
  {
    id: 'platina',
    name: 'Платина',
    icon: 'crown',
    songs: [
      { title: 'Бандана', artist: 'Платина' },
      { title: 'Веном', artist: 'Платина' },
      { title: 'Ламбо', artist: 'Платина' },
      { title: 'Бэнтли, Бенз и Бумер', artist: 'Платина' },
      { title: 'Айсберг', artist: 'Платина' },
      { title: 'Питер Пэн', artist: 'Платина' },
      { title: 'НЕО', artist: 'Платина' },
      { title: 'Бритни Спирс', artist: 'Платина' },
      { title: 'Сердце для шалав', artist: 'Платина' },
      { title: 'Нотр-Дам Париж', artist: 'Платина' },
    ],
  },
];

export function getPack(id) {
  return PACKS.find((p) => p.id === id) || null;
}
