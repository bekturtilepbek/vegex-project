/* ==========================================================================
   VEGEX — MOTION LAYER (vanilla, без сборщика)
   Дописать В КОНЕЦ static/js/main.js, до hero-gl.js.
   Единственная внешняя зависимость — Lenis (тег в base.html).
   Если Lenis не загрузился, всё остальное работает на нативном скролле.

   Разметку берёт из шаблонов: [data-stagger], .mask-rv, [data-px].
   Чего в шаблонах нет — доразмечает сам, поэтому слой не сломается,
   если добавить новую секцию и забыть про атрибуты.
   ========================================================================== */
(function () {
  'use strict';

  /* --- настройки ------------------------------------------------------- */
  var CFG = {
    cursor: true,        // кольцо-курсор на десктопе
    grain: true,         // плёночное зерно поверх страницы
    magnetic: true,      // притягивание кнопок к курсору
    splitHeadings: true, // заголовки поднимаются по словам
    parallax: 10         // амплитуда по умолчанию, % (перебивается data-px)
  };

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  if (REDUCED) {
    $('.rv, .t-split, [data-stagger], .mask-rv').forEach(function (el) { el.classList.add('in'); });
    $('.cal-bar i').forEach(function (b) { b.style.width = (b.dataset.w || 0) + '%'; });
    var h0 = document.querySelector('.hero-nature');
    if (h0) h0.classList.add('hero-in');
    return;
  }

  /* ======================================================================
     1. ПЛАВНЫЙ СКРОЛЛ
     ====================================================================== */
  var lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      touchMultiplier: 1.6
    });
    var raf = function (time) { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);

    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      document.body.classList.remove('nav-open');
      lenis.scrollTo(target, { offset: -70, duration: 1.4 });
    });
  }

  var onScroll = function (cb) {
    if (lenis) lenis.on('scroll', cb);
    else window.addEventListener('scroll', cb, { passive: true });
  };

  /* ======================================================================
     2. ПРОГРЕСС-БАР + СОСТОЯНИЕ ШАПКИ
     ====================================================================== */
  var bar = document.querySelector('.sprog i');
  var header = document.querySelector('header');
  onScroll(function () {
    var y = window.scrollY || document.documentElement.scrollTop;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max, 0, 1) : 0) + ')';
    if (header) header.classList.toggle('scrolled', y > 40);
  });

  /* ======================================================================
     3. РАЗБИВКА ЗАГОЛОВКОВ ПО СЛОВАМ
     ====================================================================== */
  var esc = function (s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  function splitWords(el, step) {
    if (!el || el.dataset.split || el.children.length) return; // только чистый текст
    var txt = (el.textContent || '').trim();
    if (!txt) return;
    el.innerHTML = txt.split(/\s+/).map(function (w, i) {
      return '<span class="w"><i style="--d:' + (i * (step || 0.05)).toFixed(3) + 's">' + esc(w) + '</i></span>';
    }).join(' ');
    el.dataset.split = '1';
    el.classList.add('t-split');
  }

  if (CFG.splitHeadings) {
    $('.sec-head h2, .about h2, .markets h2, .cta h2, .divider-photo .dp-text h2')
      .forEach(function (h) { splitWords(h, 0.05); });
  }

  /* ======================================================================
     4. ДОРАЗМЕТКА (только то, чего нет в шаблонах)
     ====================================================================== */
  // шторки на крупных фото
  $('.divider-photo, .spec-shot, .pk-shot, .cs-item, .pgal-item, .split-panel .sp-photo')
    .forEach(function (el) {
      if (el.classList.contains('mask-rv')) return;
      el.classList.add('mask-rv');
      if (el.closest('.spec-side, .markets, .about, .pgal-row, .divider-photo')) el.classList.add('on-dark');
    });

  // stagger на сетках
  $('.tgrid, .pack-grid, .adv-g, .cal-strip, .prod-grid, .partners-grid, .qlist, .chips, .inco, .mk-list, .facts-inner')
    .forEach(function (grid) {
      if (grid.hasAttribute('data-stagger')) return;
      grid.setAttribute('data-stagger', '');
      Array.prototype.forEach.call(grid.children, function (ch, i) {
        ch.style.setProperty('--d', (i * 0.07).toFixed(2) + 's');
      });
    });

  /* ======================================================================
     5. НАБЛЮДАТЕЛЬ ПОЯВЛЕНИЯ
     ====================================================================== */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);

      $('.cal-bar i', e.target).forEach(function (b, i) {
        setTimeout(function () { b.style.width = (b.dataset.w || 0) + '%'; }, 120 + i * 90);
      });
      $('.num', e.target).forEach(countUp);
      if (e.target.classList.contains('num')) countUp(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  $('.rv, .t-split, [data-stagger], .mask-rv, .facts-inner .stat, .spec-panel')
    .forEach(function (el) { io.observe(el); });

  /* ======================================================================
     6. СЧЁТЧИКИ ЦИФР
     ====================================================================== */
  function countUp(el) {
    if (!el || el.dataset.counted) return;
    var raw = el.textContent.trim();
    var m = raw.match(/[\d][\d\s.,]*/);
    if (!m) return;
    var numStr = m[0].replace(/[.,\s]+$/, '');
    var target = parseFloat(numStr.replace(/\s/g, '').replace(',', '.'));
    if (!isFinite(target)) return;
    var decimals = (numStr.split(/[.,]/)[1] || '').length;
    var pre = raw.slice(0, m.index);
    var post = raw.slice(m.index + numStr.length);
    var grouped = /\s/.test(numStr);
    el.dataset.counted = '1';

    var t0 = performance.now(), dur = 1500;
    (function tick(now) {
      var p = clamp((now - t0) / dur, 0, 1);
      var eased = 1 - Math.pow(1 - p, 4);
      var val = (target * eased).toFixed(decimals);
      if (grouped) val = String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      el.textContent = pre + val + post;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ======================================================================
     7. ПАРАЛЛАКС
     ====================================================================== */
  var pxItems = $('[data-px]');

  // запасной вариант: если в шаблонах атрибутов нет — вешаем сами
  if (!pxItems.length) {
    pxItems = $('.divider-photo img, .spec-img, .pk-shot img, .cs-item img, .pgal-item .ph');
    pxItems.forEach(function (el) { el.setAttribute('data-px', CFG.parallax); });
  }

  var pxTick = false;
  function updatePx() {
    var vh = window.innerHeight;
    pxItems.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var amt = parseFloat(el.dataset.px) || CFG.parallax;
      var prog = (r.top + r.height / 2 - vh / 2) / vh;      // -1 … 1
      var shift = clamp(-prog * amt, -amt, amt);
      var scale = 1 + amt / 50;                             // перекрывает сдвиг
      el.style.transform = 'translate3d(0,' + shift.toFixed(2) + '%,0) scale(' + scale.toFixed(3) + ')';
    });
    pxTick = false;
  }
  if (pxItems.length) {
    pxItems.forEach(function (el) { el.style.willChange = 'transform'; });
    onScroll(function () { if (!pxTick) { pxTick = true; requestAnimationFrame(updatePx); } });
    window.addEventListener('resize', updatePx);
    updatePx();
  }

  /* ======================================================================
     8. ВХОД ГЕРОЯ
     ====================================================================== */
  (function heroIntro() {
    var hero = document.querySelector('.hero-nature');
    if (!hero) return;
    var logo = hero.querySelector('.hero-logo-big');
    var idx = 0;
    if (logo) {
      $('span', logo).forEach(function (part) {
        var chars = (part.textContent || '').split('');
        part.innerHTML = chars.map(function (c) {
          return '<span class="ch" style="--d:' + (0.25 + idx++ * 0.055).toFixed(3) + 's">' + esc(c) + '</span>';
        }).join('');
      });
    }
    var base = 0.25 + idx * 0.055;
    var tag = hero.querySelector('.hero-tagline');
    var cta = hero.querySelector('.hero-nature-cta');
    var cue = hero.querySelector('.scroll-cue');
    if (tag) tag.style.setProperty('--d', (base + 0.15).toFixed(2) + 's');
    if (cta) cta.style.setProperty('--d', (base + 0.30).toFixed(2) + 's');
    if (cue) cue.style.setProperty('--d', (base + 0.55).toFixed(2) + 's');

    var go = function () { requestAnimationFrame(function () { hero.classList.add('hero-in'); }); };
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go);
  })();

  /* ======================================================================
     9. МАГНИТНЫЕ КНОПКИ И НАКЛОН КАРТОЧЕК
     ====================================================================== */
  if (CFG.magnetic && FINE) {
    $('.btn, .prod-btn').forEach(function (btn) {
      var strength = 0.28, max = 10;
      btn.addEventListener('mouseenter', function () {
        btn.classList.add('mag-in'); btn.classList.remove('mag-out');
      });
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        var dx = clamp((e.clientX - (r.left + r.width / 2)) * strength, -max, max);
        var dy = clamp((e.clientY - (r.top + r.height / 2)) * strength, -max, max);
        btn.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
      });
      btn.addEventListener('mouseleave', function () {
        btn.classList.remove('mag-in'); btn.classList.add('mag-out');
        btn.style.transform = '';
      });
    });

    $('.prod-card, .pk').forEach(function (card) {
      var MAX = 4;
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          'perspective(900px) rotateX(' + (-py * MAX).toFixed(2) + 'deg) rotateY(' +
          (px * MAX).toFixed(2) + 'deg) translateZ(0)';
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    });
  }

  /* ======================================================================
     10. КУРСОР-КОЛЬЦО
     ====================================================================== */
  if (CFG.cursor && FINE) {
    var cur = document.querySelector('.cur');
    if (!cur) { cur = document.createElement('div'); cur.className = 'cur'; document.body.appendChild(cur); }
    var tx = innerWidth / 2, ty = innerHeight / 2, cx = tx, cy = ty;
    window.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY; cur.classList.add('on');
    }, { passive: true });
    document.addEventListener('mouseleave', function () { cur.classList.remove('on'); });
    document.addEventListener('mouseover', function (e) {
      var hot = e.target.closest && e.target.closest('a, button, .prod-card, input, textarea, .cs-item, .pgal-item');
      cur.classList.toggle('hot', !!hot);
    });
    (function loop() {
      cx = lerp(cx, tx, 0.16); cy = lerp(cy, ty, 0.16);
      cur.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    })();
  }

  /* ======================================================================
     11. ЗЕРНО
     ====================================================================== */
  if (CFG.grain && !document.querySelector('.grain')) {
    var g = document.createElement('div');
    g.className = 'grain';
    document.body.appendChild(g);
  }

  /* ======================================================================
     12. ПАУЗА ВО ВКЛАДКЕ-ФОНЕ
     ====================================================================== */
  document.addEventListener('visibilitychange', function () {
    if (!lenis) return;
    if (document.hidden) lenis.stop(); else lenis.start();
  });
})();