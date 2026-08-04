import { supabaseQuery, supabaseFetchAll, supabaseUpsert, supabaseDelete } from '../services/supabase.js';
import { getRefCache, getEstudantesPermitidos } from './dashboardRepository.js';

const norm = s => String(s ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

let turmasPorEstudanteCache = null;

export function clearCache() {
  turmasPorEstudanteCache = null;
}

export async function listarTiposNecessidades() {
  const { data, error } = await supabaseQuery('tipo_necessidades', { select: 'id,nome', order: 'nome' });
  return { data: data || [], error };
}

export async function listarProfessoresParaAEE() {
  const { data, error } = await supabaseQuery('professores', {
    select: 'id,nome,matricula',
    order: 'nome',
    limit: 1000,
  });
  return { data: (data || []).map(p => ({ id: p.id, nome: p.nome, matricula: p.matricula || '-' })), error };
}

async function getTurmasPorEstudanteMap() {
  if (turmasPorEstudanteCache) return turmasPorEstudanteCache;
  await getRefCache();

  const { data: notas } = await supabaseFetchAll('notas', { select: 'estudante_id,alocacao_id' });
  const { data: freqs } = await supabaseFetchAll('frequencias', { select: 'estudante_id,turma_id' });

  const turmaNome = {};
  (await getRefCache()).turmas.forEach(t => { turmaNome[t.id] = t.nome; });
  const alocTurma = {};
  (await getRefCache()).alocacoes.forEach(a => { alocTurma[a.id] = a.turma_id; });

  const map = new Map();
  const add = (estudanteId, turmaId) => {
    const nome = turmaNome[turmaId];
    if (!nome) return;
    if (!map.has(Number(estudanteId))) map.set(Number(estudanteId), new Set());
    map.get(Number(estudanteId)).add(nome);
  };

  (notas || []).forEach(n => {
    const tId = alocTurma[n.alocacao_id];
    if (tId != null) add(n.estudante_id, tId);
  });
  (freqs || []).forEach(f => { add(f.estudante_id, f.turma_id); });

  turmasPorEstudanteCache = map;
  return map;
}

async function getNecessidadesMaps() {
  const [{ data: necessidades }, { data: tipos }, { data: aee }, { data: professores }] = await Promise.all([
    supabaseFetchAll('estudante_necessidades', { select: 'estudante_id,tipo_necessidade_id' }),
    supabaseFetchAll('tipo_necessidades', { select: 'id,nome' }),
    supabaseFetchAll('estudante_professores_aee', { select: 'estudante_id,professor_id' }),
    supabaseFetchAll('professores', { select: 'id,nome,matricula' }),
  ]);

  const tipoNome = {};
  (tipos || []).forEach(t => { tipoNome[t.id] = t.nome; });

  const necessidadesPorEstudante = {};
  (necessidades || []).forEach(n => {
    if (!necessidadesPorEstudante[n.estudante_id]) necessidadesPorEstudante[n.estudante_id] = [];
    const nome = tipoNome[n.tipo_necessidade_id];
    if (nome) necessidadesPorEstudante[n.estudante_id].push(nome);
  });

  const profMap = {};
  (professores || []).forEach(p => { profMap[p.id] = p; });

  const aeePorEstudante = {};
  (aee || []).forEach(a => {
    const p = profMap[a.professor_id];
    aeePorEstudante[a.estudante_id] = p ? { professor_id: p.id, nome: p.nome, matricula: p.matricula || '-' } : null;
  });

  return { necessidadesPorEstudante, aeePorEstudante };
}

export async function getNecessidadesEstudante(estudanteId) {
  const { data: tiposRel } = await supabaseFetchAll('estudante_necessidades', {
    select: 'tipo_necessidade_id',
    filters: [{ col: 'estudante_id', val: estudanteId }],
  });
  const { data: tipos } = await supabaseFetchAll('tipo_necessidades', { select: 'id,nome' });
  const tipoMap = {};
  (tipos || []).forEach(t => { tipoMap[t.id] = t.nome; });

  const { data: aee } = await supabaseFetchAll('estudante_professores_aee', {
    select: 'professor_id',
    filters: [{ col: 'estudante_id', val: estudanteId }],
    limit: 5,
  });

  let professorAee = null;
  if (aee && aee.length) {
    const { data: professores } = await supabaseQuery('professores', {
      select: 'id,nome,matricula',
      filters: [{ col: 'id', val: aee[0].professor_id }],
    });
    if (professores && professores.length) {
      const p = professores[0];
      professorAee = { professor_id: p.id, nome: p.nome, matricula: p.matricula || '-' };
    }
  }

  return {
    tipos: (tiposRel || []).map(t => tipoMap[t.tipo_necessidade_id]).filter(Boolean),
    professorAee,
  };
}

export async function listarEstudantesCadastro({ turmaId = null, nome = '' } = {}) {
  const [{ data: estudantes }, turmasMap, { necessidadesPorEstudante, aeePorEstudante }] = await Promise.all([
    supabaseFetchAll('estudantes', { select: 'id,nome,matricula' }),
    getTurmasPorEstudanteMap(),
    getNecessidadesMaps(),
  ]);

  const q = norm(nome);
  const filtroTurma = turmaId ? String(turmaId) : null;

  return (estudantes || [])
    .filter(e => {
      if (filtroTurma) {
        const turmas = turmasMap.get(Number(e.id));
        if (!turmas || !turmas.has(filtroTurma)) return false;
      }
      if (q && !norm(e.nome).includes(q)) return false;
      return true;
    })
    .map(e => {
      const turmas = [...(turmasMap.get(Number(e.id)) || [])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      return {
        id: e.id,
        nome: e.nome,
        matricula: e.matricula || '-',
        turmas,
        necessidades: necessidadesPorEstudante[e.id] || [],
        professorAee: aeePorEstudante[e.id] || null,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function salvarNecessidadesEstudante(estudanteId, tipoIds = [], professorId = null) {
  const tiposUnicos = [...new Set(tipoIds.map(Number).filter(id => id))];

  const { error: errDelete } = await supabaseDelete('estudante_necessidades', 'estudante_id', estudanteId);
  if (errDelete) return { error: errDelete };

  if (tiposUnicos.length) {
    const rows = tiposUnicos.map(tipoId => ({ estudante_id: Number(estudanteId), tipo_necessidade_id: tipoId }));
    const { error: errInsert } = await supabaseUpsert('estudante_necessidades', rows, 'estudante_id,tipo_necessidade_id');
    if (errInsert) return { error: errInsert };
  }

  if (professorId) {
    const { error: errAee } = await supabaseUpsert(
      'estudante_professores_aee',
      [{ estudante_id: Number(estudanteId), professor_id: Number(professorId) }],
      'estudante_id'
    );
    if (errAee) return { error: errAee };
  } else {
    const { error: errAeeDel } = await supabaseDelete('estudante_professores_aee', 'estudante_id', estudanteId);
    if (errAeeDel) return { error: errAeeDel };
  }

  return { error: null };
}

// Relatório de Estudantes com NEE: apenas estudantes com pelo menos uma necessidade.
// Professores enxergam apenas os estudantes das suas turmas; demais perfis, todos.
export async function listarEstudantesNEE() {
  const [{ data: estudantes }, turmasMap, { necessidadesPorEstudante, aeePorEstudante }, permitidos] = await Promise.all([
    supabaseFetchAll('estudantes', { select: 'id,nome,matricula' }),
    getTurmasPorEstudanteMap(),
    getNecessidadesMaps(),
    getEstudantesPermitidos(),
  ]);

  return (estudantes || [])
    .filter(e => {
      const needs = necessidadesPorEstudante[e.id];
      if (!needs || !needs.length) return false;
      if (permitidos && !permitidos.has(Number(e.id))) return false;
      return true;
    })
    .map(e => {
      const turmas = [...(turmasMap.get(Number(e.id)) || [])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const prof = aeePorEstudante[e.id];
      return {
        id: e.id,
        nome: e.nome,
        matricula: e.matricula || '-',
        turmas,
        necessidades: necessidadesPorEstudante[e.id],
        professorAee: prof || null,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
