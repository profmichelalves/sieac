import { supabaseQuery } from '../services/supabase.js';

let refCache = null;

async function getRefCache() {
  if (refCache) return refCache;
  const [s, t, c, p, se, e] = await Promise.all([
    supabaseQuery('series', { select: 'id,nome,etapa_ensino_id' }),
    supabaseQuery('turmas', { select: 'id,nome,serie_id,turno' }),
    supabaseQuery('componentes_curriculares', { select: 'id,nome' }),
    supabaseQuery('professores', { select: 'id,nome' }),
    supabaseQuery('etapas_ensino', { select: 'id,nome' }),
    supabaseQuery('estudantes', { select: 'id,nome,matricula' }),
  ]);
  refCache = {
    series: s.data || [],
    turmas: t.data || [],
    componentes: c.data || [],
    professores: p.data || [],
    etapas: e.data || [],
    estudantes: e.data || [],
    alocacoes: [],
  };
  const a = await supabaseQuery('alocacoes', { select: 'id,turma_id,componente_id,professor_id' });
  refCache.alocacoes = a.data || [];
  return refCache;
}

export function clearCache() { refCache = null; }

function applyNotaFilters(notas, filters) {
  if (!filters || Object.keys(filters).length === 0) return notas;
  if (!refCache) return notas;

  const cache = refCache;
  let alocIds = new Set(cache.alocacoes.map(a => a.id));

  if (filters.ano_letivo) {
    const turmasAno = new Set(
      (cache.turmas || []).filter(t => String(t.ano_letivo) === String(filters.ano_letivo)).map(t => t.id)
    );
  }

  if (filters.etapa_id) {
    const serieIds = new Set((cache.series || []).filter(s => s.etapa_ensino_id == filters.etapa_id).map(s => s.id));
    const turmaIds = new Set((cache.turmas || []).filter(t => serieIds.has(t.serie_id)).map(t => t.id));
    const ids = cache.alocacoes.filter(a => turmaIds.has(a.turma_id)).map(a => a.id);
    alocIds = new Set([...alocIds].filter(id => ids.includes(id)));
  }

  if (filters.serie_id) {
    const turmasSerie = new Set((cache.turmas || []).filter(t => t.serie_id == filters.serie_id).map(t => t.id));
    const ids = cache.alocacoes.filter(a => turmasSerie.has(a.turma_id)).map(a => a.id);
    alocIds = new Set([...alocIds].filter(id => ids.includes(id)));
  }

  if (filters.turma_id) {
    const ids = cache.alocacoes.filter(a => a.turma_id == filters.turma_id).map(a => a.id);
    alocIds = new Set([...alocIds].filter(id => ids.includes(id)));
  }

  if (filters.turno) {
    const turmasTurno = new Set((cache.turmas || []).filter(t => t.turno == filters.turno).map(t => t.id));
    const ids = cache.alocacoes.filter(a => turmasTurno.has(a.turma_id)).map(a => a.id);
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

  let filtradas = notas.filter(n => alocIds.has(n.alocacao_id));

  if (filters.estudante_id) {
    filtradas = filtradas.filter(n => n.estudante_id == filters.estudante_id);
  }

  return filtradas;
}

function applyFrequenciaFilters(freqs, filters) {
  if (!filters || Object.keys(filters).length === 0) return freqs;
  if (!refCache) return freqs;

  const cache = refCache;
  let result = [...freqs];

  if (filters.ano_letivo) {
    result = result.filter(f => String(f.ano_letivo) === String(filters.ano_letivo));
  }

  if (filters.estudante_id) {
    result = result.filter(f => f.estudante_id == filters.estudante_id);
  }

  if (filters.turma_id) {
    result = result.filter(f => f.turma_id == filters.turma_id);
  }

  if (filters.turno) {
    const turmasTurno = new Set((cache.turmas || []).filter(t => t.turno == filters.turno).map(t => t.id));
    result = result.filter(f => turmasTurno.has(f.turma_id));
  }

  if (filters.serie_id) {
    const turmasSerie = new Set((cache.turmas || []).filter(t => t.serie_id == filters.serie_id).map(t => t.id));
    result = result.filter(f => turmasSerie.has(f.turma_id));
  }

  if (filters.etapa_id) {
    const serieIds = new Set((cache.series || []).filter(s => s.etapa_ensino_id == filters.etapa_id).map(s => s.id));
    const turmaIds = new Set((cache.turmas || []).filter(t => serieIds.has(t.serie_id)).map(t => t.id));
    result = result.filter(f => turmaIds.has(f.turma_id));
  }

  return result;
}

export async function getResumoGeral(filters = {}) {
  await getRefCache();
  const { data: estudantes } = await supabaseQuery('estudantes', { select: 'id' });
  const { data: turmas } = await supabaseQuery('turmas', { select: 'id' });
  const { data: notas } = await supabaseQuery('notas', { select: 'media_final,estudante_id,resultado_final,alocacao_id', limit: 20000 });
  const { data: frequencias } = await supabaseQuery('frequencias', { select: 'percentual_frequencia,estudante_id', limit: 20000 });

  const totalEstudantes = estudantes?.length || 0;
  const totalTurmas = turmas?.length || 0;

  const notasFiltradas = applyNotaFilters(notas || [], filters);
  const freqFiltradas = applyFrequenciaFilters(frequencias || [], filters);

  const alunos = {};
  (notasFiltradas || []).forEach(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0) return;
    if (!alunos[n.estudante_id]) alunos[n.estudante_id] = { soma: 0, count: 0, aprovCount: 0, totalCount: 0 };
    alunos[n.estudante_id].soma += mf;
    alunos[n.estudante_id].count++;
    alunos[n.estudante_id].totalCount++;
    const r = (n.resultado_final || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (r.includes('aprov')) alunos[n.estudante_id].aprovCount++;
  });

  const medias = Object.values(alunos).map(a => a.soma / a.count);
  const mediaGeral = medias.length ? medias.reduce((a, b) => a + b, 0) / medias.length : 0;

  let aprovados = 0, reprovados = 0, recuperacao = 0;
  Object.values(alunos).forEach(a => {
    if (a.aprovCount === a.totalCount) aprovados++;
    else if (a.aprovCount > 0) recuperacao++;
    else reprovados++;
  });
  const total = aprovados + reprovados + recuperacao || 1;

  let freqMedia = 0;
  if (freqFiltradas?.length) {
    const soma = freqFiltradas.reduce((acc, f) => acc + parseFloat(f.percentual_frequencia || 0), 0);
    freqMedia = soma / freqFiltradas.length;
  }

  return {
    total_estudantes: Object.keys(alunos).length || totalEstudantes,
    total_turmas: filters.turma_id ? 1 : totalTurmas,
    media_geral: Math.round(mediaGeral * 10) / 10,
    frequencia_media: Math.round(freqMedia * 10) / 10,
    aprovacao_pct: Math.round(aprovados / total * 100),
    reprovacao_pct: Math.round(reprovados / total * 100),
    recuperacao_pct: Math.round(recuperacao / total * 100),
    total_notas: notasFiltradas?.length || 0,
  };
}

export async function getResultadoFinal(filters = {}) {
  await getRefCache();
  const { data: notas } = await supabaseQuery('notas', { select: 'resultado_final,alocacao_id,estudante_id', limit: 20000 });
  const filtradas = applyNotaFilters(notas || [], filters);

  const alunos = {};
  filtradas.forEach(n => {
    const r = (n.resultado_final || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    alunos[n.estudante_id] = r.includes('aprov') ? 'aprovado' : r.includes('recup') ? 'recuperacao' : 'reprovado';
  });

  let aprov = 0, repr = 0, recup = 0;
  Object.values(alunos).forEach(v => {
    if (v === 'aprovado') aprov++;
    else if (v === 'recuperacao') recup++;
    else repr++;
  });

  return { data: { aprovados: aprov, reprovados: repr, recuperacao: recup }, error: null };
}

export async function getMediaPorTurma(filters = {}) {
  await getRefCache();
  const { data: notas } = await supabaseQuery('notas', { select: 'media_final,alocacao_id', limit: 20000 });
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
  const { data: notas } = await supabaseQuery('notas', { select: 'media_final,alocacao_id', limit: 20000 });
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
  const { data: notas } = await supabaseQuery('notas', { select: 'media_final,alocacao_id', limit: 20000 });
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
  const { data: notas } = await supabaseQuery('notas', { select: 'nota_1bim,nota_2bim,nota_3bim,nota_4bim,alocacao_id', limit: 20000 });
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

export async function getDistribuicaoHistograma(filters = {}) {
  await getRefCache();
  const { data: notas } = await supabaseQuery('notas', { select: 'media_final,alocacao_id', limit: 20000 });
  const filtered = applyNotaFilters(notas || [], filters);

  const faixas = { '0-2': 0, '2-4': 0, '4-6': 0, '6-8': 0, '8-10': 0 };
  filtered.forEach(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0) return;
    if (mf < 2) faixas['0-2']++;
    else if (mf < 4) faixas['2-4']++;
    else if (mf < 6) faixas['4-6']++;
    else if (mf < 8) faixas['6-8']++;
    else faixas['8-10']++;
  });
  return { data: faixas, error: null };
}

export async function getFrequenciaPorTurma(filters = {}) {
  await getRefCache();
  const { data: freqs } = await supabaseQuery('frequencias', { select: 'percentual_frequencia,turma_id', limit: 20000 });
  const filtradas = applyFrequenciaFilters(freqs || [], filters);
  const tMap = {}; refCache.turmas.forEach(t => tMap[t.id] = t.nome);
  const grupos = {};
  filtradas.forEach(f => {
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

export async function getFrequenciaPorMes(filters = {}) {
  await getRefCache();
  const { data: freqs } = await supabaseQuery('frequencias', { select: 'percentual_frequencia,mes_referencia', limit: 20000 });
  const filtradas = applyFrequenciaFilters(freqs || [], filters);
  const grupos = {};
  filtradas.forEach(f => {
    const mes = f.mes_referencia || 'N/I';
    const p = parseFloat(f.percentual_frequencia);
    if (isNaN(p)) return;
    if (!grupos[mes]) grupos[mes] = { soma: 0, count: 0 };
    grupos[mes].soma += p;
    grupos[mes].count++;
  });
  const meses = { '1':'Jan','2':'Fev','3':'Mar','4':'Abr','5':'Mai','6':'Jun','7':'Jul','8':'Ago','9':'Set','10':'Out','11':'Nov','12':'Dez' };
  return {
    data: Object.entries(grupos).map(([mes, v]) => ({ mes: meses[mes] || mes, freq: Math.round((v.soma / v.count) * 10) / 10 })).sort((a, b) => {
      const ma = Object.keys(meses).find(k => meses[k] === a.mes);
      const mb = Object.keys(meses).find(k => meses[k] === b.mes);
      return (parseInt(ma) || 0) - (parseInt(mb) || 0);
    }),
    error: null
  };
}

export async function getFrequenciaPorSerie(filters = {}) {
  await getRefCache();
  const { data: freqs } = await supabaseQuery('frequencias', { select: 'percentual_frequencia,turma_id', limit: 20000 });
  const filtradas = applyFrequenciaFilters(freqs || [], filters);
  const sMap = {}; refCache.series.forEach(s => sMap[s.id] = s.nome);
  const tSerie = {}; refCache.turmas.forEach(t => tSerie[t.id] = t.serie_id);
  const grupos = {};
  filtradas.forEach(f => {
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

export async function getEstudantesBaixaFrequencia(limite = 75, filters = {}) {
  await getRefCache();
  const { data: freqs } = await supabaseQuery('frequencias', { select: 'percentual_frequencia,estudante_id,turma_id', limit: 20000 });
  const filtradas = applyFrequenciaFilters(freqs || [], filters);
  const eMap = {}; refCache.estudantes.forEach(e => eMap[e.id] = e);
  const tMap = {}; refCache.turmas.forEach(t => tMap[t.id] = t.nome);

  const medias = {};
  filtradas.forEach(f => {
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
  const { data: notas } = await supabaseQuery('notas', { select: 'media_final,alocacao_id', limit: 20000 });
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

export async function getFrequenciaMedia(filters = {}) {
  await getRefCache();
  const { data: freqs } = await supabaseQuery('frequencias', { select: 'percentual_frequencia,estudante_id,turma_id', limit: 20000 });
  const filtradas = applyFrequenciaFilters(freqs || [], filters);
  const soma = filtradas.reduce((acc, f) => acc + parseFloat(f.percentual_frequencia || 0), 0);
  return { data: filtradas.length ? soma / filtradas.length : 0, error: null };
}

export async function getScatterFreqNota(filters = {}) {
  await getRefCache();
  const [notasRes, freqRes] = await Promise.all([
    supabaseQuery('notas', { select: 'estudante_id,media_final,alocacao_id', limit: 20000 }),
    supabaseQuery('frequencias', { select: 'estudante_id,percentual_frequencia,turma_id', limit: 20000 }),
  ]);

  const notasF = applyNotaFilters(notasRes.data || [], filters);
  const freqsF = applyFrequenciaFilters(freqRes.data || [], filters);

  const freqPorAluno = {};
  freqsF.forEach(f => {
    const p = parseFloat(f.percentual_frequencia);
    if (isNaN(p)) return;
    if (!freqPorAluno[f.estudante_id]) freqPorAluno[f.estudante_id] = { soma: 0, count: 0 };
    freqPorAluno[f.estudante_id].soma += p;
    freqPorAluno[f.estudante_id].count++;
  });

  const notasPorAluno = {};
  notasF.forEach(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0) return;
    if (!notasPorAluno[n.estudante_id]) notasPorAluno[n.estudante_id] = { soma: 0, count: 0 };
    notasPorAluno[n.estudante_id].soma += mf;
    notasPorAluno[n.estudante_id].count++;
  });

  const eMap = {};
  refCache.estudantes.forEach(e => eMap[e.id] = e.nome);
  const tMap = {};
  refCache.turmas.forEach(t => tMap[t.id] = t.nome);

  const pontos = [];
  Object.keys(notasPorAluno).forEach(eId => {
    const n = notasPorAluno[eId];
    const f = freqPorAluno[eId];
    if (!f) return;
    const mediaNota = n.soma / n.count;
    const mediaFreq = f.soma / f.count;
    if (mediaNota > 0) {
      pontos.push({
        estudante_id: eId,
        nome: eMap[eId] || `ID ${eId}`,
        media: Math.round(mediaNota * 10) / 10,
        frequencia: Math.round(mediaFreq * 10) / 10,
      });
    }
  });

  return { data: pontos, error: null };
}

export async function getNotasEstudante(estudanteId) {
  const { data: notas } = await supabaseQuery('notas', {
    select: 'nota_1bim,nota_2bim,nota_3bim,nota_4bim,media_final,alocacao_id',
    estudante_id: estudanteId,
  });
  if (!notas) return { data: [], error: null };

  await getRefCache();
  const compMap = {}; refCache.componentes.forEach(c => compMap[c.id] = c.nome);
  const alocComp = {}; refCache.alocacoes.forEach(a => alocComp[a.id] = a.componente_id);

  const data = notas.map(n => ({
    disciplina: compMap[alocComp[n.alocacao_id]] || 'N/I',
    nota_1bim: n.nota_1bim,
    nota_2bim: n.nota_2bim,
    nota_3bim: n.nota_3bim,
    nota_4bim: n.nota_4bim,
    media_final: n.media_final,
  }));
  return { data, error: null };
}

export async function getFrequenciaEstudante(estudanteId) {
  const { data: freqs } = await supabaseQuery('frequencias', {
    select: 'percentual_frequencia,mes_referencia',
    estudante_id: estudanteId,
  });
  if (!freqs) return { data: [], error: null };
  const meses = { '1':'Jan','2':'Fev','3':'Mar','4':'Abr','5':'Mai','6':'Jun','7':'Jul','8':'Ago','9':'Set','10':'Out','11':'Nov','12':'Dez' };
  const data = (freqs || []).map(f => ({
    mes: meses[f.mes_referencia] || f.mes_referencia,
    frequencia: f.percentual_frequencia,
  }));
  return { data, error: null };
}

export async function getTurmasEstudante(estudanteId) {
  const { data: notas } = await supabaseQuery('notas', { select: 'alocacao_id', estudante_id: estudanteId, limit: 100 });
  if (!notas || !notas.length) return [];
  const ids = [...new Set(notas.map(n => n.alocacao_id))];
  await getRefCache();
  const tMap = {}; refCache.turmas.forEach(t => tMap[t.id] = t.nome);
  const sMap = {}; refCache.series.forEach(s => sMap[s.id] = s.nome);
  const tSerie = {}; refCache.turmas.forEach(t => tSerie[t.id] = t.serie_id);
  const alocTurma = {}; refCache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);

  const turmas = [];
  ids.forEach(aId => {
    const tId = alocTurma[aId];
    const t = refCache.turmas.find(x => x.id === tId);
    if (t) turmas.push({ nome: t.nome, serie: sMap[t.serie_id] || '', turno: t.turno || '' });
  });
  return turmas;
}
