import { $, $$, showToast, escapeHtml } from '../utils/helpers.js';
import { getCurrentUser, isAdmin, isGestao, alterarProprioEmail, mudarPropriaSenha } from '../services/authService.js';
import { registrarLog, LOG_ACTIONS } from '../services/logService.js';

let inicializada = false;

function setScrollLock(open) {
  document.body.classList.toggle('sidebar-open', open);
}

function isAppLoadingVisible() {
  const el = document.getElementById('app-loading');
  return !!el && !el.classList.contains('hidden');
}

export function initSidebar() {
  if (inicializada) return;
  inicializada = true;
  const items = $$('.sidebar-item');
  const toggler = document.getElementById('sidebar-toggler');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  // --- Grupos colapsáveis (tudo exceto Dashboard) ---------------------
  // O grupo Dashboard não possui toggle e fica sempre expandido. Os demais
  // grupos nascem colapsados e podem ser expandidos/recolhidos pelo usuário.
  $$('.sidebar-group-toggle').forEach(toggle => {
    const groupName = toggle.dataset.group;
    const content = document.querySelector(`[data-group-content="${groupName}"]`);
    const setExpanded = (open) => {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (content) content.classList.toggle('hidden', !open);
    };

    // Estado inicial: todos colapsados (apenas o Dashboard nasce expandido).
    setExpanded(false);

    toggle.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-group-toggle')) {
        setExpanded(toggle.getAttribute('aria-expanded') !== 'true');
      }
    });
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setExpanded(toggle.getAttribute('aria-expanded') !== 'true');
      }
    });
  });

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
          setScrollLock(false);
        }
      }
    });
  });

  if (toggler) {
    toggler.addEventListener('click', () => {
      if (isAppLoadingVisible() && !sidebar.classList.contains('open')) return;
      const willOpen = !sidebar.classList.contains('open');
      sidebar.classList.toggle('open', willOpen);
      backdrop.classList.toggle('show', willOpen);
      setScrollLock(willOpen);
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
      setScrollLock(false);
    });
  }

  initSwipeGestures(sidebar, backdrop);

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

    // --- "Cadastros" section: visible only for Administrador ---
    const cadastrosItems = ['menu-cadastro-etapas', 'menu-cadastro-series', 'menu-cadastro-turmas-admin', 'menu-cadastro-disciplinas', 'menu-cadastro-professores', 'menu-cadastro-estudantes-admin', 'menu-lancar-notas', 'menu-lancar-frequencia'];
    const sectionCadastros = document.getElementById('section-cadastros');
    const algumCadastroVisivel = isAdmin();
    if (sectionCadastros) {
      sectionCadastros.style.display = algumCadastroVisivel ? '' : 'none';
    }
    cadastrosItems.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = isAdmin() ? 'flex' : 'none';
    });

    const menuImportar = document.getElementById('menu-importar');
    if (menuImportar) {
      menuImportar.style.display = (user.perfil === 'Professor' || user.perfil === 'Professor do AEE') ? 'none' : 'flex';
    }

    const menuCadastroEstudantes = document.getElementById('menu-cadastro-estudantes');
    if (menuCadastroEstudantes) {
      menuCadastroEstudantes.style.display = isGestao() ? 'flex' : 'none';
    }

    const menuTurmas = document.getElementById('menu-turmas');
    if (menuTurmas) {
      menuTurmas.style.display = isGestao() ? 'flex' : 'none';
    }
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      const { logout } = await import('../services/authService.js');
      logout();
    });
  }

  const btnConta = document.getElementById('user-info-btn');
  if (btnConta) {
    btnConta.addEventListener('click', abrirMinhaConta);
  }
}

function initSwipeGestures(sidebar, backdrop) {
  const isMobile = () => window.innerWidth <= 768;
  const isOpen = () => sidebar.classList.contains('open');
  const EDGE_TOLERANCE = 48;
  const openSidebar = () => {
    if (isAppLoadingVisible()) return;
    sidebar.classList.add('open');
    backdrop.classList.add('show');
    setScrollLock(true);
  };
  const closeSidebar = () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
    setScrollLock(false);
  };

  let startX = null;
  let startY = null;

  document.addEventListener('touchstart', (e) => {
    if (!isMobile() || e.touches.length !== 1) { startX = null; return; }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const startedAtEdge = startX <= EDGE_TOLERANCE;
    startX = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0) {
      // Abre apenas se o gesto começou na margem esquerda (ou bem próxima)
      // e percorreu pelo menos 50% da largura da tela.
      if (!isOpen() && startedAtEdge && dx >= window.innerWidth * 0.5) openSidebar();
    } else if (dx < 0 && isOpen()) {
      closeSidebar();
    }
  }, { passive: true });
}

function criarModal(id, titulo, icone, cor) {
  document.getElementById(id)?.remove();
  const modalEl = document.createElement('div');
  modalEl.className = 'modal fade';
  modalEl.id = id;
  modalEl.tabIndex = -1;
  modalEl.setAttribute('aria-hidden', 'true');
  modalEl.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" style="font-weight:700;"><i class="bi ${icone}" style="color:${cor};margin-right:8px;"></i>${titulo}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
        </div>
        <div class="modal-body" id="${id}-body"></div>
        <div class="modal-footer" id="${id}-footer"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);
  modalEl.addEventListener('hidden.bs.modal', () => document.getElementById(id)?.remove());
  return modalEl;
}

function abrirMinhaConta() {
  const user = getCurrentUser();
  if (!user) return;
  const modalEl = criarModal('modal-conta', 'Minha Conta', 'bi-person-circle', 'var(--sieac-primary)');
  const body = modalEl.querySelector('#modal-conta-body');
  const footer = modalEl.querySelector('#modal-conta-footer');

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
      <div class="sidebar-user-avatar" style="width:52px;height:52px;font-size:1.2rem;flex-shrink:0;">${escapeHtml((user.nome || 'A').charAt(0).toUpperCase())}</div>
      <div style="min-width:0;">
        <div style="font-weight:700;font-size:1.05rem;">${escapeHtml(user.nome)}</div>
        <div style="color:var(--sieac-text-muted);font-size:0.85rem;">${escapeHtml(user.perfil)}</div>
      </div>
    </div>
    <div class="table-responsive-custom">
      <table class="table-sieac" style="margin:0;">
        <tbody>
          <tr><td style="padding:8px 12px;color:var(--sieac-text-muted);">Nome completo</td><td style="padding:8px 12px;"><strong>${escapeHtml(user.nome)}</strong></td></tr>
          <tr><td style="padding:8px 12px;color:var(--sieac-text-muted);">Perfil</td><td style="padding:8px 12px;"><strong>${escapeHtml(user.perfil)}</strong></td></tr>
          <tr><td style="padding:8px 12px;color:var(--sieac-text-muted);">Matrícula</td><td style="padding:8px 12px;"><strong>${escapeHtml(user.matricula || '-')}</strong></td></tr>
          <tr><td style="padding:8px 12px;color:var(--sieac-text-muted);">E-mail</td><td style="padding:8px 12px;"><strong>${escapeHtml(user.email)}</strong></td></tr>
        </tbody>
      </table>
    </div>
  `;
  footer.innerHTML = `
    <button type="button" class="btn btn-outline-primary" id="conta-alterar-email" style="border-radius:var(--sieac-radius-pill);"><i class="bi bi-envelope"></i> Alterar e-mail</button>
    <button type="button" class="btn btn-outline-warning" id="conta-alterar-senha" style="border-radius:var(--sieac-radius-pill);"><i class="bi bi-key"></i> Alterar senha</button>
    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" style="border-radius:var(--sieac-radius-pill);">Fechar</button>
  `;

  modalEl.querySelector('#conta-alterar-email').addEventListener('click', () => {
    bootstrap.Modal.getInstance(modalEl)?.hide();
    abrirAlterarEmail();
  });
  modalEl.querySelector('#conta-alterar-senha').addEventListener('click', () => {
    bootstrap.Modal.getInstance(modalEl)?.hide();
    abrirAlterarSenha();
  });

  new bootstrap.Modal(modalEl).show();
}

function abrirAlterarEmail() {
  const user = getCurrentUser();
  if (!user) return;
  const modalEl = criarModal('modal-conta-email', 'Alterar E-mail', 'bi-envelope', 'var(--sieac-primary)');
  const body = modalEl.querySelector('#modal-conta-email-body');
  const footer = modalEl.querySelector('#modal-conta-email-footer');

  body.innerHTML = `
    <div id="conta-email-alert"></div>
    <div class="mb-3">
      <label class="form-label">E-mail atual</label>
      <input type="email" class="form-control" value="${escapeHtml(user.email)}" disabled>
    </div>
    <div class="mb-3">
      <label class="form-label" for="conta-novo-email">Novo e-mail</label>
      <input type="email" class="form-control" id="conta-novo-email" placeholder="seu@email.com" autocomplete="email">
    </div>
    <div class="mb-3">
      <label class="form-label" for="conta-confirm-email">Confirmar novo e-mail</label>
      <input type="email" class="form-control" id="conta-confirm-email" placeholder="Repita o novo e-mail" autocomplete="email">
    </div>
  `;
  footer.innerHTML = `
    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" style="border-radius:var(--sieac-radius-pill);">Cancelar</button>
    <button type="button" class="btn btn-primary" id="conta-email-salvar" style="border-radius:var(--sieac-radius-pill);">Salvar</button>
  `;

  const alertEl = body.querySelector('#conta-email-alert');
  const btn = footer.querySelector('#conta-email-salvar');
  btn.addEventListener('click', async () => {
    const novo = modalEl.querySelector('#conta-novo-email').value.trim();
    const conf = modalEl.querySelector('#conta-confirm-email').value.trim();
    const errors = [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novo)) errors.push('Novo e-mail inválido.');
    if (novo.toLowerCase() === String(user.email).toLowerCase()) errors.push('Informe um e-mail diferente do atual.');
    if (novo !== conf) errors.push('Os e-mails não conferem.');
    if (errors.length) {
      alertEl.innerHTML = `<div class="auth-alert error">${errors.join('<br>')}</div>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Salvando...';
    const result = await alterarProprioEmail(novo);
    if (result.error) {
      alertEl.innerHTML = `<div class="auth-alert error">${escapeHtml(result.error)}</div>`;
      btn.disabled = false;
      btn.textContent = 'Salvar';
      return;
    }
    registrarLog(LOG_ACTIONS.ALTERAR_EMAIL, { email_novo: novo.toLowerCase() });
    const { setUser } = await import('../utils/helpers.js');
    const atual = getCurrentUser();
    if (atual) setUser({ ...atual, email: novo.toLowerCase() });
    bootstrap.Modal.getInstance(modalEl)?.hide();
    showToast('E-mail atualizado com sucesso!', 'success');
  });

  new bootstrap.Modal(modalEl).show();
}

function abrirAlterarSenha() {
  const modalEl = criarModal('modal-conta-senha', 'Alterar Senha', 'bi-key', 'var(--sieac-warning)');
  const body = modalEl.querySelector('#modal-conta-senha-body');
  const footer = modalEl.querySelector('#modal-conta-senha-footer');

  body.innerHTML = `
    <div class="auth-alert warning" style="margin-bottom:16px;">Após salvar, você será desconectado e precisará entrar com a nova senha.</div>
    <div id="conta-senha-alert"></div>
    <div class="mb-3">
      <label class="form-label" for="conta-senha-atual">Senha atual</label>
      <input type="password" class="form-control" id="conta-senha-atual" placeholder="Sua senha atual" autocomplete="current-password">
    </div>
    <div class="mb-3">
      <label class="form-label" for="conta-senha-nova">Nova senha</label>
      <input type="password" class="form-control" id="conta-senha-nova" placeholder="Mínimo de 4 caracteres" autocomplete="new-password">
    </div>
    <div class="mb-3">
      <label class="form-label" for="conta-senha-confirm">Confirmar nova senha</label>
      <input type="password" class="form-control" id="conta-senha-confirm" placeholder="Repita a nova senha" autocomplete="new-password">
    </div>
  `;
  footer.innerHTML = `
    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" style="border-radius:var(--sieac-radius-pill);">Cancelar</button>
    <button type="button" class="btn btn-primary" id="conta-senha-salvar" style="border-radius:var(--sieac-radius-pill);">Salvar nova senha</button>
  `;

  const alertEl = body.querySelector('#conta-senha-alert');
  const btn = footer.querySelector('#conta-senha-salvar');
  btn.addEventListener('click', async () => {
    const atual = modalEl.querySelector('#conta-senha-atual').value;
    const nova = modalEl.querySelector('#conta-senha-nova').value;
    const conf = modalEl.querySelector('#conta-senha-confirm').value;
    const errors = [];
    if (!atual) errors.push('Informe a senha atual.');
    if (nova.length < 4) errors.push('A nova senha deve ter no mínimo 4 caracteres.');
    if (nova !== conf) errors.push('As senhas não conferem.');
    if (errors.length) {
      alertEl.innerHTML = `<div class="auth-alert error">${errors.join('<br>')}</div>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Salvando...';
    const result = await mudarPropriaSenha(atual, nova);
    if (result.error) {
      alertEl.innerHTML = `<div class="auth-alert error">${escapeHtml(result.error)}</div>`;
      btn.disabled = false;
      btn.textContent = 'Salvar nova senha';
      return;
    }
    registrarLog(LOG_ACTIONS.RESETAR_SENHA, { modo: 'propria' });
    const { clearSession, clearUser } = await import('../utils/helpers.js');
    bootstrap.Modal.getInstance(modalEl)?.hide();
    sessionStorage.setItem('sieac_senha_redefinida', '1');
    clearSession();
    clearUser();
    window.location.hash = 'login';
    window.location.reload();
  });

  new bootstrap.Modal(modalEl).show();
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
    'turmas': 'Cadastro de Turmas',
    'cadastro-etapas': 'Cadastro de Etapas de Ensino',
    'cadastro-series': 'Cadastro de Séries',
    'cadastro-turmas-admin': 'Cadastro de Turmas',
    'cadastro-disciplinas': 'Cadastro de Disciplinas',
    'cadastro-professores': 'Cadastro de Professores',
    'cadastro-estudantes-admin': 'Cadastro de Estudantes',
    'lancar-notas': 'Lançar Notas',
    'lancar-frequencia': 'Lançar Frequência',
    'importar': 'Importar Dados',
    'usuarios': 'Gerenciar Usuários',
    'logs': 'Logs de Atividade',
  };
  const title = document.getElementById('page-title');
  if (title) title.textContent = titles[route] || 'SIEAC';
}
