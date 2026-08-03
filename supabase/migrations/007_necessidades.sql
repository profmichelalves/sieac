-- SIEAC - Migration 007: Necessidades Educacionais Especiais (NEE)
-- Tabela de tipos de necessidade + relacionamentos estudante <-> tipo e
-- estudante -> professor de AEE.

-- 1. Tipos de Necessidade (domínio)
CREATE TABLE tipo_necessidades (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Relacionamento estudante <-> tipo de necessidade (muitos para muitos)
CREATE TABLE estudante_necessidades (
    id SERIAL PRIMARY KEY,
    estudante_id INTEGER REFERENCES estudantes(id) NOT NULL,
    tipo_necessidade_id INTEGER REFERENCES tipo_necessidades(id) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(estudante_id, tipo_necessidade_id)
);

CREATE INDEX idx_estudante_necessidades_estudante ON estudante_necessidades(estudante_id);
CREATE INDEX idx_estudante_necessidades_tipo ON estudante_necessidades(tipo_necessidade_id);

-- 3. Relacionamento estudante -> professor de AEE (um professor por estudante)
CREATE TABLE estudante_professores_aee (
    id SERIAL PRIMARY KEY,
    estudante_id INTEGER REFERENCES estudantes(id) NOT NULL UNIQUE,
    professor_id INTEGER REFERENCES professores(id) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_estudante_professores_aee_professor ON estudante_professores_aee(professor_id);

-- 4. Seed dos tipos de necessidade (a partir do Relatorio_Estudantes_NEE.xlsx)
INSERT INTO tipo_necessidades (nome) VALUES
    ('Baixa Visão'),
    ('Deficiência Física'),
    ('Deficiência Intelectual'),
    ('Deficiência Múltipla'),
    ('Discalculia'),
    ('Dislexia'),
    ('Distúrbio do Processamento Auditivo Central (PAC)'),
    ('TDAH'),
    ('TEA'),
    ('Visão Monocular')
ON CONFLICT (nome) DO NOTHING;

-- 5. RLS
ALTER TABLE tipo_necessidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudante_necessidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudante_professores_aee ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_tipo_necessidades" ON tipo_necessidades FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_tipo_necessidades" ON tipo_necessidades FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_tipo_necessidades" ON tipo_necessidades FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_tipo_necessidades" ON tipo_necessidades FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_estudante_necessidades" ON estudante_necessidades FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_estudante_necessidades" ON estudante_necessidades FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_estudante_necessidades" ON estudante_necessidades FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_estudante_necessidades" ON estudante_necessidades FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_estudante_professores_aee" ON estudante_professores_aee FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_estudante_professores_aee" ON estudante_professores_aee FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_estudante_professores_aee" ON estudante_professores_aee FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_estudante_professores_aee" ON estudante_professores_aee FOR DELETE TO anon USING (true);
