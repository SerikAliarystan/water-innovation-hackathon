import { now, currentStage } from './config.js';

// Таймер с «капающими» цифрами. Один компонент — в блоке отсчёта и в финальном блоке.

const UNITS = ['days', 'hours', 'minutes', 'seconds'];

function split(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)); // никогда не отрицательный
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

function build(el) {
  el.innerHTML = UNITS.map((u, i) => `
    ${i ? '<span class="timer__sep" aria-hidden="true"></span>' : ''}
    <div class="timer__unit">
      <span class="timer__digits" data-u="${u}"></span>
      <span class="timer__label" data-i18n="cd.${u}"></span>
    </div>`).join('');
  const digits = {};
  el.querySelectorAll('[data-u]').forEach((d) => { digits[d.dataset.u] = d; });
  return digits;
}

function setDigits(container, str, animate) {
  if (container.childElementCount !== str.length) {
    container.innerHTML = [...str].map((c) => `<span class="timer__digit">${c}</span>`).join('');
    return;
  }
  [...str].forEach((c, i) => {
    const d = container.children[i];
    if (d.textContent !== c) {
      d.textContent = c;
      if (animate) {
        d.classList.remove('is-drip');
        void d.offsetWidth; // перезапуск анимации
        d.classList.add('is-drip');
      }
    }
  });
}

export function initCountdown({ t, onStage, reducedMotion }) {
  const timers = [...document.querySelectorAll('[data-timer]')].map((el) => ({ el, digits: build(el) }));
  let stageId = null;

  const tick = () => {
    const stage = currentStage();
    if (stage.id !== stageId) {
      stageId = stage.id;
      document.querySelectorAll('[data-stage-label]').forEach((n) => { n.textContent = t(`stage.${stage.id}.label`); });
      document.querySelectorAll('[data-stage-note]').forEach((n) => { n.textContent = t(`stage.${stage.id}.note`); });
      onStage?.(stage);
    }
    const parts = split(stage.frozen ? 0 : stage.target - now());
    timers.forEach(({ digits }) => {
      UNITS.forEach((u) => setDigits(digits[u], String(parts[u]).padStart(2, '0'), !reducedMotion));
    });
    timers.forEach(({ el }) => el.setAttribute('aria-label',
      `${parts.days} ${t('cd.days')}, ${parts.hours} ${t('cd.hours')}, ${parts.minutes} ${t('cd.minutes')}, ${parts.seconds} ${t('cd.seconds')}`));
  };

  tick();
  // синхронизация с началом секунды
  setTimeout(() => { tick(); setInterval(tick, 1000); }, 1000 - (now() % 1000));

  return {
    refresh() { stageId = null; tick(); },
  };
}
