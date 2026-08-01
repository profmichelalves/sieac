import { renderFilterPanel, getCurrentFilters } from '../components/FilterPanel.js';
import { supabaseFetchAll, supabaseQuery } from '../services/supabase.js';
import { gerarPdfRelatorio } from '../utils/pdf.js';
import { infoBtn, EXPLICACAO_RESULTADO } from '../utils/explanation.js';

let relLinhas = [];
let relSortKey = 'aluno';
let relDataHora = '';
let relFiltros = [];

function notasPreenchidas(n1, n2, n3, n4) {
  return [n1, n2, n3, n4].map(v => parseFloat(v)).filter(v => !isNaN(v));
}

// Uma disciplina é considerada "sem nota lançada" apenas quando nenhum bimestre
// possui nota lançada (nem mesmo 0) e a média final também não foi preenchida.
function disciplinaVazia(n) {
  if (notasPreenchidas(n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim).length) return false;
  const mf = parseFloat(n.media_final);
  return isNaN(mf);
}

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <style>
      .report-toolbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
      .report-toolbar-label {
        font-size:0.85rem; color:var(--sieac-text-muted);
        display:inline-flex; align-items:center; gap:6px;
      }
      .sort-btn {
        border-radius:var(--sieac-radius-pill) !important;
        font-size:0.8rem !important; padding:4px 16px !important;
      }
    </style>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div>
        <div class="page-title">Relatório de Notas Não Lançadas ${infoBtn('Relatório de Notas Não Lançadas', 'Lista os alunos dos filtros selecionados que possuem alguma disciplina com nota não lançada (nenhum bimestre preenchido e média final vazia; uma nota 0 lançada não conta como vazia). Cada linha representa uma disciplina sem nota lançada de um aluno, informando a turma e o professor responsável.' + EXPLICACAO_RESULTADO)}</div>
        <div class="page-subtitle">Alunos com disciplina(s) sem nota lançada</div>
      </div>
      <button class="btn btn-primary no-print" id="btn-gerar-pdf">
        <i class="bi bi-file-earmark-pdf"></i> Gerar PDF
      </button>
    </div>

    <div id="filter-container-sem-notas" class="no-print"></div>

    <div class="report-toolbar no-print">
      <span class="report-toolbar-label"><i class="bi bi-sort-down"></i> Ordenar por:</span>
      <button class="btn btn-sm btn-primary sort-btn" data-sort="aluno">Aluno</button>
      <button class="btn btn-sm btn-outline-secondary sort-btn" data-sort="disciplina">Disciplina</button>
      <button class="btn btn-sm btn-outline-secondary sort-btn" data-sort="turma">Turma</button>
      <span id="rel-resumo" class="report-toolbar-label" style="margin-left:auto;"></span>
    </div>
  `;

  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      relSortKey = btn.dataset.sort;
      document.querySelectorAll('.sort-btn').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline-secondary');
      });
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-outline-secondary');
    });
  });

  document.getElementById('btn-gerar-pdf').addEventListener('click', gerarPDF);

  await renderFilterPanel('filter-container-sem-notas', () => loadData());
  await loadData();
}

async function getCache() {
  const [s, t, c, p, a, e] = await Promise.all([
    supabaseFetchAll('series', { select: 'id,nome,etapa_ensino_id' }),
    supabaseFetchAll('turmas', { select: 'id,nome,serie_id,turno' }),
    supabaseFetchAll('componentes_curriculares', { select: 'id,nome' }),
    supabaseFetchAll('professores', { select: 'id,nome' }),
    supabaseFetchAll('alocacoes', { select: 'id,turma_id,componente_id,professor_id' }),
    supabaseFetchAll('estudantes', { select: 'id,nome,matricula', limit: 30000 }),
  ]);
  return {
    series: s.data || [],
    turmas: t.data || [],
    componentes: c.data || [],
    professores: p.data || [],
    alocacoes: a.data || [],
    estudantes: e.data || [],
  };
}

function aplicarFiltros(notas, filters, cache) {
  if (!filters || !Object.keys(filters).length) return notas;
  let alocIds = new Set(cache.alocacoes.map(a => a.id));
  if (filters.etapa_id) {
    const serieIds = new Set(cache.series.filter(s => s.etapa_ensino_id == filters.etapa_id).map(s => s.id));
    const tIds = new Set(cache.turmas.filter(t => serieIds.has(t.serie_id)).map(t => t.id));
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.some(a => a.id === id && tIds.has(a.turma_id))));
  }
  if (filters.serie_id) {
    const tIds = new Set(cache.turmas.filter(t => t.serie_id == filters.serie_id).map(t => t.id));
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.some(a => a.id === id && tIds.has(a.turma_id))));
  }
  if (filters.turma_id) {
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.some(a => a.id === id && a.turma_id == filters.turma_id)));
  }
  if (filters.turno) {
    const tIds = new Set(cache.turmas.filter(t => t.turno == filters.turno).map(t => t.id));
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.some(a => a.id === id && tIds.has(a.turma_id))));
  }
  if (filters.componente_id) {
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.some(a => a.id === id && a.componente_id == filters.componente_id)));
  }
  if (filters.professor_id) {
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.some(a => a.id === id && a.professor_id == filters.professor_id)));
  }
  return notas.filter(n => alocIds.has(n.alocacao_id));
}

async function loadData() {
  const filters = getCurrentFilters();
  const cache = await getCache();

  relDataHora = new Date().toLocaleString('pt-BR');
  const filtrosAtivos = [];
  if (filters.etapa_id) {
    const { data: etapas } = await supabaseQuery('etapas_ensino', { select: 'nome', filters: [{ col: 'id', val: filters.etapa_id }] });
    if (etapas && etapas[0]) filtrosAtivos.push(`Etapa: ${etapas[0].nome}`);
  }
  if (filters.serie_id) {
    const { data: s } = await supabaseQuery('series', { select: 'nome', filters: [{ col: 'id', val: filters.serie_id }] });
    if (s && s[0]) filtrosAtivos.push(`Série: ${s[0].nome}`);
  }
  if (filters.turma_id) {
    const t = cache.turmas.find(x => x.id == filters.turma_id);
    if (t) filtrosAtivos.push(`Turma: ${t.nome}`);
  }
  if (filters.turno) filtrosAtivos.push(`Turno: ${filters.turno}`);
  if (filters.componente_id) {
    const c = cache.componentes.find(x => x.id == filters.componente_id);
    if (c) filtrosAtivos.push(`Disciplina: ${c.nome}`);
  }
  if (filters.professor_id) {
    const { data: profs } = await supabaseQuery('professores', { select: 'nome', filters: [{ col: 'id', val: filters.professor_id }] });
    if (profs && profs[0]) filtrosAtivos.push(`Professor: ${profs[0].nome}`);
  }
  relFiltros = filtrosAtivos;

  const { data: notas } = await supabaseFetchAll('notas', { select: 'estudante_id,alocacao_id,nota_1bim,nota_2bim,nota_3bim,nota_4bim,media_final' });
  const filtradas = aplicarFiltros(notas || [], filters, cache);

  const alocComp = {}; cache.alocacoes.forEach(a => alocComp[a.id] = a.componente_id);
  const alocTurma = {}; cache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);
  const alocProf = {}; cache.alocacoes.forEach(a => alocProf[a.id] = a.professor_id);
  const compMap = {}; cache.componentes.forEach(c => compMap[c.id] = c.nome);
  const turmaMap = {}; cache.turmas.forEach(t => turmaMap[t.id] = t.nome);
  const profMap = {}; cache.professores.forEach(p => profMap[p.id] = p.nome);
  const estMap = {}; cache.estudantes.forEach(e => estMap[e.id] = e);

  const linhas = [];
  filtradas.forEach(n => {
    if (!disciplinaVazia(n)) return;
    const estudante = estMap[n.estudante_id];
    if (!estudante) return;
    const cId = alocComp[n.alocacao_id];
    const tId = alocTurma[n.alocacao_id];
    const pId = alocProf[n.alocacao_id];
    linhas.push({
      estudante_id: n.estudante_id,
      aluno: estudante.nome,
      matricula: estudante.matricula || '-',
      disciplina: compMap[cId] || `Disciplina ${cId}`,
      turma: turmaMap[tId] || `Turma ${tId}`,
      professor: profMap[pId] || 'N/I',
    });
  });

  relLinhas = linhas;

  const resumo = document.getElementById('rel-resumo');
  if (resumo) {
    const alunos = new Set(linhas.map(l => l.estudante_id)).size;
    resumo.innerHTML = `<i class="bi bi-info-circle"></i> ${alunos} aluno(s) com ${linhas.length} disciplina(s) sem nota lançada`;
  }
}

function ordenarLinhas(linhas, sortKey) {
  const secundarias = {
    aluno: ['disciplina', 'turma'],
    disciplina: ['turma', 'aluno'],
    turma: ['disciplina', 'aluno'],
  };
  const chaves = [sortKey, ...(secundarias[sortKey] || [])];
  return [...linhas].sort((a, b) => {
    for (const k of chaves) {
      const c = String(a[k] || '').localeCompare(String(b[k] || ''), 'pt-BR');
      if (c) return c;
    }
    return 0;
  });
}

async function gerarPDF() {
  await loadData();
  if (!relLinhas.length) {
    alert('Nenhum aluno com disciplina sem nota lançada para os filtros selecionados.');
    return;
  }
  const ordenadas = ordenarLinhas(relLinhas, relSortKey);
  const totalAlunos = new Set(relLinhas.map(l => l.estudante_id)).size;
  const meta = [`Gerado em: ${relDataHora}`];
  if (relFiltros.length) meta.push(`Filtros: ${relFiltros.join(' | ')}`);

  gerarPdfRelatorio({
    titulo: 'RELATÓRIO DE NOTAS NÃO LANÇADAS — SIEAC',
    subtitulo: 'Sistema de Indicadores Educacionais Abel Coelho',
    meta,
    tabelas: [{
      titulo: 'Alunos com Disciplinas sem Nota Lançada',
      colunas: ['Aluno', 'Matrícula', 'Disciplina', 'Turma', 'Professor'],
      linhas: ordenadas.map(l => [l.aluno, l.matricula, l.disciplina, l.turma, l.professor]),
      colWidths: { 0: 30, 1: 16, 2: 34, 3: 18, 4: 28 },
      total: `Total — ${totalAlunos} aluno(s) com ${ordenadas.length} disciplina(s) sem nota lançada`,
    }],
  });
}
