import { $, showToast } from '../utils/helpers.js';
import { validateLoginFields, validateRegisterFields } from '../utils/validators.js';
import { login, register, listarPerfis } from '../services/authService.js';
import { clearFilterCache } from '../components/FilterPanel.js';

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
      window.location.hash = 'dashboard-geral';
      window.location.reload();
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
