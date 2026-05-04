const THEME_STORAGE_KEY = 'website-theme';
const THEME_IDS = [
  'default-light', 'default-dark', 'gold-light', 'gold-dark',
  'strawberry-light', 'strawberry-dark', 'water-light', 'water-dark'
];

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_IDS.includes(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function applyTheme(themeId) {
  const body = document.body;
  if (themeId && THEME_IDS.includes(themeId)) {
    body.setAttribute('data-theme', themeId);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch {}
  } else {
    body.removeAttribute('data-theme');
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {}
  }
}

export function initTheme() {
  const themeId = getStoredTheme();
  if (themeId) {
    document.body.setAttribute('data-theme', themeId);
  }
}

export function setupThemePicker() {
  const grid = document.getElementById('theme-picker');
  if (!grid) return;

  const current = getStoredTheme();
  grid.querySelectorAll('.theme-swatch').forEach((btn) => {
    const themeId = btn.getAttribute('data-theme');
    if (themeId === current) {
      btn.setAttribute('aria-pressed', 'true');
    }
    btn.addEventListener('click', () => {
      applyTheme(themeId);
      grid.querySelectorAll('.theme-swatch').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
    });
  });
}
