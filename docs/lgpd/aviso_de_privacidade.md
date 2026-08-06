# Aviso de Privacidade — SIEAC

**Sistema de Indicadores Educacionais Abel Coelho (SIEAC)**
**Controlador:** Colégio Estadual Abel Coelho (instituição pública de ensino)
**Base legal:** Lei nº 13.709/2018 (LGPD), Art. 7º, IV e Art. 23–26 (políticas públicas)
**Atualização:** 2026-08-05

## 1. Quais dados tratamos

| Categoria | Dados | Finalidade |
|-----------|-------|------------|
| Identificação | Nome, e-mail, matrícula, perfil e CPF (estudantes) | Cadastro de usuários, autenticação, indicadores educacionais |
| Educacionais | Notas, frequência, turmas, séries, disciplinas, alocações | Cálculo de indicadores e relatórios pedagógicos |
| Saúde (sensíveis) | Necessidades Educacionais Especiais (NEE) e professor de AEE | Acompanhamento pedagógico especializado (Art. 11, II) |

## 2. Finalidade e necessidade

Os dados são utilizados exclusivamente para gestão dos indicadores educacionais da
escola, elaboração de relatórios pedagógicos e apoio ao Conselho de Classe. Não há
qualquer tratamento para finalidade comercial, publicidade ou compartilhamento com
terceiros.

## 3. Como protegemos os dados (Art. 46/47 LGPD)

- Senhas **bcrypt** (hash irreversível), nunca em texto puro.
- Autenticação por **Supabase Auth** (access token de curta duração e refresh
  token, com revogação de sessão ao sair).
- **Row Level Security (RLS)** no banco: cada perfil enxerga apenas o necessário
  (professor vê só os alunos das suas turmas; NEE somente gestão/AEE/professor das
  turmas do aluno).
- **CPF** e **e-mail em logs** criptografados (AES-256, `pgp_sym_encrypt`).
- Acesso a dados sensíveis restrito e auditável (logs de ação).

## 4. Direitos do titular (Art. 18)

Você pode solicitar: confirmação da existência do tratamento, acesso, correção,
anonimização, portabilidade, eliminação e informação sobre o compartilhamento.

## 5. Contato e Encarregado (DPO) — Art. 41

**Encarregado: pendente de indicação pela direção.**

Enquanto o encarregado não for designado, os pedidos de exercício de direitos e
as comunicações podem ser encaminhados à direção da escola pelo e-mail institucional
da unidade. A indicação formal do DPO será publicada neste documento assim que
ocorrer.
