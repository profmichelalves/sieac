const KEY = 'sieac_estudante_filtros';
const VER = 1;

export function loadEstudanteFiltros() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.v === VER) {
        return { turmaId: p.turmaId || '', estudanteId: p.estudanteId || null };
      }
      localStorage.removeItem(KEY);
    }
  } catch {}
  return { turmaId: '', estudanteId: null };
}

export function saveEstudanteFiltros({ turmaId = '', estudanteId = null } = {}) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VER, turmaId: turmaId || '', estudanteId: estudanteId || null }));
  } catch {}
}

export function clearEstudanteFiltros() {
  try { localStorage.removeItem(KEY); } catch {}
}
