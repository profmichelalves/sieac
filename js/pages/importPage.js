import { $, showToast } from '../utils/helpers.js';
import { importarNotas, importarFrequencia } from '../services/importService.js';

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
  `;

  setupImportArea('notas');
  setupImportArea('freq');
}

function setupImportArea(tipo) {
  const area = document.getElementById(`import-${tipo}-area`);
  const input = document.getElementById(`import-${tipo}-input`);

  if (!area || !input) return;

  area.addEventListener('click', () => input.click());

  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('dragover');
  });

  area.addEventListener('dragleave', () => {
    area.classList.remove('dragover');
  });

  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length) processFile(tipo, files[0]);
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
  bar.style.width = '30%';
  text.textContent = 'Lendo arquivo...';

  let importFn;
  let tipoNome;

  if (tipo === 'notas') {
    importFn = importarNotas;
    tipoNome = 'Notas';
  } else {
    importFn = importarFrequencia;
    tipoNome = 'Frequência';
  }

  bar.style.width = '60%';
  text.textContent = 'Processando dados...';

  const res = await importFn(file);

  bar.style.width = '100%';
  text.textContent = 'Finalizado!';

  if (res.error) {
    result.style.display = 'block';
    result.innerHTML = `
      <div class="auth-alert error">${res.error}</div>
    `;
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
