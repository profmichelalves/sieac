import { supabaseFetchAll } from '../services/supabase.js';
import { getRefCache, getEstudantesPermitidos } from './dashboardRepository.js';
import { media, mediana, desvioPadraoPop, coefVariacao } from '../utils/statistics.js';

const MEDIA_CORTE = 6;
let refCache = null;

// ---- Helpers de filtro (cópia enxuta de dashboardRepository, sem cache) ----
// Como a página Estatísticas é restrita ao Administrador, não há filtro de
// professor/perfil; os filtros derivam apenas das alocações/turmas.

function montarAlocIds(filters) {
  const cache = refCache;
  if (!cache) return null;
  if (!filters || Object.keys(filters).length === 0) return null;
  let alocIds = new Set(cache.alocacoes.map(a => a.id));

  const filtrarPorTurmas = turmaIds => {
    alocIds = new Set([...alocIds].filter(id => turmaIds.has(cache.alocacoes.find(a => a.id === id)?.turma_id)));
  };
  const turmasDeSerie = serieIds => new Set((cache.turmas || []).filter(t => serieIds.has(t.serie_id)).map(t => t.id));

  if (filters.etapa_id) {
    const serieIds = new Set((cache.series || []).filter(s => s.etapa_ensino_id == filters.etapa_id).map(s => s.id));
    filtrarPorTurmas(turmasDeSerie(serieIds));
  }
  if (filters.serie_id) {
    filtrarPorTurmas(new Set((cache.turmas || []).filter(t => t.serie_id == filters.serie_id).map(t => t.id)));
  }
  if (filters.turma_id) {
    filtrarPorTurmas(new Set([Number(filters.turma_id)]));
  }
  if (filters.turno) {
    filtrarPorTurmas(new Set((cache.turmas || []).filter(t => t.turno == filters.turno).map(t => t.id)));
  }
  if (filters.componente_id) {
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.find(a => a.id === id)?.componente_id == filters.componente_id));
  }
  if (filters.professor_id) {
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.find(a => a.id === id)?.professor_id == filters.professor_id));
  }
  if (alocIds.size === cache.alocacoes.length) return null;
  return [...alocIds];
}

function montarTurmaIds(filters) {
  const cache = refCache;
  if (!cache) return null;
  if (!filters || Object.keys(filters).length === 0) return null;
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
  return [...turmaIds];
}

async function buscarNotas(filters, selectFields) {
  const alocIds = montarAlocIds(filters);
  const params = { select: selectFields };
  if (alocIds && alocIds.length) {
    params.filters = [{ col: 'alocacao_id', val: alocIds, op: 'in' }];
  }
  const res = await supabaseFetchAll('notas', params);
  return res.data || [];
}

async function buscarFrequencias(filters, selectFields) {
  const turmaIds = montarTurmaIds(filters);
  const params = { select: selectFields };
  if (turmaIds && turmaIds.length) {
    params.filters = [{ col: 'turma_id', val: turmaIds, op: 'in' }];
  }
  const res = await supabaseFetchAll('frequencias', params);
  return res.data || [];
}

function situacaoIndividuo(notasPorDisciplina, freqMedia) {
  const qtdAbaixo = notasPorDisciplina.filter(d => d.media < MEDIA_CORTE).length;
  const freqBaixa = freqMedia != null && freqMedia < 75;
  if (freqBaixa || qtdAbaixo > 6) return 'Reprovado';
  if (qtdAbaixo >= 1) return 'Recuperação';
  if (qtdAbaixo === 0 && notasPorDisciplina.length) return 'Aprovado';
  return 'Sem Notas';
}

// Dados agregados por estudante para predição/análise. Sem cache.
export async function getDadosMestres(filters = {}) {
  refCache = await getRefCache();
  const run = async () => {
    const [notas, freqs, permitidos] = await Promise.all([
      buscarNotas(filters, 'estudante_id,alocacao_id,nota_1bim,nota_2bim,nota_3bim,nota_4bim,media_final,periodicidade'),
      buscarFrequencias(filters, 'estudante_id,turma_id,mes_referencia,percentual_frequencia'),
      getEstudantesPermitidos(),
    ]);

    const alocComp = {}; refCache.alocacoes.forEach(a => alocComp[a.id] = a.componente_id);
    const alocTurma = {}; refCache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);
    const cMap = {}; refCache.componentes.forEach(c => cMap[c.id] = c.nome);
    const tMap = {}; refCache.turmas.forEach(t => tMap[t.id] = t.nome);
    const sMap = {}; refCache.series.forEach(s => sMap[s.id] = s.nome);
    const eMap = {}; refCache.estudantes.forEach(e => eMap[e.id] = e);

    const porEstudante = {};
    notas.forEach(n => {
      if (!porEstudante[n.estudante_id]) {
        porEstudante[n.estudante_id] = {
          disciplinas: [],
          turmas: new Set(),
          series: new Set(),
          bim1: [], bim2: [], bim3: [], bim4: [],
        };
      }
      const reg = porEstudante[n.estudante_id];
      const notasBim = [n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim].map(v => parseFloat(v));
      notasBim.forEach((v, i) => { if (!isNaN(v)) reg['bim' + (i + 1)].push(v); });
      const mediaD = media(notasBim.filter(v => !isNaN(v)));
      const mf = parseFloat(n.media_final);
      const mediaFinal = !isNaN(mf) && mf > 0 ? mf : mediaD;
      reg.disciplinas.push({ nome: cMap[alocComp[n.alocacao_id]] || 'N/I', media: isNaN(mediaFinal) ? 0 : mediaFinal });
      const tId = alocTurma[n.alocacao_id];
      if (tId != null) {
        const t = refCache.turmas.find(x => x.id === tId);
        if (t) { reg.turmas.add(t.nome); if (t.serie_id != null) reg.series.add(sMap[t.serie_id] || ''); }
      }
    });

    const freqPor = {};
    freqs.forEach(f => {
      const p = parseFloat(f.percentual_frequencia);
      if (isNaN(p)) return;
      if (!freqPor[f.estudante_id]) freqPor[f.estudante_id] = { valores: [], meses: [] };
      freqPor[f.estudante_id].valores.push(p);
      freqPor[f.estudante_id].meses.push(Number(f.mes_referencia) || 0);
    });

    const alunos = [];
    Object.keys(porEstudante).forEach(id => {
      const e = eMap[id];
      const reg = porEstudante[id];
      if (!reg.disciplinas.length && !freqPor[id]) return;
      const materias = reg.disciplinas.filter(d => d.media > 0);
      const materiasReais = materias.length ? materias : reg.disciplinas;
      const mediaGeral = media(materiasReais.map(d => d.media)) || 0;
      const f = freqPor[id];
      const freqMedia = f && f.valores.length ? media(f.valores) : null;
      alunos.push({
        id: Number(id),
        id_pessoa: e?.id_pessoa ?? null,
        nome: e?.nome || `ID ${id}`,
        matricula: e?.matricula || '-',
        turma: [...reg.turmas].sort((a, b) => a.localeCompare(b, 'pt-BR')).join(', '),
        serie: [...reg.series].filter(s => s).sort((a, b) => a.localeCompare(b, 'pt-BR')).join(', '),
        disciplinas: materiasReais.map(d => d.nome),
        qtdDisciplinas: materiasReais.length,
        mediaGeral,
        bim1: media(reg.bim1) || null,
        bim2: media(reg.bim2) || null,
        bim3: media(reg.bim3) || null,
        bim4: media(reg.bim4) || null,
        freqMedia,
        freqMeses: (f?.meses || []).map((mes, i) => ({ mes, percent: f.valores[i] })),
      });
    });

    alunos.forEach(a => {
      a.situacao = situacaoIndividuo(a.disciplinas.map(d => ({ media: d.media })), a.freqMedia);
    });

    const visiveis = permitidos ? alunos.filter(a => permitidos.has(Number(a.id))) : alunos;
    return { data: visiveis, error: null };
  };
  return run();
}

// Indicadores descritivos por turma (para boxplot/dispersão).
export async function getEstatisticasPorTurma(filters = {}) {
  const { data: alunos } = await getDadosMestres(filters);
  const porTurma = {};
  alunos.forEach(a => {
    const t = a.turma || 'Sem turma';
    if (!porTurma[t]) porTurma[t] = [];
    porTurma[t].push(a.mediaGeral);
  });
  const linhas = Object.entries(porTurma).map(([turma, valores]) => ({
    turma,
    n: valores.length,
    media: Math.round(media(valores) * 100) / 100,
    mediana: Math.round(mediana(valores) * 100) / 100,
    dp: Math.round(desvioPadraoPop(valores) * 100) / 100,
    cv: Math.round(coefVariacao(valores) * 100) / 100,
  })).sort((a, b) => b.media - a.media);
  return { data: linhas, error: null };
}

// Disciplinas críticas.
export async function getDisciplinasCriticas(filters = {}) {
  refCache = await getRefCache();
  const permitidos = await getEstudantesPermitidos();
  const notas = (await buscarNotas(filters, 'estudante_id,alocacao_id,nota_1bim,nota_2bim,nota_3bim,nota_4bim,media_final,periodicidade')).filter(n => !permitidos || permitidos.has(Number(n.estudante_id)));
  const alocComp = {}; refCache.alocacoes.forEach(a => alocComp[a.id] = a.componente_id);
  const alocTurma = {}; refCache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);
  const alocProf = {}; refCache.alocacoes.forEach(a => alocProf[a.id] = a.professor_id);
  const cMap = {}; refCache.componentes.forEach(c => cMap[c.id] = c.nome);
  const pMap = {}; refCache.professores.forEach(p => pMap[p.id] = p.nome);

  const porDisc = {};
  notas.forEach(n => {
    const cId = alocComp[n.alocacao_id];
    const nome = cMap[cId] || 'N/I';
    if (!porDisc[nome]) porDisc[nome] = { medias: [], abaixo: 0, professores: new Set(), total: 0 };
    const reg = porDisc[nome];
    reg.total++;
    const mf = parseFloat(n.media_final);
    const vals = [n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim].map(v => parseFloat(v)).filter(v => !isNaN(v));
    const m = !isNaN(mf) ? mf : media(vals);
    if (!isNaN(m)) {
      reg.medias.push(m);
      if (m < MEDIA_CORTE) reg.abaixo++;
    }
    const pId = alocProf[n.alocacao_id];
    if (pId != null) reg.professores.add(pMap[pId] || `Prof ${pId}`);
  });

  const linhas = Object.entries(porDisc).map(([disciplina, r]) => ({
    disciplina,
    total: r.total,
    mediacomnotas: r.medias.length,
    media: Math.round(media(r.medias) * 100) / 100,
    dp: Math.round(desvioPadraoPop(r.medias) * 100) / 100,
    cv: Math.round(coefVariacao(r.medias) * 100) / 100,
    qtdAbaixo: r.abaixo,
    pctAbaixo: r.medias.length ? Math.round((r.abaixo / r.medias.length) * 1000) / 10 : 0,
    professores: [...r.professores].join(', ') || '-',
  })).sort((a, b) => b.pctAbaixo - a.pctAbaixo || b.cv - a.cv);

  return { data: linhas, error: null };
}

// Ranking de professores (média, aprovação, alocações).
export async function getRankingProfessores(filters = {}) {
  refCache = await getRefCache();
  const permitidos = await getEstudantesPermitidos();
  const notas = (await buscarNotas(filters, 'estudante_id,alocacao_id,nota_1bim,nota_2bim,nota_3bim,nota_4bim,media_final')).filter(n => !permitidos || permitidos.has(Number(n.estudante_id)));
  const alocComp = {}; refCache.alocacoes.forEach(a => alocComp[a.id] = a.componente_id);
  const alocProf = {}; refCache.alocacoes.forEach(a => alocProf[a.id] = a.professor_id);
  const pMap = {}; refCache.professores.forEach(p => pMap[p.id] = p.nome);

  const porProf = {};
  notas.forEach(n => {
    const pId = alocProf[n.alocacao_id];
    const nome = pMap[pId] || `Prof ${pId}`;
    if (!porProf[nome]) porProf[nome] = { medias: [], aprovados: 0, alocacoes: new Set() };
    const reg = porProf[nome];
    const vals = [n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim].map(v => parseFloat(v)).filter(v => !isNaN(v));
    const m = vals.length ? media(vals) : NaN;
    if (!isNaN(m)) {
      reg.medias.push(m);
      if (m >= MEDIA_CORTE) reg.aprovados++;
    }
    reg.alocacoes.add(n.alocacao_id);
  });

  const linhas = Object.entries(porProf).map(([professor, r]) => ({
    professor,
    media: Math.round(media(r.medias) * 100) / 100,
    qtd: r.medias.length,
    aprovacao: r.medias.length ? Math.round((r.aprovados / r.medias.length) * 1000) / 10 : 0,
    alocacoes: r.alocacoes.size,
  })).sort((a, b) => b.media - a.media || b.aprovacao - a.aprovacao);

  return { data: linhas, error: null };
}

// Equidade NEE: compara com/sem NEE, por tipo e por professor AEE.
export async function getEquidadeNee(filters = {}) {
  refCache = await getRefCache();
  const [dados, tipoRes, neeRel, aeeRel, usuarios] = await Promise.all([
    getDadosMestres(filters),
    supabaseFetchAll('tipo_necessidades', { select: 'id,nome' }).then(r => r.data || []),
    supabaseFetchAll('estudante_necessidades', { select: 'estudante_id_pessoa,tipo_necessidade_id' }).then(r => r.data || []),
    supabaseFetchAll('estudante_professores_aee', { select: 'estudante_id_pessoa,professor_usuario_id' }).then(r => r.data || []),
    supabaseFetchAll('usuarios', { select: 'id,nome,matricula' }).then(r => r.data || []),
  ]);
  const alunos = dados.data || [];
  const tipoMap = {};
  (tipoRes || []).forEach(t => tipoMap[t.id] = t.nome);
  const neePorPessoa = {};
  (neeRel || []).forEach(r => {
    if (!neePorPessoa[r.estudante_id_pessoa]) neePorPessoa[r.estudante_id_pessoa] = [];
    if (tipoMap[r.tipo_necessidade_id]) neePorPessoa[r.estudante_id_pessoa].push(tipoMap[r.tipo_necessidade_id]);
  });
  const aeePorPessoa = {};
  (aeeRel || []).forEach(r => { if (r.estudante_id_pessoa != null) aeePorPessoa[r.estudante_id_pessoa] = r.professor_usuario_id; });
  const userMap = {};
  (usuarios || []).forEach(u => userMap[u.id] = { nome: u.nome, matricula: u.matricula });

  const comNee = { medias: [], freqs: [], aprovados: 0, total: 0 };
  const semNee = { medias: [], freqs: [], aprovados: 0, total: 0 };
  const porTipo = {};
  const porAee = {};

  alunos.forEach(a => {
    if (a.id_pessoa == null) return;
    const tipos = neePorPessoa[a.id_pessoa] || [];
    const temNee = tipos.length > 0;
    const mediaV = a.mediaGeral;
    const freqV = a.freqMedia;
    const aprovado = a.situacao === 'Aprovado';

    const alvo = temNee ? comNee : semNee;
    alvo.total++;
    if (!isNaN(mediaV)) { alvo.medias.push(mediaV); if (aprovado) alvo.aprovados++; }
    if (freqV != null) alvo.freqs.push(freqV);

    if (temNee) {
      tipos.forEach(t => {
        if (!porTipo[t]) porTipo[t] = { medias: [], freqs: [], aprovados: 0, total: 0 };
        const tt = porTipo[t];
        tt.total++;
        if (!isNaN(mediaV)) { tt.medias.push(mediaV); if (aprovado) tt.aprovados++; }
        if (freqV != null) tt.freqs.push(freqV);
      });
      const aeeId = aeePorPessoa[a.id_pessoa];
      const nomeAee = aeeId != null ? (userMap[aeeId]?.nome || `ID ${aeeId}`) : 'Sem professor AEE';
      if (!porAee[nomeAee]) porAee[nomeAee] = { medias: [], freqs: [], aprovados: 0, total: 0 };
      const pa = porAee[nomeAee];
      pa.total++;
      if (!isNaN(mediaV)) { pa.medias.push(mediaV); if (aprovado) pa.aprovados++; }
      if (freqV != null) pa.freqs.push(freqV);
    }
  });

  const resumo = prec => ({
    qtd: prec.total,
    media: prec.medias.length ? Math.round(media(prec.medias) * 100) / 100 : null,
    frequencia: prec.freqs.length ? Math.round(media(prec.freqs) * 100) / 100 : null,
    aprovacao: prec.total ? Math.round((prec.aprovados / prec.total) * 1000) / 10 : 0,
  });

  const tipos = Object.entries(porTipo).map(([tipo, v]) => ({ tipo, ...resumo(v) })).sort((a, b) => b.aprovacao - a.aprovacao);
  const aee = Object.entries(porAee).map(([prof, v]) => ({ professor: prof, ...resumo(v) })).sort((a, b) => b.aprovacao - a.aprovacao);

  return {
    data: {
      comNee: resumo(comNee),
      semNee: resumo(semNee),
      porTipo: tipos,
      porAee: aee,
    },
    error: null,
  };
}
