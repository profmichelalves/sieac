import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import {
  getAuthToken, clearAuthToken, clearUser,
  getSession, setSession, getRefreshToken, isSessionExpired, clearSession,
} from '../utils/helpers.js';

const client = { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };

export function getClient() {
  return client;
}

// Bearer: access token do Supabase Auth (GoTrue) quando existe sessão; sem
// sessão (acesso público/anon), usa a anon key.
function buildHeaders(client) {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    'apikey': client.key,
    'Authorization': `Bearer ${token || client.key}`
  };
}

function limparSessao() {
  clearAuthToken();
  clearSession();
  clearUser();
}

// Renova o access token com o refresh token do GoTrue; em falha, encerra a
// sessão local (o router redireciona ao login).
async function forcarRefresh() {
  const session = getSession();
  const refresh = getRefreshToken();
  if (!session || !refresh) {
    limparSessao();
    return false;
  }
  try {
    const res = await fetch(`${client.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': client.key, 'Authorization': `Bearer ${client.key}` },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.access_token) {
      limparSessao();
      return false;
    }
    setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token || refresh,
      expires_at: body.expires_at || Math.floor(Date.now() / 1000) + (body.expires_in || 3600),
    });
    return true;
  } catch {
    limparSessao();
    return false;
  }
}

async function garantirTokenAtual() {
  if (!getSession()) return;
  if (!isSessionExpired()) return;
  await forcarRefresh();
}

// fetch com gestão de sessão: garante token válido antes, e em 401 tenta um
// único refresh antes de devolver a resposta.
async function authFetch(url, init = {}) {
  await garantirTokenAtual();
  let res = await fetch(url, init);
  if (res.status === 401 && getSession()) {
    if (await forcarRefresh()) {
      res = await fetch(url, { ...init, headers: buildHeaders(client) });
    }
  }
  return res;
}

// Interceptor 401: sessão inválida/expirada → volta ao login.
function tratarNaoAutorizado(status) {
  if (status === 401 && window.location.hash && !window.location.hash.startsWith('#login')) {
    limparSessao();
    window.location.hash = 'login';
    window.location.reload();
  }
}

async function request(method, path, body = null) {
  const client = getClient();
  if (!client) return { error: 'Supabase não configurado' };
  try {
    const options = { method, headers: buildHeaders(client) };
    if (body) options.body = JSON.stringify(body);
    const res = await authFetch(`${client.url}${path}`, options);
    if (res.status === 204) return { data: null, error: null };
    tratarNaoAutorizado(res.status);
    let json;
    try {
      const text = await res.text();
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      json = null;
    }
    if (res.status >= 400) {
      return { data: null, error: json?.message || json?.error || `Erro ${res.status}` };
    }
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export const rest = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
};

export function buildQuery(table, options = {}) {
  const { select = '*', filters = [], order, limit, offset, range } = options;
  let query = `/rest/v1/${table}?select=${select}`;
  filters.forEach(f => {
    if (!f.col || f.val === undefined || f.val === null || f.val === '') return;
    const op = f.op || 'eq';
    if (op === 'in' && Array.isArray(f.val) && f.val.length) {
      const encoded = f.val.map(v => encodeURIComponent(v)).join(',');
      query += `&${f.col}=in.(${encoded})`;
    } else if (op === 'ilike' || op === 'like') {
      query += `&${f.col}=${op}.${encodeURIComponent(f.val)}`;
    } else if (['gte', 'lte', 'gt', 'lt', 'neq'].includes(op)) {
      query += `&${f.col}=${op}.${encodeURIComponent(f.val)}`;
    } else {
      query += `&${f.col}=eq.${encodeURIComponent(f.val)}`;
    }
  });
  if (order) query += `&order=${order}`;
  if (limit) query += `&limit=${limit}`;
  if (offset) query += `&offset=${offset}`;
  if (range) query += `&range=${range}`;
  return query;
}

export async function supabaseQuery(table, options = {}) {
  const path = buildQuery(table, options);
  return rest.get(path);
}

export async function supabaseFetchAll(table, options = {}) {
  const PAGE = 1000;
  const { select = '*', filters = [], order, limit = 30000 } = options;
  const all = [];
  let fetched = 0;
  while (fetched < limit) {
    const take = Math.min(PAGE, limit - fetched);
    const path = buildQuery(table, { select, filters, order, limit: take, offset: fetched });
    const res = await rest.get(path);
    const data = res.data || [];
    all.push(...data);
    if (data.length < take) break;
    fetched += data.length;
  }
  return { data: all, error: null };
}

export async function supabaseUpsert(table, rows, onConflict) {
  const client = getClient();
  if (!client) return { error: 'Supabase não configurado' };
  try {
    const headers = buildHeaders(client);
    let url = `${client.url}/rest/v1/${table}`;
    if (onConflict) {
      headers['Prefer'] = ['resolution=merge-duplicates', 'return=minimal'];
      url += `?on_conflict=${onConflict}`;
    }
    const res = await authFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(rows)
    });
    tratarNaoAutorizado(res.status);
    if (res.status >= 400) {
      const text = await res.text();
      return { error: text };
    }
    let data = null;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = null;
    }
    return { data, error: null };
  } catch (err) {
    return { error: err.message };
  }
}

export async function supabaseRpc(functionName, params = {}) {
  const client = getClient();
  if (!client) return { error: 'Supabase não configurado' };
  try {
    const res = await authFetch(`${client.url}/rest/v1/rpc/${functionName}?apikey=${encodeURIComponent(client.key)}`, {
      method: 'POST',
      headers: buildHeaders(client),
      body: JSON.stringify(params),
    });
    tratarNaoAutorizado(res.status);
    if (res.status >= 400) {
      const text = await res.text();
      return { data: null, error: text };
    }
    let data = null;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : null;
    } catch (e) { data = null; }
    return { data, error: null };
  } catch (err) {
    return { error: err.message };
  }
}

export async function supabaseDelete(table, col, val) {
  const client = getClient();
  if (!client) return { error: 'Supabase não configurado' };
  try {
    const res = await authFetch(`${client.url}/rest/v1/${table}?${col}=eq.${encodeURIComponent(val)}`, {
      method: 'DELETE',
      headers: buildHeaders(client)
    });
    tratarNaoAutorizado(res.status);
    if (res.status >= 400) {
      const text = await res.text();
      return { error: text };
    }
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}
