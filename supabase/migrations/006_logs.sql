-- SIEAC - Migration 006: tabela de logs de atividade do usuário
-- Registra ações críticas: autenticação, gestão de usuários, importações,
-- limpeza de dados e geração de relatórios PDF.

CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    usuario_nome VARCHAR(255),
    email VARCHAR(255),
    acao VARCHAR(100) NOT NULL,
    detalhes JSONB,
    ip VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_created_at ON logs(created_at);
CREATE INDEX idx_logs_usuario ON logs(usuario_id);
CREATE INDEX idx_logs_acao ON logs(acao);

ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_insert_logs" ON logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_select_logs" ON logs FOR SELECT TO anon USING (true);
