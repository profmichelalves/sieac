import { showToast } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { listarTurmasComConselheiro, listarProfessores, salvarConselheiro } from '../services/turmaService.js';
import { createSearchSelect } from '../components/SearchSelect.js';
import { clearProfessorCache } from '../services/authService.js';

let turmas = [];
let professores = [];
let buscaAtual = '';
const combos = new Map();

const INFO = 'Define qual docente é o <strong>Professor Conselheiro</strong> de cada turma — o professor responsável por articular os dados de aproveitamento e comportamento da turma para o Conselho de Classe. O conselheiro pode visualizar no sistema as informações de todas as disciplinas da sua turma.';

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Cadastro de Turmas ${infoBtn('Cadastro de Turmas', INFO)}</div>
    <div class="page-subtitle">Vincule o Professor Conselheiro responsável por cada turma</div>

    <div class="card-sieac">
      <div class="card-sieac-header">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <span>Turmas</span>
          <input type="text" class="form-control form-control-sm" id="turma-busca"
            placeholder="Buscar turma..." style="max-width:260px;">
        </div>
      </div>
      <div class="card-sieac-body">
        <div class="table-responsive">
          <table class="table table-hover align-middle sieac-table" id="turmas-table">
            <thead>
              <tr>
                <th>Turma</th>
                <th>Série</th>
                <th>Turno</th>
                <th style="min-width:260px;">Professor Conselheiro</th>
                <th style="width:110px;">Ações</th>
              </tr>
            </thead>
            <tbody id="turmas-tbody">
              <tr><td colspan="5" class="text-center text-muted py-4">
                <span class="spinner-border spinner-border-sm me-2"></span> Carregando turmas...
              </td></tr>
            </tbody>
          </table>
        </div>
        <div class="mt-3" style="font-size:0.78rem;color:var(--sieac-text-muted);">
          <i class="bi bi-info-circle"></i> A vinculação usa os identificadores externos das turmas e professores, portanto permanece mesmo após novas importações de dados.
        </div>
      </div>
    </div>
  `;

  const busca = document.getElementById('turma-busca');
  busca.addEventListener('input', () => {
    buscaAtual = busca.value.trim().toLowerCase();
    renderTabela(buscaAtual);
  });

  await carregarDados();
}

async function carregarDados() {
  const [t, p] = await Promise.all([listarTurmasComConselheiro(), listarProfessores()]);
  turmas = t;
  professores = p.data || [];
  renderTabela(buscaAtual);
}

function renderTabela(filtro = '') {
  const tbody = document.getElementById('turmas-tbody');
  if (!tbody) return;

  combos.forEach(c => c.destroy());
  combos.clear();

  const filtradas = turmas.filter(t => !filtro || t.nome.toLowerCase().includes(filtro));

  if (!filtradas.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">
      ${turmas.length ? 'Nenhuma turma encontrada com esse filtro.' : 'Nenhuma turma cadastrada ainda.'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtradas.map((t, i) => `
    <tr data-id-turma="${t.id_turma}" data-index="${i}">
      <td class="fw-semibold">${t.nome}</td>
      <td>${t.serie || '-'}</td>
      <td>${t.turno || '-'}</td>
      <td><div class="turma-conselheiro" data-slot="${i}"></div></td>
      <td>
        <button class="btn btn-sm btn-primary btn-salvar-conselheiro">
          <i class="bi bi-check-lg"></i> Salvar
        </button>
      </td>
    </tr>
  `).join('');

  filtradas.forEach((t, i) => {
    const slot = tbody.querySelector(`[data-slot="${i}"]`);
    const combo = createSearchSelect({
      items: professores,
      getText: p => p.nome,
      getValue: p => p.id_pessoa,
      placeholder: 'Selecionar professor conselheiro...',
      onSelect: () => {},
    });
    if (t.id_pessoa) combo.setValue(t.id_pessoa);
    combos.set(i, combo);
    slot.appendChild(combo.el);
  });

  tbody.querySelectorAll('.btn-salvar-conselheiro').forEach(btn => {
    btn.addEventListener('click', () => {
      const tr = btn.closest('tr');
      salvarLinha(Number(tr.dataset.idTurma), tr);
    });
  });
}

async function salvarLinha(idTurma, tr) {
  const index = Number(tr.dataset.index);
  const combo = combos.get(index);
  if (!combo) return;

  const idPessoa = combo.getValue();
  const btn = tr.querySelector('.btn-salvar-conselheiro');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

  const { error } = await salvarConselheiro(idTurma, idPessoa);
  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-check-lg"></i> Salvar';

  if (error) {
    showToast(`Erro ao salvar vínculo: ${error}`, 'error');
    return;
  }

  const nomeProf = combo.getText();
  showToast(
    idPessoa
      ? `Professor Conselheiro da turma atualizado: ${nomeProf}`
      : 'Vínculo de Professor Conselheiro removido.',
    'success'
  );

  clearProfessorCache();
  await carregarDados();
}
