import { $, formatNumber } from '../utils/helpers.js';
import { infoBtn, EXPLICACAO_RESULTADO } from '../utils/explanation.js';
import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { createBarChart, createLineChart, destroyChart } from '../components/Charts.js';
import {
  getMediaPorTurma, getMediaPorDisciplina,
  getEvolucaoBimestral, getDistribuicaoHistograma
} from '../repositories/dashboardRepository.js';

let chartInst = {};

function destroyCanvas(id) {
  if (chartInst[id]) { chartInst[id].destroy(); delete chartInst[id]; }
}

function criarGraficoBarraHorizontal(canvasId, labels, data, label) {
  destroyCanvas(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || !labels.length) return;
  const container = canvas.closest('.chart-container');
  if (container) container.style.height = Math.max(380, labels.length * 28) + 'px';
  const colors = ['#1a1a4e', '#00b4d8', '#2dc653', '#e63946', '#ffd000', '#6f42c1', '#fd7e14', '#20c997'];
  chartInst[canvasId] = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label, data, backgroundColor: labels.map((_, i) => colors[i % colors.length] + '99'), borderRadius: 4 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'var(--sieac-surface)', titleColor: 'var(--sieac-text)', bodyColor: 'var(--sieac-text-secondary)', borderColor: 'var(--sieac-border)', borderWidth: 1, padding: 12, cornerRadius: 8 }
      },
      scales: {
        x: { beginAtZero: true, max: 10, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)' } },
        y: { grid: { display: false }, ticks: { color: 'var(--sieac-text-muted)', autoSkip: false, font: { size: 10 } } }
      }
    }
  });
}

function criarHistograma(canvasId, faixas) {
  destroyCanvas(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const labels = Object.keys(faixas);
  const data = Object.values(faixas);
  const cores = ['#e63946', '#e66746', '#ffd000', '#2dc653', '#1a7a3a'];
  chartInst[canvasId] = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Alunos', data, backgroundColor: cores.map(c => c + '99'), borderRadius: 4 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'var(--sieac-surface)', titleColor: 'var(--sieac-text)', bodyColor: 'var(--sieac-text-secondary)', borderColor: 'var(--sieac-border)', borderWidth: 1, padding: 12, cornerRadius: 8 }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)' } },
        x: { grid: { display: false }, ticks: { color: 'var(--sieac-text-muted)' } }
      }
    }
  });
}

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Desempenho Acadêmico</div>
    <div class="page-subtitle">Análise de notas, evolução da aprendizagem e distribuição</div>

    <div id="filter-container-desempenho"></div>

    <div class="row g-4">
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Evolução das Notas por Bimestre ${infoBtn('Evolução das Notas por Bimestre', 'Média aritmética das notas de cada bimestre (1º ao 4º), considerando apenas notas maiores que zero. Reflete a evolução da aprendizagem ao longo do ano.')}</div>
          <div class="chart-container" style="height:300px;"><canvas id="chart-evolucao"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Média por Disciplina ${infoBtn('Média por Disciplina', 'Média aritmética das médias finais das notas, agrupada por disciplina (componente curricular).')}</div>
          <div class="chart-container" style="height:350px;"><canvas id="chart-media-disc"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Ranking — Média por Turma ${infoBtn('Ranking — Média por Turma', 'Média aritmética das médias finais por turma, ordenada da maior para a menor. As três primeiras colocações recebem destaque (ouro, prata e bronze).')}</div>
          <div class="chart-container" style="height:350px;"><canvas id="chart-media-turma"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Distribuição das Notas ${infoBtn('Distribuição das Notas', 'Histograma das médias finais divididas em faixas: 0–2, 2–4, 4–6, 6–8 e 8–10. Apenas médias finais maiores que zero são consideradas.' + EXPLICACAO_RESULTADO)}</div>
          <div class="chart-container" style="height:350px;"><canvas id="chart-distribuicao"></canvas></div>
        </div>
      </div>
    </div>
  `;

  renderFilterPanel('filter-container-desempenho', () => loadData());
  await loadData();
}

export function unload() {
  Object.keys(chartInst).forEach(id => { try { chartInst[id].destroy(); } catch(e) {} });
  chartInst = {};
}

async function loadData() {
  const filters = getFilters();

  const evol = await getEvolucaoBimestral(filters);
  if (evol.data) {
    const d = evol.data;
    const canvas = document.getElementById('chart-evolucao');
    if (canvas && window.Chart) {
      destroyCanvas('chart-evolucao');
      const ctx = canvas.getContext('2d');
      chartInst['chart-evolucao'] = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre'],
          datasets: [{
            label: 'Média',
            data: [d.bim1, d.bim2, d.bim3, d.bim4],
            borderColor: '#1a1a4e',
            backgroundColor: 'rgba(26,26,78,0.08)',
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 7,
            fill: true,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: 'var(--sieac-surface)', titleColor: 'var(--sieac-text)', bodyColor: 'var(--sieac-text-secondary)', borderColor: 'var(--sieac-border)', borderWidth: 1, padding: 12, cornerRadius: 8 }
          },
          scales: {
            y: { beginAtZero: true, max: 10, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)' } },
            x: { grid: { display: false }, ticks: { color: 'var(--sieac-text-muted)' } }
          }
        }
      });
    }
  }

  const disc = await getMediaPorDisciplina(filters);
  if (disc.data && disc.data.length) {
    const sorted = disc.data.sort((a, b) => a.media - b.media);
    criarGraficoBarraHorizontal('chart-media-disc',
      sorted.map(d => d.disciplina),
      sorted.map(d => d.media),
      'Média'
    );
  }

  const turmas = await getMediaPorTurma(filters);
  if (turmas.data && turmas.data.length) {
    const sorted = turmas.data.sort((a, b) => b.media - a.media);
    const colors = sorted.map((_, i) => i === 0 ? '#ffd000' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--sieac-primary)');
    destroyCanvas('chart-media-turma');
    const canvas = document.getElementById('chart-media-turma');
    if (canvas && window.Chart) {
      const ctx = canvas.getContext('2d');
      chartInst['chart-media-turma'] = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: sorted.map(d => d.turma),
          datasets: [{ label: 'Média', data: sorted.map(d => d.media), backgroundColor: colors, borderRadius: 4 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: 'var(--sieac-surface)', titleColor: 'var(--sieac-text)', bodyColor: 'var(--sieac-text-secondary)', borderColor: 'var(--sieac-border)', borderWidth: 1, padding: 12, cornerRadius: 8 }
          },
          scales: {
            y: { beginAtZero: true, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)' } },
            x: { grid: { display: false }, ticks: { color: 'var(--sieac-text-muted)' } }
          }
        }
      });
    }
  }

  const hist = await getDistribuicaoHistograma(filters);
  if (hist.data) {
    criarHistograma('chart-distribuicao', hist.data);
  }
}
