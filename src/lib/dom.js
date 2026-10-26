// Общие DOM-утилиты и пользовательские настройки среды

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

// Экранирование пользовательских значений перед вставкой в разметку
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Однократная CSS-анимация элемента, который удаляется по её окончании
export function burst(parent, className, x, y) {
  const el = document.createElement('span');
  el.className = className;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  parent.append(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
  return el;
}

// Один rAF на кадр для частых событий (scroll, resize)
export function rafThrottle(fn) {
  let queued = false;
  return (...args) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(...args); });
  };
}
