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
  ]);

  try {
    const theme = localStorage.getItem('website-theme');
    if (theme && allowedThemes.has(theme)) {
      document.body.setAttribute('data-theme', theme);
    }
  } catch {
    // Ignore storage access failures and render with the default theme.
  }
})();
