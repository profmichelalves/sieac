import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { supabaseFetchAll, supabaseQuery } from '../services/supabase.js';

const MEDIA_CORTE = 6;

let relLinhas = [];
let relSortKey = 'disciplina';
let relDataHora = '';
let relFiltros = [];

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <style>
      .report-toolbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
      .report-toolbar-label {
        font-size:0.85rem; color:var(--sieac-text-muted);
        display:inline-flex; align-items:center; gap:6px;
      }
      .sort-btn {
        border-radius:var(--sieac-radius-pill) !important;
        font-size:0.8rem !important; padding:4px 16px !important;
      }
    </style>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div>
        <div class="page-title">Relatório de Notas</div>
        <div class="page-subtitle">Alunos abaixo da média — nota de corte ${MEDIA_CORTE}</div>
      </div>
      <button class="btn btn-primary no-print" id="btn-gerar-pdf">
        <i class="bi bi-file-earmark-pdf"></i> Gerar PDF
      </button>
    </div>

    <div id="filter-container-relatorios" class="no-print"></div>

    <div class="report-toolbar no-print">
      <span class="report-toolbar-label"><i class="bi bi-sort-down"></i> Ordenar por:</span>
      <button class="btn btn-sm btn-primary sort-btn" data-sort="disciplina">Disciplina</button>
      <button class="btn btn-sm btn-outline-secondary sort-btn" data-sort="turma">Turma</button>
      <button class="btn btn-sm btn-outline-secondary sort-btn" data-sort="aluno">Aluno</button>
    </div>
  `;

  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      relSortKey = btn.dataset.sort;
      document.querySelectorAll('.sort-btn').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline-secondary');
      });
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-outline-secondary');
    });
  });

  document.getElementById('btn-gerar-pdf').addEventListener('click', gerarPDF);

  renderFilterPanel('filter-container-relatorios', () => loadData());
  await loadData();
}

async function getCache() {
  const [s, t, c, a, e] = await Promise.all([
    supabaseQuery('series', { select: 'id,nome,etapa_ensino_id' }),
    supabaseQuery('turmas', { select: 'id,nome,serie_id,turno' }),
    supabaseQuery('componentes_curriculares', { select: 'id,nome' }),
    supabaseQuery('alocacoes', { select: 'id,turma_id,componente_id,professor_id' }),
    supabaseQuery('estudantes', { select: 'id,nome,matricula' }),
  ]);
  return {
    series: s.data || [],
    turmas: t.data || [],
    componentes: c.data || [],
    alocacoes: a.data || [],
    estudantes: e.data || [],
  };
}

function aplicarFiltros(notas, filters, cache) {
  if (!filters || !Object.keys(filters).length) return notas;
  let alocIds = new Set(cache.alocacoes.map(a => a.id));
  if (filters.etapa_id) {
    const serieIds = new Set(cache.series.filter(s => s.etapa_ensino_id == filters.etapa_id).map(s => s.id));
    const tIds = new Set(cache.turmas.filter(t => serieIds.has(t.serie_id)).map(t => t.id));
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.some(a => a.id === id && tIds.has(a.turma_id))));
  }
  if (filters.serie_id) {
    const tIds = new Set(cache.turmas.filter(t => t.serie_id == filters.serie_id).map(t => t.id));
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.some(a => a.id === id && tIds.has(a.turma_id))));
  }
  if (filters.turma_id) {
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.some(a => a.id === id && a.turma_id == filters.turma_id)));
  }
  if (filters.turno) {
    const tIds = new Set(cache.turmas.filter(t => t.turno == filters.turno).map(t => t.id));
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.some(a => a.id === id && tIds.has(a.turma_id))));
  }
  if (filters.componente_id) {
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.some(a => a.id === id && a.componente_id == filters.componente_id)));
  }
  if (filters.professor_id) {
    alocIds = new Set([...alocIds].filter(id => cache.alocacoes.some(a => a.id === id && a.professor_id == filters.professor_id)));
  }
  return notas.filter(n => alocIds.has(n.alocacao_id));
}

async function loadData() {
  const filters = getFilters();
  const cache = await getCache();

  relDataHora = new Date().toLocaleString('pt-BR');
  const filtrosAtivos = [];
  if (filters.etapa_id) {
    const { data: etapas } = await supabaseQuery('etapas_ensino', { select: 'nome', filters: [{ col: 'id', val: filters.etapa_id }] });
    if (etapas && etapas[0]) filtrosAtivos.push(`Etapa: ${etapas[0].nome}`);
  }
  if (filters.serie_id) {
    const { data: s } = await supabaseQuery('series', { select: 'nome', filters: [{ col: 'id', val: filters.serie_id }] });
    if (s && s[0]) filtrosAtivos.push(`Série: ${s[0].nome}`);
  }
  if (filters.turma_id) {
    const t = cache.turmas.find(x => x.id == filters.turma_id);
    if (t) filtrosAtivos.push(`Turma: ${t.nome}`);
  }
  if (filters.turno) filtrosAtivos.push(`Turno: ${filters.turno}`);
  if (filters.componente_id) {
    const c = cache.componentes.find(x => x.id == filters.componente_id);
    if (c) filtrosAtivos.push(`Disciplina: ${c.nome}`);
  }
  if (filters.professor_id) {
    const { data: profs } = await supabaseQuery('professores', { select: 'nome', filters: [{ col: 'id', val: filters.professor_id }] });
    if (profs && profs[0]) filtrosAtivos.push(`Professor: ${profs[0].nome}`);
  }
  relFiltros = filtrosAtivos;

  const { data: notas } = await supabaseFetchAll('notas', { select: 'estudante_id,media_final,alocacao_id' });
  const filtradas = aplicarFiltros(notas || [], filters, cache);

  const alocComp = {}; cache.alocacoes.forEach(a => alocComp[a.id] = a.componente_id);
  const alocTurma = {}; cache.alocacoes.forEach(a => alocTurma[a.id] = a.turma_id);
  const compMap = {}; cache.componentes.forEach(c => compMap[c.id] = c.nome);
  const turmaMap = {}; cache.turmas.forEach(t => turmaMap[t.id] = t.nome);
  const estMap = {}; cache.estudantes.forEach(e => estMap[e.id] = e);

  const linhas = filtradas.map(n => {
    const mf = parseFloat(n.media_final);
    if (isNaN(mf) || mf <= 0 || mf >= MEDIA_CORTE) return null;
    const cId = alocComp[n.alocacao_id];
    const tId = alocTurma[n.alocacao_id];
    const estudante = estMap[n.estudante_id];
    if (!cId || !tId || !estudante) return null;
    return {
      estudante_id: n.estudante_id,
      disciplina: compMap[cId] || `Disciplina ${cId}`,
      turma: turmaMap[tId] || `Turma ${tId}`,
      aluno: estudante.nome,
      matricula: estudante.matricula || '-',
      media_final: mf,
    };
  }).filter(Boolean);

  relLinhas = linhas;
}

function ordenarLinhas(linhas, sortKey) {
  const secundarias = {
    disciplina: ['turma', 'aluno'],
    turma: ['disciplina', 'aluno'],
    aluno: ['disciplina', 'turma'],
  };
  const chaves = [sortKey, ...(secundarias[sortKey] || [])];
  return [...linhas].sort((a, b) => {
    for (const k of chaves) {
      const c = String(a[k] || '').localeCompare(String(b[k] || ''), 'pt-BR');
      if (c) return c;
    }
    return 0;
  });
}

function gerarPDF() {
  if (!relLinhas.length) {
    alert('Nenhum aluno abaixo da média para os filtros selecionados.');
    return;
  }
  const ordenadas = ordenarLinhas(relLinhas, relSortKey);
  const totalAlunos = new Set(relLinhas.map(l => l.estudante_id)).size;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 8;

  doc.setFillColor(26, 42, 58);
  doc.rect(0, 0, pageW, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('RELATÓRIO DE NOTAS — SIEAC', margin, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Sistema de Indicadores Educacionais Abel Coelho', margin, 14);

  const meta = `Gerado em: ${relDataHora}  |  Nota de corte: ${MEDIA_CORTE}` + (relFiltros.length ? `  |  Filtros: ${relFiltros.join(' | ')}` : '');
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text(meta, margin, 25);

  doc.autoTable({
    startY: 29,
    margin: { left: margin, right: margin, top: 30, bottom: 12 },
    head: [['Disciplina', 'Turma', 'Aluno', 'Matrícula', 'Média Final']],
    body: ordenadas.map(l => [l.disciplina, l.turma, l.aluno, l.matricula, l.media_final.toFixed(1)]),
    styles: { font: 'helvetica', fontSize: 6.5, cellPadding: 1.1, textColor: [40, 40, 40], lineColor: [200, 200, 200], lineWidth: 0.1, overflow: 'linebreak' },
    headStyles: { fillColor: [26, 42, 58], textColor: [255, 255, 255], fontSize: 6.8, fontStyle: 'bold', cellPadding: 1.6 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 22 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
    },
    showHead: 'everyPage',
    theme: 'grid',
    didDrawPage: (data) => {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(130, 130, 130);
      doc.text(`Página ${doc.internal.getCurrentPageInfo().pageNumber} de ${doc.internal.getNumberOfPages()}`, pageW - margin, pageH - 6, { align: 'right' });
    },
  });

  const finalY = doc.lastAutoTable.finalY + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(26, 42, 58);
  doc.text(`Total — ${totalAlunos} aluno(s) abaixo da média`, margin, finalY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text(`${ordenadas.length} registro(s)`, pageW - margin, finalY, { align: 'right' });

  doc.save('relatorio-notas.pdf');
}
