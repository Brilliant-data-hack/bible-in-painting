/* App.views.lectures — список лекций #/lectures и карточка лекции для главной (spec_lectures.md §5.1, §5.5). */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  App.views = App.views || {};
  var U = App.util, esc = U.esc;

  var INTRO = 'Короткие маршруты по сюжетам: 10–15 минут чтения и ключевые картины.';

  /** Метка статуса: «Шаг k из N» / «Пройдена» / пусто. */
  function badge(st) {
    if (st.state === 'done') return '<span class="lstatus lstatus--done"><span aria-hidden="true">✓</span>Пройдена</span>';
    if (st.state === 'progress') return '<span class="lstatus lstatus--progress">Шаг ' + esc(st.step) + ' из ' + esc(st.total) + '</span>';
    return '';
  }

  /** Карточка лекции (<li>, ссылка целиком). compact — для главной: на телефоне строка «миниатюра 96 px + текст». */
  function card(l, compact) {
    var L = App.lectures, cover = App.store.painting(l.cover), n = (l.steps || []).length;
    return '<li class="card card--lecture' + (compact ? ' card--lecture-compact' : '') + '">' +
      '<a class="card__link" href="' + esc(L.href(l.id)) + '">' +
      (cover ? App.ui.img(cover, 'thumb', { cls: 'card__img' }) : '<span class="img-wrap card__img"></span>') +
      '<span class="card__body"><span class="card__eyebrow">Лекция</span>' +
      '<span class="card__title">' + esc(l.title) + '</span>' +
      (l.subtitle ? '<span class="card__sub">' + esc(l.subtitle) + '</span>' : '') +
      '<span class="card__foot"><span class="card__meta">' + esc(U.count(n, ['шаг', 'шага', 'шагов'])) + ' · ' + esc(l.minutes) + ' мин</span>' +
      badge(L.status(l.id)) + '</span>' +
      '</span></a></li>';
  }

  function render() {
    var list = App.lectures.list(), html;
    if (!list.length) {
      html = '<div class="page page--narrow"><h1 class="page__title">Лекции</h1>' +
        '<p class="muted">Лекции скоро появятся. Пока можно посмотреть сюжеты и картины в каталоге.</p>' +
        '<p><a class="btn" href="#/">На главную</a></p></div>';
    } else {
      html = '<div class="page lectures">' +
        '<header class="page__head"><h1 class="page__title">Лекции</h1><p class="lectures__intro">' + esc(INTRO) + '</p></header>' +
        '<ul class="grid grid--lectures">' + list.map(function (l) { return card(l, false); }).join('') + '</ul></div>';
    }
    return { title: 'Лекции', description: INTRO, html: html };
  }

  App.views.lectures = { render: render, card: card };
})(window);
