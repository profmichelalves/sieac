import { $, formatNumber } from '../utils/helpers.js';
import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { createBarChart, createLineChart, createDoughnutChart, destroyAllCharts } from '../components/Charts.js';
import {
  getMediaPorTurma, getMediaPorDisciplina, getMediaPorSerie,
  getEvolucaoBimestral, getDistribuicaoNotas, getMediaPorProfessor
} from '../repositories/dashboardRepository.js';

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Dashboard de Desempenho</div>
    <div class="page-subtitle">Análise detalhada do desempenho acadêmico por diferentes perspectivas</div>

    <div id="filter-container-desempenho"></div>

    <div class="row g-4">
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Média por Série</div>
          <div class="chart-container" style="height:300px;"><canvas id="chart-media-serie"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Média por Turma</div>
          <div class="chart-container" style="height:300px;"><canvas id="chart-media-turma"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Média por Disciplina</div>
          <div class="chart-container" style="height:350px;"><canvas id="chart-media-disc"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Média por Professor</div>
          <div class="chart-container" style="height:350px;"><canvas id="chart-media-prof"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Evolução por Bimestre</div>
          <div class="chart-container" style="height:300px;"><canvas id="chart-evolucao"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Distribuição das Notas</div>
          <div class="chart-container" style="height:300px;"><canvas id="chart-distribuicao"></canvas></div>
        </div>
      </div>
    </div>
  `;

  renderFilterPanel('filter-container-desempenho', () => loadData());
  await loadData();
}

async function loadData() {
  const filters = getFilters();

  const series = await getMediaPorSerie(filters);
  if (series.data && series.data.length) {
    createBarChart('chart-media-serie',
      series.data.map(d => d.serie),
      series.data.map(d => d.media),
      'Média'
    );
  }

  const turmas = await getMediaPorTurma(filters);
  if (turmas.data && turmas.data.length) {
    createBarChart('chart-media-turma',
      turmas.data.map(d => d.turma),
      turmas.data.map(d => d.media),
      'Média'
    );
  }

  const disc = await getMediaPorDisciplina(filters);
  if (disc.data && disc.data.length) {
    createBarChart('chart-media-disc',
      disc.data.map(d => d.disciplina),
      disc.data.map(d => d.media),
      'Média'
    );
  }

  const profs = await getMediaPorProfessor(filters);
  if (profs.data && profs.data.length) {
    createBarChart('chart-media-prof',
      profs.data.map(d => d.professor),
      profs.data.map(d => d.media),
      'Média'
    );
  }

  const evol = await getEvolucaoBimestral(filters);
  if (evol.data) {
    const d = evol.data;
    createLineChart('chart-evolucao',
      ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre'],
      [{
        label: 'Média',
        data: [d.bim1, d.bim2, d.bim3, d.bim4],
        fill: true
      }]
    );
  }

  const dist = await getDistribuicaoNotas(filters);
  if (dist.data) {
    const d = dist.data;
    createDoughnutChart('chart-distribuicao',
      ['Excelente (8-10)', 'Bom (6-8)', 'Regular (4-6)', 'Crítico (0-4)'],
      [d.excelente, d.bom, d.regular, d.critico]
    );
  }
}
