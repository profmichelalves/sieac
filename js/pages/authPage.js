import { $, showToast } from '../utils/helpers.js';
import { validateLoginFields, validateRegisterFields } from '../utils/validators.js';
import { login, register, listarPerfis, recuperarSenha, redefinirSenha } from '../services/authService.js';
import { clearFilterCache } from '../components/FilterPanel.js';
import { initSidebar } from '../components/Sidebar.js';
import { setSession, clearSession, clearUser } from '../utils/helpers.js';

export function renderLogin() {
  const container = document.getElementById('auth-container');
  const shell = document.getElementById('app-shell');
  if (container) container.style.display = 'flex';
  if (shell) shell.style.display = 'none';

  if (!container) return;
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon">S</div>
          <div class="auth-logo-text">
            SIEAC
            <small>Sistema de Indicadores Educacionais Abel Coelho</small>
          </div>
        </div>
        <h2 class="auth-title">Acessar o Sistema</h2>
        <div id="auth-alert"></div>
        <form class="auth-form" id="login-form">
          <div class="mb-3">
            <label class="form-label">Email</label>
            <input type="email" class="form-control" id="login-email" placeholder="seu@email.com" required autocomplete="email">
          </div>
          <div class="mb-3">
            <label class="form-label">Senha</label>
            <input type="password" class="form-control" id="login-senha" placeholder="Sua senha" required autocomplete="current-password">
          </div>
          <button type="submit" class="auth-btn" id="login-btn">Entrar</button>
        </form>
        <div class="auth-link">
          Não tem conta? <a href="#registrar">Cadastre-se</a>
        </div>
        <div class="auth-link">
          <a href="#recuperar-senha">Esqueci minha senha</a>
        </div>

      </div>
    </div>
  `;

  const avisoRedefinida = sessionStorage.getItem('sieac_senha_redefinida');
  if (avisoRedefinida) {
    sessionStorage.removeItem('sieac_senha_redefinida');
    const alertEl = document.getElementById('auth-alert');
    if (alertEl) alertEl.innerHTML = `<div class="auth-alert success">Senha redefinida com sucesso! Faça login com a nova senha.</div>`;
  }

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const alertEl = document.getElementById('auth-alert');
    const btn = document.getElementById('login-btn');

    const errors = validateLoginFields(email, senha);
    if (errors.length) {
      alertEl.innerHTML = `<div class="auth-alert error">${errors.join('<br>')}</div>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Entrando...';
    alertEl.innerHTML = '';

    const result = await login(email, senha);
    if (result.error) {
      alertEl.innerHTML = `<div class="auth-alert error">${result.error}</div>`;
      btn.disabled = false;
      btn.textContent = 'Entrar';
    } else {
      clearFilterCache();
      localStorage.removeItem('sieac_aee_alert_dismissed');
      showToast('Bem-vindo, ' + result.user.nome + '!', 'success');
      // Sem reload(): o hashchange dispara o router, que valida a sessão e
      // renderiza a rota. O reload antigo abortava o validarSessao em voo,
      // causando deslogues intermitentes logo após o login.
      initSidebar();
      window.location.hash = 'dashboard-geral';
    }
  });

}

export function renderRegister() {
  const container = document.getElementById('auth-container');
  const shell = document.getElementById('app-shell');
  if (container) container.style.display = 'flex';
  if (shell) shell.style.display = 'none';

  if (!container) return;
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon">S</div>
          <div class="auth-logo-text">
            SIEAC
            <small>Sistema de Indicadores Educacionais Abel Coelho</small>
          </div>
        </div>
        <h2 class="auth-title">Criar Conta</h2>
        <div id="auth-alert"></div>
        <form class="auth-form" id="register-form">
          <div class="mb-3">
            <label class="form-label">Nome Completo</label>
            <input type="text" class="form-control" id="reg-nome" placeholder="Seu nome" required>
          </div>
          <div class="mb-3">
            <label class="form-label">Email</label>
            <input type="email" class="form-control" id="reg-email" placeholder="seu@email.com" required>
          </div>
          <div class="mb-3">
            <label class="form-label">Matrícula</label>
            <input type="text" class="form-control" id="reg-matricula" placeholder="Sua matrícula" required>
          </div>
          <div class="mb-3">
            <label class="form-label">Tipo de Usuário</label>
            <select class="form-control" id="reg-perfil">
              <option value="">Carregando...</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">Senha</label>
            <input type="password" class="form-control" id="reg-senha" placeholder="Crie uma senha" required>
          </div>
          <div class="mb-3">
            <label class="form-label">Confirmar Senha</label>
            <input type="password" class="form-control" id="reg-confirm" placeholder="Repita a senha" required>
          </div>
          <button type="submit" class="auth-btn" id="register-btn">Cadastrar</button>
        </form>
        <div class="auth-link">
          Já tem conta? <a href="#login">Faça login</a>
        </div>
      </div>
    </div>
  `;

    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nome = document.getElementById('reg-nome').value;
      const email = document.getElementById('reg-email').value;
      const matricula = document.getElementById('reg-matricula').value;
      const perfilId = document.getElementById('reg-perfil').value;
      const senha = document.getElementById('reg-senha').value;
      const confirm = document.getElementById('reg-confirm').value;
      const alertEl = document.getElementById('auth-alert');
      const btn = document.getElementById('register-btn');

      const errors = validateRegisterFields(nome, email, matricula, senha, confirm);
      if (errors.length) {
        alertEl.innerHTML = `<div class="auth-alert error">${errors.join('<br>')}</div>`;
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Cadastrando...';

      const result = await register(nome, email, matricula, senha, perfilId);
    if (result.error) {
      alertEl.innerHTML = `<div class="auth-alert error">${result.error}</div>`;
      btn.disabled = false;
      btn.textContent = 'Cadastrar';
    } else if (result.ativadoAutomaticamente) {
      alertEl.innerHTML = `<div class="auth-alert success">Cadastro realizado e ativado automaticamente! Você já pode fazer login.</div>`;
      btn.textContent = 'Cadastro ativado';
      setTimeout(() => {
        window.location.hash = 'login';
        window.location.reload();
      }, 2000);
    } else {
      alertEl.innerHTML = `<div class="auth-alert success">Cadastro realizado! Aguarde a liberação pelo administrador.</div>`;
      btn.textContent = 'Cadastro enviado';
      setTimeout(() => {
        window.location.hash = 'login';
        window.location.reload();
      }, 3000);
    }
  });

  carregarPerfisCadastro();
}

async function carregarPerfisCadastro() {
  const sel = document.getElementById('reg-perfil');
  if (!sel) return;

  const fallback = [
    { id: 2, nome: 'Gestão Escolar' },
    { id: 3, nome: 'Professor' },
    { id: 4, nome: 'Professor do AEE' },
  ];
  const permitidos = new Set(['professor', 'professor do aee', 'gestao escolar', 'gestao escolar ']);

  let opcoes = fallback;
  try {
    const { data: perfis, error } = await listarPerfis();
    if (!error && perfis && perfis.length) {
      const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const filtradas = perfis.filter(p => permitidos.has(norm(p.nome)));
      if (filtradas.length) opcoes = filtradas;
    }
  } catch {}

  sel.innerHTML = opcoes.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
  const prof = opcoes.find(p => normEqual(p.nome, 'Professor'));
  if (prof) sel.value = prof.id;
}

function normEqual(a, b) {
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return norm(a) === norm(b);
}

export function renderRecuperarSenha() {
  const container = document.getElementById('auth-container');
  const shell = document.getElementById('app-shell');
  if (container) container.style.display = 'flex';
  if (shell) shell.style.display = 'none';

  if (!container) return;
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon">S</div>
          <div class="auth-logo-text">
            SIEAC
            <small>Sistema de Indicadores Educacionais Abel Coelho</small>
          </div>
        </div>
        <h2 class="auth-title">Recuperar Senha</h2>
        <p style="text-align:center;color:var(--text-muted);font-size:0.9rem;margin-bottom:16px;">
          Informe seu e-mail cadastrado. Enviaremos um link para você definir uma nova senha.
        </p>
        <div id="auth-alert"></div>
        <form class="auth-form" id="recover-form">
          <div class="mb-3">
            <label class="form-label">Email</label>
            <input type="email" class="form-control" id="recover-email" placeholder="seu@email.com" required autocomplete="email">
          </div>
          <button type="submit" class="auth-btn" id="recover-btn">Enviar link</button>
        </form>
        <div class="auth-link">
          Lembrou a senha? <a href="#login">Faça login</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('recover-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('recover-email').value;
    const alertEl = document.getElementById('auth-alert');
    const btn = document.getElementById('recover-btn');

    btn.disabled = true;
    btn.textContent = 'Enviando...';
    alertEl.innerHTML = '';

    const result = await recuperarSenha(email);
    if (result.error) {
      const isRateLimit = /rate limit|limite/i.test(result.error);
      const msg = isRateLimit
        ? 'Muitas solicitações de recuperação. Aguarde cerca de 1 hora antes de tentar novamente.'
        : 'Não foi possível enviar o link. Se o problema persistir, aguarde alguns minutos e tente novamente.';
      alertEl.innerHTML = `<div class="auth-alert error">${escapeHtmlMsg(msg)}</div>`;
      btn.disabled = false;
      btn.textContent = 'Enviar link';
    } else {
      alertEl.innerHTML = `<div class="auth-alert success">Se o e-mail estiver cadastrado, você receberá um link de recuperação.</div>`;
      btn.textContent = 'Link enviado';
    }
  });
}

// Extrai access_token/refresh_token/expires_at do fragmento de recuperação do
// Supabase Auth: <site>#access_token=...&refresh_token=...&type=recovery
function parseRecoveryFragment() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  if (params.get('type') !== 'recovery' || !params.get('access_token')) return null;
  const expiresAt = parseInt(params.get('expires_at') || '0', 10);
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    expires_at: expiresAt || Math.floor(Date.now() / 1000) + 3600,
  };
}

export function renderRedefinirSenha() {
  const container = document.getElementById('auth-container');
  const shell = document.getElementById('app-shell');
  if (container) container.style.display = 'flex';
  if (shell) shell.style.display = 'none';

  if (!container) return;

  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-logo">
        <div class="auth-logo-icon">S</div>
        <div class="auth-logo-text">
          SIEAC
          <small>Sistema de Indicadores Educacionais Abel Coelho</small>
        </div>
      </div>
    </div>
  `;

  const token = parseRecoveryFragment();
  if (!token) {
    const modal = mostrarModalRedefinicao({
      voltarAoLoginEmHidden: false,
      body: `
        <div class="auth-alert error">O link de recuperação é inválido ou já expirou. Solicite um novo link.</div>
      `,
      footer: `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="reset-novo-link" style="border-radius:var(--sieac-radius-pill);">Solicitar novo link</button>
        <button type="button" class="btn btn-primary" data-bs-dismiss="modal" id="reset-ir-login" style="border-radius:var(--sieac-radius-pill);">Fazer login</button>
      `,
    });
    modal.querySelector('#reset-novo-link')?.addEventListener('click', () => { window.location.hash = '#recuperar-senha'; });
    modal.querySelector('#reset-ir-login')?.addEventListener('click', () => { window.location.hash = '#login'; });
    return;
  }

  // Usa a sessão de recuperação para autenticar a troca de senha.
  setSession(token);

  let concluido = false;
  const modal = mostrarModalRedefinicao({
    voltarAoLoginEmHidden: true,
    body: `
      <div id="auth-alert"></div>
      <form id="reset-form">
        <div class="mb-3">
          <label class="form-label" for="reset-senha">Nova Senha</label>
          <input type="password" class="form-control" id="reset-senha" placeholder="Crie uma nova senha" required autocomplete="new-password">
        </div>
        <div class="mb-3">
          <label class="form-label" for="reset-confirm">Confirmar Nova Senha</label>
          <input type="password" class="form-control" id="reset-confirm" placeholder="Repita a nova senha" required autocomplete="new-password">
        </div>
      </form>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" style="border-radius:var(--sieac-radius-pill);">Cancelar</button>
      <button type="submit" form="reset-form" class="btn btn-primary" id="reset-btn" style="border-radius:var(--sieac-radius-pill);">Salvar nova senha</button>
    `,
  });
  modal.addEventListener('hidden.bs.modal', () => {
    if (!concluido) clearSession();
  });

  const form = modal.querySelector('#reset-form');
  const btn = modal.querySelector('#reset-btn');
  const alertEl = modal.querySelector('#auth-alert');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const senha = document.getElementById('reset-senha').value;
    const confirm = document.getElementById('reset-confirm').value;

    if (senha.length < 4) {
      alertEl.innerHTML = `<div class="auth-alert error">A senha deve ter no mínimo 4 caracteres.</div>`;
      return;
    }
    if (senha !== confirm) {
      alertEl.innerHTML = `<div class="auth-alert error">As senhas não conferem.</div>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Salvando...';
    alertEl.innerHTML = '';

    const result = await redefinirSenha(senha);
    if (result.error) {
      alertEl.innerHTML = `<div class="auth-alert error">${escapeHtmlMsg(result.error)}</div>`;
      btn.disabled = false;
      btn.textContent = 'Salvar nova senha';
      return;
    }

    concluido = true;
    clearSession();
    clearUser();
    sessionStorage.setItem('sieac_senha_redefinida', '1');
    bootstrap.Modal.getInstance(modal)?.hide();
    window.location.hash = '#login';
    window.location.reload();
  });
}

// Exibe o formulário de nova senha em uma modal Bootstrap, seguindo o mesmo
// layout das demais janelas modais da aplicação.
function mostrarModalRedefinicao({ body, footer, voltarAoLoginEmHidden = true }) {
  document.getElementById('modal-redefinir-senha')?.remove();
  const modalEl = document.createElement('div');
  modalEl.className = 'modal fade';
  modalEl.id = 'modal-redefinir-senha';
  modalEl.tabIndex = -1;
  modalEl.setAttribute('aria-hidden', 'true');
  modalEl.innerHTML = `
    <div class="modal-dialog modal-dialog-centered" style="max-width:440px;">
      <div class="modal-content" style="border-radius:var(--sieac-radius-xl);box-shadow:var(--sieac-shadow-lg);">
        <div class="modal-header">
          <h5 class="modal-title" style="font-weight:700;"><i class="bi bi-key-fill" style="color:var(--sieac-warning);margin-right:8px;"></i>Definir Nova Senha</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
        </div>
        <div class="modal-body">
          <p style="color:var(--sieac-text-muted);font-size:0.9rem;margin-bottom:16px;">Crie uma nova senha para acessar o SIEAC.</p>
          ${body}
        </div>
        <div class="modal-footer">
          ${footer}
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);
  modalEl.addEventListener('hidden.bs.modal', () => {
    document.getElementById('modal-redefinir-senha')?.remove();
    if (voltarAoLoginEmHidden && !window.location.hash.startsWith('#redefinir-senha')) {
      window.location.hash = '#login';
    }
  });
  new bootstrap.Modal(modalEl).show();
  return modalEl;
}

function escapeHtmlMsg(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
