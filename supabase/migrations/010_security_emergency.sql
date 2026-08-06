-- SIEAC - Migration 010: SECURITY EMERGENCY HOTFIX
-- Fecha escrita anon (F-02), TRUNCATE anon e leitura de usuarios/logs.
-- Mantém SELECT anon temporário nas tabelas educacionais até a Fase 1 (JWT/RLS).

-- 1. Remove registro sentinela inserido pelo pentest (F-02 PoC)
DELETE FROM estudantes WHERE nome = '__security_test__';

-- 2. Derruba TODAS as políticas TO anon de leitura/escrita
--    (001_schema.sql, 002_rls_insert_policies.sql, 006_logs.sql, 007_necessidades.sql)
DROP POLICY IF EXISTS "anon_insert_usuarios" ON usuarios;
DROP POLICY IF EXISTS "anon_select_usuarios" ON usuarios;
DROP POLICY IF EXISTS "anon_select_perfis" ON perfis;
DROP POLICY IF EXISTS "auth_update_usuarios" ON usuarios;
DROP POLICY IF EXISTS "auth_delete_usuarios" ON usuarios;

DROP POLICY IF EXISTS "auth_insert_escolas" ON escolas;
DROP POLICY IF EXISTS "auth_update_escolas" ON escolas;
DROP POLICY IF EXISTS "auth_insert_etapas" ON etapas_ensino;
DROP POLICY IF EXISTS "auth_update_etapas" ON etapas_ensino;
DROP POLICY IF EXISTS "auth_insert_series" ON series;
DROP POLICY IF EXISTS "auth_update_series" ON series;
DROP POLICY IF EXISTS "auth_insert_turmas" ON turmas;
DROP POLICY IF EXISTS "auth_update_turmas" ON turmas;
DROP POLICY IF EXISTS "auth_insert_professores" ON professores;
DROP POLICY IF EXISTS "auth_update_professores" ON professores;
DROP POLICY IF EXISTS "auth_insert_componentes" ON componentes_curriculares;
DROP POLICY IF EXISTS "auth_update_componentes" ON componentes_curriculares;
DROP POLICY IF EXISTS "auth_insert_estudantes" ON estudantes;
DROP POLICY IF EXISTS "auth_update_estudantes" ON estudantes;
DROP POLICY IF EXISTS "auth_insert_alocacoes" ON alocacoes;
DROP POLICY IF EXISTS "auth_update_alocacoes" ON alocacoes;

DROP POLICY IF EXISTS "auth_insert_notas" ON notas;
DROP POLICY IF EXISTS "auth_insert_frequencias" ON frequencias;
DROP POLICY IF EXISTS "auth_insert_importacoes" ON importacoes;

DROP POLICY IF EXISTS "auth_insert_logs" ON logs;
DROP POLICY IF EXISTS "auth_select_logs" ON logs;

DROP POLICY IF EXISTS "anon_select_tipo_necessidades" ON tipo_necessidades;
DROP POLICY IF EXISTS "anon_insert_tipo_necessidades" ON tipo_necessidades;
DROP POLICY IF EXISTS "anon_update_tipo_necessidades" ON tipo_necessidades;
DROP POLICY IF EXISTS "anon_delete_tipo_necessidades" ON tipo_necessidades;
DROP POLICY IF EXISTS "anon_select_estudante_necessidades" ON estudante_necessidades;
DROP POLICY IF EXISTS "anon_insert_estudante_necessidades" ON estudante_necessidades;
DROP POLICY IF EXISTS "anon_update_estudante_necessidades" ON estudante_necessidades;
DROP POLICY IF EXISTS "anon_delete_estudante_necessidades" ON estudante_necessidades;
DROP POLICY IF EXISTS "anon_select_estudante_professores_aee" ON estudante_professores_aee;
DROP POLICY IF EXISTS "anon_insert_estudante_professores_aee" ON estudante_professores_aee;
DROP POLICY IF EXISTS "anon_update_estudante_professores_aee" ON estudante_professores_aee;
DROP POLICY IF EXISTS "anon_delete_estudante_professores_aee" ON estudante_professores_aee;

-- 3. Remove o RPC de TRUNCATE anon (F-01: limpar_dados SECURITY DEFINER + GRANT anon)
REVOKE EXECUTE ON FUNCTION limpar_dados FROM anon;
DROP FUNCTION IF EXISTS limpar_dados(TEXT[]);

-- 4. Revoga privilégios de escrita anon e leitura sensível
REVOKE INSERT, UPDATE, DELETE ON usuarios, perfis, logs FROM anon;
REVOKE SELECT ON usuarios, logs FROM anon;

-- 5. Sem políticas TO anon restantes (auditoria):
-- SELECT c.relname, p.polname, p.polroles
-- FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
-- WHERE 'anon' = ANY (p.polroles::regrole[]);
