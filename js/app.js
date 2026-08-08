import { initRouter } from './router.js';
import { initSidebar } from './components/Sidebar.js';
import { isAuthenticated } from './utils/helpers.js';
import { initInfoButtons } from './utils/explanation.js';

document.addEventListener('DOMContentLoaded', () => {
  const theme = localStorage.getItem('sieac_theme') || 'light';
  document.documentElement.setAttribute('data-bs-theme', theme);
  const themeIcon = document.querySelector('#theme-toggle i');
  if (themeIcon) {
    themeIcon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
  }

  if (localStorage.getItem('sieac_sidebar_collapsed') === '1') {
    document.body.classList.add('sidebar-collapsed');
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

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.error('Falha ao registrar service worker:', err);
      });
    });
  }

  initInfoButtons();
  initRouter();
});
