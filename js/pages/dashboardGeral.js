import { $, showToast, formatNumber, formatPercent } from '../utils/helpers.js';
import { infoBtn, EXPLICACAO_RESULTADO } from '../utils/explanation.js';
import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { createBarChart, createDoughnutChart, destroyChart } from '../components/Charts.js';
import { getResumoGeral, getMediaPorSerie, getResultadoFinal, getDetalheResultados } from '../repositories/dashboardRepository.js';
import { supabaseQuery } from '../services/supabase.js';
import { gerarPdfRelatorio } from '../utils/pdf.js';

const MEDIA_CORTE = 6;

let detalheResultados = null;
let relFiltrosAtivos = [];

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Visão Geral da Escola</div>
    <div class="page-subtitle">Indicadores consolidados do desempenho acadêmico</div>

    <div id="filter-container-geral"></div>

    <div class="row g-4 mb-4" id="kpi-row">
      <div class="col-6 col-md-3">
        <div class="kpi-card primary">
          <div class="kpi-label">Estudantes</div>
          <div class="kpi-value"><span id="kpi-estudantes">—</span></div>
          <div class="kpi-icon"><i class="bi bi-people"></i></div>
          ${infoBtn('Estudantes', 'Quantidade de estudantes importados (cadastrados), considerando os filtros aplicados. Para o perfil Professor, apenas estudantes das suas turmas.')}
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card secondary">
          <div class="kpi-label">Turmas</div>
          <div class="kpi-value"><span id="kpi-turmas">—</span></div>
          <div class="kpi-icon"><i class="bi bi-building"></i></div>
          ${infoBtn('Turmas', 'Quantidade de turmas abrangidas pelos filtros selecionados. Para o perfil Professor, são consideradas apenas as suas turmas.')}
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card" id="kpi-media-card">
          <div class="kpi-label">Média Geral</div>
          <div class="kpi-value"><span id="kpi-media">—</span></div>
          <div class="kpi-icon"><i class="bi bi-graph-up"></i></div>
          ${infoBtn('Média Geral', 'Média aritmética das médias finais de cada estudante: soma das médias finais positivas dividida pelo número de estudantes.' + EXPLICACAO_RESULTADO)}
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card" id="kpi-freq-card">
          <div class="kpi-label">Frequência</div>
          <div class="kpi-value"><span id="kpi-frequencia">—</span></div>
          <div class="kpi-icon"><i class="bi bi-calendar-check"></i></div>
          ${infoBtn('Frequência', 'Média aritmética dos percentuais de frequência registrados nas tabelas de frequência, considerando os filtros aplicados.')}
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card success">
          <div class="kpi-label">Aprovação</div>
          <div class="kpi-value" style="color:var(--sieac-success)"><span id="kpi-aprovacao">—</span></div>
          <div class="kpi-icon"><i class="bi bi-check-circle"></i></div>
          ${infoBtn('Aprovação', 'Percentual de estudantes em que todos os resultados finais registrados indicaram aprovação.' + EXPLICACAO_RESULTADO)}
          <button class="btn btn-sm btn-outline-success kpi-pdf-btn no-print mt-2" data-tipo="aprovados">
            <i class="bi bi-file-earmark-pdf"></i> PDF
          </button>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card warning">
          <div class="kpi-label">Recuperação</div>
          <div class="kpi-value" style="color:var(--sieac-warning)"><span id="kpi-recuperacao">—</span></div>
          <div class="kpi-icon"><i class="bi bi-arrow-repeat"></i></div>
          ${infoBtn('Recuperação', 'Quantidade de estudantes com aprovação parcial: ao menos uma disciplina aprovada e ao menos uma reprovada.' + EXPLICACAO_RESULTADO)}
          <button class="btn btn-sm btn-outline-warning kpi-pdf-btn no-print mt-2" data-tipo="recuperacao">
            <i class="bi bi-file-earmark-pdf"></i> PDF
          </button>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card danger">
          <div class="kpi-label">Reprovação</div>
          <div class="kpi-value" style="color:var(--sieac-danger)"><span id="kpi-reprovacao">—</span></div>
          <div class="kpi-icon"><i class="bi bi-x-circle"></i></div>
          ${infoBtn('Reprovação', 'Percentual de estudantes sem nenhum resultado de aprovação. Estudantes com aprovação parcial são classificados como Recuperação.' + EXPLICACAO_RESULTADO)}
          <button class="btn btn-sm btn-outline-danger kpi-pdf-btn no-print mt-2" data-tipo="reprovados">
            <i class="bi bi-file-earmark-pdf"></i> PDF
          </button>
        </div>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-md-5">
        <div class="chart-card">
          <div class="chart-card-title">Distribuição dos Resultados Finais ${infoBtn('Distribuição dos Resultados Finais', 'Conta os estudantes pelo resultado final das notas (Aprovado, Reprovado ou Recuperação). Quando um estudante tem mais de um resultado, só é considerado Aprovado se todos forem de aprovação; aprovação parcial é contada como Recuperação.' + EXPLICACAO_RESULTADO)}</div>
          <div class="chart-container" style="height:320px;">
            <canvas id="chart-resultado-final"></canvas>
          </div>
        </div>
      </div>
      <div class="col-md-7">
        <div class="chart-card">
          <div class="chart-card-title">Média por Série ${infoBtn('Média por Série', 'Média aritmética das médias finais das notas, agrupadas pela série da turma de cada disciplina.')}</div>
          <div class="chart-container" style="height:320px;">
            <canvas id="chart-media-serie"></canvas>
          </div>
        </div>
      </div>
    </div>
  `;

  renderFilterPanel('filter-container-geral', () => loadData());
  document.querySelectorAll('.kpi-pdf-btn').forEach(btn => {
    btn.addEventListener('click', () => gerarPdfCard(btn.dataset.tipo));
  });
  await loadData();
}

async function loadData() {
  const filters = getFilters();
  const [resumo, detalhe] = await Promise.all([getResumoGeral(filters), getDetalheResultados(filters)]);
  detalheResultados = detalhe.data || null;
  relFiltrosAtivos = await montarFiltrosAtivos(filters);

  animateNumber('kpi-estudantes', resumo.total_estudantes);
  animateNumber('kpi-turmas', resumo.total_turmas);

  const mediaEl = document.getElementById('kpi-media');
  if (mediaEl) {
    mediaEl.textContent = resumo.media_geral;
    const card = document.getElementById('kpi-media-card');
    if (card) {
      if (resumo.media_geral >= MEDIA_CORTE) {
        card.style.borderLeftColor = 'var(--sieac-primary)';
        mediaEl.style.color = 'var(--sieac-primary)';
      } else if (resumo.media_geral >= 5) {
        card.style.borderLeftColor = 'var(--sieac-warning)';
        mediaEl.style.color = 'var(--sieac-warning)';
      } else {
        card.style.borderLeftColor = 'var(--sieac-danger)';
        mediaEl.style.color = 'var(--sieac-danger)';
      }
    }
  }

  const freqEl = document.getElementById('kpi-frequencia');
  if (freqEl) {
    freqEl.textContent = resumo.frequencia_media + '%';
    const card = document.getElementById('kpi-freq-card');
    if (card) {
      if (resumo.frequencia_media >= 90) {
        card.style.borderLeftColor = 'var(--sieac-success)';
      } else if (resumo.frequencia_media >= 75) {
        card.style.borderLeftColor = 'var(--sieac-primary)';
      } else {
        card.style.borderLeftColor = 'var(--sieac-danger)';
      }
    }
  }

  animateNumber('kpi-aprovacao', resumo.aprovacao_pct + '%');
  animateNumber('kpi-recuperacao', resumo.total_recuperacao);
  animateNumber('kpi-reprovacao', resumo.reprovacao_pct + '%');

  const resultado = await getResultadoFinal(filters);
  if (resultado.data) {
    const d = resultado.data;
    createDoughnutChart('chart-resultado-final',
      ['Aprovados', 'Reprovados', 'Recuperação'],
      [d.aprovados, d.reprovados, d.recuperacao],
      ['#2dc653', '#e63946', '#ffd000']
    );
  }

  const series = await getMediaPorSerie(filters);
  if (series.data && series.data.length) {
    createBarChart('chart-media-serie',
      series.data.map(d => d.serie),
      series.data.map(d => d.media),
      'Média'
    );
  } else {
    destroyChart('chart-media-serie');
  }
}

function animateNumber(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function montarFiltrosAtivos(filters) {
  if (!filters || !Object.keys(filters).length) return [];
  const ativos = [];
  if (filters.etapa_id) {
    const { data } = await supabaseQuery('etapas_ensino', { select: 'nome', filters: [{ col: 'id', val: filters.etapa_id }] });
    if (data && data[0]) ativos.push(`Etapa: ${data[0].nome}`);
  }
  if (filters.serie_id) {
    const { data } = await supabaseQuery('series', { select: 'nome', filters: [{ col: 'id', val: filters.serie_id }] });
    if (data && data[0]) ativos.push(`Série: ${data[0].nome}`);
  }
  if (filters.turma_id) {
    const { data } = await supabaseQuery('turmas', { select: 'nome', filters: [{ col: 'id', val: filters.turma_id }] });
    if (data && data[0]) ativos.push(`Turma: ${data[0].nome}`);
  }
  if (filters.turno) ativos.push(`Turno: ${filters.turno}`);
  if (filters.componente_id) {
    const { data } = await supabaseQuery('componentes_curriculares', { select: 'nome', filters: [{ col: 'id', val: filters.componente_id }] });
    if (data && data[0]) ativos.push(`Disciplina: ${data[0].nome}`);
  }
  if (filters.professor_id) {
    const { data } = await supabaseQuery('professores', { select: 'nome', filters: [{ col: 'id', val: filters.professor_id }] });
    if (data && data[0]) ativos.push(`Professor: ${data[0].nome}`);
  }
  return ativos;
}

function fmtNota(v) {
  const n = parseFloat(v);
  return isNaN(n) ? '-' : String(n.toFixed(1)).replace('.', ',');
}

function gerarPdfCard(tipo) {
  if (!detalheResultados) return;
  const conf = {
    aprovados: { titulo: 'APROVADOS — SIEAC', tabela: 'Aprovados', total: 'estudante(s) aprovado(s)' },
    recuperacao: { titulo: 'RECUPERAÇÃO — SIEAC', tabela: 'Em Recuperação', total: 'estudante(s) em recuperação' },
    reprovados: { titulo: 'REPROVADOS — SIEAC', tabela: 'Reprovados', total: 'estudante(s) reprovado(s)' },
  }[tipo];
  if (!conf) return;

  const linhas = detalheResultados[tipo] || [];
  const meta = [`Gerado em: ${new Date().toLocaleString('pt-BR')}`];
  if (relFiltrosAtivos.length) meta.push(`Filtros: ${relFiltrosAtivos.join(' | ')}`);

  gerarPdfRelatorio({
    titulo: conf.titulo,
    subtitulo: 'Sistema de Indicadores Educacionais Abel Coelho',
    meta,
    tabelas: [{
      titulo: `${conf.tabela} — Estudante, Turma, Disciplina e Notas`,
      colunas: ['Estudante', 'Matrícula', 'Turma', 'Disciplina', '1º Bim', '2º Bim', '3º Bim', '4º Bim', 'Média Final', 'Resultado'],
      linhas: linhas.map(l => [
        l.estudante,
        l.matricula,
        l.turma,
        l.disciplina,
        fmtNota(l.nota_1bim),
        fmtNota(l.nota_2bim),
        fmtNota(l.nota_3bim),
        fmtNota(l.nota_4bim),
        fmtNota(l.media_final),
        l.resultado_final,
      ]),
      colWidths: { 0: 34, 1: 16, 2: 14, 3: 34, 4: 7.5, 5: 7.5, 6: 7.5, 7: 7.5, 8: 11, 9: 13 },
      total: `Total — ${linhas.length} registro(s) de ${conf.total}`,
    }],
  });
}
