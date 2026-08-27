import { $, formatNumber, formatPercent, escapeHtml } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { createBarChart, createLineChart, destroyAllCharts } from '../components/Charts.js';
import { getFrequenciaPorTurma, getFrequenciaPorMes, getFrequenciaPorSerie, getEstudantesBaixaFrequencia } from '../repositories/dashboardRepository.js';
import { gerarPdfRelatorio } from '../utils/pdf.js';

let freqTurmaData = [];
let baixaFreqData = [];

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Dashboard de Frequência</div>
    <div class="page-subtitle">Acompanhamento da frequência dos estudantes</div>

    <div class="card-sieac mb-4">
      <div class="card-sieac-header">Filtros</div>
      <div class="card-sieac-body">
        <div id="filter-container-frequencia"></div>
      </div>
    </div>

    <div class="row g-4 mb-4">
      <div class="col-6 col-md-3">
        <div class="kpi-card primary">
          <div class="kpi-label">Frequência Média</div>
          <div class="kpi-value"><span id="kpi-freq-media">—</span></div>
          <div class="kpi-sub"><span id="kpi-freq-status"></span></div>
          <div class="kpi-icon"><i class="bi bi-calendar-check"></i></div>
          ${infoBtn('Frequência Média', 'Média aritmética das frequências médias de cada turma (percentuais de frequência registrados), considerando os filtros aplicados.')}
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card secondary">
          <div class="kpi-label">Total Registros</div>
          <div class="kpi-value"><span id="kpi-freq-total">—</span></div>
          <div class="kpi-icon"><i class="bi bi-file-text"></i></div>
          ${infoBtn('Total Registros', 'Número de turmas consideradas no cálculo da frequência (grupos com registros de frequência dentro dos filtros).')}
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card success">
          <div class="kpi-label">Freq. ≥ 75%</div>
          <div class="kpi-value"><span id="kpi-freq-ok">—</span></div>
          <div class="kpi-icon"><i class="bi bi-check-circle"></i></div>
          ${infoBtn('Freq. ≥ 75%', 'Quantidade de turmas com frequência média igual ou superior a 75%.')}
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card danger">
          <div class="kpi-label">Freq. &lt; 75%</div>
          <div class="kpi-value"><span id="kpi-freq-alerta">—</span></div>
          <div class="kpi-icon"><i class="bi bi-exclamation-triangle"></i></div>
          ${infoBtn('Freq. < 75%', 'Quantidade de turmas com frequência média inferior a 75%.')}
        </div>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-md-6">
        <div class="chart-card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div class="chart-card-title" style="margin-bottom:0;">Frequência por Turma ${infoBtn('Frequência por Turma', 'Média dos percentuais de frequência registrados, agrupada por turma.')}</div>
            <button class="btn btn-sm btn-outline-primary no-print" id="btn-pdf-freq-turma">
              <i class="bi bi-file-earmark-pdf"></i> Gerar PDF
            </button>
          </div>
          <div class="chart-container" style="height:300px;"><canvas id="chart-freq-turma"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Frequência por Série ${infoBtn('Frequência por Série', 'Média dos percentuais de frequência registrados, agrupada pela série das turmas.')}</div>
          <div class="chart-container" style="height:300px;"><canvas id="chart-freq-serie"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div class="chart-card-title">Evolução Mensal da Frequência ${infoBtn('Evolução Mensal da Frequência', 'Média dos percentuais de frequência por mês de referência (mes_referencia) dos registros de frequência.')}</div>
          <div class="chart-container" style="height:300px;"><canvas id="chart-freq-mes"></canvas></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="chart-card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div class="chart-card-title" style="margin-bottom:0;">Estudantes com Baixa Frequência (&lt; 75%) ${infoBtn('Estudantes com Baixa Frequência', 'Estudantes cuja média dos percentuais de frequência registrados é inferior a 75%. A tabela exibe até 20 nomes; o PDF inclui a lista completa.')}</div>
            <button class="btn btn-sm btn-outline-danger no-print" id="btn-pdf-baixa-freq">
              <i class="bi bi-file-earmark-pdf"></i> Gerar PDF
            </button>
          </div>
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

  await renderFilterPanel('filter-container-frequencia', () => loadData());
  document.getElementById('btn-pdf-freq-turma').addEventListener('click', gerarPdfFrequenciaTurma);
  document.getElementById('btn-pdf-baixa-freq').addEventListener('click', gerarPdfBaixaFrequencia);
  await loadData();
}

async function loadData() {
  const filters = getFilters();

  const freqTurma = await getFrequenciaPorTurma(filters);
  if (freqTurma.data && freqTurma.data.length) {
    freqTurmaData = freqTurma.data;
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

  const baixa = await getEstudantesBaixaFrequencia(75, filters);
  baixaFreqData = baixa.data || [];
  const tbody = document.getElementById('tbody-baixa-freq');
  if (tbody) {
    if (baixaFreqData.length) {
      tbody.innerHTML = baixaFreqData.slice(0, 20).map(e => `
        <tr>
          <td><strong>${escapeHtml(e.nome)}</strong></td>
          <td>${escapeHtml(e.turma)}</td>
          <td>${e.percentual_frequencia}%</td>
          <td><span class="badge badge-sieac-danger">Alerta</span></td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--sieac-text-muted);">Nenhum estudante com baixa frequência</td></tr>';
    }
  }
}

function gerarPdfFrequenciaTurma() {
  const meta = [`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 'Corte de alerta: < 75%'];
  gerarPdfRelatorio({
    titulo: 'FREQUÊNCIA POR TURMA — SIEAC',
    subtitulo: 'Sistema de Indicadores Educacionais',
    meta,
    tabelas: [{
      titulo: 'Frequência média por Turma',
      colunas: ['Turma', 'Frequência (%)'],
      linhas: freqTurmaData.map(d => [d.turma, String(d.freq).replace('.', ',')]),
      colWidths: { 0: 100 },
      total: `Total — ${freqTurmaData.length} turma(s)`,
    }],
  });
}

function gerarPdfBaixaFrequencia() {
  const meta = [`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 'Critério: frequência média < 75%'];
  gerarPdfRelatorio({
    titulo: 'ESTUDANTES COM BAIXA FREQUÊNCIA — SIEAC',
    subtitulo: 'Sistema de Indicadores Educacionais',
    meta,
    tabelas: [{
      titulo: `Estudantes com frequência < 75%`,
      colunas: ['Estudante', 'Matrícula', 'Turma', 'Frequência (%)'],
      linhas: baixaFreqData.map(e => [e.nome, e.matricula, e.turma, String(e.percentual_frequencia).replace('.', ',')]),
      colWidths: { 1: 25, 2: 30, 3: 22 },
      total: `Total — ${baixaFreqData.length} estudante(s) com baixa frequência`,
    }],
  });
}
