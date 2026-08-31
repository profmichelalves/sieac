import { showToast, escapeHtml } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { registrarLog, LOG_ACTIONS } from '../services/logService.js';
import {
  listarTurmas,
  listarEstudantesFrequencia,
  lancarFrequencias,
} from '../services/cadastroService.js';

const INFO = 'Lança a <strong>Frequência</strong> (percentual de presença) dos estudantes de uma turma para um mês de referência. Selecione a turma e o mês, informe o percentual de cada estudante e salve.';

const MESES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

let turmas = [];

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Lançar Frequência ${infoBtn('Lançar Frequência', INFO)}</div>
    <div class="page-subtitle">Registre o percentual de frequência dos estudantes por turma e mês</div>

    <div class="card-sieac">
      <div class="card-sieac-body">
        <div class="row g-3">
          <div class="col-md-8">
            <div class="filter-group">
              <label class="filter-label" for="lf-turma">Turma</label>
              <select class="filter-select" id="lf-turma">
                <option value="">— Selecione —</option>
              </select>
            </div>
          </div>
          <div class="col-md-4">
            <div class="filter-group">
              <label class="filter-label" for="lf-mes">Mês de referência</label>
              <select class="filter-select" id="lf-mes">
                ${MESES.map(m => `<option value="${m}">${m}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card-sieac mt-3" id="lf-grid-card" style="display:none;">
      <div class="card-sieac-header">
        <span id="lf-grid-titulo">Frequência</span>
        <button class="btn btn-sm btn-primary" id="lf-salvar" style="border-radius:var(--sieac-radius-pill);">
          <i class="bi bi-check-lg"></i> Salvar Frequência
        </button>
      </div>
      <div class="card-sieac-body">
        <div class="table-responsive">
          <table class="table table-hover align-middle sieac-table">
            <thead>
              <tr>
                <th>Estudante</th>
                <th style="width:180px;">% de Frequência</th>
              </tr>
            </thead>
            <tbody id="lf-tbody">
              <tr><td colspan="2" class="text-center text-muted py-4">
                <span class="spinner-border spinner-border-sm me-2"></span> Carregando estudantes...
              </td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('lf-turma').addEventListener('change', onTurmaChange);
  document.getElementById('lf-mes').addEventListener('change', onTurmaChange);
  document.getElementById('lf-salvar').addEventListener('click', salvar);

  await carregarTurmas();
}

export function unload() {}

async function carregarTurmas() {
  const { data } = await listarTurmas();
  turmas = data || [];
  const sel = document.getElementById('lf-turma');
  sel.innerHTML = '<option value="">— Selecione —</option>' + turmas.map(t => `
    <option value="${t.id}">${escapeHtml(t.nome)}</option>
  `).join('');
}

function valoresSelecao() {
  const turmaId = Number(document.getElementById('lf-turma').value || 0);
  const mes = document.getElementById('lf-mes').value;
  return { turmaId, mes };
}

function onTurmaChange() {
  const { turmaId, mes } = valoresSelecao();
  const grid = document.getElementById('lf-grid-card');
  if (!turmaId || !mes) {
    grid.style.display = 'none';
    return;
  }
  const t = turmas.find(x => x.id === turmaId);
  document.getElementById('lf-grid-titulo').textContent = `Frequência — ${t ? t.nome : ''} · Mês ${mes}`;
  grid.style.display = '';
  carregarEstudantes();
}

async function carregarEstudantes() {
  const { turmaId, mes } = valoresSelecao();
  const tbody = document.getElementById('lf-tbody');
  tbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted py-4">
    <span class="spinner-border spinner-border-sm me-2"></span> Carregando estudantes...
  </td></tr>`;
  const { data } = await listarEstudantesFrequencia(turmaId, mes);
  const estudantes = data || [];
  if (!estudantes.length) {
    tbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted py-4">
      Nenhum estudante encontrado nesta turma.
    </td></tr>`;
    return;
  }
  tbody.innerHTML = estudantes.map(e => `
    <tr data-estudante="${e.estudante_id}">
      <td class="fw-semibold">${escapeHtml(e.nome)} <span class="text-muted small">(${escapeHtml(e.matricula || '-')})</span></td>
      <td><input type="number" step="0.1" min="0" max="100" class="form-control form-control-sm lf-pct" value="${numStr(e.percentual_frequencia)}" placeholder="0 a 100"></td>
    </tr>
  `).join('');
}

function numStr(v) {
  return (v == null || v === '' || Number.isNaN(Number(v))) ? '' : String(v);
}

async function salvar() {
  const { turmaId, mes } = valoresSelecao();
  const rows = document.querySelectorAll('#lf-tbody tr[data-estudante]');
  const frequencias = [];
  rows.forEach(tr => {
    const estudante_id = Number(tr.dataset.estudante);
    const v = tr.querySelector('.lf-pct').value.trim();
    if (v === '') return;
    const pct = Number(v);
    if (pct < 0 || pct > 100) {
      showToast('Percentual deve estar entre 0 e 100.', 'error');
      return;
    }
    frequencias.push({ estudante_id, percentual_frequencia: pct });
  });

  if (!frequencias.length) {
    showToast('Informe ao menos um percentual para salvar.', 'error');
    return;
  }
  const btn = document.getElementById('lf-salvar');
  btn.disabled = true;
  const r = await lancarFrequencias(turmaId, mes, frequencias);
  btn.disabled = false;
  if (r.error) {
    showToast(`Erro: ${r.error}`, 'error');
    return;
  }
  registrarLog(LOG_ACTIONS.LANCAR_FREQUENCIA, { turma_id: turmaId, mes, quantidade: frequencias.length });
  showToast(`Frequência salva (${r.data?.atualizadas ?? frequencias.length} estudantes)!`, 'success');
  await carregarEstudantes();
}
