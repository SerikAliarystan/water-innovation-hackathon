import './styles.css';
import { dict, LANGS } from './i18n.js';
import { CONFIG, isRegistrationOpen } from './config.js';
import { initWater } from './water.js';
import { initCountdown } from './countdown.js';
import { initForm } from './form.js';

const root = document.documentElement;
root.classList.add('js');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------------- i18n ---------------- */
let lang = LANGS.includes(root.dataset.lang) ? root.dataset.lang : 'ru';
const t = (key) => {
  const v = dict[lang][key] ?? dict.ru[key] ?? key;
  return typeof v === 'string' ? v.replace('{prize}', CONFIG.prize) : v;
};

const FAQ_COUNT = 9;
function renderFaq() {
  const box = $('[data-faq]');
  const openIdx = $$('.qa', box).findIndex((d) => d.open);
  box.innerHTML = Array.from({ length: FAQ_COUNT }, (_, i) => `
    <details class="qa glass reveal is-in" ${i === openIdx ? 'open' : ''}>
      <summary><span class="qa__num">Q${String(i + 1).padStart(2, '0')}</span><span class="qa__q" data-i18n="faq.${i + 1}.q"></span><span class="qa__icon" aria-hidden="true"></span></summary>
      <div class="qa__a"><div><p data-i18n="faq.${i + 1}.a"></p></div></div>
    </details>`).join('');
}

function applyI18n() {
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
  $$('[data-prize]').forEach((el) => { el.textContent = CONFIG.prize; });
  $('.marquee')?.setAttribute('aria-label', [1, 2, 3, 4, 5, 6].map((n) => t(`track.${n}`)).join(', '));
  syncRegisterButtons();
  buildRail();
}

function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  try { localStorage.setItem('wih-lang', lang); } catch (e) { /* приватный режим */ }
  applyI18n();
  countdown?.refresh();
  form?.rerender();
}
$$('[data-lang-btn]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.langBtn)));

/* ---------------- Регистрация ---------------- */
function syncRegisterButtons() {
  const open = isRegistrationOpen();
  $$('[data-register]').forEach((b) => {
    b.disabled = !open;
    if (!open) b.setAttribute('aria-disabled', 'true');
    const label = $('[data-register-label]', b);
    if (label) label.textContent = t(open ? 'cta.register' : 'cta.closed');
  });
}

/* ---------------- Шапка, меню ---------------- */
const header = $('#header');
const burger = $('.burger');
const menu = $('#mobile-menu');

function setMenu(open) {
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', t(open ? 'nav.close' : 'nav.menu'));
  if (open) {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    root.style.overflow = 'hidden';
    header.classList.add('is-scrolled');
  } else {
    menu.classList.remove('is-open');
    root.style.overflow = '';
    setTimeout(() => { if (burger.getAttribute('aria-expanded') === 'false') menu.hidden = true; }, 350);
    onScroll();
  }
  updateSticky();
}
burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { setMenu(false); burger.focus(); } });

/* ---------------- Шкала прогресса и активный блок ---------------- */
const sections = $$('[data-section]');
const railMarks = $('.rail__marks');
const railFill = $('.rail__fill');
const topFill = $('.topbar__fill');
const navLinks = $$('[data-nav]');
const river = $('.river');
const riverFlow = $('.river__flow');
const stickyCta = $('.sticky-cta');
const heroCta = $('#hero-cta');
let activeId = 'hero';
let heroCtaVisible = true;
let finalVisible = false;

function buildRail() {
  const docH = document.documentElement.scrollHeight - innerHeight;
  railMarks.innerHTML = '';
  sections.forEach((s) => {
    const li = document.createElement('li');
    const pos = docH > 0 ? Math.min(1, Math.max(0, (s.offsetTop - 1) / docH)) : 0;
    li.style.top = `${pos * 100}%`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rail__mark';
    btn.dataset.target = s.id;
    const label = document.createElement('span');
    label.className = 'rail__label';
    label.textContent = t(s.dataset.rail);
    btn.setAttribute('aria-label', t(s.dataset.rail));
    btn.append(label);
    btn.addEventListener('click', () => document.getElementById(s.id).scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }));
    li.append(btn);
    railMarks.append(li);
  });
  markRail();
}

function markRail() {
  const idx = sections.findIndex((s) => s.dataset.section === activeId);
  $$('.rail__mark', railMarks).forEach((m, i) => {
    m.classList.toggle('is-active', i === idx);
    m.classList.toggle('is-passed', i < idx);
    if (i === idx) m.setAttribute('aria-current', 'true'); else m.removeAttribute('aria-current');
  });
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = scrollY;
    const docH = document.documentElement.scrollHeight - innerHeight;
    const p = docH > 0 ? y / docH : 0;
    railFill.style.transform = `scaleY(${p})`;
    topFill.style.transform = `scaleX(${p})`;
    if (burger.getAttribute('aria-expanded') !== 'true') header.classList.toggle('is-scrolled', y > 24);

    // активный блок — тот, что пересекает линию на 40% высоты экрана
    const probe = innerHeight * 0.4;
    let current = sections[0];
    for (const s of sections) { if (s.getBoundingClientRect().top <= probe) current = s; }
    if (current.dataset.section !== activeId) {
      activeId = current.dataset.section;
      navLinks.forEach((a) => {
        const on = a.dataset.nav === activeId;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      markRail();
    }

    // река в программе «наполняется» по мере прокрутки
    if (river) {
      const r = river.getBoundingClientRect();
      const rp = Math.min(1, Math.max(0, (innerHeight * 0.7 - r.top) / r.height));
      riverFlow.style.setProperty('--p', rp.toFixed(4));
    }
  });
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => { buildRail(); onScroll(); }, { passive: true });

function updateSticky() {
  const menuOpen = burger.getAttribute('aria-expanded') === 'true';
  stickyCta.classList.toggle('is-visible', !heroCtaVisible && !finalVisible && !menuOpen);
}
new IntersectionObserver(([e]) => { heroCtaVisible = e.isIntersecting; updateSticky(); }).observe(heroCta);
new IntersectionObserver(([e]) => { finalVisible = e.isIntersecting; updateSticky(); }, { threshold: 0.15 }).observe($('#apply'));

/* ---------------- Появление блоков ---------------- */
const revealIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); }
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

/* ---------------- Рябь на кнопках ---------------- */
function spawnRipple(btn, x, y, ring = false) {
  if (reducedMotion) return;
  const r = btn.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = ring ? 'ripple ripple--ring' : 'ripple';
  s.style.left = `${x - r.left}px`;
  s.style.top = `${y - r.top}px`;
  btn.append(s);
  s.addEventListener('animationend', () => s.remove(), { once: true });
}
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.btn');
  if (b && !b.disabled) spawnRipple(b, e.clientX, e.clientY);
});
document.addEventListener('pointerover', (e) => {
  if (!finePointer) return;
  const b = e.target.closest('.btn--primary');
  if (b && !b.disabled && !b.contains(e.relatedTarget)) spawnRipple(b, e.clientX, e.clientY, true);
});

/* ---------------- Свечение карточек под курсором ---------------- */
document.addEventListener('pointermove', (e) => {
  const c = e.target.closest?.('.partner, .card');
  if (!c) return;
  const r = c.getBoundingClientRect();
  c.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
  c.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
}, { passive: true });
document.addEventListener('pointerover', (e) => {
  if (reducedMotion) return;
  const c = e.target.closest('.partner');
  if (!c || c.contains(e.relatedTarget)) return;
  const r = c.getBoundingClientRect();
  const ring = document.createElement('span');
  ring.className = 'ring-burst';
  ring.style.left = `${e.clientX - r.left}px`;
  ring.style.top = `${e.clientY - r.top}px`;
  c.append(ring);
  ring.addEventListener('animationend', () => ring.remove(), { once: true });
});

/* ---------------- Курсор (только десктоп) ---------------- */
function initCursor() {
  if (!finePointer || reducedMotion) return;
  const dot = $('.cursor');
  let x = -100, y = -100, cx = -100, cy = -100, lastRing = 0, rx = 0, ry = 0;
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    dot.classList.add('is-on');
    const now = performance.now();
    if (now - lastRing > 160 && Math.hypot(x - rx, y - ry) > 60) {
      lastRing = now; rx = x; ry = y;
      const ring = document.createElement('span');
      ring.className = 'cursor-ring';
      ring.style.transform = '';
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      document.body.append(ring);
      ring.addEventListener('animationend', () => ring.remove(), { once: true });
    }
  }, { passive: true });
  document.addEventListener('pointerleave', () => dot.classList.remove('is-on'));
  document.addEventListener('pointerover', (e) => {
    dot.classList.toggle('is-hover', !!e.target.closest('a, button, summary, label, input, select, textarea'));
  });
  const loop = () => {
    cx += (x - cx) * 0.22; cy += (y - cy) * 0.22;
    dot.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(loop);
  };
  loop();
}

/* ---------------- Баннер: капля-герой и падающая точка ---------------- */
function initHero(water) {
  const hero = $('.hero');
  const drop = $('.drop-hero');
  if (!reducedMotion) {
    let tx = 0, ty = 0, cx = 0, cy = 0, running = false;
    const step = () => {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      drop.style.transform = `translate3d(${cx}px, ${cy}px, 0) rotate(${cx * 0.08}deg)`;
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) requestAnimationFrame(step); else running = false;
    };
    const kick = () => { if (!running) { running = true; requestAnimationFrame(step); } };
    if (finePointer) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 36;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 28;
        kick();
      }, { passive: true });
    } else {
      // мобильные: реакция на скролл (+ наклон, где он доступен без запроса разрешения)
      addEventListener('scroll', () => { ty = -Math.min(48, scrollY * 0.1); kick(); }, { passive: true });
      addEventListener('deviceorientation', (e) => {
        if (e.gamma == null) return;
        tx = Math.max(-18, Math.min(18, e.gamma * 0.6));
        kick();
      }, { passive: true });
    }
  }

  // Точка в конце заголовка превращается в каплю, падает и запускает рябь
  const dot = $('.hero__dot');
  if (!dot || reducedMotion || !dot.animate) return;
  const fall = () => {
    const r = dot.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const hr = hero.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'falling-drop';
    const size = Math.max(10, r.width);
    f.style.width = `${size}px`;
    f.style.height = `${size * 1.22}px`;
    f.style.left = `${r.left + r.width / 2 - size / 2}px`;
    f.style.top = `${r.top - size * 0.22}px`;
    document.body.append(f);
    dot.style.opacity = '0';
    const landY = Math.min(hr.bottom - 140, innerHeight - 120) - r.top;
    f.animate([
      { transform: 'translateY(0) scale(.6, .6)', offset: 0 },
      { transform: 'translateY(-8px) scale(1, 1)', offset: 0.18 },
      { transform: `translateY(${landY}px) scale(.85, 1.25)`, offset: 1 },
    ], { duration: 1100, easing: 'cubic-bezier(.55, 0, .9, .4)', fill: 'forwards' }).finished.then(() => {
      const fr = f.getBoundingClientRect();
      const lx = fr.left + fr.width / 2, ly = fr.bottom;
      water.ripple(lx, ly, 1.8);
      setTimeout(() => water.ripple(lx, ly, 1.0), 220);
      f.animate([{ opacity: 1, transform: `translateY(${landY}px) scale(1.4, .3)` }, { opacity: 0, transform: `translateY(${landY}px) scale(2, .1)` }], { duration: 260, fill: 'forwards' })
        .finished.then(() => f.remove());
      dot.animate([{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 600, delay: 600, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' })
        .finished.then(() => { dot.style.opacity = ''; });
    });
  };
  setTimeout(fall, 1500);
  dot.closest('h1').addEventListener('click', fall);
}

/* ---------------- Капли в блоке отсчёта ---------------- */
function initRain() {
  if (reducedMotion) return;
  const sec = $('.countdown-sec');
  const box = $('.depth__drops');
  const n = innerWidth < 640 ? 7 : 14;
  const h = sec.offsetHeight;
  let html = '';
  for (let i = 0; i < n; i++) {
    const x = (5 + Math.random() * 90).toFixed(1);
    const tt = (2.6 + Math.random() * 2.6).toFixed(2);
    const d = (Math.random() * 4).toFixed(2);
    const yy = Math.round(h * (0.55 + Math.random() * 0.35));
    html += `<span class="depth__drop" style="left:${x}%;--t:${tt}s;--d:${d}s;--y:${yy}px"></span>`;
    html += `<span class="depth__splash" style="left:${x}%;top:${yy - 20}px;--t:${tt}s;--d:${d}s"></span>`;
  }
  box.innerHTML = html;
  // не тратим кадры на дождь, когда блок вне экрана
  new IntersectionObserver(([e]) => {
    box.style.display = e.isIntersecting ? '' : 'none';
  }).observe(sec);
}

/* ---------------- Запуск ---------------- */
renderFaq();
// бегущая строка: копия списка для бесшовного цикла
const mlist = $('.marquee__list');
const mclone = mlist.cloneNode(true);
mclone.setAttribute('aria-hidden', 'true');
mlist.after(mclone);

const announcer = $('[data-announcer]');
const announce = (msg) => { announcer.textContent = ''; setTimeout(() => { announcer.textContent = msg; }, 50); };

const form = initForm({ t, announce });
$$('[data-register]').forEach((b) => b.addEventListener('click', () => {
  if (burger.getAttribute('aria-expanded') === 'true') setMenu(false);
  if (isRegistrationOpen()) form.open(b);
  else syncRegisterButtons();
}));

const countdown = initCountdown({
  t,
  reducedMotion,
  onStage(stage) {
    $$('.tl').forEach((li) => li.classList.toggle('is-current', li.dataset.tl === stage.tl));
    syncRegisterButtons();
  },
});

applyI18n();

const contact = $('[data-contact-email]');
if (contact) { contact.href = `mailto:${CONFIG.contactEmail}`; $('span', contact).textContent = CONFIG.contactEmail; }
const tg = $('[data-contact-tg]');
if (tg) { if (CONFIG.telegramUrl) tg.href = CONFIG.telegramUrl; else tg.remove(); }
$$('[data-doc="privacy"]').forEach((a) => { a.href = CONFIG.privacyUrl; });
$$('[data-doc="rules"]').forEach((a) => { a.href = CONFIG.rulesUrl; });

$$('.reveal').forEach((el) => revealIO.observe(el));
const water = initWater($('.hero'), { reducedMotion });
initHero(water);
initCursor();
initRain();
onScroll();
// после загрузки шрифтов высоты блоков меняются — пересчитываем отметки шкалы
document.fonts?.ready.then(() => { buildRail(); onScroll(); });
addEventListener('load', () => { buildRail(); onScroll(); });
