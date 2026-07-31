-- SIEAC - Migration 004: simplificação do schema para a importação v2
-- Remove tabelas e colunas que não são usadas na filtragem/relatórios.

-- Escola não é utilizada pelo sistema (filtros, dashboards ou relatórios)
DROP TABLE IF EXISTS escolas CASCADE;

-- Colunas que não alimentam nenhuma funcionalidade
ALTER TABLE etapas_ensino DROP COLUMN IF EXISTS periodicidade;
ALTER TABLE componentes_curriculares DROP COLUMN IF EXISTS periodicidade;
ALTER TABLE professores DROP COLUMN IF EXISTS vinculo;
ALTER TABLE estudantes DROP COLUMN IF EXISTS cpf;

ALTER TABLE notas DROP COLUMN IF EXISTS media_anual;
ALTER TABLE notas DROP COLUMN IF EXISTS exame_final;
ALTER TABLE notas DROP COLUMN IF EXISTS av_especial;
ALTER TABLE notas DROP COLUMN IF EXISTS aproveitamento;

ALTER TABLE frequencias DROP COLUMN IF EXISTS ano_letivo;
ALTER TABLE frequencias DROP COLUMN IF EXISTS aulas_previstas;
ALTER TABLE frequencias DROP COLUMN IF EXISTS aulas_dadas;
ALTER TABLE frequencias DROP COLUMN IF EXISTS presencas;
