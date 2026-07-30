import { $, showToast } from '../utils/helpers.js';
import { importarNotas, importarFrequencia } from '../services/importService.js';
import { supabaseRpc } from '../services/supabase.js';

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
  { id: 'escolas', label: 'Escolas' },
];

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Importar Dados</div>
    <div class="page-subtitle">Importe os relatórios de notas e frequência para o sistema</div>

    <div class="row g-4">
      <div class="col-md-6">
        <div class="card-sieac">
          <div class="card-sieac-header">Notas dos Estudantes</div>
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
          <div class="card-sieac-header">Frequência dos Estudantes</div>
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
          <div class="card-sieac-header">Histórico de Importações</div>
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
  `;

  showToast(`${tipoNome}: ${res.registros} registros processados`, 'success');
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
