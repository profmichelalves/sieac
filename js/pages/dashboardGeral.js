import { $, showToast, formatNumber, formatPercent } from '../utils/helpers.js';
import { infoBtn, EXPLICACAO_RESULTADO, termosSituacao } from '../utils/explanation.js';
import { renderFilterPanel, getFilters } from '../components/FilterPanel.js';
import { createBarChart, createDoughnutChart, destroyChart } from '../components/Charts.js';
import { getResumoGeral, getMediaPorSerie, getResultadoFinal, getDetalheResultados, getDetalheSituacao } from '../repositories/dashboardRepository.js';
import { supabaseQuery } from '../services/supabase.js';
import { gerarPdfRelatorio } from '../utils/pdf.js';

const MEDIA_CORTE = 6;

let detalheResultados = null;
let detalheSituacao = null;
let relFiltrosAtivos = [];
let periodoLetivo = 'parcial';

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
          ${infoBtn('Média Geral', 'Média aritmética das médias finais de cada estudante: soma das médias finais dividida pelo número de estudantes. Estudantes sem nenhuma nota lançada em uma disciplina são considerados com média 0.' + EXPLICACAO_RESULTADO)}
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
        <div class="kpi-card success" id="kpi-card-aprovacao">
          <div class="kpi-label" id="kpi-aprovacao-label">Aprovação</div>
          <div class="kpi-value" style="color:var(--sieac-success)">
            <span class="kpi-percent" id="kpi-aprovacao">—</span>
            <span class="kpi-count" id="kpi-aprovacao-count"></span>
          </div>
          <div class="kpi-icon"><i class="bi bi-check-circle"></i></div>
          ${infoBtn('Aprovação', 'Percentual de estudantes aprovados, calculado sobre o total de estudantes importados: nenhuma disciplina com média inferior a 6,0 e frequência ≥ 75%. Estudantes com frequência < 75% ou mais de 6 disciplinas com média inferior a 6,0 são contados como reprovados.' + EXPLICACAO_RESULTADO)}
          <button class="btn btn-sm btn-outline-success kpi-pdf-btn no-print mt-2" data-tipo="aprovados">
            <i class="bi bi-file-earmark-pdf"></i> PDF
          </button>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card warning" id="kpi-card-recuperacao">
          <div class="kpi-label" id="kpi-recuperacao-label">Recuperação</div>
          <div class="kpi-value" style="color:var(--sieac-warning)">
            <span class="kpi-percent" id="kpi-recuperacao">—</span>
            <span class="kpi-count" id="kpi-recuperacao-count"></span>
          </div>
          <div class="kpi-icon"><i class="bi bi-arrow-repeat"></i></div>
          ${infoBtn('Recuperação', 'Percentual de estudantes em recuperação, calculado sobre o total de estudantes importados: 1 a 6 disciplinas com média inferior a 6,0 e frequência ≥ 75%, participando das atividades de recuperação previstas. Frequência < 75% é contada como reprovação.' + EXPLICACAO_RESULTADO)}
          <button class="btn btn-sm btn-outline-warning kpi-pdf-btn no-print mt-2" data-tipo="recuperacao">
            <i class="bi bi-file-earmark-pdf"></i> PDF
          </button>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card danger" id="kpi-card-reprovacao">
          <div class="kpi-label" id="kpi-reprovacao-label">Reprovação</div>
          <div class="kpi-value" style="color:var(--sieac-danger)">
            <span class="kpi-percent" id="kpi-reprovacao">—</span>
            <span class="kpi-count" id="kpi-reprovacao-count"></span>
          </div>
          <div class="kpi-icon"><i class="bi bi-x-circle"></i></div>
          ${infoBtn('Reprovação', 'Percentual de estudantes reprovados, calculado sobre o total de estudantes importados: frequência média < 75% ou mais de 6 disciplinas com média inferior a 6,0.' + EXPLICACAO_RESULTADO)}
          <button class="btn btn-sm btn-outline-danger kpi-pdf-btn no-print mt-2" data-tipo="reprovados">
            <i class="bi bi-file-earmark-pdf"></i> PDF
          </button>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card secondary" id="kpi-card-semnotas">
          <div class="kpi-label" id="kpi-semnotas-label">Sem Notas Lançadas</div>
          <div class="kpi-value" style="color:var(--sieac-secondary)">
            <span class="kpi-percent" id="kpi-semnotas">—</span>
            <span class="kpi-count" id="kpi-semnotas-count"></span>
          </div>
          <div class="kpi-icon"><i class="bi bi-journal-x"></i></div>
          ${infoBtn('Sem Notas Lançadas', 'Estudantes importados com alguma disciplina sem nota lançada (nenhuma nota nos bimestres nem média final), considerando os filtros aplicados. Não entram na classificação de Aprovação, Recuperação ou Reprovação. Percentual calculado sobre o total de estudantes importados. O relatório PDF lista cada estudante com as disciplinas sem nota, informando turma e professor.' + EXPLICACAO_RESULTADO)}
          <button class="btn btn-sm btn-outline-secondary kpi-pdf-btn no-print mt-2" data-tipo="semnotas">
            <i class="bi bi-file-earmark-pdf"></i> PDF
          </button>
        </div>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-md-5">
        <div class="chart-card" id="card-resultado">
          <div class="chart-card-title"><span id="chart-resultado-titulo">Distribuição dos Resultados Finais</span> ${infoBtn('Distribuição dos Resultados Finais', 'Classifica os estudantes pela frequência e pelo número de disciplinas com média inferior a 6,0: Aprovado (nenhuma disciplina abaixo e frequência ≥ 75%), Recuperação (1 a 6 disciplinas abaixo com frequência ≥ 75%) e Reprovado (frequência < 75% ou mais de 6 disciplinas abaixo).' + EXPLICACAO_RESULTADO)}</div>
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

  await renderFilterPanel('filter-container-geral', () => loadData());
  document.querySelectorAll('.kpi-pdf-btn').forEach(btn => {
    btn.addEventListener('click', () => gerarPdfCard(btn.dataset.tipo));
  });
  await loadData();
}

async function loadData() {
  const filters = getFilters();
  const [resumo, detalhe, situacao] = await Promise.all([
    getResumoGeral(filters),
    getDetalheResultados(filters),
    getDetalheSituacao(filters),
  ]);
  detalheResultados = detalhe.data || null;
  detalheSituacao = situacao.data || null;
  relFiltrosAtivos = await montarFiltrosAtivos(filters);

  periodoLetivo = resumo.periodo || 'parcial';
  atualizarNomenclatura(periodoLetivo);

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

  animateNumber('kpi-aprovacao', formatPercent(resumo.aprovacao_pct));
  animateNumber('kpi-aprovacao-count', `${resumo.total_aprovacao} estudantes`);
  animateNumber('kpi-recuperacao', formatPercent(resumo.recuperacao_pct));
  animateNumber('kpi-recuperacao-count', `${resumo.total_recuperacao} estudantes`);
  animateNumber('kpi-reprovacao', formatPercent(resumo.reprovacao_pct));
  animateNumber('kpi-reprovacao-count', `${resumo.total_reprovacao} estudantes`);
  animateNumber('kpi-semnotas', formatPercent(resumo.sem_notas_pct));
  animateNumber('kpi-semnotas-count', `${resumo.sem_notas} estudantes`);

  const resultado = await getResultadoFinal(filters);
  if (resultado.data) {
    const d = resultado.data;
    const termos = termosSituacao(periodoLetivo);
    createDoughnutChart('chart-resultado-final',
      [termos.label.aprovado, termos.label.reprovado, termos.label.recuperacao, 'Sem Notas Lançadas'],
      [d.aprovados, d.reprovados, d.recuperacao, d.sem_notas],
      ['#2dc653', '#e63946', '#ffd000', '#adb5bd']
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

function textosKpi(periodo) {
  if (periodo === 'anual') {
    return {
      aprovacao: 'Percentual de estudantes aprovados, calculado sobre o total de estudantes importados: nenhuma disciplina com média anual inferior a 6,0 e frequência ≥ 75%. Estudantes com frequência < 75% ou mais de 6 disciplinas com média inferior a 6,0 são contados como reprovados. Estudantes sem nenhuma nota lançada ficam no card "Sem Notas Lançadas" e não entram nessa classificação. O relatório PDF lista esses mesmos estudantes — uma linha por estudante, com Média Geral, Menor Média e Maior Média.',
      recuperacao: 'Percentual de estudantes em recuperação, calculado sobre o total de estudantes importados: 1 a 6 disciplinas com média anual inferior a 6,0 e frequência ≥ 75%, participando das atividades de recuperação previstas. Frequência < 75% é contada como reprovação. Estudantes sem nenhuma nota lançada ficam no card "Sem Notas Lançadas" e não entram nessa classificação. O relatório PDF lista esses mesmos estudantes — uma linha por estudante, classificada por gravidade: 🟡 1 a 2 disciplinas, 🟠 3 a 4 disciplinas e 🔴 5 a 6 disciplinas.',
      reprovacao: 'Percentual de estudantes reprovados, calculado sobre o total de estudantes importados: frequência média < 75% ou mais de 6 disciplinas com média anual inferior a 6,0. Estudantes sem nenhuma nota lançada ficam no card "Sem Notas Lançadas" e não entram nessa classificação. O relatório PDF lista esses mesmos estudantes — uma linha por estudante, classificada por gravidade: 🟡 mais de 6 disciplinas com frequência ≥ 75%, 🟠 frequência < 75% ou mais de 8 disciplinas e 🔴 frequência < 75% e mais de 6 disciplinas.',
      semNotas: 'Percentual de estudantes importados com alguma disciplina sem nota lançada, calculado sobre o total de estudantes importados. Eles não entram na classificação de Aprovação, Recuperação ou Reprovação. O relatório PDF lista cada estudante com as disciplinas sem nota, informando turma e professor.',
    };
  }
  return {
    aprovacao: 'Percentual de estudantes em aprovação até o momento, calculado sobre o total de estudantes importados: nenhuma disciplina com média acumulada inferior a 6,0 e frequência ≥ 75%. Estudantes com frequência < 75% ou mais de 6 disciplinas com média acumulada inferior a 6,0 são contados como reprovados. Estudantes sem nenhuma nota lançada ficam no card "Sem Notas Lançadas" e não entram nessa classificação. O relatório PDF lista esses mesmos estudantes — uma linha por estudante, com Média Geral, Menor Média e Maior Média, ordenado pela Menor Média.',
    recuperacao: 'Percentual de estudantes em recuperação até o momento, calculado sobre o total de estudantes importados: 1 a 6 disciplinas com média acumulada inferior a 6,0 e frequência ≥ 75%, acompanhando os conteúdos ainda em andamento. Frequência < 75% é contada como reprovação. Estudantes sem nenhuma nota lançada ficam no card "Sem Notas Lançadas" e não entram nessa classificação. O relatório PDF lista esses mesmos estudantes — uma linha por estudante, classificada por gravidade: 🟡 1 a 2 disciplinas, 🟠 3 a 4 disciplinas e 🔴 5 a 6 disciplinas.',
    reprovacao: 'Percentual de estudantes que estão sendo reprovados até o momento, calculado sobre o total de estudantes importados: frequência média < 75% ou mais de 6 disciplinas com média acumulada inferior a 6,0. Estudantes sem nenhuma nota lançada ficam no card "Sem Notas Lançadas" e não entram nessa classificação. O relatório PDF lista esses mesmos estudantes — uma linha por estudante, classificada por gravidade: 🟡 mais de 6 disciplinas com frequência ≥ 75%, 🟠 frequência < 75% ou mais de 8 disciplinas e 🔴 frequência < 75% e mais de 6 disciplinas.',
    semNotas: 'Percentual de estudantes importados com alguma disciplina sem nota lançada até o momento, calculado sobre o total de estudantes importados. Eles não entram na classificação de Aprovação, Recuperação ou Reprovação. O relatório PDF lista cada estudante com as disciplinas sem nota, informando turma e professor.',
  };
}

function atualizarNomenclatura(periodo) {
  const termos = termosSituacao(periodo);
  const textos = textosKpi(periodo);

  const aplicar = (labelId, cardId, titulo, texto) => {
    const label = document.getElementById(labelId);
    if (label) label.textContent = titulo;
    const card = document.getElementById(cardId);
    const infoBtnEl = card && card.querySelector('.info-btn');
    if (infoBtnEl) {
      infoBtnEl.dataset.infoTitulo = titulo;
      infoBtnEl.dataset.info = texto + EXPLICACAO_RESULTADO;
    }
  };

  aplicar('kpi-aprovacao-label', 'kpi-card-aprovacao', termos.card.aprovado, textos.aprovacao);
  aplicar('kpi-recuperacao-label', 'kpi-card-recuperacao', termos.card.recuperacao, textos.recuperacao);
  aplicar('kpi-reprovacao-label', 'kpi-card-reprovacao', termos.card.reprovado, textos.reprovacao);
  aplicar('kpi-semnotas-label', 'kpi-card-semnotas', 'Sem Notas Lançadas', textos.semNotas);

  const tituloChart = document.getElementById('chart-resultado-titulo');
  if (tituloChart) tituloChart.textContent = termos.tituloGrafico;
  const cardChart = document.getElementById('card-resultado');
  const infoChart = cardChart && cardChart.querySelector('.info-btn');
  if (infoChart) {
    infoChart.dataset.infoTitulo = termos.tituloGrafico;
    infoChart.dataset.info = termos.explicacaoGrafico + EXPLICACAO_RESULTADO;
  }
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
  const termos = termosSituacao(periodoLetivo);
  const conf = {
    aprovados: {
      titulo: `${termos.card.aprovado.toUpperCase()} — SIEAC`,
      tabela: termos.label.aprovado,
      total: periodoLetivo === 'anual' ? 'estudante(s) aprovado(s)' : 'estudante(s) em aprovação',
    },
    recuperacao: {
      titulo: `${termos.card.recuperacao.toUpperCase()} — SIEAC`,
      tabela: termos.label.recuperacao,
      total: 'estudante(s) em recuperação',
    },
    reprovados: {
      titulo: `${termos.card.reprovado.toUpperCase()} — SIEAC`,
      tabela: termos.label.reprovado,
      total: periodoLetivo === 'anual' ? 'estudante(s) reprovado(s)' : 'estudante(s) em reprovação',
    },
    semnotas: {
      titulo: 'SEM NOTAS LANÇADAS — SIEAC',
      tabela: 'Sem Notas Lançadas',
      total: 'estudante(s) sem notas lançadas',
    },
  }[tipo];
  if (!conf) return;

  const meta = [`Gerado em: ${new Date().toLocaleString('pt-BR')}`];
  if (relFiltrosAtivos.length) meta.push(`Filtros: ${relFiltrosAtivos.join(' | ')}`);

  if (tipo === 'aprovados') {
    const lista = detalheSituacao?.aprovados || [];
    gerarPdfRelatorio({
      titulo: conf.titulo,
      subtitulo: 'Sistema de Indicadores Educacionais Abel Coelho',
      meta,
      tabelas: [{
        titulo: `${conf.tabela} — Média Geral, Menor e Maior Média`,
        colunas: ['Estudante', 'Matrícula', 'Turma', 'Frequência (%)', 'Média Geral', 'Menor Média', 'Maior Média'],
        linhas: lista.map(l => [
          l.estudante,
          l.matricula,
          l.turma,
          l.frequencia != null ? l.frequencia + '%' : '-',
          fmtNota(l.mediaGeral),
          fmtNota(l.menor),
          fmtNota(l.maior),
        ]),
        colWidths: { 0: 40, 1: 20, 2: 25, 3: 16, 4: 16, 5: 16, 6: 16 },
        total: `Total — ${lista.length} ${conf.total}`,
      }],
    });
    return;
  }

  if (tipo === 'semnotas') {
    const lista = detalheSituacao?.semNotas || [];
    gerarPdfRelatorio({
      titulo: conf.titulo,
      subtitulo: 'Sistema de Indicadores Educacionais Abel Coelho',
      meta,
      tabelas: [{
        titulo: `${conf.tabela} — Estudantes e Disciplinas sem Notas`,
        colunas: ['Estudante', 'Matrícula', 'Turma', 'Disciplina', 'Professor'],
        linhas: lista.map(l => [
          l.estudante,
          l.matricula,
          l.turma,
          l.disciplina,
          l.professor,
        ]),
        colWidths: { 0: 34, 1: 18, 2: 22, 3: 30, 4: 28 },
        total: `Total — ${lista.length} ${conf.total}`,
      }],
    });
    return;
  }

  const lista = tipo === 'recuperacao'
    ? (detalheSituacao?.recuperacao || [])
    : (detalheSituacao?.reprovados || []);

  gerarPdfRelatorio({
    titulo: conf.titulo,
    subtitulo: 'Sistema de Indicadores Educacionais Abel Coelho',
    meta,
    tabelas: [{
      titulo: `${conf.tabela} — Estudante e Disciplinas em Recuperação`,
      colunas: ['Estudante', 'Matrícula', 'Turma', 'Frequência (%)', 'Qtde.', 'Disciplinas em Recuperação'],
      linhas: lista.map(l => [
        l.estudante,
        l.matricula,
        l.turma,
        l.frequencia != null ? l.frequencia + '%' : '-',
        String(l.qtd),
        l.disciplinas.map(d => `${d.nome} (${fmtNota(d.media)})`).join(', '),
      ]),
      bolas: lista.map(l => l.bola),
      colWidths: { 0: 30, 1: 16, 2: 20, 3: 13, 4: 9, 5: 45 },
      total: `Total — ${lista.length} ${conf.total}`,
    }],
  });
}
