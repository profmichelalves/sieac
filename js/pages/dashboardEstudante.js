import { $, showToast } from '../utils/helpers.js';
import { supabaseQuery } from '../services/supabase.js';
import { getNotasEstudante, getFrequenciaEstudante, getTurmasEstudante } from '../repositories/dashboardRepository.js';
import { destroyChart } from '../components/Charts.js';

let evolChart = null;
let currentStudentId = null;

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <style>
      .student-search { max-width:500px; }
      .student-info-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:20px; }
      .student-info-item { background:var(--sieac-bg); border-radius:var(--sieac-radius); padding:12px 16px; }
      .student-info-item label { font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--sieac-text-muted); display:block; margin-bottom:2px; }
      .student-info-item span { font-size:0.95rem; font-weight:600; color:var(--sieac-text); }
    </style>

    <div class="page-title">Consulta por Estudante</div>
    <div class="page-subtitle">Desempenho individual, notas, frequência e evolução</div>

    <div class="student-search mb-4">
      <div class="filter-group">
        <label class="filter-label">Selecione o Estudante</label>
        <select class="filter-select" id="select-estudante">
          <option value="">— Selecione um estudante —</option>
        </select>
      </div>
    </div>

    <div id="estudante-content" style="display:none;">
      <div class="card-sieac mb-4">
        <div class="card-sieac-body">
          <div class="student-info-grid" id="estudante-info">
            <div class="student-info-item"><label>Nome</label><span id="e-nome">—</span></div>
            <div class="student-info-item"><label>Matrícula</label><span id="e-matricula">—</span></div>
            <div class="student-info-item"><label>Turma</label><span id="e-turma">—</span></div>
            <div class="student-info-item"><label>Série</label><span id="e-serie">—</span></div>
            <div class="student-info-item"><label>Turno</label><span id="e-turno">—</span></div>
          </div>
        </div>
      </div>

      <div class="row g-4">
        <div class="col-md-7">
          <div class="card-sieac">
            <div class="card-sieac-header">Notas por Disciplina</div>
            <div class="card-sieac-body">
              <div class="table-responsive-custom">
                <table class="table-sieac" id="table-notas-estudante">
                  <thead>
                    <tr><th>Disciplina</th><th class="num">1º Bim</th><th class="num">2º Bim</th><th class="num">3º Bim</th><th class="num">4º Bim</th><th class="num">Média</th></tr>
                  </thead>
                  <tbody id="tbody-notas-estudante">
                    <tr><td colspan="6" style="text-align:center;color:var(--sieac-text-muted);">Nenhum dado disponível</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="col-md-5">
          <div class="card-sieac">
            <div class="card-sieac-header">Frequência Mensal</div>
            <div class="card-sieac-body">
              <div class="table-responsive-custom">
                <table class="table-sieac" id="table-freq-estudante">
                  <thead>
                    <tr><th>Mês</th><th class="num">Frequência</th><th>Status</th></tr>
                  </thead>
                  <tbody id="tbody-freq-estudante">
                    <tr><td colspan="3" style="text-align:center;color:var(--sieac-text-muted);">Nenhum dado disponível</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-4 mt-2">
        <div class="col-md-12">
          <div class="chart-card">
            <div class="chart-card-title">Evolução — Média por Bimestre</div>
            <div class="chart-container" style="height:280px;">
              <canvas id="chart-evolucao-estudante"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const { data: estudantes } = await supabaseQuery('estudantes', { select: 'id,nome,matricula', order: 'nome' });
  const sel = document.getElementById('select-estudante');
  (estudantes || []).forEach(e => {
    sel.innerHTML += `<option value="${e.id}">${e.nome}${e.matricula ? ` (${e.matricula})` : ''}</option>`;
  });
  sel.addEventListener('change', () => {
    const id = sel.value;
    if (id) { currentStudentId = id; carregarEstudante(id); }
    else { document.getElementById('estudante-content').style.display = 'none'; }
  });
}

export function unload() {
  if (evolChart) { evolChart.destroy(); evolChart = null; }
}

async function carregarEstudante(id) {
  const { data: estudante, error } = await supabaseQuery('estudantes', { select: 'id,nome,matricula', id });
  if (error || !estudante || !estudante.length) {
    showToast('Estudante não encontrado', 'error');
    return;
  }
  const e = estudante[0];
  document.getElementById('e-nome').textContent = e.nome;
  document.getElementById('e-matricula').textContent = e.matricula || '-';

  const turmas = await getTurmasEstudante(id);
  if (turmas.length) {
    document.getElementById('e-turma').textContent = turmas.map(t => t.nome).join(', ');
    document.getElementById('e-serie').textContent = turmas[0].serie || '-';
    document.getElementById('e-turno').textContent = turmas[0].turno || '-';
  }

  document.getElementById('estudante-content').style.display = 'block';

  const notas = await getNotasEstudante(id);
  const tbodyNotas = document.getElementById('tbody-notas-estudante');
  if (notas.data && notas.data.length) {
    tbodyNotas.innerHTML = notas.data.map(n => `
      <tr>
        <td><strong>${n.disciplina}</strong></td>
        <td class="num">${n.nota_1bim || '-'}</td>
        <td class="num">${n.nota_2bim || '-'}</td>
        <td class="num">${n.nota_3bim || '-'}</td>
        <td class="num">${n.nota_4bim || '-'}</td>
        <td class="num" style="font-weight:600;color:${parseFloat(n.media_final) >= 6 ? 'var(--sieac-success)' : 'var(--sieac-danger)'}">${n.media_final || '-'}</td>
      </tr>
    `).join('');
  } else {
    tbodyNotas.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--sieac-text-muted);">Nenhuma nota encontrada</td></tr>';
  }

  const freqs = await getFrequenciaEstudante(id);
  const tbodyFreq = document.getElementById('tbody-freq-estudante');
  if (freqs.data && freqs.data.length) {
    tbodyFreq.innerHTML = freqs.data.map(f => {
      const pct = parseFloat(f.frequencia);
      const ok = pct >= 75;
      return `<tr>
        <td>${f.mes}</td>
        <td class="num" style="font-weight:600;color:${ok ? 'var(--sieac-success)' : 'var(--sieac-danger)'}">${pct}%</td>
        <td class="num"><span class="badge ${ok ? 'badge-sieac-success' : 'badge-sieac-danger'}">${ok ? 'OK' : 'Alerta'}</span></td>
      </tr>`;
    }).join('');
  } else {
    tbodyFreq.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--sieac-text-muted);">Nenhuma frequência encontrada</td></tr>';
  }

  // Evolução chart
  if (notas.data && notas.data.length) {
    const canvas = document.getElementById('chart-evolucao-estudante');
    if (canvas && window.Chart) {
      if (evolChart) evolChart.destroy();
      const ctx = canvas.getContext('2d');
      const b1 = [], b2 = [], b3 = [], b4 = [];
      notas.data.forEach(n => {
        const v1 = parseFloat(n.nota_1bim); if (!isNaN(v1) && v1 > 0) b1.push(v1);
        const v2 = parseFloat(n.nota_2bim); if (!isNaN(v2) && v2 > 0) b2.push(v2);
        const v3 = parseFloat(n.nota_3bim); if (!isNaN(v3) && v3 > 0) b3.push(v3);
        const v4 = parseFloat(n.nota_4bim); if (!isNaN(v4) && v4 > 0) b4.push(v4);
      });
      const m = arr => arr.length ? Math.round(arr.reduce((a,b) => a+b,0)/arr.length * 10) / 10 : null;
      const dados = [m(b1), m(b2), m(b3), m(b4)];
      evolChart = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: ['1º Bim', '2º Bim', '3º Bim', '4º Bim'],
          datasets: [{
            label: e.nome,
            data: dados,
            borderColor: '#1a1a4e',
            backgroundColor: 'rgba(26,26,78,0.08)',
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 5,
            fill: true,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
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
}
