import { showToast, escapeHtml } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { registrarLog, LOG_ACTIONS } from '../services/logService.js';
import { listarComponentesCurriculares, cadastrarComponenteCurricular, atualizarComponenteCurricular, excluirComponenteCurricular } from '../services/cadastroService.js';

let disciplinas = [];
let filtroAtual = '';

const INFO = 'Registra as <strong>Disciplinas</strong> (componentes curriculares), como Matemática, Português, Ciências etc. Disciplinas já vinculadas a alocações (professor/turma) não podem ser excluídas.';

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Cadastro de Disciplinas ${infoBtn('Disciplinas', INFO)}</div>
    <div class="page-subtitle">Gerencie as disciplinas/componentes curriculares do sistema</div>

    <div class="card-sieac">
      <div class="card-sieac-header">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <span>Disciplinas</span>
          <div style="display:flex;gap:8px;align-items:flex-end;">
            <div class="filter-group">
              <label class="filter-label" for="disciplina-busca">Buscar disciplina</label>
              <input type="text" class="filter-input" id="disciplina-busca"
                placeholder="Buscar disciplina..." style="max-width:220px;">
            </div>
            <button class="btn btn-sm btn-primary" id="btn-nova-disciplina">
              <i class="bi bi-plus-lg"></i> Nova Disciplina
            </button>
          </div>
        </div>
      </div>
      <div class="card-sieac-body">
        <div class="table-responsive">
          <table class="table table-hover align-middle sieac-table" id="disciplinas-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th style="width:110px;">Ações</th>
              </tr>
            </thead>
            <tbody id="disciplinas-tbody">
              <tr><td colspan="2" class="text-center text-muted py-4">
                <span class="spinner-border spinner-border-sm me-2"></span> Carregando disciplinas...
              </td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="modal fade" id="modal-disciplina" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="modal-disciplina-titulo" style="font-weight:700;">Nova Disciplina</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>
          <div class="modal-body">
            <div class="filter-group">
              <label class="filter-label" for="disciplina-nome">Nome da disciplina</label>
              <input type="text" class="filter-input" id="disciplina-nome" placeholder="Ex.: Matemática">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" style="border-radius:var(--sieac-radius-pill);">Cancelar</button>
            <button type="button" class="btn btn-primary" id="disciplina-salvar" style="border-radius:var(--sieac-radius-pill);">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('disciplina-busca').addEventListener('input', (e) => {
    filtroAtual = e.target.value.trim().toLowerCase();
    renderTabela();
  });

  document.getElementById('btn-nova-disciplina').addEventListener('click', () => abrirModal());
  document.getElementById('disciplina-salvar').addEventListener('click', salvarModal);

  await carregar();
}

export function unload() {}

async function carregar() {
  const { data } = await listarComponentesCurriculares();
  disciplinas = data || [];
  renderTabela();
}

function renderTabela() {
  const tbody = document.getElementById('disciplinas-tbody');
  if (!tbody) return;

  const filtradas = disciplinas.filter(d => !filtroAtual || d.nome.toLowerCase().includes(filtroAtual));

  if (!filtradas.length) {
    tbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted py-4">
      ${disciplinas.length ? 'Nenhuma disciplina encontrada com esse filtro.' : 'Nenhuma disciplina cadastrada ainda.'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtradas.map(d => `
    <tr data-id="${d.id}">
      <td class="fw-semibold">${escapeHtml(d.nome)}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary btn-editar-disciplina" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-excluir-disciplina" title="Excluir">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-editar-disciplina').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('tr').dataset.id);
      abrirModal(disciplinas.find(d => d.id === id));
    });
  });

  tbody.querySelectorAll('.btn-excluir-disciplina').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('tr').dataset.id);
      excluir(disciplinas.find(d => d.id === id));
    });
  });
}

function abrirModal(disciplina = null) {
  const modalEl = document.getElementById('modal-disciplina');
  document.getElementById('disciplina-nome').value = disciplina ? disciplina.nome : '';
  document.getElementById('disciplina-nome').dataset.id = disciplina ? disciplina.id : '';
  document.getElementById('modal-disciplina-titulo').textContent = disciplina ? 'Editar Disciplina' : 'Nova Disciplina';
  new bootstrap.Modal(modalEl).show();
}

async function salvarModal() {
  const nomeInput = document.getElementById('disciplina-nome');
  const id = nomeInput.dataset.id ? Number(nomeInput.dataset.id) : null;
  const nome = nomeInput.value.trim();
  const btn = document.getElementById('disciplina-salvar');
  if (!nome) {
    showToast('Informe o nome da disciplina.', 'error');
    return;
  }
  btn.disabled = true;
  const r = id
    ? await atualizarComponenteCurricular(id, nome)
    : await cadastrarComponenteCurricular(nome);
  btn.disabled = false;
  if (r.error) {
    showToast(`Erro: ${r.error}`, 'error');
    return;
  }
  registrarLog(LOG_ACTIONS.CADASTRO_ENTIDADE, { entidade: 'componentes_curriculares', acao: id ? 'atualizar' : 'cadastrar', id: id || r.data?.id, nome });
  bootstrap.Modal.getInstance(document.getElementById('modal-disciplina')).hide();
  showToast(id ? 'Disciplina atualizada!' : 'Disciplina cadastrada!', 'success');
  await carregar();
}

async function excluir(disciplina) {
  if (!confirm(`Excluir a disciplina "${disciplina.nome}"?`)) return;
  const { error } = await excluirComponenteCurricular(disciplina.id);
  if (error) {
    showToast(`Erro: ${error}`, 'error');
    return;
  }
  registrarLog(LOG_ACTIONS.CADASTRO_ENTIDADE, { entidade: 'componentes_curriculares', acao: 'excluir', id: disciplina.id, nome: disciplina.nome });
  showToast('Disciplina excluída!', 'success');
  await carregar();
}
