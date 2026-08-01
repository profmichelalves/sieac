import { showToast } from '../utils/helpers.js';
import { infoBtn, EXPLICACAO_RESULTADO } from '../utils/explanation.js';
import { supabaseQuery } from '../services/supabase.js';
import { getNotasEstudante, getFrequenciaEstudante, getTurmasEstudante, listarEstudantesParaBusca, podeVerEstudante } from '../repositories/dashboardRepository.js';
import { destroyChart } from '../components/Charts.js';
import { createSearchSelect } from '../components/SearchSelect.js';
import { gerarPdfRelatorio } from '../utils/pdf.js';

let evolChart = null;
let studentCombo = null;
let currentStudentId = null;
let studentInfo = {};
let studentNotas = [];
let studentFreqs = [];

function situacaoBadge(s) {
  if (s === 'Aprovado' || s === 'Em Aprovação') return 'badge-sieac-success';
  if (s === 'Recuperação Final' || s === 'Em Recuperação') return 'badge-sieac-warning';
  return 'badge-sieac-secondary';
}

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <style>
      .student-search { max-width:560px; }
      .student-info-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:20px; }
      .student-info-item { background:var(--sieac-bg); border-radius:var(--sieac-radius); padding:12px 16px; }
      .student-info-item label { font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--sieac-text-muted); display:block; margin-bottom:2px; }
      .student-info-item span { font-size:0.95rem; font-weight:600; color:var(--sieac-text); }
    </style>

    <div class="page-title">Consulta por Estudante</div>
    <div class="page-subtitle">Desempenho individual, notas, frequência e evolução</div>

    <div class="student-search mb-4">
      <div class="filter-group">
        <label class="filter-label">Buscar estudante por nome ou matrícula</label>
        <div id="input-buscar-estudante"></div>
      </div>
    </div>

    <div id="estudante-content" style="display:none;">
      <div class="card-sieac mb-4">
        <div class="card-sieac-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <strong style="font-size:1rem;color:var(--sieac-text);">Informações do Estudante ${infoBtn('Informações do Estudante', 'Dados do estudante (nome, matrícula, turma, série e turno) carregados do cadastro e das notas vinculadas ao aluno.')}</strong>
            <button class="btn btn-sm btn-primary no-print" id="btn-pdf-estudante">
              <i class="bi bi-file-earmark-pdf"></i> Gerar PDF
            </button>
          </div>
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
            <div class="card-sieac-header">Notas por Disciplina ${infoBtn('Notas por Disciplina', 'Notas de cada bimestre e média final por disciplina, extraídas diretamente do cadastro de notas do estudante.' + EXPLICACAO_RESULTADO)}</div>
            <div class="card-sieac-body">
              <div class="table-responsive-custom">
                <table class="table-sieac" id="table-notas-estudante">
                  <thead>
                    <tr><th>Disciplina</th><th class="num">1º Bim</th><th class="num">2º Bim</th><th class="num">3º Bim</th><th class="num">4º Bim</th><th class="num">Média Acumulada</th><th>Situação</th></tr>
                  </thead>
                  <tbody id="tbody-notas-estudante">
                    <tr><td colspan="7" style="text-align:center;color:var(--sieac-text-muted);">Nenhum dado disponível</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="col-md-5">
          <div class="card-sieac">
            <div class="card-sieac-header">Frequência Mensal ${infoBtn('Frequência Mensal', 'Percentual de frequência por mês de referência, extraído do cadastro de frequências do estudante. Status OK quando ≥ 75%.')}</div>
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
            <div class="chart-card-title">Evolução — Média por Bimestre ${infoBtn('Evolução — Média por Bimestre', 'Média das notas de cada bimestre do estudante, considerando apenas notas maiores que zero.' + EXPLICACAO_RESULTADO)}</div>
            <div class="chart-container" style="height:280px;">
              <canvas id="chart-evolucao-estudante"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const listaEstudantes = await listarEstudantesParaBusca();
  studentCombo = createSearchSelect({
    items: listaEstudantes,
    getText: e => `${e.nome} — ${e.matricula}`,
    getValue: e => e.id,
    placeholder: 'Digite para filtrar por nome ou matrícula...',
    onSelect: id => carregarEstudante(id),
  });
  document.getElementById('input-buscar-estudante').appendChild(studentCombo.el);
  document.getElementById('btn-pdf-estudante').addEventListener('click', gerarPdfEstudante);
}

export function unload() {
  if (studentCombo) { studentCombo.destroy(); studentCombo = null; }
  if (evolChart) { evolChart.destroy(); evolChart = null; }
}

async function carregarEstudante(id) {
  const permitido = await podeVerEstudante(id);
  if (!permitido) {
    showToast('Acesso restrito: você só pode visualizar estudantes das suas turmas.', 'warning');
    return;
  }
  currentStudentId = id;
  const { data: estudante, error } = await supabaseQuery('estudantes', { select: 'id,nome,matricula', filters: [{ col: 'id', val: id }] });
  if (error || !estudante || !estudante.length) {
    showToast('Estudante não encontrado', 'error');
    return;
  }
  const e = estudante[0];
  document.getElementById('e-nome').textContent = e.nome;
  document.getElementById('e-matricula').textContent = e.matricula || '-';

  const turmas = await getTurmasEstudante(id);
  studentInfo = {
    nome: e.nome,
    matricula: e.matricula || '-',
    turma: turmas.map(t => t.nome).join(', ') || '-',
    serie: turmas[0]?.serie || '-',
    turno: turmas[0]?.turno || '-',
  };
  document.getElementById('e-turma').textContent = studentInfo.turma;
  document.getElementById('e-serie').textContent = studentInfo.serie;
  document.getElementById('e-turno').textContent = studentInfo.turno;

  document.getElementById('estudante-content').style.display = 'block';

  const notas = await getNotasEstudante(id);
  studentNotas = notas.data || [];
  const tbodyNotas = document.getElementById('tbody-notas-estudante');
  if (studentNotas.length) {
    tbodyNotas.innerHTML = studentNotas.map(n => `
      <tr>
        <td><strong>${n.disciplina}</strong></td>
        <td class="num">${n.nota_1bim || '-'}</td>
        <td class="num">${n.nota_2bim || '-'}</td>
        <td class="num">${n.nota_3bim || '-'}</td>
        <td class="num">${n.nota_4bim || '-'}</td>
        <td class="num" style="font-weight:600;color:${parseFloat(n.media_acumulada) >= 6 ? 'var(--sieac-success)' : 'var(--sieac-danger)'}">${n.media_acumulada || '-'}</td>
        <td><span class="badge ${situacaoBadge(n.situacao)}">${n.situacao}</span></td>
      </tr>
    `).join('');
  } else {
    tbodyNotas.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--sieac-text-muted);">Nenhuma nota encontrada</td></tr>';
  }

  const freqs = await getFrequenciaEstudante(id);
  studentFreqs = freqs.data || [];
  const tbodyFreq = document.getElementById('tbody-freq-estudante');
  if (studentFreqs.length) {
    tbodyFreq.innerHTML = studentFreqs.map(f => {
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
  if (studentNotas.length) {
    const canvas = document.getElementById('chart-evolucao-estudante');
    if (canvas && window.Chart) {
      if (evolChart) evolChart.destroy();
      const ctx = canvas.getContext('2d');
      const b1 = [], b2 = [], b3 = [], b4 = [];
      studentNotas.forEach(n => {
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
            label: studentInfo.nome,
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

function gerarPdfEstudante() {
  if (!currentStudentId) return;

  const notaRows = studentNotas.map(n => [
    n.disciplina,
    n.nota_1bim || '-',
    n.nota_2bim || '-',
    n.nota_3bim || '-',
    n.nota_4bim || '-',
    n.media_acumulada || '-',
    n.situacao,
  ]);
  const medias = studentNotas.map(n => parseFloat(n.media_acumulada)).filter(v => !isNaN(v) && v > 0);
  const mediaGeral = medias.length ? Math.round((medias.reduce((a, b) => a + b, 0) / medias.length) * 10) / 10 : '-';

  const freqRows = studentFreqs.map(f => {
    const pct = parseFloat(f.frequencia);
    const ok = !isNaN(pct) && pct >= 75;
    return [f.mes, !isNaN(pct) ? pct + '%' : '-', ok ? 'OK' : 'Alerta'];
  });
  const freqsVals = studentFreqs.map(f => parseFloat(f.frequencia)).filter(v => !isNaN(v));
  const freqMedia = freqsVals.length ? Math.round((freqsVals.reduce((a, b) => a + b, 0) / freqsVals.length) * 10) / 10 : '-';

  gerarPdfRelatorio({
    titulo: 'CONSULTA POR ESTUDANTE — SIEAC',
    subtitulo: 'Sistema de Indicadores Educacionais Abel Coelho',
    meta: [
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      `Aluno: ${studentInfo.nome}`,
      `Matrícula: ${studentInfo.matricula}`,
      `Turma: ${studentInfo.turma}`,
      `Série: ${studentInfo.serie}`,
      `Turno: ${studentInfo.turno}`,
    ],
    tabelas: [
      {
        titulo: 'Notas por Disciplina',
        colunas: ['Disciplina', '1º Bim', '2º Bim', '3º Bim', '4º Bim', 'Média Acumulada', 'Situação'],
        linhas: notaRows,
        colWidths: { 0: 38, 1: 16, 2: 16, 3: 16, 4: 16, 5: 18, 6: 22 },
        total: `Média geral: ${mediaGeral}`,
      },
      {
        titulo: 'Frequência Mensal',
        colunas: ['Mês', 'Frequência (%)', 'Status'],
        linhas: freqRows,
        colWidths: { 0: 60, 1: 30, 2: 30 },
        total: `Frequência média: ${freqMedia}%`,
      },
    ],
  });
}
