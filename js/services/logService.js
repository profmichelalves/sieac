import { supabaseUpsert } from './supabase.js';
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
  IMPORTAR_NOTAS: 'importar_notas',
  IMPORTAR_FREQUENCIA: 'importar_frequencia',
  LIMPAR_DADOS: 'limpar_dados',
  GERAR_PDF: 'gerar_pdf',
};

export async function registrarLog(acao, detalhes = null) {
  try {
    const user = getCurrentUser();
    const entry = {
      usuario_id: user?.id || null,
      usuario_nome: user?.nome || 'Anônimo',
      email: user?.email || null,
      acao,
      detalhes: detalhes || {},
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    };
    await supabaseUpsert('logs', [entry]);
  } catch {
    // logs nunca devem interromper o fluxo principal
  }
}
