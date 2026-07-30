-- SIEAC - Migration 002: INSERT/UPDATE policies for reference tables
-- Permite que a importação insira dados em todas as tabelas

CREATE POLICY "auth_insert_escolas" ON escolas FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_update_escolas" ON escolas FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "auth_insert_etapas" ON etapas_ensino FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_update_etapas" ON etapas_ensino FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "auth_insert_series" ON series FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_update_series" ON series FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "auth_insert_turmas" ON turmas FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_update_turmas" ON turmas FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "auth_insert_professores" ON professores FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_update_professores" ON professores FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "auth_insert_componentes" ON componentes_curriculares FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_update_componentes" ON componentes_curriculares FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "auth_insert_estudantes" ON estudantes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_update_estudantes" ON estudantes FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "auth_insert_alocacoes" ON alocacoes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_update_alocacoes" ON alocacoes FOR UPDATE TO anon USING (true) WITH CHECK (true);
