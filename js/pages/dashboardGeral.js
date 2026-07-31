import { $, showToast, formatNumber, formatPercent } from '../utils/helpers.js';
import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { createBarChart, createDoughnutChart, destroyChart } from '../components/Charts.js';
import { getResumoGeral, getMediaPorSerie, getResultadoFinal } from '../repositories/dashboardRepository.js';

const MEDIA_CORTE = 6;

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Visão Geral da Escola</div>
    <div class="page-subtitle">Indicadores consolidados do desempenho acadêmico</div>

    <div id="filter-container-geral"></div>

    <div class="row g-4 mb-4" id="kpi-row">
      <div class="col-6 col-md-2">
        <div class="kpi-card primary">
          <div class="kpi-label">Estudantes</div>
          <div class="kpi-value"><span id="kpi-estudantes">—</span></div>
          <div class="kpi-icon"><i class="bi bi-people"></i></div>
        </div>
      </div>
      <div class="col-6 col-md-2">
        <div class="kpi-card secondary">
          <div class="kpi-label">Turmas</div>
          <div class="kpi-value"><span id="kpi-turmas">—</span></div>
          <div class="kpi-icon"><i class="bi bi-building"></i></div>
        </div>
      </div>
      <div class="col-6 col-md-2">
        <div class="kpi-card" id="kpi-media-card">
          <div class="kpi-label">Média Geral</div>
          <div class="kpi-value"><span id="kpi-media">—</span></div>
          <div class="kpi-icon"><i class="bi bi-graph-up"></i></div>
        </div>
      </div>
      <div class="col-6 col-md-2">
        <div class="kpi-card" id="kpi-freq-card">
          <div class="kpi-label">Frequência</div>
          <div class="kpi-value"><span id="kpi-frequencia">—</span></div>
          <div class="kpi-icon"><i class="bi bi-calendar-check"></i></div>
        </div>
      </div>
      <div class="col-6 col-md-2">
        <div class="kpi-card success">
          <div class="kpi-label">Aprovação</div>
          <div class="kpi-value" style="color:var(--sieac-success)"><span id="kpi-aprovacao">—</span></div>
          <div class="kpi-icon"><i class="bi bi-check-circle"></i></div>
        </div>
      </div>
      <div class="col-6 col-md-2">
        <div class="kpi-card danger">
          <div class="kpi-label">Reprovação</div>
          <div class="kpi-value" style="color:var(--sieac-danger)"><span id="kpi-reprovacao">—</span></div>
          <div class="kpi-icon"><i class="bi bi-x-circle"></i></div>
        </div>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-md-5">
        <div class="chart-card">
          <div class="chart-card-title">Distribuição dos Resultados Finais</div>
          <div class="chart-container" style="height:320px;">
            <canvas id="chart-resultado-final"></canvas>
          </div>
        </div>
      </div>
      <div class="col-md-7">
        <div class="chart-card">
          <div class="chart-card-title">Média por Série</div>
          <div class="chart-container" style="height:320px;">
            <canvas id="chart-media-serie"></canvas>
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
  const resumo = await getResumoGeral(filters);

  animateNumber('kpi-estudantes', resumo.total_estudantes);
  animateNumber('kpi-turmas', resumo.total_turmas);

  const mediaEl = document.getElementById('kpi-media');
  if (mediaEl) {
    mediaEl.textContent = resumo.media_geral;
    const card = document.getElementById('kpi-media-card');
    if (card) {
      if (resumo.media_geral >= MEDIA_CORTE) {
        card.style.borderLeftColor = 'var(--sieac-primary)';
        mediaEl.style.color = 'var(--sieac-primary)';
      } else if (resumo.media_geral >= 5) {
        card.style.borderLeftColor = 'var(--sieac-warning)';
        mediaEl.style.color = 'var(--sieac-warning)';
      } else {
        card.style.borderLeftColor = 'var(--sieac-danger)';
        mediaEl.style.color = 'var(--sieac-danger)';
      }
    }
  }

  const freqEl = document.getElementById('kpi-frequencia');
  if (freqEl) {
    freqEl.textContent = resumo.frequencia_media + '%';
    const card = document.getElementById('kpi-freq-card');
    if (card) {
      if (resumo.frequencia_media >= 90) {
        card.style.borderLeftColor = 'var(--sieac-success)';
      } else if (resumo.frequencia_media >= 75) {
        card.style.borderLeftColor = 'var(--sieac-primary)';
      } else {
        card.style.borderLeftColor = 'var(--sieac-danger)';
      }
    }
  }

  animateNumber('kpi-aprovacao', resumo.aprovacao_pct + '%');
  animateNumber('kpi-reprovacao', resumo.reprovacao_pct + '%');

  const resultado = await getResultadoFinal(filters);
  if (resultado.data) {
    const d = resultado.data;
    createDoughnutChart('chart-resultado-final',
      ['Aprovados', 'Reprovados', 'Recuperação'],
      [d.aprovados, d.reprovados, d.recuperacao],
      ['#2dc653', '#e63946', '#ffd000']
    );
  }

  const series = await getMediaPorSerie(filters);
  if (series.data && series.data.length) {
    createBarChart('chart-media-serie',
      series.data.map(d => d.serie),
      series.data.map(d => d.media),
      'Média'
    );
  } else {
    destroyChart('chart-media-serie');
  }
}

function animateNumber(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
