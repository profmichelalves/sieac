import { $, formatNumber } from '../utils/helpers.js';
import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { destroyChart } from '../components/Charts.js';
import { supabaseQuery } from '../services/supabase.js';

const MEDIA_CORTE = 6;
let chartInst = {};

function criaGraficoBarras(canvasId, labels, acima, abaixo) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || !labels.length) return;
  const ctx = canvas.getContext('2d');
  if (chartInst[canvasId]) { chartInst[canvasId].destroy(); }
  chartInst[canvasId] = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Acima da Média', data: acima, backgroundColor: 'rgba(45, 198, 83, 0.7)', borderRadius: 4 },
        { label: 'Abaixo da Média', data: abaixo, backgroundColor: 'rgba(230, 57, 70, 0.7)', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: 'var(--sieac-text-muted)' } },
        tooltip: { backgroundColor: 'var(--sieac-surface)', titleColor: 'var(--sieac-text)', bodyColor: 'var(--sieac-text-secondary)', borderColor: 'var(--sieac-border)', borderWidth: 1, padding: 12, cornerRadius: 8 },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)' } },
        x: { grid: { display: false }, ticks: { color: 'var(--sieac-text-muted)' } },
      },
    },
  });
}

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Relatório de Notas</div>
    <div class="page-subtitle">Comparativo de notas acima e abaixo da média (nota de corte: ${MEDIA_CORTE}) por disciplina e turma</div>

    <div id="filter-container-relatorios"></div>

    <div class="row g-4" style="margin-top:12px;">
      <div class="col-6 col-md-3">
        <div class="kpi-card primary">
          <div class="kpi-label">Total de Notas</div>
          <div class="kpi-value"><span id="rel-kpi-total">—</span></div>
          <div class="kpi-icon"><i class="bi bi-file-text"></i></div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card success">
          <div class="kpi-label">Acima da Média</div>
          <div class="kpi-value" style="color:var(--sieac-success)"><span id="rel-kpi-acima">—</span></div>
          <div class="kpi-icon"><i class="bi bi-arrow-up-circle"></i></div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card danger">
          <div class="kpi-label">Abaixo da Média</div>
          <div class="kpi-value" style="color:var(--sieac-danger)"><span id="rel-kpi-abaixo">—</span></div>
          <div class="kpi-icon"><i class="bi bi-arrow-down-circle"></i></div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card secondary">
          <div class="kpi-label">Média Geral</div>
          <div class="kpi-value"><span id="rel-kpi-media">—</span></div>
          <div class="kpi-icon"><i class="bi bi-graph-up"></i></div>
        </div>
      </div>
    </div>

    <div class="row g-4" style="margin-top:8px;">
      <div class="col-md-6">
        <div class="card-sieac">
          <div class="card-sieac-header">Por Disciplina</div>
          <div class="card-sieac-body">
            <div class="chart-container" style="height:280px;"><canvas id="rel-chart-disciplina"></canvas></div>
            <div style="margin-top:16px;overflow-x:auto;">
              <table class="table-sieac" id="rel-table-disciplina">
                <thead><tr><th>Disciplina</th><th>Total</th><th>Acima</th><th>%</th><th>Abaixo</th><th>%</th></tr></thead>
                <tbody id="rel-tbody-disciplina"><tr><td colspan="6" style="text-align:center;color:var(--sieac-text-muted);">Carregando...</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card-sieac">
          <div class="card-sieac-header">Por Turma</div>
          <div class="card-sieac-body">
            <div class="chart-container" style="height:280px;"><canvas id="rel-chart-turma"></canvas></div>
            <div style="margin-top:16px;overflow-x:auto;">
              <table class="table-sieac" id="rel-table-turma">
                <thead><tr><th>Turma</th><th>Total</th><th>Acima</th><th>%</th><th>Abaixo</th><th>%</th></tr></thead>
                <tbody id="rel-tbody-turma"><tr><td colspan="6" style="text-align:center;color:var(--sieac-text-muted);">Carregando...</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
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

  const total = validas.length;
  const acima = validas.filter(n => parseFloat(n.media_final) >= MEDIA_CORTE).length;
  const abaixo = validas.filter(n => parseFloat(n.media_final) < MEDIA_CORTE).length;
  const mediaGeral = total ? validas.reduce((s, n) => s + parseFloat(n.media_final), 0) / total : 0;

  document.getElementById('rel-kpi-total').textContent = total;
  document.getElementById('rel-kpi-acima').textContent = acima;
  document.getElementById('rel-kpi-abaixo').textContent = abaixo;
  document.getElementById('rel-kpi-media').textContent = mediaGeral.toFixed(1);

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
  criaGraficoBarras('rel-chart-disciplina', discData.map(d => d.nome), discData.map(d => d.acima), discData.map(d => d.abaixo));

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
  criaGraficoBarras('rel-chart-turma', turmaData.map(d => d.nome), turmaData.map(d => d.acima), turmaData.map(d => d.abaixo));
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
      <td>${d.total}</td>
      <td style="color:var(--sieac-success);font-weight:600;">${d.acima}</td>
      <td>${d.pctAcima}%</td>
      <td style="color:var(--sieac-danger);font-weight:600;">${d.abaixo}</td>
      <td>${d.pctAbaixo}%</td>
    </tr>
  `).join('');
}
