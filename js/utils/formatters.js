export function formatMedia(val) {
  if (val === null || val === undefined || val === '-') return '-';
  const n = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
  return isNaN(n) ? '-' : n.toFixed(1);
}

export function formatFrequencia(val) {
  if (val === null || val === undefined) return '-';
  const n = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
  return isNaN(n) ? '-' : n.toFixed(0) + '%';
}

export function formatResultado(resultado, mediaFinal) {
  if (!resultado) return { label: 'N/I', class: 'bg-secondary' };
  const r = resultado.toUpperCase().trim();

  if (r === 'APROVADO' || (mediaFinal && mediaFinal >= 6)) {
    return { label: 'Aprovado', class: 'badge-sieac-success' };
  }
  if (r === 'REPROVADO' || (mediaFinal && mediaFinal < 6)) {
    return { label: 'Reprovado', class: 'badge-sieac-danger' };
  }
  if (r === 'RECUPERAÇÃO' || r === 'EXAME FINAL') {
    return { label: 'Recuperação', class: 'badge-sieac-warning' };
  }
  return { label: 'Matriculado', class: 'badge-sieac-primary' };
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR');
}

export function getFaixaDesempenho(media) {
  if (media === null || media === undefined) return 'Sem nota';
  if (media >= 8) return 'Excelente';
  if (media >= 6) return 'Bom';
  if (media >= 4) return 'Regular';
  return 'Crítico';
}

export function getFaixaFrequencia(freq) {
  if (freq === null || freq === undefined) return 'Sem dados';
  if (freq >= 90) return 'Excelente';
  if (freq >= 75) return 'Adequada';
  if (freq >= 50) return 'Alerta';
  return 'Crítico';
}
