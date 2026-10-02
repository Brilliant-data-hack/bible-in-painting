/* App.util — строки, экранирование, форматирование. Без DOM: грузится в Node (vm). spec §5, §7 */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};

  var Y = '\u0001'; // временная метка для «й», которую NFKD иначе разбирает на «и» + кратку

  /** Нормализация для индекса и запроса (spec §5). */
  function norm(s) {
    if (s == null) return '';
    s = String(s).toLowerCase().replace(/ё/g, 'е').replace(/й/g, Y);
    if (s.normalize) s = s.normalize('NFKD');
    s = s.replace(/[̀-ͯ]/g, '').split(Y).join('й');
    s = s.replace(/[^0-9a-zа-яйß-öø-ɏͰ-Ͽ]+/g, ' '); // без ÷ (U+00F7), CR-13
    return s.replace(/\s+/g, ' ').trim();
  }

  function words(s) { var n = norm(s); return n ? n.split(' ') : []; }

  var LAT = "`qwertyuiop[]asdfghjkl;'zxcvbnm,.~{}:\"<>";
  var CYR = 'ёйцукенгшщзхъфывапролджэячсмитьбюЁХЪЖЭБЮ'; // хвост — символы с Shift (CR-13)
  /** Перевод раскладки qwerty↔йцукен; направление — по преобладающему алфавиту. */
  function switchLayout(s) {
    s = String(s || '');
    var lat = (s.match(/[a-z\[\];',.`~{}:"<>]/gi) || []).length;
    var cyr = (s.match(/[а-яё]/gi) || []).length;
    var from = lat >= cyr ? LAT : CYR, to = lat >= cyr ? CYR : LAT;
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], lo = ch.toLowerCase(), k = from.indexOf(lo);
      out += k < 0 ? ch : (lo === ch ? to[k] : to[k].toUpperCase());
    }
    return out;
  }

  /** Расстояние Дамерау—Левенштейна (оптимальное выравнивание строк). */
  function dl(a, b) {
    var n = a.length, m = b.length, i, j;
    if (!n) return m; if (!m) return n;
    var pp = new Array(m + 1), p = new Array(m + 1), c = new Array(m + 1), t;
    for (j = 0; j <= m; j++) { p[j] = j; pp[j] = 0; }
    for (i = 1; i <= n; i++) {
      c[0] = i;
      var ai = a.charCodeAt(i - 1), ap = i > 1 ? a.charCodeAt(i - 2) : -1;
      for (j = 1; j <= m; j++) {
        var bj = b.charCodeAt(j - 1);
        var v = p[j - 1] + (ai === bj ? 0 : 1);
        if (p[j] + 1 < v) v = p[j] + 1;
        if (c[j - 1] + 1 < v) v = c[j - 1] + 1;
        if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && ap === bj && pp[j - 2] + 1 < v) v = pp[j - 2] + 1;
        c[j] = v;
      }
      t = pp; pp = p; p = c; c = t;
    }
    return p[m];
  }

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return s == null ? '' : String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }

  /** Оригинальная строка {text, lang} → <span lang>. */
  function orig(o, cls) {
    if (!o || !o.text) return '';
    return '<span class="' + esc(cls || 'orig') + '" lang="' + esc(o.lang || '') + '">' + esc(o.text) + '</span>';
  }

  /** Простой текст данных: абзацы \n\n и курсив *…* (spec §3). */
  function text(s) {
    return String(s || '').split(/\n\s*\n/).map(function (p) {
      return '<p>' + esc(p.trim()).replace(/\*([^*]+)\*/g, '<em>$1</em>') + '</p>';
    }).join('');
  }

  /** Диапазоны в исходной строке, совпавшие с началом слов запроса (для подсветки подсказок). */
  function matchRanges(src, qwords) {
    src = String(src || '');
    var map = [], ns = '';
    for (var i = 0; i < src.length; i++) {
      var n = norm(src[i]);
      if (!n) { if (ns && ns[ns.length - 1] !== ' ') { ns += ' '; map.push(i); } continue; }
      for (var k = 0; k < n.length; k++) { ns += n[k]; map.push(i); }
    }
    var ranges = [];
    (qwords || []).forEach(function (w) {
      if (!w) return;
      var at = -1, from = 0;
      while ((from = ns.indexOf(w, from)) >= 0) { if (from === 0 || ns[from - 1] === ' ') { at = from; break; } from++; }
      if (at < 0) at = w.length >= 3 ? ns.indexOf(w) : -1;
      if (at >= 0) ranges.push([map[at], map[at + w.length - 1] + 1]);
    });
    return ranges.sort(function (a, b) { return a[0] - b[0]; });
  }

  /** esc + <mark> по диапазонам. */
  function highlight(src, qwords) {
    src = String(src || '');
    var r = matchRanges(src, qwords), out = '', pos = 0;
    r.forEach(function (x) {
      if (x[0] < pos) return;
      out += esc(src.slice(pos, x[0])) + '<mark>' + esc(src.slice(x[0], x[1])) + '</mark>';
      pos = x[1];
    });
    return out + esc(src.slice(pos));
  }

  /** Русское склонение: plural(5, ['картина','картины','картин']). */
  function plural(n, f) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return f[2];
    if (b > 1 && b < 5) return f[1];
    if (b === 1) return f[0];
    return f[2];
  }
  function count(n, f) { return n + ' ' + plural(n, f); }

  function lifeYears(a) { return a ? (a.born || '?') + '–' + (a.died || '?') : ''; }

  /** Строка параметров для hash: только непустые значения. */
  function qs(params) {
    var out = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v != null && v !== '') out.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return out.join('&');
  }
  function parseQs(s) {
    var o = {};
    String(s || '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('='), k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? '' : kv.slice(i + 1);
      try { o[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { o[k] = v; }
    });
    return o;
  }

  App.util = {
    norm: norm, words: words, switchLayout: switchLayout, dl: dl, esc: esc, orig: orig, text: text,
    matchRanges: matchRanges, highlight: highlight, plural: plural, count: count, lifeYears: lifeYears,
    qs: qs, parseQs: parseQs
  };
})(typeof window !== 'undefined' ? window : this);
