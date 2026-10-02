/* App.views.home — главная: поиск первым экраном, ниже каталог ВЗ/НЗ (spec §2 R1, §4). */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  App.views = App.views || {};
  var U = App.util, esc = U.esc;

  var TESTAMENTS = [['ot', 'Ветхий Завет'], ['nt', 'Новый Завет']];
  var EXAMPLES = ['Юдифь', 'Караваджо', 'Благовещение', 'Noli me tangere'];

  function render() {
    var st = App.store, ui = App.ui, D = st.data;
    var html = '<section class="hero">' +
      '<h1 class="hero__title">Библия в живописи</h1>' +
      '<p class="hero__lead">Библейские сюжеты и картины на каждый из них: кто изображён, как читать картину и где она хранится.</p>' +
      ui.searchBox({ big: true }) +
      '<p class="hero__examples">Например: ' + EXAMPLES.map(function (q) {
        return '<a href="' + esc(App.router.searchHref({ q: q })) + '">' + esc(q) + '</a>';
      }).join(', ') + '</p>' +
      '</section>' +
      '<div data-slot="recent"></div>' +
      '<nav class="catalog-nav" aria-label="Разделы каталога">' + TESTAMENTS.map(function (t) {
        return '<a class="chip" href="#catalog-' + t[0] + '" data-anchor>' + esc(t[1]) + '</a>';
      }).join('') + '<span class="catalog-nav__count">' +
      esc(U.count(D.meta.counts.subjects, ['сюжет', 'сюжета', 'сюжетов'])) + ' · ' +
      esc(U.count(D.meta.counts.paintings, ['картина', 'картины', 'картин'])) + '</span></nav>';

    TESTAMENTS.forEach(function (t) {
      var groups = st.catalog(t[0]);
      if (!groups.length) return;
      html += '<section class="catalog" id="catalog-' + t[0] + '" aria-labelledby="h-' + t[0] + '">' +
        '<h2 class="catalog__title" id="h-' + t[0] + '">' + esc(t[1]) + '</h2>';
      groups.forEach(function (g) {
        if (g.name) html += '<h3 class="catalog__section">' + esc(g.name) + '</h3>';
        html += '<ul class="grid grid--subjects">' + g.subjects.map(ui.subjectCard).join('') + '</ul>';
      });
      html += '</section>';
    });

    return {
      title: '',
      description: 'Библейские сюжеты Ветхого и Нового Завета и картины на каждый сюжет: кто изображён, как читать картину и где она хранится.',
      html: html,
      mount: function (el) {
        App.ui.bindAll(el);
        el.addEventListener('click', function (e) {
          var a = e.target.closest('[data-anchor]');
          if (!a) return;
          e.preventDefault();
          var target = document.getElementById(a.getAttribute('href').slice(1));
          if (target) { target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); target.querySelector('h2').setAttribute('tabindex', '-1'); target.querySelector('h2').focus({ preventScroll: true }); }
        });
        if (App.views.home.onMount) App.views.home.onMount(el); // точка расширения для «Недавно» (F2)
      }
    };
  }

  App.views.home = { render: render };
})(window);
