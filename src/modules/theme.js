import { t, onLangChange } from '../i18n/index.js';
import { $, $$ } from '../lib/dom.js';

// Светлая / тёмная тема. Начальное значение выставляет инлайн-скрипт в <head> (без мигания).

const COLORS = { light: '#f5fafa', dark: '#04161b' };
const root = document.documentElement;

export const getTheme = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');

export function initTheme({ onChange } = {}) {
  const sync = () => {
    const theme = getTheme();
    // подпись кнопки — действие, которое она выполнит
    $$('[data-theme-btn]').forEach((b) => b.setAttribute('aria-label', t(theme === 'dark' ? 'theme.light' : 'theme.dark')));
    $('[data-theme-color]')?.setAttribute('content', COLORS[theme]);
  };

  $$('[data-theme-btn]').forEach((b) => b.addEventListener('click', () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('wih-theme', next); } catch (e) { /* приватный режим */ }
    sync();
    onChange?.(next);
  }));

  onLangChange(sync);
  sync();
}
