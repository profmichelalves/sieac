import { getCurrentUser, isAdmin, isGestao, validarSessao } from './services/authService.js';
import { isAuthenticated, getSession, setUser, clearSession, clearUser } from './utils/helpers.js';
import { showToast } from './utils/helpers.js';

const routes = {
  'login': { page: 'auth', auth: false },
  'registrar': { page: 'auth', auth: false },
  'redefinir-primeiro-acesso': { page: 'auth', auth: false },
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
const appLoading = document.getElementById('app-loading');

function showAppLoading() {
  appLoading?.classList.remove('hidden');
  document.body.classList.add('app-loading-active');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  sidebar?.classList.remove('open');
  backdrop?.classList.remove('show');
  document.body.classList.remove('sidebar-open');
}

function hideAppLoading() {
  appLoading?.classList.add('hidden');
  document.body.classList.remove('app-loading-active');
}

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

  // Perfil local presente mas sem sessão de acesso (token ausente): estado
  // inválido, volta ao login.
  if (route.auth && !getSession()) {
    clearUser();
    window.location.hash = 'login';
    return navigate();
  }

  // Valida a sessão no servidor a cada navegação: impede que um usuário
  // excluído/desativado continue navegando entre as telas. Falhas definitivas
  // (token inválido, RPC inexistente) encerram a sessão; falhas transitórias
  // (rede, 5xx, rate limit) mantêm a sessão local em vez de derrubar o usuário.
  if (route.auth) {
    const { user: sessao, error, fatal } = await validarSessao();
    if (error) {
      if (fatal) {
        clearSession();
        clearUser();
        showToast('Sessão inválida. Faça login novamente.', 'warning');
        window.location.hash = 'login';
        return navigate();
      }
      console.warn('[router] Falha transitória ao validar a sessão. Continuando com a sessão local.', error);
    } else if (!sessao || !sessao.ativo) {
      clearSession();
      clearUser();
      showToast('Sessão inválida. Faça login novamente.', 'warning');
      window.location.hash = 'login';
      return navigate();
    }
    setUser({
      id: sessao?.id ?? getCurrentUser()?.id,
      nome: sessao?.nome ?? getCurrentUser()?.nome,
      email: sessao?.email ?? getCurrentUser()?.email,
      matricula: sessao?.matricula ?? getCurrentUser()?.matricula,
      perfil: sessao?.perfil ?? getCurrentUser()?.perfil,
      perfil_id: sessao?.perfil_id ?? getCurrentUser()?.perfil_id,
      expiresAt: Date.now() + 4 * 60 * 60 * 1000
    });
  }

  if (route.can) {
    const user = getCurrentUser();
    if (!route.can(user)) {
      showToast('Acesso restrito. Você não tem permissão para acessar esta página.', 'warning');
      window.location.hash = 'dashboard-geral';
      return navigate();
    }
  }

  if (route.auth) {
    showAppLoading();
  }

  try {
    if (['login', 'registrar', 'redefinir-primeiro-acesso'].includes(hash)) {
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

    if (hash === 'login') {
      const { renderLogin } = await import('./pages/authPage.js');
      renderLogin();
      currentPage = { unload: () => {} };
    } else if (hash === 'registrar') {
      const { renderRegister } = await import('./pages/authPage.js');
      renderRegister();
      currentPage = { unload: () => {} };
    } else if (hash === 'redefinir-primeiro-acesso') {
      const { renderRedefinirPrimeiroAcesso } = await import('./pages/authPage.js');
      renderRedefinirPrimeiroAcesso();
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
  } finally {
    hideAppLoading();
  }
}

export function initRouter() {
  window.addEventListener('hashchange', navigate);
  window.addEventListener('load', navigate);
}
