// PBB Belt page: sky with random asteroids/stars, pbb-belt centered
import { initTheme } from './theme.js';
import { setupNavMobile } from './nav.js';

initTheme();
setupNavMobile();

const SKY_ASSETS = [
  'assets/images/asteroids/seattle.svg',
  'assets/images/asteroids/books.svg',
  'assets/images/asteroids/games.svg',
  'assets/images/asteroids/documents.svg',
  'assets/images/asteroids/tiny-1.svg',
  'assets/images/asteroids/tiny-2.svg',
  'assets/images/asteroids/tiny-3.svg',
  'assets/images/asteroids/tiny-4.svg',
  'assets/images/asteroids/tiny-5.svg',
  'assets/images/asteroids/tiny-6.svg',
  'assets/images/asteroids/tiny-7.svg',
  'assets/images/asteroids/tiny-8.svg',
  'assets/images/asteroids/tiny-9.svg',
  'assets/images/asteroids/tiny-10.svg',
  'assets/images/asteroids/sml-1.svg',
  'assets/images/asteroids/sml-2.svg',
  'assets/images/asteroids/sml-3.svg',
  'assets/images/asteroids/sml-4.svg',
  'assets/images/asteroids/sml-5.svg',
  'assets/images/asteroids/sml-6.svg',
  'assets/images/asteroids/sml-7.svg',
  'assets/images/asteroids/sml-med-1.svg',
  'assets/images/asteroids/sml-med-2.svg',
  'assets/images/asteroids/sml-med-3.svg',
  'assets/images/asteroids/sml-med-4.svg',
  'assets/images/asteroids/sml-med-5.svg',
  'assets/images/asteroids/sml-med-6.svg',
  'assets/images/asteroids/sml-med-7.svg',
  'assets/images/asteroids/med-1.svg',
  'assets/images/asteroids/med-2.svg',
  'assets/images/asteroids/med-3.svg',
  'assets/images/asteroids/med-4.svg',
  'assets/images/asteroids/med-5.svg',
  'assets/images/asteroids/med-6.svg',
  'assets/images/asteroids/med-7.svg',
  'assets/images/asteroids/med-big-1.svg',
  'assets/images/asteroids/med-big-2.svg',
  'assets/images/asteroids/med-big-3.svg',
  'assets/images/asteroids/med-big-4.svg',
  'assets/images/asteroids/med-big-5.svg',
  'assets/images/asteroids/med-big-6.svg',
  'assets/images/asteroids/med-big-7.svg',
  'assets/images/asteroids/big-1.svg',
  'assets/images/asteroids/big-2.svg',
  'assets/images/asteroids/big-3.svg',
  'assets/images/stars/star-1.svg',
  'assets/images/stars/star-2.svg',
  'assets/images/stars/star-3.svg',
  'assets/images/stars/star-4.svg',
  'assets/images/stars/star-5.svg',
  'assets/images/stars/star-6.svg',
  'assets/images/stars/star-7.svg',
  'assets/images/stars/star-8.svg',
  'assets/images/stars/star-9.svg',
  'assets/images/stars/star-10.svg',
  'assets/images/stars/star-11.svg',
  'assets/images/stars/star-12.svg',
  'assets/images/stars/sml-star-1.svg',
  'assets/images/stars/sml-star-2.svg',
  'assets/images/stars/sml-star-3.svg',
  'assets/images/stars/sml-star-4.svg',
  'assets/images/stars/sml-star-5.svg',
  'assets/images/stars/sml-star-6.svg',
];

const INTERACTIVE_LINKS = {
  'assets/images/asteroids/seattle.svg': 'seattle-day1.html',
  'assets/images/asteroids/books.svg': 'books.html',
  'assets/images/asteroids/games.svg': 'celeste-strawberry-guide.html',
  'assets/images/asteroids/documents.svg': 'documents.html',
};

const COLLISION_MASKS = {
  'assets/images/asteroids/seattle.svg': 'assets/images/asteroids/seattle-col.svg',
  'assets/images/asteroids/books.svg': 'assets/images/asteroids/books-col.svg',
  'assets/images/asteroids/games.svg': 'assets/images/asteroids/games-col.svg',
};

const CENTER_EXCLUDE = 0.34;

const PBB_MOBILE_DECOR_MQ = '(max-width: 768px)';

/** Mobile sky items: 2× base, then +30% → 2.6×. */
const PBB_MOBILE_GRAPHIC_SCALE = 2 * 1.3;

const LINK_ASTEROID_SOURCES = Object.keys(INTERACTIVE_LINKS);

let pbbAsteroidRafId = null;

function isPbbMobileDecor() {
  return typeof window !== 'undefined' && window.matchMedia(PBB_MOBILE_DECOR_MQ).matches;
}

/** Randomly choose floor(n/2) items. */
function takeHalf(arr) {
  const n = Math.floor(arr.length / 2);
  if (n === 0) return [];
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function positionOutsideCenter() {
  let left, top;
  do {
    left = random(3, 97);
    top = random(3, 97);
  } while (
    left > 50 - CENTER_EXCLUDE * 50 && left < 50 + CENTER_EXCLUDE * 50 &&
    top > 50 - CENTER_EXCLUDE * 50 && top < 50 + CENTER_EXCLUDE * 50
  );
  return { left, top };
}

const LOGO_OVERLAY_MIN_DISTANCE_PX = 50;

function positionAsteroidAwayFromOverlay(container, overlayEl) {
  const cRect = container.getBoundingClientRect();
  const w = cRect.width || 400;
  const h = cRect.height || 300;

  for (let attempt = 0; attempt < 300; attempt++) {
    const { left, top } = positionOutsideCenter();
    if (!overlayEl) return { left, top };
    const oRect = overlayEl.getBoundingClientRect();
    if (oRect.width <= 0 || oRect.height <= 0) return { left, top };

    const ax = cRect.left + (left / 100) * w;
    const ay = cRect.top + (top / 100) * h;
    const clx = Math.max(oRect.left, Math.min(oRect.right, ax));
    const cly = Math.max(oRect.top, Math.min(oRect.bottom, ay));
    const dist = Math.sqrt((ax - clx) ** 2 + (ay - cly) ** 2);
    if (dist >= LOGO_OVERLAY_MIN_DISTANCE_PX) return { left, top };
  }
  return positionOutsideCenter();
}

const STAR_MIN_DISTANCE_PX = 100;

function tryPlaceStar(container, existingStars) {
  const rect = container.getBoundingClientRect();
  const w = rect.width || 400;
  const h = rect.height || 300;

  for (let attempt = 0; attempt < 500; attempt++) {
    const { left, top } = positionOutsideCenter();
    let ok = true;
    for (const s of existingStars) {
      const dx = ((left - s.left) / 100) * w;
      const dy = ((top - s.top) / 100) * h;
      if (Math.sqrt(dx * dx + dy * dy) < STAR_MIN_DISTANCE_PX) {
        ok = false;
        break;
      }
    }
    if (ok) return { left, top };
  }
  return null;
}

function renderSkyDecor() {
  if (pbbAsteroidRafId) {
    cancelAnimationFrame(pbbAsteroidRafId);
    pbbAsteroidRafId = null;
  }

  const container = document.getElementById('pbb-sky-decor');
  if (!container) return;

  container.replaceChildren();

  const isAsteroid = (src) => src.startsWith('assets/images/asteroids/');
  const isStar = (src) => src.startsWith('assets/images/stars/');
  const href = (src) => INTERACTIVE_LINKS[src];

  const mobile = isPbbMobileDecor();
  const allAsteroidSources = SKY_ASSETS.filter(isAsteroid);
  const decorAsteroidSources = allAsteroidSources.filter((src) => !INTERACTIVE_LINKS[src]);
  const asteroidSources = mobile
    ? [...LINK_ASTEROID_SOURCES, ...takeHalf(decorAsteroidSources)]
    : allAsteroidSources;
  const allStarSources = SKY_ASSETS.filter(isStar);
  const starSources = mobile ? takeHalf(allStarSources) : allStarSources;

  function getSizePercent(src) {
    const name = src.replace(/^.*\//, '').replace(/\.svg$/, '');
    if (isStar(src)) {
      if (name.startsWith('sml-star')) return random(2, 3);
      return random(3, 4.5);
    }
    if (isAsteroid(src)) {
      if (name.startsWith('tiny')) return random(1.5, 2.5);
      if (name.startsWith('sml-med')) return random(3.5, 4.5);
      if (name.startsWith('sml-')) return random(2.5, 3.5);
      if (name.startsWith('med-big')) return random(5.5, 6.5);
      if (name.startsWith('med-')) return random(4.5, 5.5);
      if (name.startsWith('big')) return random(6.5, 8);
      if (['seattle', 'books', 'games', 'documents'].some((k) => name.startsWith(k))) return random(4.5, 5.5);
    }
    return random(3, 5);
  }

  const asteroidEls = [];

  asteroidSources.forEach((src) => {
    const { left, top } = positionAsteroidAwayFromOverlay(container, null);
    const classes = ['pbb-sky-item'];
    if (isAsteroid(src)) classes.push('pbb-sky-asteroid');
    if (href(src)) classes.push('pbb-sky-interactive');

    const el = href(src)
      ? document.createElement('a')
      : document.createElement('div');
    if (el instanceof HTMLAnchorElement) {
      el.href = href(src);
      let aria = 'Celeste guide';
      if (src.includes('seattle')) aria = 'Seattle 2026 blog';
      else if (src.includes('books')) aria = 'Books';
      else if (src.includes('documents')) aria = 'Documents';
      el.setAttribute('aria-label', aria);
    }
    el.className = classes.join(' ');
    if (!href(src)) el.setAttribute('aria-hidden', 'true');
    const size = getSizePercent(src) * (mobile ? PBB_MOBILE_GRAPHIC_SCALE : 1);
    el.style.cssText = `
      left: ${left}%;
      top: ${top}%;
      width: ${size}%;
      aspect-ratio: 1;
      -webkit-mask-image: url("${src}");
      mask-image: url("${src}");
      z-index: ${Math.floor(random(1, 9))};
      opacity: ${random(0.55, 0.9)};
    `;
    let collisionEl = null;
    if (COLLISION_MASKS[src]) {
      const mask = document.createElement('div');
      mask.className = 'pbb-collision-mask';
      mask.style.cssText = `-webkit-mask-image: url("${COLLISION_MASKS[src]}"); mask-image: url("${COLLISION_MASKS[src]}");`;
      el.appendChild(mask);
      collisionEl = mask;
    }
    container.appendChild(el);
    if (isAsteroid(src)) asteroidEls.push({ el, size, collisionEl });
  });

  const placedStars = [];
  const starScale = mobile ? PBB_MOBILE_GRAPHIC_SCALE : 1;
  let unplaced = starSources.map((src) => ({ src, size: getSizePercent(src) * starScale }));

  while (unplaced.length > 0) {
    let placedThisRound = 0;
    for (let i = unplaced.length - 1; i >= 0; i--) {
      const { src, size } = unplaced[i];
      const pos = tryPlaceStar(container, placedStars);
      if (pos) {
        placedStars.push(pos);
        unplaced.splice(i, 1);
        placedThisRound++;

        const z = Math.floor(random(1, 9));
        const el = document.createElement('div');
        el.className = 'pbb-sky-item pbb-sky-star';
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText = `
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          aspect-ratio: 1;
          -webkit-mask-image: url("${src}");
          mask-image: url("${src}");
          z-index: ${z};
          opacity: ${random(0.55, 0.9)};
        `;
        const wrapper = document.createElement('div');
        wrapper.className = 'pbb-sky-star-wrapper';
        wrapper.style.cssText = `left: ${pos.left}%; top: ${pos.top}%; width: ${size}%; aspect-ratio: 1; transform: translate(-50%, -50%); position: absolute; z-index: ${z};`;
        const shine = document.createElement('div');
        shine.className = 'pbb-sky-star-shine';
        shine.style.cssText = `-webkit-mask-image: url("${src}"); mask-image: url("${src}"); animation-delay: ${random(0, 3)}s;`;
        wrapper.appendChild(el);
        wrapper.appendChild(shine);
        container.appendChild(wrapper);
      }
    }
    if (placedThisRound === 0) break;
  }

  startAsteroidPhysics(container, asteroidEls);
}

function startAsteroidPhysics(container, asteroidData) {
  if (!container || asteroidData.length === 0) return;

  const rect = () => container.getBoundingClientRect();
  let w = 0;
  let h = 0;

  const asteroids = asteroidData.map(({ el, size, collisionEl }) => {
    const rotSpeed = random(0.01, 0.1) * 360 * (Math.random() > 0.5 ? 1 : -1);
    const speed = random(0.008, 0.03);
    const angle = random(0, Math.PI * 2);
    return {
      el,
      size,
      collisionEl: collisionEl || null,
      x: parseFloat(el.style.left),
      y: parseFloat(el.style.top),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: random(0, 360),
      rotSpeed,
    };
  });

  function tick() {
    if (!document.contains(container)) {
      pbbAsteroidRafId = null;
      return;
    }
    const r = rect();
    w = r.width;
    h = r.height;
    if (w <= 0 || h <= 0) {
      pbbAsteroidRafId = requestAnimationFrame(tick);
      return;
    }

    for (let i = 0; i < asteroids.length; i++) {
      const a = asteroids[i];
      a.x += a.vx;
      a.y += a.vy;
      a.rotation += a.rotSpeed / 60;

      if (a.x < 2 || a.x > 98) a.vx *= -1;
      if (a.y < 2 || a.y > 98) a.vy *= -1;
      a.x = Math.max(2, Math.min(98, a.x));
      a.y = Math.max(2, Math.min(98, a.y));
    }

    const cRect = rect();
    function circleVsRect(cxPx, cyPx, radiusPx, rect) {
      const clx = Math.max(rect.left, Math.min(rect.right, cxPx));
      const cly = Math.max(rect.top, Math.min(rect.bottom, cyPx));
      let dx = cxPx - clx;
      let dy = cyPx - cly;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.001) {
        const bcx = (rect.left + rect.right) / 2;
        const bcy = (rect.top + rect.bottom) / 2;
        dx = cxPx - bcx;
        dy = cyPx - bcy;
        dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      }
      const d = dist || 0.001;
      if (dist >= radiusPx) return null;
      return { nx: dx / d, ny: dy / d, overlap: radiusPx - dist };
    }

    for (let i = 0; i < asteroids.length; i++) {
      for (let j = i + 1; j < asteroids.length; j++) {
        const a = asteroids[i];
        const b = asteroids[j];
        const axPx = cRect.left + (a.x / 100) * cRect.width;
        const ayPx = cRect.top + (a.y / 100) * cRect.height;
        const bxPx = cRect.left + (b.x / 100) * cRect.width;
        const byPx = cRect.top + (b.y / 100) * cRect.height;
        const aRadius = (a.size / 100) * Math.min(cRect.width, cRect.height) * 0.5;
        const bRadius = (b.size / 100) * Math.min(cRect.width, cRect.height) * 0.5;

        let hit = false;
        let nx, ny, overlap;

        if (a.collisionEl && b.collisionEl) {
          const ar = a.collisionEl.getBoundingClientRect();
          const br = b.collisionEl.getBoundingClientRect();
          const acx = (ar.left + ar.right) / 2;
          const acy = (ar.top + ar.bottom) / 2;
          const bcx = (br.left + br.right) / 2;
          const bcy = (br.top + br.bottom) / 2;
          const dx = bcx - acx;
          const dy = bcy - acy;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const ar2 = Math.min(ar.width, ar.height) * 0.5;
          const br2 = Math.min(br.width, br.height) * 0.5;
          const minDist = ar2 + br2;
          if (dist < minDist) {
            hit = true;
            nx = dx / dist;
            ny = dy / dist;
            overlap = minDist - dist;
          }
        } else if (a.collisionEl) {
          const info = circleVsRect(bxPx, byPx, bRadius, a.collisionEl.getBoundingClientRect());
          if (info) {
            hit = true;
            nx = info.nx;
            ny = info.ny;
            overlap = info.overlap;
          }
        } else if (b.collisionEl) {
          const info = circleVsRect(axPx, ayPx, aRadius, b.collisionEl.getBoundingClientRect());
          if (info) {
            hit = true;
            nx = info.nx;
            ny = info.ny;
            overlap = info.overlap;
          }
        } else {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = (a.size + b.size) * 0.6;
          if (dist < minDist && dist > 0) {
            hit = true;
            nx = dx / dist;
            ny = dy / dist;
            overlap = minDist - dist;
          }
        }

        if (hit && nx !== undefined) {
          const scaleX = 100 / cRect.width;
          const scaleY = 100 / cRect.height;
          if (a.collisionEl && !b.collisionEl) {
            b.x += (nx * overlap) * scaleX;
            b.y += (ny * overlap) * scaleY;
            const vn = (b.vx * (nx * cRect.width / 100)) + (b.vy * (ny * cRect.height / 100));
            if (vn < 0) {
              b.vx -= 2 * vn * nx * scaleX;
              b.vy -= 2 * vn * ny * scaleY;
            }
          } else if (!a.collisionEl && b.collisionEl) {
            a.x += (nx * overlap) * scaleX;
            a.y += (ny * overlap) * scaleY;
            const vn = (a.vx * (nx * cRect.width / 100)) + (a.vy * (ny * cRect.height / 100));
            if (vn < 0) {
              a.vx -= 2 * vn * nx * scaleX;
              a.vy -= 2 * vn * ny * scaleY;
            }
          } else {
            a.x -= nx * overlap * 0.5 * scaleX;
            a.y -= ny * overlap * 0.5 * scaleY;
            b.x += nx * overlap * 0.5 * scaleX;
            b.y += ny * overlap * 0.5 * scaleY;
            const dvx = a.vx - b.vx;
            const dvy = a.vy - b.vy;
            const dvn = dvx * nx + dvy * ny;
            if (dvn > 0) {
              a.vx -= dvn * nx;
              a.vy -= dvn * ny;
              b.vx += dvn * nx;
              b.vy += dvn * ny;
            }
          }
        }
      }
    }

    asteroids.forEach((a) => {
      a.el.style.left = `${a.x}%`;
      a.el.style.top = `${a.y}%`;
      a.el.style.transform = `translate(-50%, -50%) rotate(${a.rotation}deg)`;
    });

    pbbAsteroidRafId = requestAnimationFrame(tick);
  }

  pbbAsteroidRafId = requestAnimationFrame(tick);
}

function initProjects() {
  let wasMobilePbb = isPbbMobileDecor();
  const mq = window.matchMedia(PBB_MOBILE_DECOR_MQ);
  const onPbbMobileDecorChange = () => {
    const m = isPbbMobileDecor();
    if (m === wasMobilePbb) return;
    wasMobilePbb = m;
    renderSkyDecor();
  };
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', onPbbMobileDecorChange);
  } else {
    mq.addListener(onPbbMobileDecorChange);
  }

  renderSkyDecor();

  const currentPage = document.body.getAttribute('data-page');
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('is-active', link.getAttribute('data-page') === currentPage);
  });
}

initProjects();
