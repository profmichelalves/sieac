import { initRouter, navigate } from './router.js';
import { initSidebar } from './components/Sidebar.js';
import { isAuthenticated } from './services/authService.js';

document.addEventListener('DOMContentLoaded', () => {
  const theme = localStorage.getItem('sieac_theme') || 'light';
  document.documentElement.setAttribute('data-bs-theme', theme);
  const themeIcon = document.querySelector('#theme-toggle i');
  if (themeIcon) {
    themeIcon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
  }

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-bs-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', next);
    localStorage.setItem('sieac_theme', next);
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = next === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
  });

  if (isAuthenticated()) {
    initSidebar();
  }

  initRouter();
});
