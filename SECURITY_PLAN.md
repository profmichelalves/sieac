# Plano de Segurança e Conformidade LGPD — SIEAC

Status: **EM EXECUÇÃO** (aprovado em 2026-08-05)
Fonte: `exemplos_arquivos_importacao\relatório de segurança.txt` (pentest black-box, risco geral **Crítico**, OWASP WSTG)
+ auditoria própria de código e sondagem REST do projeto Supabase.

## Contexto e decisões tomadas

- **Escola/instituição pública** → base legal do tratamento: Art. 7º IV e Art. 23–26 da LGPD (políticas públicas), dispensa consentimento, mas exige RIPD (Art. 38) e medidas de segurança (Art. 46).
- **Rota de autenticação escolhida**: **Supabase Auth (GoTrue)** — migração em andamento (Fase 1.6). O JWT próprio HS256 provou-se inviável: o PostgREST do projeto decodifica apenas ES256 (JWKS do projeto), rejeitando o token emitido em `012` com `PGRST301`. A tabela `usuarios` permanece como perfil/rol local, vinculada a `auth.users`.
- **Encarregado (DPO)**: pendente de indicação pela direção (contato fica marcado como pendente no aviso de privacidade).
- **Acesso a NEE**: professor comum mantém visão dos nomes dos diagnósticos dos alunos das suas turmas (comportamento atual, agora enforce server-side via RLS).
- **Encriptação**: `estudantes.cpf`, `usuarios.senha_hash` (bcrypt, hash) e `logs.email`; dados NEE protegidos via RLS need-to-know (FK com join inviabiliza criptografia de coluna — documentado no RIPD).

## Achados confirmados (referência)

| ID | Achado | Severidade |
|----|--------|------------|
| F-01 | RLS aberto ao `anon` + `senha_hash` em texto puro expostos via REST | Crítico (CVSS 9.8) |
| F-02 | INSERT sem autenticação (data poisoning); sentinela `__security_test__` inserido na `estudantes` | Alto (CVSS 8.1) |
| F-03 | Autenticação/autorização 100% client-side (`localStorage.sieac_user` forjável) | Alto (CVSS 8.0) |
| F-04 | Headers HTTP de segurança ausentes | Médio (CVSS 5.3) |
| F-05 | Stored XSS: `tipo_necessidades` aceita INSERT anon + nomes injetados via `innerHTML` sem escape | Crítico (LGPD Art. 11/46 + XSS) |
| LGPD | Dados de menores (CPF), dados sensíveis de saúde (NEE) e transferência internacional (Supabase/EUA) sem salvaguardas | Sanção Art. 52 (até R$ 50 MM) |

## Fase 0 — Emergência (24h)

1. `supabase/migrations/010_security_emergency.sql`
   - Remove o registro sentinela `__security_test__` de `estudantes`.
   - Derruba todas as políticas `TO anon` de SELECT/INSERT/UPDATE/DELETE de `001_schema.sql`, `002_rls_insert_policies.sql`, `006_logs.sql`, `007_necessidades.sql`.
   - `REVOKE EXECUTE ON FUNCTION limpar_dados FROM anon`.
   - Revoga `INSERT/UPDATE/DELETE` anon em `usuarios`, `perfis`, `logs`; revoga `SELECT` anon em `usuarios` e `logs`.
   - Mantém temporariamente o SELECT anon nas tabelas educacionais (janela de risco documentada) até a Fase 1.
2. `supabase/migrations/011_rpc_auth_login.sql`
   - RPC `auth_login(p_email, p_senha)` `SECURITY DEFINER` com bcrypt (`pgcrypto crypt`).
   - Fallback de migração: hash atual não-bcrypt (ex.: `Lince.79`) é comparado em texto puro e migrado na hora para bcrypt.
   - Retorna `id, nome, email, matricula, perfil_id, ativo` — nunca `senha_hash`.
3. `js/services/authService.js`
   - `login()` passa a chamar `supabaseRpc('auth_login', { email, senha })`; remove o `SELECT senha_hash` do cliente.

## Fase 1 — JWT próprio + RLS por perfil (72h)

> **Status:** aplicada como ponte de emergência; **a emissão própria de JWT HS256 foi
> substituída pela Fase 1.6 (Supabase Auth)** — o `012` permanece apenas enquanto a
> migração GoTrue não é concluída.

1. `supabase/migrations/012_rpc_session.sql`
   - `auth_login` emite JWT (HS256 via pgcrypto `hmac`), claims: `role:'authenticated'`, `sub`, `perfil_id`, `nome`, `iat`, `exp` (4h).
   - Segredo guardado em `app_secret` (`REVOKE ALL FROM anon, authenticated`), nunca exposto por REST.
2. `supabase/migrations/013_rls_perfil.sql`
   - Políticas por claim `auth.jwt() ->> 'perfil_id'`:
     - `usuarios`: SELECT/UPDATE próprio (`sub = auth.uid()`) ou admin; INSERT só via RPC `registrar_usuario`.
     - Referências (`perfis/escolas/etapas/series/turmas/professores/componentes/importacoes`): SELECT `TO authenticated`.
     - `estudantes/notas/frequencias/alocacoes`: SELECT `TO authenticated`.
     - NEE (`estudante_necessidades`, `tipo_necessidades`, `estudante_professores_aee`): SELECT gestão/AEE + professor das turmas do aluno; escrita gestão/AEE via RPC.
     - `logs`: INSERT authenticated, SELECT admin.
   - `limpar_dados` recriado: SECURITY DEFINER + `SET search_path` + somente admin + allowlist com `format(%I)`.
   - Nenhuma política `TO anon` restante.
3. `supabase/migrations/014_migra_senhas.sql`
   - Converte todos os hashes restantes para bcrypt (`crypt(gen_salt('bf'))`).
4. `js/services/supabase.js` + `js/router.js`
   - Header `Authorization: Bearer <jwt>`; interceptor 401 → redireciona ao login; autorização lida da sessão (não de objeto forjável).

## Fase 1.6 — Migração para Supabase Auth (GoTrue)

**Motivo:** o PostgREST do projeto decodifica apenas ES256 (JWKS do projeto); o JWT
HS256 de `012` é rejeitado com `PGRST301`. A anon key e o `jwt_secret` legado HS256
continuam válidos somente no gateway (Kong).

1. `supabase/migrations/017_supabase_auth.sql`
   - Importa `usuarios` existentes para `auth.users`: `encrypted_password` recebe o
     hash bcrypt de `usuarios.senha_hash` (GoTrue aceita bcrypt `$2a$10$`);
     `app_metadata` com `perfil_id`, `matricula`, `nome`.
   - `usuarios.auth_user_id uuid unique references auth.users(id)`; trigger de
     sincronização (novo sign-up → linha em `usuarios`).
2. RLS/helpers (`013`, `016`): `sieac_perfil_id()`, `sieac_user_id()`,
   `sieac_e_admin()`, `sieac_e_gestao()`, `sieac_professor_id()` passam a ler de
   `auth.uid()` e de `auth.jwt() -> 'app_metadata' ->> 'perfil_id'`.
3. Frontend:
   - `js/services/supabase.js`: `Authorization: Bearer <access_token>` da sessão
     real (`supabase.auth.getSession()`); fim do token custom/localStorage.
   - `js/services/authService.js`: `signInWithPassword` / `signOut` /
     `onAuthStateChange`; fim do RPC `auth_login`.
   - `js/router.js` + `js/utils/helpers.js`: sessão via `supabase.auth`.
   - **Esqueci minha senha** (fluxo implicit do GoTrue): tela `#recuperar-senha`
     dispara `POST /auth/v1/recover`; o link do e-mail redireciona para
     `<site>#access_token=...&type=recovery`, que o router trata como
     `#redefinir-senha`; a nova senha é gravada via `PUT /auth/v1/update`.
     *Configuração necessária no painel:* Site URL e Redirect URL =
     `https://profmichelalves.github.io/sieac/`, Flow Type implicit, SMTP para
     entrega de e-mails. Usuários com hash legado em texto puro conseguem
     redefinir por este fluxo (o e-mail usa a conta `auth.users`).
   - **Reset por admin** (`018_rpc_resetar_senha.sql` + botão na tela de
     usuários): RPC `resetar_senha` SECURITY DEFINER (só admin) grava o novo
     hash bcrypt em `auth.users` e `usuarios` e revoga as sessões ativas —
     alternativa quando o usuário não tem acesso ao e-mail cadastrado.
4. Ao concluir: `auth_login` (011/012), `jwt_emit`, `app_secret.jwt_secret` e
   helpers legados desativados/removidos.

## Fase 1.5 — Encriptação de dados sensíveis (LGPD Art. 46/11)

1. `supabase/migrations/015_encriptar_sensiveis.sql`
   - `estudantes.cpf` → `pgp_sym_encrypt` (coluna não usada pela UI → sem impacto); RPC `sieac_decrypt_cpf` SECURITY DEFINER, somente admin/gestão.
   - `usuarios.senha_hash` → bcrypt (hash irreversível).
   - `logs.email` → encriptado; decript somente admin.
   - NEE: RLS need-to-know (FK impossibilita criptografia de coluna — ver RIPD).
   - Chave AES-256 em `app_secret`, nunca no bundle.

## Fase 2 — Endurecimento (7 dias)

1. Mutações finais via RPCs com checagem de papel; `supabaseUpsert/Delete` sensíveis removidos do cliente.
2. XSS: `helpers.js` ganha `escapeHtml`; `innerHTML` dinâmico substituído por construção de DOM segura.
3. `public/_headers`: CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
4. Rotação da anon key e do JWT secret.

## Fase 3 — Artefatos LGPD (`docs/lgpd/`)

1. `aviso_de_privacidade.md` — finalidade, base legal, direitos do titular, contato do encarregado (pendente).
2. `roppa.md` — registro das operações (Art. 37).
3. `ripd.md` — Relatório de Impacto à Proteção de Dados (Art. 38, obrigatório).
4. `comunicacao_incidente.md` — modelo de comunicação à ANPD/titulares (Art. 48).
5. `politica_retencao.md` — prazos de guarda e eliminação (Art. 15/16).

## Retest — critérios de aceite

- `usuarios?select=id,nome,email,matricula,senha_hash` anon → **401**.
- `estudante_necessidades?select=*` anon → **401**; professor comum só NEE da própria turma → demais **403**.
- `limpar_dados` anon → **403**; INSERT em `tipo_necessidades` anon → **401**.
- `__security_test__` removido; cpf ilegível no REST.
- **GoTrue:** login via `/auth/v1/token?grant_type=password` emite access token
  decodificável pelo PostgREST; `usuarios`/`logs`/NEE seguem **401/403** anon;
  logout revoga a sessão e redireciona ao login; `auth_login` bloqueado/removido.
- Regressão: Admin 18 disciplinas INFV3A, Professor 5, conselheiro 5/18 por escopo; `node --check` limpo.

## Arquivos

- Criar: `SECURITY_PLAN.md`, `010..018_*.sql`, `public/_headers`, `docs/lgpd/*`.
- Alterar: `js/services/supabase.js`, `authService.js`, `router.js`, `helpers.js`, `usuariosPage.js`, `importService.js`, `necessidadesRepository.js` + páginas com `innerHTML`.
