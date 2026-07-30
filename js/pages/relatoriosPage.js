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
        background:#1a2a3a; color:#fff; padding:8px 12px;
        font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px;
        text-align:left; border:1px solid #2a3a4a;
      }
      .report-table td {
        padding:7px 12px; border:1px solid var(--sieac-border);
        font-size:0.85rem; color:var(--sieac-text);
      }
      .report-table tbody tr:nth-child(even) { background:var(--sieac-bg); }
      .report-table .num { text-align:center; }
      .report-table .acima { color:var(--sieac-success); font-weight:600; }
      .report-table .abaixo { color:var(--sieac-danger); font-weight:600; }
      .report-section-title {
        font-size:1rem; font-weight:600; color:var(--sieac-text);
        margin:24px 0 10px; padding-bottom:6px; border-bottom:1px solid var(--sieac-border);
      }
    </style>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div>
        <div class="page-title">Relatório de Notas</div>
        <div class="page-subtitle">Comparativo de notas acima e abaixo da média (nota de corte: ${MEDIA_CORTE}) por disciplina e turma</div>
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

      <div class="report-section-title">Por Disciplina</div>
      <div style="overflow-x:auto;">
        <table class="report-table" id="rel-table-disciplina">
          <thead>
            <tr>
              <th style="min-width:160px;">Disciplina</th>
              <th class="num">Total</th>
              <th class="num">Acima da Média</th>
              <th class="num">%</th>
              <th class="num">Abaixo da Média</th>
              <th class="num">%</th>
            </tr>
          </thead>
          <tbody id="rel-tbody-disciplina">
            <tr><td colspan="6" style="text-align:center;color:var(--sieac-text-muted);">Carregando...</td></tr>
          </tbody>
        </table>
      </div>

      <div class="report-section-title">Por Turma</div>
      <div style="overflow-x:auto;">
        <table class="report-table" id="rel-table-turma">
          <thead>
            <tr>
              <th style="min-width:160px;">Turma</th>
              <th class="num">Total</th>
              <th class="num">Acima da Média</th>
              <th class="num">%</th>
              <th class="num">Abaixo da Média</th>
              <th class="num">%</th>
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
  const [t, c, a] = await Promise.all([
    supabaseQuery('turmas', { select: 'id,nome,serie_id,turno' }),
    supabaseQuery('componentes_curriculares', { select: 'id,nome' }),
    supabaseQuery('alocacoes', { select: 'id,turma_id,componente_id,professor_id' }),
  ]);
  return {
    turmas: t.data || [],
    componentes: c.data || [],
    alocacoes: a.data || [],
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

  const { data: notas } = await supabaseQuery('notas', { select: 'media_final,alocacao_id', limit: 20000 });
  const filtradas = aplicarFiltros(notas || [], filters, cache);

  const alocComp = {}; cache.alocacoes.forEach(a => alocComp[a.id] = a.componente_id);
  const alocTurma = {}; cache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);
  const compMap = {}; cache.componentes.forEach(c => compMap[c.id] = c.nome);
  const turmaMap = {}; cache.turmas.forEach(t => turmaMap[t.id] = t.nome);

  const validas = filtradas.filter(n => {
    const mf = parseFloat(n.media_final);
    return !isNaN(mf) && mf > 0;
  });

  // Grupo por disciplina
  const discMap = {};
  validas.forEach(n => {
    const cId = alocComp[n.alocacao_id];
    const nome = compMap[cId] || `Disciplina ${cId}`;
    if (!discMap[nome]) discMap[nome] = { total: 0, acima: 0 };
    discMap[nome].total++;
    if (parseFloat(n.media_final) >= MEDIA_CORTE) discMap[nome].acima++;
  });
  const discData = Object.entries(discMap).map(([nome, v]) => ({
    nome, total: v.total, acima: v.acima, abaixo: v.total - v.acima,
    pctAcima: Math.round(v.acima / v.total * 100),
    pctAbaixo: Math.round((v.total - v.acima) / v.total * 100),
  })).sort((a, b) => a.nome.localeCompare(b.nome));

  renderTable('rel-tbody-disciplina', discData);

  // Grupo por turma
  const turmaGroup = {};
  validas.forEach(n => {
    const tId = alocTurma[n.alocacao_id];
    const nome = turmaMap[tId] || `Turma ${tId}`;
    if (!turmaGroup[nome]) turmaGroup[nome] = { total: 0, acima: 0 };
    turmaGroup[nome].total++;
    if (parseFloat(n.media_final) >= MEDIA_CORTE) turmaGroup[nome].acima++;
  });
  const turmaData = Object.entries(turmaGroup).map(([nome, v]) => ({
    nome, total: v.total, acima: v.acima, abaixo: v.total - v.acima,
    pctAcima: Math.round(v.acima / v.total * 100),
    pctAbaixo: Math.round((v.total - v.acima) / v.total * 100),
  })).sort((a, b) => a.nome.localeCompare(b.nome));

  renderTable('rel-tbody-turma', turmaData);
}

function renderTable(tbodyId, data) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--sieac-text-muted);">Nenhum registro encontrado</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(d => `
    <tr>
      <td><strong>${d.nome}</strong></td>
      <td class="num">${d.total}</td>
      <td class="num acima">${d.acima}</td>
      <td class="num">${d.pctAcima}%</td>
      <td class="num abaixo">${d.abaixo}</td>
      <td class="num">${d.pctAbaixo}%</td>
    </tr>
  `).join('');
}
