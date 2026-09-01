import { $, $$, formatNumber, getTooltipOptions, escapeHtml } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { getScatterFreqNota } from '../repositories/dashboardRepository.js';
import {
  getDadosMestres,
  getEstatisticasPorTurma,
  getDisciplinasCriticas,
  getRankingProfessores,
  getEquidadeNee,
} from '../repositories/estatisticasRepository.js';
import {
  media,
  mediana,
  desvioPadraoPop,
  coefVariacao,
  quartis,
  outliers,
  correlacaoPearson,
  regressaoLinear,
  normalizar,
  regressaoLogistica,
  kMeans,
} from '../utils/statistics.js';

const MEDIA_CORTE = 6;

let chartInstances = {};
let tabAtual = 'dispersao';
let alunosCache = null;
const tabsRenderizados = new Set();

const ABAS = [
  { id: 'dispersao', label: 'Dispersão', icon: 'bi-bar-chart-line' },
  { id: 'distribuicao', label: 'Distribuição', icon: 'bi-graph-up-arrow' },
  { id: 'evolucao', label: 'Evolução', icon: 'bi-arrow-up-right' },
  { id: 'equidade', label: 'Equidade NEE', icon: 'bi-person-wheelchair' },
  { id: 'predicao', label: 'Predição', icon: 'bi-cpu' },
];

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Estatísticas</div>
    <div class="page-subtitle">Indicadores estatísticos e preditivos — acesso exclusivo do Administrador</div>

    <div class="card-sieac mb-4">
      <div class="card-sieac-header">Filtros</div>
      <div class="card-sieac-body">
        <div id="filter-container-estatisticas"></div>
      </div>
    </div>

    <style>
      .est-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;}
      .est-tab{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:1px solid var(--sieac-border);background:var(--sieac-surface);color:var(--sieac-text);cursor:pointer;font-size:0.85rem;transition:all .15s;}
      .est-tab:hover{border-color:var(--sieac-primary);}
      .est-tab.active{background:var(--sieac-primary);color:#fff;border-color:var(--sieac-primary);}
      .est-tab.active i{color:#fff;}
      .est-pane{display:none;}
      .est-pane.active{display:block;}
      .stat-table{width:100%;font-size:0.85rem;border-collapse:collapse;}
      .stat-table th{text-align:left;color:var(--sieac-text-muted);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--sieac-border);}
      .stat-table td{padding:8px 10px;border-bottom:1px solid var(--sieac-border);vertical-align:middle;}
      .stat-table tr:hover td{background:rgba(0,0,0,0.02);}
      .cv-badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.72rem;font-weight:600;color:#fff;}
      .cv-baixo{background:var(--sieac-success);}
      .cv-medio{background:#f5a623;}
      .cv-alto{background:var(--sieac-danger);}
      .boxplot-wrap{display:flex;flex-direction:column;gap:14px;}
      .boxplot-row{display:grid;grid-template-columns:minmax(110px,auto) 1fr;gap:10px;align-items:center;font-size:0.8rem;}
      .boxplot-label{color:var(--sieac-text-muted);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .boxplot{position:relative;height:56px;border-left:1px solid var(--sieac-border);border-right:1px solid var(--sieac-border);margin:0 4px;min-height:56px;}
      .bp-whisker{position:absolute;width:1px;background:var(--sieac-text-muted);top:0;height:100%;}
      .bp-box{position:absolute;top:14px;height:28px;background:rgba(49,47,146,0.18);border:1.5px solid var(--sieac-primary);border-radius:3px;}
      .bp-median{position:absolute;width:2px;background:var(--sieac-primary);top:10px;height:36px;}
      .bp-outlier{position:absolute;width:7px;height:7px;border-radius:50%;background:var(--sieac-danger);top:25px;margin-left:-3px;}
      .bp-axis{position:relative;margin-top:2px;font-size:0.7rem;color:var(--sieac-text-muted);border-top:1px solid var(--sieac-border);padding-top:2px;}
      .bp-tick{position:absolute;transform:translateX(-50%);}
      .matriz-grid{display:grid;grid-template-columns:auto auto auto;gap:6px;max-width:360px;}
      .matriz-cell{padding:10px;border-radius:6px;text-align:center;border:1px solid var(--sieac-border);}
      .matriz-count{font-size:1.3rem;font-weight:700;}
      .matriz-pct{font-size:0.75rem;color:var(--sieac-text-muted);}
      .kpi-mini{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;}
      .kpi-mini-item{background:var(--sieac-surface);border:1px solid var(--sieac-border);border-radius:10px;padding:12px 14px;}
      .kpi-mini-label{font-size:0.72rem;color:var(--sieac-text-muted);}
      .kpi-mini-value{font-size:1.15rem;font-weight:700;}
      .risk-bar{height:8px;border-radius:4px;background:rgba(0,0,0,0.06);overflow:hidden;min-width:80px;}
      .risk-bar>div{height:100%;border-radius:4px;}
      .est-note{font-size:0.78rem;color:var(--sieac-text-muted);margin-top:6px;}
      .est-empty{text-align:center;padding:30px;color:var(--sieac-text-muted);font-size:0.9rem;}
    </style>

    <div class="est-tabs" id="est-tabs">
      ${ABAS.map(a => `<div class="est-tab" data-tab="${a.id}"><i class="bi ${a.icon}"></i> ${a.label}</div>`).join('')}
    </div>

    <div id="est-panes">
      <div class="est-pane" data-pane="dispersao" id="pane-dispersao"></div>
      <div class="est-pane" data-pane="distribuicao" id="pane-distribuicao"></div>
      <div class="est-pane" data-pane="evolucao" id="pane-evolucao"></div>
      <div class="est-pane" data-pane="equidade" id="pane-equidade"></div>
      <div class="est-pane" data-pane="predicao" id="pane-predicao"></div>
    </div>
  `;

  const $tabs = $('#est-tabs');
  $tabs.addEventListener('click', e => {
    const tab = e.target.closest('.est-tab');
    if (!tab) return;
    trocarAba(tab.dataset.tab);
  });
  trocarAba(tabAtual);

  await renderFilterPanel('filter-container-estatisticas', () => loadData());
  await loadData();

  habilitarOrdenacaoTabelas($('#est-panes'));
}

export function unload() {
  Object.keys(chartInstances).forEach(id => {
    if (chartInstances[id]) chartInstances[id].destroy();
  });
  chartInstances = {};
  alunosCache = null;
}

async function trocarAba(id) {
  tabAtual = id;
  $$('.est-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  $$('.est-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === id));
  if (!tabsRenderizados.has(id) && alunosCache) {
    await renderAba(id, alunosCache);
  }
}

function criarCanvas(id, label) {
  return `<div class="chart-card" style="margin-bottom:20px;">
    <div class="chart-card-title">${label}</div>
    <div class="chart-container" style="height:380px;"><canvas id="${id}"></canvas></div>
  </div>`;
}

function destruirChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

function novaChart(id, config) {
  destruirChart(id);
  const canvas = document.getElementById(id);
  if (!canvas) return;
  chartInstances[id] = new window.Chart(canvas, config);
}

function num(v, dec = 1) {
  return isFinite(v) ? formatNumber(v, dec).replace('.', ',') : '—';
}

function pct(v, dec = 1) {
  return isFinite(v) ? formatPercentLocal(v, dec) : '—';
}

function formatPercentLocal(v, dec = 1) {
  return v.toFixed(dec).replace('.', ',') + '%';
}

function habilitarOrdenacaoTabelas(root) {
  const orig = new WeakMap();
  root.addEventListener('click', event => {
    const th = event.target.closest('th');
    if (!th) return;
    const table = th.closest('table.stat-table');
    const tbody = table && table.querySelector('tbody');
    if (!tbody) return;
    const theadThs = Array.from(table.querySelector('thead tr').children);
    const idx = theadThs.indexOf(th);
    if (idx === -1) return;
    const rows = Array.from(tbody.querySelectorAll('tr')).filter(r => !r.querySelector('.est-empty'));
    if (!rows.length) return;

    if (!orig.has(tbody)) orig.set(tbody, rows.slice());

    const valor = r => (r.children[idx] ? (r.children[idx].textContent || '').trim() : '');
    const num = t => parseFloat(t.replace(/,/g, '.').replace(/[^0-9.\-]/g, ''));
    const numerico = rows.every(r => {
      const t = valor(r);
      const p = num(t);
      return t !== '' && isFinite(p);
    });

    const cols = Array.from(table.querySelectorAll('thead th'));
    const limpar = c => { c.textContent = (c.textContent || '').replace(/[▲▼]/g, '').trim(); };
    cols.forEach(c => { limpar(c); c.dataset.dir = ''; });

    const cur = th.dataset.dir || '';
    const dir = cur === '' ? 'asc' : (cur === 'asc' ? 'desc' : '');
    th.dataset.dir = dir;
    th.textContent = (th.textContent || '') + (dir === 'asc' ? ' ▲' : dir === 'desc' ? ' ▼' : '');

    const ordenadas = dir === '' ? orig.get(tbody).slice() : rows.slice().sort((a, b) => {
      const va = valor(a), vb = valor(b);
      const cmp = numerico ? (num(va) - num(vb)) : va.localeCompare(vb, 'pt-BR');
      return dir === 'asc' ? cmp : -cmp;
    });
    ordenadas.forEach(r => tbody.appendChild(r));
  });
}

async function loadData() {
  const filters = getFilters();
  const container = $('#pane-' + tabAtual);
  if (!container) return;
  container.innerHTML = '<div class="est-empty">Carregando…</div>';

  try {
    const dados = await getDadosMestres(filters);
    alunosCache = dados.data || [];
    tabsRenderizados.clear();
    await renderAba(tabAtual, alunosCache);
  } catch (err) {
    container.innerHTML = `<div class="est-empty">Erro ao carregar dados: ${escapeHtml(err.message || String(err))}</div>`;
  }
}

async function renderAba(id, alunos) {
  const container = $('#pane-' + id);
  if (!container) return;
  destroyChartVersion(id);
  tabsRenderizados.add(id);
  if (id === 'dispersao') await renderDispersao(container, alunos);
  else if (id === 'distribuicao') await renderDistribuicao(container, alunos);
  else if (id === 'evolucao') await renderEvolucao(container, alunos);
  else if (id === 'equidade') renderEquidade(container, alunos);
  else if (id === 'predicao') renderPredicao(container, alunos);
}

function destroyChartVersion(id) {
  ['dis-', 'hist-', 'scat-', 'gauss-', 'evol-', 'crit-', 'nee-', 'pred-'].forEach(prefix => {
    destruirChart(prefix + id);
  });
}

// ======================= ABA 1 — DISPERSÃO =======================
async function renderDispersao(container, alunos) {
  const est = (await getEstatisticasPorTurma(getFilters())).data || [];

  const scoresPorTurma = {};
  alunos.forEach(a => {
    const t = a.turma || 'Sem turma';
    if (!scoresPorTurma[t]) scoresPorTurma[t] = [];
    if (isFinite(a.mediaGeral)) scoresPorTurma[t].push(a.mediaGeral);
  });

  const cvClass = cv => cv === null ? 'cv-baixo' : cv < 15 ? 'cv-baixo' : cv <= 30 ? 'cv-medio' : 'cv-alto';
  const cvText = cv => cv === null ? '—' : cv.toFixed(1).replace('.', ',') + '%';

  container.innerHTML = `
    <div class="kpi-mini">
      <div class="kpi-mini-item"><div class="kpi-mini-label">Estudantes</div><div class="kpi-mini-value">${alunos.length}</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">Média geral da escola</div><div class="kpi-mini-value">${num(media(alunos.map(a => a.mediaGeral)))}</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">Desvio-padrão</div><div class="kpi-mini-value">${num(desvioPadraoPop(alunos.map(a => a.mediaGeral)))}</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">CV geral</div><div class="kpi-mini-value">${pct(coefVariacao(alunos.map(a => a.mediaGeral)))}</div></div>
    </div>

    <div class="card-sieac mb-4">
      <div class="card-sieac-header">Coeficiente de Variação por Turma ${infoBtn('Coeficiente de Variação (CV)', 'Mede a dispersão das médias dos estudantes em relação à média, em percentual. CV baixo (< 15%) indica turma homogênea; entre 15% e 30% variação moderada; acima de 30% alta heterogeneidade de desempenho.')}</div>
      <div class="card-sieac-body">
        <div class="table-responsive-custom" style="max-height:400px;overflow:auto;">
          <table class="stat-table">
            <thead><tr><th>Turma</th><th>N</th><th>Média</th><th>Mediana</th><th>DP</th><th>CV</th></tr></thead>
            <tbody>
              ${est.map(e => `<tr>
                <td>${escapeHtml(e.turma)}</td>
                <td>${e.n}</td>
                <td>${num(e.media)}</td>
                <td>${num(e.mediana)}</td>
                <td>${num(e.dp)}</td>
                <td><span class="cv-badge ${cvClass(e.cv)}">${cvText(e.cv)}</span></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="est-note">Legenda CV: <span class="cv-badge cv-baixo">baixo</span> < 15% · <span class="cv-badge cv-medio">moderado</span> 15–30% · <span class="cv-badge cv-alto">alto</span> > 30%</div>
      </div>
    </div>

    <div class="card-sieac">
      <div class="card-sieac-header">Boxplot — Média por Turma ${infoBtn('Boxplot', 'Representa a distribuição das médias dos estudantes de cada turma: caixa entre 1º e 3º quartil, linha central na mediana, traços (whiskers) até o maior/menor valor dentro de 1,5×IQR e pontos vermelhos para outliers.')}</div>
      <div class="card-sieac-body">
        <div class="boxplot-wrap" id="boxplot-wrap"></div>
        <div class="est-note">Cada caixa mostra a dispersão das médias dos estudantes de uma turma. Muitos outliers ou caixas largas indicam heterogeneidade.</div>
      </div>
    </div>
  `;

  const wrap = $('#boxplot-wrap', container);
  if (wrap) {
    wrap.innerHTML = renderBoxplots(scoresPorTurma);
  }
}

function renderBoxplots(scoresPorTurma) {
  const todas = Object.values(scoresPorTurma).flat().filter(isFinite);
  if (!todas.length) return '<div class="est-empty">Sem dados de notas para gerar boxplot.</div>';
  const min = 0, max = 10;
  const range = max - min;
  const pos = v => ((v - min) / range) * 100;
  const linhas = Object.entries(scoresPorTurma)
    .map(([turma, vals]) => {
      const v = vals.filter(isFinite);
      if (!v.length) return null;
      const q = quartis(v);
      const iqr = q.q3 - q.q1;
      const whiskerBaixo = Math.max(q.min, q.q1 - 1.5 * iqr);
      const whiskerAlto = Math.min(q.max, q.q3 + 1.5 * iqr);
      const outs = outliers(v);
      return { turma, q, whiskerBaixo, whiskerAlto, outs, n: v.length };
    })
    .filter(Boolean)
    .sort((a, b) => a.q.mediana - b.q.mediana);

  const html = linhas.map(l => {
    const pCap = pos(l.q.q1), pMed = pos(l.q.mediana), pQ3 = pos(l.q.q3);
    const pWb = pos(l.whiskerBaixo), pWa = pos(l.whiskerAlto);
    const outsHTML = l.outs.map(o => `<span class="bp-outlier" style="left:${pos(o)}%"></span>`).join('');
    return `
      <div class="boxplot-row">
        <div class="boxplot-label" title="${escapeHtml(l.turma)}">${escapeHtml(l.turma)} (n=${l.n})</div>
        <div class="boxplot">
          <span class="bp-whisker" style="left:${pWb}%"></span>
          <span class="bp-whisker" style="left:${pWa}%"></span>
          <span class="bp-box" style="left:${pCap}%;width:${Math.max(pQ3 - pCap, 0.5)}%"></span>
          <span class="bp-median" style="left:${pMed}%"></span>
          ${outsHTML}
          <span style="position:absolute;left:${pWb}%;top:auto;bottom:-14px;font-size:0.65rem;color:var(--sieac-text-muted);transform:translateX(-50%);">${l.whiskerBaixo.toFixed(1).replace('.', ',')}</span>
          <span style="position:absolute;left:${pWa}%;top:auto;bottom:-14px;font-size:0.65rem;color:var(--sieac-text-muted);transform:translateX(-50%);">${l.whiskerAlto.toFixed(1).replace('.', ',')}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="bp-axis">
      ${[0, 2, 4, 6, 8, 10].map(v => `<span class="bp-tick" style="left:${pos(v)}%">${v}</span>`).join(' ')}
    </div>
    ${html}`;
}

// ======================= ABA 2 — DISTRIBUIÇÃO =======================
async function renderDistribuicao(container, alunos) {
  const escatter = await getScatterFreqNota(getFilters());
  const medias = alunos.filter(a => isFinite(a.mediaGeral)).map(a => a.mediaGeral);
  const r = correlacaoPearson(escatter?.data?.map(p => p.frequencia) || [], escatter?.data?.map(p => p.media) || []);
  const reg = regressaoLinear((escatter?.data || []).map(p => p.frequencia), (escatter?.data || []).map(p => p.media));
  const forca = Math.abs(r) >= 0.7 ? 'forte' : Math.abs(r) >= 0.4 ? 'moderada' : 'fraca';

  const q1 = medias.filter(m => m < 2).length;
  const q2 = medias.filter(m => m >= 2 && m < 4).length;
  const q3 = medias.filter(m => m >= 4 && m < 6).length;
  const q4 = medias.filter(m => m >= 6 && m < 8).length;
  const q5 = medias.filter(m => m >= 8).length;

  container.innerHTML = `
    <div class="kpi-mini">
      <div class="kpi-mini-item"><div class="kpi-mini-label">Correlação Frequência × Média (r)</div><div class="kpi-mini-value">${isFinite(r) ? r.toFixed(2).replace('.', ',') : '—'}</div>
        <div style="font-size:0.72rem;color:${!isFinite(r) ? 'var(--sieac-text-muted)' : Math.abs(r) >= 0.4 ? 'var(--sieac-success)' : 'var(--sieac-warning)'};">${isFinite(r) ? 'Relação ' + forca : 'sem dados'}</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">R² (poder explicativo)</div><div class="kpi-mini-value">${isFinite(reg.r2) ? (reg.r2.toFixed(2).replace('.', ',') + '') : '—'}</div>
        <div style="font-size:0.72rem;color:var(--sieac-text-muted);">quanto da nota a freq explica</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">Média das médias</div><div class="kpi-mini-value">${num(media(medias))}</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">Mediana</div><div class="kpi-mini-value">${num(mediana(medias))}</div></div>
    </div>

    ${criarCanvas('hist-distribuicao', 'Distribuição das Médias' + infoBtn('Distribuição das Médias', 'Frequência de estudantes em cada faixa de média final. A curva sobreposta representa uma distribuição normal com a mesma média e desvio-padrão dos dados, permitindo avaliar se os resultados se aproximam da normalidade.') + '<span style="max-width:220px;text-align:right;display:inline-block"></span>')}

    <div class="card-sieac mb-4" id="scatter-card">
      <div class="card-sieac-header">Frequência × Média Final com Regressão ${infoBtn('Regressão Linear', 'Linha que melhor descreve a relação entre frequência e média. Se a linha for ascendente, maior frequência tende a acompanhar maior nota; r e R² medem a força e o poder explicativo dessa relação.')}</div>
      <div class="card-sieac-body">
        <div class="chart-container" style="height:420px;"><canvas id="scat-distribuicao"></canvas></div>
      </div>
    </div>

    <div class="card-sieac">
      <div class="card-sieac-header">Matriz de Risco (Frequência × Resultado) ${infoBtn('Matriz de Risco', 'Cruza a frequência média (≥ ou < 75%) com a situação do estudante. Estudantes no quadrante frequência baixa + reprovado representam o maior risco de não conclusão.')}</div>
      <div class="card-sieac-body">
        <div id="matriz-body"></div>
      </div>
    </div>
  `;

  const coresHist = ['#e63946', '#f5a623', '#ffd000', '#2dc653', '#312f92'];
  const labels = ['0–2', '2–4', '4–6', '6–8', '8–10'];
  const counts = [q1, q2, q3, q4, q5];
  const mHist = media(medias), dpHist = desvioPadraoPop(medias);
  const gauss = labels.map((l, i) => {
    const x = i * 2 + 1;
    if (!isFinite(mHist) || !isFinite(dpHist) || dpHist === 0) return 0;
    const n = medias.length;
    return (n / 5) * (1 / (dpHist * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mHist) / dpHist) * ((x - mHist) / dpHist)) * 2;
  });

  novaChart('hist-distribuicao', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { type: 'bar', label: 'Estudantes', data: counts, backgroundColor: coresHist, borderRadius: 4 },
        { type: 'line', label: 'Normal', data: gauss, borderColor: '#111', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: false, borderDash: [5, 5], yAxisID: 'y' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: 'var(--sieac-text-muted)' } }, tooltip: getTooltipOptions() },
      scales: {
        y: { beginAtZero: true, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)', precision: 0 } },
        x: { grid: { display: false }, ticks: { color: 'var(--sieac-text-muted)' } },
      },
    },
  });

  const scPts = (escatter?.data || []).map(p => ({ x: p.frequencia, y: p.media, nome: p.nome }));
  const regLine = isFinite(reg.slope) ? { from: Math.min(...scPts.map(p => p.x), 0), to: Math.max(...scPts.map(p => p.x), 100) } : null;
  novaChart('scat-distribuicao', {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Estudantes', data: scPts, backgroundColor: scPts.map(p => {
            if (p.frequencia >= 75 && p.media >= 6) return 'rgba(45,198,83,0.6)';
            if (p.frequencia >= 75 && p.media < 6) return 'rgba(255,240,1,0.6)';
            if (p.frequencia < 75 && p.media < 6) return 'rgba(230,57,70,0.6)';
            return 'rgba(49,47,146,0.6)';
          }), pointRadius: 5, pointHoverRadius: 8,
        },
        ...(regLine ? [{
          type: 'line', label: 'Regressão', data: [
            { x: regLine.from, y: reg.prever(regLine.from) },
            { x: regLine.to, y: reg.prever(regLine.to) },
          ], borderColor: 'rgba(49,47,146,0.9)', borderWidth: 3, pointRadius: 0, fill: false, tension: 0,
        }] : []),
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: 'var(--sieac-text-muted)' } }, tooltip: {
        ...getTooltipOptions(),
        callbacks: { label: ctx => ctx.raw.nome ? `${ctx.raw.nome} — Freq: ${ctx.raw.x}% | Média: ${ctx.raw.y}` : '' },
      } },
      scales: {
        x: { title: { display: true, text: 'Frequência (%)', color: 'var(--sieac-text-muted)' }, min: 0, max: 100, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)' } },
        y: { title: { display: true, text: 'Média Final', color: 'var(--sieac-text-muted)' }, min: 0, max: 10, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)' } },
      },
    },
  });

  renderMatrizRisco(alunos);
}

function renderMatrizRisco(alunos) {
  const counts = {
    aa: 0, ar: 0,
    ra: 0, rr: 0,
  }; // freq-alta/aprovado, freq-alta/reprovado, freq-baixa/aprovado, freq-baixa/reprovado
  alunos.forEach(a => {
    const freqAlta = a.freqMedia != null && a.freqMedia >= 75;
    const reprov = a.situacao === 'Reprovado';
    if (freqAlta && !reprov) counts.aa++;
    else if (freqAlta && reprov) counts.ar++;
    else if (!freqAlta && !reprov) counts.ra++;
    else counts.rr++;
  });
  const total = Math.max(1, alunos.length);
  const bg = (v, heavy) => `rgba(${heavy ? '230,57,70' : '45,198,83'},${0.1 + (v / total) * 0.6})`;

  $('#matriz-body').innerHTML = `
    <div class="matriz-grid">
      <div class="matriz-cell" style="font-weight:600;">Freq / Situação</div>
      <div class="matriz-cell" style="font-weight:600;">Aprovado/Recuperação</div>
      <div class="matriz-cell" style="font-weight:600;">Reprovado</div>
      <div class="matriz-cell" style="font-weight:600;">Freq ≥ 75%</div>
      <div class="matriz-cell" style="background:${bg(counts.aa, false)};"><div class="matriz-count">${counts.aa}</div><div class="matriz-pct">${((counts.aa / total) * 100).toFixed(1).replace('.', ',')}%</div></div>
      <div class="matriz-cell" style="background:${bg(counts.ar, true)};"><div class="matriz-count">${counts.ar}</div><div class="matriz-pct">${((counts.ar / total) * 100).toFixed(1).replace('.', ',')}%</div></div>
      <div class="matriz-cell" style="font-weight:600;">Freq &lt; 75%</div>
      <div class="matriz-cell" style="background:${bg(counts.ra, false)};"><div class="matriz-count">${counts.ra}</div><div class="matriz-pct">${((counts.ra / total) * 100).toFixed(1).replace('.', ',')}%</div></div>
      <div class="matriz-cell" style="background:${bg(counts.rr, true)};"><div class="matriz-count">${counts.rr}</div><div class="matriz-pct">${((counts.rr / total) * 100).toFixed(1).replace('.', ',')}%</div></div>
    </div>
    <div class="est-note">Quadrante inferior direito (frequência &lt; 75% + reprovado) indica o maior risco de não conclusão. Tons mais fortes = maior proporção de estudantes.</div>
  `;
}

// ======================= ABA 3 — EVOLUÇÃO =======================
async function renderEvolucao(container, alunos) {
  const prof = await getRankingProfessores(getFilters());
  const comBim = alunos.filter(a => [a.bim1, a.bim2, a.bim3, a.bim4].filter(x => x != null).length >= 2);
  let subiram = 0, caíram = 0, mantiveram = 0;
  const deltas = [];
  const individuos = [];
  comBim.forEach(a => {
    const vistos = [a.bim1, a.bim2, a.bim3, a.bim4].filter(x => x != null);
    const b1 = vistos[0], b4 = vistos[vistos.length - 1];
    const d = b4 - b1;
    deltas.push(d);
    individuos.push({ nome: a.nome, matricula: a.matricula, b1, b2: a.bim2, b3: a.bim3, b4, d });
    if (d > 0.5) subiram++;
    else if (d < -0.5) caíram++;
    else mantiveram++;
  });

  container.innerHTML = `
    <div class="kpi-mini">
      <div class="kpi-mini-item"><div class="kpi-mini-label">Subiram (Δ &gt; 0,5)</div><div class="kpi-mini-value" style="color:var(--sieac-success);">${subiram}</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">Se mantiveram</div><div class="kpi-mini-value" style="color:var(--sieac-warning);">${mantiveram}</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">Caíram (Δ &lt; -0,5)</div><div class="kpi-mini-value" style="color:var(--sieac-danger);">${caíram}</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">Δ médio 1º→4º bim</div><div class="kpi-mini-value">${num(media(deltas))}</div></div>
    </div>

    ${criarCanvas('evol-evolucao', 'Evolução dos Estudantes entre Bimestres' + infoBtn('Evolução entre Bimestres', 'Quantos estudantes melhoraram (Δ &gt; 0,5), pioraram (Δ &lt; -0,5) ou se mantiveram (entre -0,5 e 0,5) comparando a média do 4º com a do 1º bimestre.') )}

    ${criarCanvas('crit-evolucao', 'Disciplinas Críticas' + infoBtn('Disciplinas Críticas', 'Disciplinas com maior percentual de estudantes abaixo de 6,0, indicando maior dificuldade; a cor reflete o coeficiente de variação (dispersão).')) }

    <div class="card-sieac mb-4">
      <div class="card-sieac-header">Estudantes que mais evoluíram / regrediram</div>
      <div class="card-sieac-body">
        <div class="table-responsive-custom" style="max-height:350px;overflow:auto;">
          <table class="stat-table">
            <thead><tr><th>Estudante</th><th>1º</th><th>2º</th><th>3º</th><th>4º</th><th>Δ</th></tr></thead>
            <tbody>
              ${individuos.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 15).map(a => `<tr>
                <td>${escapeHtml(a.nome)}</td><td>${num(a.b1)}</td><td>${num(a.b2)}</td><td>${num(a.b3)}</td><td>${num(a.b4)}</td>
                <td style="color:${a.d >= 0 ? 'var(--sieac-success)' : 'var(--sieac-danger)'};font-weight:600;">${a.d >= 0 ? '+' : ''}${a.d.toFixed(1).replace('.', ',')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card-sieac">
      <div class="card-sieac-header">Ranking por Professor ${infoBtn('Ranking por Professor', 'Média das notas, percentual de aproveitamento (notas ≥ 6) e quantidade de disciplinas/componentes ministrados por cada professor, considerando os filtros.')}</div>
      <div class="card-sieac-body">
        <div class="table-responsive-custom" style="max-height:350px;overflow:auto;">
          <table class="stat-table">
            <thead><tr><th>Professor</th><th>Média</th><th>Aprovação</th><th>Alocações</th></tr></thead>
            <tbody>
              ${(prof?.data || []).map(p => `<tr>
                <td>${escapeHtml(p.professor)}</td>
                <td>${num(p.media)}</td>
                <td>${formatPercentLocal(p.aprovacao, 0)}</td>
                <td>${p.alocacoes != null ? p.alocacoes : '—'}</td>
              </tr>`).join('') || '<tr><td colspan="4" class="est-empty">Sem dados de professores.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  novaChart('evol-evolucao', {
    type: 'bar',
    data: {
      labels: ['Subiram', 'Se mantiveram', 'Caíram'],
      datasets: [{ label: 'Estudantes', data: [subiram, mantiveram, caíram], backgroundColor: ['#2dc653', '#f5a623', '#e63946'], borderRadius: 4 }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: getTooltipOptions() }, scales: { y: { beginAtZero: true, ticks: { color: 'var(--sieac-text-muted)', precision: 0 }, grid: { color: 'var(--sieac-border)', drawBorder: false } }, x: { grid: { display: false }, ticks: { color: 'var(--sieac-text-muted)' } } } },
  });

  carregarDisciplinasCriticas('crit-evolucao');
}

async function carregarDisciplinasCriticas(canvasId) {
  const crit = (await getDisciplinasCriticas(getFilters())).data || [];
  const sorted = crit.slice(0, 12);
  novaChart(canvasId, {
    type: 'bar',
    data: {
      labels: sorted.map(d => d.disciplina),
      datasets: [{
        label: '% abaixo de 6', data: sorted.map(d => d.pctAbaixo),
        backgroundColor: sorted.map(d => d.cv >= 30 ? 'rgba(230,57,70,0.75)' : d.cv >= 15 ? 'rgba(245,166,35,0.75)' : 'rgba(45,198,83,0.75)'), borderRadius: 4,
      }],
    },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...getTooltipOptions(), callbacks: { label: ctx => `% abaixo de 6: ${ctx.parsed.x}%` } } }, scales: { x: { beginAtZero: true, max: 100, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)', callback: v => v + '%' } }, y: { grid: { display: false }, ticks: { color: 'var(--sieac-text-muted)' } } } },
  });
}

// ======================= ABA 4 — EQUIDADE NEE =======================
function renderEquidade(container, alunos) {
  container.innerHTML = `<div class="est-empty">Carregando dados de equidade…</div>`;
  getEquidadeNee(getFilters()).then(res => {
    const d = res.data || {};
    const cards = (rotulo, obj) => `
      <div class="kpi-mini-item"><div class="kpi-mini-label">${rotulo} — estudantes</div><div class="kpi-mini-value">${obj.qtd}</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">${rotulo} — média</div><div class="kpi-mini-value">${num(obj.media)}</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">${rotulo} — frequência</div><div class="kpi-mini-value">${pct(obj.frequencia)}</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">${rotulo} — aprovação</div><div class="kpi-mini-value">${formatPercentLocal(obj.aprovacao, 0)}</div></div>`;

    container.innerHTML = `
      <div class="kpi-mini">${cards('Com NEE', d.comNee)}</div>
      <div class="kpi-mini">${cards('Sem NEE', d.semNee)}</div>
      ${criarCanvas('nee-equidade', 'Comparativo Com NEE vs Sem NEE')}
      <div class="card-sieac mb-4">
        <div class="card-sieac-header">Aprovação por Tipo de Necessidade</div>
        <div class="card-sieac-body">
          <div class="table-responsive-custom" style="max-height:320px;overflow:auto;">
            <table class="stat-table"><thead><tr><th>Tipo</th><th>N</th><th>Média</th><th>Frequência</th><th>Aprovação</th></tr></thead>
              <tbody>${(d.porTipo || []).map(t => `<tr><td>${escapeHtml(t.tipo)}</td><td>${t.qtd}</td><td>${num(t.media)}</td><td>${pct(t.frequencia)}</td><td>${formatPercentLocal(t.aprovacao, 0)}</td></tr>`).join('') || '<tr><td colspan="5" class="est-empty">Sem dados de tipos de necessidade.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="card-sieac">
        <div class="card-sieac-header">Indicadores por Professor de AEE</div>
        <div class="card-sieac-body">
          <div class="table-responsive-custom" style="max-height:320px;overflow:auto;">
            <table class="stat-table"><thead><tr><th>Professor AEE</th><th>N</th><th>Média</th><th>Frequência</th><th>Aprovação</th></tr></thead>
              <tbody>${(d.porAee || []).map(t => `<tr><td>${escapeHtml(t.professor)}</td><td>${t.qtd}</td><td>${num(t.media)}</td><td>${pct(t.frequencia)}</td><td>${formatPercentLocal(t.aprovacao, 0)}</td></tr>`).join('') || '<tr><td colspan="5" class="est-empty">Sem dados de professores AEE.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    novaChart('nee-equidade', {
      type: 'bar',
      data: {
        labels: ['Média', 'Aprovação (%)'],
        datasets: [
          { label: 'Com NEE', data: [d.comNee.media, d.comNee.aprovacao], backgroundColor: 'rgba(245,166,35,0.75)', borderRadius: 4 },
          { label: 'Sem NEE', data: [d.semNee.media, d.semNee.aprovacao], backgroundColor: 'rgba(49,47,146,0.6)', borderRadius: 4 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: 'var(--sieac-text-muted)' } }, tooltip: getTooltipOptions() }, scales: { y: { beginAtZero: true, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)' } }, x: { grid: { display: false }, ticks: { color: 'var(--sieac-text-muted)' } } } },
    });
  }).catch(err => {
    container.innerHTML = `<div class="est-empty">Erro: ${escapeHtml(err.message || String(err))}</div>`;
  });
}

// ======================= ABA 5 — PREDIÇÃO =======================
function renderPredicao(container, alunos) {
  const validos = alunos.filter(a => isFinite(a.mediaGeral));
  const comFreq = validos.filter(a => a.freqMedia != null);

  // ---- Préparar features normalizadas para regressão logística ----
  const dadosLog = comFreq.filter(a => a.situacao !== 'Sem Notas');
  const reprovadosExistentes = dadosLog.filter(a => a.situacao === 'Reprovado').length;
  const recuperacaoExistentes = dadosLog.filter(a => a.situacao === 'Recuperação').length;

  // Features: [mediaGeral_norm, freqMedia_norm]
  const feat1 = normalizar(dadosLog.map(a => a.mediaGeral));
  const feat2 = normalizar(dadosLog.map(a => a.freqMedia));
  const X = dadosLog.map((_, i) => [feat1.dados[i], feat2.dados[i]]);
  const y = dadosLog.map(a => (a.situacao === 'Reprovado' ? 1 : 0));

  let modelo = null;
  if (dadosLog.length >= 5 && reprovadosExistentes >= 2 && (dadosLog.length - reprovadosExistentes) >= 2) {
    modelo = regressaoLogistica(X, y, { lr: 0.5, iteracoes: 3000, regul: 0.001 });
  }

  const comPred = dadosLog.map(a => {
    const i = dadosLog.indexOf(a);
    let pRep;
    if (modelo) {
      pRep = modelo.prever([feat1.dados[i], feat2.dados[i]]);
    } else {
      // fallback heurístico
      pRep = a.mediaGeral < 4 ? 0.85 : a.mediaGeral < 6 ? 0.45 : 0.05;
      if (a.freqMedia != null && a.freqMedia < 75) pRep = Math.min(1, pRep + 0.35);
      if (a.freqMedia != null && a.freqMedia >= 90 && pRep < 0.5) pRep *= 0.5;
    }
    return { aluno: a, prob: Math.round(pRep * 100) };
  }).sort((a, b) => b.prob - a.prob);

  const altoRisco = comPred.filter(x => x.prob >= 60).length;
  const medioRisco = comPred.filter(x => x.prob >= 30 && x.prob < 60).length;
  const baixoRisco = comPred.filter(x => x.prob < 30).length;

  container.innerHTML = `
    <div class="est-note" style="margin-bottom:8px;">
      <i class="bi bi-info-circle"></i> Estimativas baseadas nos dados atuais ${(modelo ? '(modelo de regressão logística ajustado aos dados do período)' : '(regra heurística — poucos dados para ajuste automático)')}. Não são previsões definitivas.
    </div>
    <div class="kpi-mini">
      <div class="kpi-mini-item"><div class="kpi-mini-label">Alto risco (≥ 60%)</div><div class="kpi-mini-value" style="color:var(--sieac-danger);">${altoRisco}</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">Médio risco (30–59%)</div><div class="kpi-mini-value" style="color:var(--sieac-warning);">${medioRisco}</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">Baixo risco (&lt; 30%)</div><div class="kpi-mini-value" style="color:var(--sieac-success);">${baixoRisco}</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">Reprovados (atual)</div><div class="kpi-mini-value" style="color:var(--sieac-danger);">${reprovadosExistentes}</div></div>
      <div class="kpi-mini-item"><div class="kpi-mini-label">Em recuperação (atual)</div><div class="kpi-mini-value" style="color:var(--sieac-warning);">${recuperacaoExistentes}</div></div>
    </div>

    <div class="card-sieac mb-4">
      <div class="card-sieac-header">Risco estimado de reprovação (Top 20) ${infoBtn('Risco de Reprovação', 'Probabilidade estimada de o estudante encerrar reprovado, considerando a média geral e a frequência média. Quando há dados suficientes é usada regressão logística; caso contrário, regra heurística calibrada.')}</div>
      <div class="card-sieac-body">
        <div class="table-responsive-custom" style="max-height:450px;overflow:auto;">
          <table class="stat-table">
            <thead><tr><th>Estudante</th><th>Turma</th><th>Média</th><th>Freq</th><th>Risco</th></tr></thead>
            <tbody>
              ${comPred.slice(0, 20).map(x => {
                const a = x.aluno;
                const cor = x.prob >= 60 ? 'var(--sieac-danger)' : x.prob >= 30 ? 'var(--sieac-warning)' : 'var(--sieac-success)';
                return `<tr><td>${escapeHtml(a.nome)}</td><td>${escapeHtml(a.turma)}</td><td>${num(a.mediaGeral)}</td><td>${a.freqMedia != null ? a.freqMedia.toFixed(1).replace('.', ',') + '%' : '—'}</td>
                <td><div style="display:flex;align-items:center;gap:8px;"><span style="color:${cor};font-weight:700;min-width:38px;">${x.prob}%</span><div class="risk-bar"><div style="width:${x.prob}%;background:${cor}"></div></div></div></td></tr>`;
              }).join('') || '<tr><td colspan="5" class="est-empty">Sem dados para predição.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card-sieac mb-4">
      <div class="card-sieac-header">Perfis de Risco (Agrupamento k-means) ${infoBtn('Perfis de Risco', 'O k-means agrupa automaticamente os estudantes em 3 perfis usando apenas duas medidas — a Média Final e a Frequência média. Cada grupo reúne estudantes parecidos nessas duas dimensões e é rotulado conforme o nível de risco (média < 6 e/ou frequência < 75%). O gráfico mostra um ponto por estudante (eixo X = frequência, eixo Y = média); o resumo abaixo informa quantos estudantes cada perfil reúne e as médias de cada grupo.')}</div>
      <div class="card-sieac-body">
        <div class="chart-container" style="height:400px;"><canvas id="pred-predicao"></canvas></div>
      </div>
    </div>

    <div class="card-sieac">
      <div class="card-sieac-header">Alerta de Frequência (tendência) ${infoBtn('Alerta de Frequência', 'Estudantes com tendência de queda na frequência (últimos meses) e/ou frequência média atual abaixo de 75%, sinalizando risco de reprovação por faltas.')}</div>
      <div class="card-sieac-body">
        <div class="table-responsive-custom" style="max-height:350px;overflow:auto;">
          <table class="stat-table">
            <thead><tr><th>Estudante</th><th>Turma</th><th>Freq média</th><th>Tendência</th><th>Status</th></tr></thead>
            <tbody>
              ${alunos.filter(a => (a.freqMeses || []).length >= 2).map(a => {
                const mes = a.freqMeses.sort((p, q) => p.mes - q.mes);
                const xs = mes.map(m => m.mes);
                const ys = mes.map(m => m.percent);
                const reg = regressaoLinear(xs, ys);
                const inclinacao = isFinite(reg.slope) ? reg.slope : 0;
                const freqAtual = mes.length ? mes[mes.length - 1].percent : null;
                const abaixo = a.freqMedia != null && a.freqMedia < 75;
                const caindo = inclinacao < -2;
                const cor = abaixo || caindo ? 'var(--sieac-danger)' : 'var(--sieac-success)';
                const status = abaixo ? 'Abaixo de 75%' : caindo ? 'Queda de frequência' : 'OK';
                return `<tr><td>${escapeHtml(a.nome)}</td><td>${escapeHtml(a.turma)}</td><td>${a.freqMedia != null ? a.freqMedia.toFixed(1).replace('.', ',') + '%' : '—'}</td><td style="color:${inclinacao < 0 ? 'var(--sieac-danger)' : 'var(--sieac-success)'};">${inclinacao < 0 ? '▼' : '▲'} ${inclinacao.toFixed(1).replace('.', ',')}/mês</td><td style="color:${cor};font-weight:600;">${status}</td></tr>`;
              }).join('') || '<tr><td colspan="5" class="est-empty">Sem dados de frequência suficientes.</td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="est-note">Tendência calculada por regressão linear sobre os meses de frequência disponíveis. '▼ queda' com inclinação &lt; -2/mês; status vermelho quando a frequência média está abaixo de 75% ou em queda acentuada.</div>
      </div>
    </div>
  `;

  renderClusters(comFreq, 'pred-predicao');
}

function renderClusters(comFreq, canvasId) {
  const pontos = comFreq.map(a => [normalizeCliente(a.mediaGeral, 0, 10), normalizeCliente(a.freqMedia, 0, 100)]);
  if (pontos.length < 3) {
    const c = document.getElementById(canvasId);
    if (c) c.parentElement.innerHTML = '<div class="est-empty">Poucos estudantes com média e frequência para agrupar.</div>';
    return;
  }
  const k = Math.min(3, pontos.length);
  const { clusters, centoides } = kMeans(pontos, k);
  const cores = ['#312f92', '#f5a623', '#e63946'];

  const nomePerfil = (mediaR, freqR) => {
    if (mediaR < 6 && freqR < 75) return 'Risco alto — freq < 75% e média < 6';
    if (mediaR >= 6 && freqR >= 75) return 'Baixo risco — média ≥ 6 e freq ≥ 75%';
    if (mediaR < 6) return 'Média baixa (risco de reprovação)';
    return 'Frequência baixa (risco por faltas)';
  };

  const perfis = [];
  const datasets = clusters.map((ids, cIdx) => {
    const pts = ids.map(i => comFreq[i]).filter(Boolean);
    if (!pts.length) return null;
    const mediaR = pts.reduce((s, a) => s + a.mediaGeral, 0) / pts.length;
    const freqR = pts.reduce((s, a) => s + a.freqMedia, 0) / pts.length;
    const nome = nomePerfil(mediaR, freqR);
    perfis.push({ nome, n: pts.length, media: mediaR, freq: freqR, cor: cores[cIdx % cores.length] });
    return {
      label: `${nome} (${pts.length})`,
      data: pts.map(a => ({ x: a.freqMedia, y: a.mediaGeral, nome: a.nome })),
      backgroundColor: cores[cIdx % cores.length] + 'aa',
      borderColor: cores[cIdx % cores.length],
      pointRadius: 5, pointHoverRadius: 8,
    };
  }).filter(Boolean);

  novaChart(canvasId, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: 'var(--sieac-text-muted)' } }, tooltip: { ...getTooltipOptions(), callbacks: { label: ctx => ctx.raw.nome ? `${ctx.raw.nome} — Freq: ${ctx.raw.x}% | Média: ${ctx.raw.y}` : '' } } },
      scales: {
        x: { title: { display: true, text: 'Frequência (%)', color: 'var(--sieac-text-muted)' }, min: 0, max: 100, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)' } },
        y: { title: { display: true, text: 'Média Final', color: 'var(--sieac-text-muted)' }, min: 0, max: 10, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)' } },
      },
    },
  });

  const canvasEl = document.getElementById(canvasId);
  const wrapper = canvasEl && canvasEl.parentElement;
  if (wrapper) {
    const cartoes = perfis.map(p => `
      <div class="kpi-mini-item">
        <div class="kpi-mini-label" style="color:${p.cor};">${escapeHtml(p.nome)}</div>
        <div class="kpi-mini-value">${p.n} estudantes</div>
        <div style="font-size:0.72rem;color:var(--sieac-text-muted);">média ~${p.media.toFixed(1).replace('.', ',')} · freq ~${p.freq.toFixed(0).replace('.', ',')}%</div>
      </div>`).join('');
    wrapper.insertAdjacentHTML('afterend', `<div class="kpi-mini" style="margin-top:14px;">${cartoes}</div>`);
  }
}

function normalizeCliente(v, min, max) {
  const x = Number(v);
  if (!isFinite(x)) return 0;
  const range = max - min;
  return range === 0 ? 0 : (x - min) / range;
}
