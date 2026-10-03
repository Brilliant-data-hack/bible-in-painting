/* App.lectures — каталог лекций, ленивая загрузка текстов, прогресс прохождения (spec_lectures.md §2, §6, §7).
   Без DOM, кроме однократной вставки <script> с текстами лекций. */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};

  function D() { return (App.store && App.store.data) || root.DATA || {}; }
  function cat() { return D().lectures || {}; }

  /** Каталог по order: [{id, order, title, ...}]. */
  function list() {
    var c = cat();
    return Object.keys(c).map(function (id) { return Object.assign({ id: id }, c[id]); })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }
  function meta(id) { var c = cat(); return Object.prototype.hasOwnProperty.call(c, id) ? Object.assign({ id: id }, c[id]) : null; }
  function total(id) { var m = cat()[id]; return m && m.steps ? m.steps.length : 0; }

  /* ---------- Тексты: data.lectures.js рядом с файлом данных ---------- */
  var pending = null, scriptEl = null;

  function isLoaded() { return !!(root.LECTURES && root.LECTURES.items); }

  /** Путь к текстам от фактического src скрипта данных: data/data.js → data/data.lectures.js,
      ../../data/fixture.js → ../../data/fixture.lectures.js (работает и в file://, и на статических страницах). */
  function textsSrc() {
    var tags = document.getElementsByTagName('script');
    for (var i = 0; i < tags.length; i++) {
      var s = tags[i].getAttribute('src') || '';
      if (/(^|\/)data\/[^\/]+\.js(\?.*)?$/.test(s) && !/\.lectures\.js(\?.*)?$/.test(s)) return withVersion(s.replace(/\.js(\?.*)?$/, '.lectures.js'));
    }
    return withVersion('data/data.lectures.js');
  }
  /** ?v=<DATA.meta.version>: свежий data.js не получит из кэша старые тексты (CR8-1). */
  function withVersion(src) {
    var v = (D().meta || {}).version;
    return v ? src + '?v=' + encodeURIComponent(v) : src;
  }

  /** load(cb): cb(null) после загрузки или cb(Error). Колбэк всегда асинхронный; одновременные вызовы ждут одну загрузку. */
  function load(cb) {
    cb = typeof cb === 'function' ? cb : function () {};
    if (isLoaded()) { setTimeout(function () { cb(null); }, 0); return; }
    if (pending) { pending.push(cb); return; }
    pending = [cb];
    function done(err) {
      var q = pending || [];
      pending = null;
      if (err && scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl); // «Повторить» вставит заново
      if (err) scriptEl = null;
      q.forEach(function (f) { try { f(err); } catch (e) { if (root.console) console.error(e); } });
    }
    try {
      scriptEl = document.createElement('script');
      scriptEl.src = textsSrc();
      scriptEl.async = true;
      scriptEl.onload = function () { done(isLoaded() ? null : new Error('Тексты лекций пустые')); };
      scriptEl.onerror = function () { done(new Error('Не удалось загрузить тексты лекций')); };
      (document.head || document.documentElement).appendChild(scriptEl);
    } catch (e) { setTimeout(function () { done(e); }, 0); }
  }

  /** Полные шаги лекции (после load) или null. */
  function steps(id) {
    if (!isLoaded()) return null;
    var it = root.LECTURES.items[id];
    return it && it.steps ? it.steps : null;
  }

  /* ---------- Прогресс: localStorage bvzh.lectures.v1 (§6), по образцу store.js ---------- */
  var KEY = 'bvzh.lectures.v1', off = false;
  function storage() {
    if (off) return null;
    try {
      var ls = root.localStorage;
      if (!ls) { off = true; return null; }
      return ls;
    } catch (e) { off = true; return null; }
  }
  /** Сырой объект хранилища: записи лекций, которых сейчас нет в каталоге, сохраняются (CR8-4). */
  function readRaw() {
    var ls = storage(), raw, obj;
    if (!ls) return {};
    try { raw = ls.getItem(KEY); } catch (e) { off = true; return {}; }
    try { obj = JSON.parse(raw || '{}'); } catch (e) { obj = {}; }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    return obj;
  }
  /** Для выдачи наружу: только лекции каталога и шаги в 1…N текущих данных. */
  function readAll() {
    var obj = readRaw(), out = {};
    // Отбрасываем записи неизвестных лекций и шаги вне 1…N текущих данных (лекция могла измениться).
    Object.keys(obj).forEach(function (id) {
      var r = obj[id], n = total(id);
      if (!n || !r || typeof r !== 'object') return;
      var k = Number(r.step);
      if (!(k >= 1 && k <= n && Math.floor(k) === k)) return;
      out[id] = { step: k, done: r.done === true, ts: Number(r.ts) || 0 };
    });
    return out;
  }
  function writeAll(obj) {
    var ls = storage();
    if (!ls) return false;
    try {
      if (Object.keys(obj).length) ls.setItem(KEY, JSON.stringify(obj)); else ls.removeItem(KEY);
      return true;
    } catch (e) { off = true; return false; }
  }

  /** {step, done, ts} или null. */
  function progress(id) { var r = readAll()[id]; return r ? { step: r.step, done: r.done, ts: r.ts } : null; }

  /** Последний открытый шаг (не максимальный); отметка «пройдена» не сбрасывается. */
  function setStep(id, n) {
    var N = total(id); n = Number(n);
    if (!N || !(n >= 1 && n <= N) || Math.floor(n) !== n || !storage()) return;
    var all = readRaw(), r = readAll()[id];
    all[id] = { step: n, done: !!(r && r.done), ts: Date.now() };
    writeAll(all);
  }
  function setDone(id) {
    var N = total(id);
    if (!N || !storage()) return;
    var all = readRaw();
    all[id] = { step: N, done: true, ts: Date.now() };
    writeAll(all);
  }
  function reset(id) {
    if (!storage()) return;
    var all = readRaw();
    if (!Object.prototype.hasOwnProperty.call(all, id)) return;
    delete all[id];
    writeAll(all);
  }

  /** Статус для карточек: none | progress (шаг ≥ 2) | done. */
  function status(id) {
    var N = total(id), r = readAll()[id];
    if (r && r.done) return { state: 'done', step: r.step, total: N };
    if (r && r.step >= 2) return { state: 'progress', step: r.step, total: N };
    return { state: 'none', step: 0, total: N };
  }

  /** #/lecture/id, #/lecture/id/n, #/lecture/id/done. */
  function href(id, n) {
    var s = '#/lecture/' + encodeURIComponent(id);
    if (n === 'done') return s + '/done';
    if (n != null && n !== '') return s + '/' + encodeURIComponent(String(n));
    return s;
  }

  App.lectures = {
    list: list, meta: meta, isLoaded: isLoaded, load: load, steps: steps,
    progress: progress, setStep: setStep, setDone: setDone, reset: reset, status: status, href: href
  };
})(window);
