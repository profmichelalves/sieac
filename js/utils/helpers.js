export function $(selector, context = document) {
  return context.querySelector(selector);
}

export function $$(selector, context = document) {
  return [...context.querySelectorAll(selector)];
}

export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function parseNumber(val) {
  if (val === undefined || val === null || val === '' || val === '-') return null;
  const cleaned = String(val).replace(',', '.').replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function formatNumber(val, decimals = 1) {
  if (val === null || val === undefined) return '-';
  return Number(val).toFixed(decimals);
}

export function formatPercent(val, decimals = 1) {
  if (val === null || val === undefined) return '-';
  return Number(val).toFixed(decimals) + '%';
}

export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

export function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast-sieac');
  if (existing) existing.remove();

  const icons = {
    success: 'bi-check-circle-fill',
    error: 'bi-x-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill'
  };

  const toast = document.createElement('div');
  toast.className = `toast-sieac ${type}`;
  toast.innerHTML = `<i class="bi ${icons[type] || icons.info}" style="font-size:1.2rem;"></i><span>${escapeHtml(message)}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function getChartColors() {
  const style = getComputedStyle(document.documentElement);
  return [
    style.getPropertyValue('--sieac-primary').trim() || '#1a1a4e',
    style.getPropertyValue('--sieac-secondary').trim() || '#00b4d8',
    style.getPropertyValue('--sieac-warning').trim() || '#ffd000',
    style.getPropertyValue('--sieac-danger').trim() || '#e63946',
    style.getPropertyValue('--sieac-success').trim() || '#2dc653',
    '#7c3aed', '#ec4899', '#f59e0b', '#14b8a6', '#8b5cf6'
  ];
}

export function getChartColorsAlpha(alpha = 0.2) {
  return getChartColors().map(c => hexToRgba(c, alpha));
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getMesNome(num) {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return meses[parseInt(num) - 1] || num;
}

export function getUser() {
  try {
    const user = JSON.parse(localStorage.getItem('sieac_user'));
    if (user && user.expiresAt && Date.now() > user.expiresAt) {
      clearUser();
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem('sieac_user', JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem('sieac_user');
}

const SESSION_KEY = 'sieac_auth_session';

// Sessão do Supabase Auth (GoTrue): { access_token, refresh_token, expires_at }.
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.access_token) return null;
    return s;
  } catch {
    return null;
  }
}

export function setSession(session) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch {}
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export function getRefreshToken() {
  return getSession()?.refresh_token || null;
}

export function isSessionExpired() {
  const s = getSession();
  if (!s) return true;
  // margem de 60s antes do vencimento
  return !s.expires_at || Date.now() / 1000 + 60 >= s.expires_at;
}

export function getAuthToken() {
  return getSession()?.access_token || null;
}

export function setAuthToken(token) {
  // compatibilidade: preserva a sessão e atualiza apenas o access token
  if (token) {
    const atual = getSession() || {};
    setSession({ ...atual, access_token: token });
  } else {
    clearSession();
  }
}

export function clearAuthToken() {
  clearSession();
}

// Escapa valores antes de interpolar em innerHTML (mitigação XSS).
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isAuthenticated() {
  return !!getUser();
}

export function hasPerfil(...perfis) {
  const user = getUser();
  return user && perfis.includes(user.perfil);
}

// Os campos created_at do banco são TIMESTAMP (sem fuso) preenchidos com
// NOW() em UTC. Sem o sufixo de fuso, `new Date()` interpretaria o valor
// como hora local e exibiria a hora errada. Aqui tratamos como UTC.
export function parseDataDb(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && !/(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    return new Date(s.replace(' ', 'T') + 'Z');
  }
  return new Date(s);
}

export function formatarDataHora(val) {
  const d = parseDataDb(val);
  if (!d || isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}
