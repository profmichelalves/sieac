import { $, showToast, parseDataDb, formatarDataHora, escapeHtml } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { listarUsuarios, listarPerfis, atualizarUsuario, excluirUsuario, contarVinculosAeeUsuario, limparSenhaUsuario, getCurrentUser } from '../services/authService.js';
import { registrarLog, LOG_ACTIONS } from '../services/logService.js';

const PERFIS_FALLBACK = { 1: 'Administrador', 2: 'Gestão Escolar', 3: 'Professor', 4: 'Professor do AEE' };

const COLUNAS_SORT = {
  nome: u => (u.nome || '').toLowerCase(),
  email: u => (u.email || '').toLowerCase(),
  matricula: u => (u.matricula || '').toLowerCase(),
  perfil: u => Number(u.perfil_id) || 0,
  status: u => (u.ativo ? 1 : 0),
  cadastro: u => parseDataDb(u.created_at)?.getTime() || 0,
};

let ordenacao = { col: 'cadastro', dir: 'desc' };
let alvoExcluir = null;
let alvoLimpar = null;

export async function render() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-title">Gerenciar Usuários</div>
    <div class="page-subtitle">Administração de contas de acesso ao sistema</div>

    <div class="card-sieac">
      <div class="card-sieac-header">Usuários cadastrados ${infoBtn('Usuários cadastrados', 'Lista os usuários do sistema com nome, email, matrícula, perfil, status e data de cadastro. Clique nos títulos das colunas para ordenar. O perfil pode ser alterado pelo administrador diretamente na lista; o próprio perfil não pode ser alterado para evitar bloqueio acidental.')}</div>
      <div class="card-sieac-body">
        <div class="table-responsive-custom">
          <table class="table-sieac" id="usuarios-table">
            <thead>
              <tr>
                <th data-sort="nome" style="cursor:pointer;user-select:none;">Nome<span class="sort-arrow"></span></th>
                <th data-sort="email" style="cursor:pointer;user-select:none;">Email<span class="sort-arrow"></span></th>
                <th data-sort="matricula" style="cursor:pointer;user-select:none;">Matrícula<span class="sort-arrow"></span></th>
                <th data-sort="perfil" style="cursor:pointer;user-select:none;">Perfil<span class="sort-arrow"></span></th>
                <th data-sort="status" style="cursor:pointer;user-select:none;">Status<span class="sort-arrow"></span></th>
                <th data-sort="cadastro" style="cursor:pointer;user-select:none;">Cadastro<span class="sort-arrow"></span></th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody id="usuarios-tbody">
              <tr><td colspan="7" style="text-align:center;color:var(--sieac-text-muted);">Carregando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="modal fade" id="modal-excluir-usuario" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" style="font-weight:700;"><i class="bi bi-trash3" style="color:var(--sieac-danger);margin-right:8px;"></i>Excluir Usuário</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>
          <div class="modal-body">
            <p style="color:var(--sieac-text-muted);font-size:0.9rem;margin-bottom:8px;">
              Tem certeza que deseja excluir o usuário <strong id="excluir-nome"></strong>?
            </p>
            <p style="color:var(--sieac-text-muted);font-size:0.85rem;margin-bottom:0;">
              Essa ação é irreversível: a conta de acesso será removida e o usuário será desconectado do sistema.
            </p>
            <div class="auth-alert error" id="excluir-aviso" style="display:none;margin-top:12px;">
              <strong>Atenção:</strong> você está excluindo a sua própria conta. Após a exclusão, o acesso será encerrado.
            </div>
            <div class="form-check mt-3" id="excluir-aee-wrap" style="display:none;">
              <input class="form-check-input" type="checkbox" id="excluir-aee-check" checked>
              <label class="form-check-label" for="excluir-aee-check" style="color:var(--sieac-text-muted);font-size:0.85rem;">
                Desvincular o(s) estudante(s) vinculado(s) a este professor do AEE (<span id="excluir-aee-count"></span>)
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" style="border-radius:var(--sieac-radius-pill);">Cancelar</button>
            <button type="button" class="btn btn-danger" id="excluir-confirmar" style="border-radius:var(--sieac-radius-pill);">Excluir</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="modal-limpar-senha" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" style="font-weight:700;"><i class="bi bi-key-fill" style="color:var(--sieac-danger);margin-right:8px;"></i>Limpar Senha</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>
          <div class="modal-body">
            <p style="color:var(--sieac-text-muted);font-size:0.9rem;margin-bottom:8px;">
              Tem certeza que deseja limpar a senha de <strong id="limpar-nome"></strong>?
            </p>
            <p style="color:var(--sieac-text-muted);font-size:0.85rem;margin-bottom:0;">
              O usuário será desconectado e precisará definir uma nova senha no próximo acesso, informando e-mail, matrícula e perfil.
            </p>
            <div id="limpar-alert"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" style="border-radius:var(--sieac-radius-pill);">Cancelar</button>
            <button type="button" class="btn btn-danger" id="limpar-confirmar" style="border-radius:var(--sieac-radius-pill);">Limpar senha</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll('#usuarios-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (ordenacao.col === col) {
        ordenacao.dir = ordenacao.dir === 'asc' ? 'desc' : 'asc';
      } else {
        ordenacao.col = col;
        ordenacao.dir = col === 'cadastro' ? 'desc' : 'asc';
      }
      carregarUsuarios();
    });
  });

  document.getElementById('excluir-confirmar').addEventListener('click', abrirConfirmarExclusao);
  document.getElementById('limpar-confirmar').addEventListener('click', confirmarLimpeza);
  document.getElementById('modal-excluir-usuario').addEventListener('hidden.bs.modal', () => { alvoExcluir = null; });
  document.getElementById('modal-limpar-senha').addEventListener('hidden.bs.modal', () => { alvoLimpar = null; });

  await carregarUsuarios();
}

async function carregarUsuarios() {
  const tbody = document.getElementById('usuarios-tbody');
  if (!tbody) return;

  const { data: usuarios, error } = await listarUsuarios();

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--sieac-danger);">Erro ao carregar: ${error}</td></tr>`;
    return;
  }

  if (!usuarios || !usuarios.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--sieac-text-muted);">Nenhum usuário cadastrado</td></tr>`;
    return;
  }

  const { data: perfisList } = await listarPerfis();
  const perfisMap = {};
  if (perfisList && perfisList.length) {
    perfisList.forEach(p => { perfisMap[Number(p.id)] = p.nome; });
  } else {
    Object.entries(PERFIS_FALLBACK).forEach(([id, nome]) => { perfisMap[Number(id)] = nome; });
  }

  const ordenar = COLUNAS_SORT[ordenacao.col] || COLUNAS_SORT.nome;
  usuarios.sort((a, b) => {
    const va = ordenar(a);
    const vb = ordenar(b);
    if (va < vb) return ordenacao.dir === 'asc' ? -1 : 1;
    if (va > vb) return ordenacao.dir === 'asc' ? 1 : -1;
    return 0;
  });

  document.querySelectorAll('#usuarios-table th[data-sort] .sort-arrow').forEach(s => { s.textContent = ''; });
  const thAtual = document.querySelector(`#usuarios-table th[data-sort="${ordenacao.col}"] .sort-arrow`);
  if (thAtual) thAtual.textContent = ordenacao.dir === 'asc' ? ' ↑' : ' ↓';

  const currentUser = getCurrentUser();

  tbody.innerHTML = usuarios.map(u => {
    const ehProprio = currentUser && String(u.id) === String(currentUser.id);
    const perfilOptions = Object.entries(perfisMap)
      .map(([id, nome]) => `<option value="${escapeHtml(id)}" ${Number(id) === Number(u.perfil_id) ? 'selected' : ''}>${escapeHtml(nome)}</option>`)
      .join('');
    const dataCadastro = u.created_at ? formatarDataHora(u.created_at) : '-';
    return `
      <tr>
        <td><strong>${escapeHtml(u.nome)}${ehProprio ? ' <small style="color:var(--sieac-text-muted)">(você)</small>' : ''}</strong></td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.matricula)}</td>
        <td>
          <select class="perfil-select" data-id="${u.id}" data-nome="${escapeHtml(u.nome)}" data-perfil="${u.perfil_id}" ${ehProprio ? 'disabled title="Não é possível alterar o próprio perfil"' : ''} style="padding:4px 8px;border:1px solid var(--sieac-border);border-radius:var(--sieac-radius-sm);font-size:0.8rem;background:var(--sieac-bg);color:var(--sieac-text);">
            ${perfilOptions}
          </select>
        </td>
        <td>
          <span class="user-status ${u.ativo ? 'active' : 'inactive'}"></span>
          ${u.ativo ? 'Ativo' : 'Inativo'}
        </td>
        <td style="white-space:nowrap;">${dataCadastro}</td>
        <td>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-sm btn-outline-primary usuario-toggle" data-id="${u.id}" data-nome="${escapeHtml(u.nome)}" data-ativo="${u.ativo}" style="border-radius:var(--sieac-radius-pill);font-size:0.75rem;padding:4px 12px;">
              ${u.ativo ? 'Desativar' : 'Ativar'}
            </button>
            <button class="btn btn-sm btn-outline-danger usuario-delete" data-id="${u.id}" data-nome="${escapeHtml(u.nome)}" data-perfil="${u.perfil_id}" style="border-radius:var(--sieac-radius-pill);font-size:0.75rem;padding:4px 12px;">
              <i class="bi bi-trash"></i>
            </button>
            <button class="btn btn-sm btn-outline-warning usuario-reset" data-id="${u.id}" data-nome="${escapeHtml(u.nome)}" title="Limpar senha" style="border-radius:var(--sieac-radius-pill);font-size:0.75rem;padding:4px 12px;">
              <i class="bi bi-eraser"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.perfil-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.id;
      const nome = sel.dataset.nome;
      const perfilAntigo = perfisMap[Number(sel.dataset.perfil)] || sel.dataset.perfil;
      const perfilId = sel.value;
      const { error } = await atualizarUsuario(id, { perfil_id: Number(perfilId) });
      if (error) {
        showToast('Erro ao alterar perfil: ' + error, 'error');
      } else {
        registrarLog(LOG_ACTIONS.ALTERAR_PERFIL, { usuario_id: id, usuario_nome: nome, perfil_antigo: perfilAntigo, perfil_novo: perfisMap[Number(perfilId)] });
        showToast(`Perfil do usuário alterado para ${perfisMap[Number(perfilId)]}`, 'success');
        await carregarUsuarios();
      }
    });
  });

  tbody.querySelectorAll('.usuario-toggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const nome = btn.dataset.nome;
      const ativo = btn.dataset.ativo === 'true';
      const { error } = await atualizarUsuario(id, { ativo: !ativo });
      if (error) {
        showToast('Erro ao atualizar: ' + error, 'error');
      } else {
        registrarLog(ativo ? LOG_ACTIONS.DESATIVAR_USUARIO : LOG_ACTIONS.ATIVAR_USUARIO, { usuario_id: id, usuario_nome: nome, novo_status: !ativo ? 'ativo' : 'inativo' });
        showToast(`Usuário ${!ativo ? 'ativado' : 'desativado'} com sucesso!`, 'success');
        await carregarUsuarios();
      }
    });
  });

  tbody.querySelectorAll('.usuario-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ehProprio = currentUser && String(currentUser.id) === String(btn.dataset.id);
      alvoExcluir = { id: btn.dataset.id, nome: btn.dataset.nome, perfilId: btn.dataset.perfil };
      document.getElementById('excluir-nome').textContent = alvoExcluir.nome;
      document.getElementById('excluir-aviso').style.display = ehProprio ? 'block' : 'none';

      const aeeWrap = document.getElementById('excluir-aee-wrap');
      const aeeCount = document.getElementById('excluir-aee-count');
      const aeeCheck = document.getElementById('excluir-aee-check');
      aeeWrap.style.display = 'none';
      if (perfisMap[Number(alvoExcluir.perfilId)] === 'Professor do AEE') {
        const { total } = await contarVinculosAeeUsuario(alvoExcluir.id);
        if (total > 0) {
          aeeCount.textContent = `${total} estudante(s)`;
          aeeCheck.checked = true;
          aeeWrap.style.display = 'block';
        }
      }
      new bootstrap.Modal(document.getElementById('modal-excluir-usuario')).show();
    });
  });

  tbody.querySelectorAll('.usuario-reset').forEach(btn => {
    btn.addEventListener('click', () => {
      alvoLimpar = { id: btn.dataset.id, nome: btn.dataset.nome };
      document.getElementById('limpar-nome').textContent = alvoLimpar.nome;
      document.getElementById('limpar-alert').innerHTML = '';
      new bootstrap.Modal(document.getElementById('modal-limpar-senha')).show();
    });
  });
}

function abrirConfirmarExclusao() {
  const modalEl = document.getElementById('modal-excluir-usuario');
  const btn = document.getElementById('excluir-confirmar');
  if (!alvoExcluir || !modalEl) return;
  btn.disabled = true;
  btn.textContent = 'Excluindo...';
  const desvincularAee = document.getElementById('excluir-aee-check')?.checked ?? false;
  excluirUsuario(alvoExcluir.id, desvincularAee).then(({ error }) => {
    btn.disabled = false;
    btn.textContent = 'Excluir';
    if (error) {
      showToast('Erro ao excluir: ' + error, 'error');
      return;
    }
    registrarLog(LOG_ACTIONS.EXCLUIR_USUARIO, { usuario_id: alvoExcluir.id, usuario_nome: alvoExcluir.nome, desvincular_aee: desvincularAee });
    const nome = alvoExcluir.nome;
    alvoExcluir = null;
    bootstrap.Modal.getInstance(modalEl)?.hide();
    showToast(`Usuário ${nome} excluído!`, 'success');
    carregarUsuarios();
  });
}

function confirmarLimpeza() {
  const modalEl = document.getElementById('modal-limpar-senha');
  const alertEl = document.getElementById('limpar-alert');
  const btn = document.getElementById('limpar-confirmar');
  if (!alvoLimpar || !modalEl) return;

  btn.disabled = true;
  btn.textContent = 'Limpando...';
  alertEl.innerHTML = '';
  limparSenhaUsuario(alvoLimpar.id).then(({ error }) => {
    btn.disabled = false;
    btn.textContent = 'Limpar senha';
    if (error) {
      alertEl.innerHTML = `<div class="auth-alert error">${escapeHtml(error)}</div>`;
      return;
    }
    registrarLog(LOG_ACTIONS.RESETAR_SENHA, { usuario_id: alvoLimpar.id, usuario_nome: alvoLimpar.nome, modo: 'limpar_senha' });
    const nome = alvoLimpar.nome;
    alvoLimpar = null;
    bootstrap.Modal.getInstance(modalEl)?.hide();
    showToast(`Senha de ${nome} limpa! O usuário definirá uma nova senha no próximo acesso.`, 'success');
    carregarUsuarios();
  });
}
