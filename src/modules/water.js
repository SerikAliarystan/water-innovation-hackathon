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
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform vec4 uRipples[${MAX_RIPPLES}]; // xy — позиция (0..1), z — время старта, w — сила
uniform float uLake;                   // 1 — финальное «озеро»: свет снизу
uniform vec4 uDrop;                    // стеклянная капля: x, y (низ-лево), ширина, высота — в долях холста; z = 0 — капли нет
uniform sampler2D uMask;               // размытая маска формы капли (альфа)

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
  c = clamp(c / 4.0, 0.0, 4.0); // без переполнения в mediump (иначе NaN — чёрные пиксели)
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.0);
}

// Вода горного озера (Каинды): бездна → бирюза, светящаяся каустика, отсвет Freedom-зелёного у дна
vec3 scene(vec2 p, float vy, vec2 disp, float rings, float glow) {
  vec2 q = p + disp;
  float t = uTime * 0.35;
  float n = noise(q * 3.0 + t * 0.4) * 0.5 + noise(q * 7.0 - t * 0.3) * 0.25;
  float cs = caustic(q * 4.2 + vec2(n * 0.6), t * 1.2);
  float depth = smoothstep(0.0, 1.0, vy * 0.9 + n * 0.3);
  vec3 turq = vec3(0.18, 0.9, 0.84);
  vec3 brand = vec3(0.008, 0.694, 0.251);
  vec3 col = mix(vec3(0.004, 0.03, 0.04), vec3(0.02, 0.19, 0.21), depth);
  col += turq * cs * (0.1 + 0.2 * depth);
  col += brand * cs * 0.08 * (1.0 - vy);
  col += mix(turq, brand, 0.3) * min(rings, 1.0) * 0.35;
  col += turq * glow * 0.12;
  return col;
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

  vec2 pp = vec2(uPointer.x * aspect, uPointer.y);
  float pd = length(p - pp);
  float glow = exp(-pd * pd * 9.0);
  float vy = mix(uv.y, 1.0 - uv.y, uLake);

  vec3 col = scene(p, vy, disp, rings, glow);
  float beam = exp(-pow((uv.x - 0.7 - (uv.y - 1.0) * 0.25) * 3.0, 2.0)) * smoothstep(0.1, 1.0, uv.y) * (1.0 - uLake);
  col += vec3(0.55, 1.0, 0.95) * beam * 0.07;

  // Стеклянная капля: преломляет и увеличивает воду за собой
  if (uDrop.z > 0.0) {
    vec2 du = (uv - uDrop.xy) / uDrop.zw;
    if (du.x > -0.1 && du.x < 1.1 && du.y > -0.25 && du.y < 1.1) {
      float e = 0.012;
      float a = texture2D(uMask, du).a;
      vec2 n = vec2(texture2D(uMask, du + vec2(e, 0.0)).a - texture2D(uMask, du - vec2(e, 0.0)).a,
                    texture2D(uMask, du + vec2(0.0, e)).a - texture2D(uMask, du - vec2(0.0, e)).a);
      float inside = smoothstep(0.4, 0.6, a);
      // пятно сфокусированного света под каплей
      float spot = exp(-pow(length((du - vec2(0.5, -0.06)) * vec2(1.7, 7.0)), 2.0));
      col += vec3(0.25, 1.0, 0.85) * spot * 0.22;
      if (inside > 0.0) {
        vec2 dc = vec2((uDrop.x + uDrop.z * 0.5) * aspect, uDrop.y + uDrop.w * 0.38);
        vec2 pr = dc + (p - dc) * 0.5 - n * 0.9 * uDrop.z * aspect;
        vec3 glass = scene(pr, vy, disp * 0.5, rings, glow) * 1.5;
        glass = mix(glass, vec3(0.75, 1.0, 0.97), smoothstep(0.55, 1.0, du.y) * 0.18);      // светлая верхушка
        glass = mix(glass, vec3(0.008, 0.694, 0.251), smoothstep(0.45, 0.0, du.y) * 0.45);  // зелень Freedom у дна
        float rim = smoothstep(0.3, 0.5, a) - smoothstep(0.5, 0.8, a);
        glass += vec3(0.8, 1.0, 0.98) * rim * 0.55;                                           // светлый край стекла
        float spec = exp(-pow(length((du - vec2(0.33, 0.62)) * vec2(5.0, 3.2)), 2.0));
        glass += vec3(1.0) * spec * 0.55;                                                     // блик
        col = mix(col, glass, inside);
      }
    }
  }

  // зерно, чтобы не было бандинга
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.014;
  gl_FragColor = vec4(col, 1.0);
}
`;

// Маска формы капли: тот же путь, что у SVG «данных», размытый — из размытия шейдер берёт нормали
const DROP_PATH = 'M160 14C222 96 290 170 290 262a130 130 0 0 1-260 0C30 170 98 96 160 14z';
function dropMask() {
  const w = 256, h = 336, pad = 16;
  const c = document.createElement('canvas');
  c.width = w + pad * 2; c.height = h + pad * 2;
  const ctx = c.getContext('2d');
  ctx.filter = 'blur(7px)';
  ctx.translate(pad, pad);
  ctx.scale(w / 320, h / 420);
  ctx.fillStyle = '#fff';
  ctx.fill(new Path2D(DROP_PATH));
  return { canvas: c, pad: pad / (w + pad * 2), padY: pad / (h + pad * 2) };
}

export function initWater(container, { reducedMotion, lake = false, dropEl = null } = {}) {
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
  const uDrop = gl.getUniformLocation(prog, 'uDrop');
  let mask = null;
  if (dropEl) {
    mask = dropMask();
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask.canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(prog, 'uMask'), 0);
  }
  // прямоугольник капли в долях холста (с полями маски), низ-лево — как у gl_FragCoord
  const dropRect = () => {
    if (!dropEl) return [0, 0, 0, 0];
    const sr = section.getBoundingClientRect();
    const r = dropEl.getBoundingClientRect();
    const w = r.width / (1 - 2 * mask.pad), h = r.height / (1 - 2 * mask.padY);
    const left = r.left - (w - r.width) / 2 - sr.left;
    const bottom = sr.bottom - (r.bottom + (h - r.height) / 2);
    return [left / sr.width, bottom / sr.height, w / sr.width, h / sr.height];
  };

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
    gl.uniform4f(uDrop, ...dropRect());
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
