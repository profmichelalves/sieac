import { $, showToast, formatNumber, formatPercent } from '../utils/helpers.js';
import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { createBarChart, createDoughnutChart, destroyAllCharts } from '../components/Charts.js';
import { getResumoGeral, getMediaPorTurma, getDistribuicaoNotas, getAprovacaoReprovacao } from '../repositories/dashboardRepository.js';

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Dashboard Geral</div>
    <div class="page-subtitle">Visão consolidada dos indicadores educacionais da escola</div>

    <div id="filter-container-geral"></div>

    <div class="row g-4 mb-4" id="kpi-row">
      <div class="col-6 col-md-3">
        <div class="kpi-card primary">
          <div class="kpi-label">Estudantes</div>
          <div class="kpi-value"><span id="kpi-estudantes">—</span></div>
          <div class="kpi-icon"><i class="bi bi-people"></i></div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card secondary">
          <div class="kpi-label">Turmas</div>
          <div class="kpi-value"><span id="kpi-turmas">—</span></div>
          <div class="kpi-icon"><i class="bi bi-building"></i></div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card success">
          <div class="kpi-label">Média Geral</div>
          <div class="kpi-value"><span id="kpi-media">—</span></div>
          <div class="kpi-icon"><i class="bi bi-graph-up"></i></div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card warning">
          <div class="kpi-label">Frequência Média</div>
          <div class="kpi-value"><span id="kpi-frequencia">—</span></div>
          <div class="kpi-icon"><i class="bi bi-calendar-check"></i></div>
        </div>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-md-8">
        <div class="chart-card">
          <div class="chart-card-title">Média por Turma</div>
          <div class="chart-container" style="height:320px;">
            <canvas id="chart-media-turma"></canvas>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="chart-card">
          <div class="chart-card-title">Distribuição de Notas</div>
          <div class="chart-container" style="height:320px;">
            <canvas id="chart-dist-notas"></canvas>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Aprovação vs Reprovação</div>
          <div class="chart-container" style="height:300px;">
            <canvas id="chart-aprovacao"></canvas>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Professores</div>
          <div class="chart-container" style="height:300px;">
            <canvas id="chart-professores"></canvas>
          </div>
        </div>
      </div>
    </div>
  `;

  renderFilterPanel('filter-container-geral', () => loadData());
  await loadData();
}

async function loadData() {
  const filters = getFilters();
  const resumo = await getResumoGeral();

  animateNumber('kpi-estudantes', resumo.total_estudantes);
  animateNumber('kpi-turmas', resumo.total_turmas);
  animateNumber('kpi-media', resumo.media_geral);
  animateNumber('kpi-frequencia', resumo.frequencia_media + '%');

  const medias = await getMediaPorTurma(filters);
  if (medias.data && medias.data.length) {
    createBarChart('chart-media-turma',
      medias.data.map(d => d.turma),
      medias.data.map(d => d.media),
      'Média Final'
    );
  }

  const dist = await getDistribuicaoNotas(filters);
  if (dist.data) {
    const d = dist.data;
    createDoughnutChart('chart-dist-notas',
      ['Excelente (8-10)', 'Bom (6-8)', 'Regular (4-6)', 'Crítico (0-4)'],
      [d.excelente, d.bom, d.regular, d.critico]
    );
  }

  const apr = await getAprovacaoReprovacao(filters);
  if (apr.data) {
    createDoughnutChart('chart-aprovacao',
      ['Aprovados', 'Reprovados', 'Recuperação'],
      [apr.data.aprovados, apr.data.reprovados, apr.data.recuperacao],
      ['#2dc653', '#e63946', '#ffd000']
    );
  }

  createProfessoresChart();
}

function createProfessoresChart() {
  try {
    const canvas = document.getElementById('chart-professores');
    if (!canvas) return;
    destroyAllCharts();
    const ctx = canvas.getContext('2d');
    new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Total'],
        datasets: [{
          label: 'Professores',
          data: [48],
          backgroundColor: ['rgba(26, 26, 78, 0.7)'],
          borderRadius: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)' } },
          x: { grid: { display: false }, ticks: { color: 'var(--sieac-text-muted)' } }
        }
      }
    });
  } catch (e) { /* ignore */ }
}

function animateNumber(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
