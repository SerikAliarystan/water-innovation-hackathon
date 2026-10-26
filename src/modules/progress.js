import { t, onLangChange } from '../i18n/index.js';
import { $, $$, rafThrottle, reducedMotion } from '../lib/dom.js';

// Шкала прогресса (справа на десктопе, сверху на мобильных), активный блок
// и «наполнение реки» в программе.

export function initProgress({ onSection }) {
  const sections = $$('[data-section]');
  const marks = $('.rail__marks');
  const railFill = $('.rail__fill');
  const topFill = $('.topbar__fill');
  const agenda = $('.agenda');
  const flow = $('.agenda__flow');
  let activeId = null;

  function buildMarks() {
    const docH = document.documentElement.scrollHeight - innerHeight;
    marks.replaceChildren(...sections.map((s) => {
      const li = document.createElement('li');
      li.style.top = `${docH > 0 ? Math.min(1, Math.max(0, s.offsetTop / docH)) * 100 : 0}%`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rail__mark';
      btn.setAttribute('aria-label', t(s.dataset.rail));
      const label = document.createElement('span');
      label.className = 'rail__label';
      label.textContent = t(s.dataset.rail);
      btn.append(label);
      btn.addEventListener('click', () => s.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }));
      li.append(btn);
      return li;
    }));
    markActive();
  }

  function markActive() {
    const idx = sections.findIndex((s) => s.dataset.section === activeId);
    [...marks.children].forEach((li, i) => {
      const m = li.firstChild;
      m.classList.toggle('is-active', i === idx);
      m.classList.toggle('is-passed', i < idx);
      if (i === idx) m.setAttribute('aria-current', 'true'); else m.removeAttribute('aria-current');
    });
  }

  const update = () => {
    const docH = document.documentElement.scrollHeight - innerHeight;
    const p = docH > 0 ? scrollY / docH : 0;
    railFill.style.transform = `scaleY(${p})`;
    topFill.style.transform = `scaleX(${p})`;

    // активный блок — тот, что пересёк линию на 40% высоты экрана
    const probe = innerHeight * 0.4;
    let current = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top <= probe) current = s;
    if (current.dataset.section !== activeId) {
      activeId = current.dataset.section;
      markActive();
      onSection?.(activeId);
    }

    if (agenda) {
      const r = agenda.getBoundingClientRect();
      flow.style.setProperty('--p', Math.min(1, Math.max(0, (innerHeight * 0.65 - r.top) / r.height)).toFixed(4));
    }
  };

  const onScroll = rafThrottle(update);
  const relayout = rafThrottle(() => { buildMarks(); update(); });
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', relayout, { passive: true });
  addEventListener('load', relayout);
  document.fonts?.ready.then(relayout); // после загрузки шрифтов высоты блоков меняются
  onLangChange(relayout);
  relayout();
}
