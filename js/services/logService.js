import { supabaseRpc } from './supabase.js';
import { getCurrentUser } from './authService.js';

export const LOG_ACTIONS = {
  LOGIN: 'login',
  LOGIN_FALHA: 'login_falha',
  LOGOUT: 'logout',
  CADASTRO: 'cadastro',
  ALTERAR_PERFIL: 'alterar_perfil',
  ATIVAR_USUARIO: 'ativar_usuario',
  DESATIVAR_USUARIO: 'desativar_usuario',
  EXCLUIR_USUARIO: 'excluir_usuario',
  RESETAR_SENHA: 'resetar_senha',
  IMPORTAR_NOTAS: 'importar_notas',
  IMPORTAR_FREQUENCIA: 'importar_frequencia',
  LIMPAR_DADOS: 'limpar_dados',
  GERAR_PDF: 'gerar_pdf',
  EDITAR_NECESSIDADES: 'editar_necessidades',
  RELATORIO_NEE: 'relatorio_nee',
  VINCULAR_CONSELHEIRO: 'vincular_conselheiro',
};

export async function registrarLog(acao, detalhes = null) {
  try {
    const user = getCurrentUser();
    await supabaseRpc('registrar_log', {
      p_usuario_id: user?.id || null,
      p_usuario_nome: user?.nome || 'Anônimo',
      p_email: user?.email || null,
      p_acao: acao,
      p_detalhes: detalhes || {},
      p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch {
    // logs nunca devem interromper o fluxo principal
  }
}
