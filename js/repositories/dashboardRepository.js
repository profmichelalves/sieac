import { supabaseQuery, supabaseFetchAll } from '../services/supabase.js';
import { isProfessor, isProfessorAee, getProfessorVinculo, getCurrentUser } from '../services/authService.js';

let refCache = null;

const ROW_CACHE_LIMIT = { notas: 8, freqs: 6, ids: 6, turmasEstudantes: 1 };
const rowCache = { notas: new Map(), freqs: new Map(), ids: new Map(), turmasEstudantes: new Map() };
const rowCacheInFlight = { notas: new Map(), freqs: new Map(), ids: new Map(), turmasEstudantes: new Map() };

function getCacheScope() {
  const user = getCurrentUser();
  return user?.id ?? 'anon';
}

// Retira a entrada mais antiga do Map e re-insere por último (LRU).
function cacheGet(map, key) {
  if (!map.has(key)) return undefined;
  const value = map.get(key);
  map.delete(key);
  map.set(key, value);
  return value;
}

// Insere respeitando o limite de entradas (evita a mais antiga).
function cacheSet(map, key, value, limit) {
  map.set(key, value);
  while (map.size > limit) {
    const oldest = map.keys().next().value;
    map.delete(oldest);
  }
}

// Cache em memória + singleflight: chamadas concorrentes com a mesma chave
// compartilham a mesma Promise (mesma rede), e resultados são reutilizados
// entre telas que usam os mesmos filtros.
function comCache(cacheMap, inFlightMap, key, limit, inicio) {
  const pendente = inFlightMap.get(key);
  if (pendente) return pendente;
  if (cacheMap.has(key)) return Promise.resolve(cacheGet(cacheMap, key));
  const p = inicio()
    .then(val => {
      cacheSet(cacheMap, key, val, limit);
      return val;
    })
    .finally(() => {
      inFlightMap.delete(key);
    });
  inFlightMap.set(key, p);
  return p;
}

// Serializa o filtro SQL efetivo de forma ordenada/determinística, para que
// telas diferentes gerem a mesma chave de cache para o mesmo conjunto
// selecionado de turmas/alocações.
function chaveFiltro(f) {
  if (!f) return 'all';
  const partes = {};
  if (f.estudante_id != null) partes.e = Number(f.estudante_id);
  if (Array.isArray(f.alocacao_ids)) partes.a = [...f.alocacao_ids].map(Number).sort((a, b) => a - b);
  if (Array.isArray(f.turma_ids)) partes.t = [...f.turma_ids].map(Number).sort((a, b) => a - b);
  return JSON.stringify(partes);
}

// Chave do cache de linhas: tabela + colunas (ordenadas/dedupe) + filtro
// efetivo + escopo do usuário logado.
function chaveConsulta(tabela, selectFields, f, extra = '') {
  const cols = [...new Set(selectFields.split(',').map(s => s.trim()).filter(Boolean))].sort().join(',');
  return `${tabela}|${cols}|${chaveFiltro(f)}|${getCacheScope()}|${extra}`;
}

function notasPreenchidas(n1, n2, n3, n4) {
  return [n1, n2, n3, n4].map(v => parseFloat(v)).filter(v => !isNaN(v));
}

function calcularMediaAcumulada(n1, n2, n3, n4, periodicidade) {
  const notas = notasPreenchidas(n1, n2, n3, n4);
  if (!notas.length) return 0;
  if (periodicidade && periodicidade !== 'Anual') {
    return Math.round((notas.reduce((a, b) => a + b, 0) / 2) * 10) / 10;
  }
  return Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10;
}

function calcularSituacao(n1, n2, n3, n4, periodicidade) {
  const notas = notasPreenchidas(n1, n2, n3, n4);
  const media = notas.length
    ? (periodicidade && periodicidade !== 'Anual'
        ? notas.reduce((a, b) => a + b, 0) / 2
        : notas.reduce((a, b) => a + b, 0) / notas.length)
    : 0;
  if (notas.length >= 2 && periodicidade && periodicidade !== 'Anual') return media >= 6 ? 'Aprovado' : 'Recuperação Final';
  if (notas.length >= 4) return media >= 6 ? 'Aprovado' : 'Recuperação Final';
  return media >= 6 ? 'Em Aprovação' : 'Em Recuperação';
}

// Uma disciplina é considerada "sem nota lançada" apenas quando nenhum bimestre
// possui nota lançada (nem mesmo 0) e a média final também não foi preenchida.
// Uma nota 0 é uma nota lançada e, portanto, a disciplina não é vazia.
function disciplinaVazia(n) {
  if (notasPreenchidas(n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim).length) return false;
  const mf = parseFloat(n.media_final);
  return isNaN(mf);
}

export async function getRefCache() {
  if (refCache) return refCache;
  const [s, t, c, p, e] = await Promise.all([
    supabaseQuery('series', { select: 'id,nome,etapa_ensino_id' }),
    supabaseQuery('turmas', { select: 'id,nome,serie_id,turno' }),
    supabaseQuery('componentes_curriculares', { select: 'id,nome' }),
    supabaseQuery('professores', { select: 'id,nome' }),
    supabaseQuery('etapas_ensino', { select: 'id,nome' }),
  ]);
  const a = await supabaseQuery('alocacoes', { select: 'id,turma_id,componente_id,professor_id' });
  const est = await supabaseFetchAll('estudantes', { select: 'id,id_pessoa,nome,matricula', limit: 30000 });
  refCache = {
    series: s.data || [],
    turmas: t.data || [],
    componentes: c.data || [],
    professores: p.data || [],
    etapas: e.data || [],
    alocacoes: a.data || [],
    estudantes: (est.data || []).filter(e => !String(e.nome || '').trim().startsWith('__')),
  };
  return refCache;
}

let permitidosPromise = null;

export function clearCache() {
  refCache = null;
  permitidosPromise = null;
  Object.values(rowCache).forEach(m => m.clear());
  Object.values(rowCacheInFlight).forEach(m => m.clear());
}

// Conjunto de estudantes que o usuário logado pode visualizar:
//  - Professor: estudantes com notas nas suas turmas (alocações);
//  - Professor do AEE: estudantes vinculados a ele (usuários) em
//    estudante_professores_aee.professor_usuario_id;
//  - demais perfis: null (todos).
// O resultado é cacheado como Promise para evitar corrida entre chamadas
// concorrentes (várias funções chamam isto em Promise.all).
export function getEstudantesPermitidos() {
  if (!permitidosPromise) {
    permitidosPromise = calcularEstudantesPermitidos();
  }
  return permitidosPromise;
}

async function calcularEstudantesPermitidos() {
  if (!isProfessor() && !isProfessorAee()) return null;
  if (isProfessorAee()) {
    const user = getCurrentUser();
    if (!user || user.id == null) return new Set();
    const { data: aee } = await supabaseFetchAll('estudante_professores_aee', {
      select: 'estudante_id_pessoa',
      filters: [{ col: 'professor_usuario_id', val: Number(user.id) }],
    });
    const idsExternos = new Set((aee || []).map(a => a.estudante_id_pessoa));
    await getRefCache();
    const set = new Set();
    refCache.estudantes.forEach(e => {
      if (e.id_pessoa != null && idsExternos.has(e.id_pessoa)) set.add(Number(e.id));
    });
    return set;
  }
  const vinculo = await getProfessorVinculo();
  if (!vinculo) return new Set();
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
    (notas || []).forEach(n => set.add(Number(n.estudante_id)));
  }
  for (let i = 0; i < vinculo.turmaIds.length; i += 100) {
    const chunk = vinculo.turmaIds.slice(i, i + 100);
    if (!chunk.length) continue;
    const { data: freqs } = await supabaseFetchAll('frequencias', {
      select: 'estudante_id',
      filters: [{ col: 'turma_id', val: chunk, op: 'in' }],
      limit: 30000,
    });
    (freqs || []).forEach(f => set.add(Number(f.estudante_id)));
  }
  return set;
}

// Turmas em que pelo menos um estudante do conjunto permitido possui
// notas ou frequência lançadas (usado pelo perfil Professor do AEE).
async function getTurmasDosEstudantes(permitidos) {
  const key = `turmas-estudantes|${getCacheScope()}`;
  return comCache(rowCache.turmasEstudantes, rowCacheInFlight.turmasEstudantes, key, ROW_CACHE_LIMIT.turmasEstudantes, async () => {
    const turmaIds = new Set();
    if (!permitidos || !permitidos.size) return turmaIds;
    await getRefCache();
    const alocTurma = {};
    refCache.alocacoes.forEach(a => { alocTurma[a.id] = a.turma_id; });
    const { data: notas } = await supabaseFetchAll('notas', { select: 'estudante_id,alocacao_id', limit: 30000 });
    (notas || []).forEach(n => {
      if (permitidos.has(Number(n.estudante_id))) {
        const tId = alocTurma[n.alocacao_id];
        if (tId != null) turmaIds.add(tId);
      }
    });
    const { data: freqs } = await supabaseFetchAll('frequencias', { select: 'estudante_id,turma_id', limit: 30000 });
    (freqs || []).forEach(f => {
      if (permitidos.has(Number(f.estudante_id))) turmaIds.add(f.turma_id);
    });
    return turmaIds;
  });
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
  if (isProfessorAee() && !selectFields.split(',').map(s => s.trim()).includes('estudante_id')) {
    selectFields += ',estudante_id';
  }
  const f = montarFiltrosNotas(filters);
  const key = chaveConsulta('notas', selectFields, f);
  return comCache(rowCache.notas, rowCacheInFlight.notas, key, ROW_CACHE_LIMIT.notas, async () => {
    let rows = [];
    if (!f) {
      const res = await supabaseFetchAll('notas', { select: selectFields });
      rows = res.data || [];
    } else if (f.alocacao_ids && f.alocacao_ids.length) {
      const res = await supabaseFetchAll('notas', {
        select: selectFields,
        filters: [{ col: 'alocacao_id', val: f.alocacao_ids, op: 'in' }],
      });
      rows = res.data || [];
    } else if (f.estudante_id) {
      const fil = [{ col: 'estudante_id', val: f.estudante_id }];
      if (f.alocacao_ids && f.alocacao_ids.length) {
        fil.push({ col: 'alocacao_id', val: f.alocacao_ids, op: 'in' });
      }
      const res = await supabaseFetchAll('notas', { select: selectFields, filters: fil });
      rows = res.data || [];
    }
    if (isProfessorAee()) {
      const permitidos = await getEstudantesPermitidos();
      if (permitidos) rows = rows.filter(n => permitidos.has(Number(n.estudante_id)));
    }
    return rows;
  });
}

async function queryFrequencias(filters, selectFields) {
  if (isProfessorAee() && !selectFields.split(',').map(s => s.trim()).includes('estudante_id')) {
    selectFields += ',estudante_id';
  }
  const f = montarFiltrosFrequencia(filters);
  const key = chaveConsulta('freqs', selectFields, f);
  return comCache(rowCache.freqs, rowCacheInFlight.freqs, key, ROW_CACHE_LIMIT.freqs, async () => {
    let rows = [];
    if (!f) {
      const res = await supabaseFetchAll('frequencias', { select: selectFields });
      rows = res.data || [];
    } else if (f.turma_ids && f.turma_ids.length) {
      const res = await supabaseFetchAll('frequencias', {
        select: selectFields,
        filters: [{ col: 'turma_id', val: f.turma_ids, op: 'in' }],
      });
      rows = res.data || [];
    } else if (f.estudante_id) {
      const fil = [{ col: 'estudante_id', val: f.estudante_id }];
      if (f.turma_ids && f.turma_ids.length) {
        fil.push({ col: 'turma_id', val: f.turma_ids, op: 'in' });
      }
      const res = await supabaseFetchAll('frequencias', { select: selectFields, filters: fil });
      rows = res.data || [];
    }
    if (isProfessorAee()) {
      const permitidos = await getEstudantesPermitidos();
      if (permitidos) rows = rows.filter(f => permitidos.has(Number(f.estudante_id)));
    }
    return rows;
  });
}

// ---- EXPORTED FUNCTIONS ----

async function getIdsEstudantesImportados(filters) {
  await getRefCache();
  const f = montarFiltrosNotas(filters);
  const key = chaveConsulta('ids', 'estudante_id', f);
  return comCache(rowCache.ids, rowCacheInFlight.ids, key, ROW_CACHE_LIMIT.ids, async () => {
    let ids = new Set(refCache.estudantes.map(e => e.id));
    const permitidos = await getEstudantesPermitidos();
    if (permitidos) ids = new Set([...ids].filter(id => permitidos.has(Number(id))));
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
    return ids;
  });
}

async function getEstudantesImportados(filters) {
  return (await getIdsEstudantesImportados(filters)).size;
}

// Classifica cada estudante pela frequência e pela quantidade de disciplinas
// com média inferior a 6,0:
//  - Reprovado:     frequência < 75% ou mais de 6 disciplinas abaixo
//  - Recuperação:   1 a 6 disciplinas abaixo (com frequência ≥ 75%)
//  - Aprovado:      nenhuma disciplina abaixo (com frequência ≥ 75%)
// Disciplinas sem nenhuma nota lançada não entram na Média Geral nem contam
// como disciplina abaixo; apenas estudantes sem nenhuma nota lançada em
// nenhuma disciplina (todas as linhas vazias) ficam no grupo "Sem Notas
// Lançadas" e não entram na classificação.
async function classificarEstudantes(filters) {
  await getRefCache();
  const [idsEstudantes, notas, freqs] = await Promise.all([
    getIdsEstudantesImportados(filters),
    queryNotas(filters, 'estudante_id,nota_1bim,nota_2bim,nota_3bim,nota_4bim,media_final,periodicidade'),
    queryFrequencias(filters, 'estudante_id,percentual_frequencia'),
  ]);

  const periodo = notas.some(n => {
    const v = parseFloat(n.nota_4bim);
    return !isNaN(v);
  }) ? 'anual' : 'parcial';

  const medias = {};
  const qtdAbaixo = {};
  notas.forEach(n => {
    if (disciplinaVazia(n)) return;

    const mf = isNaN(parseFloat(n.media_final)) ? 0 : parseFloat(n.media_final);
    if (!medias[n.estudante_id]) medias[n.estudante_id] = { soma: 0, count: 0 };
    medias[n.estudante_id].soma += mf;
    medias[n.estudante_id].count++;

    let media = calcularMediaAcumulada(n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim, n.periodicidade);
    if (media === 0) {
      const mf2 = parseFloat(n.media_final);
      if (!isNaN(mf2) && mf2 > 0) media = mf2;
    }
    if (media < 6) {
      if (!qtdAbaixo[n.estudante_id]) qtdAbaixo[n.estudante_id] = 0;
      qtdAbaixo[n.estudante_id]++;
    }
  });

  const freqsPorEstudante = {};
  freqs.forEach(f => {
    const p = parseFloat(f.percentual_frequencia);
    if (isNaN(p)) return;
    if (!freqsPorEstudante[f.estudante_id]) freqsPorEstudante[f.estudante_id] = { soma: 0, count: 0 };
    freqsPorEstudante[f.estudante_id].soma += p;
    freqsPorEstudante[f.estudante_id].count++;
  });

  const idsSemNota = new Set([...idsEstudantes].filter(id =>
    !medias[id]
  ).map(id => String(id)));

  const classificacao = {};
  Object.entries(medias).forEach(([eId, m]) => {
    if (idsSemNota.has(eId)) return;
    const f = freqsPorEstudante[eId];
    const frequencia = f ? f.soma / f.count : null;
    const qtd = qtdAbaixo[eId] || 0;
    if (frequencia != null && frequencia < 75) classificacao[eId] = 'reprovado';
    else if (qtd > 6) classificacao[eId] = 'reprovado';
    else if (qtd >= 1) classificacao[eId] = 'recuperacao';
    else classificacao[eId] = 'aprovado';
  });

  return { classificacao, medias, frequenciasPorEstudante: freqsPorEstudante, totalNotas: notas.length, periodo, idsSemNota };
}

export async function getResumoGeral(filters = {}) {
  await getRefCache();
  const [totalEstudantes, dados, frequencias] = await Promise.all([
    getEstudantesImportados(filters),
    classificarEstudantes(filters),
    queryFrequencias(filters, 'percentual_frequencia,estudante_id'),
  ]);
  const { classificacao, medias, idsSemNota } = dados;

  const valoresMedias = Object.values(medias).map(m => m.soma / m.count);
  const mediaGeral = valoresMedias.length ? valoresMedias.reduce((a, b) => a + b, 0) / valoresMedias.length : 0;

  let aprovados = 0, reprovados = 0, recuperacao = 0;
  Object.values(classificacao).forEach(c => {
    if (c === 'aprovado') aprovados++;
    else if (c === 'recuperacao') recuperacao++;
    else reprovados++;
  });
  const semNotas = idsSemNota.size;
  const base = totalEstudantes || 1;
  const classificados = aprovados + recuperacao + reprovados;

  let freqMedia = 0, freqCount = 0, somaFreq = 0;
  frequencias.forEach(f => {
    const p = parseFloat(f.percentual_frequencia);
    if (!isNaN(p)) { somaFreq += p; freqCount++; }
  });
  freqMedia = freqCount ? somaFreq / freqCount : 0;

  const turmaSet = montarTurmasFiltradas(filters);
  let totalTurmas = turmaSet ? turmaSet.size : refCache.turmas.length;
  if (isProfessorAee()) {
    const permitidos = await getEstudantesPermitidos();
    totalTurmas = (await getTurmasDosEstudantes(permitidos)).size;
  }

  return {
    total_estudantes: totalEstudantes,
    total_turmas: totalTurmas,
    media_geral: Math.round(mediaGeral * 10) / 10,
    frequencia_media: Math.round(freqMedia * 10) / 10,
    aprovacao_pct: classificados ? Math.round(aprovados / classificados * 1000) / 10 : 0,
    reprovacao_pct: classificados ? Math.round(reprovados / classificados * 1000) / 10 : 0,
    recuperacao_pct: classificados ? Math.round(recuperacao / classificados * 1000) / 10 : 0,
    total_aprovacao: aprovados,
    total_recuperacao: recuperacao,
    total_reprovacao: reprovados,
    sem_notas: semNotas,
    sem_notas_pct: Math.round(semNotas / base * 1000) / 10,
    total_notas: dados.totalNotas,
    periodo: dados.periodo,
  };
}

export async function getResultadoFinal(filters = {}) {
  const { classificacao, periodo, idsSemNota } = await classificarEstudantes(filters);

  let aprov = 0, repr = 0, recup = 0;
  Object.values(classificacao).forEach(c => {
    if (c === 'aprovado') aprov++;
    else if (c === 'recuperacao') recup++;
    else repr++;
  });

  return { data: { aprovados: aprov, reprovados: repr, recuperacao: recup, sem_notas: idsSemNota.size, periodo }, error: null };
}

export async function getDetalheResultados(filters = {}) {
  await getRefCache();
  const [notas, dados] = await Promise.all([
    queryNotas(filters, 'estudante_id,alocacao_id,nota_1bim,nota_2bim,nota_3bim,nota_4bim,media_final,resultado_final,periodicidade'),
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
    if (disciplinaVazia(n)) return;
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
      media_acumulada: calcularMediaAcumulada(n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim, n.periodicidade),
      situacao: calcularSituacao(n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim, n.periodicidade),
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
// 6 disciplinas com média < 6,0). Disciplinas sem nenhuma nota lançada não
// entram nos relatórios; apenas estudantes sem nenhuma nota lançada em nenhuma
// disciplina (todas as linhas vazias) ficam no relatório "Sem Notas Lançadas".
export async function getDetalheSituacao(filters = {}) {
  await getRefCache();
  const [idsEstudantes, notas, freqs] = await Promise.all([
    getIdsEstudantesImportados(filters),
    queryNotas(filters, 'estudante_id,alocacao_id,nota_1bim,nota_2bim,nota_3bim,nota_4bim,media_final,periodicidade'),
    queryFrequencias(filters, 'estudante_id,percentual_frequencia'),
  ]);

  const alocComp = {}; refCache.alocacoes.forEach(a => alocComp[a.id] = a.componente_id);
  const alocTurma = {}; refCache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);
  const cMap = {}; refCache.componentes.forEach(c => cMap[c.id] = c.nome);
  const tMap = {}; refCache.turmas.forEach(t => tMap[t.id] = t.nome);
  const eMap = {}; refCache.estudantes.forEach(e => eMap[e.id] = e);

  const porEstudante = {};
  notas.forEach(n => {
    if (disciplinaVazia(n)) return;
    const compId = alocComp[n.alocacao_id];
    const turmaId = alocTurma[n.alocacao_id];
    let media = calcularMediaAcumulada(n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim, n.periodicidade);
    if (media === 0) {
      const mf = parseFloat(n.media_final);
      if (!isNaN(mf) && mf > 0) media = mf;
    }
    if (!porEstudante[n.estudante_id]) porEstudante[n.estudante_id] = { disciplinas: [], turmas: new Set() };
    const reg = porEstudante[n.estudante_id];
    reg.disciplinas.push({ nome: cMap[compId] || 'N/I', media });
    const nomeTurma = tMap[turmaId];
    if (nomeTurma) reg.turmas.add(nomeTurma);
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
  const semNotas = [];

  idsEstudantes.forEach(id => {
    const e = eMap[id];
    const dados = porEstudante[id];
    const nome = e?.nome || `ID ${id}`;
    const matricula = e?.matricula || '-';

    if (!dados || !dados.disciplinas.length) {
      semNotas.push({ estudante: nome, matricula, turma: '-', disciplina: '-', professor: '-' });
      return;
    }

    const freqData = freqPorEstudante[id];
    const frequencia = freqData ? Math.round((freqData.soma / freqData.count) * 10) / 10 : null;
    const emRecuperacao = dados.disciplinas.filter(d => d.media < 6).sort((a, b) => a.media - b.media);
    const qtd = emRecuperacao.length;
    const freqBaixa = frequencia != null && frequencia < 75;

    const base = {
      estudante: nome,
      matricula,
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
        const mediasArr = dados.disciplinas.map(d => d.media);
        aprovados.push({
          estudante: base.estudante,
          matricula: base.matricula,
          turma: base.turma,
          frequencia: base.frequencia,
          mediaGeral: Math.round((mediasArr.reduce((a, b) => a + b, 0) / mediasArr.length) * 10) / 10,
          menor: Math.min(...mediasArr),
          maior: Math.max(...mediasArr),
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

  semNotas.sort((a, b) =>
    a.estudante.localeCompare(b.estudante, 'pt-BR') ||
    a.disciplina.localeCompare(b.disciplina, 'pt-BR')
  );

  return { data: { aprovados, reprovados, recuperacao, semNotas }, error: null };
}

export async function getMediaPorTurma(filters = {}) {
  await getRefCache();
  const notas = await queryNotas(filters, 'media_final,alocacao_id');
  const alocTurma = {}; refCache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);
  const turmaMap = {}; refCache.turmas.forEach(t => turmaMap[t.id] = t.nome);

  const grupos = {};
  notas.forEach(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf)) return;
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
    if (isNaN(mf)) return;
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

// Notas de cada estudante em uma turma + disciplina específica (tabela do
// Dashboard de Desempenho). Retorna vazio quando turma e disciplina não
// estão selecionadas. Respeita as permissões de perfil (queryNotas).
export async function getNotasTurmaDisciplina(filters = {}) {
  if (!filters.turma_id || !filters.componente_id) return { data: [], meta: null, error: null };
  await getRefCache();
  const notas = await queryNotas(filters, 'estudante_id,alocacao_id,nota_1bim,nota_2bim,nota_3bim,nota_4bim,media_final,resultado_final,periodicidade');

  const eMap = {}; refCache.estudantes.forEach(e => eMap[e.id] = e);
  const alocComp = {}; refCache.alocacoes.forEach(a => alocComp[a.id] = a.componente_id);
  const cMap = {}; refCache.componentes.forEach(c => cMap[c.id] = c.nome);
  const tMap = {}; refCache.turmas.forEach(t => tMap[t.id] = t.nome);
  const alocProf = {}; refCache.alocacoes.forEach(a => alocProf[a.id] = a.professor_id);
  const pMap = {}; refCache.professores.forEach(p => pMap[p.id] = p.nome);

  const data = notas.map(n => {
    const temNota = [n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim].some(v => !isNaN(parseFloat(v)));
    const e = eMap[n.estudante_id];
    return {
      estudante: e?.nome || `ID ${n.estudante_id}`,
      matricula: e?.matricula || '-',
      disciplina: cMap[alocComp[n.alocacao_id]] || 'N/I',
      nota_1bim: n.nota_1bim,
      nota_2bim: n.nota_2bim,
      nota_3bim: n.nota_3bim,
      nota_4bim: n.nota_4bim,
      media_final: n.media_final,
      media_acumulada: temNota ? calcularMediaAcumulada(n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim, n.periodicidade) : null,
      situacao: temNota ? calcularSituacao(n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim, n.periodicidade) : 'Sem Notas',
    };
  }).sort((a, b) =>
    a.estudante.localeCompare(b.estudante, 'pt-BR') ||
    a.disciplina.localeCompare(b.disciplina, 'pt-BR')
  );

  const aloc = refCache.alocacoes.find(a =>
    String(a.turma_id) === String(filters.turma_id) && String(a.componente_id) === String(filters.componente_id)
  );
  const professor = aloc ? (pMap[aloc.professor_id] || `Prof ${aloc.professor_id}`) : null;

  return {
    data,
    meta: {
      turma: tMap[Number(filters.turma_id)] || 'Turma',
      disciplina: cMap[Number(filters.componente_id)] || 'Disciplina',
      professor,
    },
    error: null,
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
    if (isNaN(mf)) return;
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
    const v1 = parseFloat(n.nota_1bim), v2 = parseFloat(n.nota_2bim), v3 = parseFloat(n.nota_3bim), v4 = parseFloat(n.nota_4bim);
    if (!isNaN(v1)) b1.push(v1);
    if (!isNaN(v2)) b2.push(v2);
    if (!isNaN(v3)) b3.push(v3);
    if (!isNaN(v4)) b4.push(v4);
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
    if (isNaN(mf)) return;
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
    if (isNaN(mf)) return;
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
    if (isNaN(mf)) return;
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
    pontos.push({
      estudante_id: eId,
      nome: eMap[eId]?.nome || `ID ${eId}`,
      matricula: eMap[eId]?.matricula || '-',
      media: Math.round(mediaNota * 10) / 10,
      frequencia: Math.round(mediaFreq * 10) / 10,
    });
  });

  return { data: pontos, error: null };
}

export async function getNotasEstudante(estudanteId) {
  if (!(await podeVerEstudante(estudanteId))) return { data: [], error: null };
  const { data: notas } = await supabaseQuery('notas', {
    select: 'nota_1bim,nota_2bim,nota_3bim,nota_4bim,media_final,alocacao_id,periodicidade',
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
    media_acumulada: calcularMediaAcumulada(n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim, n.periodicidade),
    situacao: calcularSituacao(n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim, n.periodicidade),
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

// Carrega as turmas disponíveis para consulta conforme o perfil do usuário:
// professor vê apenas as turmas em que está alocado; demais perfis veem todas.
export async function listarTurmasParaConsulta() {
  await getRefCache();
  const serieMap = {};
  refCache.series.forEach(s => serieMap[s.id] = s.nome);
  const map = t => ({ id: t.id, nome: t.nome, serie: serieMap[t.serie_id] || '', serie_id: t.serie_id, turno: t.turno || '' });

  if (isProfessor()) {
    const vinculo = await getProfessorVinculo();
    if (!vinculo) return [];
    return vinculo.turmas.map(map).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  if (isProfessorAee()) {
    const permitidos = await getEstudantesPermitidos();
    if (!permitidos || !permitidos.size) return [];
    const turmaIds = await getTurmasDosEstudantes(permitidos);
    return refCache.turmas.filter(t => turmaIds.has(t.id)).map(map).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  return refCache.turmas.map(map).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// Lista os estudantes de uma turma (via notas -> alocações e via frequências),
// respeitando as permissões do perfil do usuário.
export async function listarEstudantesPorTurma(turmaId) {
  await getRefCache();
  const ids = new Set();

  const alocIds = refCache.alocacoes.filter(a => String(a.turma_id) === String(turmaId)).map(a => a.id);
  for (let i = 0; i < alocIds.length; i += 100) {
    const chunk = alocIds.slice(i, i + 100);
    if (!chunk.length) continue;
    const { data: notas } = await supabaseFetchAll('notas', {
      select: 'estudante_id',
      filters: [{ col: 'alocacao_id', val: chunk, op: 'in' }],
      limit: 30000,
    });
    (notas || []).forEach(n => ids.add(Number(n.estudante_id)));
  }

  const { data: freqs } = await supabaseFetchAll('frequencias', {
    select: 'estudante_id',
    filters: [{ col: 'turma_id', val: turmaId }],
    limit: 30000,
  });
  (freqs || []).forEach(f => ids.add(Number(f.estudante_id)));

  const permitidos = await getEstudantesPermitidos();
  const idList = [...ids].filter(id => !permitidos || permitidos.has(Number(id)));

  const eMap = new Map();
  for (let i = 0; i < idList.length; i += 100) {
    const chunk = idList.slice(i, i + 100);
    if (!chunk.length) continue;
    const { data: ests } = await supabaseQuery('estudantes', {
      select: 'id,nome,matricula',
      filters: [{ col: 'id', val: chunk, op: 'in' }],
      limit: 100,
    });
    (ests || []).forEach(e => eMap.set(Number(e.id), e));
  }

  return idList
    .map(id => ({ id, nome: eMap.get(id)?.nome || `ID ${id}`, matricula: eMap.get(id)?.matricula || '-' }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
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
