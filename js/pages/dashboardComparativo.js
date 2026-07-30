import { $, formatNumber } from '../utils/helpers.js';
import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { createBarChart, createLineChart, createDoughnutChart, createPolarChart, destroyAllCharts } from '../components/Charts.js';
import {
  getMediaPorTurma, getMediaPorDisciplina, getMediaPorSerie, getMediaPorProfessor,
  getEvolucaoBimestral, getFrequenciaPorTurma
} from '../repositories/dashboardRepository.js';

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Dashboard Comparativo</div>
    <div class="page-subtitle">Análise comparativa entre séries, turmas, disciplinas e professores</div>

    <div id="filter-container-comparativo"></div>

    <div class="row g-4">
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Comparativo: Média por Série</div>
          <div class="chart-container" style="height:320px;"><canvas id="comp-serie"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Comparativo: Média por Turma</div>
          <div class="chart-container" style="height:320px;"><canvas id="comp-turma"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Comparativo: Média por Disciplina</div>
          <div class="chart-container" style="height:350px;"><canvas id="comp-disciplina"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Comparativo: Frequência vs Nota por Turma</div>
          <div class="chart-container" style="height:350px;"><canvas id="comp-freq-nota"></canvas></div>
        </div>
      </div>
      <div class="col-md-12">
        <div class="chart-card">
          <div class="chart-card-title">Comparativo: Evolução por Bimestre (Séries)</div>
          <div class="chart-container" style="height:350px;"><canvas id="comp-evolucao"></canvas></div>
        </div>
      </div>
    </div>
  `;

  renderFilterPanel('filter-container-comparativo', () => loadData());
  await loadData();
}

async function loadData() {
  const filters = getFilters();

  const series = await getMediaPorSerie(filters);
  if (series.data && series.data.length) {
    createBarChart('comp-serie',
      series.data.map(d => d.serie),
      series.data.map(d => d.media),
      'Média Final'
    );
  }

  const turmas = await getMediaPorTurma(filters);
  if (turmas.data && turmas.data.length) {
    createBarChart('comp-turma',
      turmas.data.map(d => d.turma),
      turmas.data.map(d => d.media),
      'Média Final'
    );
  }

  const disc = await getMediaPorDisciplina(filters);
  if (disc.data && disc.data.length) {
    createBarChart('comp-disciplina',
      disc.data.map(d => d.disciplina),
      disc.data.map(d => d.media),
      'Média Final'
    );
  }

  const turmaFreq = await getFrequenciaPorTurma(filters);
  const turmaNota = await getMediaPorTurma(filters);
  if (turmaFreq.data && turmaNota.data && turmaFreq.data.length && turmaNota.data.length) {
    const nomes = [...new Set([...turmaFreq.data.map(d => d.turma), ...turmaNota.data.map(d => d.turma)])];
    const freqMap = {}; turmaFreq.data.forEach(d => freqMap[d.turma] = d.freq);
    const notaMap = {}; turmaNota.data.forEach(d => notaMap[d.turma] = d.media);

    const canvas = document.getElementById('comp-freq-nota');
    const ctx = canvas.getContext('2d');
    if (window.compFreqNotaChart) window.compFreqNotaChart.destroy();

    const colors = ['#1a1a4e', '#00b4d8'];
    window.compFreqNotaChart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: nomes,
        datasets: [
          { label: 'Frequência %', data: nomes.map(n => freqMap[n] || 0), backgroundColor: 'rgba(0,180,216,0.7)', borderRadius: 4 },
          { label: 'Média', data: nomes.map(n => notaMap[n] || 0), backgroundColor: 'rgba(26,26,78,0.7)', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: 'var(--sieac-text-muted)' } },
          tooltip: { backgroundColor: 'var(--sieac-surface)', titleColor: 'var(--sieac-text)', bodyColor: 'var(--sieac-text-secondary)', borderColor: 'var(--sieac-border)', borderWidth: 1, padding: 12, cornerRadius: 8 }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)' } },
          x: { grid: { display: false }, ticks: { color: 'var(--sieac-text-muted)' } }
        }
      }
    });
  }

  createEvolucaoComparativo(filters);
}

async function createEvolucaoComparativo(filters) {
  const { supabaseQuery } = await import('../services/supabase.js');

  const { data: series } = await supabaseQuery('series', { select: 'id,nome' });
  if (!series || !series.length) return;

  const datasets = [];
  const colors = ['#1a1a4e', '#00b4d8', '#ffd000'];

  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const f = { ...filters, serie_id: s.id };
    const { getEvolucaoBimestral: getEvol } = await import('../repositories/dashboardRepository.js');
    const evol = await getEvol(f);

    if (evol.data) {
      datasets.push({
        label: s.nome,
        data: [evol.data.bim1, evol.data.bim2, evol.data.bim3, evol.data.bim4],
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '20',
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 5,
        fill: false,
      });
    }
  }

  if (datasets.length) {
    const canvas = document.getElementById('comp-evolucao');
    if (window.compEvolucaoChart) window.compEvolucaoChart.destroy();

    window.compEvolucaoChart = new Chart(canvas, {
      type: 'line',
      data: { labels: ['1º Bim', '2º Bim', '3º Bim', '4º Bim'], datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: 'var(--sieac-text-muted)' } },
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
