import { $$ } from '../utils/helpers.js';
import { getCurrentUser, isAdmin } from '../services/authService.js';

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
      menuUsuarios.style.display = isAdmin() ? 'block' : 'none';
    }

    const menuImportar = document.getElementById('menu-importar');
    if (menuImportar) {
      menuImportar.style.display = user.perfil === 'Professor' ? 'none' : 'block';
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
    'dashboard-comparativo': 'Dashboard Comparativo',
    'dashboard-estudante': 'Consulta por Estudante',
    'importar': 'Importar Dados',
    'usuarios': 'Gerenciar Usuários',
  };
  const title = document.getElementById('page-title');
  if (title) title.textContent = titles[route] || 'SIEAC';
}
