import { showToast, escapeHtml, getTooltipOptions } from '../utils/helpers.js';
import { infoBtn, EXPLICACAO_RESULTADO } from '../utils/explanation.js';
import { supabaseQuery } from '../services/supabase.js';
import { getNotasEstudante, getFrequenciaEstudante, getTurmasEstudante, listarEstudantesParaBusca, listarTurmasParaConsulta, listarEstudantesPorTurma, podeVerEstudante } from '../repositories/dashboardRepository.js';
import { getNecessidadesEstudante } from '../repositories/necessidadesRepository.js';
import { destroyChart } from '../components/Charts.js';
import { createSearchSelect } from '../components/SearchSelect.js';
import { loadEstudanteFiltros, saveEstudanteFiltros, clearEstudanteFiltros } from '../utils/estudanteFiltros.js';
import { gerarPdfRelatorio } from '../utils/pdf.js';

let evolChart = null;
let freqChart = null;
let studentCombo = null;
let turmaCombo = null;
let currentStudentId = null;
let turmaAtualId = '';
let studentInfo = {};
let studentNotas = [];
let studentFreqs = [];
let notasSort = { col: 'disciplina', dir: 'asc' };

function situacaoBadge(s) {
  if (s === 'Aprovado' || s === 'Em Aprovação') return 'badge-sieac-success';
  if (s === 'Recuperação Final' || s === 'Em Recuperação') return 'badge-sieac-warning';
  return 'badge-sieac-danger';
}

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <style>
      .student-info-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:20px; }
      .student-info-item { background:var(--sieac-bg); border-radius:var(--sieac-radius); padding:12px 16px; }
      .student-info-item label { font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--sieac-text-muted); display:block; margin-bottom:2px; }
      .student-info-item span { font-size:0.95rem; font-weight:600; color:var(--sieac-text); }
      #table-notas-estudante th.sortable { cursor:pointer; user-select:none; position:relative; }
      #table-notas-estudante th.sortable:hover { color:var(--sieac-secondary); }
      #table-notas-estudante th.sortable .sort-ind { display:inline-block; width:0; height:0; margin-left:4px; vertical-align:middle; opacity:0.35; }
      #table-notas-estudante th.sortable.sorted-asc .sort-ind { border-left:4px solid transparent; border-right:4px solid transparent; border-bottom:6px solid var(--sieac-secondary); opacity:1; }
      #table-notas-estudante th.sortable.sorted-desc .sort-ind { border-left:4px solid transparent; border-right:4px solid transparent; border-top:6px solid var(--sieac-secondary); opacity:1; }
    </style>

    <div class="page-title">Consulta por Estudante</div>
    <div class="page-subtitle">Desempenho individual, notas, frequência e evolução</div>

    <div class="card-sieac mb-4">
      <div class="card-sieac-header">Filtros</div>
      <div class="card-sieac-body">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="filter-label">Filtrar por turma</label>
            <div id="filtro-turma"></div>
          </div>
          <div class="col-md-4">
            <label class="filter-label">Buscar por nome ou matrícula do estudante</label>
            <div id="input-buscar-estudante"></div>
          </div>
          <div class="col-md-4 d-flex align-items-end gap-2">
            <div class="student-turma-count" id="contagem-estudantes" style="color:var(--sieac-text-muted);font-size:0.85rem;"></div>
            <button class="btn btn-sm btn-outline-secondary" id="btn-limpar-filtros" style="border-radius:var(--sieac-radius-pill);padding:6px 16px;">
              <i class="bi bi-x-circle"></i> Limpar filtros
            </button>
          </div>
        </div>
      </div>
    </div>

    <div id="estudante-content" style="display:none;">
      <div class="card-sieac mb-4">
        <div class="card-sieac-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <strong style="font-size:1rem;color:var(--sieac-text);">Informações do Estudante ${infoBtn('Informações do Estudante', 'Dados do estudante (nome, matrícula, turma, série e turno) carregados do cadastro e das notas vinculadas ao aluno. A Situação é calculada pela frequência total (média dos percentuais mensais) e pela quantidade de disciplinas com média inferior a 6,0: Aprovado (nenhuma abaixo e frequência ≥ 75%), Recuperação (1 a 6 abaixo com frequência ≥ 75%) e Reprovado (frequência < 75% ou mais de 6 abaixo).')}</strong>
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
            <div class="student-info-item"><label>Necessidades</label><span id="e-necessidades">—</span></div>
            <div class="student-info-item"><label>Professor AEE</label><span id="e-professor-aee">—</span></div>
            <div class="student-info-item"><label>Situação</label><span id="e-situacao">—</span></div>
          </div>
        </div>
      </div>

      <div class="row g-4">
        <div class="col-md-12">
          <div class="card-sieac">
            <div class="card-sieac-header">Notas por Disciplina ${infoBtn('Notas por Disciplina', 'Notas de cada bimestre e média final por disciplina, extraídas diretamente do cadastro de notas do estudante.' + EXPLICACAO_RESULTADO)}</div>
            <div class="card-sieac-body">
              <div class="table-responsive-custom">
                <table class="table-sieac" id="table-notas-estudante">
                  <thead>
                    <tr><th class="sortable" data-sort="disciplina">Disciplina <span class="sort-ind"></span></th><th class="num sortable" data-sort="bim1">1º Bim <span class="sort-ind"></span></th><th class="num sortable" data-sort="bim2">2º Bim <span class="sort-ind"></span></th><th class="num sortable" data-sort="bim3">3º Bim <span class="sort-ind"></span></th><th class="num sortable" data-sort="bim4">4º Bim <span class="sort-ind"></span></th><th class="num sortable" data-sort="media">Média Acumulada <span class="sort-ind"></span></th><th class="sortable" data-sort="situacao">Situação <span class="sort-ind"></span></th></tr>
                  </thead>
                  <tbody id="tbody-notas-estudante">
                    <tr><td colspan="7" style="text-align:center;color:var(--sieac-text-muted);">Nenhum dado disponível</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-4 mt-2">
        <div class="col-md-6">
          <div class="chart-card">
            <div class="chart-card-title">Evolução — Média por Bimestre ${infoBtn('Evolução — Média por Bimestre', 'Média das notas de cada bimestre do estudante, considerando apenas notas maiores que zero.' + EXPLICACAO_RESULTADO)}</div>
            <div class="chart-container" style="height:280px;">
              <canvas id="chart-evolucao-estudante"></canvas>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="chart-card">
            <div class="chart-card-title">Evolução — Frequência Mensal ${infoBtn('Evolução — Frequência Mensal', 'Evolução do percentual de frequência do estudante por mês de referência. O percentual de referência para uma frequência adequada é ≥ 75%.')}</div>
            <div class="chart-container" style="height:280px;">
              <canvas id="chart-evolucao-freq"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const turmas = await listarTurmasParaConsulta();
  turmaCombo = createSearchSelect({
    items: turmas,
    getText: t => t.serie ? `${t.nome} — ${t.serie}` : t.nome,
    getValue: t => t.id,
    placeholder: turmas.length ? 'Selecione uma turma...' : 'Nenhuma turma disponível para o seu perfil',
    disabled: !turmas.length,
    onSelect: id => selecionarTurma(id),
  });
  document.getElementById('filtro-turma').appendChild(turmaCombo.el);

  const listaEstudantes = await listarEstudantesParaBusca();
  studentCombo = createSearchSelect({
    items: listaEstudantes,
    getText: e => `${e.nome} — ${e.matricula}`,
    getValue: e => e.id,
    placeholder: 'Digite para filtrar por nome ou matrícula...',
    onSelect: id => carregarEstudante(id),
  });
  document.getElementById('input-buscar-estudante').appendChild(studentCombo.el);
  atualizarContagem(listaEstudantes.length);

  document.getElementById('btn-limpar-filtros').addEventListener('click', limparFiltros);
  document.getElementById('btn-pdf-estudante').addEventListener('click', gerarPdfEstudante);

  await restaurarFiltros(turmas);
}

export function unload() {
  if (studentCombo) { studentCombo.destroy(); studentCombo = null; }
  if (turmaCombo) { turmaCombo.destroy(); turmaCombo = null; }
  if (evolChart) { evolChart.destroy(); evolChart = null; }
  if (freqChart) { freqChart.destroy(); freqChart = null; }
}

function atualizarContagem(total, texto) {
  const el = document.getElementById('contagem-estudantes');
  if (!el) return;
  el.textContent = texto || `${total} estudante(s)`;
}

async function limparFiltros() {
  currentStudentId = null;
  turmaAtualId = '';
  clearEstudanteFiltros();
  document.getElementById('estudante-content').style.display = 'none';
  turmaCombo.clear();
  studentCombo.clear();
  const lista = await listarEstudantesParaBusca();
  studentCombo.setItems(lista);
  atualizarContagem(lista.length);
}

async function restaurarFiltros(turmas) {
  const saved = loadEstudanteFiltros();
  if (!saved || !saved.turmaId) return;
  if (!turmas.some(t => String(t.id) === String(saved.turmaId))) return;
  const lista = await selecionarTurma(String(saved.turmaId));
  if (saved.estudanteId && Array.isArray(lista) && lista.some(e => String(e.id) === String(saved.estudanteId))) {
    studentCombo.setValue(String(saved.estudanteId));
    carregarEstudante(Number(saved.estudanteId));
  }
}

async function selecionarTurma(turmaId) {
  turmaAtualId = turmaId || '';
  currentStudentId = null;
  document.getElementById('estudante-content').style.display = 'none';
  if (!turmaId) {
    const lista = await listarEstudantesParaBusca();
    studentCombo.setItems(lista);
    atualizarContagem(lista.length);
    saveEstudanteFiltros({ turmaId: '', estudanteId: null });
    return lista;
  }
  studentCombo.clear();
  atualizarContagem(0, 'Carregando estudantes...');
  const lista = await listarEstudantesPorTurma(turmaId);
  studentCombo.setItems(lista);
  atualizarContagem(lista.length);
  saveEstudanteFiltros({ turmaId: turmaId, estudanteId: null });
  if (lista.length === 1) carregarEstudante(lista[0].id);
  return lista;
}

async function carregarEstudante(id) {
  const permitido = await podeVerEstudante(id);
  if (!permitido) {
    showToast('Acesso restrito: você só pode visualizar estudantes das suas turmas.', 'warning');
    return;
  }
  currentStudentId = id;
  saveEstudanteFiltros({ turmaId: turmaAtualId, estudanteId: id });
  notasSort = { col: 'disciplina', dir: 'asc' };
  const { data: estudante, error } = await supabaseQuery('estudantes', { select: 'id,id_pessoa,nome,matricula', filters: [{ col: 'id', val: id }] });
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

  const nee = await getNecessidadesEstudante(e.id_pessoa);
  studentInfo.necessidades = nee.tipos.length ? nee.tipos.join(', ') : 'Não informado';
  studentInfo.professorAee = nee.professorAee ? nee.professorAee.nome : 'Não informado';
  document.getElementById('e-necessidades').innerHTML = nee.tipos.length
    ? nee.tipos.map(n => `<span class="badge badge-sieac-secondary" style="margin:2px 4px 2px 0;font-size:0.72rem;">${escapeHtml(n)}</span>`).join('')
    : 'Não informado';
  document.getElementById('e-professor-aee').textContent = studentInfo.professorAee;

  document.getElementById('estudante-content').style.display = 'block';

  const notas = await getNotasEstudante(id);
  studentNotas = notas.data || [];
  renderNotasTable();

  document.querySelectorAll('#table-notas-estudante thead th.sortable').forEach(th => {
    th.onclick = () => {
      const col = th.dataset.sort;
      if (notasSort.col === col) {
        notasSort.dir = notasSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        notasSort = { col, dir: 'asc' };
      }
      renderNotasTable();
    };
  });

  const freqs = await getFrequenciaEstudante(id);
  studentFreqs = freqs.data || [];
  atualizarSituacaoEstudante();

  // Evolução chart
  if (studentNotas.length) {
    const canvas = document.getElementById('chart-evolucao-estudante');
    if (canvas && window.Chart) {
      if (evolChart) evolChart.destroy();
      const ctx = canvas.getContext('2d');
      const b1 = [], b2 = [], b3 = [], b4 = [];
      studentNotas.forEach(n => {
        const v1 = parseFloat(n.nota_1bim); if (!isNaN(v1)) b1.push(v1);
        const v2 = parseFloat(n.nota_2bim); if (!isNaN(v2)) b2.push(v2);
        const v3 = parseFloat(n.nota_3bim); if (!isNaN(v3)) b3.push(v3);
        const v4 = parseFloat(n.nota_4bim); if (!isNaN(v4)) b4.push(v4);
      });
      const m = arr => arr.length ? Math.round(arr.reduce((a,b) => a+b,0)/arr.length * 10) / 10 : null;
      const dados = [m(b1), m(b2), m(b3), m(b4)];
      const corPonto = dados.map(v => (v != null && v < 6) ? '#e01e1e' : '#1d9e6f');
      evolChart = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: ['1º Bim', '2º Bim', '3º Bim', '4º Bim'],
          datasets: [{
            label: studentInfo.nome,
            data: dados,
            borderColor: '#312f92',
            backgroundColor: 'rgba(49,47,146,0.08)',
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: corPonto,
            pointBorderColor: corPonto,
            pointHoverBackgroundColor: corPonto,
            fill: true,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: getTooltipOptions()
          },
          scales: {
            y: { beginAtZero: true, max: 10, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)' } },
            x: { grid: { display: false }, ticks: { color: 'var(--sieac-text-muted)' } }
          }
        }
      });
    }
  }

  // Evolução — Frequência Mensal chart
  const freqCanvas = document.getElementById('chart-evolucao-freq');
  if (freqCanvas && window.Chart) {
    if (freqChart) freqChart.destroy();
    const ordemMes = { 'Jan':1,'Fev':2,'Mar':3,'Abr':4,'Mai':5,'Jun':6,'Jul':7,'Ago':8,'Set':9,'Out':10,'Nov':11,'Dez':12 };
    const ordenadas = [...studentFreqs].sort((a, b) => (ordemMes[a.mes] || 0) - (ordemMes[b.mes] || 0));
    const valsFreq = ordenadas.map(f => {
      const pct = parseFloat(f.frequencia);
      return isNaN(pct) ? null : pct;
    });
    const corPonto = valsFreq.map(v => (v != null && v < 75) ? '#e01e1e' : '#1d9e6f');
    const ctxFreq = freqCanvas.getContext('2d');
    freqChart = new window.Chart(ctxFreq, {
      type: 'line',
      data: {
        labels: ordenadas.map(f => f.mes),
        datasets: [{
          label: 'Frequência (%)',
          data: valsFreq,
          borderColor: '#1d9e6f',
          backgroundColor: 'rgba(29,158,111,0.10)',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: corPonto,
          pointBorderColor: corPonto,
          pointHoverBackgroundColor: corPonto,
          fill: true,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: getTooltipOptions()
        },
        scales: {
          y: { beginAtZero: true, max: 100, grid: { color: 'var(--sieac-border)', drawBorder: false }, ticks: { color: 'var(--sieac-text-muted)', callback: v => v + '%' } },
          x: { grid: { display: false }, ticks: { color: 'var(--sieac-text-muted)' } }
        }
      }
    });
  }
}

function valorNotasCol(n, col) {
  switch (col) {
    case 'disciplina': return (n.disciplina || '').toLowerCase();
    case 'bim1': return parseFloat(n.nota_1bim);
    case 'bim2': return parseFloat(n.nota_2bim);
    case 'bim3': return parseFloat(n.nota_3bim);
    case 'bim4': return parseFloat(n.nota_4bim);
    case 'media': return parseFloat(n.media_acumulada);
    case 'situacao': return (n.situacao || '').toLowerCase();
    default: return '';
  }
}

function renderNotasTable() {
  const tbodyNotas = document.getElementById('tbody-notas-estudante');
  if (!tbodyNotas) return;

  document.querySelectorAll('#table-notas-estudante thead th.sortable').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.sort === notasSort.col) th.classList.add(notasSort.dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
  });

  const ordenadas = [...studentNotas].sort((a, b) => {
    const va = valorNotasCol(a, notasSort.col);
    const vb = valorNotasCol(b, notasSort.col);
    let cmp = 0;
    if (typeof va === 'number' && typeof vb === 'number') {
      const aN = isNaN(va), bN = isNaN(vb);
      if (aN && bN) cmp = 0;
      else if (aN) cmp = 1;
      else if (bN) cmp = -1;
      else cmp = va - vb;
    } else {
      cmp = String(va).localeCompare(String(vb), 'pt-BR', { numeric: true });
    }
    return notasSort.dir === 'asc' ? cmp : -cmp;
  });

  if (!ordenadas.length) {
    tbodyNotas.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--sieac-text-muted);">Nenhuma nota encontrada</td></tr>';
    return;
  }

  tbodyNotas.innerHTML = ordenadas.map(n => `
    <tr>
      <td><strong>${escapeHtml(n.disciplina)}</strong></td>
      <td class="num">${n.nota_1bim || '-'}</td>
      <td class="num">${n.nota_2bim || '-'}</td>
      <td class="num">${n.nota_3bim || '-'}</td>
      <td class="num">${n.nota_4bim || '-'}</td>
      <td class="num" style="font-weight:600;color:${parseFloat(n.media_acumulada) >= 6 ? 'var(--sieac-success)' : 'var(--sieac-danger)'}">${n.media_acumulada == null ? '-' : n.media_acumulada}</td>
      <td><span class="badge ${situacaoBadge(n.situacao)}">${escapeHtml(n.situacao)}</span></td>
    </tr>
  `).join('');
}

function disciplinaPossuiDados(n) {
  const vals = [n.nota_1bim, n.nota_2bim, n.nota_3bim, n.nota_4bim];
  if (vals.some(v => !isNaN(parseFloat(v)))) return true;
  return !isNaN(parseFloat(n.media_final));
}

function mediaDisciplina(n) {
  let m = parseFloat(n.media_acumulada);
  if (isNaN(m)) m = 0;
  if (m === 0) {
    const mf = parseFloat(n.media_final);
    if (!isNaN(mf) && mf > 0) m = mf;
  }
  return m;
}

function atualizarSituacaoEstudante() {
  const el = document.getElementById('e-situacao');
  if (!el) return;

  const freqsVals = studentFreqs.map(f => parseFloat(f.frequencia)).filter(v => !isNaN(v));
  const frequencia = freqsVals.length ? freqsVals.reduce((a, b) => a + b, 0) / freqsVals.length : null;

  const qtdAbaixo = studentNotas.filter(n => disciplinaPossuiDados(n) && mediaDisciplina(n) < 6).length;

  const tem4Bim = studentNotas.some(n => !isNaN(parseFloat(n.nota_4bim)));
  const periodo = tem4Bim ? 'anual' : 'parcial';

  let situacao;
  if (frequencia != null && frequencia < 75) situacao = 'reprovado';
  else if (qtdAbaixo > 6) situacao = 'reprovado';
  else if (qtdAbaixo >= 1) situacao = 'recuperacao';
  else situacao = 'aprovado';

  const labelMap = {
    aprovado: periodo === 'anual' ? 'Aprovado' : 'Em Aprovação',
    recuperacao: periodo === 'anual' ? 'Recuperação Final' : 'Em Recuperação',
    reprovado: periodo === 'anual' ? 'Reprovado' : 'Em Reprovação',
  };
  const badgeClass = situacao === 'aprovado' ? 'badge-sieac-success'
    : situacao === 'recuperacao' ? 'badge-sieac-warning'
    : 'badge-sieac-danger';

  const freqTxt = frequencia == null ? '—' : Math.round(frequencia * 10) / 10 + '%';

  el.innerHTML = `
    <span class="badge ${badgeClass}">${escapeHtml(labelMap[situacao])}</span>
    <div style="font-size:0.75rem;font-weight:400;color:var(--sieac-text-muted);margin-top:6px;line-height:1.5;">
      Frequência total: <strong>${freqTxt}</strong><br>
      Disciplinas abaixo da média: <strong>${qtdAbaixo}</strong>
    </div>`;
}

function gerarPdfEstudante() {
  if (!currentStudentId) return;

  const notaRows = studentNotas.map(n => [
    n.disciplina,
    n.nota_1bim || '-',
    n.nota_2bim || '-',
    n.nota_3bim || '-',
    n.nota_4bim || '-',
    n.media_acumulada == null ? '-' : n.media_acumulada,
    n.situacao,
  ]);
  const medias = studentNotas.map(n => parseFloat(n.media_acumulada)).filter(v => !isNaN(v));
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
    subtitulo: 'Sistema de Indicadores Educacionais',
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
