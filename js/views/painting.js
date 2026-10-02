/* App.views.painting — страница картины (spec §2 R4, §4, §6). */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  App.views = App.views || {};
  var U = App.util, esc = U.esc;

  function notFound() {
    return { title: 'Картина не найдена', html: '<div class="page page--narrow"><h1 class="page__title">Картина не найдена</h1>' +
      '<p>Такой картины нет в каталоге. Попробуйте поиск:</p>' + App.ui.searchBox({}) + '<p><a href="#/">Все сюжеты</a></p></div>',
      mount: function (el) { App.ui.bindAll(el); } };
  }

  function row(label, value) {
    return value ? '<div class="facts__row"><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>' : '';
  }
  function filterLink(kind, id, text) {
    return '<a href="' + esc(App.router.searchHref(kind === 'q' ? { q: id } : (function () { var o = {}; o[kind] = id; return o; })())) + '">' + esc(text) + '</a>';
  }
  /** Шумные значения credit из Commons («[2]», пусто) не показываем. */
  function goodCredit(c) { return c && c.length > 3 && !/^\[\d+\]$/.test(c.trim()); }

  function render(r) {
    var st = App.store, ui = App.ui, p = st.painting(r.args[0]);
    if (!p) return notFound();
    var s = st.subject(p.subject) || { title: '', paintings: [] };
    var a = st.artist(p.artist) || {}, m = st.museum(p.museum) || {}, e = st.epoch(p.epoch) || {};
    var im = p.image || {};
    var list = s.paintings || [], i = list.indexOf(p.id);
    var prev = i > 0 ? st.painting(list[i - 1]) : null, next = i >= 0 && i < list.length - 1 ? st.painting(list[i + 1]) : null;
    var other = list.filter(function (id) { return id !== p.id; })[0];
    var subjHref = App.router.href('subject', s.id);

    var facts = '<dl class="facts">' +
      row('Художник', filterLink('artist', p.artist, a.name) + ' ' + U.orig(a.name_orig, 'orig') + '<span class="facts__sub">' + esc(U.lifeYears(a)) + '</span>') +
      row('Датировка', esc(p.date_label)) +
      row('Эпоха', e.name ? filterLink('epoch', p.epoch, e.name) : '') +
      row('Техника', p.technique ? esc(p.technique) : '') +
      row('Музей', filterLink('museum', p.museum, m.name) + (m.name_orig && m.name_orig.text !== m.name ? ' ' + U.orig(m.name_orig, 'orig') : '')) +
      row('Город', m.city ? filterLink('city', m.city_id, m.city) + (m.city_orig && m.city_orig.text !== m.city ? ' ' + U.orig(m.city_orig, 'orig') : '') + (m.country ? '<span class="facts__sub">' + esc(m.country) + '</span>' : '') : '') +
      row('Инвентарный номер', p.inventory ? esc(p.inventory) : '') +
      '</dl>';

    var pager = (prev || next) ? '<nav class="pager" aria-label="Другие картины сюжета">' +
      (prev ? '<a class="pager__link" href="' + esc(App.router.href('painting', prev.id)) + '" rel="prev"><span class="pager__dir">← Предыдущая</span><span class="pager__name">' + esc((st.artist(prev.artist) || {}).name) + ', ' + esc(prev.date_label) + '</span></a>' : '<span></span>') +
      (next ? '<a class="pager__link pager__link--next" href="' + esc(App.router.href('painting', next.id)) + '" rel="next"><span class="pager__dir">Следующая →</span><span class="pager__name">' + esc((st.artist(next.artist) || {}).name) + ', ' + esc(next.date_label) + '</span></a>' : '<span></span>') +
      '</nav>' : '';

    var html = '<article class="painting">' +
      '<nav class="crumbs" aria-label="Навигация"><a href="#/">Каталог</a><span aria-hidden="true">/</span><a href="' + esc(subjHref) + '">' + esc(s.title) + '</a>' +
        (i >= 0 ? '<span aria-hidden="true">/</span><span>' + esc((i + 1) + ' из ' + list.length) + '</span>' : '') + '</nav>' +
      '<div class="painting__layout">' +
        '<div class="painting__media">' +
          '<button class="painting__zoom" type="button" data-open-viewer aria-label="Открыть крупно: ' + esc(im.alt || p.title) + '">' +
            ui.img(p, 'large', { fit: true, priority: true, sizes: ui.fitSizes(p, '55vw', 'calc(100vh - 144px)', '64vh') }) +
            '<span class="painting__zoom-hint" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Увеличить</span>' +
          '</button>' +
        '</div>' +
        '<div class="painting__info">' +
          (s.title && s.title !== p.title ? '<p class="eyebrow"><a href="' + esc(subjHref) + '">' + esc(s.title) + '</a></p>' : '') +
          '<h1 class="painting__title">' + esc(p.title) + '</h1>' +
          (p.title_orig ? '<p class="painting__orig">' + U.orig(p.title_orig, 'orig') + '</p>' : '') +
          '<p class="painting__byline">' + esc(a.name) + ', ' + esc(p.date_label) + '</p>' +
          '<div class="actions">' +
            (other ? '<a class="btn" href="' + esc(App.router.href('compare', [p.id, other])) + '">Сравнить с…</a>' : '') +
            '<button class="btn btn--ghost" type="button" data-share>Поделиться</button>' +
          '</div>' +
          facts +
          ((p.details || []).length ? '<section class="section section--tight" aria-labelledby="h-det"><h2 id="h-det">Что изображено</h2>' +
            '<ul class="details-list">' + p.details.map(function (d) { return '<li>' + esc(d.text) + '</li>'; }).join('') + '</ul></section>' : '') +
          (s.id ? '<a class="subject-link" href="' + esc(subjHref) + '"><span class="subject-link__k">Сюжет и как читать картину</span><span class="subject-link__t">' + esc(s.title) + '</span><span class="subject-link__r">' + esc(ui.refsLabel(s)) + '</span></a>' : '') +
          '<section class="source" aria-labelledby="h-src"><h2 id="h-src" class="source__title">Источник изображения</h2>' +
            '<p><span class="badge">' + esc(ui.licenseLabel(im)) + '</span></p>' +
            (im.commons_page ? '<p><a href="' + esc(im.commons_page) + '" target="_blank" rel="noopener">Страница файла в Wikimedia Commons</a></p>' : '') +
            (goodCredit(im.credit) ? '<p class="muted">Автор или источник файла: ' + esc(im.credit) + '</p>' : '') +
          '</section>' +
        '</div>' +
      '</div>' + pager +
      '</article>';

    return {
      title: p.title + ' — ' + (a.name || ''),
      description: p.title + ', ' + (a.name || '') + ', ' + p.date_label + '. ' + (m.name || '') + (m.city ? ', ' + m.city : '') + '.',
      html: html,
      mount: function (el) {
        el.addEventListener('click', function (ev) {
          var b = ev.target.closest('[data-open-viewer]');
          if (b) { if (b.querySelector('.is-failed')) return; App.viewer.open(p.id, b); return; }
          if (ev.target.closest('[data-share]')) App.ui.shareAction(p.title + ' — ' + (a.name || ''));
        });
      }
    };
  }

  App.views.painting = { render: render };
})(window);
