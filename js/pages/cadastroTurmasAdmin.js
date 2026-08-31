import { showToast, escapeHtml } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { registrarLog, LOG_ACTIONS } from '../services/logService.js';
import { listarTurmas, listarSeries, cadastrarTurma, atualizarTurma, excluirTurma } from '../services/cadastroService.js';

let turmas = [];
let series = [];
let filtroAtual = '';

const INFO = 'Registra as <strong>Turmas</strong> e a vincula a uma <strong>Série</strong>, com indicação opcional de <strong>Turno</strong>. Turmas já referenciadas por alocações (professor/disciplina) ou frequências não podem ser excluídas.';
const SERIE_LABEL = Object.create(null);

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Cadastro de Turmas ${infoBtn('Turmas', INFO)}</div>
    <div class="page-subtitle">Gerencie as turmas, a série a que pertencem e o turno</div>

    <div class="card-sieac">
      <div class="card-sieac-header">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <span>Turmas</span>
          <div style="display:flex;gap:8px;align-items:flex-end;">
            <div class="filter-group">
              <label class="filter-label" for="turma-busca">Buscar turma</label>
              <input type="text" class="filter-input" id="turma-busca"
                placeholder="Buscar turma..." style="max-width:220px;">
            </div>
            <button class="btn btn-sm btn-primary" id="btn-nova-turma">
              <i class="bi bi-plus-lg"></i> Nova Turma
            </button>
          </div>
        </div>
      </div>
      <div class="card-sieac-body">
        <div class="table-responsive">
          <table class="table table-hover align-middle sieac-table" id="turmas-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Série</th>
                <th>Turno</th>
                <th style="width:110px;">Ações</th>
              </tr>
            </thead>
            <tbody id="turmas-tbody">
              <tr><td colspan="4" class="text-center text-muted py-4">
                <span class="spinner-border spinner-border-sm me-2"></span> Carregando turmas...
              </td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="modal fade" id="modal-turma" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="modal-turma-titulo" style="font-weight:700;">Nova Turma</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>
          <div class="modal-body">
            <div class="filter-group">
              <label class="filter-label" for="turma-nome">Nome da turma</label>
              <input type="text" class="filter-input" id="turma-nome" placeholder="Ex.: 1º Ano A">
            </div>
            <div class="filter-group mt-3">
              <label class="filter-label" for="turma-serie">Série</label>
              <select class="filter-select" id="turma-serie"></select>
            </div>
            <div class="filter-group mt-3">
              <label class="filter-label" for="turma-turno">Turno (opcional)</label>
              <select class="filter-select" id="turma-turno">
                <option value="">Selecione...</option>
                <option value="Manhã">Manhã</option>
                <option value="Tarde">Tarde</option>
                <option value="Noite">Noite</option>
                <option value="Integral">Integral</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" style="border-radius:var(--sieac-radius-pill);">Cancelar</button>
            <button type="button" class="btn btn-primary" id="turma-salvar" style="border-radius:var(--sieac-radius-pill);">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('turma-busca').addEventListener('input', (e) => {
    filtroAtual = e.target.value.trim().toLowerCase();
    renderTabela();
  });

  document.getElementById('btn-nova-turma').addEventListener('click', abrirModal);
  document.getElementById('turma-salvar').addEventListener('click', salvarModal);

  await carregar();
}

export function unload() {}

async function carregar() {
  const [t, s] = await Promise.all([listarTurmas(), listarSeries()]);
  turmas = t.data || [];
  series = s.data || [];
  series.forEach(se => { SERIE_LABEL[se.id] = se.nome; });
  popularSelectSeries();
  renderTabela();
}

function popularSelectSeries() {
  const sel = document.getElementById('turma-serie');
  if (!sel) return;
  sel.innerHTML = series.map(se => `<option value="${se.id}">${escapeHtml(se.nome)}</option>`).join('') || '<option value="">Nenhuma série cadastrada</option>';
}

function renderTabela() {
  const tbody = document.getElementById('turmas-tbody');
  if (!tbody) return;

  const filtradas = turmas.filter(t => !filtroAtual || t.nome.toLowerCase().includes(filtroAtual));

  if (!filtradas.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">
      ${turmas.length ? 'Nenhuma turma encontrada com esse filtro.' : 'Nenhuma turma cadastrada ainda.'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtradas.map(t => `
    <tr data-id="${t.id}">
      <td class="fw-semibold">${escapeHtml(t.nome)}</td>
      <td>${escapeHtml(SERIE_LABEL[t.serie_id] || '-')}</td>
      <td>${escapeHtml(t.turno || '-')}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary btn-editar-turma" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-excluir-turma" title="Excluir">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-editar-turma').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('tr').dataset.id);
      abrirModal(turmas.find(t => t.id === id));
    });
  });

  tbody.querySelectorAll('.btn-excluir-turma').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('tr').dataset.id);
      excluir(turmas.find(t => t.id === id));
    });
  });
}

function abrirModal(turma = null) {
  const modalEl = document.getElementById('modal-turma');
  document.getElementById('turma-nome').value = turma ? turma.nome : '';
  document.getElementById('turma-nome').dataset.id = turma ? turma.id : '';
  document.getElementById('turma-serie').value = turma ? turma.serie_id : (series[0]?.id || '');
  document.getElementById('turma-turno').value = turma ? (turma.turno || '') : '';
  document.getElementById('modal-turma-titulo').textContent = turma ? 'Editar Turma' : 'Nova Turma';
  new bootstrap.Modal(modalEl).show();
}

async function salvarModal() {
  const nomeInput = document.getElementById('turma-nome');
  const id = nomeInput.dataset.id ? Number(nomeInput.dataset.id) : null;
  const nome = nomeInput.value.trim();
  const serieId = Number(document.getElementById('turma-serie').value);
  const turno = document.getElementById('turma-turno').value;
  const btn = document.getElementById('turma-salvar');
  if (!nome) {
    showToast('Informe o nome da turma.', 'error');
    return;
  }
  if (!serieId) {
    showToast('Cadastre ao menos uma série.', 'error');
    return;
  }
  btn.disabled = true;
  const r = id
    ? await atualizarTurma(id, nome, serieId, turno)
    : await cadastrarTurma(nome, serieId, turno);
  btn.disabled = false;
  if (r.error) {
    showToast(`Erro: ${r.error}`, 'error');
    return;
  }
  registrarLog(LOG_ACTIONS.CADASTRO_ENTIDADE, { entidade: 'turmas', acao: id ? 'atualizar' : 'cadastrar', id: id || r.data?.id, nome, serie_id: serieId, turno });
  bootstrap.Modal.getInstance(document.getElementById('modal-turma')).hide();
  showToast(id ? 'Turma atualizada!' : 'Turma cadastrada!', 'success');
  await carregar();
}

async function excluir(turma) {
  if (!confirm(`Excluir a turma "${turma.nome}"?`)) return;
  const { error } = await excluirTurma(turma.id);
  if (error) {
    showToast(`Erro: ${error}`, 'error');
    return;
  }
  registrarLog(LOG_ACTIONS.CADASTRO_ENTIDADE, { entidade: 'turmas', acao: 'excluir', id: turma.id, nome: turma.nome });
  showToast('Turma excluída!', 'success');
  await carregar();
}
