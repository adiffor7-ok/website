// Celeste Strawberry Guide: chapter grid + chapter viewer (strawberry videos)
import { initTheme } from './theme.js';
import { setupNavMobile } from './nav.js';

initTheme();
setupNavMobile();

async function fetchCelesteChapters() {
  const response = await fetch('data/celeste-chapters.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('Failed to load chapters');
  const data = await response.json();
  return data.chapters || [];
}

const COLLECTIBLE_LABELS = {
  strawberry: 'Strawberry',
  strawberry_winged: 'Winged strawberry',
  tape: 'Cassette tape',
  crystal_heart: 'Crystal heart',
};

const COLLECTIBLE_IMAGES = {
  strawberry: 'assets/images/celeste chapters/reg-strawberry.gif',
  strawberry_winged: 'assets/images/celeste chapters/winged-strawberry.gif',
  tape: 'assets/images/celeste chapters/casette.gif',
  crystal_heart: 'assets/images/celeste chapters/heart.gif',
};

function setActiveCollectible(container, activeIndex) {
  if (!container) return;
  const items = container.querySelectorAll('.celeste-collectible');
  items.forEach((el, i) => {
    el.classList.toggle('celeste-collectible-active', i === activeIndex);
    el.setAttribute('aria-current', i === activeIndex ? 'true' : 'false');
  });
}

function buildCollectiblesLine(chapter, container, iframeEl) {
  const collectibles = chapter.collectibles;
  const videoIds = chapter.videoIds || [];
  const playlistId = chapter.playlistId || '';
  if (!container || !Array.isArray(collectibles) || collectibles.length === 0) return;
  container.innerHTML = '';
  container.removeAttribute('hidden');
  collectibles.forEach((type, index) => {
    const videoId = videoIds[index];
    const hasVideo = !!(videoId || playlistId);
    const label = COLLECTIBLE_LABELS[type] || type;
    const imgSrc = COLLECTIBLE_IMAGES[type];
    const item = document.createElement(hasVideo ? 'button' : 'span');
    if (item instanceof HTMLButtonElement) {
      item.type = 'button';
      item.addEventListener('click', () => {
        if (!iframeEl) return;
        const embedUrl = videoId
          ? `https://www.youtube.com/embed/${videoId}?loop=1&playlist=${videoId}&autoplay=1`
          : `https://www.youtube.com/embed/videoseries?list=${playlistId}&index=${index + 1}&autoplay=1`;
        iframeEl.src = embedUrl;
        setActiveCollectible(container, index);
      });
    }
    item.className = `celeste-collectible celeste-collectible-${type}`;
    item.setAttribute('title', label + (hasVideo ? ' – play video' : ''));
    item.setAttribute('aria-label', label);
    if (imgSrc) {
      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = label;
      img.className = 'celeste-collectible-img';
      item.appendChild(img);
    }
    container.appendChild(item);
  });
  setActiveCollectible(container, 0);
}

function openChapterViewer(chapter) {
  const viewer = document.getElementById('celeste-viewer');
  const headerEl = document.getElementById('celeste-viewer-header');
  const statsEl = document.getElementById('celeste-viewer-stats');
  const collectiblesEl = document.getElementById('celeste-viewer-collectibles');
  const contentEl = document.getElementById('celeste-viewer-content');
  const descEl = document.getElementById('celeste-viewer-desc');
  const comingSoonEl = document.getElementById('celeste-viewer-coming-soon');
  if (!viewer || !contentEl) return;

  headerEl.innerHTML = '';
  if (chapter.headerImage) {
    const img = document.createElement('img');
    img.src = chapter.headerImage;
    img.alt = chapter.title;
    img.className = 'celeste-viewer-header-img';
    headerEl.appendChild(img);
  } else {
    const h2 = document.createElement('h2');
    h2.className = 'celeste-viewer-title';
    h2.textContent = chapter.title;
    headerEl.appendChild(h2);
  }

  if (chapter.stats) {
    const { strawberries = 0, tape = 0, crystalHeart = 0 } = chapter.stats;
    statsEl.innerHTML = '';
    statsEl.hidden = false;
    if (strawberries) {
      const g1 = document.createElement('span');
      g1.className = 'celeste-stats-group';
      g1.innerHTML = `<span class="celeste-stats-num">${strawberries}</span><img src="${COLLECTIBLE_IMAGES.strawberry}" alt="strawberry" class="celeste-stats-img" />`;
      statsEl.appendChild(g1);
    }
    if (tape) {
      const g2 = document.createElement('span');
      g2.className = 'celeste-stats-group';
      g2.innerHTML = `<span class="celeste-stats-num">${tape}</span><img src="${COLLECTIBLE_IMAGES.tape}" alt="tape" class="celeste-stats-img" />`;
      statsEl.appendChild(g2);
    }
    if (crystalHeart) {
      const g3 = document.createElement('span');
      g3.className = 'celeste-stats-group';
      g3.innerHTML = `<span class="celeste-stats-num">${crystalHeart}</span><img src="${COLLECTIBLE_IMAGES.crystal_heart}" alt="crystal heart" class="celeste-stats-img" />`;
      statsEl.appendChild(g3);
    }
  } else {
    statsEl.hidden = true;
  }

  contentEl.innerHTML = '';
  contentEl.removeAttribute('hidden');
  let iframeEl = null;
  if (chapter.completed && chapter.playlistId) {
    iframeEl = document.createElement('iframe');
    iframeEl.src = `https://www.youtube.com/embed/videoseries?list=${chapter.playlistId}`;
    iframeEl.title = `${chapter.title} – strawberry videos`;
    iframeEl.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframeEl.allowFullscreen = true;
    contentEl.appendChild(iframeEl);
  }

  if (chapter.collectibles && chapter.collectibles.length > 0) {
    buildCollectiblesLine(chapter, collectiblesEl, iframeEl);
  } else {
    collectiblesEl.innerHTML = '';
    collectiblesEl.setAttribute('hidden', '');
  }

  if (comingSoonEl) comingSoonEl.hidden = true;
  if (descEl) descEl.hidden = true;

  if (!chapter.completed || !chapter.playlistId) {
    contentEl.setAttribute('hidden', '');
    if (comingSoonEl) {
      comingSoonEl.textContent = 'Coming soon';
      comingSoonEl.hidden = false;
    }
  }

  viewer.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  const closeBtn = viewer.querySelector('.celeste-viewer-close');
  if (closeBtn) closeBtn.focus();
}

function closeChapterViewer() {
  const viewer = document.getElementById('celeste-viewer');
  const headerEl = document.getElementById('celeste-viewer-header');
  const statsEl = document.getElementById('celeste-viewer-stats');
  const collectiblesEl = document.getElementById('celeste-viewer-collectibles');
  const contentEl = document.getElementById('celeste-viewer-content');
  const descEl = document.getElementById('celeste-viewer-desc');
  const comingSoonEl = document.getElementById('celeste-viewer-coming-soon');
  if (!viewer) return;
  viewer.classList.remove('is-open');
  document.body.style.overflow = '';
  if (headerEl) headerEl.innerHTML = '';
  if (statsEl) statsEl.hidden = true;
  if (collectiblesEl) {
    collectiblesEl.innerHTML = '';
    collectiblesEl.setAttribute('hidden', '');
  }
  if (contentEl) {
    contentEl.innerHTML = '';
    contentEl.setAttribute('hidden', '');
  }
  if (descEl) descEl.hidden = true;
  if (comingSoonEl) comingSoonEl.hidden = true;
}

function renderChapterTiles(chapters, container) {
  if (!container || !Array.isArray(chapters)) return;
  container.innerHTML = '';

  chapters.forEach((chapter) => {
    const li = document.createElement('li');
    li.className = 'celeste-chapter-tile' + (chapter.completed ? '' : ' coming-soon');

    const link = document.createElement('a');
    link.href = '#';
    link.setAttribute('aria-label', chapter.title + (chapter.completed ? ', open strawberry videos' : ', coming soon'));

    if (chapter.thumbnail) {
      const img = document.createElement('img');
      img.src = chapter.thumbnail;
      img.alt = chapter.title;
      img.loading = 'lazy';
      link.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'celeste-chapter-tile-placeholder';
      placeholder.textContent = 'Coming soon';
      link.appendChild(placeholder);
    }

    const overlay = document.createElement('div');
    overlay.className = 'celeste-chapter-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    const colonIndex = chapter.title.indexOf(': ');
    const line1 = colonIndex >= 0 ? chapter.title.slice(0, colonIndex + 1) : chapter.title;
    const line2 = colonIndex >= 0 ? chapter.title.slice(colonIndex + 2) : '';
    const overlayLine1 = document.createElement('span');
    overlayLine1.className = 'celeste-chapter-overlay-line1';
    overlayLine1.textContent = line1;
    overlay.appendChild(overlayLine1);
    if (line2) {
      const overlayLine2 = document.createElement('span');
      overlayLine2.className = 'celeste-chapter-overlay-line2';
      overlayLine2.textContent = line2;
      overlay.appendChild(overlayLine2);
    }
    link.appendChild(overlay);

    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (chapter.completed) {
        openChapterViewer(chapter);
      }
    });

    li.appendChild(link);
    container.appendChild(li);
  });
}

async function initCeleste() {
  const grid = document.getElementById('celeste-chapters-grid');
  const viewer = document.getElementById('celeste-viewer');
  const closeBtn = viewer?.querySelector('.celeste-viewer-close');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeChapterViewer);
  }
  if (viewer) {
    viewer.addEventListener('click', (e) => {
      if (e.target === viewer) closeChapterViewer();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && viewer.classList.contains('is-open')) closeChapterViewer();
    });
  }

  try {
    const chapters = await fetchCelesteChapters();
    renderChapterTiles(chapters, grid);
  } catch (err) {
    if (grid) grid.innerHTML = '<li style="grid-column:1/-1;color:#a33;">Unable to load chapters.</li>';
  }

  const currentPage = document.body.getAttribute('data-page');
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('is-active', link.getAttribute('data-page') === currentPage);
  });
}

initCeleste();
