import { supabaseQuery, supabaseRpc } from './supabase.js';
import { registrarLog, LOG_ACTIONS } from './logService.js';

// Lista as turmas com o Professor Conselheiro vinculado (via turma_conselheiros).
// O vínculo usa os identificadores externos id_turma e id_pessoa, por isso o
// join é feito por essas colunas e não pelas chaves internas.
export async function listarTurmasComConselheiro() {
  const [tRes, sRes, pRes, cRes] = await Promise.all([
    supabaseQuery('turmas', { select: 'id,id_turma,nome,serie_id,turno', order: 'nome' }),
    supabaseQuery('series', { select: 'id,nome' }),
    supabaseQuery('professores', { select: 'id,id_pessoa,nome', order: 'nome' }),
    supabaseQuery('turma_conselheiros', { select: 'id_turma,id_pessoa' }),
  ]);

  const series = sRes.data || [];
  const professores = pRes.data || [];
  const conselheiros = cRes.data || [];
  const serieMap = {};
  series.forEach(s => { serieMap[s.id] = s.nome; });
  const profMap = {};
  professores.forEach(p => { profMap[p.id_pessoa] = p; });
  const consByIdTurma = {};
  conselheiros.forEach(c => { consByIdTurma[c.id_turma] = c.id_pessoa; });

  return (tRes.data || [])
    .map(t => {
      const idPessoa = consByIdTurma[t.id_turma];
      const prof = idPessoa != null ? profMap[idPessoa] : null;
      return {
        id: t.id,
        id_turma: t.id_turma,
        nome: t.nome,
        serie: serieMap[t.serie_id] || '',
        turno: t.turno || '',
        id_pessoa: idPessoa != null ? idPessoa : '',
        conselheiro: prof ? prof.nome : '',
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function listarProfessores() {
  const { data, error } = await supabaseQuery('professores', {
    select: 'id,id_pessoa,nome',
    order: 'nome',
  });
  if (error) return { data: [], error };
  return { data: data || [], error: null };
}

// Vincula (ou remove) o Professor Conselheiro de uma turma.
// idPessoa vazio remove o vínculo existente. A escrita é feita pelo RPC
// salvar_conselheiro (SECURITY DEFINER, somente gestão).
export async function salvarConselheiro(idTurma, idPessoa) {
  const idP = idPessoa == null ? '' : String(idPessoa).trim();
  const { data, error } = await supabaseRpc('salvar_conselheiro', {
    p_id_turma: Number(idTurma),
    p_id_pessoa: idP ? Number(idP) : null,
  });
  if (error) return { error };

  const res = Array.isArray(data) && data.length ? data[0] : null;
  if (res && res.error) return { error: res.error };

  registrarLog(LOG_ACTIONS.VINCULAR_CONSELHEIRO, {
    id_turma: idTurma,
    id_pessoa: idP ? Number(idP) : null,
    acao: idP ? 'vincular' : 'remover',
  });
  return { error: null };
}
