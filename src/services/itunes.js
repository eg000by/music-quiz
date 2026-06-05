// Поиск треков через бесплатный iTunes Search API.
// API не отдаёт CORS-заголовки стабильно, поэтому используем JSONP (?callback=...).
// Это работает прямо из браузера без прокси и без ключей.

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = 'itunes_cb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('iTunes timeout'));
    }, 10000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[cb];
      script.remove();
    }

    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('iTunes error'));
    };

    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;
    document.body.appendChild(script);
  });
}

function hiResArtwork(url) {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb?\./, '/300x300bb.');
}

// Год выпуска из releaseDate каталога iTunes (ISO-строка вида "2011-08-01T07:00:00Z").
// Может отсутствовать у части треков — тогда фича угадывания года для раунда отключается.
function releaseYear(r) {
  if (!r.releaseDate) return null;
  const y = new Date(r.releaseDate).getFullYear();
  return Number.isFinite(y) ? y : null;
}

function toTrack(r) {
  return {
    trackId: r.trackId,
    title: r.trackName,
    artist: r.artistName,
    previewUrl: r.previewUrl,
    artwork: hiResArtwork(r.artworkUrl100),
    year: releaseYear(r),
  };
}

// Обычный поиск по строке «artist title». Возвращает массив результатов с превью.
async function termSearch(title, artist) {
  const term = encodeURIComponent(`${artist} ${title}`.trim());
  const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=8`;
  const data = await jsonp(url);
  return (data.results || []).filter((r) => r.previewUrl);
}

// Каталог артиста через lookup по artistId. Многие треки (особенно русский андеграунд)
// не выдаются обычным поиском, но доступны в каталоге артиста с превью. Кэшируем по
// имени артиста, чтобы для пака из 10 песен одного исполнителя сходить в API один раз.
const artistCatalogCache = new Map();

async function getArtistCatalog(artist) {
  const key = artist.trim().toLowerCase();
  if (artistCatalogCache.has(key)) return artistCatalogCache.get(key);
  let catalog = null;
  try {
    const aUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&entity=musicArtist&limit=1`;
    const aData = await jsonp(aUrl);
    const artistId = aData.results?.[0]?.artistId;
    if (artistId) {
      const lUrl = `https://itunes.apple.com/lookup?id=${artistId}&entity=song&limit=200`;
      const lData = await jsonp(lUrl);
      catalog = (lData.results || []).filter((r) => r.wrapperType === 'track' && r.previewUrl);
    }
  } catch {
    catalog = null;
  }
  artistCatalogCache.set(key, catalog);
  return catalog;
}

// Ищет один трек по { title, artist }. Возвращает результат с превью или null.
// Стратегия: 1) точное совпадение названия в обычном поиске; 2) поиск в каталоге
// артиста (находит то, что обычный поиск пропускает); 3) лучший результат поиска.
export async function searchTrack({ title, artist }) {
  const want = title.toLowerCase();
  let results;
  try {
    results = await termSearch(title, artist);
  } catch {
    results = [];
  }

  const exact = results.find((r) => (r.trackName || '').toLowerCase().includes(want));
  if (exact) return toTrack(exact);

  const catalog = await getArtistCatalog(artist);
  const catExact = catalog?.find((r) => (r.trackName || '').toLowerCase().includes(want));
  if (catExact) return toTrack(catExact);

  // Крайний случай — лучший результат обычного поиска (как было раньше).
  return results.length ? toTrack(results[0]) : null;
}
