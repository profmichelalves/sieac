# Política de Retenção e Eliminação de Dados — Arts. 15 e 16 LGPD

**SIEAC — Sistema de Indicadores Educacionais Abel Coelho**
**Atualização:** 2026-08-05

## 1. Princípios

- **Minimização (Art. 6º, III):** só se coleta o necessário à finalidade.
- **Eliminação (Art. 15):** dados pessoais são eliminados após o término do
  tratamento, salvo hipóteses legais de guarda obrigatória.
- **Prazo legal:** a documentação escolar (notas, frequência e diários) é
  preservada conforme a legislação de arquivamento escolar e as diretrizes do
  conselho de educação — nesses casos, o prazo de retenção acima vence o
  direito de eliminação (Art. 16, II).

## 2. Prazos de retenção

| Dado | Prazo | Fundamento |
|------|-------|------------|
| Senha (hash bcrypt) | Enquanto a conta existir; removida com a conta | Necessidade da autenticação |
| Usuários (nome, e-mail, matrícula, perfil) | Enquanto o vínculo funcional existir; após, 5 anos | Art. 7º, IV; vínculo institucional |
| Notas, frequência, alocações, turmas | Conforme arquivamento escolar (anos letivos + prazo do órgão de educação) | Art. 16, II |
| NEE (diagnósticos, professor AEE) | Enquanto o estudante estiver na escola + prazo de arquivamento; acesso apenas need-to-know | Art. 11, §1º; Art. 16, II |
| Logs de auditoria | 12 meses | Segurança (Art. 46) |
| Histórico de importações | 24 meses | Auditoria de operações |
| Sessão | Access token ~1h; refresh token 30 dias; revogada no logout | Necessidade mínima |

## 3. Critérios de eliminação

- Término do vínculo do usuário: conta desativada e, após o prazo, eliminada.
- Fim do prazo legal de arquivamento escolar: eliminação dos dados educacionais.
- Pedido do titular (Art. 18, VI) em que não incida guarda obrigatória: eliminação
  em até 15 dias úteis.

## 4. Procedimentos operacionais

- **Desativação/eliminação de usuários:** RPC `excluir_usuario` (somente admin);
  os logs do usuário são desvinculados (auditoria preservada).
- **Limpeza de dados educacionais:** RPC `limpar_dados` (somente admin) truncando
  tabelas na ordem de dependência.
- **Logs:** expiração por período (limpeza manual ou job futuro).

## 5. Registro

As operações de eliminação são registradas em `logs` (ação, responsável, tabela e
quantidade de registros) para fins de prestação de contas à ANPD.
