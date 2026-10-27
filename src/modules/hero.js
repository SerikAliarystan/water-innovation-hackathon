import { $, reducedMotion, finePointer } from '../lib/dom.js';

// Баннер: капля-герой следует за курсором; точка в заголовке падает каплей и запускает рябь

function initDropParallax(hero, drop) {
  let tx = 0, ty = 0, cx = 0, cy = 0, running = false;
  const step = () => {
    cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
    drop.style.transform = `translate3d(${cx}px, ${cy}px, 0) rotate(${cx * 0.06}deg)`;
    if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) requestAnimationFrame(step); else running = false;
  };
  const kick = () => { if (!running) { running = true; requestAnimationFrame(step); } };

  if (finePointer) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 48;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 32;
      kick();
    }, { passive: true });
  } else {
    // мобильные: реакция на скролл и наклон (где он доступен без запроса разрешения)
    addEventListener('scroll', () => { ty = -Math.min(40, scrollY * 0.1); kick(); }, { passive: true });
    addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      tx = Math.max(-16, Math.min(16, e.gamma * 0.5));
      kick();
    }, { passive: true });
  }
}

function initFallingDot(hero, water) {
  const dot = $('.hero__dot', hero);
  if (!dot?.animate) return;
  const fall = () => {
    const r = dot.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const hr = hero.getBoundingClientRect();
    const size = Math.max(10, r.width);
    const f = document.createElement('div');
    f.className = 'falling-drop';
    Object.assign(f.style, { width: `${size}px`, height: `${size * 1.22}px`, left: `${r.left + r.width / 2 - size / 2}px`, top: `${r.top - size * 0.22}px` });
    document.body.append(f);
    dot.style.opacity = '0';
    const landY = Math.min(hr.bottom - 160, innerHeight - 140) - r.top;
    f.animate([
      { transform: 'translateY(0) scale(.6)' },
      { transform: 'translateY(-6px) scale(1)', offset: 0.18 },
      { transform: `translateY(${landY}px) scale(.85, 1.25)` },
    ], { duration: 1100, easing: 'cubic-bezier(.55, 0, .9, .4)', fill: 'forwards' }).finished.then(() => {
      const fr = f.getBoundingClientRect();
      const lx = fr.left + fr.width / 2, ly = fr.bottom;
      water.ripple(lx, ly, 1.8);
      setTimeout(() => water.ripple(lx, ly, 1), 220);
      f.animate([{ opacity: 1 }, { opacity: 0, transform: `translateY(${landY}px) scale(2, .1)` }], { duration: 260, fill: 'forwards' })
        .finished.then(() => f.remove());
      dot.animate([{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 600, delay: 600, easing: 'cubic-bezier(.2,.7,.1,1)', fill: 'forwards' })
        .finished.then(() => { dot.style.opacity = ''; });
    });
  };
  setTimeout(fall, 1500);
  dot.closest('h1').addEventListener('click', fall);
}

export function initHero(water) {
  if (reducedMotion) return;
  const hero = $('.hero');
  initDropParallax(hero, $('.glass-drop', hero));
  initFallingDot(hero, water);
}
