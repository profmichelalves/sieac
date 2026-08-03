import { $, showToast } from '../utils/helpers.js';
import { infoBtn } from '../utils/explanation.js';
import { listarUsuarios, atualizarUsuario, getCurrentUser } from '../services/authService.js';
import { registrarLog, LOG_ACTIONS } from '../services/logService.js';

const PERFIS = { 1: 'Administrador', 2: 'Gestão Escolar', 3: 'Professor', 4: 'Professor do AEE' };

const COLUNAS_SORT = {
  nome: u => (u.nome || '').toLowerCase(),
  email: u => (u.email || '').toLowerCase(),
  matricula: u => (u.matricula || '').toLowerCase(),
  perfil: u => Number(u.perfil_id) || 0,
  status: u => (u.ativo ? 1 : 0),
  cadastro: u => new Date(u.created_at).getTime() || 0,
};

let ordenacao = { col: 'cadastro', dir: 'desc' };

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

  const perfisMap = { 1: 'Administrador', 2: 'Gestão Escolar', 3: 'Professor', 4: 'Professor do AEE' };
  const currentUser = getCurrentUser();

  tbody.innerHTML = usuarios.map(u => {
    const ehProprio = currentUser && String(u.id) === String(currentUser.id);
    const perfilOptions = Object.entries(perfisMap)
      .map(([id, nome]) => `<option value="${id}" ${Number(id) === Number(u.perfil_id) ? 'selected' : ''}>${nome}</option>`)
      .join('');
    const dataCadastro = u.created_at ? new Date(u.created_at).toLocaleString('pt-BR') : '-';
    return `
      <tr>
        <td><strong>${u.nome}${ehProprio ? ' <small style="color:var(--sieac-text-muted)">(você)</small>' : ''}</strong></td>
        <td>${u.email}</td>
        <td>${u.matricula}</td>
        <td>
          <select class="perfil-select" data-id="${u.id}" data-nome="${u.nome}" data-perfil="${u.perfil_id}" ${ehProprio ? 'disabled title="Não é possível alterar o próprio perfil"' : ''} style="padding:4px 8px;border:1px solid var(--sieac-border);border-radius:var(--sieac-radius-sm);font-size:0.8rem;background:var(--sieac-bg);color:var(--sieac-text);">
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
            <button class="btn btn-sm btn-outline-primary usuario-toggle" data-id="${u.id}" data-nome="${u.nome}" data-ativo="${u.ativo}" style="border-radius:var(--sieac-radius-pill);font-size:0.75rem;padding:4px 12px;">
              ${u.ativo ? 'Desativar' : 'Ativar'}
            </button>
            <button class="btn btn-sm btn-outline-danger usuario-delete" data-id="${u.id}" data-nome="${u.nome}" style="border-radius:var(--sieac-radius-pill);font-size:0.75rem;padding:4px 12px;">
              <i class="bi bi-trash"></i>
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
      if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
      const { supabaseDelete } = await import('../services/supabase.js');
      const { error } = await supabaseDelete('usuarios', 'id', btn.dataset.id);
      if (error) {
        showToast('Erro ao excluir: ' + error, 'error');
      } else {
        registrarLog(LOG_ACTIONS.EXCLUIR_USUARIO, { usuario_id: btn.dataset.id, usuario_nome: btn.dataset.nome });
        showToast('Usuário excluído!', 'success');
        await carregarUsuarios();
      }
    });
  });
}
