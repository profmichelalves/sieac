import { $, formatNumber } from '../utils/helpers.js';
import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { getScatterFreqNota } from '../repositories/dashboardRepository.js';
import { destroyChart } from '../components/Charts.js';

let scatterChart = null;

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Análise Combinada</div>
    <div class="page-subtitle">Relação entre frequência e desempenho acadêmico</div>

    <div id="filter-container-comparativo"></div>

    <div class="row g-4">
      <div class="col-12">
        <div class="chart-card">
          <div class="chart-card-title">Frequência x Média Final</div>
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
          <div class="card-sieac-header">Quadrantes de Atenção</div>
          <div class="card-sieac-body">
            <div class="row g-3">
              <div class="col-md-3">
                <div class="kpi-card success" style="margin-bottom:0;">
                  <div class="kpi-label">Frequência ≥ 75% e Média ≥ 6</div>
                  <div class="kpi-value" style="color:var(--sieac-success);font-size:1.5rem;"><span id="quadrante-1">—</span></div>
                  <div style="font-size:0.7rem;color:var(--sieac-text-muted);">Situação adequada</div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="kpi-card warning" style="margin-bottom:0;">
                  <div class="kpi-label">Frequência ≥ 75% e Média &lt; 6</div>
                  <div class="kpi-value" style="color:var(--sieac-warning);font-size:1.5rem;"><span id="quadrante-2">—</span></div>
                  <div style="font-size:0.7rem;color:var(--sieac-text-muted);">Dificuldade acadêmica</div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="kpi-card danger" style="margin-bottom:0;">
                  <div class="kpi-label">Frequência &lt; 75% e Média &lt; 6</div>
                  <div class="kpi-value" style="color:var(--sieac-danger);font-size:1.5rem;"><span id="quadrante-3">—</span></div>
                  <div style="font-size:0.7rem;color:var(--sieac-text-muted);">Situação crítica</div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="kpi-card primary" style="margin-bottom:0;">
                  <div class="kpi-label">Frequência &lt; 75% e Média ≥ 6</div>
                  <div class="kpi-value" style="color:var(--sieac-primary);font-size:1.5rem;"><span id="quadrante-4">—</span></div>
                  <div style="font-size:0.7rem;color:var(--sieac-text-muted);">Falta sem comprometer nota</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  renderFilterPanel('filter-container-comparativo', () => loadData());
  await loadData();
}

export function unload() {
  if (scatterChart) { scatterChart.destroy(); scatterChart = null; }
}

async function loadData() {
  const filters = getFilters();
  const scatter = await getScatterFreqNota(filters);

  let q1 = 0, q2 = 0, q3 = 0, q4 = 0;

  if (scatter.data && scatter.data.length) {
    scatter.data.forEach(p => {
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
            data: scatter.data.map(p => ({ x: p.frequencia, y: p.media, nome: p.nome })),
            backgroundColor: scatter.data.map(p => {
              if (p.frequencia >= 75 && p.media >= 6) return 'rgba(45,198,83,0.6)';
              if (p.frequencia >= 75 && p.media < 6) return 'rgba(255,208,0,0.6)';
              if (p.frequencia < 75 && p.media < 6) return 'rgba(230,57,70,0.6)';
              return 'rgba(26,26,78,0.6)';
            }),
            borderColor: scatter.data.map(p => {
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
