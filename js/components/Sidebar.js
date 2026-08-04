import { $$ } from '../utils/helpers.js';
import { getCurrentUser, isAdmin, isGestao } from '../services/authService.js';

export function initSidebar() {
  const items = $$('.sidebar-item');
  const toggler = document.getElementById('sidebar-toggler');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  items.forEach(item => {
    item.addEventListener('click', () => {
      const route = item.dataset.route;
      if (route) {
        items.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        window.location.hash = route;
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('open');
          backdrop.classList.remove('show');
        }
      }
    });
  });

  if (toggler) {
    toggler.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('show');
    });
  }

  const collapseBtn = document.getElementById('sidebar-collapse');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      const collapsed = document.body.classList.toggle('sidebar-collapsed');
      localStorage.setItem('sieac_sidebar_collapsed', collapsed ? '1' : '0');
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
    });
  }

  const user = getCurrentUser();
  if (user) {
    const avatar = document.getElementById('user-avatar');
    const name = document.getElementById('user-name');
    const perfil = document.getElementById('user-perfil');
    if (avatar) avatar.textContent = user.nome.charAt(0).toUpperCase();
    if (name) name.textContent = user.nome;
    if (perfil) perfil.textContent = user.perfil;

    const menuUsuarios = document.getElementById('menu-usuarios');
    if (menuUsuarios) {
      menuUsuarios.style.display = isAdmin() ? 'flex' : 'none';
    }

    const menuLogs = document.getElementById('menu-logs');
    if (menuLogs) {
      menuLogs.style.display = isAdmin() ? 'flex' : 'none';
    }

    const menuImportar = document.getElementById('menu-importar');
    if (menuImportar) {
      menuImportar.style.display = (user.perfil === 'Professor' || user.perfil === 'Professor do AEE') ? 'none' : 'flex';
    }

    const menuCadastroEstudantes = document.getElementById('menu-cadastro-estudantes');
    if (menuCadastroEstudantes) {
      menuCadastroEstudantes.style.display = isGestao() ? 'flex' : 'none';
    }
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      const { logout } = await import('../services/authService.js');
      logout();
    });
  }
}

export function setActiveRoute(route) {
  const items = $$('.sidebar-item');
  items.forEach(i => {
    i.classList.toggle('active', i.dataset.route === route);
  });

  const titles = {
    'dashboard-geral': 'Dashboard Geral',
    'dashboard-desempenho': 'Dashboard de Desempenho',
    'dashboard-frequencia': 'Dashboard de Frequência',
    'relatorios': 'Relatório de Notas',
    'relatorio-sem-notas': 'Relatório de Notas Não Lançadas',
    'relatorio-nee': 'Relatório de Estudantes com NEE',
    'dashboard-comparativo': 'Dashboard Comparativo',
    'dashboard-estudante': 'Consulta por Estudante',
    'cadastro-estudantes': 'Cadastro de Estudantes',
    'importar': 'Importar Dados',
    'usuarios': 'Gerenciar Usuários',
    'logs': 'Logs de Atividade',
  };
  const title = document.getElementById('page-title');
  if (title) title.textContent = titles[route] || 'SIEAC';
}
