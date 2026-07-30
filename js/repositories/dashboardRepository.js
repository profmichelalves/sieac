import { supabaseQuery } from '../services/supabase.js';

export async function getResumoGeral() {
  const { data: estudantes } = await supabaseQuery('estudantes', { select: 'id' });
  const { data: turmas } = await supabaseQuery('turmas', { select: 'id' });
  const { data: professores } = await supabaseQuery('professores', { select: 'id' });
  const { data: notas } = await supabaseQuery('notas', { select: 'media_final,estudante_id' });
  const { data: frequencias } = await supabaseQuery('frequencias', { select: 'percentual_frequencia' });

  const totalEstudantes = estudantes?.length || 0;
  const totalTurmas = turmas?.length || 0;
  const totalProfessores = professores?.length || 0;

  const alunos = {};
  (notas || []).forEach(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0) return;
    if (!alunos[n.estudante_id]) alunos[n.estudante_id] = { soma: 0, count: 0 };
    alunos[n.estudante_id].soma += mf;
    alunos[n.estudante_id].count++;
  });
  const medias = Object.values(alunos).map(a => a.soma / a.count);
  const mediaGeral = medias.length ? medias.reduce((a, b) => a + b, 0) / medias.length : 0;
  const aprovados = medias.filter(m => m >= 6).length;
  const reprovados = medias.filter(m => m < 6).length;

  let freqMedia = 0;
  if (frequencias?.length) {
    freqMedia = frequencias.reduce((acc, f) => acc + parseFloat(f.percentual_frequencia || 0), 0) / frequencias.length;
  }

  return {
    total_estudantes: totalEstudantes,
    total_turmas: totalTurmas,
    total_professores: totalProfessores,
    media_geral: Math.round(mediaGeral * 10) / 10,
    frequencia_media: Math.round(freqMedia * 10) / 10,
    aprovados,
    reprovados,
  };
}

// Cache de referências para filtragem
let refCache = null;

async function getRefCache() {
  if (refCache) return refCache;
  const [s, t, c, p, se, a] = await Promise.all([
    supabaseQuery('series', { select: 'id,nome' }),
    supabaseQuery('turmas', { select: 'id,nome,serie_id,turno' }),
    supabaseQuery('componentes_curriculares', { select: 'id,nome' }),
    supabaseQuery('professores', { select: 'id,nome' }),
    supabaseQuery('series', { select: 'id,nome' }),
    supabaseQuery('alocacoes', { select: 'id,turma_id,componente_id,professor_id' }),
  ]);
  refCache = {
    series: s.data || [],
    turmas: t.data || [],
    componentes: c.data || [],
    professores: p.data || [],
    alocacoes: a.data || [],
  };
  return refCache;
}

function applyNotaFilters(notas, filters) {
  if (!filters || Object.keys(filters).length === 0) return notas;
  const cache = refCache;
  if (!cache) return notas;

  let alocIds = new Set(cache.alocacoes.map(a => a.id));

  if (filters.serie_id) {
    const turmasSerie = new Set(cache.turmas.filter(t => t.serie_id == filters.serie_id).map(t => t.id));
    const ids = cache.alocacoes.filter(a => turmasSerie.has(a.turma_id)).map(a => a.id);
    alocIds = new Set([...alocIds].filter(id => ids.includes(id)));
  }
  if (filters.turma_id) {
    const ids = cache.alocacoes.filter(a => a.turma_id == filters.turma_id).map(a => a.id);
    alocIds = new Set([...alocIds].filter(id => ids.includes(id)));
  }
  if (filters.componente_id) {
    const ids = cache.alocacoes.filter(a => a.componente_id == filters.componente_id).map(a => a.id);
    alocIds = new Set([...alocIds].filter(id => ids.includes(id)));
  }
  if (filters.professor_id) {
    const ids = cache.alocacoes.filter(a => a.professor_id == filters.professor_id).map(a => a.id);
    alocIds = new Set([...alocIds].filter(id => ids.includes(id)));
  }
  if (filters.turno) {
    const turmasTurno = new Set(cache.turmas.filter(t => t.turno == filters.turno).map(t => t.id));
    const ids = cache.alocacoes.filter(a => turmasTurno.has(a.turma_id)).map(a => a.id);
    alocIds = new Set([...alocIds].filter(id => ids.includes(id)));
  }

  return notas.filter(n => alocIds.has(n.alocacao_id));
}

export async function getMediaPorTurma(filters = {}) {
  await getRefCache();
  const { data: notas } = await supabaseQuery('notas', { select: 'media_final,alocacao_id', limit: 10000 });
  const filtered = applyNotaFilters(notas || [], filters);
  const turmaMap = {}; refCache.turmas.forEach(t => turmaMap[t.id] = t.nome);
  const alocTurma = {}; refCache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);

  const grupos = {};
  filtered.forEach(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0) return;
    const tId = alocTurma[n.alocacao_id];
    const nome = turmaMap[tId] || `Turma ${tId}`;
    if (!grupos[nome]) grupos[nome] = { soma: 0, count: 0 };
    grupos[nome].soma += mf;
    grupos[nome].count++;
  });
  return {
    data: Object.entries(grupos).map(([turma, v]) => ({ turma, media: Math.round((v.soma / v.count) * 10) / 10 })).sort((a, b) => b.media - a.media),
    error: null
  };
}

export async function getMediaPorDisciplina(filters = {}) {
  await getRefCache();
  const { data: notas } = await supabaseQuery('notas', { select: 'media_final,alocacao_id', limit: 10000 });
  const filtered = applyNotaFilters(notas || [], filters);
  const compMap = {}; refCache.componentes.forEach(c => compMap[c.id] = c.nome);
  const alocComp = {}; refCache.alocacoes.forEach(a => alocComp[a.id] = a.componente_id);

  const grupos = {};
  filtered.forEach(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0) return;
    const cId = alocComp[n.alocacao_id];
    const nome = compMap[cId] || `Comp ${cId}`;
    if (!grupos[nome]) grupos[nome] = { soma: 0, count: 0 };
    grupos[nome].soma += mf;
    grupos[nome].count++;
  });
  return {
    data: Object.entries(grupos).map(([disciplina, v]) => ({ disciplina, media: Math.round((v.soma / v.count) * 10) / 10 })).sort((a, b) => b.media - a.media),
    error: null
  };
}

export async function getMediaPorSerie(filters = {}) {
  await getRefCache();
  const { data: notas } = await supabaseQuery('notas', { select: 'media_final,alocacao_id', limit: 10000 });
  const filtered = applyNotaFilters(notas || [], filters);
  const serieMap = {}; refCache.series.forEach(s => serieMap[s.id] = s.nome);
  const turmaSerie = {}; refCache.turmas.forEach(t => turmaSerie[t.id] = t.serie_id);
  const alocTurma = {}; refCache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);

  const grupos = {};
  filtered.forEach(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0) return;
    const tId = alocTurma[n.alocacao_id];
    const sId = turmaSerie[tId];
    const nome = serieMap[sId] || `Série ${sId}`;
    if (!grupos[nome]) grupos[nome] = { soma: 0, count: 0 };
    grupos[nome].soma += mf;
    grupos[nome].count++;
  });
  return {
    data: Object.entries(grupos).map(([serie, v]) => ({ serie, media: Math.round((v.soma / v.count) * 10) / 10 })).sort((a, b) => a.serie.localeCompare(b.serie)),
    error: null
  };
}

export async function getEvolucaoBimestral(filters = {}) {
  await getRefCache();
  const { data: notas } = await supabaseQuery('notas', { select: 'nota_1bim,nota_2bim,nota_3bim,nota_4bim,alocacao_id', limit: 10000 });
  const filtered = applyNotaFilters(notas || [], filters);

  const b1 = [], b2 = [], b3 = [], b4 = [];
  filtered.forEach(n => {
    const v1 = parseFloat(n.nota_1bim); if (!isNaN(v1) && v1 > 0) b1.push(v1);
    const v2 = parseFloat(n.nota_2bim); if (!isNaN(v2) && v2 > 0) b2.push(v2);
    const v3 = parseFloat(n.nota_3bim); if (!isNaN(v3) && v3 > 0) b3.push(v3);
    const v4 = parseFloat(n.nota_4bim); if (!isNaN(v4) && v4 > 0) b4.push(v4);
  });
  const media = arr => arr.length ? Math.round((arr.reduce((a,b) => a+b, 0) / arr.length) * 10) / 10 : 0;
  return { data: { bim1: media(b1), bim2: media(b2), bim3: media(b3), bim4: media(b4) }, error: null };
}

export async function getDistribuicaoNotas(filters = {}) {
  await getRefCache();
  const { data: notas } = await supabaseQuery('notas', { select: 'media_final,alocacao_id', limit: 10000 });
  const filtered = applyNotaFilters(notas || [], filters);

  let excelente = 0, bom = 0, regular = 0, critico = 0;
  filtered.forEach(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0) return;
    if (mf >= 8) excelente++;
    else if (mf >= 6) bom++;
    else if (mf >= 4) regular++;
    else critico++;
  });
  return { data: { excelente, bom, regular, critico }, error: null };
}

export async function getAprovacaoReprovacao(filters = {}) {
  await getRefCache();
  const { data: notas } = await supabaseQuery('notas', { select: 'media_final,exame_final,alocacao_id', limit: 10000 });
  const filtered = applyNotaFilters(notas || [], filters);

  let aprovados = 0, reprovados = 0, recuperacao = 0;
  filtered.forEach(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0) return;
    if (mf >= 6) aprovados++;
    else reprovados++;
    const ef = parseFloat(n.exame_final);
    if (!isNaN(ef) && ef > 0) recuperacao++;
  });
  return { data: { aprovados, reprovados, recuperacao }, error: null };
}

export async function getFrequenciaPorTurma() {
  const { data: freqs } = await supabaseQuery('frequencias', { select: 'percentual_frequencia,turma_id', limit: 10000 });
  const { data: turmas } = await supabaseQuery('turmas', { select: 'id,nome' });
  const tMap = {}; (turmas || []).forEach(t => tMap[t.id] = t.nome);
  const grupos = {};
  (freqs || []).forEach(f => {
    const nome = tMap[f.turma_id] || `Turma ${f.turma_id}`;
    const p = parseFloat(f.percentual_frequencia);
    if (isNaN(p)) return;
    if (!grupos[nome]) grupos[nome] = { soma: 0, count: 0 };
    grupos[nome].soma += p;
    grupos[nome].count++;
  });
  return {
    data: Object.entries(grupos).map(([turma, v]) => ({ turma, freq: Math.round((v.soma / v.count) * 10) / 10 })).sort((a, b) => b.freq - a.freq),
    error: null
  };
}

export async function getFrequenciaPorMes() {
  const { data: freqs } = await supabaseQuery('frequencias', { select: 'percentual_frequencia,mes_referencia', limit: 10000 });
  const grupos = {};
  (freqs || []).forEach(f => {
    const mes = f.mes_referencia || 'N/I';
    const p = parseFloat(f.percentual_frequencia);
    if (isNaN(p)) return;
    if (!grupos[mes]) grupos[mes] = { soma: 0, count: 0 };
    grupos[mes].soma += p;
    grupos[mes].count++;
  });
  return {
    data: Object.entries(grupos).map(([mes, v]) => ({ mes, freq: Math.round((v.soma / v.count) * 10) / 10 })).sort((a, b) => parseInt(a.mes) - parseInt(b.mes) || a.mes.localeCompare(b.mes)),
    error: null
  };
}

export async function getFrequenciaPorSerie() {
  const { data: freqs } = await supabaseQuery('frequencias', { select: 'percentual_frequencia,turma_id', limit: 10000 });
  const { data: turmas } = await supabaseQuery('turmas', { select: 'id,serie_id' });
  const { data: series } = await supabaseQuery('series', { select: 'id,nome' });
  const sMap = {}; (series || []).forEach(s => sMap[s.id] = s.nome);
  const tSerie = {}; (turmas || []).forEach(t => tSerie[t.id] = t.serie_id);

  const grupos = {};
  (freqs || []).forEach(f => {
    const sId = tSerie[f.turma_id];
    const nome = sMap[sId] || `Série ${sId}`;
    const p = parseFloat(f.percentual_frequencia);
    if (isNaN(p)) return;
    if (!grupos[nome]) grupos[nome] = { soma: 0, count: 0 };
    grupos[nome].soma += p;
    grupos[nome].count++;
  });
  return {
    data: Object.entries(grupos).map(([serie, v]) => ({ serie, freq: Math.round((v.soma / v.count) * 10) / 10 })).sort((a, b) => a.serie.localeCompare(b.serie)),
    error: null
  };
}

export async function getEstudantesBaixaFrequencia(limite = 75) {
  const { data: freqs } = await supabaseQuery('frequencias', { select: 'percentual_frequencia,estudante_id,turma_id', limit: 10000 });
  const { data: estudantes } = await supabaseQuery('estudantes', { select: 'id,nome,matricula' });
  const { data: turmas } = await supabaseQuery('turmas', { select: 'id,nome' });

  const eMap = {}; (estudantes || []).forEach(e => eMap[e.id] = e);
  const tMap = {}; (turmas || []).forEach(t => tMap[t.id] = t.nome);

  const medias = {};
  (freqs || []).forEach(f => {
    const p = parseFloat(f.percentual_frequencia);
    if (isNaN(p)) return;
    if (!medias[f.estudante_id]) medias[f.estudante_id] = { soma: 0, count: 0, turma: f.turma_id };
    medias[f.estudante_id].soma += p;
    medias[f.estudante_id].count++;
    medias[f.estudante_id].turma = f.turma_id;
  });

  return {
    data: Object.entries(medias)
      .map(([id, v]) => {
        const media = v.soma / v.count;
        const e = eMap[id];
        return { nome: e?.nome || `ID ${id}`, matricula: e?.matricula || '-', percentual_frequencia: Math.round(media), turma: tMap[v.turma] || '-' };
      })
      .filter(item => item.percentual_frequencia < limite)
      .sort((a, b) => a.percentual_frequencia - b.percentual_frequencia),
    error: null
  };
}

export async function getMediaPorProfessor(filters = {}) {
  await getRefCache();
  const { data: notas } = await supabaseQuery('notas', { select: 'media_final,alocacao_id', limit: 10000 });
  const filtered = applyNotaFilters(notas || [], filters);
  const pMap = {}; refCache.professores.forEach(p => pMap[p.id] = p.nome);
  const alocProf = {}; refCache.alocacoes.forEach(a => alocProf[a.id] = a.professor_id);

  const grupos = {};
  filtered.forEach(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0) return;
    const pId = alocProf[n.alocacao_id];
    const nome = pMap[pId] || `Prof ${pId}`;
    if (!grupos[nome]) grupos[nome] = { soma: 0, count: 0 };
    grupos[nome].soma += mf;
    grupos[nome].count++;
  });
  return {
    data: Object.entries(grupos).map(([professor, v]) => ({ professor, media: Math.round((v.soma / v.count) * 10) / 10 })).sort((a, b) => b.media - a.media),
    error: null
  };
}

export async function getFilterOptions() {
  const { data: series } = await supabaseQuery('series', { select: 'id,nome', order: 'nome' });
  const { data: turmas } = await supabaseQuery('turmas', { select: 'id,nome,serie_id', order: 'nome' });
  const { data: componentes } = await supabaseQuery('componentes_curriculares', { select: 'id,nome', order: 'nome' });
  const { data: professores } = await supabaseQuery('professores', { select: 'id,nome', order: 'nome' });
  return {
    series: series || [],
    turmas: turmas || [],
    componentes: componentes || [],
    professores: professores || [],
  };
}
