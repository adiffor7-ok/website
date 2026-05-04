(function applyStoredTheme() {
  const allowedThemes = new Set([
    'default-light',
    'default-dark',
    'gold-light',
    'gold-dark',
    'strawberry-light',
    'strawberry-dark',
    'water-light',
    'water-dark',
    'coral-light',
    'coral-dark',
    'cactus-light',
    'cactus-dark',
    'royal-light',
    'royal-dark',
    'mystery-light',
    'mystery-dark',
  ]);

  const GOLDEN_ANGLE_DEG = 137.5077640500378;

  function normalizeMysteryIndex(n) {
    if (!Number.isFinite(n)) return 0;
    const i = Math.floor(Math.abs(n));
    return i % 1_000_000;
  }

  function mysteryHueDeg(index) {
    const h = (normalizeMysteryIndex(index) * GOLDEN_ANGLE_DEG) % 360;
    return h < 0 ? h + 360 : h;
  }

  /** Must match getMysteryAccents() in theme.js */
  function getMysteryAccents(index) {
    const h = mysteryHueDeg(index);
    const hRounded = Math.round(h * 100) / 100;
    const cBump = (normalizeMysteryIndex(index) % 6) * 0.01;
    const cLight = Math.min(0.28, 0.18 + cBump);
    const cDark = Math.min(0.26, 0.16 + cBump);
    const okLight = `oklch(0.44 ${cLight} ${hRounded})`;
    const okDark = `oklch(0.72 ${cDark} ${hRounded})`;
    if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('color', okLight)) {
      return { light: okLight, dark: okDark };
    }
    return {
      light: `hsl(${hRounded} 88% 38%)`,
      dark: `hsl(${hRounded} 90% 62%)`,
    };
  }

  try {
    const theme = localStorage.getItem('website-theme');
    if (theme && allowedThemes.has(theme)) {
      document.body.setAttribute('data-theme', theme);
      if (theme === 'mystery-light' || theme === 'mystery-dark') {
        let idx = 0;
        try {
          const s = localStorage.getItem('website-theme-mystery-index');
          if (s !== null) {
            const n = parseInt(s, 10);
            if (!Number.isNaN(n)) idx = normalizeMysteryIndex(n);
          }
        } catch {}
        const { light, dark } = getMysteryAccents(idx);
        const accent = theme === 'mystery-light' ? light : dark;
        document.body.style.setProperty('--accent', accent);
      }
    }
  } catch {
    // Ignore storage access failures and render with the default theme.
  }
})();
