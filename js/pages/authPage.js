import { $, showToast, debounce, escapeHtml } from '../utils/helpers.js';
import { validateLoginFields, validateRegisterFields, validateEmail } from '../utils/validators.js';
import { login, register, listarPerfis, verificarPrecisaRedefinir, redefinirSenhaPrimeiroAcesso } from '../services/authService.js';
import { clearFilterCache } from '../components/FilterPanel.js';
import { initSidebar } from '../components/Sidebar.js';

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
      const precisa = await verificarPrecisaRedefinir(email);
      if (precisa.precisa) {
        sessionStorage.setItem('sieac_reset_email', email.trim().toLowerCase());
        alertEl.innerHTML = `<div class="auth-alert warning">Por questões de segurança, sua senha precisa ser redefinida. Redirecionando...</div>`;
        btn.disabled = true;
        setTimeout(() => { window.location.hash = 'redefinir-primeiro-acesso'; }, 1200);
        return;
      }
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

// Tela de redefinição de primeiro acesso: aparece após uma tentativa de login
// em que a senha do usuário está zerada no banco (atualização de segurança).
// Não há envio de e-mail: o usuário valida email + matrícula + perfil do
// cadastro. O bloqueio de 3 tentativas/15 min é tratado aqui, na própria tela.
export function renderRedefinirPrimeiroAcesso() {
  const container = document.getElementById('auth-container');
  const shell = document.getElementById('app-shell');
  if (container) container.style.display = 'flex';
  if (shell) shell.style.display = 'none';

  if (!container) return;
  const emailPre = (sessionStorage.getItem('sieac_reset_email') || '').trim();

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
        <h2 class="auth-title">Redefinir Senha</h2>
        <div class="auth-alert warning">
          Por questões de segurança, sua senha precisa ser redefinida antes do próximo acesso.
        </div>
        <div id="auth-alert"></div>
        <form class="auth-form" id="first-reset-form">
          <div class="mb-3">
            <label class="form-label">Email</label>
            <input type="email" class="form-control" id="first-reset-email" value="${escapeHtml(emailPre)}" placeholder="seu@email.com" required autocomplete="email">
          </div>
          <div class="mb-3">
            <label class="form-label">Matrícula</label>
            <input type="text" class="form-control" id="first-reset-matricula" placeholder="Sua matrícula" required autocomplete="off">
          </div>
          <div class="mb-3">
            <label class="form-label">Perfil do Cadastro</label>
            <select class="form-control" id="first-reset-perfil">
              <option value="">Carregando...</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">Nova Senha</label>
            <input type="password" class="form-control" id="first-reset-senha" placeholder="Mínimo de 4 caracteres" required autocomplete="new-password">
          </div>
          <div class="mb-3">
            <label class="form-label">Confirmar Nova Senha</label>
            <input type="password" class="form-control" id="first-reset-confirm" placeholder="Repita a nova senha" required autocomplete="new-password">
          </div>
          <button type="submit" class="auth-btn" id="first-reset-btn">Redefinir senha</button>
        </form>
        <div class="auth-link">
          <a href="#login">Voltar ao login</a>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('first-reset-form');
  const alertEl = document.getElementById('auth-alert');
  const btn = document.getElementById('first-reset-btn');

  async function aplicarBloqueio(email) {
    const st = await verificarPrecisaRedefinir(email);
    if (st.bloqueado) {
      alertEl.innerHTML = `<div class="auth-alert error">Muitas tentativas de redefinição. Aguarde alguns minutos antes de tentar novamente.</div>`;
      form.querySelectorAll('input, select').forEach(el => { el.disabled = true; });
      btn.disabled = true;
    } else {
      form.querySelectorAll('input, select').forEach(el => { el.disabled = false; });
      btn.disabled = false;
    }
    return st;
  }

  if (emailPre.includes('@')) aplicarBloqueio(emailPre);

  carregarPerfisReset();

  document.getElementById('first-reset-email').addEventListener('input', debounce(async () => {
    const email = document.getElementById('first-reset-email').value;
    if (email.includes('@')) await aplicarBloqueio(email);
  }, 500));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('first-reset-email').value;
    const matricula = document.getElementById('first-reset-matricula').value;
    const perfilId = document.getElementById('first-reset-perfil').value;
    const senha = document.getElementById('first-reset-senha').value;
    const confirm = document.getElementById('first-reset-confirm').value;

    const errors = [];
    if (!email) errors.push('Email é obrigatório');
    else if (!validateEmail(email)) errors.push('Email inválido');
    if (!matricula || matricula.trim().length < 3) errors.push('Matrícula inválida');
    if (!perfilId) errors.push('Selecione o perfil utilizado no cadastro');
    if (senha.length < 4) errors.push('A senha deve ter no mínimo 4 caracteres');
    if (senha !== confirm) errors.push('As senhas não conferem');
    if (errors.length) {
      alertEl.innerHTML = `<div class="auth-alert error">${errors.join('<br>')}</div>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Redefinindo...';
    alertEl.innerHTML = '';

    const result = await redefinirSenhaPrimeiroAcesso(email, matricula, perfilId, senha);
    if (result.error) {
      await aplicarBloqueio(email);
      alertEl.innerHTML = `<div class="auth-alert error">${escapeHtml(result.error)}</div>`;
      btn.disabled = false;
      btn.textContent = 'Redefinir senha';
      return;
    }

    sessionStorage.removeItem('sieac_reset_email');
    sessionStorage.setItem('sieac_senha_redefinida', '1');
    if (result.ativo) showToast('Senha redefinida com sucesso!', 'success');
    window.location.hash = 'login';
    window.location.reload();
  });
}

// Perfis exibidos no formulário de primeiro acesso (mesmos do cadastro, mais
// Administrador, para o caso de um admin ter a própria senha limpa).
async function carregarPerfisReset() {
  const sel = document.getElementById('first-reset-perfil');
  if (!sel) return;

  const fallback = [
    { id: 1, nome: 'Administrador' },
    { id: 2, nome: 'Gestão Escolar' },
    { id: 3, nome: 'Professor' },
    { id: 4, nome: 'Professor do AEE' },
  ];

  let opcoes = fallback;
  try {
    const { data: perfis, error } = await listarPerfis();
    if (!error && perfis && perfis.length) opcoes = perfis;
  } catch {}

  sel.innerHTML = opcoes.map(p => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join('');
}
