/* App.views.results — выдача поиска и фильтры (spec §2 R2, R6, §4). Состояние — в URL #/search?q=&artist=&epoch=&museum=&city= */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  App.views = App.views || {};
  var U = App.util, esc = U.esc;

  var FACET_NAMES = { artist: 'Художник', epoch: 'Эпоха', museum: 'Музей', city: 'Город' };
  var F_PL = ['картина', 'картины', 'картин'], S_PL = ['сюжет', 'сюжета', 'сюжетов'], A_PL = ['художник', 'художника', 'художников'];

  function stateOf(params) {
    var s = { q: (params.q || '').trim() };
    // Неизвестное значение фильтра из старой или битой ссылки отбрасываем (CR-8).
    App.store.FACETS.forEach(function (k) { var v = params[k] || ''; s[k] = v && App.store.facetValues(k).indexOf(v) >= 0 ? v : ''; });
    return s;
  }
  function filtersOf(s) {
    var f = {}; App.store.FACETS.forEach(function (k) { if (s[k]) f[k] = s[k]; }); return f;
  }
  function activeCount(s) { return App.store.FACETS.filter(function (k) { return s[k]; }).length; }

  function facetSelect(kind, s, counts) {
    var st = App.store, id = 'f-' + kind;
    var opts = '<option value="">Все</option>' + st.facetValues(kind).map(function (v) {
      var n = counts[v] || 0, sel = s[kind] === v;
      if (!n && !sel) return '<option value="' + esc(v) + '" disabled>' + esc(st.facetLabel(kind, v)) + ' (0)</option>';
      return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(st.facetLabel(kind, v)) + ' (' + n + ')</option>';
    }).join('');
    return '<div class="field"><label class="field__label" for="' + id + '">' + FACET_NAMES[kind] + '</label>' +
      '<select class="field__select" id="' + id + '" data-facet="' + kind + '">' + opts + '</select></div>';
  }

  function summary(r, s) {
    var parts = [];
    if (r.subjects.length) parts.push(U.count(r.subjects.length, S_PL));
    if (r.artists.length) parts.push(U.count(r.artists.length, A_PL));
    if (r.paintings.length) parts.push(U.count(r.paintings.length, F_PL));
    return parts.length ? 'Найдено: ' + parts.join(', ') : 'Ничего не найдено';
  }

  function body(s) {
    var st = App.store, ui = App.ui, R = App.router;
    var r = App.search.query(s.q, filtersOf(s));
    var n = activeCount(s);

    var filters = '<aside class="filters" id="filters" aria-labelledby="filters-title" data-filters>' +
      '<div class="filters__head"><h2 class="filters__title" id="filters-title">Фильтры</h2>' +
      '<button class="icon-btn filters__close" type="button" data-close-filters aria-label="Закрыть фильтры">' + ui.ICON.close + '</button></div>' +
      st.FACETS.map(function (k) { return facetSelect(k, s, r.facets[k]); }).join('') +
      '<div class="filters__actions">' +
      '<button class="btn btn--ghost" type="button" data-reset' + (n ? '' : ' disabled') + '>Сбросить фильтры</button>' +
      '<button class="btn btn--primary filters__apply" type="button" data-close-filters>Показать ' + esc(U.count(r.paintings.length, F_PL)) + '</button>' +
      '</div></aside>';

    var chips = st.FACETS.filter(function (k) { return s[k]; }).map(function (k) {
      return '<button class="chip chip--active" type="button" data-remove="' + k + '" aria-label="Убрать фильтр: ' + esc(FACET_NAMES[k] + ' — ' + st.facetLabel(k, s[k])) + '">' +
        '<span class="chip__k">' + FACET_NAMES[k] + ':</span> ' + esc(st.facetLabel(k, s[k])) + ui.ICON.close + '</button>';
    }).join('');

    var main = '<div class="results__bar">' +
      '<button class="btn filters-toggle" type="button" aria-controls="filters" aria-expanded="false" data-open-filters>' + ui.ICON.filter + ' Фильтры' + (n ? ' (' + n + ')' : '') + '</button>' +
      chips + (n ? '<button class="link-btn" type="button" data-reset>Сбросить</button>' : '') + '</div>';

    if (r.layout) main += '<p class="note">Учли запрос в другой раскладке клавиатуры.</p>';

    if (r.empty) {
      main += '<div class="empty"><p class="empty__title">' + (r.noWords ? 'Введите слово для поиска' : s.q ? 'По запросу «' + esc(s.q) + '» ничего не нашлось' : 'Под эти фильтры картин нет') + '</p>';
      if (r.suggestions.length) {
        main += '<p>' + (r.suggestions.every(function (h) { return h.fallback; }) ? 'Популярные сюжеты:' : 'Возможно, вы искали:') + '</p><ul class="empty__list">' + r.suggestions.map(function (h) {
          var info = ui.hitInfo(h);
          return '<li><a href="' + esc(info.href) + '">' + esc(info.label) + '</a> <span class="muted">' + esc(info.sub || '') + '</span></li>';
        }).join('') + '</ul>';
      }
      main += '<p class="empty__more">' + (n ? '<button class="link-btn" type="button" data-reset>Сбросить фильтры</button> или ' : '') +
        '<a href="#/">посмотрите весь каталог сюжетов</a>.</p></div>';
    } else {
      if (r.places.length && s.q) {
        main += '<div class="places"><span class="muted">Музеи и города:</span> ' + r.places.slice(0, 6).map(function (h) {
          var info = ui.hitInfo(h);
          return '<a class="chip" href="' + esc(info.href) + '">' + esc(info.label) + (info.sub && h.type === 'museum' ? ', ' + esc(info.sub) : '') + '</a>';
        }).join('') + '</div>';
      }
      if (r.subjects.length) {
        main += '<section class="group" aria-labelledby="g-subjects"><h2 class="group__title" id="g-subjects">Сюжеты <span class="group__n">' + r.subjects.length + '</span></h2>' +
          '<ul class="grid grid--subjects">' + r.subjects.map(function (h) { return ui.subjectCard(st.subject(h.id)); }).join('') + '</ul></section>';
      }
      if (r.artists.length) {
        main += '<section class="group" aria-labelledby="g-artists"><h2 class="group__title" id="g-artists">Художники <span class="group__n">' + r.artists.length + '</span></h2>' +
          '<ul class="artists">' + r.artists.map(function (h) { return ui.artistItem(st.artist(h.id)); }).join('') + '</ul></section>';
      }
      if (r.paintings.length) {
        main += '<section class="group" aria-labelledby="g-paintings"><h2 class="group__title" id="g-paintings">Картины <span class="group__n">' + r.paintings.length + '</span></h2>' +
          '<ul class="grid grid--paintings">' + r.paintings.map(function (id) { return ui.paintingCard(st.painting(id)); }).join('') + '</ul></section>';
      }
    }

    return { r: r, html: '<div class="results">' + filters + '<div class="results__main">' + main + '</div></div>' };
  }

  function heading(s) {
    if (s.q) return '«' + s.q + '»';
    var st = App.store, f = st.FACETS.filter(function (k) { return s[k]; });
    if (f.length === 1) return st.facetLabel(f[0], s[f[0]]);
    return 'Все картины';
  }

  function render(route) {
    var s = stateOf(route.params), b = body(s);
    var html = '<div class="page page--results">' +
      '<header class="page__head"><p class="eyebrow">Поиск</p><h1 class="page__title">' + esc(heading(s)) + '</h1>' +
      '<p class="results__count" aria-live="polite" data-count>' + esc(summary(b.r, s)) + '</p></header>' +
      App.ui.searchBox({ value: s.q }).replace('data-search', 'data-search data-keep-filters') +
      '<div data-results>' + b.html + '</div></div>';
    return {
      title: s.q ? 'Поиск: ' + s.q : heading(s),
      description: 'Результаты поиска по сюжетам, картинам и художникам.',
      html: html,
      mount: function (el) { mount(el, s); }
    };
  }

  function mount(el, s) {
    App.ui.bindAll(el);
    var box = el.querySelector('[data-results]'), count = el.querySelector('[data-count]');
    var drawerOpen = false;
    // Затемнение под шторкой — отдельный элемент: клик по нему закрывает шторку (CR-9).
    var backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    backdrop.hidden = true;
    backdrop.addEventListener('click', function () { setDrawer(false, true); });
    el.appendChild(backdrop);

    function setDrawer(open, focusBack) {
      drawerOpen = open;
      var f = box.querySelector('[data-filters]'), t = box.querySelector('[data-open-filters]');
      f.classList.toggle('is-open', open);
      t.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('has-drawer', open);
      backdrop.hidden = !open;
      if (open) { var first = f.querySelector('select'); if (first) first.focus(); }
      else if (focusBack) t.focus();
    }

    function update(next, focusSel) {
      s = next;
      var b = body(s);
      box.innerHTML = b.html;
      count.textContent = summary(b.r, s);
      var h1 = el.querySelector('h1'); if (h1) h1.textContent = heading(s);
      var p = { q: s.q }; App.store.FACETS.forEach(function (k) { p[k] = s[k]; });
      App.router.replace(App.router.searchHref(p));
      App.router.setMeta(s.q ? 'Поиск: ' + s.q : heading(s));
      if (drawerOpen) setDrawer(true);
      var f = focusSel && box.querySelector(focusSel);
      if (f && !f.disabled) f.focus();
    }

    box.addEventListener('change', function (e) {
      var sel = e.target.closest('[data-facet]'); if (!sel) return;
      var next = Object.assign({}, s); next[sel.getAttribute('data-facet')] = sel.value;
      update(next, '#' + sel.id);
    });
    box.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-open-filters')) setDrawer(true);
      else if (t.hasAttribute('data-close-filters')) setDrawer(false, true);
      else if (t.hasAttribute('data-reset')) {
        var next = { q: s.q }; App.store.FACETS.forEach(function (k) { next[k] = ''; });
        update(next, drawerOpen ? '#f-artist' : '[data-open-filters]');
      } else if (t.hasAttribute('data-remove')) {
        var n2 = Object.assign({}, s); n2[t.getAttribute('data-remove')] = '';
        update(n2, '[data-open-filters]');
      }
    });
    el.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawerOpen) setDrawer(false, true); });
    // Ловушка фокуса: пока шторка открыта, Tab ходит только по её элементам (CR-9).
    function onTab(e) {
      if (!document.contains(el)) { document.removeEventListener('keydown', onTab); document.body.classList.remove('has-drawer'); return; }
      if (!drawerOpen || e.key !== 'Tab') return;
      var f = box.querySelector('[data-filters]');
      if (!f || getComputedStyle(f).position !== 'fixed') return; // на десктопе колонка, а не шторка
      var list = Array.prototype.filter.call(f.querySelectorAll('select, button, a[href], input'), function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1], a = document.activeElement;
      if (!f.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onTab);
  }

  App.views.results = { render: render };
})(window);
