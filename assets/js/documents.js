(function () {
  'use strict';

  /** Optional fallback when served without documents.manifest.js */
  var DATA_URL = 'data/documents.json';

  function assetHref(basePath, file) {
    var base = typeof basePath === 'string' ? basePath : 'assets/documents/';
    if (base.slice(-1) !== '/') base += '/';
    return base + file.split('/').map(encodeURIComponent).join('/');
  }

  function render(data) {
    var root = document.getElementById('documents-root');
    if (!root || !data || !Array.isArray(data.groups)) return false;

    var base = data.basePath;
    var thumbBase = data.thumbBase || 'assets/images/documents/';
    root.textContent = '';

    data.groups.forEach(function (group) {
      if (group.heading) {
        var h = document.createElement('h2');
        h.className = 'documents-group-heading blog-subheading';
        h.textContent = group.heading;
        root.appendChild(h);
      }
      var list = document.createElement('ul');
      list.className = 'documents-list';
      var items = group.items || [];
      items.forEach(function (item) {
        if (!item || !item.file) return;
        var li = document.createElement('li');
        li.className = 'documents-item';

        var a = document.createElement('a');
        a.className = 'documents-card';
        a.href = assetHref(base, item.file);
        a.rel = 'noopener noreferrer';
        a.target = '_blank';

        var titleText = item.title || item.file;

        if (item.thumb) {
          var thumbWrap = document.createElement('span');
          thumbWrap.className = 'documents-card-thumb';
          thumbWrap.setAttribute('aria-hidden', 'true');
          var raw = assetHref(thumbBase, item.thumb);
          var absUrl = /^https?:\/\//i.test(raw) ? raw : new URL(raw, document.baseURI).href;
          thumbWrap.style.setProperty('--documents-thumb-mask', 'url("' + absUrl + '")');
          a.appendChild(thumbWrap);
        }

        var title = document.createElement('span');
        title.className = 'documents-card-title';
        title.textContent = titleText;
        a.appendChild(title);

        li.appendChild(a);
        list.appendChild(li);
      });
      root.appendChild(list);
    });

    root.hidden = false;
    if (errEl) errEl.hidden = true;
    return true;
  }

  var errEl = document.getElementById('documents-load-error');

  function failed() {
    console.error(
      'documents: could not render list — ensure data/documents.manifest.js is loaded before documents.js.'
    );
    if (errEl) errEl.hidden = false;
  }

  function run() {
    var embedded =
      typeof window !== 'undefined' && typeof window.__DOCUMENTS_MANIFEST__ !== 'undefined'
        ? window.__DOCUMENTS_MANIFEST__
        : null;

    if (embedded != null && render(embedded)) {
      try {
        delete window.__DOCUMENTS_MANIFEST__;
      } catch (e) {}
      return;
    }

    fetch(new URL(DATA_URL, document.baseURI), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(function (json) {
        if (!render(json)) failed();
      })
      .catch(function (err) {
        console.error('Failed to load documents list:', err);
        failed();
      });
  }

  run();
})();
