import { $$, showToast, escapeHtml } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { createSearchSelect } from '../components/SearchSelect.js';
import { listarTiposNecessidades, listarProfessoresParaAEE, listarEstudantesCadastro, salvarNecessidadesEstudante } from '../repositories/necessidadesRepository.js';
import { registrarLog, LOG_ACTIONS } from '../services/logService.js';
import { supabaseQuery } from '../services/supabase.js';
import { loadEstudanteFiltros, saveEstudanteFiltros, clearEstudanteFiltros } from '../utils/estudanteFiltros.js';

let turmaCombo = null;
let professorCombo = null;
let nomeCombo = null;
let tipos = [];
let todosEstudantes = [];
let turmaNomeById = {};
let estado = { turmaId: '', estudanteId: null };
let estudanteEditando = null;
let professorAeeSelecionado = null;

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Cadastro de Estudantes</div>
    <div class="page-subtitle">Necessidades educacionais especiais (NEE) e professor de AEE por estudante</div>

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
            <div id="filtro-nome"></div>
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

    <div class="card-sieac">
      <div class="card-sieac-header">Estudantes ${infoBtn('Cadastro de Estudantes', 'Lista todos os estudantes. Selecione uma turma para restringir a lista. Use o botão Editar para informar ou alterar os tipos de necessidade e o professor de AEE que acompanha o estudante.')}</div>
      <div class="card-sieac-body">
        <div class="table-responsive-custom">
          <table class="table-sieac" id="table-cadastro-estudantes">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Matrícula</th>
                <th>Turma</th>
                <th>Necessidades</th>
                <th>Professor AEE</th>
                <th style="width:90px;">Ações</th>
              </tr>
            </thead>
            <tbody id="tbody-cadastro-estudantes">
              <tr><td colspan="6" style="text-align:center;color:var(--sieac-text-muted);">Carregando...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="mt-3" style="font-size:0.78rem;color:var(--sieac-text-muted);">
          <i class="bi bi-info-circle"></i> As necessidades usam o identificador externo do estudante e o professor de AEE é o próprio usuário cadastrado com o perfil 'Professor do AEE', portanto os vínculos permanecem mesmo após novas importações de dados.
        </div>
      </div>
    </div>

    <div class="modal fade" id="modal-editar-estudante" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-person-gear" style="margin-right:8px;"></i>Necessidades do Estudante</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>
          <div class="modal-body">
            <div class="student-info-grid" style="margin-bottom:18px;">
              <div class="student-info-item"><label>Nome</label><span id="modal-est-nome">—</span></div>
              <div class="student-info-item"><label>Matrícula</label><span id="modal-est-matricula">—</span></div>
              <div class="student-info-item"><label>Turma</label><span id="modal-est-turma">—</span></div>
            </div>
            <label class="filter-label" style="margin-bottom:8px;">Tipo(s) de Necessidade</label>
            <div class="row g-2" id="modal-tipos-container" style="margin-bottom:18px;"></div>
            <label class="filter-label" style="margin-bottom:8px;">Professor de AEE</label>
            <div class="d-flex gap-2 align-items-center">
              <div style="flex:1;" id="modal-professor-container"></div>
              <button class="btn btn-sm btn-outline-danger" id="btn-remover-professor" title="Remover professor de AEE" style="border-radius:var(--sieac-radius-pill);">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" style="border-radius:var(--sieac-radius-pill);">Cancelar</button>
            <button type="button" class="btn btn-primary" id="btn-salvar-necessidades" style="border-radius:var(--sieac-radius-pill);">
              <i class="bi bi-check-lg"></i> Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  await carregarReferencias();

  document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
    estado = { turmaId: '', estudanteId: null };
    clearEstudanteFiltros();
    turmaCombo.clear();
    if (nomeCombo) {
      nomeCombo.clear();
      nomeCombo.setItems(estudantesParaBusca());
    }
    renderTabela();
  });

  document.getElementById('btn-salvar-necessidades').addEventListener('click', salvarModal);
  document.getElementById('btn-remover-professor').addEventListener('click', () => {
    professorAeeSelecionado = null;
    if (professorCombo) professorCombo.clear();
  });
}

export function unload() {
  if (turmaCombo) { turmaCombo.destroy(); turmaCombo = null; }
  if (professorCombo) { professorCombo.destroy(); professorCombo = null; }
  if (nomeCombo) { nomeCombo.destroy(); nomeCombo = null; }
  tipos = [];
  todosEstudantes = [];
  turmaNomeById = {};
}

async function carregarReferencias() {
  const [{ data: tiposData }, { data: professoresData }, { data: turmasData }] = await Promise.all([
    listarTiposNecessidades(),
    listarProfessoresParaAEE(),
    supabaseQuery('turmas', { select: 'id,nome', order: 'nome', limit: 1000 }),
  ]);

  tipos = tiposData || [];
  (turmasData || []).forEach(t => { turmaNomeById[t.id] = t.nome; });

  const turmas = (turmasData || []).map(t => ({ id: t.id, nome: t.nome }));
  turmaCombo = createSearchSelect({
    items: turmas,
    getText: t => t.nome,
    getValue: t => t.id,
    placeholder: 'Selecione uma turma...',
    onSelect: id => {
      estado.turmaId = id;
      if (nomeCombo) {
        estado.estudanteId = null;
        nomeCombo.clear();
        nomeCombo.setItems(estudantesParaBusca());
      }
      saveEstudanteFiltros({ turmaId: id, estudanteId: null });
      renderTabela();
    },
  });
  document.getElementById('filtro-turma').appendChild(turmaCombo.el);

  professorCombo = createSearchSelect({
    items: (professoresData || []).map(p => ({ id: p.id, nome: p.nome, matricula: p.matricula })),
    getText: p => `${p.nome}${p.matricula ? ' — ' + p.matricula : ''}`,
    getValue: p => p.id,
    placeholder: 'Busque o professor de AEE...',
    onSelect: id => { professorAeeSelecionado = id; },
  });
  document.getElementById('modal-professor-container').appendChild(professorCombo.el);

  nomeCombo = createSearchSelect({
    items: [],
    getText: e => `${e.nome} — ${e.matricula}`,
    getValue: e => e.id,
    placeholder: 'Digite para filtrar por nome ou matrícula...',
    onSelect: id => {
      estado.estudanteId = Number(id);
      saveEstudanteFiltros({ turmaId: estado.turmaId, estudanteId: Number(id) });
      renderTabela();
    },
  });
  document.getElementById('filtro-nome').appendChild(nomeCombo.el);

  const res = await listarEstudantesCadastro({});
  todosEstudantes = res || [];
  nomeCombo.setItems(estudantesParaBusca());

  restaurarFiltros();
}

function restaurarFiltros() {
  const saved = loadEstudanteFiltros();
  if (saved && saved.turmaId && turmaNomeById[saved.turmaId]) {
    estado.turmaId = saved.turmaId;
    turmaCombo.setValue(String(saved.turmaId));
    if (nomeCombo) nomeCombo.setItems(estudantesParaBusca());
  }
  if (saved && saved.estudanteId && todosEstudantes.some(e => e.id === Number(saved.estudanteId))) {
    estado.estudanteId = Number(saved.estudanteId);
    if (nomeCombo) nomeCombo.setValue(String(saved.estudanteId));
  }
  renderTabela();
}

function estudantesParaBusca() {
  const turmaNome = estado.turmaId ? turmaNomeById[estado.turmaId] : null;
  return todosEstudantes
    .filter(e => !turmaNome || e.turmas.includes(turmaNome))
    .map(e => ({ id: e.id, nome: e.nome, matricula: e.matricula }));
}

function renderTabela() {
  const tbody = document.getElementById('tbody-cadastro-estudantes');
  if (!tbody) return;

  const turmaNome = estado.turmaId ? turmaNomeById[estado.turmaId] : null;

  const filtrados = todosEstudantes.filter(e => {
    if (turmaNome && !e.turmas.includes(turmaNome)) return false;
    if (estado.estudanteId != null && e.id !== estado.estudanteId) return false;
    return true;
  });

  const contagem = document.getElementById('contagem-estudantes');
  if (contagem) contagem.textContent = `${filtrados.length} estudante(s)`;

  if (!filtrados.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--sieac-text-muted);">Nenhum estudante encontrado</td></tr>';
    return;
  }

  tbody.innerHTML = filtrados.map(e => `
    <tr>
      <td><strong>${escapeHtml(e.nome)}</strong></td>
      <td>${escapeHtml(e.matricula)}</td>
      <td>${escapeHtml(e.turmas.join(', ') || '-')}</td>
      <td>${renderNecessidades(e.necessidades)}</td>
      <td>${e.professorAee ? escapeHtml(e.professorAee.nome) : '<span style="color:var(--sieac-text-muted);">Não informado</span>'}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary btn-editar-estudante" data-id="${e.id}" style="border-radius:var(--sieac-radius-pill);font-size:0.75rem;padding:4px 12px;">
          <i class="bi bi-pencil-square"></i> Editar
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-editar-estudante').forEach(btn => {
    btn.addEventListener('click', () => abrirModal(Number(btn.dataset.id)));
  });
}

function renderNecessidades(necessidades) {
  if (!necessidades || !necessidades.length) {
    return '<span style="color:var(--sieac-text-muted);">—</span>';
  }
  return necessidades.map(n => `<span class="badge badge-sieac-secondary" style="margin:2px 4px 2px 0;">${escapeHtml(n)}</span>`).join('');
}

async function abrirModal(estudanteId) {
  const estudante = todosEstudantes.find(e => e.id === estudanteId);
  if (!estudante) return;

  estudanteEditando = estudante;
  document.getElementById('modal-est-nome').textContent = estudante.nome;
  document.getElementById('modal-est-matricula').textContent = estudante.matricula;
  document.getElementById('modal-est-turma').textContent = estudante.turmas.join(', ') || '-';

  const selecionadas = new Set(estudante.necessidades.map(n =>
    tipos.find(t => t.nome === n)?.id
  ).filter(Boolean));

  const container = document.getElementById('modal-tipos-container');
  container.innerHTML = tipos.length
    ? tipos.map(t => `
        <div class="col-md-6">
          <div class="form-check">
            <input class="form-check-input tipo-check" type="checkbox" id="tipo-${t.id}" value="${t.id}" ${selecionadas.has(t.id) ? 'checked' : ''}>
            <label class="form-check-label" for="tipo-${t.id}">${escapeHtml(t.nome)}</label>
          </div>
        </div>
      `).join('')
    : '<div class="col-12" style="color:var(--sieac-text-muted);">Nenhum tipo de necessidade cadastrado.</div>';

  if (estudante.professorAee) {
    professorAeeSelecionado = String(estudante.professorAee.professor_usuario_id);
    const item = { id: String(estudante.professorAee.professor_usuario_id), nome: estudante.professorAee.nome, matricula: estudante.professorAee.matricula };
    const res = await listarProfessoresParaAEE();
    const prof = (res.data || []).find(p => String(p.id) === String(estudante.professorAee.professor_usuario_id));
    if (prof) {
      professorCombo.setItems((res.data || []).map(p => ({ id: p.id, nome: p.nome, matricula: p.matricula })));
      professorCombo.setValue(String(prof.id));
    } else if (item) {
      professorCombo.setItems([item]);
      professorCombo.setValue(item.id);
    }
  } else {
    professorAeeSelecionado = null;
    professorCombo.clear();
  }

  const modal = new bootstrap.Modal(document.getElementById('modal-editar-estudante'));
  modal.show();
}

async function salvarModal() {
  if (!estudanteEditando) return;

  const tipoIds = $$('.tipo-check:checked').map(cb => Number(cb.value));
  const btn = document.getElementById('btn-salvar-necessidades');
  btn.disabled = true;

  const antes = {
    necessidades: estudanteEditando.necessidades.join(', '),
    professorAee: estudanteEditando.professorAee ? estudanteEditando.professorAee.nome : 'não informado',
  };

  const { error } = await salvarNecessidadesEstudante(estudanteEditando.id_pessoa, tipoIds, professorAeeSelecionado);
  btn.disabled = false;

  if (error) {
    showToast('Erro ao salvar: ' + error, 'error');
    return;
  }

  const res = await listarEstudantesCadastro({});
  todosEstudantes = res || [];

  const novo = todosEstudantes.find(e => e.id === estudanteEditando.id);
  const depois = {
    necessidades: novo ? novo.necessidades.join(', ') : '',
    professorAee: novo && novo.professorAee ? novo.professorAee.nome : 'não informado',
  };
  registrarLog(LOG_ACTIONS.EDITAR_NECESSIDADES, {
    estudante_id: estudanteEditando.id,
    estudante_nome: estudanteEditando.nome,
    antes,
    depois,
  });

  renderTabela();
  const modal = bootstrap.Modal.getInstance(document.getElementById('modal-editar-estudante'));
  if (modal) modal.hide();
  showToast('Necessidades do estudante atualizadas!', 'success');
}
