/* App.ui — общие компоненты: изображение, карточки, атрибуция, поле поиска с подсказками, уведомление (spec §7). */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util, esc = U.esc;
  var S = function () { return App.store; };
  var R = function () { return App.router; };

  var ICON = {
    search: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    filter: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  /** Предпочтительный оригинал из списка: la/it, иначе первый. */
  function pickOrig(list) {
    list = list || [];
    for (var i = 0; i < list.length; i++) if (list[i].lang === 'la' || list[i].lang === 'it') return list[i];
    return list[0] || null;
  }

  /** <img> картины. size: 'thumb' (330/960) | 'large' (960/1920). */
  function img(p, size, opt) {
    opt = opt || {};
    var im = p.image || {}, t = im.thumbs || {};
    var large = size === 'large';
    var src = large ? (t['960'] || t['1920'] || t['330']) : (t['330'] || t['960']);
    var set = large ? [['960', 960], ['1920', 1920]] : [['330', 330], ['960', 960]];
    var srcset = set.filter(function (x) { return t[x[0]]; }).map(function (x) { return t[x[0]] + ' ' + x[1] + 'w'; }).join(', ');
    // opt.fit: рамка с пропорцией картины из данных (--ar), ширина ограничена высотой экрана — без CLS и без полей.
    var style = opt.fit ? ' style="--ar:' + esc((im.width || 4) + ' / ' + (im.height || 3)) + ';--arn:' + esc(((im.width || 4) / (im.height || 3)).toFixed(4)) + '"' : '';
    return '<span class="img-wrap' + (opt.fit ? ' img-wrap--fit' : '') + (opt.cls ? ' ' + esc(opt.cls) : '') + '"' + style + ' data-commons="' + esc(im.commons_page || '') + '">' +
      '<img src="' + esc(src || '') + '"' + (srcset ? ' srcset="' + esc(srcset) + '"' : '') +
      ' sizes="' + esc(opt.sizes || (large ? '(min-width: 900px) 60vw, 100vw' : '(min-width: 1280px) 290px, (min-width: 900px) 25vw, (min-width: 600px) 45vw, 92vw')) + '"' +
      ' width="' + esc(im.width || 4) + '" height="' + esc(im.height || 3) + '"' +
      ' alt="' + esc(im.alt || p.title) + '"' +
      (opt.priority ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async"></span>';
  }

  /** sizes для рамки img-wrap--fit (CR2-11): ширина ограничена и колонкой, и высотой экрана × пропорция картины,
      иначе для вертикальных картин браузер грузит файл крупнее нужного. wideW/wideH — от 900px, narrowH — мобильный. */
  function fitSizes(p, wideW, wideH, narrowH) {
    var im = (p && p.image) || {}, r = ((im.width || 4) / (im.height || 3)).toFixed(4);
    return '(min-width: 900px) min(' + wideW + ', max(160px, calc(' + wideH + ' * ' + r + '))), min(100vw, calc(' + narrowH + ' * ' + r + '))';
  }

  /** Подпись лицензии по-русски: «Общественное достояние (Public domain)». */
  var LICENSES = { pd: 'Общественное достояние', cc0: 'Общественное достояние (CC0)' };
  function licenseLabel(im) {
    im = im || {};
    var ru = LICENSES[String(im.license_code || '').toLowerCase()];
    if (ru && im.license && !/^public domain$/i.test(im.license)) return ru + ' (' + im.license + ')';
    return ru || im.license || 'Лицензия не указана';
  }

  /** «Поделиться»: App.ui.share (F3), иначе Web Share API → копирование ссылки → toast. */
  function shareAction(title) {
    if (App.ui.share) return App.ui.share({ title: title, url: location.href });
    var url = shareLink(location.href);
    if (!url) { toast(LOCAL_SHARE_MSG); return; }
    if (navigator.share) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast('Ссылка скопирована'); }, function () { toast(url); });
      return;
    }
    toast(url);
  }

  function refsLabel(s) { return (s.refs || []).map(function (r) { return r.label; }).join(', '); }

  function subjectCard(s) {
    var cover = S().painting(s.cover), o = pickOrig(s.titles_orig), n = (s.paintings || []).length;
    return '<li class="card card--subject"><a class="card__link" href="' + esc(R().href('subject', s.id)) + '">' +
      (cover ? img(cover, 'thumb', { cls: 'card__img' }) : '<span class="img-wrap card__img"></span>') +
      '<span class="card__body"><span class="card__title">' + esc(s.title) + '</span>' +
      (o ? U.orig(o, 'card__orig orig') : '') +
      '<span class="card__meta">' + esc(refsLabel(s)) + ' · ' + esc(U.count(n, ['картина', 'картины', 'картин'])) + '</span>' +
      '</span></a></li>';
  }

  /** Короткая атрибуция: художник, год; музей, город. */
  function attribution(p) {
    var a = S().artist(p.artist) || {}, m = S().museum(p.museum) || {};
    return '<span class="attr"><span class="attr__artist">' + esc(a.name) + '</span>, <span class="attr__year">' + esc(p.date_label) + '</span></span>' +
      '<span class="attr attr--place">' + esc(m.name) + (m.city ? ', ' + esc(m.city) : '') + '</span>';
  }

  function paintingCard(p) {
    return '<li class="card card--painting"><a class="card__link" href="' + esc(R().href('painting', p.id)) + '">' +
      img(p, 'thumb', { cls: 'card__img card__img--natural' }) +
      '<span class="card__body"><span class="card__title">' + esc(p.title) + '</span>' + attribution(p) + '</span></a></li>';
  }

  function artistItem(a) {
    var n = S().paintingsBy('artist', a.id).length;
    return '<li class="artist"><a class="artist__link" href="' + esc(R().searchHref({ artist: a.id })) + '">' +
      '<span class="artist__name">' + esc(a.name) + '</span>' + U.orig(a.name_orig, 'artist__orig orig') +
      '<span class="artist__meta">' + esc(U.lifeYears(a)) + ' · ' + esc(U.count(n, ['картина', 'картины', 'картин'])) + '</span></a></li>';
  }

  /** Ссылка и подписи для найденной сущности (подсказки, «Возможно, вы искали»). */
  function hitInfo(h) {
    var st = S(), o;
    if (h.type === 'subject') { o = st.subject(h.id); return { href: R().href('subject', h.id), label: o.title, sub: refsLabel(o) }; }
    if (h.type === 'painting') { o = st.painting(h.id); var a = st.artist(o.artist) || {}; return { href: R().href('painting', h.id), label: o.title, sub: a.name + ', ' + o.date_label }; }
    if (h.type === 'artist') { o = st.artist(h.id); return { href: R().searchHref({ artist: h.id }), label: o.name, sub: U.lifeYears(o) }; }
    if (h.type === 'character') { o = st.character(h.id); return { href: R().searchHref({ q: o.name }), label: o.name, sub: 'персонаж' }; }
    if (h.type === 'museum') { o = st.museum(h.id); return { href: R().searchHref({ museum: h.id }), label: o.name, sub: o.city }; }
    if (h.type === 'city') { o = st.city(h.id); return { href: R().searchHref({ city: h.id }), label: o.name, sub: o.country }; }
    return { href: '#/', label: '', sub: '' };
  }

  var GROUPS = [['subject', 'Сюжеты'], ['painting', 'Картины'], ['artist', 'Художники'], ['character', 'Персонажи'], ['museum', 'Музеи и города'], ['city', 'Музеи и города']];

  var uid = 0;
  /** Поле поиска (ARIA combobox, spec §5, §9.2). opt: {value, big, label, autofocus} */
  function searchBox(opt) {
    opt = opt || {};
    var id = 'sb' + (++uid);
    return '<form class="search' + (opt.big ? ' search--big' : '') + '" role="search" data-search action="#/search" autocomplete="off">' +
      '<label class="visually-hidden" for="' + id + '">' + esc(opt.label || 'Поиск по сюжетам, картинам и художникам') + '</label>' +
      '<span class="search__icon">' + ICON.search + '</span>' +
      '<input class="search__input" id="' + id + '" type="search" name="q" value="' + esc(opt.value || '') + '"' +
      ' placeholder="' + esc(opt.placeholder || 'Сюжет, картина, художник') + '"' +
      ' role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="' + id + '-list" enterkeyhint="search" spellcheck="false">' +
      '<button class="search__submit" type="submit">Найти</button>' +
      '<div class="search__list" id="' + id + '-list" role="listbox" aria-label="Подсказки" hidden></div>' +
      '<p class="visually-hidden" aria-live="polite" data-sb-status></p>' +
      '</form>';
  }

  function bindSearch(form) {
    if (!form || form.__bound) return;
    form.__bound = true;
    var input = form.querySelector('input'), list = form.querySelector('[role=listbox]'), status = form.querySelector('[data-sb-status]');
    var timer = 0, items = [], active = -1;

    function close() {
      list.hidden = true; list.innerHTML = ''; items = []; active = -1;
      input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
    }
    function setActive(i) {
      var opts = list.querySelectorAll('[role=option]');
      if (!opts.length) return;
      active = (i + opts.length) % opts.length;
      for (var k = 0; k < opts.length; k++) opts[k].setAttribute('aria-selected', k === active ? 'true' : 'false');
      input.setAttribute('aria-activedescendant', opts[active].id);
      opts[active].scrollIntoView({ block: 'nearest' });
    }
    function show() {
      var q = input.value, res = App.search.suggest(q);
      items = res.items;
      if (!items.length) {
        close();
        if (U.norm(q).length >= 2) status.textContent = 'Подсказок нет. Нажмите «Найти».';
        return;
      }
      var html = '', n = 0, base = list.id;
      GROUPS.forEach(function (g, gi) {
        var group = items.filter(function (h) { return h.type === g[0]; });
        if (!group.length) return;
        var prevSame = gi > 0 && GROUPS[gi - 1][1] === g[1] && items.some(function (h) { return h.type === GROUPS[gi - 1][0]; });
        if (!prevSame) html += (html ? '</div>' : '') + '<div role="group" aria-labelledby="' + base + '-g' + gi + '"><div class="search__group" id="' + base + '-g' + gi + '" role="presentation">' + esc(g[1]) + '</div>';
        group.forEach(function (h) {
          var info = hitInfo(h), idx = items.indexOf(h);
          var showMatch = h.text && U.norm(h.text) !== U.norm(info.label);
          html += '<div class="search__opt" role="option" id="' + base + '-o' + idx + '" data-i="' + idx + '" aria-selected="false">' +
            '<span class="search__label">' + U.highlight(info.label, res.words) + '</span>' +
            '<span class="search__sub">' + (showMatch ? U.highlight(h.text, res.words) + (info.sub ? ' · ' : '') : '') + esc(info.sub || '') + '</span></div>';
          n++;
        });
      });
      list.innerHTML = html + '</div>';
      list.hidden = false; active = -1;
      input.setAttribute('aria-expanded', 'true'); input.removeAttribute('aria-activedescendant');
      status.textContent = U.count(n, ['подсказка', 'подсказки', 'подсказок']) + '. Стрелки — выбор, Enter — перейти.';
    }
    /** i — позиция в DOM (группы идут не в порядке items), берём индекс из data-i (CR-1). */
    function choose(i) {
      var o = list.querySelectorAll('[role=option]')[i];
      var h = o && items[+o.getAttribute('data-i')]; if (!h) return;
      var href = hitInfo(h).href;
      close(); input.blur();
      R().go(href);
    }

    input.addEventListener('input', function () {
      clearTimeout(timer);
      if (U.norm(input.value).length < 2) { close(); return; }
      timer = setTimeout(show, 100);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) show(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (!list.hidden) setActive(active - 1); }
      else if (e.key === 'Escape') { if (!list.hidden) { e.preventDefault(); close(); } }
      else if (e.key === 'Enter' && active >= 0 && !list.hidden) { e.preventDefault(); choose(active); }
    });
    list.addEventListener('mousedown', function (e) { e.preventDefault(); });
    list.addEventListener('click', function (e) {
      var o = e.target.closest('[role=option]');
      if (o) choose(Array.prototype.indexOf.call(list.querySelectorAll('[role=option]'), o));
    });
    input.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== input) close(); }, 150); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearTimeout(timer);
      var q = input.value.trim();
      close();
      var params = { q: q };
      if (form.hasAttribute('data-keep-filters')) {
        var cur = R().parse(location.hash).params;
        App.store.FACETS.forEach(function (k) { if (cur[k]) params[k] = cur[k]; });
      }
      R().go(R().searchHref(params));
    });
  }

  function bindAll(rootEl) {
    var forms = (rootEl || document).querySelectorAll('[data-search]');
    for (var i = 0; i < forms.length; i++) bindSearch(forms[i]);
  }

  /** Уведомление (aria-live), spec §9.2. */
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(t.__t);
    t.__t = setTimeout(function () { t.classList.remove('is-on'); }, 2600);
  }

  /** Ошибка загрузки изображения → заглушка со ссылкой на Commons (spec §6). */
  function onImgError(e) {
    var im = e.target;
    if (!im || im.tagName !== 'IMG') return;
    var w = im.closest('.img-wrap');
    if (!w || w.classList.contains('is-failed')) return;
    w.classList.add('is-failed');
    var link = w.getAttribute('data-commons');
    var note = document.createElement('span');
    note.className = 'img-wrap__fail';
    note.textContent = 'Изображение недоступно';
    w.appendChild(note);
    if (link && /^https:\/\/commons\.wikimedia\.org\//.test(link) && !w.closest('a, button')) { // CR-12
      var a = document.createElement('a');
      a.href = link; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Открыть в Commons';
      note.appendChild(document.createElement('br')); note.appendChild(a);
    }
  }

  /* «Поделиться» (spec §9.5): Web Share → буфер обмена → execCommand('copy') → поле для ручного копирования. */
  /* CR2-12: на file:// локальный путь (с именем пользователя системы) не отдаём — либо ссылка от meta.public_base_url, либо null. */
  var LOCAL_SHARE_MSG = 'Ссылка заработает после публикации сайта';
  function shareLink(url) {
    var base = ((S() && S().data && S().data.meta) || {}).public_base_url;
    if (location.protocol === 'file:') {
      if (!base) return null;
      return String(base).replace(/#.*$/, '') + location.hash;
    }
    return url || location.href;
  }
  function copyByCommand(text) {
    var ta = document.createElement('textarea'), ok = false, prev = document.activeElement;
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (prev && prev.focus) prev.focus({ preventScroll: true });
    return ok;
  }
  /** Последний шаг: панель с выделенной ссылкой. */
  function showLinkBox(url) {
    var box = document.getElementById('share-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'share-box'; box.className = 'share-box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-labelledby', 'share-box-t');
      box.innerHTML = '<p class="share-box__title" id="share-box-t">Скопируйте ссылку</p>' +
        '<div class="share-box__row"><input class="share-box__input" type="text" readonly aria-labelledby="share-box-t">' +
        '<button class="btn" type="button" data-share-close>Готово</button></div>';
      document.body.appendChild(box);
      box.addEventListener('click', function (e) { if (e.target.closest('[data-share-close]')) box.hidden = true; });
      box.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.hidden = true; });
    }
    var input = box.querySelector('input');
    input.value = url; box.hidden = false;
    input.focus(); input.select();
  }
  function copyLink(url) {
    function fallback() { if (copyByCommand(url)) toast('Ссылка скопирована'); else showLinkBox(url); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { navigator.clipboard.writeText(url).then(function () { toast('Ссылка скопирована'); }, fallback); }
      catch (e) { fallback(); }
      return;
    }
    fallback();
  }
  function share(o) {
    o = o || {};
    var url = shareLink(o.url), title = o.title || document.title;
    if (!url) { toast(LOCAL_SHARE_MSG); return; }
    var data = { title: title, url: url };
    if (o.text) data.text = o.text;
    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      try {
        navigator.share(data).catch(function (e) {
          if (e && e.name === 'AbortError') return; // пользователь закрыл окно — это не ошибка
          copyLink(url);
        });
        return;
      } catch (e) { /* ниже — копирование */ }
    }
    copyLink(url);
  }

  /* «Недавно просмотренные» на главной (spec §2 R7, §4): лента в слоте [data-slot="recent"]. */
  function recentCard(it) {
    var st = S(), R0 = R();
    if (it.type === 'subject') {
      var s = st.subject(it.id), cover = st.painting(s.cover);
      return '<li class="recent__item"><a class="recent__link" href="' + esc(R0.href('subject', s.id)) + '">' +
        (cover ? img(cover, 'thumb', { cls: 'recent__img', sizes: '160px' }) : '<span class="img-wrap recent__img"></span>') +
        '<span class="recent__kind">Сюжет</span><span class="recent__title">' + esc(s.title) + '</span>' +
        '<span class="recent__sub">' + esc(refsLabel(s)) + '</span></a></li>';
    }
    var p = st.painting(it.id), a = st.artist(p.artist) || {};
    return '<li class="recent__item"><a class="recent__link" href="' + esc(R0.href('painting', p.id)) + '">' +
      img(p, 'thumb', { cls: 'recent__img', sizes: '160px' }) +
      '<span class="recent__kind">Картина</span><span class="recent__title">' + esc(p.title) + '</span>' +
      '<span class="recent__sub">' + esc(a.name) + ', ' + esc(p.date_label) + '</span></a></li>';
  }
  function renderRecent(slot) {
    if (!slot) return;
    var list = S().recent();
    if (!list.length) { slot.innerHTML = ''; slot.hidden = true; return; }
    slot.hidden = false;
    slot.innerHTML = '<section class="recent" aria-labelledby="h-recent"><div class="recent__head">' +
      '<h2 class="recent__h" id="h-recent">Недавно просмотренные</h2>' +
      '<button class="link-btn" type="button" data-recent-clear>Очистить</button></div>' +
      '<ul class="recent__list">' + list.map(recentCard).join('') + '</ul></section>';
    slot.querySelector('[data-recent-clear]').addEventListener('click', function () {
      S().recentClear();
      slot.innerHTML = ''; slot.hidden = true;
      toast('Список очищен');
      var input = document.querySelector('main .search__input');
      if (input) input.focus({ preventScroll: true });
    });
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('app:route', function (e) {
      if (e.detail && e.detail.name === 'home') renderRecent(document.querySelector('[data-slot="recent"]'));
    });
  }

  App.ui = {
    share: share, shareLink: shareLink, fitSizes: fitSizes, renderRecent: renderRecent,
    ICON: ICON, pickOrig: pickOrig, img: img, refsLabel: refsLabel, subjectCard: subjectCard, paintingCard: paintingCard,
    artistItem: artistItem, attribution: attribution, hitInfo: hitInfo, searchBox: searchBox, bindSearch: bindSearch,
    bindAll: bindAll, toast: toast, onImgError: onImgError, licenseLabel: licenseLabel, shareAction: shareAction
  };
})(window);
