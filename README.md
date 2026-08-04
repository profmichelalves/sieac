# SIEAC — Sistema de Indicadores Educacionais Abel Coelho

Sistema web para acompanhamento dos indicadores educacionais do Colégio Abel Coelho: desempenho acadêmico, frequência, estudantes com necessidades educacionais especiais (NEE) e professor de Atendimento Educacional Especializado (AEE).

**Acesso:** [https://profmichelalves.github.io/sieac/](https://profmichelalves.github.io/sieac/)

> O SIEAC é um frontend estático (HTML/CSS/JS) publicado no GitHub Pages, com dados armazenados no Supabase (PostgreSQL + PostgREST).

---

## Perfis de usuário e permissões

| Funcionalidade | Administrador | Gestão Escolar | Professor | Professor do AEE |
|---|---|---|---|---|
| Dashboards (Geral, Desempenho, Frequência, Comparativo) | ✔ | ✔ | ✔¹ | ✔² |
| Consulta por Estudante | ✔ | ✔ | ✔¹ | ✔² |
| Relatório de Notas / Notas Não Lançadas | ✔ | ✔ | ✔¹ | ✔² |
| Relatório de Estudantes com NEE | ✔ | ✔ | ✔¹ | ✔² |
| Cadastro de Estudantes (NEE + Professor AEE) | ✔ | ✔ | – | – |
| Importar Dados | ✔ | ✔ | – | – |
| Gerenciar Usuários | ✔ | – | – | – |
| Logs de Atividade | ✔ | – | – | – |

¹ Professor enxerga apenas as turmas em que está alocado (e os estudantes com notas/frequência nelas). O PDF do relatório de NEE fica oculto para este perfil.

² Professor do AEE enxerga somente os **estudantes vinculados ao seu cadastro** (tabela `estudante_professores_aee`). Se o vínculo com a matrícula não for encontrado ou não houver estudantes vinculados, o sistema exibe, após o login, um aviso pedindo para entrar em contato com um usuário de perfil **Gestão Escolar** para realizar o vínculo.

---

## Funcionalidades gerais

- **Login e cadastro de conta** — acesso por email e senha. No cadastro, a matrícula é validada na tabela de professores (perfis Professor e Professor do AEE) e impedida duplicidade de email/matrícula. A conta é ativada **automaticamente** quando a matrícula e o nome conferem com a tabela de professores; caso contrário, aguarda liberação pelo administrador.
- **Controle de sessão** — login, logout e tentativas de login com falha são registrados nos Logs.
- **Tema claro/escuro** — alternância persistida no navegador.
- **Sidebar responsiva** — menu recolhível, filtrado conforme o perfil do usuário; colapso persistido.
- **Filtros compartilhados** — nas telas de dashboard e relatórios, um painel de filtros (Etapa, Série, Turma, Turno, Disciplina, Professor) com seleção persistida por perfil e restaurada ao reabrir a tela. Consulta por Estudante e Cadastro de Estudantes compartilham o filtro de **turma + estudante**.
- **PDFs** — todos os relatórios geram PDF (jsPDF) respeitando os filtros e a ordenação aplicados.
- **Aviso para Professor do AEE** — banner amigável e fechável no Dashboard Geral quando o usuário não possui estudantes vinculados, orientando a contatar a Gestão Escolar.

---

## Dashboards

### Visão Geral da Escola (Dashboard Geral)
Indicadores consolidados com cards:
- **Estudantes** e **Turmas** (considerando os filtros/perfil).
- **Média Geral** — média das médias finais (só disciplinas com nota lançada).
- **Frequência** — média dos percentuais de frequência.
- **Aprovação / Recuperação / Reprovação / Sem Notas Lançadas** — classificam os estudantes conforme a frequência (≥ 75%) e a quantidade de disciplinas abaixo de 6,0. Cada card tem botão **PDF** com a lista de estudantes.
- Gráficos: **Distribuição dos Resultados Finais** (donut) e **Média por Série** (barras).

### Desempenho Acadêmico
- **Evolução das Notas por Bimestre** (linha) — média das notas de cada bimestre (1º ao 4º).
- **Média por Disciplina** (barras horizontais).
- **Ranking — Média por Turma** (barras horizontais, com destaque ouro/prata/bronze).
- **Distribuição das Notas** (histograma por faixas 0–2, 2–4, 4–6, 6–8, 8–10).

### Frequência
- Cards: **Frequência Média**, **Total de Registros**, **Freq. ≥ 75%** e demais faixas.
- Gráficos: **Frequência por Turma**, **por Série** e **por Mês** (linha).

### Análise Combinada (Comparativo)
- **Gráfico de dispersão Frequência x Média Final** — um ponto por estudante.
- **Quadrantes de Atenção** — classificação pelo cruzamento frequência/média:
  - Q1: freq ≥ 75% e média ≥ 6 (adequada);
  - Q2: freq ≥ 75% e média < 6 (dificuldade acadêmica);
  - Q3: freq < 75% e média < 6 (crítica);
  - Q4: freq < 75% e média ≥ 6 (falta sem comprometer a nota).
  - Cada quadrante possui botão **PDF** com a lista de estudantes.

### Consulta por Estudante
- Filtro por **turma** e busca por **nome ou matrícula** (filtros compartilhados com o Cadastro).
- **Informações do Estudante** — nome, matrícula, turma, série, turno, necessidades (NEE) e professor de AEE (exibidas como badges).
- **Notas por Disciplina** — bimestres, média acumulada e situação por disciplina.
- **Frequência Mensal** — percentual por mês com status (OK quando ≥ 75%).
- **Evolução — Média por Bimestre** (gráfico de linha).
- Botão **Gerar PDF** com os dados do estudante.

---

## Relatórios

### Relatório de Notas
Lista os alunos com **média final abaixo de 6,0**, uma linha por disciplina/turma/aluno, respeitando os filtros. Ordenação por **Disciplina**, **Turma** ou **Aluno** e geração de **PDF**.

### Relatório de Notas Não Lançadas
Lista os alunos com **disciplina(s) sem nenhuma nota lançada** (nenhum bimestre preenchido e média final vazia — uma nota 0 lançada não conta como vazia). Cada linha informa a disciplina, a turma e o **professor responsável**. Ordenação por **Aluno**, **Disciplina** ou **Turma** e **PDF**.

### Relatório de Estudantes com NEE
Lista todos os estudantes com pelo menos uma necessidade educacional especial cadastrada, com turma(s) e professor de AEE responsável. Ordenação por colunas (Nome, Matrícula, Turma, Necessidades, Professor AEE) e **PDF** seguindo a mesma ordenação da tabela. Professores visualizam apenas os estudantes das suas turmas.

---

## Cadastro de Estudantes (Gestão Escolar / Administrador)

- Filtros por **turma** e busca por **nome ou matrícula** (compartilhados com a Consulta por Estudante).
- Tabela com nome, matrícula, turma, necessidades e professor AEE.
- **Editar** um estudante abre um modal para marcar o(s) **tipo(s) de necessidade** e vincular o **professor de AEE** responsável (ou remover o vínculo).
- Alterações são registradas nos Logs.

---

## Importar Dados (Gestão Escolar / Administrador)

- **Notas dos Estudantes** — importa o relatório de acompanhamento de notas (`.xlsx`), associando estudantes, turmas, disciplinas e professores. Registros existentes são atualizados (upsert).
- **Frequência dos Estudantes** — importa o relatório de frequência (`.xlsx`), preenchendo o percentual por estudante, turma e mês de referência.
- Barra de **progresso** e **resumo** final com inseridos, atualizados, ignorados e erros (com motivos).
- **Histórico de Importações** — lista cada importação com detalhes de processamento.
- **Limpar Dados** — exclusão em lote das tabelas selecionadas (Notas, Frequência, Alocações, Estudantes, Turmas, Professores, Componentes, Séries, Etapas), respeitando a ordem de dependências (filhos primeiro).

---

## Gerenciar Usuários (Administrador)

- Lista de usuários com **nome, email, matrícula, perfil, status e data de cadastro**, ordenável por colunas.
- **Alterar perfil**, **ativar/desativar** conta e **excluir** usuário diretamente na lista.
- O próprio perfil não pode ser alterado (evita bloqueio acidental).
- Perfis carregados dinamicamente do banco (sem id fixo). Ações registradas nos Logs.

---

## Logs de Atividade (Administrador)

- Registra as ações críticas: login, tentativa de login, logout, cadastro, alteração de perfil, ativação/desativação/exclusão de usuário, importações, limpeza de dados, edição de necessidades e geração de PDFs.
- Filtros por **usuário/email**, **ação** e **período** (De/Até convertidos para UTC, cobrindo o dia local completo).
- Paginação e botão **Limpar Todos os Logs**.

---

## Estrutura técnica

- **Frontend:** HTML5, CSS3 (variáveis de tema), JavaScript moderno em ES Modules, Bootstrap 5, Chart.js, jsPDF + autotable, SheetJS (XLSX).
- **Backend de dados:** Supabase (PostgreSQL + PostgREST) — tabelas: `usuarios`, `perfis`, `professores`, `turmas`, `series`, `etapas_ensino`, `componentes_curriculares`, `alocacoes`, `notas`, `frequencias`, `estudantes`, `tipo_necessidades`, `estudante_necessidades`, `estudante_professores_aee`, `importacoes`, `logs`.
- **Autenticação** via `js/config.js` (URL do Supabase e chave anon — arquivo local, **não versionado**). Para executar localmente, crie `js/config.js` com:
  ```js
  export const SUPABASE_URL = '...';
  export const SUPABASE_ANON_KEY = '...';
  ```
- **Publicação:** GitHub Pages (branch `master`).

---

## Configuração e execução local

1. Clone o repositório e crie `js/config.js` com as credenciais do Supabase (acima).
2. Sirva a pasta como site estático (ex.: extensão "Live Server" do VS Code ou `npx http-server`).
3. Acesse a aplicação no navegador. Para dados de demonstração/validação, use a tela **Importar Dados**.

> Limitações conhecidas: a chave anon do Supabase não permite `DELETE` de linhas protegidas por RLS; remoções definitivas (ex.: registros de teste) exigem SQL direto no SQL Editor do Supabase.
