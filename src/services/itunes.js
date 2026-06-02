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

// Ищет один трек по { title, artist }. Возвращает лучший результат с превью или null.
export async function searchTrack({ title, artist }) {
  const term = encodeURIComponent(`${artist} ${title}`.trim());
  const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=8`;
  const data = await jsonp(url);
  const results = (data.results || []).filter((r) => r.previewUrl);
  if (results.length === 0) return null;

  // Предпочитаем результат, чьё название максимально похоже на искомое.
  const want = title.toLowerCase();
  results.sort((a, b) => {
    const sa = (a.trackName || '').toLowerCase().includes(want) ? 0 : 1;
    const sb = (b.trackName || '').toLowerCase().includes(want) ? 0 : 1;
    return sa - sb;
  });

  const best = results[0];
  return {
    trackId: best.trackId,
    title: best.trackName,
    artist: best.artistName,
    previewUrl: best.previewUrl,
    artwork: hiResArtwork(best.artworkUrl100),
  };
}
