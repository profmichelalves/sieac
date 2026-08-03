import { showToast } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { isProfessor } from '../services/authService.js';
import { listarEstudantesNEE } from '../repositories/necessidadesRepository.js';
import { gerarPdfRelatorio } from '../utils/pdf.js';

let listaNee = [];

export async function render() {
  const main = document.getElementById('main-content');
  const professor = isProfessor();

  main.innerHTML = `
    <div class="page-title">Relatório de Estudantes NEE</div>
    <div class="page-subtitle">Estudantes com necessidades educacionais especiais e professor de AEE</div>

    <div class="card-sieac">
      <div class="card-sieac-header">
        <span>Estudantes com NEE ${infoBtn('Estudantes NEE', 'Lista todos os estudantes com pelo menos uma necessidade educacional especial cadastrada, com a respectiva turma e o professor de AEE responsável (quando informado). Professores visualizam apenas os estudantes das suas turmas.')}</span>
        <button class="btn btn-sm btn-primary no-print" id="btn-pdf-nee" style="border-radius:var(--sieac-radius-pill);padding:6px 16px;font-size:0.8rem;${professor ? 'display:none;' : ''}">
          <i class="bi bi-file-earmark-pdf"></i> Gerar PDF
        </button>
      </div>
      <div class="card-sieac-body">
        <div class="student-turma-count" id="contagem-nee" style="color:var(--sieac-text-muted);font-size:0.85rem;margin-bottom:10px;"></div>
        <div class="table-responsive-custom">
          <table class="table-sieac" id="table-nee">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Matrícula</th>
                <th>Turma</th>
                <th>Necessidades</th>
                <th>Professor AEE</th>
              </tr>
            </thead>
            <tbody id="tbody-nee">
              <tr><td colspan="5" style="text-align:center;color:var(--sieac-text-muted);">Carregando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-pdf-nee')?.addEventListener('click', gerarPdf);

  listaNee = await listarEstudantesNEE();
  renderTabela();
}

export function unload() {
  listaNee = [];
}

function renderTabela() {
  const tbody = document.getElementById('tbody-nee');
  if (!tbody) return;

  const contagem = document.getElementById('contagem-nee');
  if (contagem) contagem.textContent = `${listaNee.length} estudante(s) com NEE`;

  if (!listaNee.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--sieac-text-muted);">Nenhum estudante com NEE encontrado para o seu perfil</td></tr>';
    return;
  }

  tbody.innerHTML = listaNee.map(e => `
    <tr>
      <td><strong>${e.nome}</strong></td>
      <td>${e.matricula}</td>
      <td>${e.turmas.join(', ') || '-'}</td>
      <td>${e.necessidades.map(n => `<span class="badge badge-sieac-secondary" style="margin:2px 4px 2px 0;">${n}</span>`).join('')}</td>
      <td>${e.professorAee ? e.professorAee.nome : '<span style="color:var(--sieac-text-muted);">Não informado</span>'}</td>
    </tr>
  `).join('');
}

function gerarPdf() {
  if (!listaNee.length) {
    showToast('Nenhum registro para gerar PDF', 'warning');
    return;
  }

  const linhas = listaNee.map(e => [
    e.nome,
    e.matricula,
    e.turmas.join(', ') || '-',
    e.necessidades.join('; '),
    e.professorAee ? e.professorAee.nome : 'Não informado',
  ]);

  gerarPdfRelatorio({
    titulo: 'RELATÓRIO DE ESTUDANTES NEE — SIEAC',
    subtitulo: 'Sistema de Indicadores Educacionais Abel Coelho',
    meta: [
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      `Total de estudantes com NEE: ${listaNee.length}`,
    ],
    tabelas: [
      {
        titulo: 'Estudantes com Necessidades Educacionais Especiais',
        colunas: ['Nome', 'Matrícula', 'Turma', 'Necessidades', 'Professor AEE'],
        linhas,
        colWidths: { 0: 45, 1: 22, 2: 18, 3: 35, 4: 40 },
        total: `Total: ${listaNee.length} estudante(s)`,
      },
    ],
  });
}
