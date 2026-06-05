// Единый слой доступа к трекам. Игровая логика и компоненты работают ТОЛЬКО через
// него и не знают, откуда берутся треки. Сейчас источник — бесплатный iTunes Search
// API; сменить его (на Firestore, собственный бэкенд, Apple Music и т.п.) можно
// правкой только этого модуля, не трогая остальной код.
//
// Контракт:
//   searchTrack({ title, artist }) -> Promise<Track | null>
//
//   Track = {
//     trackId,            // идентификатор трека в источнике
//     title,              // правильный ответ (название), который видит игрок
//     artist,             // исполнитель
//     previewUrl,         // 30-сек превью; обязателен — без него трек в игру не берётся
//     artwork,            // URL обложки или null
//     year,               // год выпуска (number) или null, если источник его не отдал
//   }
//
// Возвращает null, если трек не найден или у него нет превью.

import { searchTrack as itunesSearchTrack } from './itunes';

export function searchTrack(song) {
  return itunesSearchTrack(song);
}
