import { initTheme } from './theme.js';
import { setupNavMobile } from './nav.js';

initTheme();
setupNavMobile();

const currentPage = document.body.getAttribute('data-page');
document.querySelectorAll('.nav-link').forEach((link) => {
  link.classList.toggle('is-active', link.getAttribute('data-page') === currentPage);
});

function classifyPhotos() {
  const blocks = Array.from(document.querySelectorAll('.blog-prose-with-margin'));
  let sideIndex = 0;
  const isMobile = window.innerWidth <= 640;

  blocks.forEach((block) => {
    const figures = block.querySelectorAll('.blog-photo-margin');
    const imgs = Array.from(figures).map((f) => f.querySelector('img'));
    const allLoaded = imgs.every((i) => i && i.complete && i.naturalWidth > 0);
    if (!allLoaded) return;

    const isLandscape = (img) => img.naturalWidth > img.naturalHeight;
    const allLandscape = imgs.every(isLandscape);

    if (allLandscape || isMobile) {
      const textEls = block.querySelectorAll('.blog-prose-text');
      const wrapper = block.querySelectorAll('.blog-photos-margin');
      const photoEls = wrapper.length
        ? Array.from(wrapper).flatMap((w) => Array.from(w.children))
        : Array.from(figures);

      photoEls.forEach((fig) => {
        fig.classList.remove('blog-photo-margin');
        fig.classList.add('blog-photo-full');
      });

      const parent = block.parentNode;
      const ref = block;
      photoEls.forEach((fig) => parent.insertBefore(fig, ref));
      textEls.forEach((p) => {
        p.classList.remove('blog-prose-text');
        parent.insertBefore(p, ref);
      });
      wrapper.forEach((w) => w.remove());
      block.remove();
    } else {
      const side = sideIndex % 2 === 0 ? 'right' : 'left';
      block.classList.add(`blog-photo-float-${side}`);
      sideIndex++;
    }
  });

  document.querySelectorAll('.blog-photo-margin img').forEach((img) => {
    const fig = img.closest('.blog-photo-margin');
    if (fig && img.naturalHeight > img.naturalWidth) {
      fig.classList.add('blog-photo-portrait');
    }
  });

  preventOverlap();
}

function preventOverlap() {
  const prose = document.querySelector('.blog-prose');
  if (!prose) return;

  if (window.innerWidth < 1200) {
    document.querySelectorAll('.blog-prose-with-margin .blog-photo-margin, .blog-prose-with-margin .blog-photos-margin').forEach((fig) => {
      fig.style.top = '';
    });
    return;
  }

  const leftStack = [];
  const rightStack = [];

  const blocks = Array.from(prose.querySelectorAll('.blog-prose-with-margin'));

  blocks.forEach((block) => {
    const fig = block.querySelector('.blog-photo-margin') ||
                block.querySelector('.blog-photos-margin');
    if (!fig) return;

    const isLeft = block.classList.contains('blog-photo-float-left');
    const stack = isLeft ? leftStack : rightStack;

    const blockTop = block.offsetTop;

    let neededOffset = 0;
    for (const prev of stack) {
      const prevBottom = prev.top + prev.height + 24;
      if (blockTop + neededOffset < prevBottom) {
        neededOffset = prevBottom - blockTop;
      }
    }

    if (neededOffset > 0) {
      fig.style.top = `${neededOffset}px`;
    }

    const figHeight = fig.offsetHeight;
    stack.push({ top: blockTop + neededOffset, height: figHeight });
  });
}

function waitForImages() {
  const imgs = document.querySelectorAll('.blog-prose-with-margin img');
  let resolved = false;

  const check = () => {
    if (resolved) return;
    const allDone = Array.from(imgs).every((i) => i.complete && i.naturalWidth > 0);
    if (allDone) {
      resolved = true;
      classifyPhotos();
    }
  };

  imgs.forEach((img) => {
    if (!img.complete || img.naturalWidth === 0) {
      img.addEventListener('load', check, { once: true });
      img.addEventListener('error', check, { once: true });
    }
  });

  check();
}

waitForImages();

window.addEventListener('resize', () => {
  preventOverlap();
});
