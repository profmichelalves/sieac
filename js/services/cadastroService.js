import { supabaseQuery, supabaseRpc } from './supabase.js';

// ===========================================================================
// Leitura (listagens) — as tabelas possuem políticas de SELECT para usuários
// autenticados, então a leitura usa consultas diretas. As mutações (cadastro/
// atualização/exclusão) passam por RPCs SECURITY DEFINER que exigem o perfil
// Administrador (sieac_e_admin()).
// ===========================================================================

export async function listarEtapasEnsino() {
  const { data, error } = await supabaseQuery('etapas_ensino', {
    select: 'id, id_etapa, nome',
    order: 'nome.asc',
  });
  if (error) return { data: [], error };
  return { data: data || [] };
}

export async function listarSeries() {
  const { data, error } = await supabaseQuery('series', {
    select: 'id, id_serie, nome, etapa_ensino_id',
    order: 'nome.asc',
  });
  if (error) return { data: [], error };
  return { data: data || [] };
}

export async function listarTurmas() {
  const { data, error } = await supabaseQuery('turmas', {
    select: 'id, id_turma, nome, serie_id, turno',
    order: 'nome.asc',
  });
  if (error) return { data: [], error };
  return { data: data || [] };
}

export async function listarComponentesCurriculares() {
  const { data, error } = await supabaseQuery('componentes_curriculares', {
    select: 'id, id_componente, nome',
    order: 'nome.asc',
  });
  if (error) return { data: [], error };
  return { data: data || [] };
}

export async function listarProfessoresCadastro() {
  const { data, error } = await supabaseQuery('professores', {
    select: 'id, id_pessoa, matricula, nome',
    order: 'nome.asc',
  });
  if (error) return { data: [], error };
  return { data: data || [] };
}

export async function listarEstudantesCadastro() {
  const { data, error } = await supabaseQuery('estudantes', {
    select: 'id, id_pessoa, matricula, nome',
    order: 'nome.asc',
  });
  if (error) return { data: [], error };
  return { data: data || [] };
}

// ===========================================================================
// Mutações (RPCs)
// ===========================================================================

// Executa uma RPC de mutação normalizando a resposta (array → objeto único).
async function chamarMutacao(functionName, params) {
  const { data, error } = await supabaseRpc(functionName, params);
  if (error) return { error };
  const row = Array.isArray(data) && data.length ? data[0] : data;
  return { data: row || null, error: null };
}

// ---- Etapas de Ensino ----
export const cadastrarEtapaEnsino = (nome) => chamarMutacao('cadastrar_etapa_ensino', { p_nome: nome });
export const atualizarEtapaEnsino = (id, nome) => chamarMutacao('atualizar_etapa_ensino', { p_id: Number(id), p_nome: nome });
export const excluirEtapaEnsino = (id) => chamarMutacao('excluir_etapa_ensino', { p_id: Number(id) });

// ---- Séries ----
export const cadastrarSerie = (nome, etapaId) => chamarMutacao('cadastrar_serie', { p_nome: nome, p_etapa_ensino_id: Number(etapaId) });
export const atualizarSerie = (id, nome, etapaId) => chamarMutacao('atualizar_serie', { p_id: Number(id), p_nome: nome, p_etapa_ensino_id: Number(etapaId) });
export const excluirSerie = (id) => chamarMutacao('excluir_serie', { p_id: Number(id) });

// ---- Turmas ----
export const cadastrarTurma = (nome, serieId, turno) => chamarMutacao('cadastrar_turma', { p_nome: nome, p_serie_id: Number(serieId), p_turno: turno });
export const atualizarTurma = (id, nome, serieId, turno) => chamarMutacao('atualizar_turma', { p_id: Number(id), p_nome: nome, p_serie_id: Number(serieId), p_turno: turno });
export const excluirTurma = (id) => chamarMutacao('excluir_turma', { p_id: Number(id) });

// ---- Disciplinas (Componentes Curriculares) ----
export const cadastrarComponenteCurricular = (nome) => chamarMutacao('cadastrar_componente_curricular', { p_nome: nome });
export const atualizarComponenteCurricular = (id, nome) => chamarMutacao('atualizar_componente_curricular', { p_id: Number(id), p_nome: nome });
export const excluirComponenteCurricular = (id) => chamarMutacao('excluir_componente_curricular', { p_id: Number(id) });

// ---- Professores ----
export const cadastrarProfessor = (nome, matricula) => chamarMutacao('cadastrar_professor', { p_nome: nome, p_matricula: matricula });
export const atualizarProfessor = (id, nome, matricula) => chamarMutacao('atualizar_professor', { p_id: Number(id), p_nome: nome, p_matricula: matricula });
export const excluirProfessor = (id) => chamarMutacao('excluir_professor', { p_id: Number(id) });

// ---- Estudantes ----
export const cadastrarEstudante = (nome, matricula) => chamarMutacao('cadastrar_estudante', { p_nome: nome, p_matricula: matricula });
export const atualizarEstudante = (id, nome, matricula) => chamarMutacao('atualizar_estudante', { p_id: Number(id), p_nome: nome, p_matricula: matricula });
export const excluirEstudante = (id) => chamarMutacao('excluir_estudante', { p_id: Number(id) });

// ===========================================================================
// Lançamento manual de NOTAS e FREQUÊNCIAS (Administrador)
// ===========================================================================

// Opções para o lançamento de notas: turma + disciplina + professor (alocações).
export async function listarOpcoesLancamentoNotas() {
  const { data, error } = await supabaseRpc('listar_opcoes_lancamento_notas');
  if (error) return { data: [], error };
  return { data: data || [] };
}

// Estudantes de uma turma com as notas já lançadas para uma alocação.
export async function listarEstudantesNotas(alocacaoId) {
  const { data, error } = await supabaseRpc('listar_estudantes_notas', { p_alocacao_id: Number(alocacaoId) });
  if (error) return { data: [], error };
  return { data: data || [] };
}

// Lança (upsert) as notas de uma alocação para vários estudantes.
// p_notas: [{ estudante_id, nota_1bim, nota_2bim, nota_3bim, nota_4bim }]
export function lancarNotas(alocacaoId, periodicidade, notas) {
  return chamarMutacao('lancar_notas', { p_alocacao_id: Number(alocacaoId), p_periodicidade: periodicidade, p_notas: notas });
}

// Estudantes de uma turma com a frequência já lançada para um mês.
export async function listarEstudantesFrequencia(turmaId, mesReferencia) {
  const { data, error } = await supabaseRpc('listar_estudantes_frequencia', { p_turma_id: Number(turmaId), p_mes_referencia: mesReferencia });
  if (error) return { data: [], error };
  return { data: data || [] };
}

// Lança (upsert) as frequências de uma turma/mês para vários estudantes.
// p_frequencias: [{ estudante_id, percentual_frequencia }]
export function lancarFrequencias(turmaId, mesReferencia, frequencias) {
  return chamarMutacao('lancar_frequencias', { p_turma_id: Number(turmaId), p_mes_referencia: mesReferencia, p_frequencias: frequencias });
}
