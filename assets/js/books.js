(function () {
  'use strict';

  const DATA_URL = 'data/books.json';
  const BOOKS_MOBILE_MQ = '(max-width: 640px)';
  const CSS_PX_PER_IN = 96;
  const BOOKS_ROW_GAP_PX = 6;
  const ROW_WIDTH_FUDGE_PX = 6;
  const BOOKS_ROW_FALLBACK_PAD_PX = 24;

  var lastBooksData = null;
  var booksResizeTimer = null;

  var bookSpineTooltipEl = null;
  var bookSpineTooltipHideTimer = null;
  var bookSpineTooltipActiveSpine = null;
  var bookSpineTooltipPosRaf = null;
  var bookSpineScrollBound = false;
  var bookSpineOutsideClickBound = false;
  var bookSpineTooltipDescribed = null;

  function getBookSpineTooltip() {
    if (bookSpineTooltipEl) return bookSpineTooltipEl;
    bookSpineTooltipEl = document.createElement('div');
    bookSpineTooltipEl.id = 'book-spine-tooltip';
    bookSpineTooltipEl.className = 'book-spine-tooltip';
    bookSpineTooltipEl.setAttribute('role', 'tooltip');
    bookSpineTooltipEl.addEventListener('mouseenter', function () {
      if (bookSpineTooltipHideTimer) {
        clearTimeout(bookSpineTooltipHideTimer);
        bookSpineTooltipHideTimer = null;
      }
    });
    bookSpineTooltipEl.addEventListener('mouseleave', function () {
      if (isBooksNarrow()) return;
      hideBookSpineTooltip();
    });
    document.body.appendChild(bookSpineTooltipEl);
    return bookSpineTooltipEl;
  }

  function positionBookSpineTooltip(spine) {
    var el = getBookSpineTooltip();
    var text = spine.getAttribute('data-label');
    if (!text) return;
    el.textContent = text;
    el.classList.add('is-open');
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.transform = 'none';
    var tr = el.getBoundingClientRect();
    var r = spine.getBoundingClientRect();
    var pad = 10;
    var nav = document.querySelector('.top-nav');
    var navBottom = nav ? nav.getBoundingClientRect().bottom : 0;

    var spaceAbove = r.top - navBottom;
    var spaceBelow = window.innerHeight - r.bottom;
    var preferAbove = spaceAbove >= tr.height + pad || spaceAbove >= spaceBelow;

    var top;
    if (preferAbove) {
      top = r.top - tr.height - pad;
      if (top < navBottom) top = navBottom + 4;
    } else {
      top = r.bottom + pad;
      if (top + tr.height > window.innerHeight - 8) {
        top = Math.max(navBottom + 4, window.innerHeight - tr.height - 8);
      }
    }

    var cx = r.left + r.width / 2;
    el.style.left = cx + 'px';
    el.style.top = top + 'px';
    el.style.transform = 'translateX(-50%)';

    tr = el.getBoundingClientRect();
    var margin = 8;
    var shift = 0;
    if (tr.left < margin) shift = margin - tr.left;
    if (tr.right > window.innerWidth - margin) shift = (window.innerWidth - margin) - tr.right;
    if (shift !== 0) {
      el.style.transform = 'translateX(calc(-50% + ' + shift + 'px))';
    } else {
      el.style.transform = 'translateX(-50%)';
    }
  }

  function schedulePositionBookSpineTooltip() {
    if (!bookSpineTooltipActiveSpine) return;
    if (bookSpineTooltipPosRaf) return;
    bookSpineTooltipPosRaf = requestAnimationFrame(function () {
      bookSpineTooltipPosRaf = null;
      if (bookSpineTooltipActiveSpine) {
        positionBookSpineTooltip(bookSpineTooltipActiveSpine);
      }
    });
  }

  function bindBookSpineTooltipScroll() {
    if (bookSpineScrollBound) return;
    var root = document.querySelector('.page-scroll');
    if (!root) return;
    bookSpineScrollBound = true;
    root.addEventListener('scroll', schedulePositionBookSpineTooltip, { passive: true });
    window.addEventListener('resize', schedulePositionBookSpineTooltip);
  }

  function showBookSpineTooltip(spine) {
    bindBookSpineTooltipScroll();
    if (isBooksNarrow()) bindBookSpineTooltipOutsideDismiss();
    if (bookSpineTooltipHideTimer) {
      clearTimeout(bookSpineTooltipHideTimer);
      bookSpineTooltipHideTimer = null;
    }
    if (bookSpineTooltipDescribed && bookSpineTooltipDescribed !== spine) {
      bookSpineTooltipDescribed.removeAttribute('aria-describedby');
    }
    bookSpineTooltipDescribed = spine;
    spine.setAttribute('aria-describedby', 'book-spine-tooltip');
    bookSpineTooltipActiveSpine = spine;
    positionBookSpineTooltip(spine);
  }

  function hideBookSpineTooltip() {
    bookSpineTooltipActiveSpine = null;
    if (bookSpineTooltipDescribed) {
      bookSpineTooltipDescribed.removeAttribute('aria-describedby');
      bookSpineTooltipDescribed = null;
    }
    if (bookSpineTooltipEl) {
      bookSpineTooltipEl.classList.remove('is-open');
    }
  }

  function onBookSpinePointerLeave() {
    if (isBooksNarrow()) return;
    bookSpineTooltipHideTimer = setTimeout(function () {
      bookSpineTooltipHideTimer = null;
      hideBookSpineTooltip();
    }, 100);
  }

  function isBooksNarrow() {
    return typeof window !== 'undefined' && window.matchMedia(BOOKS_MOBILE_MQ).matches;
  }

  function onBookSpineDocumentClickCapture(e) {
    if (!isBooksNarrow()) return;
    if (!bookSpineTooltipEl || !bookSpineTooltipEl.classList.contains('is-open')) return;
    if (e.target.closest && e.target.closest('.book-spine')) return;
    if (e.target.closest && e.target.closest('#book-spine-tooltip')) return;
    hideBookSpineTooltip();
  }

  function bindBookSpineTooltipOutsideDismiss() {
    if (bookSpineOutsideClickBound) return;
    bookSpineOutsideClickBound = true;
    document.addEventListener('click', onBookSpineDocumentClickCapture, true);
  }

  function estimateSpineWidthPx(book) {
    if (book && typeof book.widthInches === 'number' && book.widthInches > 0) {
      return book.widthInches * CSS_PX_PER_IN;
    }
    if (book && book.thickness === 'thin') return 25;
    if (book && book.thickness === 'thick') return 48;
    return 32;
  }

  function getAvailableBooksRowWidthPx() {
    var body = document.querySelector('.bookcase-body');
    if (!body) {
      return Math.max(120, Math.min(900, window.innerWidth) - 48);
    }
    var inner = body.clientWidth;
    var pad = BOOKS_ROW_FALLBACK_PAD_PX;
    var row = document.querySelector('.bookshelf-books');
    if (row) {
      try {
        var cs = window.getComputedStyle(row);
        var pl = parseFloat(cs.paddingLeft) || 0;
        var pr = parseFloat(cs.paddingRight) || 0;
        if (pl + pr > 0) pad = pl + pr;
      } catch (e) {}
    }
    return Math.max(120, inner - pad - ROW_WIDTH_FUDGE_PX);
  }

  function packBooksIntoRows(books, maxWidthPx) {
    var rows = [];
    if (!books || books.length === 0) return rows;
    var row = [];
    var acc = 0;
    var gap = BOOKS_ROW_GAP_PX;
    for (var i = 0; i < books.length; i++) {
      var book = books[i];
      var w = estimateSpineWidthPx(book);
      if (row.length === 0) {
        row.push(book);
        acc = w;
        continue;
      }
      if (acc + gap + w > maxWidthPx) {
        rows.push(row);
        row = [book];
        acc = w;
      } else {
        row.push(book);
        acc += gap + w;
      }
    }
    if (row.length) rows.push(row);
    return rows;
  }

  function buildShelfSegments(shelves) {
    var out = [];
    if (!isBooksNarrow()) {
      shelves.forEach(function (s) {
        out.push({ shelf: s, isContinuationFromSplit: false });
      });
      return out;
    }
    var maxW = getAvailableBooksRowWidthPx();
    shelves.forEach(function (shelf) {
      if (!shelf.books || shelf.books.length === 0) {
        out.push({ shelf: shelf, isContinuationFromSplit: false });
        return;
      }
      var rows = packBooksIntoRows(shelf.books, maxW);
      for (var r = 0; r < rows.length; r++) {
        var segShelf = Object.assign({}, shelf, { books: rows[r] });
        out.push({ shelf: segShelf, isContinuationFromSplit: r > 0 });
      }
    });
    return out;
  }

  /** WCAG relative luminance 0–1; used to pick light vs dark spine text */
  function relativeLuminanceFromHex(hex) {
    if (!hex || typeof hex !== 'string') return null;
    var h = hex.replace(/^#/, '').trim();
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (h.length !== 6) return null;
    var n = parseInt(h, 16);
    if (isNaN(n)) return null;
    function lin(c) {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    var r = lin((n >> 16) & 255);
    var g = lin((n >> 8) & 255);
    var b = lin(n & 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function applySpineTextTone(spine, book) {
    if (!book.spineColor || book.spine) return;
    var L = relativeLuminanceFromHex(book.spineColor);
    if (L === null) return;
    if (L > 0.55) {
      spine.classList.add('book-spine--light-bg');
    } else {
      spine.classList.add('book-spine--dark-bg');
    }
  }

  function createBookSpine(book, isCurrentlyReading) {
    const spine = document.createElement('div');
    spine.className = 'book-spine';

    if (book.spineColor) {
      spine.style.backgroundColor = book.spineColor;
      spine.style.borderLeftColor = 'color-mix(in srgb, ' + book.spineColor + ' 50%, #fff)';
    }

    if (typeof book.widthInches === 'number' && book.widthInches > 0) {
      spine.style.width = book.widthInches + 'in';
    } else if (book.thickness === 'thin') {
      spine.classList.add('book-spine-thin');
    } else if (book.thickness === 'thick') {
      spine.classList.add('book-spine-thick');
    }

    if (book.title) {
      var label = book.title;
      if (book.author) label += ' \u2014 ' + book.author;
      spine.setAttribute('data-label', label);
    }

    if (isCurrentlyReading) {
      spine.classList.add('is-reading-now');
    }

    const titleEl = document.createElement('span');
    titleEl.className = 'book-spine-title';
    titleEl.textContent = book.title;
    spine.appendChild(titleEl);

    if (book.spine) {
      spine.style.backgroundImage = 'url(' + book.spine + ')';
      spine.style.backgroundSize = 'cover';
      spine.style.backgroundPosition = 'center';
    }

    applySpineTextTone(spine, book);

    if (spine.getAttribute('data-label')) {
      spine.setAttribute('tabindex', '0');
      if (isBooksNarrow()) {
        spine.addEventListener('click', function () {
          showBookSpineTooltip(spine);
        });
        spine.addEventListener('focus', function () { showBookSpineTooltip(spine); });
        spine.addEventListener('blur', function () {
          if (bookSpineTooltipActiveSpine === spine) hideBookSpineTooltip();
        });
      } else {
        spine.addEventListener('mouseenter', function () { showBookSpineTooltip(spine); });
        spine.addEventListener('mouseleave', onBookSpinePointerLeave);
        spine.addEventListener('focus', function () { showBookSpineTooltip(spine); });
        spine.addEventListener('blur', function () { hideBookSpineTooltip(); });
      }
    }

    return spine;
  }

  function createShelf(shelf, visualIndex, currentlyReadingBook, isContinuationFromSplit) {
    if (typeof isContinuationFromSplit === 'undefined') isContinuationFromSplit = false;
    const el = document.createElement('div');
    el.className = 'bookshelf';
    if (shelf.hidePlaque || isContinuationFromSplit) {
      el.classList.add('bookshelf--continuation');
    }
    el.setAttribute('data-shelf', shelf.id);
    // Earlier shelves sit above later ones so hanging plaques aren’t covered by the next row’s books.
    // Keep values low: large z-index here creates a page-level stacking context that can paint over the nav.
    el.style.zIndex = String(Math.max(0, 50 - visualIndex));

    const booksRow = document.createElement('div');
    booksRow.className = 'bookshelf-books';

    if (shelf.books.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'bookshelf-empty';
      empty.textContent = 'No books yet';
      booksRow.appendChild(empty);
    } else {
      shelf.books.forEach(function (book) {
        var isCurrent = currentlyReadingBook &&
          currentlyReadingBook.title === book.title &&
          currentlyReadingBook.author === book.author;
        booksRow.appendChild(createBookSpine(book, isCurrent));
      });
    }

    const surface = document.createElement('div');
    surface.className = 'bookshelf-surface';

    var showPlaque = !shelf.hidePlaque && !isContinuationFromSplit;
    if (showPlaque) {
      var plaque = document.createElement('div');
      plaque.className = 'bookshelf-plaque';
      if (visualIndex % 2 === 0) {
        plaque.classList.add('bookshelf-plaque-left');
      } else {
        plaque.classList.add('bookshelf-plaque-right');
      }

      var chain = document.createElement('span');
      chain.className = 'bookshelf-plaque-chain';

      var label = document.createElement('span');
      label.className = 'bookshelf-label';
      label.textContent = shelf.label;

      plaque.appendChild(chain);
      plaque.appendChild(label);
      surface.appendChild(plaque);
    }

    var bookendL = document.createElement('div');
    bookendL.className = 'bookshelf-bookend bookshelf-bookend-left';

    var bookendR = document.createElement('div');
    bookendR.className = 'bookshelf-bookend bookshelf-bookend-right';

    el.appendChild(booksRow);
    el.appendChild(surface);
    el.appendChild(bookendL);
    el.appendChild(bookendR);

    return el;
  }

  function resolveCurrentlyReadingBook(data) {
    var cr = data.currentlyReading;
    if (!cr) return null;

    if (cr.shelfId) {
      var shelvesToSearch = data.shelves.filter(function (s) {
        return s.id === cr.shelfId || s.id.indexOf(cr.shelfId + '-') === 0;
      });
      if (shelvesToSearch.length === 0) return null;

      if (cr.title) {
        for (var si = 0; si < shelvesToSearch.length; si++) {
          var sh = shelvesToSearch[si];
          if (!sh.books || sh.books.length === 0) continue;
          var found = sh.books.find(function (b) {
            return b.title === cr.title;
          });
          if (found) return found;
        }
        return null;
      }

      var firstWithBooks = shelvesToSearch.find(function (s) {
        return s.books && s.books.length > 0;
      });
      return firstWithBooks ? firstWithBooks.books[0] : null;
    }

    if (cr.title && cr.cover) {
      return cr;
    }

    return null;
  }

  function renderShelves(data, currentlyReadingBook) {
    var container = document.querySelector('.bookcase-body');
    if (!container) return;

    var segments = buildShelfSegments(data.shelves);
    var visualIndex = 0;
    segments.forEach(function (seg) {
      container.appendChild(
        createShelf(seg.shelf, visualIndex, currentlyReadingBook, seg.isContinuationFromSplit)
      );
      visualIndex += 1;
    });
  }

  function reflowBookShelves() {
    if (!lastBooksData) return;
    var container = document.querySelector('.bookcase-body');
    if (!container) return;
    container.replaceChildren();
    var book = resolveCurrentlyReadingBook(lastBooksData);
    renderShelves(lastBooksData, book);
  }

  function scheduleBooksReflow() {
    if (booksResizeTimer) clearTimeout(booksResizeTimer);
    booksResizeTimer = setTimeout(function () {
      booksResizeTimer = null;
      reflowBookShelves();
    }, 150);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', scheduleBooksReflow);
    var booksMq = window.matchMedia(BOOKS_MOBILE_MQ);
    if (typeof booksMq.addEventListener === 'function') {
      booksMq.addEventListener('change', scheduleBooksReflow);
    } else {
      booksMq.addListener(scheduleBooksReflow);
    }
  }

  fetch(DATA_URL)
    .then(function (res) { return res.json(); })
    .then(function (data) {
      lastBooksData = data;
      var book = resolveCurrentlyReadingBook(data);
      renderShelves(data, book);
    })
    .catch(function (err) {
      console.error('Failed to load books data:', err);
    });
})();
