import { $, showToast } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { importarNotas, importarFrequencia } from '../services/importService.js';
import { supabaseRpc } from '../services/supabase.js';
import { clearCache } from '../repositories/dashboardRepository.js';
import { clearFilterCache } from '../components/FilterPanel.js';

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
      <div style="margin-top:12px;">
        <button class="btn btn-outline-primary btn-sm btn-print-ignorados no-print" onclick="window.open('','_blank')">
          <i class="bi bi-printer"></i> Imprimir Detalhes (${ignoradosCount})
        </button>
      </div>
    ` : ''}
  `;

  if (ignoradosCount > 0) {
    const btn = result.querySelector('.btn-print-ignorados');
    if (btn) {
      btn.onclick = () => imprimirIgnorados(tipoNome, res, file.name);
    }
  }

  showToast(`${tipoNome}: ${res.registros} registros processados`, 'success');
}

function imprimirIgnorados(tipoNome, res, fileName) {
  const w = window.open('', '_blank');
  if (!w) { alert('Popup bloqueado. Permita popups para imprimir.'); return; }
  const detalhes = (res.ignorados || []).map(d => `<tr><td>${d}</td></tr>`).join('');

  w.document.write(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<title>Detalhes da Importa\u00e7\u00e3o - ${tipoNome}</title>
<style>
  @page { margin:20mm 15mm; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Georgia,'Times New Roman',serif; font-size:11pt; color:#222; padding:30px; }
  .header { display:flex; align-items:center; gap:14px; margin-bottom:20px; padding-bottom:14px; border-bottom:2px solid #1a2a3a; }
  .header h1 { font-size:18pt; margin:0; }
  .header small { font-size:9pt; color:#666; }
  .meta { font-size:9pt; color:#555; margin-bottom:18px; }
  .meta span { display:inline-block; margin-right:20px; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  th { background:#1a2a3a; color:#fff; padding:7px 10px; font-size:9pt; text-transform:uppercase; letter-spacing:0.4px; text-align:left; border:1px solid #2a3a4a; }
  td { padding:6px 10px; border:1px solid #ccc; font-size:10pt; }
  tbody tr:nth-child(even) { background:#f6f8fa; }
  .footer { margin-top:24px; font-size:8pt; color:#999; text-align:center; border-top:1px solid #ddd; padding-top:10px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>SIEAC — Detalhes da Importa\u00e7\u00e3o</h1>
    <small>Sistema de Indicadores Educacionais Abel Coelho</small>
  </div>
</div>
<div class="meta">
  <span><strong>Tipo:</strong> ${tipoNome}</span>
  <span><strong>Arquivo:</strong> ${fileName}</span>
  <span><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}</span>
</div>
<div class="meta">
  <span><strong>Registros no arquivo:</strong> ${res.registros}</span>
  <span><strong>Inseridos:</strong> ${res.inseridos}</span>
  <span><strong>Ignorados:</strong> ${detalhes.length}</span>
</div>
<table>
<thead><tr><th>Detalhe do registro ignorado</th></tr></thead>
<tbody>
  ${detalhes || '<tr><td style="text-align:center;color:#999;">Nenhum detalhe dispon\u00edvel</td></tr>'}
</tbody>
</table>
<div class="footer">SIEAC — Relat\u00f3rio gerado automaticamente</div>
<script>window.onload=function(){window.print();window.close();};<\/script>
</body>
</html>`);
  w.document.close();
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
