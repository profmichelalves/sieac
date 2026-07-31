import { $, showToast } from '../utils/helpers.js';
import { supabaseQuery } from '../services/supabase.js';
import { isProfessor, getProfessorVinculo } from '../services/authService.js';

let currentFilters = {};
let onChangeCallback = null;
let professorVinculo = null;

async function getFilterData() {
  const userIsProfessor = isProfessor();
  if (userIsProfessor) {
    professorVinculo = await getProfessorVinculo();
  }

  const [series, turmas, componentes, professores, etapas] = await Promise.all([
    supabaseQuery('series', { select: 'id,nome,etapa_ensino_id', order: 'nome' }),
    supabaseQuery('turmas', { select: 'id,nome,serie_id,turno', order: 'nome' }),
    supabaseQuery('componentes_curriculares', { select: 'id,nome', order: 'nome' }),
    supabaseQuery('professores', { select: 'id,nome', order: 'nome' }),
    supabaseQuery('etapas_ensino', { select: 'id,nome', order: 'nome' }),
  ]);

  let turnoOptions = [];
  const turnos = new Set((turmas.data || []).map(t => t.turno).filter(Boolean));
  turnoOptions = [...turnos].sort();

  let seriesData = series.data || [];
  let turmasData = turmas.data || [];
  let compData = componentes.data || [];
  let profData = professores.data || [];

  if (userIsProfessor && professorVinculo) {
    seriesData = professorVinculo.series;
    turmasData = professorVinculo.turmas;
    const compIdsSet = new Set(professorVinculo.compIds);
    compData = compData.filter(c => compIdsSet.has(c.id));
    profData = profData.filter(p => p.id === professorVinculo.id);
  }

  currentFilters = {};
  if (userIsProfessor && professorVinculo) {
    currentFilters.professor_id = String(professorVinculo.id);
  }

  return {
    series: seriesData,
    turmas: turmasData,
    componentes: compData,
    professores: profData,
    etapas: etapas.data || [],
    turnos: turnoOptions,
    userIsProfessor,
    profId: professorVinculo?.id,
  };
}

export async function renderFilterPanel(containerId, onChange) {
  onChangeCallback = onChange;
  const container = document.getElementById(containerId);
  if (!container) return;

  const data = await getFilterData();

  container.innerHTML = `
    <div class="filter-bar">
      <div class="row g-3">
        <div class="col-6 col-md-2">
          <div class="filter-group">
            <label class="filter-label">Etapa Ensino</label>
            <select class="filter-select" id="filter-etapa">
              <option value="">Todas</option>
            </select>
          </div>
        </div>
        <div class="col-6 col-md-2">
          <div class="filter-group">
            <label class="filter-label">Série</label>
            <select class="filter-select" id="filter-serie">
              <option value="">Todas as séries</option>
            </select>
          </div>
        </div>
        <div class="col-6 col-md-2">
          <div class="filter-group">
            <label class="filter-label">Turma</label>
            <select class="filter-select" id="filter-turma">
              <option value="">Todas as turmas</option>
            </select>
          </div>
        </div>
        <div class="col-6 col-md-2">
          <div class="filter-group">
            <label class="filter-label">Turno</label>
            <select class="filter-select" id="filter-turno">
              <option value="">Todos</option>
            </select>
          </div>
        </div>
        <div class="col-6 col-md-2">
          <div class="filter-group">
            <label class="filter-label">Disciplina</label>
            <select class="filter-select" id="filter-disciplina">
              <option value="">Todas</option>
            </select>
          </div>
        </div>
        <div class="col-6 col-md-2">
          <div class="filter-group">
            <label class="filter-label">Professor</label>
            <select class="filter-select" id="filter-professor" ${data.userIsProfessor ? 'disabled' : ''}>
              <option value="">${data.userIsProfessor ? (data.professores[0]?.nome || 'Meus dados') : 'Todos'}</option>
            </select>
          </div>
        </div>
        <div class="col-12">
          <button class="btn btn-sm btn-outline-secondary" id="filter-clear" style="border-radius:var(--sieac-radius-pill);${data.userIsProfessor ? 'display:none;' : ''}">
            <i class="bi bi-x-circle"></i> Limpar Filtros
          </button>
          ${data.userIsProfessor ? '<span style="font-size:0.78rem;color:var(--sieac-text-muted);"><i class="bi bi-person-badge"></i> Visualizando apenas seus dados</span>' : ''}
          <span id="filter-badges" style="margin-left:12px;"></span>
        </div>
      </div>
    </div>
  `;

  const fillSelect = (id, items, textFn, valueFn) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    items.forEach(item => {
      sel.innerHTML += `<option value="${valueFn(item)}">${textFn(item)}</option>`;
    });
  };

  fillSelect('filter-etapa', data.etapas, e => e.nome, e => e.id);
  fillSelect('filter-serie', data.series, s => s.nome, s => s.id);
  fillSelect('filter-turma', data.turmas, t => t.nome, t => t.id);
  fillSelect('filter-turno', data.turnos, t => t, t => t);
  fillSelect('filter-disciplina', data.componentes, c => c.nome, c => c.id);
  fillSelect('filter-professor', data.professores, p => p.nome, p => p.id);

  if (data.userIsProfessor && data.profId) {
    document.getElementById('filter-professor').value = data.profId;
  }

  updateBadges();
  window.__filterData = data;
  bindFilterEvents(data);
}

function bindFilterEvents(data) {
  const selectIds = [
    'filter-etapa', 'filter-serie', 'filter-turma',
    'filter-turno', 'filter-disciplina', 'filter-professor'
  ];

  selectIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.disabled) el.addEventListener('change', emitFilters);
  });

  const clearBtn = document.getElementById('filter-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (data.userIsProfessor) return;
    selectIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.disabled) el.value = '';
    });
    emitFilters();
  });

  // Hierarquia: etapa -> serie -> turma
  const etapaSel = document.getElementById('filter-etapa');
  const serieSel = document.getElementById('filter-serie');
  const turmaSel = document.getElementById('filter-turma');

  if (etapaSel && serieSel) {
    etapaSel.addEventListener('change', () => {
      const etapaId = etapaSel.value;
      const series = data.series || [];
      serieSel.innerHTML = '<option value="">Todas as séries</option>';
      series.filter(s => !etapaId || s.etapa_ensino_id == etapaId).forEach(s => {
        serieSel.innerHTML += `<option value="${s.id}">${s.nome}</option>`;
      });
      turmaSel.innerHTML = '<option value="">Todas as turmas</option>';
      emitFilters();
    });
  }

  if (serieSel && turmaSel) {
    serieSel.addEventListener('change', () => {
      const serieId = serieSel.value;
      const turmas = data.turmas || [];
      turmaSel.innerHTML = '<option value="">Todas as turmas</option>';
      turmas.filter(t => !serieId || t.serie_id == serieId).forEach(t => {
        turmaSel.innerHTML += `<option value="${t.id}">${t.nome}</option>`;
      });
      emitFilters();
    });
  }
}

function emitFilters() {
  const map = {
    'filter-etapa': 'etapa_id',
    'filter-serie': 'serie_id',
    'filter-turma': 'turma_id',
    'filter-turno': 'turno',
    'filter-disciplina': 'componente_id',
    'filter-professor': 'professor_id',
  };

  currentFilters = {};
  if (isProfessor() && professorVinculo) {
    currentFilters.professor_id = String(professorVinculo.id);
  }

  for (const [elId, key] of Object.entries(map)) {
    if (key === 'professor_id' && isProfessor()) continue;
    const el = document.getElementById(elId);
    if (el && !el.disabled) {
      const val = el.value;
      if (val) currentFilters[key] = val;
    }
  }

  updateBadges();
  if (onChangeCallback) onChangeCallback(currentFilters);
}

function updateBadges() {
  const container = document.getElementById('filter-badges');
  if (!container) return;
  const labels = {
    etapa_id: 'Etapa',
    serie_id: 'Série',
    turma_id: 'Turma',
    turno: 'Turno',
    componente_id: 'Disciplina',
    professor_id: 'Professor',
  };
  const mapa = {
    etapa_id: 'filter-etapa',
    serie_id: 'filter-serie',
    turma_id: 'filter-turma',
    turno: 'filter-turno',
    componente_id: 'filter-disciplina',
    professor_id: 'filter-professor',
  };
  let html = '';
  for (const [key, val] of Object.entries(currentFilters)) {
    if (!val) continue;
    const sel = document.getElementById(mapa[key]);
    const label = sel?.options[sel.selectedIndex]?.text || val;
    html += `<span class="filter-badge">${labels[key]}: ${label}</span> `;
  }
  container.innerHTML = html;
}

export function getFilters() {
  return { ...currentFilters };
}
