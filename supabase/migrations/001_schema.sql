-- SIEAC - Sistema de Indicadores Educacionais Abel Coelho
-- PostgreSQL Schema Migration

-- 1. USERS & AUTH
CREATE TABLE perfis (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO perfis (nome) VALUES ('Administrador'), ('Gestao Escolar'), ('Professor');

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    matricula VARCHAR(50) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    perfil_id INTEGER REFERENCES perfis(id) NOT NULL DEFAULT 2,
    ativo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_matricula ON usuarios(matricula);

-- 2. DADOS EDUCACIONAIS
CREATE TABLE escolas (
    id SERIAL PRIMARY KEY,
    direc_id INTEGER,
    direc VARCHAR(255),
    municipio_id INTEGER,
    municipio VARCHAR(255),
    id_escola INTEGER,
    nome VARCHAR(500) NOT NULL,
    inep VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(id_escola)
);

CREATE TABLE etapas_ensino (
    id SERIAL PRIMARY KEY,
    id_etapa INTEGER UNIQUE,
    nome VARCHAR(500) NOT NULL,
    periodicidade VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE series (
    id SERIAL PRIMARY KEY,
    id_serie INTEGER UNIQUE,
    nome VARCHAR(100) NOT NULL,
    etapa_ensino_id INTEGER REFERENCES etapas_ensino(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE turmas (
    id SERIAL PRIMARY KEY,
    id_turma INTEGER UNIQUE,
    nome VARCHAR(100) NOT NULL,
    serie_id INTEGER REFERENCES series(id),
    turno VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_turmas_serie ON turmas(serie_id);

CREATE TABLE professores (
    id SERIAL PRIMARY KEY,
    id_pessoa INTEGER UNIQUE,
    matricula VARCHAR(50),
    vinculo VARCHAR(100),
    nome VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE componentes_curriculares (
    id SERIAL PRIMARY KEY,
    id_componente INTEGER UNIQUE,
    nome VARCHAR(500) NOT NULL,
    periodicidade VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE estudantes (
    id SERIAL PRIMARY KEY,
    id_pessoa INTEGER UNIQUE,
    cpf VARCHAR(20),
    nome VARCHAR(500) NOT NULL,
    matricula VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_estudantes_matricula ON estudantes(matricula);

CREATE TABLE alocacoes (
    id SERIAL PRIMARY KEY,
    professor_id INTEGER REFERENCES professores(id),
    turma_id INTEGER REFERENCES turmas(id),
    componente_id INTEGER REFERENCES componentes_curriculares(id),
    data_inicio DATE,
    data_fim DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(professor_id, turma_id, componente_id, data_inicio)
);

CREATE INDEX idx_alocacoes_professor ON alocacoes(professor_id);
CREATE INDEX idx_alocacoes_turma ON alocacoes(turma_id);
CREATE INDEX idx_alocacoes_componente ON alocacoes(componente_id);

CREATE TABLE notas (
    id SERIAL PRIMARY KEY,
    estudante_id INTEGER REFERENCES estudantes(id) NOT NULL,
    alocacao_id INTEGER REFERENCES alocacoes(id) NOT NULL,
    nota_1bim NUMERIC(5,1),
    nota_2bim NUMERIC(5,1),
    nota_3bim NUMERIC(5,1),
    nota_4bim NUMERIC(5,1),
    media_anual NUMERIC(5,1),
    exame_final NUMERIC(5,1),
    av_especial NUMERIC(5,1),
    media_final NUMERIC(5,1),
    resultado_final VARCHAR(50),
    aproveitamento VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(estudante_id, alocacao_id)
);

CREATE INDEX idx_notas_estudante ON notas(estudante_id);
CREATE INDEX idx_notas_alocacao ON notas(alocacao_id);

CREATE TABLE frequencias (
    id SERIAL PRIMARY KEY,
    estudante_id INTEGER REFERENCES estudantes(id) NOT NULL,
    turma_id INTEGER REFERENCES turmas(id) NOT NULL,
    mes_referencia VARCHAR(50),
    ano_letivo INTEGER,
    aulas_previstas INTEGER,
    aulas_dadas INTEGER,
    presencas INTEGER,
    percentual_frequencia NUMERIC(5,1),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(estudante_id, turma_id, mes_referencia)
);

CREATE INDEX idx_frequencias_estudante ON frequencias(estudante_id);
CREATE INDEX idx_frequencias_turma ON frequencias(turma_id);

CREATE TABLE importacoes (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    arquivo VARCHAR(500),
    registros INTEGER DEFAULT 0,
    inseridos INTEGER DEFAULT 0,
    atualizados INTEGER DEFAULT 0,
    erros INTEGER DEFAULT 0,
    erros_detalhes TEXT,
    tempo_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. ROW LEVEL SECURITY
-- Habilita RLS em todas as tabelas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE escolas ENABLE ROW LEVEL SECURITY;
ALTER TABLE etapas_ensino ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE professores ENABLE ROW LEVEL SECURITY;
ALTER TABLE componentes_curriculares ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE alocacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE frequencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE importacoes ENABLE ROW LEVEL SECURITY;

-- Políticas para autenticação anônima (registro e login)
CREATE POLICY "anon_insert_usuarios" ON usuarios FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_usuarios" ON usuarios FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_perfis" ON perfis FOR SELECT TO anon USING (true);

-- Políticas para leitura de dados educacionais (qualquer usuário autenticado)
CREATE POLICY "auth_select_escolas" ON escolas FOR SELECT TO anon USING (true);
CREATE POLICY "auth_select_etapas" ON etapas_ensino FOR SELECT TO anon USING (true);
CREATE POLICY "auth_select_series" ON series FOR SELECT TO anon USING (true);
CREATE POLICY "auth_select_turmas" ON turmas FOR SELECT TO anon USING (true);
CREATE POLICY "auth_select_professores" ON professores FOR SELECT TO anon USING (true);
CREATE POLICY "auth_select_componentes" ON componentes_curriculares FOR SELECT TO anon USING (true);
CREATE POLICY "auth_select_estudantes" ON estudantes FOR SELECT TO anon USING (true);
CREATE POLICY "auth_select_alocacoes" ON alocacoes FOR SELECT TO anon USING (true);
CREATE POLICY "auth_select_notas" ON notas FOR SELECT TO anon USING (true);
CREATE POLICY "auth_select_frequencias" ON frequencias FOR SELECT TO anon USING (true);
CREATE POLICY "auth_select_importacoes" ON importacoes FOR SELECT TO anon USING (true);

-- Políticas para inserção/atualização de dados (importação)
CREATE POLICY "auth_insert_notas" ON notas FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_insert_frequencias" ON frequencias FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_insert_importacoes" ON importacoes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_update_usuarios" ON usuarios FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_usuarios" ON usuarios FOR DELETE TO anon USING (true);
