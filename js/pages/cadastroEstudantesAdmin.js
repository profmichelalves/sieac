import { showToast, escapeHtml } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { registrarLog, LOG_ACTIONS } from '../services/logService.js';
import { listarEstudantesCadastro, cadastrarEstudante, atualizarEstudante, excluirEstudante } from '../services/cadastroService.js';

let estudantes = [];
let filtroAtual = '';

const INFO = 'Registra os <strong>Estudantes</strong> (nome e matrícula). Estudantes com notas, frequências ou vínculos de NEE/AEE não podem ser excluídos.';

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Cadastro de Estudantes ${infoBtn('Estudantes', INFO)}</div>
    <div class="page-subtitle">Gerencie os estudantes do sistema</div>

    <div class="card-sieac">
      <div class="card-sieac-header">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <span>Estudantes</span>
          <div style="display:flex;gap:8px;align-items:flex-end;">
            <div class="filter-group">
              <label class="filter-label" for="estudante-busca">Buscar estudante</label>
              <input type="text" class="filter-input" id="estudante-busca"
                placeholder="Buscar estudante..." style="max-width:220px;">
            </div>
            <button class="btn btn-sm btn-primary" id="btn-novo-estudante">
              <i class="bi bi-plus-lg"></i> Novo Estudante
            </button>
          </div>
        </div>
      </div>
      <div class="card-sieac-body">
        <div class="table-responsive">
          <table class="table table-hover align-middle sieac-table" id="estudantes-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Matrícula</th>
                <th style="width:110px;">Ações</th>
              </tr>
            </thead>
            <tbody id="estudantes-tbody">
              <tr><td colspan="3" class="text-center text-muted py-4">
                <span class="spinner-border spinner-border-sm me-2"></span> Carregando estudantes...
              </td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="modal fade" id="modal-estudante" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="modal-estudante-titulo" style="font-weight:700;">Novo Estudante</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>
          <div class="modal-body">
            <div class="filter-group">
              <label class="filter-label" for="estudante-nome">Nome</label>
              <input type="text" class="filter-input" id="estudante-nome" placeholder="Ex.: João Pereira">
            </div>
            <div class="filter-group mt-3">
              <label class="filter-label" for="estudante-matricula">Matrícula</label>
              <input type="text" class="filter-input" id="estudante-matricula" placeholder="Ex.: 5678">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" style="border-radius:var(--sieac-radius-pill);">Cancelar</button>
            <button type="button" class="btn btn-primary" id="estudante-salvar" style="border-radius:var(--sieac-radius-pill);">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('estudante-busca').addEventListener('input', (e) => {
    filtroAtual = e.target.value.trim().toLowerCase();
    renderTabela();
  });

  document.getElementById('btn-novo-estudante').addEventListener('click', () => abrirModal());
  document.getElementById('estudante-salvar').addEventListener('click', salvarModal);

  await carregar();
}

export function unload() {}

async function carregar() {
  const { data } = await listarEstudantesCadastro();
  estudantes = data || [];
  renderTabela();
}

function renderTabela() {
  const tbody = document.getElementById('estudantes-tbody');
  if (!tbody) return;

  const filtradas = estudantes.filter(e => !filtroAtual || e.nome.toLowerCase().includes(filtroAtual));

  if (!filtradas.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4">
      ${estudantes.length ? 'Nenhum estudante encontrado com esse filtro.' : 'Nenhum estudante cadastrado ainda.'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtradas.map(e => `
    <tr data-id="${e.id}">
      <td class="fw-semibold">${escapeHtml(e.nome)}</td>
      <td>${escapeHtml(e.matricula || '-')}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary btn-editar-estudante" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-excluir-estudante" title="Excluir">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-editar-estudante').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('tr').dataset.id);
      abrirModal(estudantes.find(e => e.id === id));
    });
  });

  tbody.querySelectorAll('.btn-excluir-estudante').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('tr').dataset.id);
      excluir(estudantes.find(e => e.id === id));
    });
  });
}

function abrirModal(estudante = null) {
  const modalEl = document.getElementById('modal-estudante');
  document.getElementById('estudante-nome').value = estudante ? estudante.nome : '';
  document.getElementById('estudante-nome').dataset.id = estudante ? estudante.id : '';
  document.getElementById('estudante-matricula').value = estudante ? (estudante.matricula || '') : '';
  document.getElementById('modal-estudante-titulo').textContent = estudante ? 'Editar Estudante' : 'Novo Estudante';
  new bootstrap.Modal(modalEl).show();
}

async function salvarModal() {
  const nomeInput = document.getElementById('estudante-nome');
  const id = nomeInput.dataset.id ? Number(nomeInput.dataset.id) : null;
  const nome = nomeInput.value.trim();
  const matricula = document.getElementById('estudante-matricula').value.trim();
  const btn = document.getElementById('estudante-salvar');
  if (!nome) {
    showToast('Informe o nome do estudante.', 'error');
    return;
  }
  if (!matricula) {
    showToast('Informe a matrícula do estudante.', 'error');
    return;
  }
  btn.disabled = true;
  const r = id
    ? await atualizarEstudante(id, nome, matricula)
    : await cadastrarEstudante(nome, matricula);
  btn.disabled = false;
  if (r.error) {
    showToast(`Erro: ${r.error}`, 'error');
    return;
  }
  registrarLog(LOG_ACTIONS.CADASTRO_ENTIDADE, { entidade: 'estudantes', acao: id ? 'atualizar' : 'cadastrar', id: id || r.data?.id, nome, matricula });
  bootstrap.Modal.getInstance(document.getElementById('modal-estudante')).hide();
  showToast(id ? 'Estudante atualizado!' : 'Estudante cadastrado!', 'success');
  await carregar();
}

async function excluir(estudante) {
  if (!confirm(`Excluir o estudante "${estudante.nome}"?`)) return;
  const { error } = await excluirEstudante(estudante.id);
  if (error) {
    showToast(`Erro: ${error}`, 'error');
    return;
  }
  registrarLog(LOG_ACTIONS.CADASTRO_ENTIDADE, { entidade: 'estudantes', acao: 'excluir', id: estudante.id, nome: estudante.nome });
  showToast('Estudante excluído!', 'success');
  await carregar();
}
