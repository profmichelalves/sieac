-- SIEAC - Migration 009: Professor Conselheiro por turma
-- Define qual professor é o conselheiro de cada turma (docente responsável por
-- articular os dados de aproveitamento e comportamento para o Conselho de Classe).
--
-- Usa os identificadores externos id_turma (turmas.id_turma) e id_pessoa
-- (professores.id_pessoa), pois a importação os recria com os mesmos valores.
-- Assim a tabela persiste mesmo após truncar e reimportar turmas/professores.

CREATE TABLE IF NOT EXISTS turma_conselheiros (
    id SERIAL PRIMARY KEY,
    id_turma INTEGER NOT NULL,
    id_pessoa INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(id_turma)
);

CREATE INDEX IF NOT EXISTS idx_turma_conselheiros_pessoa ON turma_conselheiros(id_pessoa);

ALTER TABLE turma_conselheiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_turma_conselheiros" ON turma_conselheiros FOR SELECT TO anon USING (true);
CREATE POLICY "auth_insert_turma_conselheiros" ON turma_conselheiros FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_update_turma_conselheiros" ON turma_conselheiros FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_turma_conselheiros" ON turma_conselheiros FOR DELETE TO anon USING (true);
