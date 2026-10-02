/* App.viewer — крупный просмотр картины с зумом (spec §6, §9.2).
   Слой поверх страницы без смены маршрута; «назад» закрывает слой (history.pushState без смены URL).
   Зум: двойное касание/клик (1× ↔ 2.5×), щипок (pointer events, 1× … предел по разрешению файла, 2–5×), колесо, кнопки +/−/1:1; перетаскивание при зуме;
   Esc, «Закрыть», свайп вниз при 1× — закрыть. Ловушка фокуса и возврат фокуса на кнопку, открывшую слой. */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util, esc = U.esc;

  var MIN = 1, MAX = 5, DOUBLE = 2.5;
  var MAX_CAP = 5, MAX_FLOOR = 2; // CR2-10: предел зума — ~1:1 к загруженному файлу, но не меньше 2× и не больше 5×
  var srcW = 1920;
  var el = null, stage, im, zoomLabel, caption;
  var st = { s: 1, x: 0, y: 0 }, opener = null, pushed = false, isOpen = false, seq = 0, inerted = [];
  var lastHash = null, pendingRestore = null;
  var ptrs = {}, gesture = null, lastTap = null;

  var ICON = {
    plus: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    minus: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  function build() {
    el = document.createElement('div');
    el.className = 'viewer';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'viewer-title');
    el.hidden = true;
    el.innerHTML =
      '<div class="viewer__bar">' +
        '<div class="viewer__zoom" role="group" aria-label="Масштаб">' +
          '<button class="viewer__btn" type="button" data-v="out" aria-label="Уменьшить">' + ICON.minus + '</button>' +
          '<button class="viewer__btn viewer__btn--text" type="button" data-v="reset" aria-label="Исходный размер"><span data-v-zoom>100%</span></button>' +
          '<button class="viewer__btn" type="button" data-v="in" aria-label="Увеличить">' + ICON.plus + '</button>' +
        '</div>' +
        '<button class="viewer__btn viewer__close" type="button" data-v="close">' + App.ui.ICON.close + '<span>Закрыть</span></button>' +
      '</div>' +
      '<div class="viewer__stage" data-v-stage><img class="viewer__img" alt="" draggable="false"></div>' +
      '<div class="viewer__caption" data-v-caption></div>' +
      '<p class="viewer__hint" aria-hidden="true">' + (coarse() ? 'Дважды коснитесь или разведите пальцы, чтобы увеличить' :
        'Двойной клик или колесо — увеличить, + и − на клавиатуре, Esc — закрыть') + '</p>';
    document.body.appendChild(el);
    stage = el.querySelector('[data-v-stage]');
    im = stage.querySelector('img');
    zoomLabel = el.querySelector('[data-v-zoom]');
    caption = el.querySelector('[data-v-caption]');

    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]');
      if (!b || b.getAttribute('aria-disabled') === 'true') return;
      var a = b.getAttribute('data-v');
      if (a === 'close') close();
      else if (a === 'in') zoomTo(st.s * 1.5);
      else if (a === 'out') zoomTo(st.s / 1.5);
      else if (a === 'reset') zoomTo(1);
    });
    // Клавиши слушаем на документе: после клика по картине фокус может уйти со слоя.
    document.addEventListener('keydown', function (e) { if (isOpen) onKey(e); });
    stage.setAttribute('tabindex', '-1');
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('dblclick', function (e) { e.preventDefault(); });
    im.addEventListener('dragstart', function (e) { e.preventDefault(); });
    window.addEventListener('resize', function () { if (isOpen) { fit(); apply(); } });
    window.addEventListener('popstate', onPop);
  }

  /* ---------- геометрия ---------- */
  var ratio = 1;
  /** Вписать картину в сцену по пропорции из данных (не зависит от того, какая миниатюра уже загрузилась). */
  function fit() {
    var W = stage.clientWidth - 16, H = stage.clientHeight - 16;
    var w = Math.min(W, H * ratio), h = w / ratio;
    im.style.width = Math.max(1, Math.round(w)) + 'px';
    im.style.height = Math.max(1, Math.round(h)) + 'px';
    MAX = Math.min(MAX_CAP, Math.max(MAX_FLOOR, srcW / Math.max(1, w)));
    if (st.s > MAX) st.s = MAX;
  }
  function box() { return { w: im.offsetWidth, h: im.offsetHeight, W: stage.clientWidth, H: stage.clientHeight }; }
  function clamp() {
    var b = box();
    var mx = Math.max(0, (b.w * st.s - b.W) / 2), my = Math.max(0, (b.h * st.s - b.H) / 2);
    st.x = Math.min(mx, Math.max(-mx, st.x));
    st.y = Math.min(my, Math.max(-my, st.y));
  }
  function apply(animate) {
    clamp();
    im.classList.toggle('is-anim', !!animate);
    im.style.transform = 'translate(' + st.x.toFixed(1) + 'px,' + st.y.toFixed(1) + 'px) scale(' + st.s.toFixed(3) + ')';
    var pct = Math.round(st.s * 100) + '%';
    zoomLabel.textContent = pct;
    el.querySelector('[data-v=reset]').setAttribute('aria-label', 'Исходный размер, сейчас ' + pct); // CR2-9
    el.classList.toggle('is-zoomed', st.s > 1.01);
    // aria-disabled вместо disabled: сфокусированная кнопка не теряет фокус на пределе масштаба (CR2-1).
    el.querySelector('[data-v=out]').setAttribute('aria-disabled', st.s <= MIN + 0.001 ? 'true' : 'false');
    el.querySelector('[data-v=in]').setAttribute('aria-disabled', st.s >= MAX - 0.001 ? 'true' : 'false');
  }
  /** Точка экрана → координаты относительно центра сцены. */
  function rel(cx, cy) {
    var r = stage.getBoundingClientRect();
    return { x: cx - (r.left + r.width / 2), y: cy - (r.top + r.height / 2) };
  }
  /** Масштаб s с неподвижной точкой p (относительно центра сцены). */
  function zoomTo(s, p, animate) {
    s = Math.min(MAX, Math.max(MIN, s));
    p = p || { x: 0, y: 0 };
    var k = s / st.s;
    st.x = p.x - (p.x - st.x) * k;
    st.y = p.y - (p.y - st.y) * k;
    st.s = s;
    if (s <= MIN) { st.x = 0; st.y = 0; }
    apply(animate !== false);
  }

  /* ---------- жесты ---------- */
  function onDown(e) {
    if (e.button && e.button !== 0) return;
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* нет захвата — не критично */ }
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: Date.now() };
    var ids = Object.keys(ptrs);
    if (ids.length === 2) {
      var a = ptrs[ids[0]], b = ptrs[ids[1]];
      gesture = { type: 'pinch', d: dist(a, b), s: st.s, mid: rel((a.x + b.x) / 2, (a.y + b.y) / 2), x: st.x, y: st.y };
    } else if (ids.length === 1) {
      gesture = { type: 'pan', x: st.x, y: st.y, cx: e.clientX, cy: e.clientY, moved: false };
    }
  }
  function onMove(e) {
    var p = ptrs[e.pointerId];
    if (!p || !gesture) return;
    p.x = e.clientX; p.y = e.clientY;
    if (gesture.type === 'pinch') {
      var ids = Object.keys(ptrs); if (ids.length < 2) return;
      var a = ptrs[ids[0]], b = ptrs[ids[1]];
      var s = Math.min(MAX, Math.max(MIN, gesture.s * dist(a, b) / (gesture.d || 1)));
      var mid = rel((a.x + b.x) / 2, (a.y + b.y) / 2), k = s / gesture.s;
      st.s = s;
      st.x = mid.x - (gesture.mid.x - gesture.x) * k;
      st.y = mid.y - (gesture.mid.y - gesture.y) * k;
      apply(false);
    } else {
      var dx = e.clientX - gesture.cx, dy = e.clientY - gesture.cy;
      if (Math.abs(dx) + Math.abs(dy) > 6) gesture.moved = true;
      if (st.s > 1.01) { st.x = gesture.x + dx; st.y = gesture.y + dy; apply(false); }
      else if (dy > 0) { im.style.transform = 'translateY(' + dy.toFixed(0) + 'px)'; el.style.setProperty('--fade', String(Math.max(0.4, 1 - dy / 400))); }
    }
  }
  function onUp(e) {
    var p = ptrs[e.pointerId];
    delete ptrs[e.pointerId];
    if (!p || !gesture) return;
    var left = Object.keys(ptrs);
    if (gesture.type === 'pinch') {
      el.style.removeProperty('--fade'); // CR2-3
      im.style.removeProperty('opacity');
      if (st.s < 1.05) zoomTo(1);
      // оставшийся палец продолжает сдвиг
      gesture = left.length === 1 ? { type: 'pan', x: st.x, y: st.y, cx: ptrs[left[0]].x, cy: ptrs[left[0]].y, moved: true } : null;
      lastTap = null;
      return;
    }
    var dy = e.clientY - gesture.cy, moved = gesture.moved;
    gesture = null;
    el.style.removeProperty('--fade');
    if (st.s <= 1.01 && moved) {
      if (dy > 110 && e.type === 'pointerup') { close(); return; }
      apply(true);
      return;
    }
    if (moved || e.type !== 'pointerup') return;
    // двойное касание / двойной клик
    var now = Date.now();
    if (lastTap && now - lastTap.t < 320 && Math.abs(lastTap.x - e.clientX) < 30 && Math.abs(lastTap.y - e.clientY) < 30) {
      lastTap = null;
      if (st.s > 1.01) zoomTo(1); else zoomTo(DOUBLE, rel(e.clientX, e.clientY));
    } else {
      lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  /** CR2-7. Щипок на трекпаде приходит как wheel с ctrlKey → зум; колесо мыши → зум;
      прокрутка двумя пальцами (трекпад) → сдвиг увеличенной картины, при 1× — ничего. deltaMode: строки ×16, страницы × высота. */
  function isTrackpad(e) {
    if (e.deltaMode !== 0) return false; // строки/страницы — колесо мыши (Firefox)
    if (e.deltaX !== 0) return true;
    if (typeof e.wheelDeltaY === 'number' && e.wheelDeltaY !== 0) return e.wheelDeltaY === -3 * e.deltaY; // Chrome/Safari
    return Math.abs(e.deltaY) < 50 && e.deltaY % 1 !== 0;
  }
  function onWheel(e) {
    e.preventDefault();
    var k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? stage.clientHeight : 1;
    var dx = e.deltaX * k, dy = e.deltaY * k;
    if (e.ctrlKey) { zoomTo(st.s * Math.exp(-dy * 0.01), rel(e.clientX, e.clientY), false); return; }
    if (isTrackpad(e)) {
      if (st.s > 1.01) { st.x -= dx; st.y -= dy; apply(false); }
      return;
    }
    zoomTo(st.s * Math.exp(-dy * 0.0025), rel(e.clientX, e.clientY), false);
  }

  /* ---------- клавиатура и фокус ---------- */
  function focusables() {
    return Array.prototype.filter.call(el.querySelectorAll('button, a[href]'), function (n) { return !n.disabled && n.offsetParent !== null; });
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(st.s * 1.5); return; }
    if (e.key === '-') { e.preventDefault(); zoomTo(st.s / 1.5); return; }
    if (e.key === '0') { e.preventDefault(); zoomTo(1); return; }
    if (st.s > 1.01 && /^Arrow/.test(e.key) && !e.target.closest('button')) {
      e.preventDefault();
      var d = 60;
      if (e.key === 'ArrowLeft') st.x += d; else if (e.key === 'ArrowRight') st.x -= d;
      else if (e.key === 'ArrowUp') st.y += d; else st.y -= d;
      apply(true); return;
    }
    if (e.key === 'Tab') {
      var f = focusables(); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (!el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  /* ---------- открыть / закрыть ---------- */
  /** Открыть картину. trigger — элемент, на который вернуть фокус. */
  function coarse() { return !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches); }

  /** Скрыть страницу под слоем от чтения с экрана и Tab (CR2-2). */
  function setInert(on) {
    if (on) {
      inerted = Array.prototype.filter.call(document.body.children, function (n) {
        return n !== el && n.tagName !== 'SCRIPT' && !n.inert;
      });
      inerted.forEach(function (n) { n.inert = true; });
    } else {
      inerted.forEach(function (n) { n.inert = false; });
      inerted = [];
    }
  }

  /** «Назад»/«вперёд»: закрыть открытый слой или вернуть слой, если пришли на его запись истории (CR2-6). */
  function onPop(e) {
    var stv = e.state && e.state.viewer;
    if (isOpen && pushed) { pushed = false; close(true); return; }
    if (!isOpen && typeof stv === 'string' && App.store.painting(stv)) {
      if (location.hash !== lastHash) pendingRestore = stv; // маршрут перерисуется — откроем после него
      else open(stv, null, true);
    }
  }

  function open(id, trigger, restore) {
    var p = App.store.painting(id);
    if (!p) return;
    if (!el) build();
    var token = ++seq;
    var imgD = p.image || {}, t = imgD.thumbs || {}, a = App.store.artist(p.artist) || {};
    opener = trigger || document.activeElement;
    st = { s: 1, x: 0, y: 0 }; ptrs = {}; gesture = null; lastTap = null;
    im.classList.remove('is-anim');
    im.style.transform = '';
    im.alt = imgD.alt || p.title;
    im.width = imgD.width || 4; im.height = imgD.height || 3;
    ratio = (imgD.width || 4) / (imgD.height || 3);
    var low = t['960'] || t['330'] || '', high = t['1920'] || low;
    // миниатюры Commons режутся по ширине: 1920px- — это ширина файла
    srcW = Math.min(imgD.width || 1920, t['1920'] ? 1920 : t['960'] ? 960 : 330);
    el.classList.remove('is-broken');
    im.onerror = function () { if (token === seq) el.classList.add('is-broken'); }; // CR2-5
    im.onload = function () { if (token === seq) el.classList.remove('is-broken'); };
    im.src = low;
    if (high !== low) {
      var pre = new Image();
      pre.onload = function () { if (isOpen && token === seq) im.src = high; }; // CR2-4
      pre.src = high;
    }
    caption.innerHTML = '<p class="viewer__title" id="viewer-title">' + esc(p.title) + '</p>' +
      '<p class="viewer__meta">' + esc(a.name || '') + ', ' + esc(p.date_label) + ' · ' + esc(App.ui.licenseLabel(imgD)) +
      (imgD.commons_page ? ' · <a href="' + esc(imgD.commons_page) + '" target="_blank" rel="noopener">Файл в Commons</a>' : '') + '</p>';
    el.hidden = false;
    isOpen = true;
    document.body.classList.add('has-viewer');
    setInert(true);
    if (restore) pushed = true;
    else { try { history.pushState({ viewer: id }, ''); pushed = true; } catch (err) { pushed = false; } }
    fit(); apply(false);
    el.querySelector('[data-v=close]').focus();
  }

  function close(fromHistory) {
    if (!isOpen) return;
    isOpen = false;
    el.hidden = true;
    document.body.classList.remove('has-viewer');
    setInert(false);
    seq++;
    im.removeAttribute('src');
    if (pushed && !fromHistory) { pushed = false; try { history.back(); } catch (err) { /* без истории — просто закрыли */ } }
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    opener = null;
  }

  // Закрыть слой при смене маршрута (ссылка внутри подписи и т. п.).
  // Запись истории слоя остаётся позади: «назад» на неё вернёт слой, а не будет пустым шагом (CR2-6).
  document.addEventListener('app:route', function () {
    var first = lastHash === null;
    lastHash = location.hash;
    if (isOpen) { pushed = false; close(true); }
    var stv = pendingRestore || (first && history.state && history.state.viewer);
    pendingRestore = null;
    if (typeof stv === 'string' && App.store.painting(stv)) open(stv, null, true);
  });

  App.viewer = { open: open, close: close, isOpen: function () { return isOpen; } };
})(window);
