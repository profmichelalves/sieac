# SIEAC — Sistema de Indicadores Educacionais

*Transformando dados em decisões educacionais.*

O SIEAC é uma plataforma web para acompanhamento dos indicadores educacionais da escola. Ele reúne em um só lugar o desempenho acadêmico, a frequência, os estudantes com necessidades educacionais especiais (NEE) e o atendimento do professor de AEE, transformando os dados da escola em painéis visuais, indicadores e relatórios que apoiam a gestão escolar.

**Acesso:** [https://profmichelalves.github.io/sieac/](https://profmichelalves.github.io/sieac/)

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

¹ Professor enxerga apenas as turmas em que está alocado (e os estudantes com notas/frequência nelas).

² Professor do AEE enxerga somente os **estudantes vinculados ao seu cadastro**. Se o vínculo não for encontrado ou não houver estudantes vinculados, o sistema exibe, após o login, um aviso pedindo para entrar em contato com um usuário da **Gestão Escolar**.

---

## Funcionalidades gerais

- **Login e cadastro de conta** — acesso por email e senha. No cadastro, a matrícula é validada no cadastro de professores (perfis Professor e Professor do AEE) e é impedida a duplicidade de email/matrícula. A conta é ativada **automaticamente** quando a matrícula e o nome conferem; caso contrário, aguarda liberação pelo administrador.
- **Controle de sessão** — login, logout e tentativas de login com falha são registrados nos Logs.
- **Tema claro/escuro** — alternância persistida no navegador.
- **Sidebar responsiva** — menu recolhível, filtrado conforme o perfil do usuário; colapso persistido.
- **Filtros compartilhados** — nas telas de dashboard e relatórios, um painel de filtros (Etapa, Série, Turma, Turno, Disciplina, Professor) com seleção persistida por perfil e restaurada ao reabrir a tela. Consulta por Estudante e Cadastro de Estudantes compartilham o filtro de turma + estudante.
- **PDFs** — todos os relatórios geram PDF respeitando os filtros e a ordenação aplicados.
- **Aviso para Professor do AEE** — banner amigável e fechável no Dashboard Geral quando o usuário não possui estudantes vinculados, orientando a contatar a Gestão Escolar.

---

## Dashboards

### Visão Geral da Escola (Dashboard Geral)
Indicadores consolidados com cards:
- **Estudantes** e **Turmas** (considerando os filtros/perfil).
- **Média Geral** — média das médias finais.
- **Frequência** — média dos percentuais de frequência.
- **Aprovação / Recuperação / Reprovação / Sem Notas Lançadas** — classificam os estudantes conforme a frequência e a quantidade de disciplinas abaixo de 6,0. Cada card tem botão **PDF** com a lista de estudantes.
- Gráficos: **Distribuição dos Resultados Finais** (donut) e **Média por Série** (barras).

### Análise de Desempenho
- **Evolução das Notas por Bimestre** (linha) — média das notas de cada bimestre.
- **Média por Disciplina** (barras horizontais).
- **Ranking — Média por Turma** (barras horizontais, com destaque ouro/prata/bronze).
- **Distribuição das Notas** (histograma por faixas de desempenho).

### Análise de Frequência
- Cards: **Frequência Média**, **Total de Registros**, **Freq. ≥ 75%** e demais faixas.
- Gráficos: **Frequência por Turma**, **por Série** e **por Mês** (linha).

### Análise Comparativa
- **Gráfico de dispersão Frequência x Média Final** — um ponto por estudante.
- **Quadrantes de Atenção** — classificação pelo cruzamento frequência/média:
  - Q1: freq ≥ 75% e média ≥ 6 (adequada);
  - Q2: freq ≥ 75% e média < 6 (dificuldade acadêmica);
  - Q3: freq < 75% e média < 6 (crítica);
  - Q4: freq < 75% e média ≥ 6 (falta sem comprometer a nota).
  - Cada quadrante possui botão **PDF** com a lista de estudantes.

### Consulta por Estudante
- Filtro por **turma** e busca por **nome ou matrícula**.
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
Lista os alunos com **disciplina(s) sem nenhuma nota lançada**. Cada linha informa a disciplina, a turma e o **professor responsável**. Ordenação por **Aluno**, **Disciplina** ou **Turma** e **PDF**.

### Relatório de Estudantes com NEE
Lista todos os estudantes com pelo menos uma necessidade educacional especial cadastrada, com turma(s) e professor de AEE responsável. Ordenação por colunas (Nome, Matrícula, Turma, Necessidades, Professor AEE) e **PDF** seguindo a mesma ordenação da tabela. Professores visualizam apenas os estudantes das suas turmas.

---

## Cadastro de Estudantes (Gestão Escolar / Administrador)

- Filtros por **turma** e busca por **nome ou matrícula**.
- Tabela com nome, matrícula, turma, necessidades e professor AEE.
- **Editar** um estudante abre um modal para marcar o(s) **tipo(s) de necessidade** e vincular o **professor de AEE** responsável (ou remover o vínculo).
- Alterações são registradas nos Logs.

---

## Importar Dados (Gestão Escolar / Administrador)

A plataforma importa os dados a partir de planilhas de **notas** e de **frequência** dos estudantes, convertendo-os em **Indicadores Educacionais** apresentados nos dashboards, gráficos e relatórios.

- **Notas dos Estudantes** — importa a planilha de acompanhamento de notas, associando estudantes, turmas, disciplinas e professores.
- **Frequência dos Estudantes** — importa a planilha de frequência, preenchendo o percentual por estudante, turma e mês de referência.
- Barra de **progresso** e **resumo** final da importação (inseridos, atualizados, ignorados e erros).
- **Histórico de Importações** — lista cada importação com seus detalhes.
- **Limpar Dados** — exclusão em lote das informações selecionadas, respeitando a ordem de dependências entre elas.

---

## Gerenciar Usuários (Administrador)

- Lista de usuários com **nome, email, matrícula, perfil, status e data de cadastro**, ordenável por colunas.
- **Alterar perfil**, **ativar/desativar** conta, **excluir** usuário e **redefinir senha** diretamente na lista.
- O próprio perfil não pode ser alterado (evita bloqueio acidental).
- Ações registradas nos Logs.

---

## Logs de Atividade (Administrador)

- Registra as ações críticas: login, tentativa de login, logout, cadastro, alteração de perfil, ativação/desativação/exclusão de usuário, redefinição de senha, importações, limpeza de dados, edição de necessidades e geração de PDFs.
- Filtros por **usuário/email**, **ação** e **período**.
- Paginação e botão **Limpar Todos os Logs**.

---

## Tecnologias envolvidas

- Interface web responsiva, com **tema claro/escuro**.
- **HTML, CSS e JavaScript** — com as bibliotecas Bootstrap (componentes visuais), Chart.js (gráficos), jsPDF (relatórios em PDF) e SheetJS (leitura de planilhas).
- **Supabase** — backend como serviço: banco de dados **PostgreSQL** com políticas de segurança (RLS), **autenticação** por email/senha e **API REST** consumida pelo frontend.
- Publicado na internet em **GitHub Pages**.
