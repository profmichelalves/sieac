# Relatório de Operações de Tratamento de Dados Pessoais (ROPA) — Art. 37 LGPD

**SIEAC — Sistema de Indicadores Educacionais Abel Coelho**
**Atualização:** 2026-08-05
**Base legal dominante:** Art. 7º, IV e Art. 23–26 (políticas públicas de educação)

## Operações de tratamento

| # | Operação | Dados | Finalidade | Base legal | Retenção | Destinatários |
|---|----------|-------|-----------|------------|----------|---------------|
| 1 | Coleta/armazenamento de usuários | Nome, e-mail, matrícula, perfil, hash bcrypt de senha | Autenticação e autorização | Art. 7º, IV | Ver política de retenção | Supabase Auth (EUA), com cláusulas contratuais |
| 2 | Autenticação | E-mail + senha | Login | Art. 7º, IV | Transitório (access token ~1h; refresh 30 dias) | Supabase Auth |
| 3 | Indicadores de desempenho | Notas por bimestre, médias, resultados | Relatórios pedagógicos | Art. 7º, IV | Ver retenção | Corpo docente/gestão |
| 4 | Frequência | Percentual de frequência | Acompanhamento de frequência | Art. 7º, IV | Ver retenção | Corpo docente/gestão |
| 5 | NEE | Diagnósticos, vínculo com professor de AEE | Atendimento educacional especializado | Art. 11, II (Art. 7º, IV + Art. 11, §1º) | Ver retenção | Gestão, professor AEE, professor da turma |
| 6 | Auditoria | Logs de ação (login, cadastro, importação, limpeza, PDF) | Segurança e rastreabilidade | Art. 7º, IV c/c Art. 46 | Mínimo necessário | Somente admin |
| 7 | Exportação/PDF | Dados agregados e nominais | Relatórios institucionais | Art. 7º, IV | Impresso/PDF guardado conforme arquivo escolar | Direção |

## Fluxo e categorias de titulares

- **Titulares:** estudantes (menores de idade), professores, gestores e funcionários da escola.
- **Compartilhamento:** nenhum dado é vendido ou compartilhado com terceiros. O único
  operador é o provedor de hospedagem do banco (Supabase, região EUA) — transferência
  internacional mitigada com cláusulas contratuais padrão e encriptação em repouso.

## Medidas técnicas por operação

- Todas as tabelas com **RLS** por perfil (migrations `010`–`017`).
- Senhas **bcrypt**; autenticação por **Supabase Auth** (access token ~1h,
  refresh token 30 dias, sessão revogável).
- **CPF** e **e-mail de logs** criptografados (AES-256).
- Mutação de dados sensíveis apenas por **RPCs server-side** com checagem de papel.
