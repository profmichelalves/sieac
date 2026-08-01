import { supabaseQuery, supabaseFetchAll } from '../services/supabase.js';
import { isProfessor, getProfessorVinculo } from '../services/authService.js';

let refCache = null;
let estudantesPermitidos = null;
let permitidosCarregados = false;

function notasPreenchidas(n1, n2, n3, n4) {
  return [n1, n2, n3, n4].map(v => parseFloat(v)).filter(v => !isNaN(v) && v > 0);
}

function calcularMediaAcumulada(n1, n2, n3, n4) {
  const notas = notasPreenchidas(n1, n2, n3, n4);
  if (!notas.length) return null;
  return Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10;
}

function calcularSituacao(n1, n2, n3, n4) {
  const notas = notasPreenchidas(n1, n2, n3, n4);
  if (!notas.length) return 'Sem avaliações';
  const media = notas.reduce((a, b) => a + b, 0) / notas.length;
  if (notas.length >= 4) return media >= 6 ? 'Aprovado' : 'Recuperação Final';
  return media >= 6 ? 'Em Aprovação' : 'Em Recuperação';
}

async function getRefCache() {
  if (refCache) return refCache;
  const [s, t, c, p, e] = await Promise.all([
    supabaseQuery('series', { select: 'id,nome,etapa_ensino_id' }),
    supabaseQuery('turmas', { select: 'id,nome,serie_id,turno' }),
    supabaseQuery('componentes_curriculares', { select: 'id,nome' }),
    supabaseQuery('professores', { select: 'id,nome' }),
    supabaseQuery('etapas_ensino', { select: 'id,nome' }),
  ]);
  const a = await supabaseQuery('alocacoes', { select: 'id,turma_id,componente_id,professor_id' });
  const est = await supabaseFetchAll('estudantes', { select: 'id,nome,matricula', limit: 30000 });
  refCache = {
    series: s.data || [],
    turmas: t.data || [],
    componentes: c.data || [],
    professores: p.data || [],
    etapas: e.data || [],
    alocacoes: a.data || [],
    estudantes: est.data || [],
  };
  return refCache;
}

export function clearCache() { refCache = null; estudantesPermitidos = null; permitidosCarregados = false; }

async function getEstudantesPermitidos() {
  if (permitidosCarregados) return estudantesPermitidos;
  permitidosCarregados = true;
  if (!isProfessor()) {
    estudantesPermitidos = null;
    return null;
  }
  const vinculo = await getProfessorVinculo();
  if (!vinculo) {
    estudantesPermitidos = new Set();
    return estudantesPermitidos;
  }
  await getRefCache();
  const aIds = refCache.alocacoes.filter(a => vinculo.turmaIds.includes(a.turma_id)).map(a => a.id);
  const set = new Set();
  for (let i = 0; i < aIds.length; i += 100) {
    const chunk = aIds.slice(i, i + 100);
    if (!chunk.length) continue;
    const { data: notas } = await supabaseFetchAll('notas', {
      select: 'estudante_id',
      filters: [{ col: 'alocacao_id', val: chunk, op: 'in' }],
      limit: 30000,
    });
    (notas || []).forEach(n => set.add(n.estudante_id));
  }
  estudantesPermitidos = set;
  return set;
}

export async function podeVerEstudante(estudanteId) {
  const permitidos = await getEstudantesPermitidos();
  if (permitidos === null) return true;
  return permitidos.has(Number(estudanteId));
}

// Monta os filtros SQL para enviar ao servidor
function montarFiltrosNotas(filters) {
  if (!filters || Object.keys(filters).length === 0) return null;
  const cache = refCache;
  if (!cache) return null;

  // Filtros que afetam alocacao_id
  let alocIds = new Set(cache.alocacoes.map(a => a.id));

  if (filters.etapa_id) {
    const serieIds = new Set((cache.series || []).filter(s => s.etapa_ensino_id == filters.etapa_id).map(s => s.id));
    const turmaIds = new Set((cache.turmas || []).filter(t => serieIds.has(t.serie_id)).map(t => t.id));
    alocIds = new Set([...alocIds].filter(id => turmaIds.has(cache.alocacoes.find(a => a.id === id)?.turma_id)));
  }

  if (filters.serie_id) {
    const turmaIds = new Set((cache.turmas || []).filter(t => t.serie_id == filters.serie_id).map(t => t.id));
    alocIds = new Set([...alocIds].filter(id => turmaIds.has(cache.alocacoes.find(a => a.id === id)?.turma_id)));
  }

  if (filters.turma_id) {
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.find(a => a.id === id)?.turma_id == filters.turma_id));
  }

  if (filters.turno) {
    const turmaIds = new Set((cache.turmas || []).filter(t => t.turno == filters.turno).map(t => t.id));
    alocIds = new Set([...alocIds].filter(id => turmaIds.has(cache.alocacoes.find(a => a.id === id)?.turma_id)));
  }

  if (filters.componente_id) {
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.find(a => a.id === id)?.componente_id == filters.componente_id));
  }

  if (filters.professor_id) {
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.find(a => a.id === id)?.professor_id == filters.professor_id));
  }

  if (filters.estudante_id) {
    return { estudante_id: filters.estudante_id, alocacao_ids: [...alocIds] };
  }

  if (alocIds.size === cache.alocacoes.length) return null;
  return { alocacao_ids: [...alocIds] };
}

function montarTurmasFiltradas(filters) {
  if (!filters || Object.keys(filters).length === 0) return null;
  const cache = refCache;
  if (!cache) return null;

  let turmaIds = new Set(cache.turmas.map(t => t.id));

  if (filters.etapa_id) {
    const serieIds = new Set((cache.series || []).filter(s => s.etapa_ensino_id == filters.etapa_id).map(s => s.id));
    turmaIds = new Set([...turmaIds].filter(id => {
      const t = cache.turmas.find(t => t.id === id);
      return t && t.serie_id != null && serieIds.has(t.serie_id);
    }));
  }

  if (filters.serie_id) {
    turmaIds = new Set((cache.turmas || []).filter(t => t.serie_id == filters.serie_id).map(t => t.id));
  }

  if (filters.turma_id) {
    turmaIds = new Set([Number(filters.turma_id)]);
  }

  if (filters.turno) {
    turmaIds = new Set((cache.turmas || []).filter(t => t.turno == filters.turno).map(t => t.id));
  }

  if (filters.professor_id) {
    const turmasProf = new Set(cache.alocacoes.filter(a => a.professor_id == filters.professor_id).map(a => a.turma_id));
    turmaIds = new Set([...turmaIds].filter(id => turmasProf.has(id)));
  }

  if (turmaIds.size === cache.turmas.length) return null;
  return turmaIds;
}

function montarFiltrosFrequencia(filters) {
  const turmaIds = montarTurmasFiltradas(filters);
  if (!turmaIds) return null;
  if (filters && filters.estudante_id) {
    return { estudante_id: filters.estudante_id, turma_ids: [...turmaIds] };
  }
  return { turma_ids: [...turmaIds] };
}

async function queryNotas(filters, selectFields) {
  const f = montarFiltrosNotas(filters);
  if (!f) {
    const res = await supabaseFetchAll('notas', { select: selectFields });
    return res.data || [];
  }
  if (f.alocacao_ids && f.alocacao_ids.length) {
    const res = await supabaseFetchAll('notas', {
      select: selectFields,
      filters: [{ col: 'alocacao_id', val: f.alocacao_ids, op: 'in' }],
    });
    return res.data || [];
  }
  if (f.estudante_id) {
    const fil = [{ col: 'estudante_id', val: f.estudante_id }];
    if (f.alocacao_ids && f.alocacao_ids.length) {
      fil.push({ col: 'alocacao_id', val: f.alocacao_ids, op: 'in' });
    }
    const res = await supabaseFetchAll('notas', { select: selectFields, filters: fil });
    return res.data || [];
  }
  return [];
}

async function queryFrequencias(filters, selectFields) {
  const f = montarFiltrosFrequencia(filters);
  if (!f) {
    const res = await supabaseFetchAll('frequencias', { select: selectFields });
    return res.data || [];
  }
  if (f.turma_ids && f.turma_ids.length) {
    const res = await supabaseFetchAll('frequencias', {
      select: selectFields,
      filters: [{ col: 'turma_id', val: f.turma_ids, op: 'in' }],
    });
    return res.data || [];
  }
  if (f.estudante_id) {
    const fil = [{ col: 'estudante_id', val: f.estudante_id }];
    if (f.turma_ids && f.turma_ids.length) {
      fil.push({ col: 'turma_id', val: f.turma_ids, op: 'in' });
    }
    const res = await supabaseFetchAll('frequencias', { select: selectFields, filters: fil });
    return res.data || [];
  }
  return [];
}

// ---- EXPORTED FUNCTIONS ----

async function getEstudantesImportados(filters) {
  await getRefCache();
  let ids = new Set(refCache.estudantes.map(e => e.id));
  const permitidos = await getEstudantesPermitidos();
  if (permitidos) ids = new Set([...ids].filter(id => permitidos.has(Number(id))));
  const f = montarFiltrosNotas(filters);
  if (f && f.estudante_id) {
    ids = new Set([...ids].filter(id => Number(id) === Number(f.estudante_id)));
  } else if (f && f.alocacao_ids && f.alocacao_ids.length) {
    const idsComNota = new Set();
    for (let i = 0; i < f.alocacao_ids.length; i += 100) {
      const chunk = f.alocacao_ids.slice(i, i + 100);
      const { data: notas } = await supabaseFetchAll('notas', {
        select: 'estudante_id',
        filters: [{ col: 'alocacao_id', val: chunk, op: 'in' }],
        limit: 30000,
      });
      (notas || []).forEach(n => idsComNota.add(Number(n.estudante_id)));
    }
    ids = new Set([...ids].filter(id => idsComNota.has(id)));
  }
  return ids.size;
}

// Classifica cada estudante pela média anual e frequência média:
//  - Reprovado:     frequência < 75% (independente da média)
//  - Aprovado:      média anual ≥ 6,0 e frequência ≥ 75%
//  - Recuperação:   média anual < 6,0 (com frequência ≥ 75%)
async function classificarEstudantes(filters) {
  await getRefCache();
  const [notas, freqs] = await Promise.all([
    queryNotas(filters, 'estudante_id,media_final,nota_4bim'),
    queryFrequencias(filters, 'estudante_id,percentual_frequencia'),
  ]);

  const periodo = notas.some(n => {
    const v = parseFloat(n.nota_4bim);
    return !isNaN(v) && v > 0;
  }) ? 'anual' : 'parcial';

  const medias = {};
  notas.forEach(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0) return;
    if (!medias[n.estudante_id]) medias[n.estudante_id] = { soma: 0, count: 0 };
    medias[n.estudante_id].soma += mf;
    medias[n.estudante_id].count++;
  });

  const freqsPorEstudante = {};
  freqs.forEach(f => {
    const p = parseFloat(f.percentual_frequencia);
    if (isNaN(p)) return;
    if (!freqsPorEstudante[f.estudante_id]) freqsPorEstudante[f.estudante_id] = { soma: 0, count: 0 };
    freqsPorEstudante[f.estudante_id].soma += p;
    freqsPorEstudante[f.estudante_id].count++;
  });

  const classificacao = {};
  Object.entries(medias).forEach(([eId, m]) => {
    const f = freqsPorEstudante[eId];
    const frequencia = f ? f.soma / f.count : null;
    if (frequencia != null && frequencia < 75) classificacao[eId] = 'reprovado';
    else if (m.soma / m.count >= 6) classificacao[eId] = 'aprovado';
    else classificacao[eId] = 'recuperacao';
  });

  return { classificacao, medias, frequenciasPorEstudante: freqsPorEstudante, totalNotas: notas.length, periodo };
}

export async function getResumoGeral(filters = {}) {
  await getRefCache();
  const [totalEstudantes, dados, frequencias] = await Promise.all([
    getEstudantesImportados(filters),
    classificarEstudantes(filters),
    queryFrequencias(filters, 'percentual_frequencia,estudante_id'),
  ]);
  const { classificacao, medias } = dados;

  const valoresMedias = Object.values(medias).map(m => m.soma / m.count);
  const mediaGeral = valoresMedias.length ? valoresMedias.reduce((a, b) => a + b, 0) / valoresMedias.length : 0;

  let aprovados = 0, reprovados = 0, recuperacao = 0;
  Object.values(classificacao).forEach(c => {
    if (c === 'aprovado') aprovados++;
    else if (c === 'recuperacao') recuperacao++;
    else reprovados++;
  });
  const total = aprovados + reprovados + recuperacao || 1;

  let freqMedia = 0, freqCount = 0, somaFreq = 0;
  frequencias.forEach(f => {
    const p = parseFloat(f.percentual_frequencia);
    if (!isNaN(p)) { somaFreq += p; freqCount++; }
  });
  freqMedia = freqCount ? somaFreq / freqCount : 0;

  const turmaSet = montarTurmasFiltradas(filters);

  return {
    total_estudantes: totalEstudantes,
    total_turmas: turmaSet ? turmaSet.size : refCache.turmas.length,
    media_geral: Math.round(mediaGeral * 10) / 10,
    frequencia_media: Math.round(freqMedia * 10) / 10,
    aprovacao_pct: Math.round(aprovados / total * 1000) / 10,
    reprovacao_pct: Math.round(reprovados / total * 1000) / 10,
    recuperacao_pct: Math.round(recuperacao / total * 1000) / 10,
    total_recuperacao: recuperacao,
    total_notas: dados.totalNotas,
    periodo: dados.periodo,
  };
}

export async function getResultadoFinal(filters = {}) {
  const { classificacao, periodo } = await classificarEstudantes(filters);

  let aprov = 0, repr = 0, recup = 0;
  Object.values(classificacao).forEach(c => {
    if (c === 'aprovado') aprov++;
    else if (c === 'recuperacao') recup++;
    else repr++;
  });

  return { data: { aprovados: aprov, reprovados: repr, recuperacao: recup, periodo }, error: null };
}

export async function getDetalheResultados(filters = {}) {
  await getRefCache();
  const [notas, dados] = await Promise.all([
    queryNotas(filters, 'estudante_id,alocacao_id,nota_1bim,nota_2bim,nota_3bim,nota_4bim,media_final,resultado_final'),
    classificarEstudantes(filters),
  ]);
  const { classificacao, medias, frequenciasPorEstudante } = dados;

  const eMap = {}; refCache.estudantes.forEach(e => eMap[e.id] = e);
  const alocTurma = {}; refCache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);
  const alocComp = {}; refCache.alocacoes.forEach(a => alocComp[a.id] = a.componente_id);
  const tMap = {}; refCache.turmas.forEach(t => tMap[t.id] = t.nome);
  const cMap = {}; refCache.componentes.forEach(c => cMap[c.id] = c.nome);

  const catMap = { aprovado: 'aprovados', recuperacao: 'recuperacao', reprovado: 'reprovados' };
  const resultado = { aprovados: [], recuperacao: [], reprovados: [] };
  notas.forEach(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0) return;
    const cat = catMap[classificacao[n.estudante_id]];
    if (!cat) return;
    const e = eMap[n.estudante_id];
    const f = frequenciasPorEstudante[n.estudante_id];
    const frequencia = f ? f.soma / f.count : null;
    resultado[cat].push({
      estudante: e?.nome || `ID ${n.estudante_id}`,
      matricula: e?.matricula || '-',
      turma: tMap[alocTurma[n.alocacao_id]] || '-',
      disciplina: cMap[alocComp[n.alocacao_id]] || 'N/I',
      nota_1bim: n.nota_1bim,
      nota_2bim: n.nota_2bim,
      nota_3bim: n.nota_3bim,
      nota_4bim: n.nota_4bim,
      media_final: n.media_final,
      media_acumulada: calcularMediaAcumulada(n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim),
      situacao: calcularSituacao(n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim),
      media_estudante: medias[n.estudante_id] ? medias[n.estudante_id].soma / medias[n.estudante_id].count : null,
      frequencia: frequencia != null ? Math.round(frequencia * 10) / 10 : null,
      resultado_final: n.resultado_final || '-',
    });
  });

  const ordenar = arr => arr.sort((a, b) =>
    a.estudante.localeCompare(b.estudante, 'pt-BR') ||
    a.disciplina.localeCompare(b.disciplina, 'pt-BR')
  );

  return {
    data: {
      aprovados: ordenar(resultado.aprovados),
      recuperacao: ordenar(resultado.recuperacao),
      reprovados: ordenar(resultado.reprovados),
      periodo: dados.periodo,
    },
    error: null,
  };
}

// Agrega por estudante as disciplinas para os relatórios de Aprovação (nenhuma
// disciplina com média < 6,0 e frequência ≥ 75%), Em Recuperação (1 a 6 disciplinas
// com média < 6,0 e frequência ≥ 75%) e Em Reprovação (frequência < 75% ou mais de
// 6 disciplinas com média < 6,0).
export async function getDetalheSituacao(filters = {}) {
  await getRefCache();
  const [notas, freqs] = await Promise.all([
    queryNotas(filters, 'estudante_id,alocacao_id,nota_1bim,nota_2bim,nota_3bim,nota_4bim,media_final'),
    queryFrequencias(filters, 'estudante_id,percentual_frequencia'),
  ]);

  const alocComp = {}; refCache.alocacoes.forEach(a => alocComp[a.id] = a.componente_id);
  const alocTurma = {}; refCache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);
  const cMap = {}; refCache.componentes.forEach(c => cMap[c.id] = c.nome);
  const tMap = {}; refCache.turmas.forEach(t => tMap[t.id] = t.nome);
  const eMap = {}; refCache.estudantes.forEach(e => eMap[e.id] = e);

  const porEstudante = {};
  notas.forEach(n => {
    let media = calcularMediaAcumulada(n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim);
    if (media == null) {
      const mf = parseFloat(n.media_final);
      media = !isNaN(mf) && mf > 0 ? mf : null;
    }
    if (media == null) return;
    if (!porEstudante[n.estudante_id]) porEstudante[n.estudante_id] = { disciplinas: [], turmas: new Set() };
    porEstudante[n.estudante_id].disciplinas.push({ nome: cMap[alocComp[n.alocacao_id]] || 'N/I', media });
    const turmaId = alocTurma[n.alocacao_id];
    if (turmaId && tMap[turmaId]) porEstudante[n.estudante_id].turmas.add(tMap[turmaId]);
  });

  const freqPorEstudante = {};
  freqs.forEach(f => {
    const p = parseFloat(f.percentual_frequencia);
    if (isNaN(p)) return;
    if (!freqPorEstudante[f.estudante_id]) freqPorEstudante[f.estudante_id] = { soma: 0, count: 0 };
    freqPorEstudante[f.estudante_id].soma += p;
    freqPorEstudante[f.estudante_id].count++;
  });

  const reprovados = [];
  const recuperacao = [];
  const aprovados = [];

  Object.entries(porEstudante).forEach(([eId, dados]) => {
    const e = eMap[eId];
    const freqData = freqPorEstudante[eId];
    const frequencia = freqData ? Math.round((freqData.soma / freqData.count) * 10) / 10 : null;
    const emRecuperacao = dados.disciplinas.filter(d => d.media < 6).sort((a, b) => a.media - b.media);
    const qtd = emRecuperacao.length;
    const freqBaixa = frequencia != null && frequencia < 75;

    const base = {
      estudante: e?.nome || `ID ${eId}`,
      matricula: e?.matricula || '-',
      turma: [...dados.turmas].sort((a, b) => a.localeCompare(b, 'pt-BR')).join(', ') || '-',
      frequencia,
      qtd,
      disciplinas: emRecuperacao,
    };

    if (freqBaixa || qtd > 6) {
      const bola = freqBaixa && qtd > 6 ? 'red' : (freqBaixa || qtd > 8) ? 'orange' : 'yellow';
      reprovados.push({ ...base, bola });
    } else if (frequencia == null || frequencia >= 75) {
      if (qtd >= 1 && qtd <= 6) {
        const bola = qtd >= 5 ? 'red' : qtd >= 3 ? 'orange' : 'yellow';
        recuperacao.push({ ...base, bola });
      } else if (qtd === 0) {
        const medias = dados.disciplinas.map(d => d.media);
        aprovados.push({
          estudante: base.estudante,
          matricula: base.matricula,
          turma: base.turma,
          frequencia: base.frequencia,
          mediaGeral: Math.round((medias.reduce((a, b) => a + b, 0) / medias.length) * 10) / 10,
          menor: Math.min(...medias),
          maior: Math.max(...medias),
        });
      }
    }
  });

  const ordemBola = { red: 0, orange: 1, yellow: 2 };

  reprovados.sort((a, b) =>
    ordemBola[a.bola] - ordemBola[b.bola] ||
    (a.frequencia ?? 999) - (b.frequencia ?? 999) ||
    b.qtd - a.qtd
  );

  recuperacao.sort((a, b) =>
    ordemBola[a.bola] - ordemBola[b.bola] ||
    b.qtd - a.qtd ||
    Math.min(...a.disciplinas.map(d => d.media)) - Math.min(...b.disciplinas.map(d => d.media))
  );

  aprovados.sort((a, b) => a.menor - b.menor || a.mediaGeral - b.mediaGeral);

  return { data: { aprovados, reprovados, recuperacao }, error: null };
}

export async function getMediaPorTurma(filters = {}) {
  await getRefCache();
  const notas = await queryNotas(filters, 'media_final,alocacao_id');
  const alocTurma = {}; refCache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);
  const turmaMap = {}; refCache.turmas.forEach(t => turmaMap[t.id] = t.nome);

  const grupos = {};
  notas.forEach(n => {
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
  const notas = await queryNotas(filters, 'media_final,alocacao_id');
  const alocComp = {}; refCache.alocacoes.forEach(a => alocComp[a.id] = a.componente_id);
  const compMap = {}; refCache.componentes.forEach(c => compMap[c.id] = c.nome);

  const grupos = {};
  notas.forEach(n => {
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
  const notas = await queryNotas(filters, 'media_final,alocacao_id');
  const alocTurma = {}; refCache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);
  const turmaSerie = {}; refCache.turmas.forEach(t => turmaSerie[t.id] = t.serie_id);
  const serieMap = {}; refCache.series.forEach(s => serieMap[s.id] = s.nome);

  const grupos = {};
  notas.forEach(n => {
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
  const notas = await queryNotas(filters, 'nota_1bim,nota_2bim,nota_3bim,nota_4bim,alocacao_id');

  const b1 = [], b2 = [], b3 = [], b4 = [];
  notas.forEach(n => {
    if (parseFloat(n.nota_1bim) > 0) b1.push(parseFloat(n.nota_1bim));
    if (parseFloat(n.nota_2bim) > 0) b2.push(parseFloat(n.nota_2bim));
    if (parseFloat(n.nota_3bim) > 0) b3.push(parseFloat(n.nota_3bim));
    if (parseFloat(n.nota_4bim) > 0) b4.push(parseFloat(n.nota_4bim));
  });
  const m = arr => arr.length ? Math.round((arr.reduce((a,b) => a+b,0) / arr.length) * 10) / 10 : 0;
  return { data: { bim1: m(b1), bim2: m(b2), bim3: m(b3), bim4: m(b4) }, error: null };
}

export async function getDistribuicaoHistograma(filters = {}) {
  await getRefCache();
  const notas = await queryNotas(filters, 'media_final,alocacao_id');

  const faixas = { '0-2': 0, '2-4': 0, '4-6': 0, '6-8': 0, '8-10': 0 };
  notas.forEach(n => {
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
  const freqs = await queryFrequencias(filters, 'percentual_frequencia,turma_id');
  const tMap = {}; refCache.turmas.forEach(t => tMap[t.id] = t.nome);
  const grupos = {};
  freqs.forEach(f => {
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
  const freqs = await queryFrequencias(filters, 'percentual_frequencia,mes_referencia');
  const grupos = {};
  freqs.forEach(f => {
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
  const freqs = await queryFrequencias(filters, 'percentual_frequencia,turma_id');
  const tSerie = {}; refCache.turmas.forEach(t => tSerie[t.id] = t.serie_id);
  const sMap = {}; refCache.series.forEach(s => sMap[s.id] = s.nome);
  const grupos = {};
  freqs.forEach(f => {
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
  const freqs = await queryFrequencias(filters, 'percentual_frequencia,estudante_id,turma_id');
  const eMap = {}; refCache.estudantes.forEach(e => eMap[e.id] = e);
  const tMap = {}; refCache.turmas.forEach(t => tMap[t.id] = t.nome);

  const medias = {};
  freqs.forEach(f => {
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
  const notas = await queryNotas(filters, 'media_final,alocacao_id');
  const alocProf = {}; refCache.alocacoes.forEach(a => alocProf[a.id] = a.professor_id);
  const pMap = {}; refCache.professores.forEach(p => pMap[p.id] = p.nome);

  const grupos = {};
  notas.forEach(n => {
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
  const freqs = await queryFrequencias(filters, 'percentual_frequencia,estudante_id,turma_id');
  const soma = freqs.reduce((acc, f) => acc + parseFloat(f.percentual_frequencia || 0), 0);
  return { data: freqs.length ? soma / freqs.length : 0, error: null };
}

export async function getScatterFreqNota(filters = {}) {
  await getRefCache();
  const [notas, freqs] = await Promise.all([
    queryNotas(filters, 'estudante_id,media_final,alocacao_id'),
    queryFrequencias(filters, 'estudante_id,percentual_frequencia,turma_id'),
  ]);

  const freqPorAluno = {};
  freqs.forEach(f => {
    const p = parseFloat(f.percentual_frequencia);
    if (isNaN(p)) return;
    if (!freqPorAluno[f.estudante_id]) freqPorAluno[f.estudante_id] = { soma: 0, count: 0 };
    freqPorAluno[f.estudante_id].soma += p;
    freqPorAluno[f.estudante_id].count++;
  });

  const notasPorAluno = {};
  notas.forEach(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0) return;
    if (!notasPorAluno[n.estudante_id]) notasPorAluno[n.estudante_id] = { soma: 0, count: 0 };
    notasPorAluno[n.estudante_id].soma += mf;
    notasPorAluno[n.estudante_id].count++;
  });

  const eMap = {}; refCache.estudantes.forEach(e => eMap[e.id] = e);

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
        nome: eMap[eId]?.nome || `ID ${eId}`,
        matricula: eMap[eId]?.matricula || '-',
        media: Math.round(mediaNota * 10) / 10,
        frequencia: Math.round(mediaFreq * 10) / 10,
      });
    }
  });

  return { data: pontos, error: null };
}

export async function getNotasEstudante(estudanteId) {
  if (!(await podeVerEstudante(estudanteId))) return { data: [], error: null };
  const { data: notas } = await supabaseQuery('notas', {
    select: 'nota_1bim,nota_2bim,nota_3bim,nota_4bim,media_final,alocacao_id',
    filters: [{ col: 'estudante_id', val: estudanteId }],
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
    media_acumulada: calcularMediaAcumulada(n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim),
    situacao: calcularSituacao(n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim),
  }));
  return { data, error: null };
}

export async function getFrequenciaEstudante(estudanteId) {
  if (!(await podeVerEstudante(estudanteId))) return { data: [], error: null };
  const { data: freqs } = await supabaseQuery('frequencias', {
    select: 'percentual_frequencia,mes_referencia',
    filters: [{ col: 'estudante_id', val: estudanteId }],
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
  if (!(await podeVerEstudante(estudanteId))) return [];
  const { data: notas } = await supabaseQuery('notas', {
    select: 'alocacao_id',
    filters: [{ col: 'estudante_id', val: estudanteId }],
    limit: 100,
  });
  if (!notas || !notas.length) return [];
  const ids = [...new Set(notas.map(n => n.alocacao_id))];
  await getRefCache();
  const sMap = {}; refCache.series.forEach(s => sMap[s.id] = s.nome);
  const alocTurma = {}; refCache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);

  const turmas = [];
  const vistas = new Set();
  ids.forEach(aId => {
    const tId = alocTurma[aId];
    if (tId == null || vistas.has(tId)) return;
    vistas.add(tId);
    const t = refCache.turmas.find(x => x.id === tId);
    if (t) turmas.push({ nome: t.nome, serie: sMap[t.serie_id] || '', turno: t.turno || '' });
  });
  return turmas;
}

export async function listarEstudantesParaBusca() {
  await getRefCache();
  let lista = refCache.estudantes.map(e => ({ id: e.id, nome: e.nome, matricula: e.matricula || '-' }));
  const permitidos = await getEstudantesPermitidos();
  if (permitidos) lista = lista.filter(e => permitidos.has(Number(e.id)));
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function buscarEstudantes(termo) {
  const q = (termo || '').trim();
  if (!q) return [];
  await getRefCache();

  const ids = new Set();
  const { data: porNome } = await supabaseQuery('estudantes', { select: 'id,nome,matricula', filters: [{ col: 'nome', val: `%${q}%`, op: 'ilike' }], order: 'nome', limit: 100 });
  (porNome || []).forEach(e => ids.add(e.id));
  const { data: porMatricula } = await supabaseQuery('estudantes', { select: 'id,nome,matricula', filters: [{ col: 'matricula', val: `%${q}%`, op: 'ilike' }], limit: 100 });
  (porMatricula || []).forEach(e => ids.add(e.id));

  const { data: turmas } = await supabaseQuery('turmas', { select: 'id', filters: [{ col: 'nome', val: `%${q}%`, op: 'ilike' }] });
  if (turmas && turmas.length) {
    const tIds = turmas.map(t => t.id);
    const { data: alocs } = await supabaseQuery('alocacoes', { select: 'id', filters: [{ col: 'turma_id', val: tIds, op: 'in' }], limit: 1000 });
    const aIds = [...new Set((alocs || []).map(a => a.id))];
    if (aIds.length) {
      const { data: notas } = await supabaseFetchAll('notas', { select: 'estudante_id', filters: [{ col: 'alocacao_id', val: aIds, op: 'in' }], limit: 30000 });
      (notas || []).forEach(n => ids.add(n.estudante_id));
    }
  }

  let idList = [...ids];
  const permitidos = await getEstudantesPermitidos();
  if (permitidos) idList = idList.filter(id => permitidos.has(Number(id)));
  if (!idList.length) return [];

  const estMap = new Map();
  const turmaSet = new Map();
  for (let i = 0; i < idList.length; i += 100) {
    const chunk = idList.slice(i, i + 100);
    const { data: ests } = await supabaseQuery('estudantes', { select: 'id,nome,matricula', filters: [{ col: 'id', val: chunk, op: 'in' }], limit: 100 });
    (ests || []).forEach(e => estMap.set(e.id, e));
    const { data: notas } = await supabaseFetchAll('notas', { select: 'estudante_id,alocacao_id', filters: [{ col: 'estudante_id', val: chunk, op: 'in' }], limit: 30000 });
    (notas || []).forEach(n => {
      if (!turmaSet.has(n.estudante_id)) turmaSet.set(n.estudante_id, new Set());
      const a = refCache.alocacoes.find(x => x.id === n.alocacao_id);
      const t = refCache.turmas.find(x => x.id === a?.turma_id);
      if (t) turmaSet.get(n.estudante_id).add(t.nome);
    });
  }

  return idList.map(id => ({
    id,
    nome: estMap.get(id)?.nome || `ID ${id}`,
    matricula: estMap.get(id)?.matricula || '-',
    turma: [...(turmaSet.get(id) || [])].join(', ') || '-',
  })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
