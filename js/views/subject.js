/* App.views.subject — страница сюжета (spec §2 R3, §4). */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  App.views = App.views || {};
  var U = App.util, esc = U.esc;

  var KIND = { before: 'Раньше', after: 'Дальше', parallel: 'Параллельный сюжет', typology: 'Прообраз в христианской типологии' };

  function notFound() {
    return { title: 'Сюжет не найден', html: '<div class="page page--narrow"><h1 class="page__title">Сюжет не найден</h1>' +
      '<p>Такого сюжета нет в каталоге. Попробуйте поиск:</p>' + App.ui.searchBox({}) + '<p><a href="#/">Все сюжеты</a></p></div>',
      mount: function (el) { App.ui.bindAll(el); } };
  }

  /** Связанные сюжеты: из данных, иначе соседние по повествованию в том же Завете. */
  function related(s) {
    var st = App.store, out = [];
    (s.related || []).forEach(function (r) { var o = st.subject(r.id); if (o) out.push({ s: o, label: KIND[r.kind] || '' }); });
    if (out.length) return out.slice(0, 4);
    var list = Object.keys(st.data.subjects).map(st.subject).filter(function (o) { return o.testament === s.testament; })
      .sort(function (a, b) { return a.order - b.order; });
    var i = list.findIndex(function (o) { return o.id === s.id; });
    if (list[i - 1]) out.push({ s: list[i - 1], label: 'Раньше по повествованию' });
    if (list[i + 1]) out.push({ s: list[i + 1], label: 'Дальше по повествованию' });
    return out;
  }

  /** Лента версий: картины по году, сгруппированы по эпохам. */
  function timeline(ps) {
    var st = App.store, groups = [];
    st.sortPaintings(ps.map(function (p) { return p.id; })).forEach(function (id) {
      var p = st.painting(id), g = groups[groups.length - 1];
      if (!g || g.epoch !== p.epoch) groups.push(g = { epoch: p.epoch, items: [] });
      g.items.push(p);
    });
    return '<ol class="timeline">' + groups.map(function (g) {
      var e = st.epoch(g.epoch) || { name: '' };
      return '<li class="timeline__epoch"><div class="timeline__head"><a class="timeline__name" href="' + esc(App.router.searchHref({ epoch: g.epoch })) + '">' + esc(e.name) + '</a>' +
        (e.from ? '<span class="timeline__range">' + esc(e.from + '–' + e.to) + '</span>' : '') + '</div>' +
        '<ol class="timeline__items">' + g.items.map(function (p) {
          var a = st.artist(p.artist) || {};
          return '<li><a class="timeline__item" href="' + esc(App.router.href('painting', p.id)) + '">' +
            '<span class="timeline__year">' + esc(p.date_label) + '</span>' +
            '<span class="timeline__who">' + esc(a.name) + '</span></a></li>';
        }).join('') + '</ol></li>';
    }).join('') + '</ol>';
  }

  function render(r) {
    var st = App.store, ui = App.ui, s = st.subject(r.args[0]);
    if (!s) return notFound();
    var cover = st.painting(s.cover);
    var ps = (s.paintings || []).map(st.painting).filter(Boolean);
    var origs = (s.titles_orig || []).map(function (o) { return U.orig(o, 'orig'); }).filter(Boolean).join('<span class="sep" aria-hidden="true"> · </span>');
    var refs = ui.refsLabel(s);
    var testament = s.testament === 'nt' ? 'Новый Завет' : 'Ветхий Завет';
    var compareHref = ps.length > 1 ? App.router.href('compare', [ps[0].id, ps[1].id]) : '';

    var html = '<article class="subject">' +
      '<nav class="crumbs" aria-label="Навигация"><a href="#/">Каталог</a><span aria-hidden="true">/</span><span>' + esc(testament) + (s.section ? ' · ' + esc(s.section) : '') + '</span></nav>' +
      '<header class="subject__hero">' +
        (cover ? '<a class="subject__cover" href="' + esc(App.router.href('painting', cover.id)) + '" aria-label="' + esc('Обложка: ' + (cover.image && cover.image.alt || cover.title) + '. Открыть картину') + '">' +
          ui.img(cover, 'large', { fit: true, priority: true, sizes: ui.fitSizes(cover, '40vw', '66vh', '52vh') }) + '</a>' : '') +
        '<div class="subject__head">' +
          '<h1 class="subject__title">' + esc(s.title) + '</h1>' +
          (origs ? '<p class="subject__orig">' + origs + '</p>' : '') +
          (refs ? '<p class="subject__refs">' + esc(refs) + '</p>' : '') +
        '</div>' +
        '<p class="subject__summary">' + esc(s.summary) + '</p>' +
        // На телефоне кнопки стоят сразу под заголовком (видны без прокрутки), на десктопе — под резюме.
        '<div class="actions subject__actions">' +
          '<a class="btn btn--primary" href="#how-to-read" data-jump="how-to-read">Как читать картину</a>' +
          (compareHref ? '<a class="btn" href="' + esc(compareHref) + '">Сравнить версии</a>' : '') +
          '<button class="btn btn--ghost" type="button" data-share>Поделиться</button>' +
        '</div>' +
      '</header>' +

      '<div class="subject__body">' +
        '<details class="retelling"><summary class="retelling__toggle"><span class="retelling__more">Читать полностью</span><span class="retelling__less">Свернуть пересказ</span></summary>' +
          '<div class="retelling__text prose">' + U.text(s.retelling) + '</div></details>' +

        (s.quote && s.quote.text ? '<figure class="quote"><blockquote><p>' + esc(s.quote.text) + '</p></blockquote>' +
          '<figcaption>' + esc(s.quote.ref) + ', Синодальный перевод</figcaption></figure>' : '') +

        '<section class="section how" id="how-to-read" aria-labelledby="h-how" tabindex="-1">' +
          '<h2 id="h-how">Как читать картину</h2>' +
          '<p class="section__lead muted">На что смотреть, чтобы узнать сюжет и героев.</p>' +
          '<ol class="signs">' + (s.how_to_read || []).map(function (h) {
            var c = h.character ? st.character(h.character) : null;
            return '<li class="sign"><span class="sign__name">' + esc(h.sign) + '</span>' +
              '<span class="sign__meaning">' + esc(h.meaning) + '</span>' +
              (c ? '<a class="sign__who" href="' + esc(App.router.searchHref({ q: c.name })) + '">' + esc(c.name) + '</a>' : '') + '</li>';
          }).join('') + '</ol>' +
        '</section>' +

        '<section class="section" aria-labelledby="h-gallery">' +
          '<h2 id="h-gallery">Картины <span class="section__n">' + esc(ps.length) + '</span></h2>' +
          '<ul class="grid grid--paintings grid--gallery">' + ps.map(ui.paintingCard).join('') + '</ul>' +
        '</section>' +

        (ps.length > 1 ? '<section class="section" aria-labelledby="h-time">' +
          '<h2 id="h-time">Версии по эпохам</h2>' + timeline(ps) +
          (compareHref ? '<p class="section__foot"><a class="btn" href="' + esc(compareHref) + '">Сравнить версии</a></p>' : '') +
        '</section>' : '');

    var rel = related(s);
    if (rel.length) {
      html += '<section class="section" aria-labelledby="h-rel"><h2 id="h-rel">Связанные сюжеты</h2><ul class="related">' +
        rel.map(function (x) {
          return '<li><a class="related__link" href="' + esc(App.router.href('subject', x.s.id)) + '">' +
            (x.label ? '<span class="related__kind">' + esc(x.label) + '</span>' : '') +
            '<span class="related__title">' + esc(x.s.title) + '</span>' +
            '<span class="related__refs">' + esc(ui.refsLabel(x.s)) + '</span></a></li>';
        }).join('') + '</ul></section>';
    }
    html += '</div></article>';

    return {
      title: s.title,
      description: s.summary,
      html: html,
      mount: function (el) {
        el.addEventListener('click', function (e) {
          var j = e.target.closest('[data-jump]');
          if (j) {
            e.preventDefault();
            var t = document.getElementById(j.getAttribute('data-jump'));
            if (t) {
              t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
              t.focus({ preventScroll: true });
            }
            return;
          }
          if (e.target.closest('[data-share]')) App.ui.shareAction(s.title);
        });
      }
    };
  }

  App.views.subject = { render: render };
})(window);
