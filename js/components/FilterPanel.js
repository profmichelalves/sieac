import { supabaseQuery } from '../services/supabase.js';
import { isProfessor, getProfessorVinculo } from '../services/authService.js';

let pendingFilters = {};
let appliedFilters = {};
let onChangeCallback = null;
let isDirty = false;
let professorVinculo = null;
let filterData = null;

const SELECT_IDS = [
  'filter-etapa', 'filter-serie', 'filter-turma',
  'filter-turno', 'filter-disciplina', 'filter-professor'
];

const SEL_TO_KEY = {
  'filter-etapa': 'etapa_id',
  'filter-serie': 'serie_id',
  'filter-turma': 'turma_id',
  'filter-turno': 'turno',
  'filter-disciplina': 'componente_id',
  'filter-professor': 'professor_id',
};

const KEY_TO_LABEL = {
  etapa_id: 'Etapa',
  serie_id: 'Série',
  turma_id: 'Turma',
  turno: 'Turno',
  componente_id: 'Disciplina',
  professor_id: 'Professor',
};

async function getFilterData() {
  const userIsProfessor = isProfessor();
  if (userIsProfessor) professorVinculo = await getProfessorVinculo();

  const [series, turmas, componentes, professores, etapas, alocacoes] = await Promise.all([
    supabaseQuery('series', { select: 'id,nome,etapa_ensino_id', order: 'nome' }),
    supabaseQuery('turmas', { select: 'id,nome,serie_id,turno', order: 'nome' }),
    supabaseQuery('componentes_curriculares', { select: 'id,nome', order: 'nome' }),
    supabaseQuery('professores', { select: 'id,nome', order: 'nome' }),
    supabaseQuery('etapas_ensino', { select: 'id,nome', order: 'nome' }),
    supabaseQuery('alocacoes', { select: 'id,professor_id,turma_id,componente_id' }),
  ]);

  let seriesData = series.data || [];
  let turmasData = turmas.data || [];
  let compData = componentes.data || [];
  let profData = professores.data || [];
  let alocData = alocacoes.data || [];

  const turnosSet = new Set((turmasData || []).map(t => t.turno).filter(Boolean));
  const turnoOptions = [...turnosSet].sort();

  if (userIsProfessor && professorVinculo) {
    seriesData = professorVinculo.series;
    turmasData = professorVinculo.turmas;
    const compIdsSet = new Set(professorVinculo.compIds);
    compData = compData.filter(c => compIdsSet.has(c.id));
    profData = profData.filter(p => p.id === professorVinculo.id);
    alocData = alocData.filter(a => a.professor_id === professorVinculo.id);
  }

  const def = {};
  if (userIsProfessor && professorVinculo) def.professor_id = String(professorVinculo.id);
  pendingFilters = { ...def };
  appliedFilters = { ...def };
  isDirty = false;

  return {
    series: seriesData,
    turmas: turmasData,
    componentes: compData,
    professores: profData,
    etapas: etapas.data || [],
    alocacoes: alocData,
    turnos: turnoOptions,
    userIsProfessor,
    profId: professorVinculo?.id,
  };
}

function computeValidOptions(pending) {
  if (!filterData) return null;
  const { etapas, series, turmas, alocacoes, componentes, professores, turnos } = filterData;

  let aloc = alocacoes;
  if (pending.componente_id) aloc = aloc.filter(a => a.componente_id == pending.componente_id);
  if (pending.professor_id) aloc = aloc.filter(a => a.professor_id == pending.professor_id);
  const alocTurmaIds = new Set(aloc.map(a => a.turma_id));

  let turmV = turmas;
  if (pending.etapa_id) {
    const sIds = new Set(series.filter(s => s.etapa_ensino_id == pending.etapa_id).map(s => s.id));
    turmV = turmV.filter(t => sIds.has(t.serie_id));
  }
  if (pending.serie_id) turmV = turmV.filter(t => t.serie_id == pending.serie_id);
  if (pending.turma_id) turmV = turmV.filter(t => t.id == pending.turma_id);
  if (pending.turno) turmV = turmV.filter(t => t.turno == pending.turno);
  if (pending.professor_id || pending.componente_id) {
    turmV = turmV.filter(t => alocTurmaIds.has(t.id));
  }
  turmV = turmV.filter(t => t.serie_id != null);

  const validTurmaIds = new Set(turmV.map(t => t.id));
  const validSerieIds = new Set(tur mV.map(t => t.serie_id));
  const validTurnos = new Set(tur mV.map(t => t.turno).filter(Boolean));

  aloc = aloc.filter(a => validTurmaIds.has(a.turma_id));
  const validProfIds = new Set(aloc.map(a => a.professor_id));
  const validCompIds = new Set(aloc.map(a => a.componente_id));

  const validEtapaIds = new Set(series.filter(s => validSerieIds.has(s.id)).map(s => s.etapa_ensino_id));

  return {
    etapaIds: [...validEtapaIds],
    serieIds: [...validSerieIds],
    turmaIds: [...validTurmaIds],
    turnos: [...validTurnos],
    profIds: [...validProfIds],
    compIds: [...validCompIds],
  };
}

function fillSelect(id, items, textFn, valueFn) {
  const sel = document.getElementById(id);
  if (!sel) return;
  items.forEach(item => {
    sel.innerHTML += `<option value="${valueFn(item)}">${textFn(item)}</option>`;
  });
}

function rebuildSelectOptions(valid) {
  if (!filterData) return;
  const { etapas, series, turmas, componentes, professores, turnos } = filterData;

  const config = [
    { id: 'filter-etapa', items: etapas, text: e => e.nome, val: e => e.id, validSet: valid?.etapaIds ? new Set(valid.etapaIds) : null },
    { id: 'filter-serie', items: series, text: s => s.nome, val: s => s.id, validSet: valid?.serieIds ? new Set(valid.serieIds) : null },
    { id: 'filter-turma', items: turmas, text: t => t.nome, val: t => t.id, validSet: valid?.turmaIds ? new Set(valid.turmaIds) : null },
    { id: 'filter-turno', items: turnos, text: t => t, val: t => t, validSet: valid?.turnos ? new Set(valid.turnos) : null },
    { id: 'filter-disciplina', items: componentes, text: c => c.nome, val: c => c.id, validSet: valid?.compIds ? new Set(valid.compIds) : null },
    { id: 'filter-professor', items: professores, text: p => p.nome, val: p => p.id, validSet: valid?.profIds ? new Set(valid.profIds) : null },
  ];

  const placeholder = {
    'filter-etapa': 'Todas',
    'filter-serie': 'Todas as séries',
    'filter-turma': 'Todas as turmas',
    'filter-turno': 'Todos',
    'filter-disciplina': 'Todas',
    'filter-professor': filterData?.userIsProfessor ? (filterData.professores[0]?.nome || 'Meus dados') : 'Todos',
  };

  for (const cfg of config) {
    const sel = document.getElementById(cfg.id);
    if (!sel) continue;
    const currentVal = sel.value;
    sel.innerHTML = `<option value="">${placeholder[cfg.id]}</option>`;
    const filtered = cfg.validSet ? cfg.items.filter(item => {
      const v = String(cfg.val(item));
      return cfg.validSet.has(v) || cfg.validSet.has(Number(v));
    }) : cfg.items;
    for (const item of filtered) {
      const v = cfg.val(item);
      sel.innerHTML += `<option value="${v}">${cfg.text(item)}</option>`;
    }
    if (cfg.validSet) {
      const stillValid = currentVal && (cfg.validSet.has(currentVal) || cfg.validSet.has(Number(currentVal)));
      sel.value = stillValid ? currentVal : '';
    }
  }
}

export async function renderFilterPanel(containerId, onChange) {
  onChangeCallback = onChange;
  const container = document.getElementById(containerId);
  if (!container) return;

  filterData = await getFilterData();

  container.innerHTML = `
    <style>
      .filter-bar { position:relative; }
      .filter-select.filter-dirty {
        border-color: #ffd000 !important;
        box-shadow: 0 0 0 2px rgba(255,208,0,0.25) !important;
      }
      .btn-pesquisar {
        display:none;
        background:var(--sieac-primary,#1a1a4e);
        color:#fff; border:none;
        border-radius:var(--sieac-radius-pill);
        padding:5px 20px;
        font-size:0.82rem; font-weight:600;
        cursor:pointer; transition:opacity 0.2s;
      }
      .btn-pesquisar:hover { opacity:0.85; }
      .btn-pesquisar.visible { display:inline-block; }
      .filter-bar-actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
    </style>
    <div class="filter-bar">
      <div class="row g-3">
        <div class="col-6 col-md-2">
          <div class="filter-group">
            <label class="filter-label">Etapa Ensino</label>
            <select class="filter-select" id="filter-etapa"><option value="">Todas</option></select>
          </div>
        </div>
        <div class="col-6 col-md-2">
          <div class="filter-group">
            <label class="filter-label">Série</label>
            <select class="filter-select" id="filter-serie"><option value="">Todas as séries</option></select>
          </div>
        </div>
        <div class="col-6 col-md-2">
          <div class="filter-group">
            <label class="filter-label">Turma</label>
            <select class="filter-select" id="filter-turma"><option value="">Todas as turmas</option></select>
          </div>
        </div>
        <div class="col-6 col-md-2">
          <div class="filter-group">
            <label class="filter-label">Turno</label>
            <select class="filter-select" id="filter-turno"><option value="">Todos</option></select>
          </div>
        </div>
        <div class="col-6 col-md-2">
          <div class="filter-group">
            <label class="filter-label">Disciplina</label>
            <select class="filter-select" id="filter-disciplina"><option value="">Todas</option></select>
          </div>
        </div>
        <div class="col-6 col-md-2">
          <div class="filter-group">
            <label class="filter-label">Professor</label>
            <select class="filter-select" id="filter-professor" ${filterData.userIsProfessor ? 'disabled' : ''}><option value="">${filterData.userIsProfessor ? (filterData.professores[0]?.nome || 'Meus dados') : 'Todos'}</option></select>
          </div>
        </div>
        <div class="col-12">
          <div class="filter-bar-actions">
            <button class="btn btn-sm btn-outline-secondary" id="filter-clear" style="border-radius:var(--sieac-radius-pill);${filterData.userIsProfessor ? 'display:none;' : ''}">
              <i class="bi bi-x-circle"></i> Limpar Filtros
            </button>
            <button class="btn-pesquisar" id="btn-pesquisar">
              <i class="bi bi-search"></i> Pesquisar
            </button>
            ${filterData.userIsProfessor ? '<span style="font-size:0.78rem;color:var(--sieac-text-muted);"><i class="bi bi-person-badge"></i> Visualizando apenas seus dados</span>' : ''}
            <span id="filter-badges" style="margin-left:4px;"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  fillSelect('filter-etapa', filterData.etapas, e => e.nome, e => e.id);
  fillSelect('filter-serie', filterData.series, s => s.nome, s => s.id);
  fillSelect('filter-turma', filterData.turmas, t => t.nome, t => t.id);
  fillSelect('filter-turno', filterData.turnos, t => t, t => t);
  fillSelect('filter-disciplina', filterData.componentes, c => c.nome, c => c.id);
  fillSelect('filter-professor', filterData.professores, p => p.nome, p => p.id);

  if (filterData.userIsProfessor && filterData.profId) {
    document.getElementById('filter-professor').value = filterData.profId;
  }

  updateBadges();
  bindFilterEvents();
}

function bindFilterEvents() {
  SELECT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.disabled) {
      el.addEventListener('change', () => {
        rebuildPending();
        const valid = computeValidOptions(pendingFilters);
        rebuildSelectOptions(valid);
        markDirty();
      });
    }
  });

  const btnPesquisar = document.getElementById('btn-pesquisar');
  if (btnPesquisar) {
    btnPesquisar.addEventListener('click', () => {
      rebuildPending();
      appliedFilters = { ...pendingFilters };
      clearDirty();
      updateBadges();
      if (onChangeCallback) onChangeCallback(appliedFilters);
    });
  }

  const clearBtn = document.getElementById('filter-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (filterData?.userIsProfessor) return;
      SELECT_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.disabled) el.value = '';
      });
      pendingFilters = {};
      if (filterData?.userIsProfessor && professorVinculo) {
        pendingFilters.professor_id = String(professorVinculo.id);
        document.getElementById('filter-professor').value = filterData.profId;
      }
      appliedFilters = { ...pendingFilters };
      rebuildSelectOptions(null);
      clearDirty();
      updateBadges();
      if (onChangeCallback) onChangeCallback(appliedFilters);
    });
  }
}

function rebuildPending() {
  pendingFilters = {};
  if (isProfessor() && professorVinculo) {
    pendingFilters.professor_id = String(professorVinculo.id);
  }
  for (const [elId, key] of Object.entries(SEL_TO_KEY)) {
    if (key === 'professor_id' && isProfessor()) continue;
    const el = document.getElementById(elId);
    if (el && !el.disabled) {
      const val = el.value;
      if (val) pendingFilters[key] = val;
    }
  }
}

function markDirty() {
  SELECT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value) el.classList.add('filter-dirty');
    else if (el) el.classList.remove('filter-dirty');
  });
  if (!isDirty) {
    isDirty = true;
    const btn = document.getElementById('btn-pesquisar');
    if (btn) btn.classList.add('visible');
  }
}

function clearDirty() {
  isDirty = false;
  document.querySelectorAll('.filter-select.filter-dirty').forEach(el => el.classList.remove('filter-dirty'));
  const btn = document.getElementById('btn-pesquisar');
  if (btn) btn.classList.remove('visible');
}

function updateBadges() {
  const container = document.getElementById('filter-badges');
  if (!container) return;
  let html = '';
  for (const [key, val] of Object.entries(appliedFilters)) {
    if (!val) continue;
    const selId = Object.entries(SEL_TO_KEY).find(([, v]) => v === key)?.[0];
    const sel = selId ? document.getElementById(selId) : null;
    const label = sel?.options[sel.selectedIndex]?.text || val;
    html += `<span class="filter-badge">${KEY_TO_LABEL[key] || key}: ${label}</span> `;
  }
  container.innerHTML = html;
}

export function getFilters() {
  return { ...(isProfessor() && professorVinculo ? { ...appliedFilters, professor_id: String(professorVinculo.id) } : appliedFilters) };
}
