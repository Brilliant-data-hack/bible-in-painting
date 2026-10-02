/* App.views.about — «О проекте» (spec §4): цель, принципы тона, источники, лицензии, как сообщить об ошибке. */
(function (root) {
  'use strict';
  var App = root.App = root.App || {};
  App.views = App.views || {};
  var U = App.util, esc = U.esc;

  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function dateLabel(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
    return m ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] + ' г.' : '';
  }

  function render() {
    var st = App.store, D = st.data, meta = D.meta || {}, c = meta.counts || {};
    var nSubj = c.subjects || Object.keys(D.subjects).length, nPaint = c.paintings || Object.keys(D.paintings).length;
    var nArt = Object.keys(D.artists).length, nMus = Object.keys(D.museums).length;
    var stats = [
      [nSubj, ['сюжет', 'сюжета', 'сюжетов']], [nPaint, ['картина', 'картины', 'картин']],
      [nArt, ['художник', 'художника', 'художников']], [nMus, ['музей', 'музея', 'музеев']]
    ];
    var updated = dateLabel(meta.version);

    var html = '<article class="page page--narrow about">' +
      '<p class="eyebrow">О проекте</p>' +
      '<h1 class="page__title">Библия в живописи</h1>' +
      '<p class="about__lead">Библейские сюжеты Ветхого и Нового Завета и картины европейских художников на каждый из них. ' +
        'Можно найти сюжет по названию, персонажу или художнику, прочитать, что изображено на картине, и сравнить, как один сюжет писали в разные эпохи.</p>' +
      '<ul class="about__stats">' + stats.map(function (s) {
        return '<li><span class="about__num">' + esc(s[0]) + '</span><span class="about__lbl">' + esc(U.plural(s[0], s[1])) + '</span></li>';
      }).join('') + '</ul>' +

      '<section class="section section--tight" aria-labelledby="h-ab-tone"><h2 id="h-ab-tone">Как написаны тексты</h2>' +
        '<ul class="about__list">' +
          '<li>Тон нейтральный, искусствоведческий: сюжет, композиция, детали и символы, которые помогают «прочитать» картину.</li>' +
          '<li>Без проповеди и без оценок веры. Тексты объясняют, как художники понимали и изображали сюжет, а не как к нему следует относиться.</li>' +
          '<li>Пересказ близок к библейскому тексту; последний абзац — о том, как сюжет изображали художники. Полный текст главы стоит читать по указанной ссылке.</li>' +
        '</ul></section>' +

      '<section class="section section--tight" aria-labelledby="h-ab-bible"><h2 id="h-ab-bible">Библейский текст</h2>' +
        '<p>Цитаты приводятся в Синодальном переводе с указанием книги, главы и стихов, например «Лк&nbsp;1:28». ' +
        'Орфография приведена к современной, с буквой ё.</p>' +
        '<p>Сокращения книг — как в русских изданиях Библии: Быт — Бытие, Исх — Исход, Суд — Книга Судей, 1&nbsp;Цар — Первая книга Царств, ' +
        'Иф — Книга Иудифи (неканоническая), Дан — Книга пророка Даниила, Мф, Лк, Ин — Евангелия от Матфея, Луки, Иоанна.</p></section>' +

      '<section class="section section--tight" aria-labelledby="h-ab-img"><h2 id="h-ab-img">Изображения и лицензии</h2>' +
        '<p>Все репродукции взяты из <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener">Wikimedia Commons</a> и отмечены там как общественное достояние: ' +
        'срок авторских прав на сами картины истёк. По правилам Commons точные фотографии двумерных произведений не считаются новыми произведениями; ' +
        'в отдельных странах законодательство может толковать это иначе.</p>' +
        '<p>У каждой картины на её странице указаны лицензия файла и ссылка на страницу файла в Commons — там можно посмотреть изображение в полном размере и узнать автора фотографии.</p></section>' +

      '<section class="section section--tight" aria-labelledby="h-ab-facts"><h2 id="h-ab-facts">Откуда сведения о картинах</h2>' +
        '<p>Художник, датировка, музей и город сверены с сайтами музеев; дополнительно — с Wikimedia Commons и Wikidata. ' +
        'Приблизительная датировка отмечена в подписи, например «ок. 1504».</p>' +
        (updated ? '<p class="muted">Данные обновлены ' + esc(updated) + '</p>' : '') + '</section>' +

      '<p class="about__back"><a class="btn btn--primary" href="#/">К каталогу сюжетов</a></p>' +
      '</article>';

    return {
      title: 'О проекте',
      description: 'О проекте «Библия в живописи»: принципы текстов, Синодальный перевод, источники изображений (Wikimedia Commons, общественное достояние).',
      html: html
    };
  }

  App.views.about = { render: render };
})(window);
