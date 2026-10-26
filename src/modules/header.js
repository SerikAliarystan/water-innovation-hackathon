import { t } from '../i18n/index.js';
import { $, $$, rafThrottle } from '../lib/dom.js';

// Шапка: стеклянная подложка при скролле, мобильное меню, закреплённая кнопка на мобильных

export function initHeader() {
  const header = $('#header');
  const burger = $('.burger');
  const menu = $('#mobile-menu');
  const sticky = $('.sticky-cta');
  const root = document.documentElement;
  let heroCtaVisible = true;
  let finalVisible = false;

  const isOpen = () => burger.getAttribute('aria-expanded') === 'true';

  const updateGlass = () => header.classList.toggle('is-scrolled', isOpen() || scrollY > 24);
  const updateSticky = () => sticky.classList.toggle('is-visible', !heroCtaVisible && !finalVisible && !isOpen());

  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', t(open ? 'nav.close' : 'nav.menu'));
    root.style.overflow = open ? 'hidden' : '';
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
    } else {
      menu.classList.remove('is-open');
      setTimeout(() => { if (!isOpen()) menu.hidden = true; }, 350);
    }
    updateGlass();
    updateSticky();
  }

  burger.addEventListener('click', () => setMenu(!isOpen()));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) { setMenu(false); burger.focus(); }
  });
  addEventListener('scroll', rafThrottle(updateGlass), { passive: true });

  new IntersectionObserver(([e]) => { heroCtaVisible = e.isIntersecting; updateSticky(); }).observe($('#hero-cta'));
  new IntersectionObserver(([e]) => { finalVisible = e.isIntersecting; updateSticky(); }, { threshold: 0.15 }).observe($('#apply'));

  updateGlass();
  return { closeMenu: () => isOpen() && setMenu(false) };
}

// Подсветка активного пункта меню
export function setActiveNav(id) {
  $$('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === id;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  });
}
