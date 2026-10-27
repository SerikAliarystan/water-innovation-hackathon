import { dict, LANGS } from './strings.js';
import { $$, esc } from '../lib/dom.js';

// Язык выставляется инлайн-скриптом в <head> до отрисовки; здесь — только чтение и смена
const root = document.documentElement;
let lang = LANGS.includes(root.dataset.lang) ? root.dataset.lang : 'ru';
const listeners = new Set();

const NBSP = '\u00A0';
// Короткие служебные слова, которые не должны оставаться в конце строки
const SHORT = /(^|[\s(«"*])((?:[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]{1,2})|для|без|при|над|под|или|как|что|это|the|and|for|of|to|by)\s+/giu;

// Типографика для всех языков: неразрывные пробелы перед тире, после коротких слов и между числом и словом
function typo(s) {
  return s
    .replace(/\s+([—–])\s+/g, `${NBSP}$1 `)
    .replace(SHORT, (m, pre, word) => `${pre}${word}${NBSP}`)
    .replace(SHORT, (m, pre, word) => `${pre}${word}${NBSP}`) // второй проход: «и в», «до 18»
    .replace(/(\d)\s+(?=[^\s\d])/g, `$1${NBSP}`);
}

export const getLang = () => lang;

export function t(key) {
  const v = dict[lang][key] ?? dict.ru[key] ?? key;
  return typo(v);
}

// Подписка на смену языка: модули перерисовывают свои динамические части
export const onLangChange = (fn) => listeners.add(fn);

// *текст* в строке перевода — акцент курсивом; остальное экранируется
function render(el, text) {
  if (text.includes('*')) el.innerHTML = esc(text).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  else el.textContent = text;
}

export function applyI18n() {
  root.lang = lang;
  root.dataset.lang = lang;
  $$('[data-i18n]').forEach((el) => {
    const text = t(el.dataset.i18n);
    if (el.tagName === 'TITLE') document.title = text.replace(/\*/g, '');
    else render(el, text);
  });
  $$('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(',').forEach((pair) => {
      const [attr, key] = pair.split(':');
      el.setAttribute(attr.trim(), t(key.trim()).replace(/\*/g, ''));
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
