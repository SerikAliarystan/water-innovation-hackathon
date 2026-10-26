// Водная поверхность на WebGL: каустика + рябь от курсора/касаний/падающих капель.
// Аналитические волны (без симуляции) — дёшево для мобильных, стабильные 60 fps.
// Используется в баннере и в финальном «озере». Запасной вариант — CSS-фон .water__fallback
// (если нет WebGL или включено уменьшение движения).

const MAX_RIPPLES = 12;

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform vec4 uRipples[${MAX_RIPPLES}]; // xy — позиция (0..1), z — время старта, w — сила
uniform float uLake; // 1 — финальное «озеро»: свет снизу, а не сверху
uniform float uDark; // 0 — светлая тема, 1 — тёмная

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

// Каустика: классический «водный» паттерн из итераций синусов
float caustic(vec2 p, float t) {
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  // Рябь: сумма затухающих кольцевых волн
  vec2 disp = vec2(0.0);
  float rings = 0.0;
  for (int k = 0; k < ${MAX_RIPPLES}; k++) {
    vec4 r = uRipples[k];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 4.0) continue;
    vec2 c = vec2(r.x * aspect, r.y);
    vec2 d = p - c;
    float dist = length(d);
    float front = age * 0.32;
    float w = exp(-pow((dist - front) * 14.0, 2.0)) * exp(-age * 1.1) * r.w;
    float wave = sin((dist - front) * 60.0) * w;
    disp += normalize(d + 1e-4) * wave * 0.012;
    rings += abs(wave);
  }

  // Мягкая реакция на курсор
  vec2 pp = vec2(uPointer.x * aspect, uPointer.y);
  float pd = length(p - pp);
  float glow = exp(-pd * pd * 9.0);

  vec2 q = p + disp;
  float t = uTime * 0.35;
  float n = noise(q * 3.0 + t * 0.4) * 0.5 + noise(q * 7.0 - t * 0.3) * 0.25;
  float cs = caustic(q * 4.2 + vec2(n * 0.6), t * 1.2);

  // Цвета: глубина → лагуна, блики циана, бренд-зелень у дна
  // Светлая вода: вид на дно мелкой прозрачной воды
  vec3 deep = vec3(0.62, 0.85, 0.87);
  vec3 shallow = vec3(0.94, 0.978, 0.978);
  vec3 teal = vec3(0.03, 0.45, 0.52);
  vec3 brand = vec3(0.008, 0.694, 0.251);

  float vy = mix(uv.y, 1.0 - uv.y, uLake);
  float depth = smoothstep(0.0, 1.0, vy * 0.85 + n * 0.3);
  vec3 col = mix(deep, shallow, depth);
  col = mix(col, vec3(1.0), cs * (0.45 + 0.25 * (1.0 - depth)));   // блики каустики
  col = mix(col, brand, cs * 0.05 * (1.0 - vy));                   // зелёный отсвет у дна
  col = mix(col, teal, min(rings, 1.0) * 0.22);                    // кольца ряби
  col = mix(col, vec3(1.0), glow * 0.22);                          // свет под курсором
  float beam = exp(-pow((uv.x - 0.72 - (uv.y - 1.0) * 0.25) * 3.2, 2.0)) * smoothstep(0.1, 1.0, uv.y) * (1.0 - uLake);
  col = mix(col, vec3(1.0), beam * 0.18);                          // солнечный столб

  // Тёмная вода: глубина с бирюзовыми бликами
  vec3 cyan = vec3(0.45, 0.85, 0.9);
  vec3 dark = mix(vec3(0.01, 0.05, 0.065), vec3(0.03, 0.15, 0.18), depth);
  dark += cyan * cs * (0.12 + 0.14 * depth);
  dark += brand * cs * 0.06 * (1.0 - vy);
  dark += mix(cyan, brand, 0.35) * min(rings, 1.0) * 0.3;
  dark += cyan * glow * 0.1 + vec3(0.6, 0.95, 1.0) * beam * 0.06;
  col = mix(col, dark, uDark);
  // зерно, чтобы не было бандинга
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.012;

  gl_FragColor = vec4(col, 1.0);
}
`;

export function initWater(container, { reducedMotion, lake = false } = {}) {
  const canvas = container.querySelector('.water__canvas');
  const section = container.parentElement; // секция принимает события указателя
  const api = { ripple() {}, ok: false };
  if (!canvas || reducedMotion) return api;

  let gl;
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  } catch (e) { gl = null; }
  if (!gl) return api;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[water]', gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return api;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return api;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uPointer = gl.getUniformLocation(prog, 'uPointer');
  const uRipples = gl.getUniformLocation(prog, 'uRipples');
  gl.uniform1f(gl.getUniformLocation(prog, 'uLake'), lake ? 1 : 0);
  // тема сайта задаётся атрибутом data-theme на <html>
  gl.uniform1f(gl.getUniformLocation(prog, 'uDark'), document.documentElement.dataset.theme === 'dark' ? 1 : 0);

  const ripples = new Float32Array(MAX_RIPPLES * 4);
  let rIdx = 0;
  const start = performance.now();
  const now = () => (performance.now() - start) / 1000;
  const pointer = { x: 0.7, y: 0.55, tx: 0.7, ty: 0.55 };

  // Разрешение рендера: на мобильных и слабых GPU — меньше пикселей
  const isCoarse = matchMedia('(pointer: coarse)').matches;
  let scale = isCoarse ? 0.45 : 0.6;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(section.clientWidth * dpr * scale));
    const h = Math.max(1, Math.floor(section.clientHeight * dpr * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const toUv = (clientX, clientY) => {
    const r = section.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width, y: 1 - (clientY - r.top) / r.height };
  };
  api.ripple = (clientX, clientY, strength = 1) => {
    const { x, y } = toUv(clientX, clientY);
    ripples.set([x, y, now(), strength], rIdx * 4);
    rIdx = (rIdx + 1) % MAX_RIPPLES;
  };

  let lastMove = 0;
  let lx = 0, ly = 0;
  section.addEventListener('pointermove', (e) => {
    const { x, y } = toUv(e.clientX, e.clientY);
    pointer.tx = x; pointer.ty = y;
    const t = performance.now();
    const dist = Math.hypot(e.clientX - lx, e.clientY - ly);
    if (t - lastMove > 90 && dist > 24) {
      api.ripple(e.clientX, e.clientY, 0.35);
      lastMove = t; lx = e.clientX; ly = e.clientY;
    }
  }, { passive: true });
  section.addEventListener('pointerdown', (e) => api.ripple(e.clientX, e.clientY, 1), { passive: true });

  // Пауза вне экрана и на скрытой вкладке
  let visible = true;
  let raf = 0;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) loop(); }, { threshold: 0 }).observe(section);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });

  // Адаптивное качество: если кадры долгие — уменьшаем разрешение
  let frames = 0, acc = 0, lastT = performance.now();
  const frame = () => {
    raf = 0;
    if (!visible || document.hidden) return;
    const t = performance.now();
    const dt = t - lastT; lastT = t;
    if (frames < 90) {
      acc += dt; frames++;
      if (frames === 90 && acc / 90 > 22 && scale > 0.3) { scale *= 0.7; resize(); }
    }
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, now());
    gl.uniform2f(uPointer, pointer.x, pointer.y);
    gl.uniform4fv(uRipples, ripples);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  };
  function loop() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); } }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); container.classList.remove('has-gl'); visible = false; });

  // «Озеро»: редкие капли падают сами, пока блок на экране
  if (lake) {
    setInterval(() => {
      if (!visible || document.hidden) return;
      const r = section.getBoundingClientRect();
      api.ripple(r.left + r.width * (0.15 + Math.random() * 0.7), r.top + r.height * (0.45 + Math.random() * 0.45), 0.9);
    }, 1700);
  }

  loop();
  // показываем canvas после первого кадра, до этого виден запасной фон
  requestAnimationFrame(() => requestAnimationFrame(() => container.classList.add('has-gl')));
  api.ok = true;
  return api;
}
