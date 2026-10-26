import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/sections.css';
import './styles/form.css';

import { isRegistrationOpen } from './config.js';
import { t, applyI18n, initLangSwitch, onLangChange } from './i18n/index.js';
import { $, $$, reducedMotion } from './lib/dom.js';
import { initHeader, setActiveNav } from './modules/header.js';
import { initProgress } from './modules/progress.js';
import { initReveal, initButtonRipples, initSurfaceLight, initCursor } from './modules/effects.js';
import { renderFaq, initMarquee, initRain, applyConfig } from './modules/content.js';
import { initWater } from './modules/water.js';
import { initHero } from './modules/hero.js';
import { initCountdown } from './modules/countdown.js';
import { initForm } from './modules/form.js';
import { initTheme } from './modules/theme.js';

document.documentElement.classList.add('js');

// Кнопки «Зарегистрироваться»: после 18.11 23:59 (Астана) — «Регистрация завершена»
function syncRegisterButtons() {
  const open = isRegistrationOpen();
  $$('[data-register]').forEach((b) => {
    b.disabled = !open;
    if (open) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true');
    const label = $('[data-register-label]', b);
    if (label) label.textContent = t(open ? 'cta.register' : 'cta.closed');
  });
}

// Статичный и генерируемый контент
renderFaq();
initMarquee();
applyConfig();

// Навигация
const header = initHeader();
initProgress({ onSection: setActiveNav });
initLangSwitch();

// Регистрация
const announcer = $('[data-announcer]');
const announce = (msg) => { announcer.textContent = ''; setTimeout(() => { announcer.textContent = msg; }, 50); };
const form = initForm({ announce });
$$('[data-register]').forEach((b) => b.addEventListener('click', () => {
  header.closeMenu();
  if (isRegistrationOpen()) form.open(b); else syncRegisterButtons();
}));

// Этапы хакатона
initCountdown({
  reducedMotion,
  onStage(stage) {
    $$('.row').forEach((row) => row.classList.toggle('is-current', row.dataset.tl === stage.tl));
    syncRegisterButtons();
  },
});

onLangChange(syncRegisterButtons);
applyI18n();

// Визуальные эффекты
initReveal();
const water = initWater($('.hero .water'), { reducedMotion });
const lake = initWater($('.final .water'), { reducedMotion, lake: true });
initTheme({ onChange: (theme) => [water, lake].forEach((w) => w.setDark(theme === 'dark')) });
initHero(water);
initButtonRipples();
initSurfaceLight();
initCursor();
initRain();
