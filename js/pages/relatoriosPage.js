import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { supabaseQuery } from '../services/supabase.js';

const MEDIA_CORTE = 6;

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <style>
      @media print {
        body, html { background:#fff !important; }
        #sidebar-wrapper, .navbar, .page-title, .page-subtitle, #filter-container-relatorios,
        .btn-print, .kpi-card, .no-print { display:none !important; }
        #main-content { margin-left:0 !important; width:100% !important; }
        .report-container { box-shadow:none !important; padding:0 !important; }
        .report-header img { max-width:50px; }
        table { page-break-inside:auto; border-collapse:collapse; width:100%; }
        tr { page-break-inside:avoid; page-break-after:auto; }
        thead { display:table-header-group; }
        .print-only { display:block !important; }
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
        <div class="page-subtitle">Alunos agrupados por disciplina e por turma — nota de corte ${MEDIA_CORTE}</div>
      </div>
      <button class="btn btn-primary btn-print no-print" onclick="window.print()">
        <i class="bi bi-printer"></i> Imprimir
      </button>
    </div>

    <div id="filter-container-relatorios" class="no-print"></div>

    <div class="report-container" id="report-content">
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

      <div class="report-section-title">Alunos por Disciplina</div>
      <div style="overflow-x:auto;">
        <table class="report-table" id="rel-table-disciplina">
          <thead>
            <tr>
              <th style="min-width:120px;">Disciplina</th>
              <th style="min-width:100px;">Turma</th>
              <th style="min-width:160px;">Aluno</th>
              <th class="num" style="min-width:70px;">Matrícula</th>
              <th class="num" style="min-width:80px;">Média Final</th>
              <th style="min-width:90px;">Situação</th>
            </tr>
          </thead>
          <tbody id="rel-tbody-disciplina">
            <tr><td colspan="6" style="text-align:center;color:var(--sieac-text-muted);">Carregando...</td></tr>
          </tbody>
        </table>
      </div>

      <div class="report-section-title">Alunos por Turma</div>
      <div style="overflow-x:auto;">
        <table class="report-table" id="rel-table-turma">
          <thead>
            <tr>
              <th style="min-width:100px;">Turma</th>
              <th style="min-width:120px;">Disciplina</th>
              <th style="min-width:160px;">Aluno</th>
              <th class="num" style="min-width:70px;">Matrícula</th>
              <th class="num" style="min-width:80px;">Média Final</th>
              <th style="min-width:90px;">Situação</th>
            </tr>
          </thead>
          <tbody id="rel-tbody-turma">
            <tr><td colspan="6" style="text-align:center;color:var(--sieac-text-muted);">Carregando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  renderFilterPanel('filter-container-relatorios', () => loadData());
  await loadData();
}

async function getCache() {
  const [t, c, a, e] = await Promise.all([
    supabaseQuery('turmas', { select: 'id,nome,serie_id,turno' }),
    supabaseQuery('componentes_curriculares', { select: 'id,nome' }),
    supabaseQuery('alocacoes', { select: 'id,turma_id,componente_id,professor_id' }),
    supabaseQuery('estudantes', { select: 'id,nome,matricula' }),
  ]);
  return {
    turmas: t.data || [],
    componentes: c.data || [],
    alocacoes: a.data || [],
    estudantes: e.data || [],
  };
}

function aplicarFiltros(notas, filters, cache) {
  if (!filters || !Object.keys(filters).length) return notas;
  let alocIds = new Set(cache.alocacoes.map(a => a.id));
  if (filters.serie_id) {
    const tIds = new Set(cache.turmas.filter(t => t.serie_id == filters.serie_id).map(t => t.id));
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.some(a => a.id === id && tIds.has(a.turma_id))));
  }
  if (filters.turma_id) {
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.some(a => a.id === id && a.turma_id == filters.turma_id)));
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
  if (filters.serie_id) {
    const s = (await supabaseQuery('series', { select: 'nome', id: filters.serie_id })).data;
    if (s && s[0]) filtrosAtivos.push(`Série: ${s[0].nome}`);
  }
  if (filters.turma_id) {
    const t = cache.turmas.find(x => x.id == filters.turma_id);
    if (t) filtrosAtivos.push(`Turma: ${t.nome}`);
  }
  if (filters.componente_id) {
    const c = cache.componentes.find(x => x.id == filters.componente_id);
    if (c) filtrosAtivos.push(`Disciplina: ${c.nome}`);
  }
  if (filters.professor_id) {
    const { data: profs } = await supabaseQuery('professores', { select: 'nome', id: filters.professor_id });
    if (profs && profs[0]) filtrosAtivos.push(`Professor: ${profs[0].nome}`);
  }
  filtroInfo.innerHTML = filtrosAtivos.length ? `<strong>Filtros:</strong> ${filtrosAtivos.join(' | ')}` : '';

  const { data: notas } = await supabaseQuery('notas', { select: 'estudante_id,media_final,alocacao_id', limit: 20000 });
  const filtradas = aplicarFiltros(notas || [], filters, cache);

  const alocComp = {}; cache.alocacoes.forEach(a => alocComp[a.id] = a.componente_id);
  const alocTurma = {}; cache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);
  const compMap = {}; cache.componentes.forEach(c => compMap[c.id] = c.nome);
  const turmaMap = {}; cache.turmas.forEach(t => turmaMap[t.id] = t.nome);
  const estMap = {}; cache.estudantes.forEach(e => estMap[e.id] = e);

  const linhas = filtradas.map(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0) return null;
    const cId = alocComp[n.alocacao_id];
    const tId = alocTurma[n.alocacao_id];
    const estudante = estMap[n.estudante_id];
    if (!cId || !tId || !estudante) return null;
    return {
      disciplina: compMap[cId] || `Disciplina ${cId}`,
      turma: turmaMap[tId] || `Turma ${tId}`,
      aluno: estudante.nome,
      matricula: estudante.matricula || '-',
      media_final: mf,
      situacao: mf >= MEDIA_CORTE ? 'Acima' : 'Abaixo',
    };
  }).filter(Boolean);

  renderGrupo('rel-tbody-disciplina', linhas, 'disciplina');
  renderGrupo('rel-tbody-turma', linhas, 'turma');
}

function renderGrupo(tbodyId, linhas, groupKey) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  if (!linhas.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--sieac-text-muted);">Nenhum registro encontrado</td></tr>';
    return;
  }

  const grupos = {};
  linhas.forEach(l => {
    const chave = l[groupKey];
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(l);
  });

  const chaves = Object.keys(grupos).sort((a, b) => a.localeCompare(b));
  const subKey = groupKey === 'disciplina' ? 'turma' : 'disciplina';
  let html = '';
  let totalGeral = 0, acimaGeral = 0;

  chaves.forEach(chave => {
    const items = grupos[chave].sort((a, b) => {
      const s = a[subKey].localeCompare(b[subKey]);
      if (s) return s;
      return a.aluno.localeCompare(b.aluno);
    });
    const acima = items.filter(i => i.situacao === 'Acima').length;
    const abaixo = items.length - acima;
    totalGeral += items.length;
    acimaGeral += acima;

    html += `<tr class="group-header"><td colspan="6"><strong>${chave}</strong> — ${items.length} alunos (${acima} acima / ${abaixo} abaixo da média)</td></tr>`;

    items.forEach(i => {
      const isAcima = i.situacao === 'Acima';
      html += `<tr>
        <td>${i.disciplina}</td>
        <td>${i.turma}</td>
        <td><strong>${i.aluno}</strong></td>
        <td class="num">${i.matricula}</td>
        <td class="num ${isAcima ? 'acima' : 'abaixo'}">${i.media_final.toFixed(1)}</td>
        <td class="num"><span class="media-badge ${isAcima ? 'acima' : 'abaixo'}">${i.situacao}</span></td>
      </tr>`;
    });
  });

  html += `<tr class="group-header"><td colspan="6"><strong>Resumo Geral</strong> — ${totalGeral} alunos (${acimaGeral} acima / ${totalGeral - acimaGeral} abaixo da média)</td></tr>`;
  tbody.innerHTML = html;
}
