import { showToast, escapeHtml } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { registrarLog, LOG_ACTIONS } from '../services/logService.js';
import { listarProfessoresCadastro, cadastrarProfessor, atualizarProfessor, excluirProfessor } from '../services/cadastroService.js';

let professores = [];
let filtroAtual = '';

const INFO = 'Registra os <strong>Professores</strong> (nome e matrícula). Professores já vinculados a alocações (turma/disciplina) ou que são conselheiros de uma turma não podem ser excluídos.';

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Cadastro de Professores ${infoBtn('Professores', INFO)}</div>
    <div class="page-subtitle">Gerencie os professores do sistema</div>

    <div class="card-sieac">
      <div class="card-sieac-header">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <span>Professores</span>
          <div style="display:flex;gap:8px;align-items:flex-end;">
            <div class="filter-group">
              <label class="filter-label" for="professor-busca">Buscar professor</label>
              <input type="text" class="filter-input" id="professor-busca"
                placeholder="Buscar professor..." style="max-width:220px;">
            </div>
            <button class="btn btn-sm btn-primary" id="btn-novo-professor">
              <i class="bi bi-plus-lg"></i> Novo Professor
            </button>
          </div>
        </div>
      </div>
      <div class="card-sieac-body">
        <div class="table-responsive">
          <table class="table table-hover align-middle sieac-table" id="professores-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Matrícula</th>
                <th style="width:110px;">Ações</th>
              </tr>
            </thead>
            <tbody id="professores-tbody">
              <tr><td colspan="3" class="text-center text-muted py-4">
                <span class="spinner-border spinner-border-sm me-2"></span> Carregando professores...
              </td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="modal fade" id="modal-professor" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="modal-professor-titulo" style="font-weight:700;">Novo Professor</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>
          <div class="modal-body">
            <div class="filter-group">
              <label class="filter-label" for="professor-nome">Nome</label>
              <input type="text" class="filter-input" id="professor-nome" placeholder="Ex.: Maria da Silva">
            </div>
            <div class="filter-group mt-3">
              <label class="filter-label" for="professor-matricula">Matrícula</label>
              <input type="text" class="filter-input" id="professor-matricula" placeholder="Ex.: 1234">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" style="border-radius:var(--sieac-radius-pill);">Cancelar</button>
            <button type="button" class="btn btn-primary" id="professor-salvar" style="border-radius:var(--sieac-radius-pill);">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('professor-busca').addEventListener('input', (e) => {
    filtroAtual = e.target.value.trim().toLowerCase();
    renderTabela();
  });

  document.getElementById('btn-novo-professor').addEventListener('click', () => abrirModal());
  document.getElementById('professor-salvar').addEventListener('click', salvarModal);

  await carregar();
}

export function unload() {}

async function carregar() {
  const { data } = await listarProfessoresCadastro();
  professores = data || [];
  renderTabela();
}

function renderTabela() {
  const tbody = document.getElementById('professores-tbody');
  if (!tbody) return;

  const filtradas = professores.filter(p => !filtroAtual || p.nome.toLowerCase().includes(filtroAtual));

  if (!filtradas.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4">
      ${professores.length ? 'Nenhum professor encontrado com esse filtro.' : 'Nenhum professor cadastrado ainda.'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtradas.map(p => `
    <tr data-id="${p.id}">
      <td class="fw-semibold">${escapeHtml(p.nome)}</td>
      <td>${escapeHtml(p.matricula || '-')}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary btn-editar-professor" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-excluir-professor" title="Excluir">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-editar-professor').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('tr').dataset.id);
      abrirModal(professores.find(p => p.id === id));
    });
  });

  tbody.querySelectorAll('.btn-excluir-professor').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('tr').dataset.id);
      excluir(professores.find(p => p.id === id));
    });
  });
}

function abrirModal(professor = null) {
  const modalEl = document.getElementById('modal-professor');
  document.getElementById('professor-nome').value = professor ? professor.nome : '';
  document.getElementById('professor-nome').dataset.id = professor ? professor.id : '';
  document.getElementById('professor-matricula').value = professor ? (professor.matricula || '') : '';
  document.getElementById('modal-professor-titulo').textContent = professor ? 'Editar Professor' : 'Novo Professor';
  new bootstrap.Modal(modalEl).show();
}

async function salvarModal() {
  const nomeInput = document.getElementById('professor-nome');
  const id = nomeInput.dataset.id ? Number(nomeInput.dataset.id) : null;
  const nome = nomeInput.value.trim();
  const matricula = document.getElementById('professor-matricula').value.trim();
  const btn = document.getElementById('professor-salvar');
  if (!nome) {
    showToast('Informe o nome do professor.', 'error');
    return;
  }
  if (!matricula) {
    showToast('Informe a matrícula do professor.', 'error');
    return;
  }
  btn.disabled = true;
  const r = id
    ? await atualizarProfessor(id, nome, matricula)
    : await cadastrarProfessor(nome, matricula);
  btn.disabled = false;
  if (r.error) {
    showToast(`Erro: ${r.error}`, 'error');
    return;
  }
  registrarLog(LOG_ACTIONS.CADASTRO_ENTIDADE, { entidade: 'professores', acao: id ? 'atualizar' : 'cadastrar', id: id || r.data?.id, nome, matricula });
  bootstrap.Modal.getInstance(document.getElementById('modal-professor')).hide();
  showToast(id ? 'Professor atualizado!' : 'Professor cadastrado!', 'success');
  await carregar();
}

async function excluir(professor) {
  if (!confirm(`Excluir o professor "${professor.nome}"?`)) return;
  const { error } = await excluirProfessor(professor.id);
  if (error) {
    showToast(`Erro: ${error}`, 'error');
    return;
  }
  registrarLog(LOG_ACTIONS.CADASTRO_ENTIDADE, { entidade: 'professores', acao: 'excluir', id: professor.id, nome: professor.nome });
  showToast('Professor excluído!', 'success');
  await carregar();
}
