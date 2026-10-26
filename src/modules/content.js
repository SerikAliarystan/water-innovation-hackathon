import { $, $$, reducedMotion } from '../lib/dom.js';
import { CONFIG } from '../config.js';
import { onLangChange } from '../i18n/index.js';

// Генерируемый контент: FAQ, бегущая строка, капли в блоке отсчёта, контакты из конфига

const FAQ_COUNT = 9;

export function renderFaq() {
  $('[data-faq]').innerHTML = Array.from({ length: FAQ_COUNT }, (_, i) => `
    <details class="qa reveal" style="--i:${Math.min(i, 4)}">
      <summary><span class="qa__num" aria-hidden="true"></span><span data-i18n="faq.${i + 1}.q"></span><span class="qa__icon" aria-hidden="true"></span></summary>
      <div class="qa__a"><div><p data-i18n="faq.${i + 1}.a"></p></div></div>
    </details>`).join('');
}

export function initMarquee() {
  const list = $('.marquee__list');
  const clone = list.cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  list.after(clone);
}

export function initRain() {
  if (reducedMotion) return;
  const sec = $('.countdown');
  const box = $('.countdown__rain');
  const n = innerWidth < 640 ? 6 : 12;
  const h = sec.offsetHeight;
  let html = '';
  for (let i = 0; i < n; i++) {
    const x = (4 + Math.random() * 92).toFixed(1);
    const t = (2.8 + Math.random() * 2.6).toFixed(2);
    const d = (Math.random() * 4).toFixed(2);
    const y = Math.round(h * (0.55 + Math.random() * 0.35));
    html += `<span class="rain-drop" style="left:${x}%;--t:${t}s;--d:${d}s;--y:${y}px"></span>`;
    html += `<span class="rain-splash" style="left:${x}%;top:${y - 18}px;--t:${t}s;--d:${d}s"></span>`;
  }
  box.innerHTML = html;
  // не тратим кадры на дождь, когда блок вне экрана
  new IntersectionObserver(([e]) => { box.style.display = e.isIntersecting ? '' : 'none'; }).observe(sec);
}

export function applyConfig() {
  const fill = () => $$('[data-prize]').forEach((el) => { el.textContent = CONFIG.prize; });
  fill();
  onLangChange(fill);
  const mail = $('[data-contact-email]');
  if (mail) { mail.href = `mailto:${CONFIG.contactEmail}`; $('span', mail).textContent = CONFIG.contactEmail; }
  const tg = $('[data-contact-tg]');
  if (tg) { if (CONFIG.telegramUrl) tg.href = CONFIG.telegramUrl; else tg.remove(); }
  $$('[data-doc="privacy"]').forEach((a) => { a.href = CONFIG.privacyUrl; });
  $$('[data-doc="rules"]').forEach((a) => { a.href = CONFIG.rulesUrl; });
}
