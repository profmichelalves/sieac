import { rest, supabaseQuery, supabaseFetchAll, supabaseUpsert } from './supabase.js';
import { setUser, clearUser, showToast } from '../utils/helpers.js';
import { registrarLog, LOG_ACTIONS } from './logService.js';

export async function login(email, senha) {
  const { data: usuarios, error } = await supabaseQuery('usuarios', {
    select: 'id,nome,email,matricula,perfil_id,ativo,senha_hash',
    filters: [{ col: 'email', val: email }]
  });

  if (error) {
    registrarLog(LOG_ACTIONS.LOGIN_FALHA, { email, motivo: 'erro de conexão' });
    return { error: 'Erro ao conectar ao banco' };
  }
  if (!usuarios || usuarios.length === 0) {
    registrarLog(LOG_ACTIONS.LOGIN_FALHA, { email, motivo: 'usuário não encontrado' });
    return { error: 'Usuário não encontrado' };
  }

  const user = usuarios[0];
  if (!user.ativo) {
    registrarLog(LOG_ACTIONS.LOGIN_FALHA, { email, motivo: 'aguardando ativação' });
    return { error: 'Usuário aguardando ativação. Contate o administrador.' };
  }

  const { data: perfis } = await supabaseQuery('perfis', {
    select: 'id,nome',
    filters: [{ col: 'id', val: user.perfil_id }]
  });

  const perfilNome = perfis?.[0]?.nome || 'Professor';

  const senhaMatch = senha === user.senha_hash;
  if (!senhaMatch) {
    registrarLog(LOG_ACTIONS.LOGIN_FALHA, { email, motivo: 'senha incorreta' });
    return { error: 'Senha incorreta' };
  }

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
  const normMatricula = s => String(s ?? '').trim().replace(/[^\d]/g, '').replace(/^0+/, '');

  const { data: existentes } = await supabaseQuery('usuarios', {
    select: 'id,email,matricula',
    filters: [{ col: 'email', val: email }]
  });

  if (existentes && existentes.length > 0) {
    return { error: 'Este email já está cadastrado. Faça login ou use outro email.' };
  }

  const { data: usuariosMatriculas } = await supabaseFetchAll('usuarios', { select: 'id,email,matricula' });
  const matriculaNormalizada = normMatricula(matricula);
  const duplicado = (usuariosMatriculas || []).find(u => matriculaNormalizada && normMatricula(u.matricula) === matriculaNormalizada);

  if (duplicado) {
    return { error: 'Já existe um usuário cadastrado com esta matrícula.' };
  }

  const { data: perfis } = await supabaseQuery('perfis', {
    select: 'id,nome'
  });
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const permitidos = new Set(['professor', 'professor do aee', 'gestao escolar']);

  const escolhido = (perfis || []).find(p => p.id === Number(perfilId));
  const perfilValido = escolhido && permitidos.has(norm(escolhido.nome)) ? escolhido.id : null;
  const perfilFinal = perfilValido || (perfis || []).find(p => norm(p.nome) === 'professor')?.id || 3;

  const perfilNomeFinal = norm((perfis || []).find(p => p.id === perfilFinal)?.nome || '');
  const eProfessorOuAee = ['professor', 'professor do aee'].includes(perfilNomeFinal);
  let professorEncontrado = null;
  if (eProfessorOuAee) {
    const { data: professores } = await supabaseFetchAll('professores', { select: 'id,matricula,nome' });
    professorEncontrado = (professores || []).find(p => matriculaNormalizada && normMatricula(p.matricula) === matriculaNormalizada) || null;
    if (!professorEncontrado) {
      registrarLog(LOG_ACTIONS.CADASTRO, { email, matricula, motivo: 'matrícula não encontrada na tabela de professores' });
      return { error: 'Matrícula não encontrada na tabela de professores. Cadastro não permitido.' };
    }
  }

  const normNome = s => norm(String(s || '').trim().replace(/\s+/g, ' '));
  const nomeConfere = professorEncontrado && normNome(nome) === normNome(professorEncontrado.nome);
  const ativadoAutomaticamente = eProfessorOuAee && nomeConfere;

  const newUser = {
    nome,
    email,
    matricula,
    senha_hash: senha,
    perfil_id: perfilFinal,
    ativo: ativadoAutomaticamente
  };

  const { data, error } = await supabaseUpsert('usuarios', [newUser]);
  if (error) {
    registrarLog(LOG_ACTIONS.CADASTRO, { email, matricula, motivo: 'erro ao inserir' });
    return { error: 'Erro ao cadastrar: ' + error };
  }
  registrarLog(LOG_ACTIONS.CADASTRO, {
    email,
    matricula,
    perfil: norm((perfis || []).find(p => p.id === perfilFinal)?.nome || ''),
    ativadoAutomaticamente,
    professorEncontrado: !!professorEncontrado,
    nomeConfere
  });
  return { success: true, ativadoAutomaticamente, error: null };
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
  const { error } = await rest.patch(`/rest/v1/usuarios?id=eq.${id}`, campos);
  return { error };
}

export async function logout() {
  const user = getCurrentUser();
  registrarLog(LOG_ACTIONS.LOGOUT, { email: user?.email });
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
