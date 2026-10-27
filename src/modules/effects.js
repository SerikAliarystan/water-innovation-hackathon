import { $, $$, burst, reducedMotion, finePointer } from '../lib/dom.js';

// Микровзаимодействия: появление блоков, рябь на кнопках, свет под курсором, курсор

export function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  $$('.reveal').forEach((el) => io.observe(el));
}

function ripple(btn, x, y, ring) {
  const r = btn.getBoundingClientRect();
  burst(btn, ring ? 'ripple ripple--ring' : 'ripple', x - r.left, y - r.top);
}

export function initButtonRipples() {
  if (reducedMotion) return;
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.btn');
    if (b && !b.disabled) ripple(b, e.clientX, e.clientY, false);
  });
  if (!finePointer) return;
  document.addEventListener('pointerover', (e) => {
    const b = e.target.closest('.btn--primary');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) ripple(b, e.clientX, e.clientY, true);
  });
}

// Мягкий свет под курсором в ячейках и рябь при наведении на партнёров
export function initSurfaceLight() {
  if (!finePointer) return;
  document.addEventListener('pointermove', (e) => {
    const c = e.target.closest?.('.cell, .partner');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
  if (reducedMotion) return;
  document.addEventListener('pointerover', (e) => {
    const c = e.target.closest('.partner');
    if (!c || c.contains(e.relatedTarget)) return;
    const r = c.getBoundingClientRect();
    burst(c, 'ring-burst', e.clientX - r.left, e.clientY - r.top);
  });
}

// Светящийся курсор с лёгкой рябью (только мышь, P2)
export function initCursor() {
  if (!finePointer || reducedMotion) return;
  const dot = $('.cursor');
  let x = -100, y = -100, cx = -100, cy = -100, lastRing = 0, rx = 0, ry = 0;
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    dot.classList.add('is-on');
    const t = performance.now();
    if (t - lastRing > 180 && Math.hypot(x - rx, y - ry) > 70) {
      lastRing = t; rx = x; ry = y;
      burst(document.body, 'cursor-ring', x, y);
    }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => dot.classList.remove('is-on'));
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

// Заголовки «под водой»: при наведении буквы колышутся (SVG-фильтр искажения) и успокаиваются
export function initRippleText() {
  if (reducedMotion || !finePointer) return;
  const disp = $('[data-water-disp]');
  if (!disp) return;
  let active = null, start = 0, raf = 0;
  const step = (t) => {
    const k = (t - start) / 1400;
    const scale = k < 1 ? Math.sin(Math.min(k * 3, 1) * Math.PI / 2) * 14 * (1 - k) : 0;
    disp.setAttribute('scale', scale.toFixed(2));
    if (k < 1) raf = requestAnimationFrame(step);
    else { active?.classList.remove('is-rippling'); active = null; raf = 0; }
  };
  $$('[data-ripple-text]').forEach((el) => el.addEventListener('pointerenter', () => {
    if (active && active !== el) active.classList.remove('is-rippling');
    active = el;
    el.classList.add('is-rippling');
    start = performance.now();
    if (!raf) raf = requestAnimationFrame(step);
  }));
}
