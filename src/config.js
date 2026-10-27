// Настройки, которые меняет организатор. Пересборка: npm run build.

export const CONFIG = {
  // URL веб-приложения Google Apps Script (см. backend/README.md).
  // Пусто — демо-режим: заявки сохраняются только в браузере (localStorage).
  submitEndpoint: '',

  contactEmail: 'hello@example.kz',
  telegramUrl: '',
  privacyUrl: '#',
  rulesUrl: '#',
};

// Время Астаны (UTC+5) → абсолютный timestamp. Месяц 1–12.
export const astana = (y, mo, d, h = 0, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h - 5, mi, s);

export const DATES = {
  regClose: astana(2026, 11, 18, 23, 59, 59) + 999, // приём заявок до 18.11 23:59 включительно
  openDay: astana(2026, 11, 22),
  mvpDeadline: astana(2026, 11, 26, 23, 59, 59) + 999,
  demoDay: astana(2026, 11, 28),
  demoDayEnd: astana(2026, 11, 29),
};

// Этапы таймера: до какого момента действует и куда считает отсчёт
export const STAGES = [
  { id: 'reg', until: DATES.regClose, target: DATES.regClose, tl: 'reg' },
  { id: 'select', until: DATES.openDay, target: DATES.openDay, tl: 'select' },
  { id: 'dev', until: DATES.mvpDeadline, target: DATES.mvpDeadline, tl: 'dev' },
  { id: 'review', until: DATES.demoDay, target: DATES.demoDay, tl: 'review' },
  { id: 'demo', until: DATES.demoDayEnd, target: DATES.demoDayEnd, tl: 'demo', frozen: true },
  { id: 'done', until: Infinity, target: 0, tl: null, frozen: true },
];

// Для проверки этапов: ?now=2026-11-20T10:00 (время Астаны). Часы идут дальше от этой точки.
let offset = 0;
try {
  const q = new URLSearchParams(location.search).get('now');
  if (q) {
    const m = q.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) offset = astana(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) - Date.now();
  }
} catch (e) { /* без параметра — реальное время */ }

export const now = () => Date.now() + offset;
export const isRegistrationOpen = () => now() <= DATES.regClose;
export const currentStage = () => STAGES.find((s) => now() <= s.until);
