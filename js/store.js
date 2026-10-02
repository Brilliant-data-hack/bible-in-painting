/* App.store — доступ к DATA и производные индексы для фильтров (spec §3, §7), «Недавно просмотренные» (§9.4). */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  var D = null, idx = null;

  function byId(coll, id) { var o = D && D[coll] && D[coll][id]; return o ? Object.assign({ id: id }, o) : null; }

  function init(data) {
    D = data;
    idx = { cities: {}, paintingsBy: { artist: {}, epoch: {}, museum: {}, city: {} } };
    Object.keys(D.museums).forEach(function (id) {
      var m = D.museums[id];
      if (!idx.cities[m.city_id]) idx.cities[m.city_id] = { id: m.city_id, name: m.city, orig: m.city_orig, country: m.country };
    });
    Object.keys(D.paintings).forEach(function (id) {
      var p = D.paintings[id], f = facetsOf(p);
      Object.keys(f).forEach(function (k) { (idx.paintingsBy[k][f[k]] = idx.paintingsBy[k][f[k]] || []).push(id); });
    });
  }

  /** Значения фильтров картины: художник, эпоха, музей, город. */
  function facetsOf(p) {
    var m = D.museums[p.museum] || {};
    return { artist: p.artist, epoch: p.epoch, museum: p.museum, city: m.city_id };
  }

  function sortPaintings(ids) {
    return ids.slice().sort(function (a, b) { return (D.paintings[a].year || 0) - (D.paintings[b].year || 0); });
  }

  /** Сюжеты Завета (ot|nt), сгруппированные по section в порядке повествования. */
  function catalog(testament) {
    var list = Object.keys(D.subjects).map(function (id) { return byId('subjects', id); })
      .filter(function (s) { return s.testament === testament; })
      .sort(function (a, b) { return a.order - b.order; });
    var groups = [];
    list.forEach(function (s) {
      var g = groups[groups.length - 1], name = s.section || '';
      if (!g || g.name !== name) groups.push(g = { name: name, subjects: [] });
      g.subjects.push(s);
    });
    return groups;
  }

  function facetLabel(kind, id) {
    var o;
    if (kind === 'artist') o = D.artists[id];
    else if (kind === 'epoch') o = D.epochs[id];
    else if (kind === 'museum') o = D.museums[id];
    else if (kind === 'city') o = idx.cities[id];
    return o ? o.name : '';
  }

  /** Все значения фильтра, упорядоченные для списка. */
  function facetValues(kind) {
    var src = kind === 'artist' ? D.artists : kind === 'epoch' ? D.epochs : kind === 'museum' ? D.museums : idx.cities;
    var ids = Object.keys(src).filter(function (id) { return (idx.paintingsBy[kind][id] || []).length; });
    return ids.sort(function (a, b) {
      if (kind === 'epoch') return src[a].order - src[b].order;
      return String(src[a].name).localeCompare(String(src[b].name), 'ru');
    });
  }

  /* «Недавно просмотренные» (spec §9.4): localStorage, ключ bvzh.recent.v1, до 10 записей, новые в начале.
     Любая ошибка доступа к хранилищу (приватный режим, запрет, квота) молча отключает функцию. */
  var RKEY = 'bvzh.recent.v1', RMAX = 10, recentOff = false;
  function storage() {
    if (recentOff) return null;
    try {
      var ls = root.localStorage;
      if (!ls) { recentOff = true; return null; }
      return ls;
    } catch (e) { recentOff = true; return null; }
  }
  function known(it) {
    return it && (it.type === 'subject' || it.type === 'painting') && typeof it.id === 'string' &&
      !!(D && D[it.type === 'subject' ? 'subjects' : 'paintings'][it.id]);
  }
  function readRecent() {
    var ls = storage(), raw;
    if (!ls) return [];
    try { raw = ls.getItem(RKEY); } catch (e) { recentOff = true; return []; }
    var list;
    try { list = JSON.parse(raw || '[]'); } catch (e) { list = []; } // испорченное значение — как пустой список
    return Array.isArray(list) ? list.filter(known).slice(0, RMAX) : [];
  }
  function writeRecent(list) {
    var ls = storage();
    if (!ls) return false;
    try { ls.setItem(RKEY, JSON.stringify(list)); return true; } catch (e) { recentOff = true; return false; }
  }
  function recentAdd(type, id) {
    var it = { type: type, id: id, ts: Date.now() };
    if (!known(it) || !storage()) return;
    var list = readRecent().filter(function (x) { return !(x.type === type && x.id === id); });
    list.unshift(it);
    writeRecent(list.slice(0, RMAX));
  }
  function recentClear() {
    var ls = storage();
    if (!ls) return;
    try { ls.removeItem(RKEY); } catch (e) { recentOff = true; }
  }

  // Запись в «Недавно» при открытии сюжета или картины (spec §4, поведение роутера).
  if (typeof document !== 'undefined') {
    document.addEventListener('app:route', function (e) {
      var r = e.detail || {};
      if ((r.name === 'subject' || r.name === 'painting') && r.args && r.args[0]) recentAdd(r.name, r.args[0]);
    });
  }

  App.store = {
    recent: readRecent, recentAdd: recentAdd, recentClear: recentClear,
    recentAvailable: function () { return !!storage(); },
    init: init,
    get data() { return D; },
    subject: function (id) { return byId('subjects', id); },
    painting: function (id) { return byId('paintings', id); },
    artist: function (id) { return byId('artists', id); },
    museum: function (id) { return byId('museums', id); },
    epoch: function (id) { return byId('epochs', id); },
    character: function (id) { return byId('characters', id); },
    city: function (id) { return idx.cities[id] || null; },
    facetsOf: facetsOf, facetLabel: facetLabel, facetValues: facetValues,
    paintingsBy: function (kind, id) { return (idx.paintingsBy[kind][id] || []).slice(); },
    sortPaintings: sortPaintings,
    allPaintings: function () { return Object.keys(D.paintings); },
    catalog: catalog,
    FACETS: ['artist', 'epoch', 'museum', 'city']
  };
})(typeof window !== 'undefined' ? window : this);
