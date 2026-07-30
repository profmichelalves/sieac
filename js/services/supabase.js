import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const client = { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };

export function getClient() {
  return client;
}

function buildHeaders(client) {
  return {
    'Content-Type': 'application/json',
    'apikey': client.key,
    'Authorization': `Bearer ${client.key}`
  };
}

async function request(method, path, body = null) {
  const client = getClient();
  if (!client) return { error: 'Supabase não configurado' };
  try {
    const options = { method, headers: buildHeaders(client) };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${client.url}${path}`, options);
    if (res.status === 204) return { data: null, error: null };
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
  const { select = '*', filters = [], order, limit, range } = options;
  let query = `/rest/v1/${table}?select=${select}`;
  filters.forEach(f => {
    if (f.col && f.val !== undefined && f.val !== null && f.val !== '') {
      query += `&${f.col}=eq.${encodeURIComponent(f.val)}`;
    }
  });
  if (order) query += `&order=${order}`;
  if (limit) query += `&limit=${limit}`;
  return query;
}

export async function supabaseQuery(table, options = {}) {
  const path = buildQuery(table, options);
  return rest.get(path);
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
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(rows)
    });
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
    const res = await fetch(`${client.url}/rest/v1/rpc/${functionName}?apikey=${encodeURIComponent(client.key)}`, {
      method: 'POST',
      headers: buildHeaders(client),
      body: JSON.stringify(params),
    });
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
    const res = await fetch(`${client.url}/rest/v1/${table}?${col}=eq.${encodeURIComponent(val)}`, {
      method: 'DELETE',
      headers: buildHeaders(client)
    });
    if (res.status >= 400) {
      const text = await res.text();
      return { error: text };
    }
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}
