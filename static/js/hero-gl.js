/* ==========================================================================
   VEGEX — HERO WEBGL
   Дописать В КОНЕЦ static/js/main.js (после anim.js).
   Берёт <canvas class="hero-gl" data-src="…"> внутри .hero-nature и рисует
   фото с медленным текучим искажением + волной от курсора.
   Если WebGL недоступен, файл локальный (file://) или картинки нет —
   молча выходит, остаётся обычное фото с CSS-Ken-Burns.
   ========================================================================== */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = document.querySelector('canvas.hero-gl');
  if (!canvas) return;
  var hero = canvas.closest('.hero-nature');
  var src = canvas.getAttribute('data-src');
  if (!src) return;

  var gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false })
        || canvas.getContext('experimental-webgl');
  if (!gl) return;

  /* --- шейдеры --------------------------------------------------------- */
  var VERT = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform vec2  uRes;',
    'uniform vec2  uImg;',
    'uniform float uTime;',
    'uniform vec2  uMouse;',
    'uniform float uHover;',

    // value noise + fbm
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float noise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), u.x),',
    '             mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  for(int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.02; a *= 0.5; }',
    '  return v;',
    '}',

    'void main(){',
    // background-size: cover
    '  float ra = uRes.x / uRes.y;',
    '  float ia = uImg.x / uImg.y;',
    '  vec2 ratio = vec2(min(ra / ia, 1.0), min(ia / ra, 1.0));',
    '  vec2 uv = vec2(vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,',
    '                 vUv.y * ratio.y + (1.0 - ratio.y) * 0.5);',

    // медленное «дыхание» кадра
    '  float breathe = 1.0 - 0.025 + 0.025 * sin(uTime * 0.11);',
    '  uv = (uv - 0.5) * breathe * 0.97 + 0.5;',

    // текучее искажение
    '  float n1 = fbm(uv * 3.0 + vec2(uTime * 0.035, uTime * 0.022));',
    '  float n2 = fbm(uv * 2.0 - vec2(uTime * 0.026, uTime * 0.04) + 7.3);',
    '  vec2 flow = vec2(n1 - 0.5, n2 - 0.5) * 0.016;',

    // волна от курсора
    '  vec2 asp = vec2(ra, 1.0);',
    '  float d = distance(vUv * asp, uMouse * asp);',
    '  float ring = smoothstep(0.45, 0.0, d) * uHover;',
    '  vec2 dir = normalize(vUv * asp - uMouse * asp + 0.0001);',
    '  flow += dir * ring * 0.022 * sin(d * 22.0 - uTime * 2.6);',

    // хроматическая аберрация по величине смещения
    '  float ca = 0.55 + ring * 1.6;',
    '  float r = texture2D(uTex, uv + flow * (1.0 + 0.30 * ca)).r;',
    '  float g = texture2D(uTex, uv + flow).g;',
    '  float b = texture2D(uTex, uv + flow * (1.0 - 0.30 * ca)).b;',
    '  vec3 col = vec3(r, g, b);',

    // лёгкий подъём зелёного канала под брендовый тон
    '  col.g *= 1.02;',

    // виньетка
    '  float vig = smoothstep(1.15, 0.28, distance(vUv, vec2(0.5)));',
    '  col *= mix(0.72, 1.0, vig);',

    // подсветка под курсором
    '  col += ring * 0.045;',

    // зерно
    '  float grain = hash(gl_FragCoord.xy + fract(uTime) * 100.0);',
    '  col += (grain - 0.5) * 0.035;',

    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compile(type, source) {
    var s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[hero-gl]', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var U = {
    tex:   gl.getUniformLocation(prog, 'uTex'),
    res:   gl.getUniformLocation(prog, 'uRes'),
    img:   gl.getUniformLocation(prog, 'uImg'),
    time:  gl.getUniformLocation(prog, 'uTime'),
    mouse: gl.getUniformLocation(prog, 'uMouse'),
    hover: gl.getUniformLocation(prog, 'uHover')
  };

  /* --- загрузка текстуры ------------------------------------------------ */
  var image = new Image();
  image.crossOrigin = 'anonymous';

  image.onload = function () {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    } catch (err) {
      // file:// или cross-origin без CORS — остаёмся на CSS-фолбэке
      console.warn('[hero-gl] текстура недоступна, работает обычное фото', err);
      return;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(U.tex, 0);
    gl.uniform2f(U.img, image.naturalWidth, image.naturalHeight);

    canvas.classList.add('ready');
    hero && hero.classList.add('gl-on');
    resize();
    start();
  };

  image.onerror = function () { /* тихо остаёмся на фолбэке */ };
  image.src = src;

  /* --- размер ----------------------------------------------------------- */
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    var w = Math.round(canvas.clientWidth * dpr);
    var h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.res, w, h);
  }
  window.addEventListener('resize', resize);

  /* --- курсор ----------------------------------------------------------- */
  var mx = 0.5, my = 0.5, tmx = 0.5, tmy = 0.5, hover = 0, thover = 0;
  if (hero) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      tmx = (e.clientX - r.left) / r.width;
      tmy = 1.0 - (e.clientY - r.top) / r.height;
      thover = 1;
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { thover = 0; });
  }

  /* --- цикл ------------------------------------------------------------- */
  var running = false, t0 = performance.now(), visible = true;

  if ('IntersectionObserver' in window && hero) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible && !running) start();
    }, { threshold: 0.01 }).observe(hero);
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function frame(now) {
    if (!visible || document.hidden) { running = false; return; }
    resize();
    mx += (tmx - mx) * 0.07;
    my += (tmy - my) * 0.07;
    hover += (thover - hover) * 0.05;
    gl.uniform1f(U.time, (now - t0) * 0.001);
    gl.uniform2f(U.mouse, mx, my);
    gl.uniform1f(U.hover, hover);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && visible) start();
  });
})();