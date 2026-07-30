import { $, formatNumber, formatPercent } from '../utils/helpers.js';
import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { createBarChart, createLineChart, destroyAllCharts } from '../components/Charts.js';
import { getFrequenciaPorTurma, getFrequenciaPorMes, getFrequenciaPorSerie, getEstudantesBaixaFrequencia } from '../repositories/dashboardRepository.js';

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Dashboard de Frequência</div>
    <div class="page-subtitle">Acompanhamento da frequência dos estudantes</div>

    <div id="filter-container-frequencia"></div>

    <div class="row g-4 mb-4">
      <div class="col-6 col-md-3">
        <div class="kpi-card primary">
          <div class="kpi-label">Frequência Média</div>
          <div class="kpi-value"><span id="kpi-freq-media">—</span></div>
          <div class="kpi-sub"><span id="kpi-freq-status"></span></div>
          <div class="kpi-icon"><i class="bi bi-calendar-check"></i></div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card secondary">
          <div class="kpi-label">Total Registros</div>
          <div class="kpi-value"><span id="kpi-freq-total">—</span></div>
          <div class="kpi-icon"><i class="bi bi-file-text"></i></div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card success">
          <div class="kpi-label">Freq. ≥ 75%</div>
          <div class="kpi-value"><span id="kpi-freq-ok">—</span></div>
          <div class="kpi-icon"><i class="bi bi-check-circle"></i></div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card danger">
          <div class="kpi-label">Freq. &lt; 75%</div>
          <div class="kpi-value"><span id="kpi-freq-alerta">—</span></div>
          <div class="kpi-icon"><i class="bi bi-exclamation-triangle"></i></div>
        </div>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Frequência por Turma</div>
          <div class="chart-container" style="height:300px;"><canvas id="chart-freq-turma"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Frequência por Série</div>
          <div class="chart-container" style="height:300px;"><canvas id="chart-freq-serie"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Evolução Mensal da Frequência</div>
          <div class="chart-container" style="height:300px;"><canvas id="chart-freq-mes"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Estudantes com Baixa Frequência (&lt; 75%)</div>
          <div class="table-responsive-custom" style="max-height:300px;overflow-y:auto;">
            <table class="table-sieac" id="table-baixa-freq">
              <thead>
                <tr><th>Estudante</th><th>Turma</th><th>Frequência</th><th>Status</th></tr>
              </thead>
              <tbody id="tbody-baixa-freq">
                <tr><td colspan="4" style="text-align:center;color:var(--sieac-text-muted);">Carregando...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  renderFilterPanel('filter-container-frequencia', () => loadData());
  await loadData();
}

async function loadData() {
  const filters = getFilters();

  const freqTurma = await getFrequenciaPorTurma(filters);
  if (freqTurma.data && freqTurma.data.length) {
    const medias = freqTurma.data;
    const mediaGeral = medias.reduce((s, d) => s + d.freq, 0) / medias.length;
    const total = medias.length;
    const acima = medias.filter(d => d.freq >= 75).length;
    const abaixo = medias.filter(d => d.freq < 75).length;

    document.getElementById('kpi-freq-media').textContent = Math.round(mediaGeral) + '%';
    document.getElementById('kpi-freq-total').textContent = total;
    document.getElementById('kpi-freq-ok').textContent = acima;
    document.getElementById('kpi-freq-alerta').textContent = abaixo;

    const status = mediaGeral >= 90 ? 'Excelente' : mediaGeral >= 75 ? 'Adequada' : mediaGeral >= 50 ? 'Alerta' : 'Crítico';
    const statusEl = document.getElementById('kpi-freq-status');
    statusEl.textContent = status;
    statusEl.style.color = mediaGeral >= 75 ? 'var(--sieac-success)' : 'var(--sieac-danger)';

    createBarChart('chart-freq-turma',
      medias.map(d => d.turma),
      medias.map(d => d.freq),
      'Frequência %'
    );
  }

  const freqSerie = await getFrequenciaPorSerie(filters);
  if (freqSerie.data && freqSerie.data.length) {
    createBarChart('chart-freq-serie',
      freqSerie.data.map(d => d.serie),
      freqSerie.data.map(d => d.freq),
      'Frequência %'
    );
  }

  const freqMes = await getFrequenciaPorMes(filters);
  if (freqMes.data && freqMes.data.length) {
    const meses = { '2': 'Fev', '3': 'Mar', '4': 'Abr', '5': 'Mai', '6': 'Jun', '7': 'Jul' };
    createLineChart('chart-freq-mes',
      freqMes.data.map(d => meses[d.mes] || d.mes),
      [{
        label: 'Frequência %',
        data: freqMes.data.map(d => d.freq),
        fill: true
      }]
    );
  }

  const baixa = await getEstudantesBaixaFrequencia(75);
  const tbody = document.getElementById('tbody-baixa-freq');
  if (tbody) {
    if (baixa.data && baixa.data.length) {
      tbody.innerHTML = baixa.data.slice(0, 20).map(e => `
        <tr>
          <td><strong>${e.nome}</strong></td>
          <td>${e.turma}</td>
          <td>${e.percentual_frequencia}%</td>
          <td><span class="badge badge-sieac-danger">Alerta</span></td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--sieac-text-muted);">Nenhum estudante com baixa frequência</td></tr>';
    }
  }
}
