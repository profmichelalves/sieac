import { $, showToast } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { importarNotas, importarFrequencia } from '../services/importService.js';
import { supabaseRpc, supabaseQuery } from '../services/supabase.js';
import { registrarLog, LOG_ACTIONS } from '../services/logService.js';
import { clearCache } from '../repositories/dashboardRepository.js';
import { clearFilterCache } from '../components/FilterPanel.js';
import { gerarPdfRelatorio } from '../utils/pdf.js';

const TABELAS = [
  { id: 'notas', label: 'Notas' },
  { id: 'frequencias', label: 'Frequência' },
  { id: 'alocacoes', label: 'Alocações' },
  { id: 'importacoes', label: 'Histórico de Importações' },
  { id: 'estudantes', label: 'Estudantes' },
  { id: 'turmas', label: 'Turmas' },
  { id: 'professores', label: 'Professores' },
  { id: 'componentes_curriculares', label: 'Componentes Curriculares' },
  { id: 'series', label: 'Séries' },
  { id: 'etapas_ensino', label: 'Etapas de Ensino' },
];

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Importar Dados</div>
    <div class="page-subtitle">Importe os relatórios de notas e frequência para o sistema</div>

    <div class="row g-4">
      <div class="col-md-6">
        <div class="card-sieac">
          <div class="card-sieac-header">Notas dos Estudantes ${infoBtn('Notas dos Estudantes', 'Importa o relatório de acompanhamento de notas (.xlsx) associando estudantes, turmas, disciplinas e professores. Registros já existentes são atualizados; o resumo final mostra inseridos, atualizados, ignorados e erros.')}</div>
          <div class="card-sieac-body">
            <p style="font-size:0.85rem;color:var(--sieac-text-muted);margin-bottom:16px;">
              Importe o relatório de acompanhamento de notas dos estudantes (formato .xlsx)
            </p>
            <div class="import-area" id="import-notas-area">
              <div class="import-area-icon"><i class="bi bi-file-earmark-spreadsheet"></i></div>
              <div class="import-area-text">Clique para selecionar ou arraste o arquivo</div>
              <div class="import-area-sub">Relatório De Acompanhamentos de Notas dos Estudantes.xlsx</div>
            </div>
            <input type="file" id="import-notas-input" accept=".xlsx,.xls,.csv" style="display:none">
            <div id="import-notas-progress" style="display:none;margin-top:16px;">
              <div class="import-progress"><div class="import-progress-bar" id="progress-notas-bar" style="width:0%"></div></div>
              <div style="text-align:center;margin-top:8px;font-size:0.85rem;color:var(--sieac-text-muted);" id="progress-notas-text">Processando...</div>
            </div>
            <div id="import-notas-result" style="display:none;margin-top:16px;"></div>
          </div>
        </div>
      </div>

      <div class="col-md-6">
        <div class="card-sieac">
          <div class="card-sieac-header">Frequência dos Estudantes ${infoBtn('Frequência dos Estudantes', 'Importa o relatório de acompanhamento de frequência (.xlsx) preenchendo o percentual de frequência por estudante e mês de referência. Registros já existentes são atualizados.')}</div>
          <div class="card-sieac-body">
            <p style="font-size:0.85rem;color:var(--sieac-text-muted);margin-bottom:16px;">
              Importe o relatório de acompanhamento de frequência dos estudantes (formato .xlsx)
            </p>
            <div class="import-area" id="import-freq-area">
              <div class="import-area-icon"><i class="bi bi-file-earmark-spreadsheet"></i></div>
              <div class="import-area-text">Clique para selecionar ou arraste o arquivo</div>
              <div class="import-area-sub">relatorio_acompanhamento_frequencia.xlsx</div>
            </div>
            <input type="file" id="import-freq-input" accept=".xlsx,.xls,.csv" style="display:none">
            <div id="import-freq-progress" style="display:none;margin-top:16px;">
              <div class="import-progress"><div class="import-progress-bar" id="progress-freq-bar" style="width:0%"></div></div>
              <div style="text-align:center;margin-top:8px;font-size:0.85rem;color:var(--sieac-text-muted);" id="progress-freq-text">Processando...</div>
            </div>
            <div id="import-freq-result" style="display:none;margin-top:16px;"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-4" style="margin-top:8px;">
      <div class="col-12">
        <button class="btn btn-outline-danger" id="btn-limpar-dados" style="display:inline-flex;align-items:center;gap:8px;">
          <i class="bi bi-trash3"></i> Limpar Dados
        </button>
      </div>
    </div>

    <div class="row g-4" style="margin-top:20px;">
      <div class="col-12">
        <div class="card-sieac">
          <div class="card-sieac-header">Histórico de Importações ${infoBtn('Histórico de Importações', 'Lista as importações realizadas, com detalhes de processamento de cada arquivo enviado ao sistema.')}</div>
          <div class="card-sieac-body">
            <div id="import-historico">
              <div class="empty-state">
                <i class="bi bi-clock-history"></i>
                <h4>Nenhuma importação realizada</h4>
                <p>As importações realizadas aparecerão aqui com detalhes de processamento.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Limpar Dados -->
    <div class="modal fade" id="modal-limpar-dados" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-trash3" style="margin-right:8px;"></i>Limpar Dados</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p style="font-size:0.9rem;color:var(--sieac-text-muted);margin-bottom:16px;">
              Selecione as tabelas que deseja limpar. A exclusão respeita a ordem das dependências (filhos primeiro).
            </p>
            <div style="margin-bottom:12px;">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.85rem;font-weight:600;">
                <input type="checkbox" id="check-toggle-all" checked> Selecionar / Desmarcar Todos
              </label>
            </div>
            <div id="check-list">
              ${TABELAS.map(t => `
                <label class="limpar-check-item" data-id="${t.id}">
                  <input type="checkbox" class="limpar-check" value="${t.id}" checked>
                  <span>${t.label}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-danger" id="btn-confirmar-limpeza">
              <i class="bi bi-trash3"></i> Limpar Selecionados
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  setupImportArea('notas');
  setupImportArea('freq');
  setupLimparDados();
  carregarHistorico();
}

function setupImportArea(tipo) {
  const area = document.getElementById(`import-${tipo}-area`);
  const input = document.getElementById(`import-${tipo}-input`);
  if (!area || !input) return;
  area.addEventListener('click', () => input.click());
  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => { area.classList.remove('dragover'); });
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer.files.length) processFile(tipo, e.dataTransfer.files[0]);
  });
  input.addEventListener('change', (e) => {
    if (e.target.files.length) processFile(tipo, e.target.files[0]);
  });
}

async function processFile(tipo, file) {
  const progress = document.getElementById(`import-${tipo}-progress`);
  const bar = document.getElementById(`progress-${tipo}-bar`);
  const text = document.getElementById(`progress-${tipo}-text`);
  const result = document.getElementById(`import-${tipo}-result`);

  progress.style.display = 'block';
  result.style.display = 'none';

  const importFn = tipo === 'notas' ? importarNotas : importarFrequencia;
  const tipoNome = tipo === 'notas' ? 'Notas' : 'Frequência';

  const onProgress = (pct, msg) => {
    bar.style.width = `${pct}%`;
    text.textContent = msg;
  };

  onProgress(5, 'Lendo arquivo...');
  const res = await importFn(file, onProgress);

  bar.style.width = '100%';
  text.textContent = 'Finalizado!';

  if (res.error) {
    result.style.display = 'block';
    result.innerHTML = `<div class="auth-alert error">${res.error}</div>`;
    return;
  }

  result.style.display = 'block';

  clearCache();
  clearFilterCache();

  const ignoradosCount = (res.ignorados || []).length;
  result.innerHTML = `
    <div class="auth-alert success" style="margin-bottom:16px;">Importação concluída com sucesso!</div>
    <div class="import-stats">
      <div class="import-stat">
        <div class="import-stat-value">${res.registros}</div>
        <div class="import-stat-label">Registros</div>
      </div>
      <div class="import-stat">
        <div class="import-stat-value" style="color:var(--sieac-success)">${res.inseridos}</div>
        <div class="import-stat-label">Inseridos</div>
      </div>
      <div class="import-stat">
        <div class="import-stat-value" style="color:var(--sieac-secondary)">${res.atualizados}</div>
        <div class="import-stat-label">Atualizados</div>
      </div>
      <div class="import-stat">
        <div class="import-stat-value" style="color:${ignoradosCount > 0 ? 'var(--sieac-warning)' : 'var(--sieac-text)'}">${ignoradosCount}</div>
        <div class="import-stat-label">Ignorados</div>
      </div>
      <div class="import-stat">
        <div class="import-stat-value" style="color:${res.erros > 0 ? 'var(--sieac-danger)' : 'var(--sieac-text)'}">${res.erros}</div>
        <div class="import-stat-label">Erros</div>
      </div>
      <div class="import-stat">
        <div class="import-stat-value">${(res.tempoMs / 1000).toFixed(1)}s</div>
        <div class="import-stat-label">Tempo</div>
      </div>
    </div>
    ${res.errosDetalhes && res.errosDetalhes.length ? `
      <div style="margin-top:12px;font-size:0.8rem;color:var(--sieac-danger);">
        <strong>Detalhes dos erros:</strong><br>
        ${res.errosDetalhes.slice(0, 5).map(e => `• ${e}`).join('<br>')}
      </div>
    ` : ''}
    ${ignoradosCount > 0 ? `
      <details style="margin-top:12px;">
        <summary style="cursor:pointer;font-size:0.85rem;color:var(--sieac-warning);user-select:none;">
          Ver linhas ignoradas (${ignoradosCount}) ${ignoradosCount > 100 ? '— exibindo as 100 primeiras' : ''}
        </summary>
        <div style="max-height:220px;overflow:auto;margin-top:8px;border:1px solid var(--sieac-border,#ddd);border-radius:8px;padding:8px 12px;font-size:0.8rem;line-height:1.8;">
          ${(res.ignorados || []).slice(0, 100).map(d => `• ${formatIgnorado(d)}`).join('<br>')}
          ${ignoradosCount > 100 ? `<br><em>... e mais ${ignoradosCount - 100} linhas.</em>` : ''}
        </div>
      </details>
      <div style="margin-top:12px;">
        <button class="btn btn-outline-primary btn-sm btn-pdf-ignorados no-print">
          <i class="bi bi-file-earmark-pdf"></i> PDF — Explicação dos Ignorados (${ignoradosCount})
        </button>
      </div>
    ` : ''}
  `;

  if (ignoradosCount > 0) {
    const btn = result.querySelector('.btn-pdf-ignorados');
    if (btn) {
      btn.onclick = () => gerarPdfIgnorados(tipoNome, res, file.name);
    }
  }

  registrarLog(tipo === 'notas' ? LOG_ACTIONS.IMPORTAR_NOTAS : LOG_ACTIONS.IMPORTAR_FREQUENCIA, {
    arquivo: file.name,
    registros: res.registros,
    inseridos: res.inseridos,
    atualizados: res.atualizados,
    erros: res.erros,
    ignorados: (res.ignorados || []).length,
    tempoMs: res.tempoMs,
  });
  carregarHistorico();

  showToast(`${tipoNome}: ${res.registros} registros processados`, 'success');
}

function formatIgnorado(d) {
  if (typeof d === 'string') return d;
  if (d.tipo === 'frequencia') return `Ignorado: ${d.matricula} - ${d.turma} (${d.motivo})`;
  return `Ignorado: ${d.registro} — ${d.turma} / ${d.disciplina} (${d.motivo})`;
}

function gerarPdfIgnorados(tipoNome, res, fileName) {
  const ignorados = res.ignorados || [];
  const isNotas = tipoNome === 'Notas';
  const avisos = (res.errosDetalhes || []).filter(e => !/\d+\s+ignorados?\s*\(/.test(e));

  const meta = [
    `Tipo: ${tipoNome}`,
    `Arquivo: ${fileName}`,
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Registros no arquivo: ${res.registros}`,
    `Inseridos: ${res.inseridos}`,
    `Ignorados: ${ignorados.length}`,
  ];
  if (avisos.length) meta.push(`Avisos: ${avisos.join(' | ')}`);

  gerarPdfRelatorio({
    titulo: 'PROBLEMAS DE IMPORTAÇÃO — SIEAC',
    subtitulo: 'Sistema de Indicadores Educacionais Abel Coelho',
    meta,
    tabelas: [{
      titulo: `${tipoNome} — Registros ignorados e explicação de cada caso`,
      colunas: isNotas ? ['Registro (ID)', 'Turma', 'Disciplina', 'Motivo'] : ['Matrícula', 'Turma', 'Motivo'],
      linhas: ignorados.map(d => isNotas
        ? [d.registro, d.turma, d.disciplina, d.motivo]
        : [d.matricula, d.turma, d.motivo]),
      colWidths: isNotas ? { 0: 22, 1: 24, 2: 30, 3: 40 } : { 0: 28, 1: 28, 2: 50 },
      total: `Total — ${ignorados.length} registro(s) ignorado(s)`,
    }],
  });
}

function setupLimparDados() {
  const btn = document.getElementById('btn-limpar-dados');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const modal = new bootstrap.Modal(document.getElementById('modal-limpar-dados'));
    modal.show();
  });

  // Toggle todos
  const toggleAll = document.getElementById('check-toggle-all');
  toggleAll?.addEventListener('change', () => {
    document.querySelectorAll('.limpar-check').forEach(cb => cb.checked = toggleAll.checked);
  });

  // Confirmar limpeza
  const btnConfirmar = document.getElementById('btn-confirmar-limpeza');
  btnConfirmar?.addEventListener('click', async () => {
    const checks = document.querySelectorAll('.limpar-check:checked');
    if (!checks.length) {
      showToast('Selecione pelo menos uma tabela para limpar.', 'warning');
      return;
    }

    const tabelas = [...checks].map(cb => cb.value);
    const nomes = TABELAS.filter(t => tabelas.includes(t.id)).map(t => t.label);
    const msgConfirm = `Tem certeza que deseja limpar os dados de:\n\n• ${nomes.join('\n• ')}\n\nEsta operação não pode ser desfeita.`;

    if (!confirm(msgConfirm)) return;

    const modalEl = document.getElementById('modal-limpar-dados');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal?.hide();

    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<span class="spinner-border spinner-border-sm" style="margin-right:4px;"></span> Limpando...';

    try {
      const res = await supabaseRpc('limpar_dados', { tabelas });
      if (res.error) {
        showToast(`Erro ao limpar dados: ${res.error}`, 'error');
        return;
      }

      const linhas = (res.data || []).map(r =>
        `${r.tabela}: ${r.linhas} linha(s) removida(s)${r.sequencia_reset ? ' (ID resetado)' : ''}`
      ).join('\n');

      registrarLog(LOG_ACTIONS.LIMPAR_DADOS, {
        tabelas: (res.data || []).map(r => ({ tabela: r.tabela, linhas: r.linhas }))
      });

      showToast(`Dados limpos com sucesso:\n${linhas}`, 'success');

      window.location.hash = '#/importar';
    } catch (e) {
      showToast(`Erro: ${e.message}`, 'error');
    } finally {
      btnConfirmar.disabled = false;
      btnConfirmar.innerHTML = '<i class="bi bi-trash3"></i> Limpar Selecionados';
    }
  });
}

async function carregarHistorico() {
  const el = document.getElementById('import-historico');
  if (!el) return;

  const { data, error } = await supabaseQuery('importacoes', {
    select: 'id,tipo,arquivo,registros,inseridos,atualizados,erros,erros_detalhes,tempo_ms,created_at',
    order: 'created_at.desc',
    limit: 50
  });

  if (error) {
    el.innerHTML = `<div class="empty-state"><p style="color:var(--sieac-danger);font-size:0.9rem;">Erro ao carregar histórico: ${error}</p></div>`;
    return;
  }

  if (!data || !data.length) {
    el.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-clock-history"></i>
        <h4>Nenhuma importação realizada</h4>
        <p>As importações realizadas aparecerão aqui com detalhes de processamento.</p>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="table-responsive-custom">
      <table class="table-sieac">
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Arquivo</th>
            <th>Registros</th>
            <th>Inseridos</th>
            <th>Erros</th>
            <th>Ignorados</th>
            <th>Tempo</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(i => {
            let detalhes = {};
            try { detalhes = JSON.parse(i.erros_detalhes || '{}'); } catch {}
            const ignorados = detalhes.ignorados ?? '-';
            return `
              <tr>
                <td>${new Date(i.created_at).toLocaleString('pt-BR')}</td>
                <td>${i.tipo === 'notas' ? 'Notas' : 'Frequência'}</td>
                <td>${i.arquivo || '-'}</td>
                <td>${i.registros}</td>
                <td>${i.inseridos}</td>
                <td style="color:${i.erros > 0 ? 'var(--sieac-danger)' : 'inherit'}">${i.erros}</td>
                <td>${ignorados}</td>
                <td>${(i.tempo_ms / 1000).toFixed(1)}s</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    ${data.length >= 50 ? '<div style="margin-top:8px;font-size:0.8rem;color:var(--sieac-text-muted);">Exibindo os 50 registros mais recentes.</div>' : ''}
  `;
}
