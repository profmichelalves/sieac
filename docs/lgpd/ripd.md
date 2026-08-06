# Relatório de Impacto à Proteção de Dados (RIPD) — Art. 38 LGPD

**SIEAC — Sistema de Indicadores Educacionais Abel Coelho**
**Versão:** 1.0 · **Data:** 2026-08-05
**Natureza do tratamento:** controlador (instituição pública de ensino)
**Base legal:** Art. 7º, IV; Art. 23–26; dados de saúde: Art. 11, II

---

## 1. Necessidade e proporcionalidade

O SIEAC processa dados pessoais de estudantes e servidores para cálculo de
indicadores educacionais, apoio ao Conselho de Classe e atendimento educacional
especializado (NEE). O tratamento é necessário ao cumprimento das políticas
públicas de educação e não há alternativa menos invasiva que alcance a mesma
finalidade sem a utilização dos dados indicados.

## 2. Riscos identificados (pré-medidas)

| Risco | Probabilidade | Impacto | Severidade |
|-------|---------------|---------|------------|
| Exposição de dados sensíveis (NEE) e CPF a não autorizados | Alta (RLS aberto ao `anon`) | Alto | **Crítico** |
| Inserção de dados por não autenticados (data poisoning) | Alta | Médio | Alto |
| Autenticação 100% client-side (sessão forjável) | Alta | Alto | Alto |
| Stored XSS via dados injetados | Média | Alto | Crítico |
| Vazamento de senhas em texto puro | Alta | Alto | Alto |
| Transferência internacional (Supabase/EUA) sem salvaguarda | Média | Alto | Alto |

## 3. Medidas implementadas

1. **Acesso (RLS por perfil)** — migrations `010`–`013`: nenhuma política `TO anon`;
   leitura de NEE restrita a gestão, professor AEE vinculado e professor das turmas
   do aluno; escrita de dados sensíveis apenas via RPC com checagem de papel (`016`).
2. **Autenticação** — Supabase Auth (GoTrue): `signInWithPassword` com bcrypt,
   access token de curta duração e refresh token; `usuarios` vinculada a
   `auth.users` e migração de contas existentes preservando os hashes bcrypt
   (`017`). O JWT próprio HS256 (`011`/`012`) foi descartado porque o PostgREST
   do projeto decodifica apenas ES256.
3. **Encriptação** — CPF e e-mail de logs em AES-256 (`015`); senhas sempre bcrypt.
   *Decisão documentada:* NEE não é criptografado por coluna porque a FK
   `estudante_necessidades.estudante_id` inviabiliza a criptografia determinística
   sem quebrar joins; a proteção é o RLS need-to-know + RPCs.
4. **XSS** — `escapeHtml` em `helpers.js` e aplicação nos pontos de renderização
   dinâmica; vetor de origem (INSERT anon) eliminado.
5. **Cabeçalhos de segurança** — `public/_headers` (CSP, nosniff, X-Frame-Options,
   Referrer-Policy, Permissions-Policy, HSTS). *Limitação:* GitHub Pages não
   suporta cabeçalhos personalizados.
6. **Trilha de auditoria** — `logs` com e-mail criptografado, leitura somente admin.
7. **Transferência internacional** — encriptação em repouso + cláusulas contratuais
   padrão com o operador Supabase (EUA).

## 4. Riscos residuais

| Risco residual | Avaliação | Mitigação |
|----------------|-----------|-----------|
| Contas legadas só migram se o hash já estiver em bcrypt | Baixo | `014` converte previamente; falhas de import são revistas manualmente |
| CSP com `unsafe-inline` (estilos/handlers do template legado) | Aceitável (transitório) | Fase 4: remover estilos/handlers inline e endurecer a CSP |
| GitHub Pages não envia headers | Aceitável | Publicar via Netlify/Cloudflare Pages quando houver infraestrutura |
| Encarregado ainda não indicado | Aceitável (prazo legal) | Aviso de privacidade marca o DPO como pendente |

## 5. Recomendações contínuas

- Rotação periódica da anon key e revisão das chaves de assinatura do Supabase
  Auth (Fase 2 do plano de segurança).
- Indicar formalmente o Encarregado (DPO) e publicar o contato.
- Reavaliar este RIPD a cada mudança relevante no tratamento (novos dados,
  nova finalidade, troca de operador).
- Rever a conveniência de manter o provedor na região EUA ou de adotar região BR.

## 6. Conclusão

Com as medidas acima, o risco residual geral é **baixo** para o contexto de uma
instituição pública de educação, permanecendo o tratamento proporcional e
aderente aos Arts. 6º, 7º, 11, 23–26, 37, 38 e 46 da LGPD.
