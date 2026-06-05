// Шеринг ссылки: нативный диалог (Web Share API) на мобильных, копирование в буфер
// как фолбэк на десктопе. Возвращает статус, по которому UI показывает подсказку:
//   'shared'    — открылся системный диалог и пользователь поделился;
//   'cancelled' — пользователь закрыл системный диалог;
//   'copied'    — ссылка скопирована в буфер (фолбэк);
//   'failed'    — не удалось ни поделиться, ни скопировать.
export async function shareOrCopy({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // прочие ошибки (например, отказ в правах) — пробуем скопировать
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
