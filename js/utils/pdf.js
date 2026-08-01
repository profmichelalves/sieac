import { registrarLog, LOG_ACTIONS } from '../services/logService.js';

const MARGIN = 8;
const HEADER_COLOR = [26, 42, 58];
const CORES_BOLA = {
  red: [229, 57, 53],
  orange: [255, 152, 0],
  yellow: [255, 213, 0],
};

function novoDoc() {
  const { jsPDF } = window.jspdf;
  return new jsPDF({ unit: 'mm', format: 'a4' });
}

function desenharCabecalho(doc, titulo, subtitulo, meta) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(HEADER_COLOR[0], HEADER_COLOR[1], HEADER_COLOR[2]);
  doc.rect(0, 0, pageW, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(titulo, MARGIN, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(subtitulo, MARGIN, 14);
  let y = 25;
  if (meta && meta.length) {
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);
    const metaText = doc.splitTextToSize(meta.join('  |  '), pageW - (MARGIN * 2));
    doc.text(metaText, MARGIN, y);
    y += metaText.length * 3 + 1;
  }
  return y;
}

function adicionarTabela(doc, tabela, startY) {
  let y = startY;
  const { titulo = '', colunas = [], linhas = [], colWidths = {}, total = '', bolas = [] } = tabela;
  if (titulo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(HEADER_COLOR[0], HEADER_COLOR[1], HEADER_COLOR[2]);
    doc.text(titulo, MARGIN, y);
    y += 4;
  }
  if (linhas.length && colunas.length) {
    doc.autoTable({
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: 30, bottom: 12 },
      head: [colunas],
      body: linhas,
      styles: { font: 'helvetica', fontSize: 6.5, cellPadding: 1.1, textColor: [40, 40, 40], lineColor: [200, 200, 200], lineWidth: 0.1, overflow: 'linebreak' },
      headStyles: { fillColor: HEADER_COLOR, textColor: [255, 255, 255], fontSize: 6.8, fontStyle: 'bold', cellPadding: 1.6 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: colWidths,
      showHead: 'everyPage',
      theme: 'grid',
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0 && bolas[data.row.index]) {
          const cor = CORES_BOLA[bolas[data.row.index]];
          if (cor) {
            const cx = data.cell.x + data.cell.width / 2;
            const cy = data.cell.y + data.cell.height / 2;
            doc.setFillColor(cor[0], cor[1], cor[2]);
            doc.circle(cx, cy, 1.4, 'F');
          }
        }
      },
      didDrawPage: () => {
        const pageH = doc.internal.pageSize.getHeight();
        const pageW = doc.internal.pageSize.getWidth();
        const info = doc.internal.getCurrentPageInfo();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(130, 130, 130);
        doc.text(`Página ${info.pageNumber}`, pageW - MARGIN, pageH - 6, { align: 'right' });
      },
    });
    y = doc.lastAutoTable.finalY + 4;
    if (total) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(HEADER_COLOR[0], HEADER_COLOR[1], HEADER_COLOR[2]);
      doc.text(total, MARGIN, y);
      y += 4;
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Nenhum registro encontrado.', MARGIN, y);
    y += 5;
  }
  return y;
}

export function gerarPdfRelatorio({ titulo, subtitulo, meta = [], tabelas = [] }) {
  registrarLog(LOG_ACTIONS.GERAR_PDF, { titulo, subtitulo, meta });
  const doc = novoDoc();
  let y = desenharCabecalho(doc, titulo, subtitulo, meta);
  tabelas.forEach(tabela => {
    y = adicionarTabela(doc, tabela, y + 2);
  });
  const url = doc.output('bloburl');
  const href = (url && url.href) ? url.href : url;
  window.open(href, '_blank');
}
