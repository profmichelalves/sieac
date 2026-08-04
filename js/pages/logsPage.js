import { showToast, formatarDataHora } from '../utils/helpers.js';
import { supabaseQuery, supabaseRpc } from '../services/supabase.js';
import { registrarLog, LOG_ACTIONS } from '../services/logService.js';

const PAGE_SIZE = 100;

const ACAO_LABELS = {
  login: 'Login',
  login_falha: 'Tentativa de login',
  logout: 'Logout',
  cadastro: 'Cadastro de conta',
  alterar_perfil: 'Alteração de perfil',
  ativar_usuario: 'Ativação de usuário',
  desativar_usuario: 'Desativação de usuário',
  excluir_usuario: 'Exclusão de usuário',
  importar_notas: 'Importação de notas',
  importar_frequencia: 'Importação de frequência',
  limpar_dados: 'Limpeza de dados',
  gerar_pdf: 'Geração de relatório (PDF)',
};

let paginaAtual = 0;
let ultimaPagina = false;

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Logs de Atividade</div>
    <div class="page-subtitle">Registro das ações críticas realizadas na plataforma</div>

    <div class="card-sieac">
      <div class="card-sieac-header">Filtros</div>
      <div class="card-sieac-body">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label">Buscar usuário ou email</label>
            <input type="text" class="form-control" id="log-busca" placeholder="Nome ou email do usuário">
          </div>
          <div class="col-md-3">
            <label class="form-label">Ação</label>
            <select class="form-control" id="log-acao">
              <option value="">Todas</option>
              ${Object.entries(ACAO_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label">De</label>
            <input type="date" class="form-control" id="log-de" value="${dataHoje()}">
          </div>
          <div class="col-md-2">
            <label class="form-label">Até</label>
            <input type="date" class="form-control" id="log-ate" value="${dataHoje()}">
          </div>
          <div class="col-md-1 d-flex align-items-end">
            <button class="btn btn-outline-primary" id="log-filtrar" style="width:100%;">Filtrar</button>
          </div>
        </div>
        <div style="margin-top:12px;text-align:right;">
          <button class="btn btn-outline-danger btn-sm" id="log-limpar">
            <i class="bi bi-trash3"></i> Limpar Todos os Logs
          </button>
        </div>
      </div>
    </div>

    <div class="card-sieac" style="margin-top:16px;">
      <div class="card-sieac-header">Registros</div>
      <div class="card-sieac-body">
        <div class="table-responsive-custom">
          <table class="table-sieac" id="logs-table">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Usuário</th>
                <th>Email</th>
                <th>Ação</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody id="logs-tbody">
              <tr><td colspan="5" style="text-align:center;color:var(--sieac-text-muted);">Carregando...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="d-flex justify-content-between align-items-center" style="margin-top:12px;">
          <button class="btn btn-sm btn-outline-secondary" id="log-anterior" disabled>← Anterior</button>
          <span id="log-pagina-info" style="font-size:0.85rem;color:var(--sieac-text-muted);"></span>
          <button class="btn btn-sm btn-outline-secondary" id="log-proximo" disabled>Próximo →</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('log-filtrar').addEventListener('click', () => {
    paginaAtual = 0;
    carregarLogs();
  });

  document.getElementById('log-anterior').addEventListener('click', () => {
    if (paginaAtual > 0) { paginaAtual--; carregarLogs(); }
  });

  document.getElementById('log-proximo').addEventListener('click', () => {
    if (!ultimaPagina) { paginaAtual++; carregarLogs(); }
  });

  ['log-busca', 'log-acao'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        paginaAtual = 0;
        carregarLogs();
      }
    });
  });

  document.getElementById('log-limpar').addEventListener('click', async () => {
    if (!confirm('Tem certeza que deseja limpar todos os registros de log? Esta operação não pode ser desfeita.')) return;
    const res = await supabaseRpc('limpar_dados', { tabelas: ['logs'] });
    if (res.error) {
      showToast('Erro ao limpar logs: ' + res.error, 'error');
      return;
    }
    registrarLog(LOG_ACTIONS.LIMPAR_DADOS, { tabela: 'logs', origem: 'tela de logs' });
    paginaAtual = 0;
    await carregarLogs();
    showToast('Logs limpos com sucesso!', 'success');
  });

  await carregarLogs();
}

function dataHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// O created_at é armazenado em UTC (TIMESTAMP com NOW()). O filtro De/Até usa
// datas locais; convertemos os limites do dia local para UTC antes de consultar,
// senão os registros do fim do dia (que caem no dia UTC seguinte) são omitidos.
function dataLocalParaUtc(dataStr, fimDoDia) {
  const d = new Date(`${dataStr}T${fimDoDia ? '23:59:59' : '00:00:00'}`);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function carregarLogs() {
  const tbody = document.getElementById('logs-tbody');
  if (!tbody) return;

  const busca = document.getElementById('log-busca').value.trim();
  const acao = document.getElementById('log-acao').value;
  const de = document.getElementById('log-de').value;
  const ate = document.getElementById('log-ate').value;

  const filters = [];
  if (acao) filters.push({ col: 'acao', val: acao });
  if (busca) filters.push({ col: 'usuario_nome', op: 'ilike', val: `%${busca}%` });
  if (de) {
    const utcDe = dataLocalParaUtc(de, false);
    if (utcDe) filters.push({ col: 'created_at', op: 'gte', val: utcDe });
  }
  if (ate) {
    const utcAte = dataLocalParaUtc(ate, true);
    if (utcAte) filters.push({ col: 'created_at', op: 'lte', val: utcAte });
  }

  const { data, error } = await supabaseQuery('logs', {
    select: 'id,usuario_nome,email,acao,detalhes,created_at',
    filters,
    order: 'created_at.desc',
    limit: PAGE_SIZE + 1,
    offset: paginaAtual * PAGE_SIZE
  });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--sieac-danger);">Erro ao carregar: ${error}</td></tr>`;
    return;
  }

  const registros = data || [];
  ultimaPagina = registros.length <= PAGE_SIZE;
  const visiveis = registros.slice(0, PAGE_SIZE);

  if (!visiveis.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--sieac-text-muted);">Nenhum registro encontrado</td></tr>`;
  } else {
    tbody.innerHTML = visiveis.map(l => {
      const detalhes = formatarDetalhes(l.detalhes);
      return `
        <tr>
          <td style="white-space:nowrap;">${formatarDataHora(l.created_at)}</td>
          <td>${l.usuario_nome || '-'}</td>
          <td>${l.email || '-'}</td>
          <td><span class="badge bg-secondary" style="font-weight:500;">${ACAO_LABELS[l.acao] || l.acao}</span></td>
          <td style="max-width:420px;">${detalhes}</td>
        </tr>`;
    }).join('');
  }

  const pagInfo = document.getElementById('log-pagina-info');
  if (pagInfo) pagInfo.textContent = `Página ${paginaAtual + 1}`;
  const btnAnt = document.getElementById('log-anterior');
  const btnProx = document.getElementById('log-proximo');
  if (btnAnt) btnAnt.disabled = paginaAtual === 0;
  if (btnProx) btnProx.disabled = ultimaPagina;
}

function formatarDetalhes(detalhes) {
  if (!detalhes) return '<span style="color:var(--sieac-text-muted);font-size:0.8rem;">—</span>';
  let obj = detalhes;
  if (typeof detalhes === 'string') {
    try { obj = JSON.parse(detalhes); } catch { return `<span style="font-size:0.8rem;">${detalhes}</span>`; }
  }
  if (!Object.keys(obj).length) return '<span style="color:var(--sieac-text-muted);font-size:0.8rem;">—</span>';
  const linhas = Object.entries(obj)
    .map(([k, v]) => `<div><span style="color:var(--sieac-text-muted);">${k}:</span> <span style="font-size:0.8rem;">${formatValor(v)}</span></div>`)
    .join('');
  return `<div style="font-size:0.8rem;line-height:1.5;">${linhas}</div>`;
}

function formatValor(v) {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
