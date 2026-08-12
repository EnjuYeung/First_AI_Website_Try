try {
  const theme = window.localStorage.getItem('subm.theme') || 'system';
  const colorTheme = window.localStorage.getItem('subm.colorTheme') || 'default';
  const isDark = theme === 'dark'
    || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.dataset.colorTheme = ['blue', 'violet', 'rose'].includes(colorTheme)
    ? colorTheme
    : 'default';
} catch {
  // Restricted browsing contexts may disable localStorage.
}
