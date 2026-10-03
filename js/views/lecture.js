/* App.views.lecture — обложка, шаг и финал лекции (spec_lectures.md §5.2–5.4, §6, §8).
   Маршруты: #/lecture/<id>, #/lecture/<id>/<n>, #/lecture/<id>/done. */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  App.views = App.views || {};
  var U = App.util, esc = U.esc;

  var loadErr = false;      // последняя загрузка текстов не удалась → показываем «Повторить»
  var keepFocus = false;    // перерисовка после загрузки: фокус не трогаем, если пользователь ушёл с h1

  function L() { return App.lectures; }
  function st() { return App.store; }
  function steps(n) { return U.count(n, ['шаг', 'шага', 'шагов']); }

  /** Первые ~160 знаков до границы слова. */
  function snippet(s) {
    s = String(s || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    if (s.length <= 160) return s;
    var cut = s.slice(0, 160), sp = cut.lastIndexOf(' ');
    return (sp > 80 ? cut.slice(0, sp) : cut).replace(/[,;:.\s—–-]+$/, '') + '…';
  }

  /** Кнопка-обёртка картины для просмотрщика. */
  function zoom(p, cls, sizes) {
    var im = p.image || {};
    return '<button class="' + cls + '" type="button" data-open-viewer="' + esc(p.id) + '" aria-label="' + esc('Открыть крупно: ' + (im.alt || p.title)) + '">' +
      App.ui.img(p, 'large', { fit: true, sizes: sizes }) +
      '<span class="lzoom-hint" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Увеличить</span>' +
      '</button>';
  }

  /* ---------- Обложка ---------- */
  function cover(l) {
    var pr = L().progress(l.id), list = l.steps || [], N = list.length;
    var k = pr && !pr.done ? pr.step : 0, done = !!(pr && pr.done);
    var c = st().painting(l.cover), first = L().href(l.id, 1);
    var actions;
    if (done) actions = '<a class="btn btn--primary" href="' + esc(first) + '" data-reset>Пройти заново</a>' +
      '<a class="btn" href="' + esc(L().href(l.id, 'done')) + '">К финалу</a>';
    else if (k >= 2) actions = '<a class="btn btn--primary" href="' + esc(L().href(l.id, k)) + '">Продолжить с шага ' + esc(k) + '</a>' +
      '<a class="btn" href="' + esc(first) + '" data-reset>Начать сначала</a>';
    else actions = '<a class="btn btn--primary" href="' + esc(first) + '">Начать</a>';

    var passedTo = done ? N : (k >= 2 ? k - 1 : 0);
    var toc = '<ol class="ltoc">' + list.map(function (s, i) {
      var n = i + 1, passed = n <= passedTo, here = !done && k >= 2 && n === k;
      return '<li class="ltoc__item' + (passed ? ' is-passed' : '') + (here ? ' is-here' : '') + '">' +
        '<a class="ltoc__link" href="' + esc(L().href(l.id, n)) + '"' + (here ? ' aria-current="step"' : '') + '>' +
        '<span class="ltoc__n">' + esc(n) + '</span>' +
        '<span class="ltoc__t">' + esc(s.title) + '</span>' +
        (passed ? '<span class="ltoc__mark" role="img" aria-label="пройден">✓</span>' : '') +
        (here ? '<span class="ltoc__here">вы здесь</span>' : '') +
        '</a></li>';
    }).join('') + '</ol>';

    var html = '<article class="lecture lcover">' +
      '<nav class="crumbs" aria-label="Навигация"><a href="#/lectures">← Все лекции</a></nav>' +
      '<header class="lcover__hero">' +
        '<div class="lcover__head">' +
          '<p class="eyebrow">Лекция</p>' +
          '<h1 class="lcover__title">' + esc(l.title) + '</h1>' +
          (l.subtitle ? '<p class="lcover__sub">' + esc(l.subtitle) + '</p>' : '') +
        '</div>' +
        (c ? '<div class="lcover__media">' + zoom(c, 'lzoom lcover__zoom', App.ui.fitSizes(c, '46vw', '70vh', '56vh')) + '</div>' : '') +
        '<div class="lcover__info">' +
          '<p class="lcover__lead">' + esc(l.lead) + '</p>' +
          '<p class="lcover__meta">' + esc(steps(N)) + ' · ' + esc(l.minutes) + ' мин' +
            (done ? ' <span class="lstatus lstatus--done"><span aria-hidden="true">✓</span>Пройдена</span>' : '') +
            (k >= 2 ? ' <span class="lstatus lstatus--progress">Шаг ' + esc(k) + ' из ' + esc(N) + '</span>' : '') + '</p>' +
          '<div class="actions lcover__actions">' + actions + '</div>' +
        '</div>' +
      '</header>' +
      '<section class="section lcover__toc" aria-labelledby="h-toc"><h2 id="h-toc">Содержание</h2>' + toc + '</section>' +
      '</article>';

    return {
      title: l.title + ' — лекция', description: l.lead, html: html,
      mount: function (el) { bind(el, l); }
    };
  }

  /* ---------- Шаг ---------- */
  function figure(sp, two) {
    var p = st().painting(sp.id);
    if (!p) return '';
    var sizes = two ? App.ui.fitSizes(p, '44vw', '62vh', '70vh') : App.ui.fitSizes(p, '880px', '70vh', '70vh');
    return '<figure class="lfig">' + zoom(p, 'lzoom lfig__zoom', sizes) +
      '<figcaption class="lfig__cap">' +
        '<span class="lfig__title">' + esc(p.title) + '</span>' + App.ui.attribution(p) +
        (sp.caption ? '<span class="lfig__look">' + esc(sp.caption) + '</span>' : '') +
        '<a class="lfig__more" href="' + esc(App.router.href('painting', p.id)) + '">О картине</a>' +
      '</figcaption></figure>';
  }

  function step(l, n) {
    var cat = l.steps || [], N = cat.length, cs = cat[n - 1] || {};
    var full = L().steps(l.id), s = full ? full[n - 1] : null;
    // Тексты загружены, но этой лекции/шага в них нет (рассинхрон data.js и data.lectures.js) — не грузим повторно (CR8-1).
    var missing = !s && L().isLoaded();
    var title = (s && s.title) || cs.title || ('Шаг ' + n);
    var pos = 'Шаг ' + n + ' из ' + N;
    var body;

    if (s) {
      var ps = (s.paintings || []).filter(function (x) { return st().painting(x.id); });
      var subj = s.subject ? st().subject(s.subject) : null;
      body = (ps.length ? '<div class="lstep__figs lstep__figs--' + ps.length + '">' + ps.map(function (x) { return figure(x, ps.length > 1); }).join('') + '</div>' : '') +
        '<div class="lstep__text prose">' + U.text(s.text) + '</div>' +
        (s.quote && s.quote.text ? '<figure class="quote lstep__quote"><blockquote><p>' + esc(s.quote.text) + '</p></blockquote>' +
          '<figcaption><cite>' + (subj ? '<a href="' + esc(App.router.href('subject', subj.id)) + '">' + esc(s.quote.ref) + '</a>' : esc(s.quote.ref)) + '</cite>, Синодальный перевод</figcaption></figure>' : '') +
        (subj ? '<a class="subject-link lstep__subject" href="' + esc(App.router.href('subject', subj.id)) + '"><span class="subject-link__k">Сюжет и как читать</span>' +
          '<span class="subject-link__t">' + esc(subj.title) + '</span><span class="subject-link__r">' + esc(App.ui.refsLabel(subj)) + '</span></a>' : '');
    } else if (missing) {
      body = '<div class="lstep__state" role="alert"><p>Текст этого шага не найден — вероятно, сайт только что обновился. Обновите страницу.</p>' +
        '<button class="btn" type="button" data-reload>Обновить страницу</button></div>';
    } else if (loadErr) {
      body = '<div class="lstep__state" role="alert"><p>Не удалось загрузить текст лекции. Проверьте соединение и попробуйте ещё раз.</p>' +
        '<button class="btn" type="button" data-retry>Повторить</button></div>';
    } else {
      body = '<div class="lstep__state lstep__state--busy" aria-busy="true"><span class="lspinner" aria-hidden="true"></span><p>Загрузка…</p></div>';
    }

    var prev = n > 1 ? { href: L().href(l.id, n - 1), dir: '← Назад', name: cat[n - 2].title }
      : { href: L().href(l.id), dir: '← Назад', name: 'К обложке' };
    var next = n < N ? { href: L().href(l.id, n + 1), dir: 'Далее →', name: cat[n].title }
      : { href: L().href(l.id, 'done'), dir: 'Завершить', name: 'Итог лекции' };
    function link(o, rel) {
      return '<a class="lnav__link lnav__link--' + rel + '" href="' + esc(o.href) + '" rel="' + rel + '">' +
        '<span class="lnav__dir">' + esc(o.dir) + '</span><span class="lnav__name">' + esc(o.name) + '</span></a>';
    }

    var html = '<article class="lecture lstep">' +
      '<div class="lstep__bar"><a class="lstep__lecture" href="' + esc(L().href(l.id)) + '">Лекция: ' + esc(l.title) + '</a>' +
        '<span class="lstep__pos" id="lstep-pos">' + esc(pos) + '</span></div>' +
      '<progress class="lstep__progress" max="' + esc(N) + '" value="' + esc(n) + '" aria-labelledby="lstep-pos"></progress>' +
      '<h1 class="lstep__title">' + esc(title) + '</h1>' +
      '<div class="lstep__body">' + body + '</div>' +
      '<nav class="lnav" aria-label="Шаги лекции">' + link(prev, 'prev') + link(next, 'next') + '</nav>' +
      '</article>';

    return {
      title: title + ' — ' + l.title + ', шаг ' + n + ' из ' + N,
      description: s ? snippet(s.text) : l.lead,
      html: html,
      mount: function (el, r) {
        L().setStep(l.id, n);
        bind(el, l);
        if (!s && !missing && !loadErr) fetchTexts(r);
      }
    };
  }

  /* ---------- Финал ---------- */
  function finale(l) {
    var cat = l.steps || [], N = cat.length, full = L().steps(l.id);
    var seen = {}, subjects = [];
    cat.forEach(function (s) { if (s.subject && !seen[s.subject] && st().subject(s.subject)) { seen[s.subject] = 1; subjects.push(st().subject(s.subject)); } });
    var pics = null;
    if (full) {
      var ids = {};
      full.forEach(function (s) { (s.paintings || []).forEach(function (p) { ids[p.id] = 1; }); });
      pics = Object.keys(ids).length;
    }
    // §5.4: следующая по order; если текущая последняя — первая не пройденная; если все остальные пройдены — не показываем (CR8-5).
    var list = L().list(), i = list.findIndex(function (x) { return x.id === l.id; }), nextL = null;
    var open = list.filter(function (x) { return x.id !== l.id && L().status(x.id).state !== 'done'; });
    if (open.length) nextL = i >= 0 && i < list.length - 1 ? list[i + 1] : open[0];

    var html = '<article class="lecture ldone">' +
      '<div class="ldone__head">' +
        '<span class="ldone__mark" aria-hidden="true">✓</span>' +
        '<h1 class="ldone__title">Лекция пройдена</h1>' +
        '<p class="ldone__name"><a href="' + esc(L().href(l.id)) + '">' + esc(l.title) + '</a></p>' +
        '<p class="ldone__sum">Вы посмотрели ' + esc(steps(N)) + (pics != null ? ' и ' + esc(U.count(pics, ['картину', 'картины', 'картин'])) : '') + '.</p>' +
        '<div class="actions ldone__actions">' +
          (nextL ? '<a class="btn btn--primary" href="' + esc(L().href(nextL.id)) + '">Следующая лекция: ' + esc(nextL.title) + '</a>' : '') +
          '<a class="btn' + (nextL ? '' : ' btn--primary') + '" href="#/lectures">Все лекции</a>' +
          '<a class="btn btn--ghost" href="' + esc(L().href(l.id, 1)) + '" data-reset>Пройти заново</a>' +
        '</div>' +
      '</div>' +
      (subjects.length ? '<section class="section ldone__subjects" aria-labelledby="h-lsubj"><h2 id="h-lsubj">Сюжеты лекции</h2>' +
        '<ul class="lsubj">' + subjects.map(function (s) {
          var c = st().painting(s.cover);
          return '<li><a class="lsubj__link" href="' + esc(App.router.href('subject', s.id)) + '">' +
            (c ? App.ui.img(c, 'thumb', { cls: 'lsubj__img', sizes: '64px' }) : '<span class="img-wrap lsubj__img"></span>') +
            '<span class="lsubj__body"><span class="lsubj__t">' + esc(s.title) + '</span><span class="lsubj__r">' + esc(App.ui.refsLabel(s)) + '</span></span></a></li>';
        }).join('') + '</ul></section>' : '') +
      '</article>';

    return {
      title: 'Лекция пройдена — ' + l.title, description: l.lead, html: html,
      mount: function (el, r) {
        L().setDone(l.id);
        bind(el, l);
        if (!full && !L().isLoaded() && !loadErr) fetchTexts(r); // загружено, но лекции нет — финал без числа картин (CR8-1)
      }
    };
  }

  /* ---------- Общее ---------- */
  function bind(el, l) {
    el.addEventListener('click', function (e) {
      var v = e.target.closest('[data-open-viewer]');
      if (v) { if (v.querySelector('.is-failed')) return; App.viewer.open(v.getAttribute('data-open-viewer'), v); return; }
      // Сброс — только при обычном клике: Cmd/Ctrl/Shift-клик открывает шаг 1 в новой вкладке, прогресс здесь сохраняется (CR8-6).
      if (e.target.closest('[data-reset]')) { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) L().reset(l.id); return; }
      if (e.target.closest('[data-reload]')) { location.reload(); return; }
      if (e.target.closest('[data-retry]')) { loadErr = false; App.router.render(); }
    });
  }

  /** Загрузка текстов и перерисовка тем же маршрутом, если пользователь не ушёл. */
  function fetchTexts(r) {
    L().load(function (err) {
      if (App.router.parse(location.hash || App.router.prerendered()).hash !== r.hash) return;
      loadErr = !!err;
      var a = document.activeElement;
      // Фокус на новый h1 — только если он был на h1 (переход по ссылке). На первой загрузке он на body:
      // не трогаем, иначе пропадает начало страницы и «К содержанию» (CR8-3).
      keepFocus = !(a && a.tagName === 'H1');
      App.router.render();
    });
  }

  function render(r) {
    var id = r.args[0], l = id ? L().meta(id) : null;
    if (!l) return App.views.notFound.render(r);
    var out, arg = r.args[1], N = (l.steps || []).length;
    if (arg == null) out = cover(l);
    else if (arg === 'done') out = finale(l);
    else if (/^\d+$/.test(arg) && +arg >= 1 && +arg <= N) out = step(l, +arg);
    else {
      out = cover(l);
      var m = out.mount;
      // Замена адреса после того, как роутер запишет текущий маршрут, иначе он затрёт исправленный (CR8-2).
      out.mount = function (el, rr) {
        m(el, rr);
        setTimeout(function () { if (App.router.parse(location.hash || App.router.prerendered()).hash === rr.hash) App.router.replace(L().href(l.id)); }, 0);
      };
    }
    if (keepFocus) { out.focus = false; keepFocus = false; }
    return out;
  }

  App.views.lecture = { render: render };
})(window);
