/* app.js — старт: проверка DATA, индексы, шапка, заглушки экранов F2/F3, запуск роутера (spec §7). */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  App.views = App.views || {};
  var U = App.util, esc = U.esc;

  function stub(title) {
    return { render: function () {
      return { title: title, html: '<div class="page page--narrow"><h1 class="page__title">' + esc(title) + '</h1>' +
        '<p class="muted">Этот раздел скоро появится.</p><p><a class="btn" href="#/">На главную</a></p></div>' };
    } };
  }
  // Экраны F2/F3 подключаются своими файлами раньше app.js; пока их нет — заглушки, чтобы маршруты не падали.
  App.views.subject = App.views.subject || stub('Сюжет');
  App.views.painting = App.views.painting || stub('Картина');
  App.views.compare = App.views.compare || stub('Сравнение');
  App.views.about = App.views.about || stub('О проекте');
  App.views.lectures = App.views.lectures || stub('Лекции');
  App.views.lecture = App.views.lecture || stub('Лекция');
  App.views.notFound = App.views.notFound || { render: function () {
    return { title: 'Страница не найдена', html: '<div class="page page--narrow"><h1 class="page__title">Страница не найдена</h1>' +
      '<p>Такой страницы нет. Попробуйте найти сюжет или картину:</p>' + App.ui.searchBox({}) +
      '<p><a href="#/">На главную</a></p></div>', mount: function (el) { App.ui.bindAll(el); } };
  } };

  function header() {
    var h = document.getElementById('site-header');
    h.innerHTML = '<div class="site-header__inner">' +
      '<a class="brand" href="#/"><span class="brand__mark" aria-hidden="true"></span>Библия в живописи</a>' +
      '<nav class="site-nav" aria-label="Основное меню">' +
      '<button class="icon-btn site-nav__search" type="button" aria-expanded="false" aria-controls="header-search" data-header-search aria-label="Открыть поиск">' + App.ui.ICON.search + '</button>' +
      (App.lectures && App.lectures.list().length ? '<a class="site-nav__link site-nav__link--lectures" href="#/lectures">Лекции</a>' : '') +
      '<a class="site-nav__link" href="#/about">О проекте</a></nav></div>' +
      '<div class="header-search" id="header-search" hidden>' + App.ui.searchBox({}) + '</div>' +
      (App.store.data.meta.draft ? '<p class="draft-banner">Черновая сборка: данные ещё не проверены</p>' : '');
    App.ui.bindAll(h);
    var btn = h.querySelector('[data-header-search]'), panel = h.querySelector('#header-search');
    function toggle(open) {
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Закрыть поиск' : 'Открыть поиск');
      if (open) panel.querySelector('input').focus();
    }
    btn.addEventListener('click', function () { toggle(panel.hidden); });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !e.defaultPrevented && !panel.querySelector('[role=listbox]:not([hidden])')) { toggle(false); btn.focus(); } });
    document.addEventListener('app:route', function (e) {
      var name = e.detail.name;
      toggle(false);
      // На главной и в выдаче поле поиска уже на экране — иконка в шапке не нужна.
      btn.hidden = name === 'home' || name === 'search';
      document.body.classList.remove('has-drawer');
      document.body.setAttribute('data-route', name);
    });
  }

  function start() {
    var main = document.getElementById('main');
    if (!root.DATA || !root.DATA.subjects) {
      main.innerHTML = '<div class="page page--narrow"><h1 class="page__title">Данные не загрузились</h1><p>Обновите страницу. Если не помогло — данные сайта повреждены или отсутствуют.</p></div>';
      return;
    }
    App.store.init(root.DATA);
    App.search.build(root.DATA);
    document.documentElement.classList.add('js');
    document.addEventListener('error', App.ui.onImgError, true);
    header();
    App.router.start();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(window);
