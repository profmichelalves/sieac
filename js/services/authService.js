import { supabaseRpc, supabaseQuery, getClient } from './supabase.js';
import { setUser, clearUser, setSession, clearSession, getAuthToken } from '../utils/helpers.js';
import { registrarLog, LOG_ACTIONS } from './logService.js';

function mapearErroLogin(body) {
  const code = body?.error_code || body?.code;
  const msg = body?.msg || body?.error_description || body?.message || body?.error || '';
  if (code === 'invalid_grant' || /invalid login credentials/i.test(msg)) {
    return 'Credenciais inválidas. Verifique email e senha.';
  }
  if (code === 'email_not_confirmed') {
    return 'Email não confirmado. Verifique sua caixa de entrada.';
  }
  if (code === 'user_not_found') {
    return 'Usuário não encontrado.';
  }
  if (code === 'over_email_send_rate_limit') {
    return 'Muitas tentativas. Aguarde alguns minutos.';
  }
  return msg ? `Falha no login: ${msg}` : 'Falha no login.';
}

export async function login(email, senha) {
  const client = getClient();
  if (!client) return { error: 'Supabase não configurado' };

  // Supabase Auth: grant_type=password valida o bcrypt do auth.users.
  let body;
  try {
    const res = await fetch(`${client.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': client.key, 'Authorization': `Bearer ${client.key}` },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password: senha }),
    });
    body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = mapearErroLogin(body);
      registrarLog(LOG_ACTIONS.LOGIN_FALHA, { email, motivo: msg });
      return { error: msg };
    }
  } catch {
    registrarLog(LOG_ACTIONS.LOGIN_FALHA, { email, motivo: 'erro de conexão' });
    return { error: 'Erro ao conectar ao servidor de autenticação.' };
  }

  const session = {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: body.expires_at || Math.floor(Date.now() / 1000) + (body.expires_in || 3600),
  };
  setSession(session);

  const { data: usuarios, error: errUsuarios } = await supabaseQuery('usuarios', {
    select: 'id,nome,email,matricula,perfil_id,ativo',
    filters: [{ col: 'auth_user_id', val: body.user?.id }],
  });
  const user = Array.isArray(usuarios) && usuarios.length ? usuarios[0] : null;

  if (errUsuarios || !user) {
    clearSession();
    clearUser();
    registrarLog(LOG_ACTIONS.LOGIN_FALHA, { email, motivo: 'perfil não encontrado' });
    return { error: 'Usuário sem perfil no sistema. Contate o administrador.' };
  }
  if (!user.ativo) {
    clearSession();
    clearUser();
    registrarLog(LOG_ACTIONS.LOGIN_FALHA, { email, motivo: 'aguardando ativação' });
    return { error: 'Usuário aguardando ativação. Contate o administrador.' };
  }

  const { data: perfis } = await supabaseQuery('perfis', {
    select: 'id,nome',
    filters: [{ col: 'id', val: user.perfil_id }]
  });

  const perfilNome = perfis?.[0]?.nome || 'Professor';

  const SESSION_DURATION_MS = 4 * 60 * 60 * 1000;

  const userData = {
    id: user.id,
    nome: user.nome,
    email: user.email,
    matricula: user.matricula,
    perfil: perfilNome,
    perfil_id: user.perfil_id,
    expiresAt: Date.now() + SESSION_DURATION_MS
  };

  setUser(userData);
  registrarLog(LOG_ACTIONS.LOGIN, { email, perfil: perfilNome });
  return { user: userData, error: null };
}

export async function listarPerfis() {
  const { data: perfis, error } = await supabaseQuery('perfis', { select: 'id,nome', order: 'id' });
  if (error) return { data: [], error };
  return { data: perfis || [], error: null };
}

export async function register(nome, email, matricula, senha, perfilId) {
  const { data, error } = await supabaseRpc('registrar_usuario', {
    p_nome: nome,
    p_email: email,
    p_matricula: matricula,
    p_senha: senha,
    p_perfil_id: perfilId,
  });

  if (error) {
    registrarLog(LOG_ACTIONS.CADASTRO, { email, matricula, motivo: 'erro ao cadastrar' });
    return { error: 'Erro ao cadastrar: ' + error };
  }

  const res = Array.isArray(data) && data.length ? data[0] : null;
  if (!res || !res.success) {
    registrarLog(LOG_ACTIONS.CADASTRO, { email, matricula, motivo: res?.error || 'negado' });
    return { error: res?.error || 'Erro ao cadastrar' };
  }

  registrarLog(LOG_ACTIONS.CADASTRO, { email, matricula, perfil: String(perfilId), ativadoAutomaticamente: res.ativado_automaticamente });
  return { success: true, ativadoAutomaticamente: res.ativado_automaticamente, error: null };
}

export async function listarUsuarios() {
  const { data: usuarios, error } = await supabaseQuery('usuarios', {
    select: 'id,nome,email,matricula,perfil_id,ativo,created_at'
  });
  if (error) return { data: [], error };

  const { data: perfis } = await supabaseQuery('perfis', { select: 'id,nome' });
  const pMap = {};
  (perfis || []).forEach(p => pMap[p.id] = p.nome);

  const data = (usuarios || []).map(u => ({
    ...u,
    perfil: pMap[u.perfil_id] || 'Desconhecido'
  }));
  return { data, error: null };
}

export async function atualizarUsuario(id, campos) {
  const { data, error } = await supabaseRpc('atualizar_usuario', {
    p_id: Number(id),
    p_perfil_id: campos.perfil_id != null ? Number(campos.perfil_id) : null,
    p_ativo: campos.ativo != null ? Boolean(campos.ativo) : null,
  });
  if (error) return { error };
  const res = Array.isArray(data) && data.length ? data[0] : null;
  return { error: res && res.error ? res.error : null };
}

export async function excluirUsuario(id) {
  const { data, error } = await supabaseRpc('excluir_usuario', { p_id: Number(id) });
  if (error) return { error };
  const res = Array.isArray(data) && data.length ? data[0] : null;
  return { error: res && res.error ? res.error : null };
}

export async function resetarSenha(id, novaSenha) {
  const { data, error } = await supabaseRpc('resetar_senha', {
    p_id: Number(id),
    p_nova_senha: novaSenha,
  });
  if (error) return { error };
  const res = Array.isArray(data) && data.length ? data[0] : null;
  return { error: res && res.error ? res.error : null };
}

export async function validarSessao() {
  const { data, error, status } = await supabaseRpc('validar_sessao', {});
  if (error) {
    const fatal = status === 401 || status === 403 || status === 404;
    return { user: null, error, fatal };
  }
  const res = Array.isArray(data) && data.length ? data[0] : null;
  return { user: res || null, error: null, fatal: false };
}

// Fluxo "Esqueci minha senha" (Supabase Auth, fluxo implicit):
// 1) recuperarSenha dispara o e-mail de recuperação (POST /auth/v1/recover).
// 2) O link do e-mail redireciona para <site>#access_token=...&type=recovery.
// 3) redefinirSenha troca a senha com a sessão recém-obtida (PUT /auth/v1/update).
export async function recuperarSenha(email) {
  const client = getClient();
  if (!client) return { error: 'Supabase não configurado' };
  try {
    const res = await fetch(`${client.url}/auth/v1/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': client.key, 'Authorization': `Bearer ${client.key}` },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    if (res.ok) return { error: null };
    const body = await res.json().catch(() => ({}));
    return { error: body?.msg || body?.error_description || 'Erro ao solicitar a recuperação de senha.' };
  } catch {
    return { error: 'Erro ao conectar ao servidor de autenticação.' };
  }
}

export async function redefinirSenha(novaSenha) {
  const client = getClient();
  const token = getAuthToken();
  if (!client || !token) return { error: 'Sessão inválida. Solicite um novo link de recuperação.' };
  try {
    const res = await fetch(`${client.url}/auth/v1/update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'apikey': client.key, 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ password: novaSenha }),
    });
    if (res.ok) return { error: null };
    const body = await res.json().catch(() => ({}));
    return { error: body?.msg || body?.error_description || 'Erro ao redefinir a senha.' };
  } catch {
    return { error: 'Erro ao conectar ao servidor de autenticação.' };
  }
}

export async function logout() {
  const user = getCurrentUser();
  registrarLog(LOG_ACTIONS.LOGOUT, { email: user?.email });
  const client = getClient();
  const token = getAuthToken();
  if (client && token) {
    try {
      await fetch(`${client.url}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'apikey': client.key, 'Authorization': `Bearer ${token}` },
      });
    } catch {}
  }
  clearSession();
  clearUser();
  try {
    const { clearFilterCache } = await import('../components/FilterPanel.js');
    clearFilterCache();
  } catch {}
  window.location.hash = '#login';
  window.location.reload();
}

export function getCurrentUser() {
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

export function isAdmin() {
  const user = getCurrentUser();
  return user?.perfil === 'Administrador';
}

export function isGestao() {
  const user = getCurrentUser();
  return user?.perfil === 'Gestao Escolar' || user?.perfil === 'Administrador';
}

export function isProfessor() {
  const user = getCurrentUser();
  return user?.perfil === 'Professor';
}

export function isProfessorAee() {
  const user = getCurrentUser();
  return user?.perfil === 'Professor do AEE';
}

export function isProfessorLike() {
  return isProfessor() || isProfessorAee();
}

let professorVinculo = null;

export async function getProfessorVinculo() {
  if (professorVinculo) return professorVinculo;
  const user = getCurrentUser();
  if (!user || (user.perfil !== 'Professor' && user.perfil !== 'Professor do AEE')) return null;

  const norm = s => String(s ?? '').trim().replace(/[^\d]/g, '').replace(/^0+/, '');
  const userMat = norm(user.matricula);

  const { data: professores } = await supabaseQuery('professores', {
    select: 'id,id_pessoa,matricula,nome'
  });
  const prof = (professores || []).find(p => userMat && norm(p.matricula) === userMat);
  if (!prof) return null;

  const { data: alocacoes } = await supabaseQuery('alocacoes', {
    select: 'id,turma_id,componente_id',
    filters: [{ col: 'professor_id', val: prof.id }]
  });

  const { data: conselheiroRes } = await supabaseQuery('turma_conselheiros', {
    select: 'id_turma',
    filters: [{ col: 'id_pessoa', val: prof.id_pessoa }]
  });

  const turmasConselheiroExt = new Set((conselheiroRes || []).map(c => c.id_turma));

  const { data: turmas } = await supabaseQuery('turmas', {
    select: 'id,id_turma,nome,serie_id,turno'
  });

  const turmasConselheiro = new Set(
    (turmas || [])
      .filter(t => turmasConselheiroExt.has(t.id_turma))
      .map(t => t.id)
  );

  const turmaIds = [
    ...new Set([
      ...(alocacoes || []).map(a => a.turma_id),
      ...turmasConselheiro,
    ])
  ];
  const compIds = [...new Set((alocacoes || []).map(a => a.componente_id))];

  const { data: series } = await supabaseQuery('series', {
    select: 'id,nome,etapa_ensino_id'
  });

  const turmasFiltradas = (turmas || []).filter(t => turmaIds.includes(t.id));
  const serieIds = [...new Set(turmasFiltradas.map(t => t.serie_id))];
  const seriesFiltradas = (series || []).filter(s => serieIds.includes(s.id));

  professorVinculo = {
    id: prof.id,
    id_pessoa: prof.id_pessoa,
    nome: prof.nome,
    matricula: prof.matricula,
    turmaIds,
    compIds,
    serieIds,
    turmasConselheiro,
    turmas: turmasFiltradas,
    series: seriesFiltradas,
  };
  return professorVinculo;
}

export function clearProfessorCache() {
  professorVinculo = null;
}

// Para o perfil Professor do AEE, verifica se existem estudantes com NEE
// vinculados ao cadastro do professor (tabela estudante_professores_aee).
// Retorna true/false para Professor do AEE e null para os demais perfis.
export async function temEstudantesAeeVinculados() {
  const user = getCurrentUser();
  if (!user || user.perfil !== 'Professor do AEE') return null;
  const vinculo = await getProfessorVinculo();
  if (!vinculo) return false;
  const { data: aee } = await supabaseFetchAll('estudante_professores_aee', {
    select: 'estudante_id',
    filters: [{ col: 'professor_id', val: vinculo.id }],
  });
  return (aee || []).length > 0;
}
