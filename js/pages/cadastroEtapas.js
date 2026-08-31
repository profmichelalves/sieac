import { showToast, escapeHtml } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { registrarLog, LOG_ACTIONS } from '../services/logService.js';
import { listarEtapasEnsino, cadastrarEtapaEnsino, atualizarEtapaEnsino, excluirEtapaEnsino } from '../services/cadastroService.js';

let etapas = [];
let filtroAtual = '';

const INFO = 'Registra as <strong>Etapas de Ensino</strong> (por exemplo, Educação Infantil, Ensino Fundamental, Ensino Médio). Cada etapa agrupa um conjunto de séries. Registros já referenciados por séries não podem ser excluídos.';

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Cadastro de Etapas de Ensino ${infoBtn('Etapas de Ensino', INFO)}</div>
    <div class="page-subtitle">Gerencie as etapas de ensino utilizadas no sistema</div>

    <div class="card-sieac">
      <div class="card-sieac-header">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <span>Etapas de Ensino</span>
          <div style="display:flex;gap:8px;align-items:flex-end;">
            <div class="filter-group">
              <label class="filter-label" for="etapa-busca">Buscar etapa</label>
              <input type="text" class="filter-input" id="etapa-busca"
                placeholder="Buscar etapa..." style="max-width:220px;">
            </div>
            <button class="btn btn-sm btn-primary" id="btn-nova-etapa">
              <i class="bi bi-plus-lg"></i> Nova Etapa
            </button>
          </div>
        </div>
      </div>
      <div class="card-sieac-body">
        <div class="table-responsive">
          <table class="table table-hover align-middle sieac-table" id="etapas-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th style="width:110px;">Ações</th>
              </tr>
            </thead>
            <tbody id="etapas-tbody">
              <tr><td colspan="2" class="text-center text-muted py-4">
                <span class="spinner-border spinner-border-sm me-2"></span> Carregando etapas...
              </td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="modal fade" id="modal-etapa" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="modal-etapa-titulo" style="font-weight:700;">Nova Etapa de Ensino</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>
          <div class="modal-body">
            <div class="filter-group">
              <label class="filter-label" for="etapa-nome">Nome da etapa</label>
              <input type="text" class="filter-input" id="etapa-nome" placeholder="Ex.: Ensino Médio">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" style="border-radius:var(--sieac-radius-pill);">Cancelar</button>
            <button type="button" class="btn btn-primary" id="etapa-salvar" style="border-radius:var(--sieac-radius-pill);">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('etapa-busca').addEventListener('input', (e) => {
    filtroAtual = e.target.value.trim().toLowerCase();
    renderTabela();
  });

  document.getElementById('btn-nova-etapa').addEventListener('click', () => abrirModal());
  document.getElementById('etapa-salvar').addEventListener('click', salvarModal);

  await carregar();
}

export function unload() {}

async function carregar() {
  const { data } = await listarEtapasEnsino();
  etapas = data || [];
  renderTabela();
}

function renderTabela() {
  const tbody = document.getElementById('etapas-tbody');
  if (!tbody) return;

  const filtradas = etapas.filter(e => !filtroAtual || e.nome.toLowerCase().includes(filtroAtual));

  if (!filtradas.length) {
    tbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted py-4">
      ${etapas.length ? 'Nenhuma etapa encontrada com esse filtro.' : 'Nenhuma etapa cadastrada ainda.'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtradas.map(e => `
    <tr data-id="${e.id}">
      <td class="fw-semibold">${escapeHtml(e.nome)}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary btn-editar-etapa" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-excluir-etapa" title="Excluir">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-editar-etapa').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('tr').dataset.id);
      abrirModal(etapas.find(e => e.id === id));
    });
  });

  tbody.querySelectorAll('.btn-excluir-etapa').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('tr').dataset.id);
      excluir(etapas.find(e => e.id === id));
    });
  });
}

function abrirModal(etapa = null) {
  const modalEl = document.getElementById('modal-etapa');
  const nomeInput = document.getElementById('etapa-nome');
  const titulo = document.getElementById('modal-etapa-titulo');
  nomeInput.value = etapa ? etapa.nome : '';
  nomeInput.dataset.id = etapa ? etapa.id : '';
  titulo.textContent = etapa ? 'Editar Etapa de Ensino' : 'Nova Etapa de Ensino';
  new bootstrap.Modal(modalEl).show();
}

async function salvarModal() {
  const nomeInput = document.getElementById('etapa-nome');
  const id = nomeInput.dataset.id ? Number(nomeInput.dataset.id) : null;
  const nome = nomeInput.value.trim();
  const btn = document.getElementById('etapa-salvar');
  if (!nome) {
    showToast('Informe o nome da etapa.', 'error');
    return;
  }
  btn.disabled = true;
  const r = id
    ? await atualizarEtapaEnsino(id, nome)
    : await cadastrarEtapaEnsino(nome);
  btn.disabled = false;
  if (r.error) {
    showToast(`Erro: ${r.error}`, 'error');
    return;
  }
  registrarLog(LOG_ACTIONS.CADASTRO_ENTIDADE, { entidade: 'etapas_ensino', acao: id ? 'atualizar' : 'cadastrar', id: id || r.data?.id, nome });
  bootstrap.Modal.getInstance(document.getElementById('modal-etapa')).hide();
  showToast(id ? 'Etapa atualizada!' : 'Etapa cadastrada!', 'success');
  await carregar();
}

async function excluir(etapa) {
  if (!confirm(`Excluir a etapa "${etapa.nome}"?`)) return;
  const { error } = await excluirEtapaEnsino(etapa.id);
  if (error) {
    showToast(`Erro: ${error}`, 'error');
    return;
  }
  registrarLog(LOG_ACTIONS.CADASTRO_ENTIDADE, { entidade: 'etapas_ensino', acao: 'excluir', id: etapa.id, nome: etapa.nome });
  showToast('Etapa excluída!', 'success');
  await carregar();
}
