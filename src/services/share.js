// Шеринг: нативный диалог (Web Share API) на мобильных, копирование в буфер как
// фолбэк на десктопе. Текст и ссылку склеиваем в одну строку: часть мессенджеров
// отбрасывает text при отдельном поле url, а фолбэк раньше копировал только ссылку —
// и «поделиться результатом» теряло сам результат (счёт, emoji-сетку трека дня).
// Возвращает статус, по которому UI показывает подсказку:
//   'shared'    — открылся системный диалог и пользователь поделился;
//   'cancelled' — пользователь закрыл системный диалог;
//   'copied'    — текст с ссылкой скопирован в буфер (фолбэк);
//   'failed'    — не удалось ни поделиться, ни скопировать.
export async function shareOrCopy({ title, text, url }) {
  const payload = [text, url].filter(Boolean).join('\n');
  if (navigator.share) {
    try {
      await navigator.share({ title, text: payload });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // прочие ошибки (например, отказ в правах) — пробуем скопировать
    }
  }
  try {
    await navigator.clipboard.writeText(payload);
    return 'copied';
  } catch {
    return 'failed';
  }
}
