import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { supabaseFetchAll, supabaseQuery } from '../services/supabase.js';

const MEDIA_CORTE = 6;

let relLinhas = [];

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <style>
      @media print {
        body, html { background:#fff !important; }
        #sidebar-wrapper, .navbar, .page-title, .page-subtitle, #filter-container-relatorios,
        .btn-print, .kpi-card, .no-print { display:none !important; }
        #main-content { margin-left:0 !important; width:100% !important; }
        .report-container { box-shadow:none !important; padding:8px !important; }
        .report-header { margin-bottom:8px; padding-bottom:8px; }
        .report-header img { max-width:36px; height:36px; }
        .report-header h2 { font-size:1rem; }
        .report-header small { font-size:0.65rem; }
        .report-meta { margin-bottom:8px; font-size:0.7rem; }
        .report-meta span { margin-right:12px; }
        .report-section-title { margin:10px 0 4px; font-size:0.85rem; }
        .report-table { margin-bottom:0; }
        .report-table th { padding:2px 5px; font-size:0.62rem; }
        .report-table td { padding:1px 5px; font-size:0.68rem; }
        .report-table .col-situacao { display:none; }
        .report-table .group-header td { padding:2px 5px; font-size:0.7rem; }
        table { page-break-inside:auto; border-collapse:collapse; width:100%; }
        tr { page-break-inside:avoid; page-break-after:auto; }
        thead { display:table-header-group; }
        .print-only { display:block !important; }
        @page { margin: 8mm; }
      }
      .print-only { display:none; }
      .report-container {
        background:var(--sieac-surface); border-radius:var(--sieac-radius);
        padding:24px; box-shadow:var(--sieac-shadow); max-width:1100px;
      }
      .report-header {
        display:flex; align-items:center; gap:16px; margin-bottom:24px;
        padding-bottom:16px; border-bottom:2px solid var(--sieac-primary);
      }
      .report-header img { height:56px; }
      .report-header h2 { margin:0; font-size:1.3rem; color:var(--sieac-text); }
      .report-header small { color:var(--sieac-text-muted); font-size:0.8rem; }
      .report-meta { font-size:0.85rem; color:var(--sieac-text-muted); margin-bottom:20px; }
      .report-meta span { display:inline-block; margin-right:24px; }
      .report-toolbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
      .report-toolbar-label {
        font-size:0.85rem; color:var(--sieac-text-muted);
        display:inline-flex; align-items:center; gap:6px;
      }
      .sort-btn {
        border-radius:var(--sieac-radius-pill) !important;
        font-size:0.8rem !important; padding:4px 16px !important;
      }
      .report-table { width:100%; border-collapse:collapse; margin-bottom:28px; }
      .report-table th {
        background:#1a2a3a; color:#fff; padding:7px 10px;
        font-size:0.78rem; text-transform:uppercase; letter-spacing:0.5px;
        text-align:left; border:1px solid #2a3a4a;
      }
      .report-table td {
        padding:6px 10px; border:1px solid var(--sieac-border);
        font-size:0.82rem; color:var(--sieac-text);
      }
      .report-table tbody tr:nth-child(even):not(.group-header) { background:var(--sieac-bg); }
      .report-table .num { text-align:center; }
      .report-table .acima { color:var(--sieac-success); font-weight:600; }
      .report-table .abaixo { color:var(--sieac-danger); font-weight:600; }
      .report-table .group-header td {
        background:#1a2a3a; color:#fff; font-weight:700; font-size:0.85rem;
        padding:8px 10px;
      }
      .report-section-title {
        font-size:1rem; font-weight:600; color:var(--sieac-text);
        margin:24px 0 10px; padding-bottom:6px; border-bottom:1px solid var(--sieac-border);
      }
      .media-badge {
        display:inline-block; padding:2px 10px; border-radius:12px;
        font-size:0.78rem; font-weight:600;
      }
      .media-badge.acima { background:#d4edda; color:#155724; }
      .media-badge.abaixo { background:#f8d7da; color:#721c24; }
    </style>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div>
        <div class="page-title">Relatório de Notas</div>
        <div class="page-subtitle">Alunos abaixo da média — nota de corte ${MEDIA_CORTE}</div>
      </div>
      <button class="btn btn-primary btn-print no-print" onclick="window.print()">
        <i class="bi bi-file-earmark-pdf"></i> Gerar PDF
      </button>
    </div>

    <div id="filter-container-relatorios" class="no-print"></div>

    <div class="report-toolbar no-print">
      <span class="report-toolbar-label"><i class="bi bi-sort-down"></i> Ordenar por:</span>
      <button class="btn btn-sm btn-primary sort-btn" data-sort="disciplina">Disciplina</button>
      <button class="btn btn-sm btn-outline-secondary sort-btn" data-sort="turma">Turma</button>
      <button class="btn btn-sm btn-outline-secondary sort-btn" data-sort="aluno">Aluno</button>
    </div>

    <div class="report-container print-only" id="report-content">
      <div class="report-header print-only">
        <img src="assets/img/logo-sieac.png" alt="SIEAC" onerror="this.remove()">
        <div>
          <h2>Relatório de Notas — SIEAC</h2>
          <small>Sistema de Indicadores Educacionais Abel Coelho</small>
        </div>
      </div>
      <div class="report-meta" id="report-meta">
        <span><strong>Gerado em:</strong> <span id="rel-data-hora">—</span></span>
        <span><strong>Nota de corte:</strong> ${MEDIA_CORTE}</span>
        <span id="rel-filtros-info"></span>
      </div>

      <div class="report-section-title">Alunos Abaixo da Média</div>
      <div style="overflow-x:auto;">
        <table class="report-table" id="rel-table">
          <thead>
            <tr>
              <th style="min-width:120px;">Disciplina</th>
              <th style="min-width:100px;">Turma</th>
              <th style="min-width:160px;">Aluno</th>
              <th class="num" style="min-width:70px;">Matrícula</th>
              <th class="num" style="min-width:80px;">Média Final</th>
              <th class="col-situacao" style="min-width:90px;">Situação</th>
            </tr>
          </thead>
          <tbody id="rel-tbody">
            <tr><td colspan="6" style="text-align:center;color:var(--sieac-text-muted);">Carregando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline-secondary');
      });
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-outline-secondary');
      renderTable(btn.dataset.sort);
    });
  });

  renderFilterPanel('filter-container-relatorios', () => loadData());
  await loadData();
}

async function getCache() {
  const [s, t, c, a, e] = await Promise.all([
    supabaseQuery('series', { select: 'id,nome,etapa_ensino_id' }),
    supabaseQuery('turmas', { select: 'id,nome,serie_id,turno' }),
    supabaseQuery('componentes_curriculares', { select: 'id,nome' }),
    supabaseQuery('alocacoes', { select: 'id,turma_id,componente_id,professor_id' }),
    supabaseQuery('estudantes', { select: 'id,nome,matricula' }),
  ]);
  return {
    series: s.data || [],
    turmas: t.data || [],
    componentes: c.data || [],
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
  const filters = getFilters();
  const cache = await getCache();

  document.getElementById('rel-data-hora').textContent = new Date().toLocaleString('pt-BR');
  const filtroInfo = document.getElementById('rel-filtros-info');
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
  filtroInfo.innerHTML = filtrosAtivos.length ? `<strong>Filtros:</strong> ${filtrosAtivos.join(' | ')}` : '';

  const { data: notas } = await supabaseFetchAll('notas', { select: 'estudante_id,media_final,alocacao_id' });
  const filtradas = aplicarFiltros(notas || [], filters, cache);

  const alocComp = {}; cache.alocacoes.forEach(a => alocComp[a.id] = a.componente_id);
  const alocTurma = {}; cache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);
  const compMap = {}; cache.componentes.forEach(c => compMap[c.id] = c.nome);
  const turmaMap = {}; cache.turmas.forEach(t => turmaMap[t.id] = t.nome);
  const estMap = {}; cache.estudantes.forEach(e => estMap[e.id] = e);

  const linhas = filtradas.map(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0 || mf >= MEDIA_CORTE) return null;
    const cId = alocComp[n.alocacao_id];
    const tId = alocTurma[n.alocacao_id];
    const estudante = estMap[n.estudante_id];
    if (!cId || !tId || !estudante) return null;
    return {
      estudante_id: n.estudante_id,
      disciplina: compMap[cId] || `Disciplina ${cId}`,
      turma: turmaMap[tId] || `Turma ${tId}`,
      aluno: estudante.nome,
      matricula: estudante.matricula || '-',
      media_final: mf,
    };
  }).filter(Boolean);

  relLinhas = linhas;
  renderTable('disciplina');
}

function ordenarLinhas(linhas, sortKey) {
  const secundarias = {
    disciplina: ['turma', 'aluno'],
    turma: ['disciplina', 'aluno'],
    aluno: ['disciplina', 'turma'],
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

function renderTable(sortKey) {
  const tbody = document.getElementById('rel-tbody');
  if (!tbody) return;

  if (!relLinhas.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--sieac-text-muted);">Nenhum aluno abaixo da média ${MEDIA_CORTE} encontrado para os filtros selecionados</td></tr>`;
    return;
  }

  const ordenadas = ordenarLinhas(relLinhas, sortKey);
  const html = ordenadas.map(i => `<tr>
    <td>${i.disciplina}</td>
    <td>${i.turma}</td>
    <td><strong>${i.aluno}</strong></td>
    <td class="num">${i.matricula}</td>
    <td class="num abaixo">${i.media_final.toFixed(1)}</td>
    <td class="num col-situacao"><span class="media-badge abaixo">Abaixo</span></td>
  </tr>`).join('');

  const totalAlunos = new Set(relLinhas.map(l => l.estudante_id)).size;
  tbody.innerHTML = html + `<tr class="group-header"><td colspan="6"><strong>Total</strong> — ${totalAlunos} aluno(s) abaixo da média</td></tr>`;
}
