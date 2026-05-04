/**
 * Updates Bandcamp embed iframes to use light or dark theme based on page theme.
 * Light: bgcol=ffffff, linkcol=original from embed
 * Dark: bgcol=333333, linkcol=ffffff
 */
const BANDCAMP_BGCOL_LIGHT = 'ffffff';
const BANDCAMP_BGCOL_DARK = '333333';
const BANDCAMP_LINKCOL_DARK = 'ffffff';

function isDarkTheme() {
  const theme = document.body.getAttribute('data-theme') || '';
  return theme.includes('-dark');
}

function updateBandcampEmbeds() {
  const iframes = document.querySelectorAll('.music-page .album-embed iframe[src*="bandcamp.com/EmbeddedPlayer"]');
  const dark = isDarkTheme();
  const bgcol = dark ? BANDCAMP_BGCOL_DARK : BANDCAMP_BGCOL_LIGHT;

  iframes.forEach((iframe) => {
    const originalSrc = iframe.dataset.originalSrc || iframe.getAttribute('src');
    if (!originalSrc) return;

    iframe.dataset.originalSrc = originalSrc;
    let src = originalSrc;

    const lcMatch = src.match(/linkcol=([a-f0-9]{6})/i);
    const linkcolLight = lcMatch ? lcMatch[1].toLowerCase() : '0687f5';

    const linkcol = dark ? BANDCAMP_LINKCOL_DARK : linkcolLight;

    src = src.replace(/bgcol=[a-f0-9]{6}/i, `bgcol=${bgcol}`);
    src = src.replace(/linkcol=[a-f0-9]{6}/i, `linkcol=${linkcol}`);

    if (iframe.src !== src) {
      iframe.src = src;
    }
  });
}

export function initMusicEmbeds() {
  if (!document.querySelector('.music-page')) return;

  updateBandcampEmbeds();

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((m) => m.type === 'attributes' && m.attributeName === 'data-theme')) {
      updateBandcampEmbeds();
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
}
