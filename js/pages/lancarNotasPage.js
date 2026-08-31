import { showToast, escapeHtml } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { registrarLog, LOG_ACTIONS } from '../services/logService.js';
import {
  listarOpcoesLancamentoNotas,
  listarEstudantesNotas,
  lancarNotas,
} from '../services/cadastroService.js';

const INFO = 'Lança as <strong>Notas</strong> (bimestre a bimestre) dos estudantes de uma turma para uma determinada disciplina/professor. Filtre por <strong>Turma</strong>, <strong>Disciplina</strong> e <strong>Professor</strong>, preencha as notas e salve. A situação é provisória (EM APROVAÇÃO / EM RECUPERAÇÃO / EM REPROVAÇÃO) enquanto ainda puder mudar e se torna definitiva (APROVADO / RECUPERAÇÃO / REPROVADO) após o lançamento do último bimestre — ou antes, quando mais uma nota não puder mais alterá-la.';

let alocacoes = [];
let registroAlvo = { alocacao_id: null, periodicidade: 'Anual' };

function totalBims(periodicidade) {
  return periodicidade && periodicidade !== 'Anual' ? 2 : 4;
}

function mediaVals(vals, periodicidade) {
  const tb = totalBims(periodicidade);
  const numericos = vals.slice(0, tb).filter(v => v != null && v !== '' && !Number.isNaN(Number(v))).map(Number);
  if (!numericos.length) return 0;
  return (periodicidade && periodicidade !== 'Anual')
    ? numericos.reduce((a, b) => a + b, 0) / 2
    : numericos.reduce((a, b) => a + b, 0) / numericos.length;
}

// Faixa definitiva por média
function faixa(media) {
  if (media >= 6) return 'APROVADO';
  if (media >= 4) return 'RECUPERAÇÃO';
  return 'REPROVADO';
}
function faixaEM(media) {
  if (media >= 6) return 'EM APROVAÇÃO';
  if (media >= 4) return 'EM RECUPERAÇÃO';
  return 'EM REPROVAÇÃO';
}

// Situação da linha (estudante × disciplina): provisória (EM ...) enquanto
// ainda puder mudar; definitiva após o último bimestre ou quando mais uma nota
// não puder mais alterá-la.
export function situacaoLancamento(notas, periodicidade) {
  const tb = totalBims(periodicidade);
  const relevantes = notas.slice(0, tb);
  const preenchidas = relevantes.filter(v => v != null && v !== '' && !Number.isNaN(Number(v))).map(Number);
  const k = preenchidas.length;
  const soma = preenchidas.length ? preenchidas.reduce((a, b) => a + b, 0) : 0;
  const divisor = periodicidade && periodicidade !== 'Anual' ? 2 : 4;

  // Definitivo: todos os bimestres lançados, OU (com resta apenas um bimestre)
  // quando a nota desse bimestre não puder mover a classificação de faixa.
  let definitivo = k >= tb;
  if (!definitivo && tb - k === 1) {
    const mediaMin = (soma + 0) / divisor;
    const mediaMax = (soma + 10) / divisor;
    definitivo = faixa(mediaMin) === faixa(mediaMax);
  }

  const mediaAtual = k ? mediaVals(preenchidas, periodicidade) : 0;
  return {
    situacao: definitivo ? faixa(mediaAtual) : faixaEM(mediaAtual),
    definitivo,
    media: mediaAtual,
  };
}

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Lançar Notas ${infoBtn('Lançar Notas', INFO)}</div>
    <div class="page-subtitle">Registre as notas dos estudantes por turma, disciplina e professor</div>

    <div class="card-sieac">
      <div class="card-sieac-body">
        <div class="row g-3">
          <div class="col-md-4">
            <div class="filter-group">
              <label class="filter-label" for="ln-turma">Turma</label>
              <select class="filter-select" id="ln-turma">
                <option value="">— Selecione —</option>
              </select>
            </div>
          </div>
          <div class="col-md-4">
            <div class="filter-group">
              <label class="filter-label" for="ln-disciplina">Disciplina</label>
              <select class="filter-select" id="ln-disciplina">
                <option value="">— Selecione —</option>
              </select>
            </div>
          </div>
          <div class="col-md-2">
            <div class="filter-group">
              <label class="filter-label" for="ln-professor">Professor</label>
              <select class="filter-select" id="ln-professor">
                <option value="">— Selecione —</option>
              </select>
            </div>
          </div>
          <div class="col-md-2">
            <div class="filter-group">
              <label class="filter-label" for="ln-periodicidade">Periodicidade</label>
              <select class="filter-select" id="ln-periodicidade">
                <option value="Anual">Anual</option>
                <option value="1º Semestre">1º Semestre</option>
                <option value="2º Semestre">2º Semestre</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card-sieac mt-3" id="ln-grid-card" style="display:none;">
      <div class="card-sieac-header">
        <span id="ln-grid-titulo">Notas</span>
        <button class="btn btn-sm btn-primary" id="ln-salvar" style="border-radius:var(--sieac-radius-pill);">
          <i class="bi bi-check-lg"></i> Salvar Notas
        </button>
      </div>
      <div class="card-sieac-body">
        <div class="table-responsive">
          <table class="table table-hover align-middle sieac-table">
            <thead>
              <tr>
                <th>Estudante</th>
                <th style="width:110px;">1º Bim</th>
                <th style="width:110px;">2º Bim</th>
                <th style="width:110px;">3º Bim</th>
                <th style="width:110px;">4º Bim</th>
                <th style="width:90px;">Média</th>
                <th style="width:150px;">Situação</th>
              </tr>
            </thead>
            <tbody id="ln-tbody">
              <tr><td colspan="7" class="text-center text-muted py-4">
                <span class="spinner-border spinner-border-sm me-2"></span> Carregando estudantes...
              </td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('ln-turma').addEventListener('change', onTurmaChange);
  document.getElementById('ln-disciplina').addEventListener('change', onDisciplinaChange);
  document.getElementById('ln-professor').addEventListener('change', onProfessorChange);
  document.getElementById('ln-periodicidade').addEventListener('change', recalcularResumo);
  document.getElementById('ln-salvar').addEventListener('click', salvar);

  await carregarOpcoes();
}

export function unload() {}

async function carregarOpcoes() {
  const { data } = await listarOpcoesLancamentoNotas();
  alocacoes = data || [];
  const turmas = [...new Map(alocacoes.map(a => [a.turma_id, a.turma_nome])).entries()]
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'pt-BR'));
  const selTurma = document.getElementById('ln-turma');
  selTurma.innerHTML = '<option value="">— Selecione —</option>' + turmas.map(([id, nome]) =>
    `<option value="${id}">${escapeHtml(nome)}</option>`).join('');
}

function alocacoesTurma() {
  const t = Number(document.getElementById('ln-turma').value || 0);
  return alocacoes.filter(a => Number(a.turma_id) === t);
}

function onTurmaChange() {
  const lista = alocacoesTurma();
  const disc = [...new Map(lista.map(a => [a.componente_id, a.componente_nome])).entries()]
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'pt-BR'));
  const selD = document.getElementById('ln-disciplina');
  selD.innerHTML = '<option value="">— Selecione —</option>' + disc.map(([id, nome]) =>
    `<option value="${id}">${escapeHtml(nome)}</option>`).join('');
  const selP = document.getElementById('ln-professor');
  selP.innerHTML = '<option value="">— Selecione —</option>';
  document.getElementById('ln-grid-card').style.display = 'none';
}

function onDisciplinaChange() {
  const lista = alocacoesTurma();
  const d = Number(document.getElementById('ln-disciplina').value || 0);
  const profs = [...new Map(lista.filter(a => Number(a.componente_id) === d).map(a => [a.professor_id, a.professor_nome])).entries()]
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'pt-BR'));
  const selP = document.getElementById('ln-professor');
  selP.innerHTML = '<option value="">— Selecione —</option>' + profs.map(([id, nome]) =>
    `<option value="${id}">${escapeHtml(nome)}</option>`).join('');
  document.getElementById('ln-grid-card').style.display = 'none';
}

function onProfessorChange() {
  const t = Number(document.getElementById('ln-turma').value || 0);
  const d = Number(document.getElementById('ln-disciplina').value || 0);
  const p = Number(document.getElementById('ln-professor').value || 0);
  const aloc = alocacoes.find(a => Number(a.turma_id) === t && Number(a.componente_id) === d && Number(a.professor_id) === p);
  if (!aloc) {
    document.getElementById('ln-grid-card').style.display = 'none';
    return;
  }
  registroAlvo = { alocacao_id: aloc.alocacao_id, periodicidade: aloc.periodicidade || 'Anual' };
  document.getElementById('ln-periodicidade').value = registroAlvo.periodicidade;
  document.getElementById('ln-grid-titulo').textContent =
    `Notas — ${aloc.turma_nome} · ${aloc.componente_nome} · ${aloc.professor_nome}`;
  document.getElementById('ln-grid-card').style.display = '';
  carregarEstudantes();
}

async function carregarEstudantes() {
  const tbody = document.getElementById('ln-tbody');
  tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">
    <span class="spinner-border spinner-border-sm me-2"></span> Carregando estudantes...
  </td></tr>`;
  const { data } = await listarEstudantesNotas(registroAlvo.alocacao_id);
  const estudantes = data || [];
  if (!estudantes.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">
      Nenhum estudante nesta turma.
    </td></tr>`;
    return;
  }
  tbody.innerHTML = estudantes.map(e => `
    <tr data-estudante="${e.estudante_id}">
      <td class="fw-semibold">${escapeHtml(e.nome)} <span class="text-muted small">(${escapeHtml(e.matricula || '-')})</span></td>
      <td><input type="number" step="0.1" min="0" max="10" class="form-control form-control-sm ln-nota" data-bim="1" value="${numStr(e.nota_1bim)}"></td>
      <td><input type="number" step="0.1" min="0" max="10" class="form-control form-control-sm ln-nota" data-bim="2" value="${numStr(e.nota_2bim)}"></td>
      <td><input type="number" step="0.1" min="0" max="10" class="form-control form-control-sm ln-nota" data-bim="3" value="${numStr(e.nota_3bim)}"></td>
      <td><input type="number" step="0.1" min="0" max="10" class="form-control form-control-sm ln-nota" data-bim="4" value="${numStr(e.nota_4bim)}"></td>
      <td class="ln-media fw-semibold"></td>
      <td class="ln-resultado"></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.ln-nota').forEach(inp => {
    inp.addEventListener('input', () => recalcularLinha(inp.closest('tr')));
  });
  tbody.querySelectorAll('tr[data-estudante]').forEach(tr => recalcularLinha(tr));
}

function numStr(v) {
  return (v == null || v === '' || Number.isNaN(Number(v))) ? '' : String(v);
}

function recalcularLinha(tr) {
  const periodicidade = document.getElementById('ln-periodicidade').value || 'Anual';
  const notas = Array.from(tr.querySelectorAll('.ln-nota')).map(c => c.value === '' ? null : Number(c.value));
  const { media, situacao, definitivo } = situacaoLancamento(notas, periodicidade);
  tr.querySelector('.ln-media').textContent = media ? media.toFixed(1) : '';
  tr.querySelector('.ln-resultado').innerHTML = resultadoBadge(situacao, definitivo);
}

function recalcularResumo() {
  document.querySelectorAll('#ln-tbody tr[data-estudante]').forEach(tr => recalcularLinha(tr));
}

function resultadoBadge(situacao, definitivo) {
  const em = situacao.startsWith('EM ');
  let cls = 'bg-secondary';
  if (em) cls = 'bg-info text-dark';
  else if (situacao === 'APROVADO') cls = 'bg-success';
  else if (situacao === 'RECUPERAÇÃO') cls = 'bg-warning text-dark';
  else if (situacao === 'REPROVADO') cls = 'bg-danger';
  const icon = definitivo ? ' <i class="bi bi-lock-fill" style="font-size:.65rem;"></i>' : '';
  return `<span class="badge ${cls}" style="font-weight:600;">${situacao}${icon}</span>`;
}

async function salvar() {
  const periodicidade = document.getElementById('ln-periodicidade').value || 'Anual';
  const tb = totalBims(periodicidade);
  const rows = document.querySelectorAll('#ln-tbody tr[data-estudante]');
  const notas = [];
  rows.forEach(tr => {
    const estudante_id = Number(tr.dataset.estudante);
    const bims = tr.querySelectorAll('.ln-nota');
    const payload = { estudante_id };
    let algum = false;
    bims.forEach(c => {
      const bim = Number(c.dataset.bim);
      const k = `nota_${bim}bim`;
      if (bim > tb) { payload[k] = null; return; }
      const v = c.value.trim();
      if (v === '') { payload[k] = null; }
      else { payload[k] = Number(v); algum = true; }
    });
    if (algum) notas.push(payload);
  });

  if (!notas.length) {
    showToast('Preencha ao menos uma nota para salvar.', 'error');
    return;
  }
  const alocacaoId = registroAlvo.alocacao_id;
  const btn = document.getElementById('ln-salvar');
  btn.disabled = true;
  const r = await lancarNotas(alocacaoId, periodicidade, notas);
  btn.disabled = false;
  if (r.error) {
    showToast(`Erro: ${r.error}`, 'error');
    return;
  }
  registrarLog(LOG_ACTIONS.LANCAR_NOTAS, { alocacao_id: alocacaoId, periodicidade, quantidade: notas.length });
  showToast(`Notas salvas (${r.data?.atualizadas ?? notas.length} estudantes)!`, 'success');
  await carregarEstudantes();
}
