import { $, showToast } from '../utils/helpers.js';
import { getFilterOptions } from '../repositories/dashboardRepository.js';

let currentFilters = {};
let onChangeCallback = null;

export function renderFilterPanel(containerId, onChange) {
  onChangeCallback = onChange;
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="filter-bar">
      <div class="row g-3">
        <div class="col-6 col-md-3">
          <div class="filter-group">
            <label class="filter-label">Série</label>
            <select class="filter-select" id="filter-serie">
              <option value="">Todas as séries</option>
            </select>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="filter-group">
            <label class="filter-label">Turma</label>
            <select class="filter-select" id="filter-turma">
              <option value="">Todas as turmas</option>
            </select>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="filter-group">
            <label class="filter-label">Disciplina</label>
            <select class="filter-select" id="filter-disciplina">
              <option value="">Todas as disciplinas</option>
            </select>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="filter-group">
            <label class="filter-label">Professor</label>
            <select class="filter-select" id="filter-professor">
              <option value="">Todos os professores</option>
            </select>
          </div>
        </div>
        <div class="col-12">
          <button class="btn btn-sm btn-outline-secondary" id="filter-clear" style="border-radius:var(--sieac-radius-pill);">
            <i class="bi bi-x-circle"></i> Limpar Filtros
          </button>
          <span id="filter-badges" style="margin-left:12px;"></span>
        </div>
      </div>
    </div>
  `;

  loadFilterOptions();
  bindFilterEvents();
}

async function loadFilterOptions() {
  const opts = await getFilterOptions();
  const serieSel = document.getElementById('filter-serie');
  const turmaSel = document.getElementById('filter-turma');
  const discSel = document.getElementById('filter-disciplina');
  const profSel = document.getElementById('filter-professor');

  (opts.series || []).forEach(s => {
    serieSel.innerHTML += `<option value="${s.id}">${s.nome}</option>`;
  });
  (opts.turmas || []).forEach(t => {
    turmaSel.innerHTML += `<option value="${t.id}" data-serie="${t.serie_id}">${t.nome}</option>`;
  });
  (opts.componentes || []).forEach(c => {
    discSel.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
  });
  (opts.professores || []).forEach(p => {
    profSel.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
  });
}

function bindFilterEvents() {
  const selects = ['filter-serie', 'filter-turma', 'filter-disciplina', 'filter-professor'];

  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyFilters);
  });

  const clearBtn = document.getElementById('filter-clear');
  if (clearBtn) clearBtn.addEventListener('click', clearFilters);

  const serieSel = document.getElementById('filter-serie');
  const turmaSel = document.getElementById('filter-turma');
  if (serieSel && turmaSel) {
    serieSel.addEventListener('change', () => {
      const serieId = serieSel.value;
      [...turmaSel.options].forEach(opt => {
        if (opt.value === '') return;
        opt.style.display = (!serieId || opt.dataset.serie === serieId) ? 'block' : 'none';
      });
      if (serieId && turmaSel.value) {
        const selected = turmaSel.options[turmaSel.selectedIndex];
        if (selected && selected.dataset.serie !== serieId) turmaSel.value = '';
      }
    });
  }
}

function applyFilters() {
  currentFilters = {};
  const serie = document.getElementById('filter-serie')?.value;
  const turma = document.getElementById('filter-turma')?.value;
  const disciplina = document.getElementById('filter-disciplina')?.value;
  const professor = document.getElementById('filter-professor')?.value;

  if (serie) currentFilters.serie_id = serie;
  if (turma) currentFilters.turma_id = turma;
  if (disciplina) currentFilters.componente_id = disciplina;
  if (professor) currentFilters.professor_id = professor;

  updateBadges();
  if (onChangeCallback) onChangeCallback(currentFilters);
}

function clearFilters() {
  ['filter-serie', 'filter-turma', 'filter-disciplina', 'filter-professor'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  currentFilters = {};
  updateBadges();
  if (onChangeCallback) onChangeCallback({});
}

function updateBadges() {
  const container = document.getElementById('filter-badges');
  if (!container) return;
  const labels = {
    serie_id: 'Série',
    turma_id: 'Turma',
    componente_id: 'Disciplina',
    professor_id: 'Professor'
  };
  const mapa = {
    serie_id: 'filter-serie',
    turma_id: 'filter-turma',
    componente_id: 'filter-disciplina',
    professor_id: 'filter-professor'
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
