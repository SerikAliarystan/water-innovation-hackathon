import { now, currentStage, DATES, astana } from '../config.js';
import { t, onLangChange } from '../i18n/index.js';
import { $$ } from '../lib/dom.js';

// Таймер с «капающими» цифрами + шкала этапов. Один компонент — в блоке отсчёта и в финале.

const UNITS = ['days', 'hours', 'minutes', 'seconds'];

// Отрезки шкалы этапов: [начало, конец), подписи — из программы
const TRACK = [
  { id: 'reg', from: astana(2026, 11, 6), to: DATES.regClose, name: 'p.1.t', date: 'p.1.d' },
  { id: 'select', from: DATES.regClose, to: DATES.openDay, name: 'p.2.t', date: 'p.2.d' },
  { id: 'dev', from: DATES.openDay, to: DATES.mvpDeadline, name: 'p.4.t', date: 'p.4.d' },
  { id: 'review', from: DATES.mvpDeadline, to: DATES.demoDay, name: 'p.6.t', date: 'p.6.d' },
  { id: 'demo', from: DATES.demoDay, to: DATES.demoDayEnd, name: 'p.7.t', date: 'p.7.d' },
];

function split(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)); // никогда не отрицательный
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

function buildTimer(el) {
  el.innerHTML = UNITS.map((u) => `
    <div class="timer__unit">
      <span class="timer__digits" data-u="${u}"></span>
      <span class="timer__label" data-i18n="cd.${u}"></span>
    </div>`).join('');
  return Object.fromEntries(UNITS.map((u) => [u, el.querySelector(`[data-u="${u}"]`)]));
}

function setDigits(box, str, animate) {
  if (box.childElementCount !== str.length) {
    box.replaceChildren(...[...str].map((c) => Object.assign(document.createElement('span'), { className: 'timer__digit', textContent: c })));
    return;
  }
  [...str].forEach((c, i) => {
    const d = box.children[i];
    if (d.textContent === c) return;
    d.textContent = c;
    if (animate) {
      d.classList.remove('is-drip');
      void d.offsetWidth; // перезапуск анимации
      d.classList.add('is-drip');
    }
  });
}

function renderTrack(list) {
  list.innerHTML = TRACK.map((s) => `
    <li class="stage" data-stage="${s.id}">
      <span class="stage__bar"><span class="stage__fill"></span></span>
      <span class="stage__name"></span>
      <span class="stage__date"></span>
    </li>`).join('');
}

function updateTrack(list) {
  const n = now();
  [...list.children].forEach((li, i) => {
    const s = TRACK[i];
    const p = Math.min(1, Math.max(0, (n - s.from) / (s.to - s.from)));
    const current = (n >= s.from || i === 0) && n < s.to; // до 6.11 текущим считается приём заявок
    li.querySelector('.stage__fill').style.setProperty('--p', p.toFixed(4));
    li.classList.toggle('is-current', current);
    li.querySelector('.stage__name').innerHTML = '';
    li.querySelector('.stage__name').append(t(s.name));
    if (current) {
      const tag = document.createElement('span');
      tag.className = 'stage__now';
      tag.textContent = t('cd.now');
      li.querySelector('.stage__name').append(tag);
    }
    li.querySelector('.stage__date').textContent = t(s.date);
    if (current) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
}

export function initCountdown({ onStage, reducedMotion }) {
  const timers = $$('[data-timer]').map((el) => ({ el, digits: buildTimer(el) }));
  const tracks = $$('[data-stages]');
  tracks.forEach(renderTrack);
  let stageId = null;
  let lastMinute = -1;

  const tick = (force = false) => {
    const stage = currentStage();
    if (force || stage.id !== stageId) {
      stageId = stage.id;
      $$('[data-stage-label]').forEach((n) => { n.textContent = t(`stage.${stage.id}.label`); });
      onStage?.(stage);
    }
    const parts = split(stage.frozen ? 0 : stage.target - now());
    timers.forEach(({ el, digits }) => {
      UNITS.forEach((u) => setDigits(digits[u], String(parts[u]).padStart(2, '0'), !reducedMotion));
      el.setAttribute('aria-label', `${t(`stage.${stage.id}.label`)}: ${parts.days} ${t('cd.days')}, ${parts.hours} ${t('cd.hours')}, ${parts.minutes} ${t('cd.minutes')}`);
    });
    // шкала этапов меняется медленно — обновляем раз в минуту
    const minute = Math.floor(now() / 60000);
    if (force || minute !== lastMinute) { lastMinute = minute; tracks.forEach(updateTrack); }
  };

  tick(true);
  setTimeout(() => { tick(); setInterval(tick, 1000); }, 1000 - (now() % 1000));
  onLangChange(() => tick(true));
}
