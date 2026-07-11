try {
  const theme = window.localStorage.getItem('subm.theme') || 'system';
  const isDark = theme === 'dark'
    || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
} catch {
  // Restricted browsing contexts may disable localStorage.
}
