import { getCurrentUser } from './services/authService.js';
import { isAuthenticated } from './utils/helpers.js';
import { showToast } from './utils/helpers.js';

const routes = {
  'login': { page: 'auth', auth: false },
  'registrar': { page: 'auth', auth: false },
  'dashboard-geral': { page: 'dashboardGeral', auth: true },
  'dashboard-desempenho': { page: 'dashboardDesempenho', auth: true },
  'dashboard-frequencia': { page: 'dashboardFrequencia', auth: true },
  'dashboard-comparativo': { page: 'dashboardComparativo', auth: true },
  'relatorios': { page: 'relatoriosPage', auth: true },
  'importar': { page: 'importPage', auth: true },
  'usuarios': { page: 'usuariosPage', auth: true, perfil: 'Administrador' },
};

let currentPage = null;

export async function navigate() {
  let hash = window.location.hash.replace('#', '') || 'login';
  const route = routes[hash];

  if (!route) {
    window.location.hash = 'dashboard-geral';
    return navigate();
  }

  if (route.auth && !isAuthenticated()) {
    window.location.hash = 'login';
    return navigate();
  }

  if (route.perfil) {
    const user = getCurrentUser();
    if (user?.perfil !== route.perfil) {
      showToast('Acesso restrito ao perfil Administrador', 'warning');
      window.location.hash = 'dashboard-geral';
      return navigate();
    }
  }

  if (hash === 'login' || hash === 'registrar') {
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';
  } else {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-shell').style.display = 'flex';
  }

  if (currentPage && currentPage.unload) {
    currentPage.unload();
  }

  const { setActiveRoute } = await import('./components/Sidebar.js');

  try {
    if (hash === 'login') {
      const { renderLogin } = await import('./pages/authPage.js');
      renderLogin();
      currentPage = { unload: () => {} };
    } else if (hash === 'registrar') {
      const { renderRegister } = await import('./pages/authPage.js');
      renderRegister();
      currentPage = { unload: () => {} };
    } else {
      const pageModule = await import(`./pages/${route.page}.js`);
      if (pageModule.render) {
        setActiveRoute(hash);
        await pageModule.render();
        currentPage = { unload: pageModule.unload || (() => {}) };
      }
    }
  } catch (err) {
    console.error('Erro ao carregar página:', err);
    const main = document.getElementById('main-content');
    if (main) {
      main.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-exclamation-triangle" style="color:var(--sieac-danger);"></i>
          <h4>Erro ao carregar página</h4>
          <p>${err.message}</p>
          <button class="auth-btn" style="width:auto;margin-top:16px;padding:8px 24px;" onclick="window.location.hash='dashboard-geral'">
            Voltar ao Início
          </button>
        </div>
      `;
    }
  }
}

export function initRouter() {
  window.addEventListener('hashchange', navigate);
  window.addEventListener('load', navigate);
}
