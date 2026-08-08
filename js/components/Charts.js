import { getChartColors, getChartColorsAlpha, getTooltipOptions } from '../utils/helpers.js';

let chartInstances = {};

export function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

export function destroyAllCharts() {
  Object.keys(chartInstances).forEach(id => destroyChart(id));
}

export function createBarChart(canvasId, labels, data, label = 'Valor', options = {}) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const colors = getChartColors();

  chartInstances[canvasId] = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: getChartColorsAlpha(0.7),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 4,
        ...options.datasetOpts
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: getTooltipOptions()
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'var(--sieac-border)', drawBorder: false },
          ticks: { color: 'var(--sieac-text-muted)' }
        },
        x: {
          grid: { display: false },
          ticks: { color: 'var(--sieac-text-muted)' }
        }
      },
      ...options.chartOpts
    }
  });
}

export function createLineChart(canvasId, labels, datasets, options = {}) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const colors = getChartColors();

  const formatted = datasets.map((ds, i) => ({
    label: ds.label,
    data: ds.data,
    borderColor: colors[i % colors.length],
    backgroundColor: getChartColorsAlpha(0.1)[i % colors.length],
    borderWidth: 3,
    tension: 0.4,
    pointRadius: 4,
    pointHoverRadius: 6,
    fill: ds.fill || false,
  }));

  chartInstances[canvasId] = new window.Chart(canvas, {
    type: 'line',
    data: { labels, datasets: formatted },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: 'var(--sieac-text-muted)' }
        },
        tooltip: getTooltipOptions()
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'var(--sieac-border)', drawBorder: false },
          ticks: { color: 'var(--sieac-text-muted)' }
        },
        x: {
          grid: { display: false },
          ticks: { color: 'var(--sieac-text-muted)' }
        }
      },
      ...options
    }
  });
}

export function createDoughnutChart(canvasId, labels, data, colors) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const chartColors = colors || getChartColors();

  chartInstances[canvasId] = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: chartColors,
        borderWidth: 3,
        borderColor: 'var(--sieac-surface)',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: 'var(--sieac-text-muted)', padding: 16 }
        },
        tooltip: {
          ...getTooltipOptions(),
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total ? (ctx.parsed / total * 100).toFixed(1).replace('.', ',') : '0,0';
              return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

export function createPolarChart(canvasId, labels, data) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const colors = getChartColors();

  chartInstances[canvasId] = new window.Chart(canvas, {
    type: 'polarArea',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: getChartColorsAlpha(0.7),
        borderColor: colors,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: 'var(--sieac-text-muted)', padding: 12 }
        }
      },
      scales: {
        r: {
          grid: { color: 'var(--sieac-border)' },
          ticks: { display: false }
        }
      }
    }
  });
}
