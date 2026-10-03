/* App.router — hash-роутинг (spec §4, ADR-1): разбор, переходы, title/meta, фокус, прокрутка. */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var SITE = 'Библия в живописи';
  var scrollPos = {}, byLink = false, current = null;

  /** '#/search?q=x' → {name:'search', args:[], params:{q:'x'}, hash} */
  function parse(hash) {
    var h = String(hash || '').replace(/^#\/?/, '');
    var qi = h.indexOf('?'), path = qi < 0 ? h : h.slice(0, qi), query = qi < 0 ? '' : h.slice(qi + 1);
    var parts = path.split('/').filter(Boolean).map(function (p) { try { return decodeURIComponent(p); } catch (e) { return p; } });
    return { name: parts[0] || 'home', args: parts.slice(1), params: U.parseQs(query), hash: '#/' + h };
  }

  function href(name, a, params) {
    if (name === 'home') return '#/';
    var s = '#/' + name;
    if (a) s += '/' + (Array.isArray(a) ? a.map(encodeURIComponent).join(',') : encodeURIComponent(a));
    var q = U.qs(params || {});
    return q ? s + '?' + q : s;
  }

  function searchHref(params) {
    var q = U.qs(params || {});
    return '#/search' + (q ? '?' + q : '');
  }

  function setMeta(title, description) {
    document.title = title ? title + ' — ' + SITE : SITE;
    var m = document.querySelector('meta[name="description"]');
    if (m && description) m.setAttribute('content', description);
  }

  /** Маршрут статической страницы сюжета или картины (tools/prerender.mjs): <body data-prerender="#/subject/x">. */
  function prerendered() { return (document.body && document.body.getAttribute('data-prerender')) || ''; }

  var VIEWS = { home: 'home', subject: 'subject', painting: 'painting', compare: 'compare', search: 'results', about: 'about' };

  function render() {
    if (location.hash && location.hash.indexOf('#/') !== 0) {
      // Обычный якорь (ссылка «К содержанию» и т. п.) — не маршрут.
      var t = document.getElementById(location.hash.slice(1));
      if (t) { if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1'); t.focus(); }
      if (current != null) return;
      // Первая загрузка с якорем вместо маршрута (#main после F5) — рисуем главную (CR-3).
      // На статической странице (prerender) — её же маршрут, без якоря.
      if (history.replaceState) history.replaceState(null, '', prerendered() ? location.pathname + location.search : '#/');
    }
    var r = parse(location.hash || prerendered()), first = current == null;
    // Новый <main> без обработчиков прошлого экрана: mount() вешает их на el, innerHTML их не снимает (CR-2).
    var old = document.getElementById('main'), main = old.cloneNode(false);
    old.parentNode.replaceChild(main, old);
    if (current) scrollPos[current] = window.scrollY;
    var restore = !byLink && scrollPos[r.hash] != null;
    byLink = false;
    var view = App.views[VIEWS[r.name]] || App.views.notFound;
    var out;
    try { out = view.render(r) || {}; }
    catch (e) { if (root.console) console.error(e); out = App.views.notFound.render(r); }
    main.innerHTML = out.html || '';
    setMeta(out.title, out.description);
    if (out.mount) out.mount(main, r);
    document.dispatchEvent(new CustomEvent('app:route', { detail: r }));
    current = r.hash;
    if (restore) window.scrollTo(0, scrollPos[r.hash]);
    else window.scrollTo(0, 0);
    var h1 = main.querySelector('h1');
    // Фокус на заголовок — только при переходах; на первой загрузке начало страницы остаётся доступным (CR-11).
    if (h1 && !first && out.focus !== false) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
  }

  function go(hash) { byLink = true; if (location.hash === hash) render(); else location.hash = hash; }
  /** Замена текущей записи истории без перерисовки (фильтры, поле поиска). */
  function replace(hash) {
    if (history.replaceState) history.replaceState(null, '', hash); else location.replace(hash);
    current = parse(hash).hash;
  }

  function start() {
    window.addEventListener('hashchange', render);
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#/"]');
      if (a) byLink = true;
      // «К содержанию»: фокус на <main> без смены hash, чтобы не терять маршрут (CR-3).
      var skip = e.target.closest && e.target.closest('.skip-link');
      if (skip) {
        e.preventDefault();
        var m = document.getElementById('main');
        if (!m.hasAttribute('tabindex')) m.setAttribute('tabindex', '-1');
        m.focus();
      }
    });
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    render();
  }

  App.router = { parse: parse, prerendered: prerendered, href: href, searchHref: searchHref, go: go, replace: replace, start: start, render: render, setMeta: setMeta };
})(window);
