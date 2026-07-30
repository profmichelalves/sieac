import { rest, supabaseQuery, supabaseUpsert } from './supabase.js';
import { setUser, clearUser, showToast } from '../utils/helpers.js';

export async function login(email, senha) {
  const { data: usuarios, error } = await supabaseQuery('usuarios', {
    select: 'id,nome,email,matricula,perfil_id,ativo,senha_hash',
    filters: [{ col: 'email', val: email }]
  });

  if (error) return { error: 'Erro ao conectar ao banco' };
  if (!usuarios || usuarios.length === 0) return { error: 'Usuário não encontrado' };

  const user = usuarios[0];
  if (!user.ativo) return { error: 'Usuário aguardando ativação. Contate o administrador.' };

  const { data: perfis } = await supabaseQuery('perfis', {
    select: 'id,nome',
    filters: [{ col: 'id', val: user.perfil_id }]
  });

  const perfilNome = perfis?.[0]?.nome || 'Professor';

  const senhaMatch = senha === user.senha_hash;
  if (!senhaMatch) return { error: 'Senha incorreta' };

  const userData = {
    id: user.id,
    nome: user.nome,
    email: user.email,
    matricula: user.matricula,
    perfil: perfilNome,
    perfil_id: user.perfil_id
  };

  setUser(userData);
  return { user: userData, error: null };
}

export async function register(nome, email, matricula, senha) {
  const { data: existentes } = await supabaseQuery('usuarios', {
    select: 'id,email,matricula',
    filters: [{ col: 'email', val: email }]
  });

  if (existentes && existentes.length > 0) {
    return { error: 'Este email já está cadastrado. Faça login ou use outro email.' };
  }

  const { data: perfis } = await supabaseQuery('perfis', {
    select: 'id', filters: [{ col: 'nome', val: 'Professor' }]
  });

  const perfilProfessor = perfis?.[0]?.id || 3;

  const newUser = {
    nome,
    email,
    matricula,
    senha_hash: senha,
    perfil_id: perfilProfessor,
    ativo: false
  };

  const { data, error } = await supabaseUpsert('usuarios', [newUser]);
  if (error) return { error: 'Erro ao cadastrar: ' + error };
  return { success: true, error: null };
}

export async function listarUsuarios() {
  const { data: usuarios, error } = await supabaseQuery('usuarios', {
    select: 'id,nome,email,matricula,perfil_id,ativo'
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
  const { error } = await rest.patch(`/rest/v1/usuarios?id=eq.${id}`, campos);
  return { error };
}

export function logout() {
  clearUser();
  window.location.hash = '#login';
  window.location.reload();
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('sieac_user'));
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

let professorVinculo = null;

export async function getProfessorVinculo() {
  if (professorVinculo) return professorVinculo;
  const user = getCurrentUser();
  if (!user || user.perfil !== 'Professor') return null;

  const { data: professores } = await supabaseQuery('professores', {
    select: 'id,matricula,nome',
    filters: [{ col: 'matricula', val: user.matricula }]
  });
  if (!professores || !professores.length) {
    const { data: all } = await supabaseQuery('professores', {
      select: 'id,matricula,nome', limit: 100
    });
    return null;
  }

  const prof = professores[0];
  const { data: alocacoes } = await supabaseQuery('alocacoes', {
    select: 'id,turma_id,componente_id',
    filters: [{ col: 'professor_id', val: prof.id }]
  });

  const turmaIds = [...new Set((alocacoes || []).map(a => a.turma_id))];
  const compIds = [...new Set((alocacoes || []).map(a => a.componente_id))];

  const { data: turmas } = await supabaseQuery('turmas', {
    select: 'id,nome,serie_id,turno'
  });
  const { data: series } = await supabaseQuery('series', {
    select: 'id,nome,etapa_ensino_id'
  });

  const turmasFiltradas = (turmas || []).filter(t => turmaIds.includes(t.id));
  const serieIds = [...new Set(turmasFiltradas.map(t => t.serie_id))];
  const seriesFiltradas = (series || []).filter(s => serieIds.includes(s.id));

  professorVinculo = {
    id: prof.id,
    nome: prof.nome,
    matricula: prof.matricula,
    turmaIds,
    compIds,
    serieIds,
    turmas: turmasFiltradas,
    series: seriesFiltradas,
  };
  return professorVinculo;
}

export function clearProfessorCache() {
  professorVinculo = null;
}
