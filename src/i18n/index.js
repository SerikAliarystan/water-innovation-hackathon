import { dict, LANGS } from './strings.js';
import { CONFIG } from '../config.js';
import { $$ } from '../lib/dom.js';

// Язык выставляется инлайн-скриптом в <head> до отрисовки; здесь — только чтение и смена
const root = document.documentElement;
let lang = LANGS.includes(root.dataset.lang) ? root.dataset.lang : 'ru';
const listeners = new Set();

export const getLang = () => lang;

export function t(key) {
  const v = dict[lang][key] ?? dict.ru[key] ?? key;
  return v.replace('{prize}', CONFIG.prize);
}

// Подписка на смену языка: модули перерисовывают свои динамические части
export const onLangChange = (fn) => listeners.add(fn);

export function applyI18n() {
  root.lang = lang;
  root.dataset.lang = lang;
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(',').forEach((pair) => {
      const [attr, key] = pair.split(':');
      el.setAttribute(attr.trim(), t(key.trim()));
    });
  });
  $$('[data-lang-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.langBtn === lang)));
  listeners.forEach((fn) => fn(lang));
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  try { localStorage.setItem('wih-lang', lang); } catch (e) { /* приватный режим */ }
  applyI18n();
}

export function initLangSwitch() {
  $$('[data-lang-btn]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.langBtn)));
}
