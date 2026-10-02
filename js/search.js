/* App.search — индекс, query(q, filters), suggest(q) (spec §5). Без DOM: грузится в Node (vm).
   Использование: App.search.build(window.DATA); App.search.query('юдифь', {artist: 'caravaggio'}). */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var U = App.util;
  var RANK = { subject: 0, artist: 1, painting: 2, character: 3, museum: 4, city: 5 };
  var FACETS = ['artist', 'epoch', 'museum', 'city'];
  var D = null, entries = [];
  // Словарь уникальных слов корпуса: слово оценивается один раз на слово запроса, оценки кэшируются между запросами (CR-4).
  var vocab = [], vocabIdx = Object.create(null), scoreCache = new Map(), runCache = new Map(), dymCache = new Map();
  var CACHE_MAX = 300;

  function wid(w) {
    var i = vocabIdx[w];
    if (i === undefined) { i = vocabIdx[w] = vocab.length; vocab.push(w); }
    return i;
  }
  function add(type, id, text, weight, field) {
    var w = U.words(text);
    if (w.length) entries.push({ type: type, id: id, text: String(text), words: w, wi: w.map(wid), weight: weight, field: field });
  }
  function remember(map, k, v) {
    if (map.size >= CACHE_MAX) map.delete(map.keys().next().value);
    map.set(k, v);
    return v;
  }
  function origs(list) { return (list || []).map(function (o) { return o && o.text; }).filter(Boolean); }

  function build(data) {
    D = data; entries = []; vocab = []; vocabIdx = Object.create(null);
    scoreCache.clear(); runCache.clear(); dymCache.clear(); dymCands = null; fallback = null;
    var subjectsOfChar = {};
    Object.keys(D.subjects).forEach(function (id) {
      var s = D.subjects[id];
      add('subject', id, s.title, 10, 'title');
      origs(s.titles_orig).forEach(function (t) { add('subject', id, t, 10, 'title_orig'); });
      (s.synonyms || []).forEach(function (t) { add('subject', id, t, 8, 'synonym'); });
      (s.characters || []).forEach(function (c) { (subjectsOfChar[c] = subjectsOfChar[c] || []).push(id); });
    });
    Object.keys(D.characters).forEach(function (id) {
      var c = D.characters[id];
      var names = [c.name].concat(origs(c.names_orig), c.aliases || []);
      names.forEach(function (t) {
        add('character', id, t, 6, 'character');
        (subjectsOfChar[id] || []).forEach(function (sid) { add('subject', sid, t, 6, 'character'); });
      });
    });
    Object.keys(D.paintings).forEach(function (id) {
      var p = D.paintings[id];
      add('painting', id, p.title, 5, 'title');
      if (p.title_orig) add('painting', id, p.title_orig.text, 5, 'title_orig');
    });
    Object.keys(D.artists).forEach(function (id) {
      var a = D.artists[id];
      [a.name, a.name_orig && a.name_orig.text].concat(a.aliases || []).forEach(function (t) { if (t) add('artist', id, t, 7, 'name'); });
    });
    var seenCity = {};
    Object.keys(D.museums).forEach(function (id) {
      var m = D.museums[id];
      add('museum', id, m.name, 4, 'name');
      if (m.name_orig) add('museum', id, m.name_orig.text, 4, 'name_orig');
      if (!seenCity[m.city_id]) {
        seenCity[m.city_id] = 1;
        add('city', m.city_id, m.city, 4, 'city');
        if (m.city_orig) add('city', m.city_id, m.city_orig.text, 4, 'city_orig');
      }
    });
    return entries.length;
  }

  // Дамерау—Левенштейн с отсечкой: первые bl символов b, результат > max → max + 1. Буферы переиспользуются.
  var bag = new Int32Array(1024), r0 = new Int32Array(64), r1 = new Int32Array(64), r2 = new Int32Array(64);
  function dlMax(a, b, bl, max) {
    var n = a.length, m = Math.min(bl, b.length), i, j;
    if (Math.abs(n - m) > max) return max + 1;
    // Нижняя граница по составу букв (O(n + m)): отсекает почти все слова до квадратичного расчёта.
    for (i = 0; i < n; i++) bag[a.charCodeAt(i) & 1023]++;
    for (j = 0; j < m; j++) bag[b.charCodeAt(j) & 1023]--;
    var pos = 0, neg = 0, k;
    for (i = 0; i < n; i++) { k = a.charCodeAt(i) & 1023; if (bag[k] > 0) pos += bag[k]; bag[k] = 0; }
    for (j = 0; j < m; j++) { k = b.charCodeAt(j) & 1023; if (bag[k] < 0) neg -= bag[k]; bag[k] = 0; }
    if (pos > max || neg > max) return max + 1;
    if (m + 1 > r0.length) { r0 = new Int32Array(m + 1); r1 = new Int32Array(m + 1); r2 = new Int32Array(m + 1); }
    var pp = r0, p = r1, c = r2, t, prevMin = 0;
    for (j = 0; j <= m; j++) { p[j] = j; pp[j] = 0; }
    for (i = 1; i <= n; i++) {
      c[0] = i;
      var ai = a.charCodeAt(i - 1), ap = i > 1 ? a.charCodeAt(i - 2) : -1, rowMin = i;
      for (j = 1; j <= m; j++) {
        var bj = b.charCodeAt(j - 1);
        var v = p[j - 1] + (ai === bj ? 0 : 1);
        if (p[j] + 1 < v) v = p[j] + 1;
        if (c[j - 1] + 1 < v) v = c[j - 1] + 1;
        if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && ap === bj && pp[j - 2] + 1 < v) v = pp[j - 2] + 1;
        c[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max && prevMin > max) return max + 1; // две строки подряд: перестановка смотрит на строку i − 2
      prevMin = rowMin;
      t = pp; pp = p; p = c; c = t;
    }
    return p[m] > max ? max + 1 : p[m];
  }

  var prefMemo = null; // расстояния до префиксов длины L: префиксы слов словаря сильно повторяются
  function wordScore(q, w) {
    if (w === q) return 1;
    var L = q.length;
    if (L >= 2 && w.indexOf(q) === 0) return 0.8;
    if (L >= 3 && w.indexOf(q) > 0) return 0.5;
    if (L >= 4) {
      var max = L >= 8 ? 2 : 1, d = max + 1;
      if (Math.abs(w.length - L) <= max) d = dlMax(q, w, w.length, max);
      if (d > max && w.length > L) {
        var pre = w.slice(0, L), pd = prefMemo && prefMemo[pre];
        if (pd === undefined) { pd = dlMax(q, pre, L, max); if (prefMemo) prefMemo[pre] = pd; }
        d = Math.min(d, pd);
      }
      if (d <= 1) return 0.4;
      if (d <= max) return 0.25;
    }
    return 0;
  }

  /** Оценки слова запроса против всего словаря (Float32Array по индексу слова), с кэшем между запросами. */
  function vocabScores(q) {
    var v = scoreCache.get(q);
    if (v) return v;
    v = new Float32Array(vocab.length);
    prefMemo = Object.create(null);
    for (var i = 0; i < vocab.length; i++) v[i] = wordScore(q, vocab[i]);
    prefMemo = null;
    return remember(scoreCache, q, v);
  }

  function scoreEntry(qs, e) {
    var sum = 0, hit = 0, wi = e.wi;
    for (var i = 0; i < qs.length; i++) {
      var best = 0, sc = qs[i];
      for (var j = 0; j < wi.length && best < 1; j++) if (sc[wi[j]] > best) best = sc[wi[j]];
      if (best > 0) { hit++; sum += best; }
    }
    var need = qs.length >= 3 ? qs.length - 1 : qs.length;
    return hit >= need ? sum * e.weight : 0;
  }

  function sortKey(h) {
    if (h.type === 'subject') return D.subjects[h.id].order + (D.subjects[h.id].testament === 'nt' ? 1000 : 0);
    if (h.type === 'painting') return D.paintings[h.id].year || 0;
    return 0;
  }
  function cmpHits(a, b) {
    return (b.score - a.score) || (RANK[a.type] - RANK[b.type]) || (sortKey(a) - sortKey(b));
  }

  function match(qw, into) {
    var qs = qw.map(vocabScores);
    entries.forEach(function (e) {
      var s = scoreEntry(qs, e);
      if (!s) return;
      var k = e.type + ':' + e.id, cur = into[k];
      if (!cur || s > cur.score) into[k] = { type: e.type, id: e.id, score: s, text: e.text, field: e.field };
    });
    return into;
  }

  /** Совпавшие сущности, отсортированные по оценке. {hits, words, layout} */
  function run(q) {
    var key = String(q == null ? '' : q), cached = runCache.get(key);
    if (cached) return cached;
    return remember(runCache, key, runRaw(q));
  }
  function runRaw(q) {
    var qw = U.words(q), map = {}, layout = false, lw = [];
    if (!qw.length) return { hits: [], words: [], layout: false };
    match(qw, map);
    if (Object.keys(map).length < 3) {
      lw = U.words(U.switchLayout(q));
      if (lw.join(' ') !== qw.join(' ')) {
        var before = Object.keys(map).length;
        match(lw, map);
        layout = Object.keys(map).length > before;
      }
    }
    var hits = Object.keys(map).map(function (k) { return map[k]; }).sort(cmpHits);
    return { hits: hits, words: layout ? qw.concat(lw) : qw, layout: layout };
  }

  function facetsOf(pid) {
    var p = D.paintings[pid], m = D.museums[p.museum] || {};
    return { artist: p.artist, epoch: p.epoch, museum: p.museum, city: m.city_id };
  }
  function passes(pid, filters, skip) {
    var f = facetsOf(pid);
    for (var i = 0; i < FACETS.length; i++) {
      var k = FACETS[i];
      if (k !== skip && filters[k] && f[k] !== filters[k]) return false;
    }
    return true;
  }

  /** Выдача: сюжеты, картины, художники, персонажи, места + счётчики фильтров (spec §2 R2, R6). */
  function query(q, filters) {
    filters = filters || {};
    var r = run(q), hasQ = r.words.length > 0;
    var noWords = !hasQ && String(q == null ? '' : q).trim() !== ''; // запрос из одной пунктуации (CR-7)
    var pscore = {};
    function put(pid, s) { if (D.paintings[pid] && (pscore[pid] || 0) < s) pscore[pid] = s; }
    if (noWords) {
      // пустая выдача
    } else if (!hasQ) {
      Object.keys(D.paintings).forEach(function (pid) { pscore[pid] = 0; });
    } else {
      r.hits.forEach(function (h) {
        if (h.type === 'painting') put(h.id, h.score);
        else if (h.type === 'subject') D.subjects[h.id].paintings.forEach(function (pid) { put(pid, h.score * 0.6); });
        else if (h.type === 'artist' || h.type === 'museum' || h.type === 'city') {
          Object.keys(D.paintings).forEach(function (pid) { if (facetsOf(pid)[h.type] === h.id) put(pid, h.score * 0.8); });
        }
      });
    }
    var base = Object.keys(pscore);
    var active = FACETS.some(function (k) { return filters[k]; });
    var paintings = base.filter(function (pid) { return passes(pid, filters); }).sort(function (a, b) {
      return (pscore[b] - pscore[a]) || ((D.paintings[a].year || 0) - (D.paintings[b].year || 0));
    });
    var inSet = {}; paintings.forEach(function (pid) { inSet[pid] = 1; });

    function ofType(t) { return r.hits.filter(function (h) { return h.type === t; }); }
    var subjects = ofType('subject');
    var artists = ofType('artist');
    if (active) {
      subjects = subjects.filter(function (h) { return D.subjects[h.id].paintings.some(function (pid) { return inSet[pid]; }); });
      artists = artists.filter(function (h) { return paintings.some(function (pid) { return D.paintings[pid].artist === h.id; }); });
    }

    var facets = {};
    FACETS.forEach(function (k) {
      var c = {};
      base.forEach(function (pid) { if (passes(pid, filters, k)) { var v = facetsOf(pid)[k]; c[v] = (c[v] || 0) + 1; } });
      facets[k] = c;
    });

    return {
      q: q || '', words: r.words, layout: r.layout, filters: filters, noWords: noWords,
      subjects: subjects, paintings: paintings, artists: artists,
      characters: ofType('character'), places: ofType('museum').concat(ofType('city')),
      facets: facets,
      empty: !subjects.length && !paintings.length && !artists.length,
      suggestions: hasQ && !subjects.length && !paintings.length && !artists.length ? didYouMean(q) : []
    };
  }

  /** Подсказки: до 8, не больше 4 на группу (spec §5). */
  function suggest(q, limit) {
    if (U.norm(q).length < 2) return { items: [], words: [] };
    var r = run(q), per = {}, items = [];
    limit = limit || 8;
    for (var i = 0; i < r.hits.length && items.length < limit; i++) {
      var h = r.hits[i];
      var g = h.type === 'city' ? 'museum' : h.type; // музеи и города — одна группа в списке (CR-10)
      per[g] = (per[g] || 0) + 1;
      if (per[g] <= 4) items.push(h);
    }
    return { items: items, words: r.words, layout: r.layout };
  }

  /** «Возможно, вы искали»: 3 ближайших сюжета/художника/персонажа по расстоянию правки.
      Порог d ≤ 0,4; одинаковые подписи схлопываются в пользу сюжета (CR-5); недостающее — сюжеты-фолбэки (QA-1). */
  var DYM_MAX = 0.4, dymCands = null;
  /** Уникальные строки-кандидаты (полная подпись и отдельные слова) → записи, где они встречаются. */
  function buildDymCands() {
    var map = Object.create(null), list = [];
    entries.forEach(function (e, ei) {
      if (e.type !== 'subject' && e.type !== 'artist' && e.type !== 'character') return;
      if (e.field === 'character' && e.type === 'subject') return;
      [e.words.join(' ')].concat(e.words).forEach(function (c) {
        var it = map[c];
        if (!it) { it = map[c] = { c: c, es: [] }; list.push(it); }
        if (it.es[it.es.length - 1] !== ei) it.es.push(ei);
      });
    });
    return list;
  }
  var fallback = null;
  function fallbackSubjects() {
    if (!fallback) fallback = Object.keys(D.subjects).map(function (id) {
      var sj = D.subjects[id];
      return { type: 'subject', id: id, d: 1, text: sj.title, fallback: true, n: (sj.paintings || []).length };
    }).sort(function (a, b) { return (b.n - a.n) || a.text.localeCompare(b.text, 'ru'); }).slice(0, 5);
    return fallback;
  }
  function didYouMean(q, n) {
    var qn = U.norm(q), qn2 = U.norm(U.switchLayout(q));
    if (!qn) return [];
    var key = qn + '|' + qn2 + '|' + (n || 3);
    if (dymCache.has(key)) return dymCache.get(key);
    if (!dymCands) dymCands = buildDymCands();
    var best = {}, memo = [Object.create(null), Object.create(null)];
    var xs = qn2 && qn2 !== qn ? [qn, qn2] : [qn];
    dymCands.forEach(function (it) {
      var c = it.c, d = 1;
      xs.forEach(function (x, xi) {
        var cc = c.length > x.length + 2 ? c.slice(0, x.length) : c, dd = memo[xi][cc];
        if (dd === undefined) {
          var len = Math.max(x.length, cc.length), max = Math.floor(DYM_MAX * len), r = dlMax(x, cc, cc.length, max);
          dd = memo[xi][cc] = r <= max ? r / len : 1;
        }
        if (dd < d) d = dd;
      });
      if (d > DYM_MAX) return;
      it.es.forEach(function (ei) {
        var e = entries[ei], k = e.type + ':' + e.id;
        if (!best[k] || d < best[k].d) best[k] = { type: e.type, id: e.id, d: d, text: e.text };
      });
    });
    var seen = {};
    var out = Object.keys(best).map(function (k) { return best[k]; })
      .sort(function (a, b) { return (a.d - b.d) || (RANK[a.type] - RANK[b.type]); })
      .filter(function (h) { var l = U.norm(h.text); if (seen[l]) return false; seen[l] = 1; return true; })
      .slice(0, n || 3);
    // Если близкого мало — добираем сюжетами с наибольшим числом картин, чтобы вариантов всегда было n (QA-1, spec R2).
    fallbackSubjects().some(function (h) {
      if (out.length >= (n || 3)) return true;
      if (!out.some(function (o) { return o.type === h.type && o.id === h.id; })) out.push(h);
      return false;
    });
    return remember(dymCache, key, out);
  }

  App.search = { build: build, query: query, suggest: suggest, didYouMean: didYouMean, run: run, FACETS: FACETS };
})(typeof window !== 'undefined' ? window : this);
