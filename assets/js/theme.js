const THEME_STORAGE_KEY = 'website-theme';
const MYSTERY_INDEX_KEY = 'website-theme-mystery-index';

/** Golden-angle step (degrees): dense, even coverage of the hue wheel for any index */
const GOLDEN_ANGLE_DEG = 137.5077640500378;

const THEME_IDS = [
  'default-light', 'default-dark', 'gold-light', 'gold-dark',
  'strawberry-light', 'strawberry-dark', 'water-light', 'water-dark',
  'coral-light', 'coral-dark', 'cactus-light', 'cactus-dark',
  'royal-light', 'royal-dark', 'mystery-light', 'mystery-dark',
];

function normalizeMysteryIndex(n) {
  if (!Number.isFinite(n)) return 0;
  const i = Math.floor(Math.abs(n));
  return i % 1_000_000;
}

/** Hue 0–360 for a given mystery step */
function mysteryHueDeg(index) {
  const h = (normalizeMysteryIndex(index) * GOLDEN_ANGLE_DEG) % 360;
  return h < 0 ? h + 360 : h;
}

/**
 * Full-gamut accents: OKLCH on capable browsers (wide gamut / P3), else saturated HSL.
 * Light theme: lower L, stronger C — reads on #f4f4f4
 * Dark theme: higher L — reads on #070707
 */
export function getMysteryAccents(index) {
  const h = mysteryHueDeg(index);
  const hRounded = Math.round(h * 100) / 100;
  const cBump = (normalizeMysteryIndex(index) % 6) * 0.01;
  const cLight = Math.min(0.28, 0.18 + cBump);
  const cDark = Math.min(0.26, 0.16 + cBump);

  const okLight = `oklch(0.44 ${cLight} ${hRounded})`;
  const okDark = `oklch(0.72 ${cDark} ${hRounded})`;

  if (typeof CSS !== 'undefined' && CSS.supports?.('color', okLight)) {
    return { light: okLight, dark: okDark, hue: hRounded };
  }

  const hslLight = `hsl(${hRounded} 88% 38%)`;
  const hslDark = `hsl(${hRounded} 90% 62%)`;
  return { light: hslLight, dark: hslDark, hue: hRounded };
}

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_IDS.includes(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function getMysteryIndex() {
  try {
    const s = localStorage.getItem(MYSTERY_INDEX_KEY);
    if (s === null) return 0;
    const n = parseInt(s, 10);
    if (Number.isNaN(n)) return 0;
    return normalizeMysteryIndex(n);
  } catch {
    return 0;
  }
}

function setMysteryIndex(idx) {
  try {
    localStorage.setItem(MYSTERY_INDEX_KEY, String(normalizeMysteryIndex(idx)));
  } catch {}
}

/** Apply inline --accent for mystery themes; clear when switching away */
export function syncMysteryAccentToBody(themeId) {
  const body = document.body;
  if (themeId !== 'mystery-light' && themeId !== 'mystery-dark') {
    body.style.removeProperty('--accent');
    return;
  }
  const { light, dark } = getMysteryAccents(getMysteryIndex());
  const accent = themeId === 'mystery-light' ? light : dark;
  body.style.setProperty('--accent', accent);
}

export function syncMysterySwatchStyles(grid) {
  if (!grid) return;
  const idx = getMysteryIndex();
  const { light, dark, hue } = getMysteryAccents(idx);
  const lightBtn = grid.querySelector('.theme-swatch--mystery-light');
  const darkBtn = grid.querySelector('.theme-swatch--mystery-dark');
  if (lightBtn) {
    lightBtn.style.setProperty('--swatch-accent', light);
    lightBtn.title = `Mystery (light) — click again for next hue (~${hue}°)`;
  }
  if (darkBtn) {
    darkBtn.style.setProperty('--swatch-accent', dark);
    darkBtn.title = `Mystery (dark) — click again for next hue (~${hue}°)`;
  }
}

export function applyTheme(themeId) {
  const body = document.body;
  if (themeId && THEME_IDS.includes(themeId)) {
    body.setAttribute('data-theme', themeId);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch {}
    syncMysteryAccentToBody(themeId);
  } else {
    body.removeAttribute('data-theme');
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {}
    body.style.removeProperty('--accent');
  }
}

export function initTheme() {
  const themeId = getStoredTheme();
  if (themeId) {
    document.body.setAttribute('data-theme', themeId);
    syncMysteryAccentToBody(themeId);
  }
}

export function setupThemePicker() {
  const grid = document.getElementById('theme-picker');
  if (!grid) return;

  syncMysterySwatchStyles(grid);

  const current = getStoredTheme();
  grid.querySelectorAll('.theme-swatch').forEach((btn) => {
    const themeId = btn.getAttribute('data-theme');
    if (themeId === current) {
      btn.setAttribute('aria-pressed', 'true');
    }
    btn.addEventListener('click', () => {
      if (themeId === 'mystery-light' || themeId === 'mystery-dark') {
        const prev = getStoredTheme();
        if (prev === themeId) {
          setMysteryIndex(getMysteryIndex() + 1);
        }
        applyTheme(themeId);
        syncMysterySwatchStyles(grid);
      } else {
        applyTheme(themeId);
      }
      grid.querySelectorAll('.theme-swatch').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
    });
  });
}
