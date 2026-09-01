# SIEAC — Sistema de Indicadores Educacionais

*Transformando dados em decisões educacionais.*

O SIEAC é uma plataforma web para acompanhamento dos indicadores educacionais da escola. Ele reúne em um só lugar o desempenho acadêmico, a frequência, os estudantes com necessidades educacionais especiais (NEE) e o atendimento do professor de AEE, transformando os dados da escola em painéis visuais, indicadores e relatórios que apoiam a gestão escolar.

**Acesso:** [https://profmichelalves.github.io/sieac/](https://profmichelalves.github.io/sieac/)

---

## Diferenciais

O SIEAC vai além do registro de notas e frequência: transforma os dados da escola em **indicadores e previsões acionáveis**, apoiando a gestão na identificação precoce de riscos e na promoção de equidade.

- **Decisão baseada em dados, não em achismo** — indicadores consolidados (média, aprovação, frequência, dispersão) reunidos em um único painel, prontos para a tomada de decisão.
- **Análise estatística e preditiva embutida** — estatística descritiva (mediana, desvio-padrão, coeficiente de variação, quartis, outliers e curva de Gauss) e preditiva (regressão logística para risco de reprovação, k-means para perfis de risco e regressão linear para tendência de frequência), tudo calculado em **JavaScript puro**, sem dependências ou custos adicionais.
- **Foco em inclusão e equidade (NEE/AEE)** — compara desempenho, frequência e aprovação entre estudantes **com e sem NEE**, por tipo de necessidade e por professor de AEE, evidenciando lacunas que passariam despercebidas.
- **Situação do estudante automatizada** — Aprovado/Recuperação/Reprovado calculado automaticamente pela regra real (frequência < 75% e quantidade de disciplinas abaixo de 6,0), eliminando o levantamento manual.
- **Dados em tempo real** — os indicadores e as Estatísticas sempre refletem os filtros atuais, sem cache ou dados desatualizados.
- **Acesso por perfil com escopo de dados** — Administrador, Gestão, Professor e Professor do AEE enxergam apenas o que lhes compete, com as ações críticas auditadas em Logs.
- **Importação de planilhas e limpeza de dados** — importação de notas e frequência a partir de planilhas, reduzindo o trabalho de digitação.
- **100% na nuvem** — backend em **Supabase** (PostgreSQL com autenticação e políticas de segurança) e plataforma publicada em **GitHub Pages**, acessível de qualquer lugar, com tema claro/escuro.

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
| Estatísticas | ✔ | ✔ | ✔¹ | ✔² |

¹ Professor enxerga apenas as turmas em que está alocado (e os estudantes com notas/frequência nelas).

² Professor do AEE enxerga somente os **estudantes vinculados ao seu cadastro de usuário** (perfil 'Professor do AEE'). Se o vínculo não for encontrado ou não houver estudantes vinculados, o sistema exibe, após o login, um aviso pedindo para entrar em contato com um usuário da **Gestão Escolar**.

---

## Funcionalidades gerais

- **Login e cadastro de conta** — acesso por email e senha. É impedida a duplicidade de email/matrícula. No perfil **Professor**, a matrícula é validada no cadastro de professores e a conta é ativada **automaticamente** quando a matrícula e o nome conferem; caso contrário, aguarda liberação pelo administrador. No perfil **Professor do AEE**, a matrícula **não** precisa existir no cadastro de professores, e a conta aguarda **ativação pelo administrador**. Demais perfis seguem a liberação pelo administrador.
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
- **Aprovação / Recuperação / Reprovação / Sem Notas Lançadas** — classificam os estudantes conforme a frequência e a quantidade de disciplinas abaixo de 6,0. Cada card tem botão **PDF** com a lista de estudantes (no PDF de **Em Aprovação/Aprovados**, os estudantes são ordenados por **Média Geral** e depois por **Frequência**).
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
- **Informações do Estudante** — nome, matrícula, turma, série, turno, necessidades (NEE), professor de AEE (exibidas como badges) e a **Situação** (Aprovado/Em Aprovação, Recuperação/Em Recuperação ou Reprovado/Em Reprovação), calculada pela frequência total e pela quantidade de disciplinas abaixo de 6,0, com **Frequência total (%)** e **Disciplinas abaixo da média**.
- **Notas por Disciplina** — bimestres, média acumulada e situação por disciplina, com ordenação por clique nas colunas.
- **Evolução — Frequência Mensal** (gráfico de linha) — bolinhas **vermelhas** quando o percentual é menor que 75%.
- **Evolução — Média por Bimestre** (gráfico de linha) — bolinhas **verdes** (média ≥ 6) e **vermelhas** (média < 6).
- Botão **Gerar PDF** com os dados do estudante.

---

## Estatísticas

A seção **Estatísticas** reúne indicadores estatísticos e preditivos calculados em tempo real a partir dos filtros aplicados (sem cache), acessível a **todos** os perfis — com o escopo de dados por papel (Professor e Professor do AEE veem apenas os seus estudantes). Todos os indicadores são calculados em **JavaScript puro**, sem dependências adicionais. Está organizada em 5 abas:

### Dispersão
- **Média, Mediana, Desvio-padrão e Coeficiente de Variação (CV)** por turma, com badge colorido de dispersão (baixa/média/alta).
- **Boxplot (quartis e outliers)** por turma, em CSS puro.
- **Gráfico de dispersão Frequência x Média Final** com linha de **regressão linear** e coeficiente de correlação de Pearson.
- **Matriz de risco** cruzando frequência (< 75%) com reprovação/recurso.

### Distribuição
- **Histograma das Médias** (barras por faixa) com **curva de Gauss** (distribuição normal) sobreposta a partir da média e do desvio-padrão dos dados.
- **Boxplot geral** e indicadores de assimetria/cauda.

### Evolução
- **Evolução entre bimestres** — contagem de estudantes que subiram (Δ > 0,5), caíram (Δ < -0,5) ou se mantiveram, usando o **primeiro e o último bimestre disponíveis** de cada estudante.
- **Estudantes que mais evoluíram / regrediram** — tabela com as notas por bimestre e a variação (Δ).
- **Disciplinas Críticas** — disciplinas com maior percentual de estudantes abaixo de 6,0 (cor reflete o coeficiente de variação).
- **Ranking por Professor** — média, aprovação e quantidade de alocações.

### Equidade NEE
- Comparativo **Com NEE vs Sem NEE** (quantidade, média, frequência e aprovação).
- **Aprovação por Tipo de Necessidade**.
- **Indicadores por Professor de AEE**.

### Predição
- **Risco estimado de reprovação (Top 20)** — probabilidade calculada por **regressão logística** quando há dados suficientes (com fallback heurístico calibrado), considerando média e frequência.
- **Perfis de Risco (k-means)** — agrupamento automático em 3 perfis por média/frequência, com rótulos descritivos e resumo abaixo do gráfico.
- **Alerta de Frequência (tendência)** — estudantes com frequência média abaixo de 75% ou em queda acentuada (regressão linear sobre os meses).

Todas as tabelas da seção possuem **ordenação por coluna** (clique no cabeçalho alterna crescente/decrescente; terceiro clique restaura a ordem original).

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
- Paginação, botão **Limpar Todos os Logs** e botão **Excluir Logs Filtrados** (remove apenas os registros exibidos pelos filtros atuais).

---

## Tecnologias envolvidas

- Interface web responsiva, com **tema claro/escuro**.
- **HTML, CSS e JavaScript** — com as bibliotecas Bootstrap (componentes visuais), Chart.js (gráficos), jsPDF (relatórios em PDF) e SheetJS (leitura de planilhas).
- **Supabase** — backend como serviço: banco de dados **PostgreSQL** com políticas de segurança (RLS), **autenticação** por email/senha e **API REST** consumida pelo frontend.
- Publicado na internet em **GitHub Pages**.
