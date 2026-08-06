import { getCurrentUser, isAdmin, isGestao } from './services/authService.js';
import { isAuthenticated } from './utils/helpers.js';
import { showToast } from './utils/helpers.js';

const routes = {
  'login': { page: 'auth', auth: false },
  'registrar': { page: 'auth', auth: false },
  'recuperar-senha': { page: 'auth', auth: false },
  'redefinir-senha': { page: 'auth', auth: false },
  'dashboard-geral': { page: 'dashboardGeral', auth: true },
  'dashboard-desempenho': { page: 'dashboardDesempenho', auth: true },
  'dashboard-frequencia': { page: 'dashboardFrequencia', auth: true },
  'dashboard-comparativo': { page: 'dashboardComparativo', auth: true },
  'dashboard-estudante': { page: 'dashboardEstudante', auth: true },
  'relatorios': { page: 'relatoriosPage', auth: true },
  'relatorio-sem-notas': { page: 'relatoriosSemNotas', auth: true },
  'relatorio-nee': { page: 'relatorioNee', auth: true },
  'cadastro-estudantes': { page: 'cadastroEstudantes', auth: true, can: isGestao },
  'turmas': { page: 'turmasPage', auth: true, can: isGestao },
  'importar': { page: 'importPage', auth: true, can: isGestao },
  'usuarios': { page: 'usuariosPage', auth: true, can: isAdmin },
  'logs': { page: 'logsPage', auth: true, can: isAdmin },
};

let currentPage = null;

export async function navigate() {
  let hash = window.location.hash.replace('#', '') || 'login';

  // Link de recuperação de senha do Supabase Auth (fluxo implicit) chega como
  // "#access_token=...&type=recovery" — trata como a página de nova senha.
  const rawHash = window.location.hash;
  if (rawHash.includes('type=recovery') && rawHash.includes('access_token=')) {
    hash = 'redefinir-senha';
  }

  const route = routes[hash];

  if (!route) {
    window.location.hash = 'dashboard-geral';
    return navigate();
  }

  if (route.auth && !isAuthenticated()) {
    window.location.hash = 'login';
    return navigate();
  }

  if (route.can) {
    const user = getCurrentUser();
    if (!route.can(user)) {
      showToast('Acesso restrito. Você não tem permissão para acessar esta página.', 'warning');
      window.location.hash = 'dashboard-geral';
      return navigate();
    }
  }

  if (['login', 'registrar', 'recuperar-senha', 'redefinir-senha'].includes(hash)) {
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
    } else if (hash === 'recuperar-senha') {
      const { renderRecuperarSenha } = await import('./pages/authPage.js');
      renderRecuperarSenha();
      currentPage = { unload: () => {} };
    } else if (hash === 'redefinir-senha') {
      const { renderRedefinirSenha } = await import('./pages/authPage.js');
      renderRedefinirSenha();
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
