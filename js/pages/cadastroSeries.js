import { showToast, escapeHtml } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { registrarLog, LOG_ACTIONS } from '../services/logService.js';
import { listarSeries, listarEtapasEnsino, cadastrarSerie, atualizarSerie, excluirSerie } from '../services/cadastroService.js';

let series = [];
let etapas = [];
let filtroAtual = '';

const INFO = 'Registra as <strong>Séries</strong> (Ex.: 1º Ano, 2º Ano) e as vincula a uma <strong>Etapa de Ensino</strong>. Séries já referenciadas por turmas não podem ser excluídas.';
const ETAPA_LABEL = Object.create(null);

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Cadastro de Séries ${infoBtn('Séries', INFO)}</div>
    <div class="page-subtitle">Gerencie as séries e a etapa de ensino de cada uma</div>

    <div class="card-sieac">
      <div class="card-sieac-header">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <span>Séries</span>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" class="form-control form-control-sm" id="serie-busca"
              placeholder="Buscar série..." style="max-width:220px;">
            <button class="btn btn-sm btn-primary" id="btn-nova-serie">
              <i class="bi bi-plus-lg"></i> Nova Série
            </button>
          </div>
        </div>
      </div>
      <div class="card-sieac-body">
        <div class="table-responsive">
          <table class="table table-hover align-middle sieac-table" id="series-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Etapa de Ensino</th>
                <th style="width:110px;">Ações</th>
              </tr>
            </thead>
            <tbody id="series-tbody">
              <tr><td colspan="3" class="text-center text-muted py-4">
                <span class="spinner-border spinner-border-sm me-2"></span> Carregando séries...
              </td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="modal fade" id="modal-serie" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="modal-serie-titulo" style="font-weight:700;">Nova Série</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>
          <div class="modal-body">
            <label class="form-label" for="serie-nome">Nome da série</label>
            <input type="text" class="form-control" id="serie-nome" placeholder="Ex.: 1º Ano">
            <label class="form-label mt-3" for="serie-etapa">Etapa de ensino</label>
            <select class="form-select" id="serie-etapa"></select>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" style="border-radius:var(--sieac-radius-pill);">Cancelar</button>
            <button type="button" class="btn btn-primary" id="serie-salvar" style="border-radius:var(--sieac-radius-pill);">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('serie-busca').addEventListener('input', (e) => {
    filtroAtual = e.target.value.trim().toLowerCase();
    renderTabela();
  });

  document.getElementById('btn-nova-serie').addEventListener('click', abrirModal);
  document.getElementById('serie-salvar').addEventListener('click', salvarModal);

  await carregar();
}

export function unload() {}

async function carregar() {
  const [s, e] = await Promise.all([listarSeries(), listarEtapasEnsino()]);
  series = s.data || [];
  etapas = e.data || [];
  etapas.forEach(et => { ETAPA_LABEL[et.id] = et.nome; });
  popularSelectEtapas();
  renderTabela();
}

function popularSelectEtapas() {
  const sel = document.getElementById('serie-etapa');
  if (!sel) return;
  sel.innerHTML = etapas.map(et => `<option value="${et.id}">${escapeHtml(et.nome)}</option>`).join('') || '<option value="">Nenhuma etapa cadastrada</option>';
}

function renderTabela() {
  const tbody = document.getElementById('series-tbody');
  if (!tbody) return;

  const filtradas = series.filter(s => !filtroAtual || s.nome.toLowerCase().includes(filtroAtual));

  if (!filtradas.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4">
      ${series.length ? 'Nenhuma série encontrada com esse filtro.' : 'Nenhuma série cadastrada ainda.'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtradas.map(s => `
    <tr data-id="${s.id}">
      <td class="fw-semibold">${escapeHtml(s.nome)}</td>
      <td>${escapeHtml(ETAPA_LABEL[s.etapa_ensino_id] || '-')}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary btn-editar-serie" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-excluir-serie" title="Excluir">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-editar-serie').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('tr').dataset.id);
      abrirModal(series.find(s => s.id === id));
    });
  });

  tbody.querySelectorAll('.btn-excluir-serie').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('tr').dataset.id);
      excluir(series.find(s => s.id === id));
    });
  });
}

function abrirModal(serie = null) {
  const modalEl = document.getElementById('modal-serie');
  document.getElementById('serie-nome').value = serie ? serie.nome : '';
  document.getElementById('serie-nome').dataset.id = serie ? serie.id : '';
  document.getElementById('serie-etapa').value = serie ? serie.etapa_ensino_id : (etapas[0]?.id || '');
  document.getElementById('modal-serie-titulo').textContent = serie ? 'Editar Série' : 'Nova Série';
  new bootstrap.Modal(modalEl).show();
}

async function salvarModal() {
  const nomeInput = document.getElementById('serie-nome');
  const id = nomeInput.dataset.id ? Number(nomeInput.dataset.id) : null;
  const nome = nomeInput.value.trim();
  const etapaId = Number(document.getElementById('serie-etapa').value);
  const btn = document.getElementById('serie-salvar');
  if (!nome) {
    showToast('Informe o nome da série.', 'error');
    return;
  }
  if (!etapaId) {
    showToast('Cadastre ao menos uma etapa de ensino.', 'error');
    return;
  }
  btn.disabled = true;
  const r = id
    ? await atualizarSerie(id, nome, etapaId)
    : await cadastrarSerie(nome, etapaId);
  btn.disabled = false;
  if (r.error) {
    showToast(`Erro: ${r.error}`, 'error');
    return;
  }
  registrarLog(LOG_ACTIONS.CADASTRO_ENTIDADE, { entidade: 'series', acao: id ? 'atualizar' : 'cadastrar', id: id || r.data?.id, nome, etapa_ensino_id: etapaId });
  bootstrap.Modal.getInstance(document.getElementById('modal-serie')).hide();
  showToast(id ? 'Série atualizada!' : 'Série cadastrada!', 'success');
  await carregar();
}

async function excluir(serie) {
  if (!confirm(`Excluir a série "${serie.nome}"?`)) return;
  const { error } = await excluirSerie(serie.id);
  if (error) {
    showToast(`Erro: ${error}`, 'error');
    return;
  }
  registrarLog(LOG_ACTIONS.CADASTRO_ENTIDADE, { entidade: 'series', acao: 'excluir', id: serie.id, nome: serie.nome });
  showToast('Série excluída!', 'success');
  await carregar();
}
