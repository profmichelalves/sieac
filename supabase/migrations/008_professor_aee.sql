-- SIEAC - Migration 008: Perfil "Professor do AEE"
-- Novo perfil de usuário que enxerga apenas os estudantes a ele vinculados
-- pela tabela estudante_professores_aee.

INSERT INTO perfis (nome) VALUES ('Professor do AEE')
ON CONFLICT (nome) DO NOTHING;
