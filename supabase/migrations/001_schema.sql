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

-- 3. VIEWS PARA DASHBOARDS
CREATE VIEW vw_resumo_escola AS
SELECT
    COUNT(DISTINCT e.id) as total_estudantes,
    COUNT(DISTINCT t.id) as total_turmas,
    COUNT(DISTINCT p.id) as total_professores,
    ROUND(AVG(n.media_final)::numeric, 1) as media_geral,
    ROUND(AVG(f.percentual_frequencia)::numeric, 1) as frequencia_media,
    COUNT(DISTINCT CASE WHEN n.resultado_final = 'APROVADO' THEN n.estudante_id END) as aprovados,
    COUNT(DISTINCT CASE WHEN n.resultado_final = 'REPROVADO' THEN n.estudante_id END) as reprovados
FROM estudantes e
LEFT JOIN notas n ON e.id = n.estudante_id
LEFT JOIN frequencias f ON e.id = f.estudante_id
LEFT JOIN turmas t ON t.id = f.turma_id
LEFT JOIN professores p ON p.id IS NOT NULL;
