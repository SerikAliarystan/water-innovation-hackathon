import { $, reducedMotion, rafThrottle, burst } from '../lib/dom.js';

// «Путь капли»: одна капля сопровождает скролл — выходит из баннера, падает в резервуар
// отсчёта, течёт по реке программы и в конце падает в озеро финала.

export function initTraveler({ lake }) {
  if (reducedMotion) return;
  const el = $('.traveler');
  const drop = $('.traveler__drop', el);
  const hero = $('.hero');
  const tank = $('[data-tank]');
  const river = $('.agenda__flow');
  const final = $('#apply');
  let path = [];            // точки [docY, x] по возрастанию docY
  let lastY = scrollY;
  let stretch = 1;
  let splashedTank = false;
  let splashedLake = false;

  const docTop = (r) => r.top + scrollY;

  function build() {
    const vw = innerWidth;
    const side = vw - Math.min(96, vw * 0.08); // вне секций — у правого края, рядом со шкалой
    const pts = [];
    const glass = $('.glass-drop').getBoundingClientRect();
    pts.push([docTop(glass) + glass.height, glass.left + glass.width / 2]);
    const tr = tank.getBoundingClientRect();
    pts.push([docTop(tr) + 4, vw * 0.78]);
    // река: точки самого SVG-пути в координатах документа
    const svg = river.ownerSVGElement;
    const len = river.getTotalLength();
    const m = river.getScreenCTM();
    const sr = svg.getBoundingClientRect();
    pts.push([sr.top + scrollY - 140, side]);
    for (let i = 0; i <= 48; i++) {
      const pt = river.getPointAtLength((len * i) / 48);
      const sp = new DOMPoint(pt.x, pt.y).matrixTransform(m);
      pts.push([sp.y + scrollY, sp.x]);
    }
    const fr = final.getBoundingClientRect();
    pts.push([docTop(fr) - 120, side]);
    pts.push([docTop(fr) + fr.height * 0.62, vw / 2]);
    path = pts.sort((a, b) => a[0] - b[0]);
  }

  function xAt(y) {
    if (y <= path[0][0]) return path[0][1];
    for (let i = 1; i < path.length; i++) {
      if (y <= path[i][0]) {
        const [y0, x0] = path[i - 1], [y1, x1] = path[i];
        const t = (y - y0) / (y1 - y0 || 1);
        return x0 + (x1 - x0) * (t * t * (3 - 2 * t));
      }
    }
    return path[path.length - 1][1];
  }

  const update = () => {
    if (!path.length) return;
    const y = scrollY + innerHeight * 0.52;
    const startY = path[0][0], endY = path[path.length - 1][0];
    const on = y > startY && y < endY;
    el.classList.toggle('is-on', on);
    const x = xAt(y);
    const screenY = y - scrollY;
    // скорость скролла растягивает каплю
    const v = Math.abs(scrollY - lastY);
    lastY = scrollY;
    stretch += (Math.min(1.6, 1 + v / 60) - stretch) * 0.35;
    el.style.transform = `translate3d(${x}px, ${screenY}px, 0)`;
    drop.style.setProperty('--stretch', stretch.toFixed(3));

    // всплеск при входе в резервуар
    const tankY = path[1][0];
    if (!splashedTank && y > tankY) { splashedTank = true; burst(document.body, 'traveler-splash', x, y); }
    if (y < tankY - 200) splashedTank = false;
    // падение в озеро — круги по воде финала
    if (!splashedLake && y >= endY - 4) { splashedLake = true; lake?.ripple(x, screenY, 1.8); }
    if (y < endY - 300) splashedLake = false;
  };

  const relayout = rafThrottle(() => { build(); update(); });
  addEventListener('scroll', rafThrottle(update), { passive: true });
  addEventListener('resize', relayout, { passive: true });
  addEventListener('load', relayout);
  document.fonts?.ready.then(relayout);
  relayout();
}
