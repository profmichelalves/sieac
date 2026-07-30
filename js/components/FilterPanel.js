import { $, showToast } from '../utils/helpers.js';
import { supabaseQuery } from '../services/supabase.js';

let currentFilters = {};
let onChangeCallback = null;

async function getFilterData() {
  const [series, turmas, componentes, professores, etapas, estudantes] = await Promise.all([
    supabaseQuery('series', { select: 'id,nome,etapa_ensino_id', order: 'nome' }),
    supabaseQuery('turmas', { select: 'id,nome,serie_id,turno', order: 'nome' }),
    supabaseQuery('componentes_curriculares', { select: 'id,nome', order: 'nome' }),
    supabaseQuery('professores', { select: 'id,nome', order: 'nome' }),
    supabaseQuery('etapas_ensino', { select: 'id,nome', order: 'nome' }),
    supabaseQuery('estudantes', { select: 'id,nome,matricula', order: 'nome' }),
  ]);

  let turnoOptions = [];
  const turnos = new Set((turmas.data || []).map(t => t.turno).filter(Boolean));
  turnoOptions = [...turnos].sort();

  let anosLetivos = [];
  const { data: freqs } = await supabaseQuery('frequencias', { select: 'ano_letivo', limit: 5000 });
  const anos = new Set((freqs || []).map(f => f.ano_letivo).filter(Boolean));
  anosLetivos = [...anos].sort((a, b) => b - a);

  return {
    series: series.data || [],
    turmas: turmas.data || [],
    componentes: componentes.data || [],
    professores: professores.data || [],
    etapas: etapas.data || [],
    estudantes: estudantes.data || [],
    turnos: turnoOptions,
    anosLetivos,
  };
}

export async function renderFilterPanel(containerId, onChange) {
  onChangeCallback = onChange;
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="filter-bar">
      <div class="row g-3">
        <div class="col-6 col-md-2">
          <div class="filter-group">
            <label class="filter-label">Ano Letivo</label>
            <select class="filter-select" id="filter-ano-letivo">
              <option value="">Todos</option>
            </select>
          </div>
        </div>
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
        <div class="col-6 col-md-3">
          <div class="filter-group">
            <label class="filter-label">Professor</label>
            <select class="filter-select" id="filter-professor">
              <option value="">Todos</option>
            </select>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="filter-group">
            <label class="filter-label">Estudante</label>
            <select class="filter-select" id="filter-estudante">
              <option value="">Todos</option>
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

  const data = await getFilterData();

  const fillSelect = (id, items, textFn, valueFn) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    items.forEach(item => {
      sel.innerHTML += `<option value="${valueFn(item)}">${textFn(item)}</option>`;
    });
  };

  fillSelect('filter-ano-letivo', data.anosLetivos, a => a, a => a);
  fillSelect('filter-etapa', data.etapas, e => e.nome, e => e.id);
  fillSelect('filter-serie', data.series, s => s.nome, s => s.id);
  fillSelect('filter-turma', data.turmas, t => t.nome, t => t.id);
  fillSelect('filter-turno', data.turnos, t => t, t => t);
  fillSelect('filter-disciplina', data.componentes, c => c.nome, c => c.id);
  fillSelect('filter-professor', data.professores, p => p.nome, p => p.id);
  fillSelect('filter-estudante', data.estudantes, e => `${e.nome} (${e.matricula || e.id})`, e => e.id);

  window.__filterData = data;
  bindFilterEvents(data);
}

function bindFilterEvents(data) {
  const selectIds = [
    'filter-ano-letivo', 'filter-etapa', 'filter-serie', 'filter-turma',
    'filter-turno', 'filter-disciplina', 'filter-professor', 'filter-estudante'
  ];
  selectIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyFilters);
  });

  const clearBtn = document.getElementById('filter-clear');
  if (clearBtn) clearBtn.addEventListener('click', clearFilters);

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
      serieSel.dispatchEvent(new Event('change'));
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
    });
  }
}

function applyFilters() {
  currentFilters = {};
  const map = {
    'filter-ano-letivo': 'ano_letivo',
    'filter-etapa': 'etapa_id',
    'filter-serie': 'serie_id',
    'filter-turma': 'turma_id',
    'filter-turno': 'turno',
    'filter-disciplina': 'componente_id',
    'filter-professor': 'professor_id',
    'filter-estudante': 'estudante_id',
  };

  for (const [elId, key] of Object.entries(map)) {
    const val = document.getElementById(elId)?.value;
    if (val) currentFilters[key] = val;
  }

  updateBadges();
  if (onChangeCallback) onChangeCallback(currentFilters);
}

function clearFilters() {
  ['filter-ano-letivo', 'filter-etapa', 'filter-serie', 'filter-turma',
   'filter-turno', 'filter-disciplina', 'filter-professor', 'filter-estudante'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; }
  });
  currentFilters = {};
  updateBadges();
  if (onChangeCallback) onChangeCallback({});
}

function updateBadges() {
  const container = document.getElementById('filter-badges');
  if (!container) return;
  const labels = {
    ano_letivo: 'Ano Letivo',
    etapa_id: 'Etapa',
    serie_id: 'Série',
    turma_id: 'Turma',
    turno: 'Turno',
    componente_id: 'Disciplina',
    professor_id: 'Professor',
    estudante_id: 'Estudante',
  };
  const mapa = {
    ano_letivo: 'filter-ano-letivo',
    etapa_id: 'filter-etapa',
    serie_id: 'filter-serie',
    turma_id: 'filter-turma',
    turno: 'filter-turno',
    componente_id: 'filter-disciplina',
    professor_id: 'filter-professor',
    estudante_id: 'filter-estudante',
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
