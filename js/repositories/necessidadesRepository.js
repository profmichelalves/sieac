import { supabaseQuery, supabaseFetchAll, supabaseRpc } from '../services/supabase.js';
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

// Professores do AEE disponíveis para vínculo: usuários cadastrados com o
// perfil 'Professor do AEE' (perfil_id = 4), independentes de estarem na
// tabela `professores`.
export async function listarProfessoresParaAEE() {
  const { data: usuarios, error } = await supabaseQuery('usuarios', {
    select: 'id,nome,matricula',
    filters: [{ col: 'perfil_id', val: 4 }],
    order: 'nome',
    limit: 1000,
  });
  return { data: (usuarios || []).map(u => ({ id: u.id, nome: u.nome, matricula: u.matricula || '-' })), error };
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
  const [{ data: necessidades }, { data: tipos }, { data: aee }, { data: usuarios }] = await Promise.all([
    supabaseFetchAll('estudante_necessidades', { select: 'estudante_id_pessoa,tipo_necessidade_id' }),
    supabaseFetchAll('tipo_necessidades', { select: 'id,nome' }),
    supabaseFetchAll('estudante_professores_aee', { select: 'estudante_id_pessoa,professor_usuario_id' }),
    supabaseFetchAll('usuarios', { select: 'id,nome,matricula' }),
  ]);

  const tipoNome = {};
  (tipos || []).forEach(t => { tipoNome[t.id] = t.nome; });

  const necessidadesPorEstudante = {};
  (necessidades || []).forEach(n => {
    if (!necessidadesPorEstudante[n.estudante_id_pessoa]) necessidadesPorEstudante[n.estudante_id_pessoa] = [];
    const nome = tipoNome[n.tipo_necessidade_id];
    if (nome) necessidadesPorEstudante[n.estudante_id_pessoa].push(nome);
  });

  const usrMap = {};
  (usuarios || []).forEach(u => { if (u.id != null) usrMap[u.id] = u; });

  const aeePorEstudante = {};
  (aee || []).forEach(a => {
    const u = usrMap[a.professor_usuario_id];
    aeePorEstudante[a.estudante_id_pessoa] = u ? { professor_usuario_id: u.id, nome: u.nome, matricula: u.matricula || '-' } : null;
  });

  return { necessidadesPorEstudante, aeePorEstudante };
}

export async function getNecessidadesEstudante(estudanteIdPessoa) {
  const { data: tiposRel } = await supabaseFetchAll('estudante_necessidades', {
    select: 'tipo_necessidade_id',
    filters: [{ col: 'estudante_id_pessoa', val: estudanteIdPessoa }],
  });
  const { data: tipos } = await supabaseFetchAll('tipo_necessidades', { select: 'id,nome' });
  const tipoMap = {};
  (tipos || []).forEach(t => { tipoMap[t.id] = t.nome; });

  const { data: aee } = await supabaseFetchAll('estudante_professores_aee', {
    select: 'professor_usuario_id',
    filters: [{ col: 'estudante_id_pessoa', val: estudanteIdPessoa }],
    limit: 5,
  });

  let professorAee = null;
  if (aee && aee.length) {
    const { data: usuarios } = await supabaseQuery('usuarios', {
      select: 'id,nome,matricula',
      filters: [{ col: 'id', val: aee[0].professor_usuario_id }],
    });
    if (usuarios && usuarios.length) {
      const p = usuarios[0];
      professorAee = { professor_usuario_id: p.id, nome: p.nome, matricula: p.matricula || '-' };
    }
  }

  return {
    tipos: (tiposRel || []).map(t => tipoMap[t.tipo_necessidade_id]).filter(Boolean),
    professorAee,
  };
}

export async function listarEstudantesCadastro({ turmaId = null, nome = '' } = {}) {
  const [{ data: estudantes }, turmasMap, { necessidadesPorEstudante, aeePorEstudante }] = await Promise.all([
    supabaseFetchAll('estudantes', { select: 'id,id_pessoa,nome,matricula' }),
    getTurmasPorEstudanteMap(),
    getNecessidadesMaps(),
  ]);

  const q = norm(nome);
  const filtroTurma = turmaId ? String(turmaId) : null;

  return (estudantes || [])
    .filter(e => !String(e.nome || '').trim().startsWith('__'))
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
        id_pessoa: e.id_pessoa,
        nome: e.nome,
        matricula: e.matricula || '-',
        turmas,
        necessidades: necessidadesPorEstudante[e.id_pessoa] || [],
        professorAee: aeePorEstudante[e.id_pessoa] || null,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function salvarNecessidadesEstudante(estudanteIdPessoa, tipoIds = [], professorUsuarioId = null) {
  const tiposUnicos = [...new Set(tipoIds.map(Number).filter(id => id))];

  const { data, error } = await supabaseRpc('salvar_necessidades', {
    p_estudante_id_pessoa: Number(estudanteIdPessoa),
    p_tipo_ids: tiposUnicos,
    p_professor_usuario_id: professorUsuarioId ? Number(professorUsuarioId) : null,
  });

  if (error) return { error };

  const res = Array.isArray(data) && data.length ? data[0] : null;
  if (res && res.error) return { error: res.error };

  return { error: null };
}

// Relatório de Estudantes com NEE: apenas estudantes com pelo menos uma necessidade.
// Professores enxergam apenas os estudantes das suas turmas; demais perfis, todos.
export async function listarEstudantesNEE() {
  const [{ data: estudantes }, turmasMap, { necessidadesPorEstudante, aeePorEstudante }, permitidos] = await Promise.all([
    supabaseFetchAll('estudantes', { select: 'id,id_pessoa,nome,matricula' }),
    getTurmasPorEstudanteMap(),
    getNecessidadesMaps(),
    getEstudantesPermitidos(),
  ]);

  return (estudantes || [])
    .filter(e => !String(e.nome || '').trim().startsWith('__'))
    .filter(e => {
      const needs = necessidadesPorEstudante[e.id_pessoa];
      if (!needs || !needs.length) return false;
      if (permitidos && !permitidos.has(Number(e.id))) return false;
      return true;
    })
    .map(e => {
      const turmas = [...(turmasMap.get(Number(e.id)) || [])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const prof = aeePorEstudante[e.id_pessoa];
      return {
        id: e.id,
        id_pessoa: e.id_pessoa,
        nome: e.nome,
        matricula: e.matricula || '-',
        turmas,
        necessidades: necessidadesPorEstudante[e.id_pessoa],
        professorAee: prof || null,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
