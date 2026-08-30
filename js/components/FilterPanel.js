import { supabaseQuery } from '../services/supabase.js';
import { isProfessor, isProfessorAee, getProfessorVinculo } from '../services/authService.js';
import { listarTurmasParaConsulta } from '../repositories/dashboardRepository.js';
import { createSearchSelect } from './SearchSelect.js';
import { infoBtn } from '../utils/explanation.js';
import { escapeHtml } from '../utils/helpers.js';
import { showAppLoading, hideAppLoading } from '../utils/appLoading.js';

const CACHE_KEY = 'sieac_filter_cache';
const CACHE_VERSION = 4;

const SELECTED_KEY = 'sieac_filter_selected';
const SELECTED_VERSION = 1;

function loadFilterCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.v === CACHE_VERSION) return parsed;
      localStorage.removeItem(CACHE_KEY);
    }
  } catch {}
  return null;
}

function saveFilterCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ v: CACHE_VERSION, ...data })); } catch {}
}

export function clearFilterCache() {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(SELECTED_KEY);
}

function loadSelectedFilters() {
  try {
    const raw = localStorage.getItem(SELECTED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.v === SELECTED_VERSION && parsed.f) return parsed.f;
      localStorage.removeItem(SELECTED_KEY);
    }
  } catch {}
  return {};
}

function saveSelectedFilters(filters) {
  const f = { ...filters };
  delete f.escopo;
  try { localStorage.setItem(SELECTED_KEY, JSON.stringify({ v: SELECTED_VERSION, f })); } catch {}
}

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

let pendingFilters = {};
let appliedFilters = {};
let onChangeCallback = null;
let isDirty = false;
let professorVinculo = null;
let filterData = null;
let sessionEscopo = null;      // escolha de escopo na sessão (compartilhada entre telas)

const combos = {};

function getSelectValue(id) {
  const c = combos[id];
  if (c) return c.getValue();
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setSelectValue(id, val) {
  const c = combos[id];
  if (c) { c.setValue(val || ''); return; }
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}

async function getFilterData() {
  const userIsProfessor = isProfessor();
  if (userIsProfessor) professorVinculo = await getProfessorVinculo();

  let raw = loadFilterCache();
  if (!raw) {
    const [series, turmas, componentes, professores, etapas, alocacoes] = await Promise.all([
      supabaseQuery('series', { select: 'id,nome,etapa_ensino_id', order: 'nome' }),
      supabaseQuery('turmas', { select: 'id,nome,serie_id,turno', order: 'nome' }),
      supabaseQuery('componentes_curriculares', { select: 'id,nome', order: 'nome' }),
      supabaseQuery('professores', { select: 'id,nome', order: 'nome' }),
      supabaseQuery('etapas_ensino', { select: 'id,nome', order: 'nome' }),
      supabaseQuery('alocacoes', { select: 'id,professor_id,turma_id,componente_id' }),
    ]);
    raw = {
      series: series.data || [],
      turmas: turmas.data || [],
      componentes: componentes.data || [],
      professores: professores.data || [],
      etapas: etapas.data || [],
      alocacoes: alocacoes.data || [],
    };
    const turnosSet = new Set(raw.turmas.map(t => t.turno).filter(Boolean));
    raw.turnoOptions = [...turnosSet].sort();
    saveFilterCache(raw);
  }

  let seriesData = raw.series;
  let turmasData = raw.turmas;
  let compData = raw.componentes;
  let profData = raw.professores;
  let alocData = raw.alocacoes;
  let etapasData = raw.etapas;
  let turnoOptions = raw.turnoOptions;

  if (userIsProfessor && professorVinculo) {
    seriesData = professorVinculo.series;
    turmasData = professorVinculo.turmas;
    profData = profData.filter(p => p.id === professorVinculo.id);
  }

  if (isProfessorAee()) {
    turmasData = await listarTurmasParaConsulta();
    const turmaIdSet = new Set(turmasData.map(t => t.id));
    const serieIdSet = new Set(turmasData.map(t => t.serie_id).filter(Boolean));
    const alocAee = (alocData || []).filter(a => turmaIdSet.has(a.turma_id));
    const profIdSet = new Set(alocAee.map(a => a.professor_id));
    const compIdSet = new Set(alocAee.map(a => a.componente_id));
    seriesData = seriesData.filter(s => serieIdSet.has(s.id));
    turmasData = turmasData.filter(t => serieIdSet.has(t.serie_id));
    alocData = alocAee;
    profData = profData.filter(p => profIdSet.has(p.id));
    compData = compData.filter(c => compIdSet.has(c.id));
    const etapaIdSet = new Set(seriesData.map(s => s.etapa_ensino_id).filter(Boolean));
    etapasData = etapasData.filter(e => etapaIdSet.has(e.id));
    turnoOptions = [...new Set(turmasData.map(t => t.turno).filter(Boolean))].sort();
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
    etapas: etapasData,
    alocacoes: alocData,
    turnos: turnoOptions,
    userIsProfessor,
    profId: professorVinculo?.id,
    responsavelTurmaIds: professorVinculo?.turmasConselheiro ? [...professorVinculo.turmasConselheiro] : [],
  };
}

function computeValidOptions(pending) {
  if (!filterData) return null;
  const { series, turmas, alocacoes } = filterData;

  // Para o Professor Conselheiro da turma selecionada com escopo "Todas as
  // disciplinas da turma", o filtro de Disciplina deve listar todas as
  // disciplinas da turma, não apenas as que ele leciona. Caso contrário (escopo
  // "Minhas disciplinas"), o filtro mantém apenas as disciplinas do professor.
  const conselheiroDaTurma = filterData.userIsProfessor &&
    pending.escopo === 'todas' &&
    pending.turma_id != null && pending.turma_id !== '' && turmaEhConselheiro(pending.turma_id);

  let aloc = alocacoes;
  if (pending.componente_id) aloc = aloc.filter(a => a.componente_id == pending.componente_id);
  if (pending.professor_id && !conselheiroDaTurma) aloc = aloc.filter(a => a.professor_id == pending.professor_id);
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
  const validSerieIds = new Set(turmV.map(t => t.serie_id));
  const validTurnos = [...new Set(turmV.map(t => t.turno).filter(Boolean))].sort();

  aloc = aloc.filter(a => validTurmaIds.has(a.turma_id));
  const validProfIds = [...new Set(aloc.map(a => a.professor_id))];
  const validCompIds = [...new Set(aloc.map(a => a.componente_id))];
  const validEtapaIds = [...new Set(series.filter(s => validSerieIds.has(s.id)).map(s => s.etapa_ensino_id))];

  return {
    etapaIds: validEtapaIds,
    serieIds: [...validSerieIds],
    turmaIds: [...validTurmaIds],
    turnos: validTurnos,
    profIds: validProfIds,
    compIds: validCompIds,
  };
}

function fillSelect(id, items, textFn, valueFn) {
  const sel = document.getElementById(id);
  if (!sel || !items) return;
  for (const item of items) {
    sel.innerHTML += `<option value="${escapeHtml(valueFn(item))}">${escapeHtml(textFn(item))}</option>`;
  }
}

function rebuildSelectOptions(valid, skipId) {
  if (!filterData) return;
  const { etapas, series, turmas, componentes, professores, turnos } = filterData;

  const has = arr => arr?.length ? new Set(arr) : null;
  const config = [
    { id: 'filter-etapa', items: etapas, text: e => e.nome, val: e => e.id, validSet: has(valid?.etapaIds) },
    { id: 'filter-serie', items: series, text: s => s.nome, val: s => s.id, validSet: has(valid?.serieIds) },
    { id: 'filter-turma', items: turmas, text: t => t.nome, val: t => t.id, validSet: has(valid?.turmaIds) },
    { id: 'filter-turno', items: turnos, text: t => t, val: t => t, validSet: has(valid?.turnos) },
    { id: 'filter-disciplina', items: componentes, text: c => c.nome, val: c => c.id, validSet: has(valid?.compIds) },
  ];

  const placeholder = {
    'filter-etapa': 'Todas',
    'filter-serie': 'Todas as séries',
    'filter-turma': 'Todas as turmas',
    'filter-turno': 'Todos',
    'filter-disciplina': 'Todas',
  };

  for (const cfg of config) {
    if (cfg.id === skipId) continue;
    const sel = document.getElementById(cfg.id);
    if (!sel) continue;
    const currentVal = sel.value;
    sel.innerHTML = `<option value="">${placeholder[cfg.id]}</option>`;
    const filtered = cfg.validSet
      ? cfg.items.filter(item => {
          const raw = cfg.val(item);
          const idNum = typeof raw === 'number' ? raw : Number(raw);
          return cfg.validSet.has(idNum) || cfg.validSet.has(raw);
        })
      : cfg.items;
    if (cfg.validSet && filtered.length === 0) {
      console.warn(`[FilterPanel] ${cfg.id}: nenhuma opção válida entre ${cfg.items.length} itens`, JSON.stringify(pendingFilters));
    }
    for (const item of filtered) {
      const v = cfg.val(item);
      sel.innerHTML += `<option value="${escapeHtml(v)}">${escapeHtml(cfg.text(item))}</option>`;
    }
    if (cfg.validSet) {
      const stillValid = currentVal && (cfg.validSet.has(Number(currentVal)) || cfg.validSet.has(currentVal));
      sel.value = stillValid ? currentVal : '';
    } else {
      sel.value = currentVal;
    }
  }

  const profCombo = combos['filter-professor'];
  if (profCombo) {
    const currentVal = getSelectValue('filter-professor');
    const profSet = has(valid?.profIds);
    const filtered = profSet
      ? filterData.professores.filter(p => profSet.has(Number(p.id)) || profSet.has(p.id))
      : filterData.professores;
    profCombo.setItems(filtered);
    setSelectValue('filter-professor', currentVal);
  }
}

export async function renderFilterPanel(containerId, onChange) {
  onChangeCallback = onChange;
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    filterData = await getFilterData();
  } catch (e) {
    console.error('FilterPanel: getFilterData failed', e);
    filterData = null;
    return;
  }

  if (!filterData) return;

  filterData.responsavelTurmaSet = new Set(filterData.responsavelTurmaIds || []);

  logFilterDiagnostics();

  container.innerHTML = `
    <style>
      .filter-bar { position:relative; }
      .filter-select.filter-dirty {
        border-color: #fff001 !important;
        box-shadow: 0 0 0 2px rgba(255,240,1,0.25) !important;
      }
      .btn-pesquisar {
        display:none;
        background:var(--sieac-primary,#312f92);
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
        <div class="col-6 col-md-2" id="filter-professor-col">
          <div class="filter-group">
            <label class="filter-label">Professor</label>
            <div id="filter-professor"></div>
          </div>
        </div>
        <div class="col-12">
          <div class="filter-bar-actions">
            <button class="btn btn-sm btn-outline-secondary" id="filter-clear" style="border-radius:var(--sieac-radius-pill);">
              <i class="bi bi-x-circle"></i> Limpar Filtros
            </button>
            ${filterData.userIsProfessor ? `
              <div class="filter-group filter-escopo-group" id="filter-escopo-group" style="display:none;">
                <label class="filter-label">Escopo ${infoBtn('Escopo de Visualização', 'Quando você é o Professor Conselheiro de uma turma, pode visualizar apenas as suas disciplinas ou todas as disciplinas da turma selecionada.')}</label>
                <select class="filter-select" id="filter-escopo" disabled>
                  <option value="minhas">Minhas disciplinas</option>
                  <option value="todas">Todas as disciplinas da turma</option>
                </select>
                <span id="prof-conselheiro-badge" class="conselheiro-note" style="display:none;"></span>
              </div>
            ` : ''}
            <button class="btn-pesquisar" id="btn-pesquisar">
              <i class="bi bi-search"></i> Pesquisar
            </button>
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

  if (combos['filter-professor']) combos['filter-professor'].destroy();
  const profCombo = createSearchSelect({
    items: filterData.professores,
    getText: p => p.nome,
    getValue: p => p.id,
    placeholder: filterData.userIsProfessor ? (filterData.professores[0]?.nome || 'Meus dados') : 'Digite para filtrar professor...',
    disabled: filterData.userIsProfessor,
    onSelect: () => handleFilterChange('filter-professor'),
  });
  combos['filter-professor'] = profCombo;
  document.getElementById('filter-professor').appendChild(profCombo.el);

  if (filterData.userIsProfessor && filterData.profId) {
    setSelectValue('filter-professor', filterData.profId);
  }

  restoreFilterValues();
  const valid = computeValidOptions(pendingFilters);
  rebuildSelectOptions(valid, null);
  if (filterData.userIsProfessor) applyEscopoUI();
  updateBadges();
  bindFilterEvents();
}

function restoreFilterValues() {
  if (!filterData) return;
  const validSets = {
    etapa_id: new Set(filterData.etapas.map(x => String(x.id))),
    serie_id: new Set(filterData.series.map(x => String(x.id))),
    turma_id: new Set(filterData.turmas.map(x => String(x.id))),
    turno: new Set(filterData.turnos.map(x => String(x))),
    componente_id: new Set(filterData.componentes.map(x => String(x.id))),
    professor_id: new Set(filterData.userIsProfessor
      ? (filterData.profId != null ? [String(filterData.profId)] : [])
      : filterData.professores.map(x => String(x.id))),
  };

  const restored = {};
  const persisted = loadSelectedFilters();
  for (const [key, val] of Object.entries(persisted)) {
    if (!val) continue;
    if (!validSets[key]) continue;
    if (filterData.userIsProfessor && key === 'professor_id') continue;
    if (!validSets[key].has(String(val))) continue;
    restored[key] = String(val);
  }

  let escopo = 'minhas';
  if (filterData.userIsProfessor && professorVinculo) {
    if (sessionEscopo === 'todas' && restored.turma_id && turmaEhConselheiro(restored.turma_id)) {
      escopo = 'todas';
    }
  }

  pendingFilters = { ...restored, escopo };
  if (filterData.userIsProfessor && professorVinculo && escopo !== 'todas') {
    pendingFilters.professor_id = String(professorVinculo.id);
  }
  appliedFilters = { ...pendingFilters };
  isDirty = false;

  for (const [elId, key] of Object.entries(SEL_TO_KEY)) {
    setSelectValue(elId, pendingFilters[key] || '');
  }
  setSelectValue('filter-escopo', pendingFilters.escopo || 'minhas');
}

function handleFilterChange(id) {
  try {
    if (id === 'filter-escopo') {
      handleEscopoChange();
      return;
    }
    rebuildPending();
    const valid = computeValidOptions(pendingFilters);
    const cnt = valid && {
      etapa: valid.etapaIds.length,
      serie: valid.serieIds.length,
      turma: valid.turmaIds.length,
      turno: valid.turnos.length,
      disciplina: valid.compIds.length,
      professor: valid.profIds.length,
    };
    console.log(`[FilterPanel] change em ${id} | pending=${JSON.stringify(pendingFilters)} | válidos=`, cnt);
    rebuildSelectOptions(valid, id);
    applyEscopoUI();
    markDirty();
  } catch (e) {
    console.error('FilterPanel change handler:', e);
  }
}

// A mudança do escopo não deve recomputar/reduzir as opções de turma: apenas
// alterna entre as disciplinas do professor e todas as disciplinas da turma.
function handleEscopoChange() {
  if (!filterData?.userIsProfessor || !professorVinculo) return;
  const escopo = getSelectValue('filter-escopo') === 'todas' ? 'todas' : 'minhas';
  const turmaId = getSelectValue('filter-turma');
  if (escopo === 'todas' && turmaEhConselheiro(turmaId)) {
    pendingFilters.escopo = 'todas';
    delete pendingFilters.professor_id;
    sessionEscopo = 'todas';
  } else {
    pendingFilters.escopo = 'minhas';
    pendingFilters.professor_id = String(professorVinculo.id);
    setSelectValue('filter-escopo', 'minhas');
    sessionEscopo = 'minhas';
  }
  const valid = computeValidOptions(pendingFilters);
  rebuildSelectOptions(valid, 'filter-turma');
  applyEscopoUI();
  markDirty();
}

function bindFilterEvents() {
  SELECT_IDS.forEach(id => {
    if (combos[id]) return;
    const el = document.getElementById(id);
    if (el && !el.disabled) {
      el.addEventListener('change', () => handleFilterChange(id));
    }
  });

  const escopoSel = document.getElementById('filter-escopo');
  if (escopoSel) escopoSel.addEventListener('change', () => handleFilterChange('filter-escopo'));

  const btnPesquisar = document.getElementById('btn-pesquisar');
  if (btnPesquisar) {
    btnPesquisar.addEventListener('click', async () => {
      rebuildPending();
      appliedFilters = { ...pendingFilters };
      clearDirty();
      updateBadges();
      saveSelectedFilters(appliedFilters);
      if (onChangeCallback) {
        showAppLoading();
        try {
          await onChangeCallback(appliedFilters);
        } finally {
          hideAppLoading();
        }
      }
    });
  }

  const clearBtn = document.getElementById('filter-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      SELECT_IDS.forEach(id => {
        if (combos[id]) {
          combos[id].clear();
        } else {
          const el = document.getElementById(id);
          if (el && !el.disabled) el.value = '';
        }
      });
      pendingFilters = {};
      if (filterData?.userIsProfessor && professorVinculo) {
        pendingFilters.professor_id = String(professorVinculo.id);
        setSelectValue('filter-professor', filterData.profId);
        pendingFilters.escopo = 'minhas';
        setSelectValue('filter-escopo', 'minhas');
        sessionEscopo = 'minhas';
      }
      appliedFilters = { ...pendingFilters };
      const valid = computeValidOptions(pendingFilters);
      rebuildSelectOptions(valid, null);
      if (filterData?.userIsProfessor) applyEscopoUI();
      clearDirty();
      updateBadges();
      saveSelectedFilters(appliedFilters);
      if (onChangeCallback) {
        showAppLoading();
        try {
          await onChangeCallback(appliedFilters);
        } finally {
          hideAppLoading();
        }
      }
    });
  }
}

function rebuildPending() {
  pendingFilters = {};
  const escopo = getSelectValue('filter-escopo');
  if (isProfessor() && professorVinculo) {
    pendingFilters.professor_id = String(professorVinculo.id);
  }
  for (const [elId, key] of Object.entries(SEL_TO_KEY)) {
    if (key === 'professor_id' && isProfessor()) continue;
    const val = getSelectValue(elId);
    if (val) pendingFilters[key] = val;
  }
  if (isProfessor() && escopo === 'todas' && pendingFilters.turma_id && turmaEhConselheiro(pendingFilters.turma_id)) {
    delete pendingFilters.professor_id;
    pendingFilters.escopo = 'todas';
  } else {
    pendingFilters.escopo = 'minhas';
    setSelectValue('filter-escopo', 'minhas');
    sessionEscopo = 'minhas';
  }
}

function markDirty() {
  SELECT_IDS.forEach(id => {
    const has = !!getSelectValue(id);
    if (combos[id]) {
      combos[id].el.classList.toggle('filter-dirty', has);
    } else {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('filter-dirty', has);
    }
  });
  if (!isDirty) {
    isDirty = true;
    const btn = document.getElementById('btn-pesquisar');
    if (btn) btn.classList.add('visible');
  }
}

function clearDirty() {
  isDirty = false;
  document.querySelectorAll('.filter-select.filter-dirty, .search-select.filter-dirty').forEach(el => el.classList.remove('filter-dirty'));
  const btn = document.getElementById('btn-pesquisar');
  if (btn) btn.classList.remove('visible');
}

function updateBadges() {
  const container = document.getElementById('filter-badges');
  if (!container) return;
  let html = '';
  for (const [key, val] of Object.entries(appliedFilters)) {
    if (!val || key === 'escopo') continue;
    const selId = Object.entries(SEL_TO_KEY).find(([, v]) => v === key)?.[0];
    let label = val;
    if (selId && combos[selId]) label = combos[selId].getText() || val;
    else {
      const sel = selId ? document.getElementById(selId) : null;
      if (sel) label = sel.options[sel.selectedIndex]?.text || val;
    }
    html += `<span class="filter-badge">${KEY_TO_LABEL[key] || key}: ${label}</span> `;
  }
  if (appliedFilters.escopo === 'todas') {
    html += `<span class="filter-badge">Escopo: Todas as disciplinas da turma</span> `;
  }
  container.innerHTML = html;
}

export function getFilters() {
  const base = { ...appliedFilters };
  if (isProfessor() && professorVinculo && !escopoTodas(appliedFilters)) {
    base.professor_id = String(professorVinculo.id);
  }
  return base;
}

export function getCurrentFilters() {
  const base = isDirty ? pendingFilters : appliedFilters;
  if (isProfessor() && professorVinculo && !escopoTodas(base)) {
    return { ...base, professor_id: String(professorVinculo.id) };
  }
  return { ...base };
}

// True quando a turma selecionada é uma turma da qual o professor é conselheiro.
function turmaEhConselheiro(turmaId) {
  const set = filterData?.responsavelTurmaSet;
  if (!set || turmaId == null || turmaId === '') return false;
  return set.has(Number(turmaId)) || set.has(String(turmaId));
}

// True quando o professor optou por ver todas as disciplinas de uma turma da
// qual é conselheiro (e essa turma está selecionada no filtro).
function escopoTodas(f) {
  if (!filterData?.userIsProfessor || !professorVinculo) return false;
  if (!f || f.escopo !== 'todas') return false;
  return turmaEhConselheiro(f.turma_id);
}

function applyEscopoUI() {
  const esc = document.getElementById('filter-escopo');
  const group = document.getElementById('filter-escopo-group');
  const badge = document.getElementById('prof-conselheiro-badge');
  if (!esc || !group || !filterData?.userIsProfessor) return;

  const turmaId = getSelectValue('filter-turma');
  const habilitado = turmaEhConselheiro(turmaId);
  const isTodas = getSelectValue('filter-escopo') === 'todas';

  group.style.display = habilitado ? '' : 'none';
  esc.disabled = !habilitado;
  if (!habilitado && isTodas) setSelectValue('filter-escopo', 'minhas');
  if (badge) {
    if (habilitado) {
      const turmaNome = filterData.turmas.find(t => String(t.id) === String(turmaId))?.nome || '';
      badge.innerHTML = `<i class="bi bi-mortarboard"></i> Você é o Professor Conselheiro da turma <strong>${escapeHtml(turmaNome)}</strong>`;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }
}

function logFilterDiagnostics() {
  if (!filterData) return;
  const { series, turmas, componentes, professores, etapas, alocacoes, turnos } = filterData;
  const serieSet = new Set(series.map(s => s.id));
  const turmaSet = new Set(turmas.map(t => t.id));
  const withEtapa = series.filter(s => s.etapa_ensino_id != null).length;
  const withSerie = turmas.filter(t => t.serie_id != null).length;
  const turmaSerieValida = turmas.filter(t => serieSet.has(t.serie_id)).length;
  const alocTurmaOk = alocacoes.filter(a => a.turma_id != null).length;
  const alocCompOk = alocacoes.filter(a => a.componente_id != null).length;
  const alocProfOk = alocacoes.filter(a => a.professor_id != null).length;
  const alocTurmaValida = alocacoes.filter(a => turmaSet.has(a.turma_id)).length;
  console.group('[FilterPanel] diagnóstico de dados');
  console.log('etapas:', etapas.length, '| series:', series.length, `(com etapa_ensino_id: ${withEtapa}/${series.length})`);
  console.log('turmas:', turmas.length, `(com serie_id: ${withSerie}/${turmas.length}, série existe: ${turmaSerieValida}/${turmas.length})`);
  console.log('componentes:', componentes.length, '| professores:', professores.length);
  console.log('alocacoes:', alocacoes.length, `| turma ok: ${alocTurmaOk}, componente ok: ${alocCompOk}, professor ok: ${alocProfOk}, turma existe: ${alocTurmaValida}`);
  console.log('turnos:', turnos);
  console.groupEnd();
}
