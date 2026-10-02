/* App.views.compare — сравнение двух картин (spec §2 R5, §4): #/compare/<idA>,<idB>. */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  App.views = App.views || {};
  var U = App.util, esc = U.esc;
  var SIDES = ['a', 'b'], LETTER = { a: 'A', b: 'B' };
  var mode = 'both'; // переключатель на телефоне: a | b | both; живёт, пока открыт экран сравнения

  /** «ок. 1599» не разрывать по строкам. */
  function nb(t) { return esc(t).replace(/(ок\.) /g, '$1\u00a0'); }

  function ids(r) {
    return String(r.args[0] || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  }

  /** Неверная ссылка: сообщение и выход к сюжету или каталогу (без пустого экрана). */
  function broken(found) {
    var st = App.store, p = found[0], s = p && st.subject(p.subject);
    var html = '<div class="page page--narrow"><h1 class="page__title">Сравнение не открылось</h1>' +
      '<p>' + (p ? 'Одной из картин по этой ссылке нет в каталоге.' : 'Картин по этой ссылке нет в каталоге.') + ' Возможно, ссылка устарела.</p>';
    if (p) {
      var other = (s ? s.paintings : []).filter(function (id) { return id !== p.id; })[0];
      html += '<div class="actions">' +
        (other ? '<a class="btn btn--primary" href="' + esc(App.router.href('compare', [p.id, other])) + '">Сравнить с другой версией</a>' : '') +
        (s ? '<a class="btn" href="' + esc(App.router.href('subject', s.id)) + '">' + esc(s.title) + '</a>' : '') + '</div>';
    } else {
      html += '<p>Найдите сюжет или картину:</p>' + App.ui.searchBox({});
    }
    html += '<p><a href="#/">Все сюжеты</a></p></div>';
    return { title: 'Сравнение не открылось', html: html, mount: function (el) { App.ui.bindAll(el); } };
  }

  /** Список для замены картины: сначала версии того же сюжета, затем остальные сюжеты. */
  function picker(side, p, other, subjectId) {
    var st = App.store;
    function opt(id) {
      var q = st.painting(id), a = st.artist(q.artist) || {};
      var dis = id === other.id;
      return '<option value="' + esc(id) + '"' + (id === p.id ? ' selected' : '') + (dis ? ' disabled' : '') + '>' +
        esc(a.name + ', ' + q.date_label + ' — ' + q.title) + (dis ? ' (уже в сравнении)' : '') + '</option>';
    }
    var groups = [];
    var own = st.subject(subjectId);
    if (own) groups.push('<optgroup label="' + esc('Этот сюжет: ' + own.title) + '">' + st.sortPaintings(own.paintings).map(opt).join('') + '</optgroup>');
    ['ot', 'nt'].forEach(function (t) {
      st.catalog(t).forEach(function (g) {
        g.subjects.forEach(function (s) {
          if (s.id === subjectId) return;
          groups.push('<optgroup label="' + esc(s.title) + '">' + st.sortPaintings(s.paintings).map(opt).join('') + '</optgroup>');
        });
      });
    });
    var id = 'cmp-pick-' + side;
    return '<div class="cmp__pick"><label class="cmp__pick-label" for="' + id + '">Заменить картину ' + LETTER[side] + '</label>' +
      '<select class="field__select cmp__select" id="' + id + '" data-pick="' + side + '">' + groups.join('') + '</select></div>';
  }

  function column(side, p, other, subjectId) {
    var st = App.store, ui = App.ui, a = st.artist(p.artist) || {}, im = p.image || {};
    return '<section class="cmp__col" data-side="' + side + '" aria-labelledby="cmp-t-' + side + '">' +
      '<button class="cmp__media" type="button" data-open-viewer="' + esc(p.id) + '" aria-label="' + esc('Открыть крупно: ' + (im.alt || p.title)) + '">' +
        ui.img(p, 'large', { fit: true, sizes: ui.fitSizes(p, '46vw', 'calc(100vh - 444px)', '64vh') }) +
        '<span class="cmp__letter" aria-hidden="true">' + LETTER[side] + '</span>' +
      '</button>' +
      '<div class="cmp__cap">' +
        '<h2 class="cmp__title" id="cmp-t-' + side + '"><a href="' + esc(App.router.href('painting', p.id)) + '">' + esc(p.title) + '</a></h2>' +
        (p.title_orig ? '<p class="cmp__orig">' + U.orig(p.title_orig, 'orig') + '</p>' : '') +
        '<p class="cmp__byline">' + esc(a.name) + ', ' + esc(p.date_label) + '</p>' +
      '</div>' +
      picker(side, p, other, subjectId) +
      '</section>';
  }

  function table(pa, pb) {
    var st = App.store;
    function cells(p) {
      var a = st.artist(p.artist) || {}, m = st.museum(p.museum) || {}, e = st.epoch(p.epoch) || {};
      return {
        artist: esc(a.name) + '<span class="cmp__sub">' + esc(U.lifeYears(a)) + '</span>',
        year: esc(p.date_label),
        epoch: esc(e.name || '—'),
        museum: esc(m.name || '—'),
        city: esc(m.city || '—') + (m.country ? '<span class="cmp__sub">' + esc(m.country) + '</span>' : ''),
        technique: esc(p.technique || '—')
      };
    }
    var A = cells(pa), B = cells(pb);
    var rows = [['artist', 'Художник'], ['year', 'Год'], ['epoch', 'Эпоха'], ['museum', 'Музей'], ['city', 'Город'], ['technique', 'Техника']];
    return '<table class="cmp-table"><caption class="visually-hidden">Атрибуция двух картин</caption>' +
      '<thead><tr><td></td><th scope="col" data-side="a"><span class="cmp__badge">A</span></th><th scope="col" data-side="b"><span class="cmp__badge">B</span></th></tr></thead><tbody>' +
      rows.map(function (r) {
        var same = A[r[0]] === B[r[0]] && r[0] !== 'artist' ? ' class="is-same"' : '';
        return '<tr' + same + '><th scope="row">' + esc(r[1]) + '</th><td data-side="a">' + A[r[0]] + '</td><td data-side="b">' + B[r[0]] + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function details(side, p) {
    var list = p.details || [];
    return '<div class="cmp__details" data-side="' + side + '"><h3 class="cmp__details-h"><span class="cmp__badge">' + LETTER[side] + '</span> ' + esc((App.store.artist(p.artist) || {}).name) + '</h3>' +
      (list.length ? '<ul class="details-list">' + list.map(function (d) { return '<li>' + esc(d.text) + '</li>'; }).join('') + '</ul>'
        : '<p class="muted">Описание деталей для этой картины пока не подготовлено.</p>') +
      '<p><a href="' + esc(App.router.href('painting', p.id)) + '">Страница картины</a></p></div>';
  }

  function render(r) {
    var st = App.store, list = ids(r);
    var pa = st.painting(list[0]), pb = st.painting(list[1]);
    if (!pa || !pb) return broken([pa, pb].filter(Boolean));
    var sa = st.subject(pa.subject), sb = st.subject(pb.subject);
    var same = sa && sb && sa.id === sb.id;
    var aa = st.artist(pa.artist) || {}, ab = st.artist(pb.artist) || {};
    var title = same ? sa.title : 'Две картины';
    var swapHref = App.router.href('compare', [pb.id, pa.id]);

    var html = '<article class="cmp" data-mode="' + esc(mode) + '">' +
      '<nav class="crumbs" aria-label="Навигация"><a href="#/">Каталог</a>' +
        (same ? '<span aria-hidden="true">/</span><a href="' + esc(App.router.href('subject', sa.id)) + '">' + esc(sa.title) + '</a>' : '') +
        '<span aria-hidden="true">/</span><span>Сравнение</span></nav>' +
      '<header class="cmp__head">' +
        '<div><p class="eyebrow">Сравнение версий</p><h1 class="cmp__h1">' + esc(title) + '</h1>' +
        '<p class="cmp__lead">' + nb(aa.name + ', ' + pa.date_label) + ' <span class="muted">и</span> ' + nb(ab.name + ', ' + pb.date_label) + '</p></div>' +
        '<div class="actions cmp__actions">' +
          '<a class="btn" href="' + esc(swapHref) + '"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M7 7h12l-3-3M17 17H5l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Поменять местами</a>' +
          '<button class="btn btn--ghost" type="button" data-share>Поделиться</button>' +
        '</div>' +
      '</header>' +
      '<div class="cmp__switch" role="group" aria-label="Что показать">' +
        [['a', 'A'], ['b', 'B'], ['both', 'Обе']].map(function (m) {
          return '<button class="cmp__seg" type="button" data-mode="' + m[0] + '" aria-pressed="' + (mode === m[0]) + '">' + m[1] + '</button>';
        }).join('') +
      '</div>' +
      '<div class="cmp__cols">' + column('a', pa, pb, pa.subject) + column('b', pb, pa, pb.subject) + '</div>' +
      '<section class="section section--tight" aria-labelledby="h-attr"><h2 id="h-attr">Атрибуция</h2>' + table(pa, pb) + '</section>' +
      '<section class="section section--tight" aria-labelledby="h-cmp-det"><h2 id="h-cmp-det">Что изображено</h2>' +
        '<div class="cmp__dgrid">' + details('a', pa) + details('b', pb) + '</div></section>' +
      (same ? '<p class="section__foot"><a class="btn" href="' + esc(App.router.href('subject', sa.id)) + '">Сюжет и как читать картины</a></p>' : '') +
      '</article>';

    return {
      title: 'Сравнение: ' + title,
      description: 'Сравнение картин: ' + pa.title + ' (' + aa.name + ', ' + pa.date_label + ') и ' + pb.title + ' (' + ab.name + ', ' + pb.date_label + ').',
      html: html,
      mount: function (el) {
        var root = el.querySelector('.cmp');
        el.addEventListener('click', function (e) {
          var v = e.target.closest('[data-open-viewer]');
          if (v) { if (v.querySelector('.is-failed')) return; App.viewer.open(v.getAttribute('data-open-viewer'), v); return; }
          var m = e.target.closest('[data-mode]');
          if (m && m.classList.contains('cmp__seg')) {
            mode = m.getAttribute('data-mode');
            root.setAttribute('data-mode', mode);
            var segs = root.querySelectorAll('.cmp__seg');
            for (var i = 0; i < segs.length; i++) segs[i].setAttribute('aria-pressed', segs[i] === m ? 'true' : 'false');
            return;
          }
          if (e.target.closest('[data-share]')) App.ui.shareAction('Сравнение: ' + title);
        });
        el.addEventListener('change', function (e) {
          var s = e.target.closest('[data-pick]');
          if (!s) return;
          var next = s.getAttribute('data-pick') === 'a' ? [s.value, pb.id] : [pa.id, s.value];
          App.router.go(App.router.href('compare', next));
        });
      }
    };
  }

  // Новый заход на сравнение (не смена картины внутри него) — снова «Обе».
  if (typeof document !== 'undefined') {
    document.addEventListener('app:route', function (e) { if (!e.detail || e.detail.name !== 'compare') mode = 'both'; });
  }

  App.views.compare = { render: render };
})(window);
