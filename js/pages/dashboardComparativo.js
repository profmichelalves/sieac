import { $, formatNumber } from '../utils/helpers.js';
import { infoBtn, EXPLICACAO_RESULTADO } from '../utils/explanation.js';
import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { getScatterFreqNota } from '../repositories/dashboardRepository.js';
import { destroyChart } from '../components/Charts.js';
import { gerarPdfRelatorio } from '../utils/pdf.js';

let scatterChart = null;
let scatterData = [];

const QUADRANTES = [
  { quad: 1, cond: p => p.frequencia >= 75 && p.media >= 6, label: 'Frequência ≥ 75% e Média ≥ 6', desc: 'Situação adequada' },
  { quad: 2, cond: p => p.frequencia >= 75 && p.media < 6, label: 'Frequência ≥ 75% e Média < 6', desc: 'Dificuldade acadêmica' },
  { quad: 3, cond: p => p.frequencia < 75 && p.media < 6, label: 'Frequência < 75% e Média < 6', desc: 'Situação crítica' },
  { quad: 4, cond: p => p.frequencia < 75 && p.media >= 6, label: 'Frequência < 75% e Média ≥ 6', desc: 'Falta sem comprometer nota' },
];

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Análise Combinada</div>
    <div class="page-subtitle">Relação entre frequência e desempenho acadêmico</div>

    <div id="filter-container-comparativo"></div>

    <div class="row g-4">
      <div class="col-12">
        <div class="chart-card">
          <div class="chart-card-title">Frequência x Média Final ${infoBtn('Frequência x Média Final', 'Cada ponto representa um estudante com média final maior que zero e frequência registrada. Eixo X: média dos percentuais de frequência do estudante; Eixo Y: média das médias finais das suas disciplinas.' + EXPLICACAO_RESULTADO)}</div>
          <div class="chart-container" style="height:500px;">
            <canvas id="chart-scatter"></canvas>
          </div>
          <div style="margin-top:8px;font-size:0.78rem;color:var(--sieac-text-muted);text-align:center;">
            Cada ponto representa um estudante. Passe o mouse sobre os pontos para detalhes.
          </div>
        </div>
      </div>
    </div>

    <div class="row g-4 mt-2">
      <div class="col-md-12">
        <div class="card-sieac">
          <div class="card-sieac-header">Quadrantes de Atenção ${infoBtn('Quadrantes de Atenção', 'Cada estudante é classificado pelo cruzamento entre frequência e média final: Q1 — frequência ≥ 75% e média ≥ 6 (adequada); Q2 — frequência ≥ 75% e média < 6 (dificuldade acadêmica); Q3 — frequência < 75% e média < 6 (crítica); Q4 — frequência < 75% e média ≥ 6 (falta sem comprometer a nota).')}</div>
          <div class="card-sieac-body">
            <div class="row g-3">
              <div class="col-md-3">
                <div class="kpi-card success" style="margin-bottom:0;">
                  <div class="kpi-label">Frequência ≥ 75% e Média ≥ 6</div>
                  <div class="kpi-value" style="color:var(--sieac-success);font-size:1.5rem;"><span id="quadrante-1">—</span></div>
                  <div style="font-size:0.7rem;color:var(--sieac-text-muted);">Situação adequada</div>
                  <button class="btn btn-sm btn-outline-success quadrant-btn no-print mt-2" data-quad="1">
                    <i class="bi bi-file-earmark-pdf"></i> PDF
                  </button>
                  ${infoBtn('Quadrante 1', 'Estudantes com frequência média ≥ 75% e média final ≥ 6. Situação adequada.')}
                </div>
              </div>
              <div class="col-md-3">
                <div class="kpi-card warning" style="margin-bottom:0;">
                  <div class="kpi-label">Frequência ≥ 75% e Média &lt; 6</div>
                  <div class="kpi-value" style="color:var(--sieac-warning);font-size:1.5rem;"><span id="quadrante-2">—</span></div>
                  <div style="font-size:0.7rem;color:var(--sieac-text-muted);">Dificuldade acadêmica</div>
                  <button class="btn btn-sm btn-outline-warning quadrant-btn no-print mt-2" data-quad="2">
                    <i class="bi bi-file-earmark-pdf"></i> PDF
                  </button>
                  ${infoBtn('Quadrante 2', 'Estudantes com frequência média ≥ 75% e média final < 6. Dificuldade acadêmica.')}
                </div>
              </div>
              <div class="col-md-3">
                <div class="kpi-card danger" style="margin-bottom:0;">
                  <div class="kpi-label">Frequência &lt; 75% e Média &lt; 6</div>
                  <div class="kpi-value" style="color:var(--sieac-danger);font-size:1.5rem;"><span id="quadrante-3">—</span></div>
                  <div style="font-size:0.7rem;color:var(--sieac-text-muted);">Situação crítica</div>
                  <button class="btn btn-sm btn-outline-danger quadrant-btn no-print mt-2" data-quad="3">
                    <i class="bi bi-file-earmark-pdf"></i> PDF
                  </button>
                  ${infoBtn('Quadrante 3', 'Estudantes com frequência média < 75% e média final < 6. Situação crítica.')}
                </div>
              </div>
              <div class="col-md-3">
                <div class="kpi-card primary" style="margin-bottom:0;">
                  <div class="kpi-label">Frequência &lt; 75% e Média ≥ 6</div>
                  <div class="kpi-value" style="color:var(--sieac-primary);font-size:1.5rem;"><span id="quadrante-4">—</span></div>
                  <div style="font-size:0.7rem;color:var(--sieac-text-muted);">Falta sem comprometer nota</div>
                  <button class="btn btn-sm btn-outline-primary quadrant-btn no-print mt-2" data-quad="4">
                    <i class="bi bi-file-earmark-pdf"></i> PDF
                  </button>
                  ${infoBtn('Quadrante 4', 'Estudantes com frequência média < 75% e média final ≥ 6. Faltas sem comprometer a nota.')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  renderFilterPanel('filter-container-comparativo', () => loadData());
  document.querySelectorAll('.quadrant-btn').forEach(btn => {
    btn.addEventListener('click', () => gerarPdfQuadrante(Number(btn.dataset.quad)));
  });
  await loadData();
}

export function unload() {
  if (scatterChart) { scatterChart.destroy(); scatterChart = null; }
}

async function loadData() {
  const filters = getFilters();
  const scatter = await getScatterFreqNota(filters);
  scatterData = scatter.data || [];

  let q1 = 0, q2 = 0, q3 = 0, q4 = 0;

  if (scatterData.length) {
    scatterData.forEach(p => {
      if (p.frequencia >= 75 && p.media >= 6) q1++;
      else if (p.frequencia >= 75 && p.media < 6) q2++;
      else if (p.frequencia < 75 && p.media < 6) q3++;
      else q4++;
    });

    document.getElementById('quadrante-1').textContent = q1;
    document.getElementById('quadrante-2').textContent = q2;
    document.getElementById('quadrante-3').textContent = q3;
    document.getElementById('quadrante-4').textContent = q4;

    const canvas = document.getElementById('chart-scatter');
    if (canvas && window.Chart) {
      if (scatterChart) scatterChart.destroy();

      const ctx = canvas.getContext('2d');
      scatterChart = new window.Chart(ctx, {
        type: 'scatter',
        data: {
          datasets: [{
            label: 'Estudantes',
            data: scatterData.map(p => ({ x: p.frequencia, y: p.media, nome: p.nome })),
            backgroundColor: scatterData.map(p => {
              if (p.frequencia >= 75 && p.media >= 6) return 'rgba(45,198,83,0.6)';
              if (p.frequencia >= 75 && p.media < 6) return 'rgba(255,208,0,0.6)';
              if (p.frequencia < 75 && p.media < 6) return 'rgba(230,57,70,0.6)';
              return 'rgba(26,26,78,0.6)';
            }),
            borderColor: scatterData.map(p => {
              if (p.frequencia >= 75 && p.media >= 6) return '#2dc653';
              if (p.frequencia >= 75 && p.media < 6) return '#ffd000';
              if (p.frequencia < 75 && p.media < 6) return '#e63946';
              return '#1a1a4e';
            }),
            borderWidth: 1,
            pointRadius: 5,
            pointHoverRadius: 8,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'var(--sieac-surface)',
              titleColor: 'var(--sieac-text)',
              bodyColor: 'var(--sieac-text-secondary)',
              borderColor: 'var(--sieac-border)',
              borderWidth: 1,
              padding: 12,
              cornerRadius: 8,
              callbacks: {
                label: ctx => {
                  const raw = ctx.raw;
                  return `${raw.nome || 'Aluno'} — Frequência: ${raw.x}% | Média: ${raw.y}`;
                }
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: 'Frequência (%)', color: 'var(--sieac-text-muted)' },
              min: 0, max: 100,
              grid: { color: 'var(--sieac-border)', drawBorder: false },
              ticks: { color: 'var(--sieac-text-muted)', stepSize: 10 }
            },
            y: {
              title: { display: true, text: 'Média Final', color: 'var(--sieac-text-muted)' },
              min: 0, max: 10,
              grid: { color: 'var(--sieac-border)', drawBorder: false },
              ticks: { color: 'var(--sieac-text-muted)', stepSize: 1 }
            }
          }
        }
      });
    }
  } else {
    document.getElementById('quadrante-1').textContent = '—';
    document.getElementById('quadrante-2').textContent = '—';
    document.getElementById('quadrante-3').textContent = '—';
    document.getElementById('quadrante-4').textContent = '—';
  }
}

function gerarPdfQuadrante(quad) {
  const info = QUADRANTES.find(x => x.quad === quad);
  if (!info) return;
  const alunos = scatterData.filter(info.cond);
  gerarPdfRelatorio({
    titulo: 'QUADRANTE DE ATENÇÃO — SIEAC',
    subtitulo: 'Sistema de Indicadores Educacionais Abel Coelho',
    meta: [`Gerado em: ${new Date().toLocaleString('pt-BR')}`, `Quadrante: ${info.label}`, info.desc],
    tabelas: [{
      titulo: info.label,
      colunas: ['Estudante', 'Matrícula', 'Frequência (%)', 'Média Final'],
      linhas: alunos.map(a => [a.nome, a.matricula, String(a.frequencia).replace('.', ','), String(a.media).replace('.', ',')]),
      colWidths: { 1: 25, 2: 25, 3: 25 },
      total: `Total — ${alunos.length} estudante(s)`,
    }],
  });
}
