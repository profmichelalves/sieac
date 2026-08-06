-- SIEAC - Migration 011: RPC de login seguro (bcrypt server-side)
-- Substitui o SELECT senha_hash client-side. SECURITY DEFINER roda com privilégios
-- do owner (postgres), então pode ler usuarios mesmo sem políticas de SELECT.
-- Fallback de migração: hashes antigos em texto puro são comparados e migrados
-- na hora para bcrypt.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- O CREATE OR REPLACE abaixo não pode mudar o tipo de retorno (42P13) se o banco
-- já tiver a versão nova da migration 012 (que adiciona a coluna token). Dropa e
-- recria; a 012 reaplicada depois substitui por esta versão com token.
DROP FUNCTION IF EXISTS auth_login(TEXT, TEXT);

CREATE OR REPLACE FUNCTION auth_login(p_email TEXT, p_senha TEXT)
RETURNS TABLE(
    id INTEGER,
    nome TEXT,
    email TEXT,
    matricula TEXT,
    perfil_id INTEGER,
    ativo BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
    u usuarios%ROWTYPE;
BEGIN
    SELECT * INTO u FROM usuarios WHERE lower(usuarios.email) = lower(p_email) LIMIT 1;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF u.senha_hash LIKE '$2%' THEN
        -- Já é bcrypt
        IF crypt(p_senha, u.senha_hash) <> u.senha_hash THEN
            RETURN;
        END IF;
    ELSE
        -- Hash antigo em texto puro: compara e migra para bcrypt na hora
        IF p_senha <> u.senha_hash THEN
            RETURN;
        END IF;
        UPDATE usuarios
           SET senha_hash = crypt(p_senha, gen_salt('bf', 10)),
               updated_at = NOW()
         WHERE id = u.id;
    END IF;

    RETURN QUERY
    SELECT u.id, u.nome::text, u.email::text, u.matricula::text, u.perfil_id, u.ativo;
END;
$$;

-- Executável por anon (login é público), mas nunca expõe senha_hash
GRANT EXECUTE ON FUNCTION auth_login(TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- registrar_log: INSERT em logs sem expor a tabela via REST
-- Executável por qualquer chamador autenticado; grava trilha de auditoria.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_log(
    p_usuario_id INTEGER,
    p_usuario_nome TEXT,
    p_email TEXT,
    p_acao TEXT,
    p_detalhes JSONB DEFAULT '{}',
    p_user_agent TEXT DEFAULT NULL,
    p_ip TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
    INSERT INTO logs (usuario_id, usuario_nome, email, acao, detalhes, user_agent, ip)
    VALUES (p_usuario_id, p_usuario_nome, p_email, p_acao, COALESCE(p_detalhes, '{}'), p_user_agent, p_ip);
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_log(INTEGER, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- registrar_usuario: cadastro público de professor/AEE/gestão com bcrypt
-- Replica server-side as regras hoje em authService.register (matrícula deve
-- existir em professores; perfil limitado a professor/AEE/gestão; ativação
-- automática quando nome confere). SECURITY DEFINER para gravar em usuarios.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_usuario(
    p_nome TEXT,
    p_email TEXT,
    p_matricula TEXT,
    p_senha TEXT,
    p_perfil_id INTEGER
)
RETURNS TABLE(success BOOLEAN, ativado_automaticamente BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
    v_matricula TEXT := regexp_replace(coalesce(p_matricula, ''), '[^0-9]', '', 'g');
    v_norm_email TEXT := lower(trim(p_email));
    v_existente INTEGER;
    v_perfil perfis%ROWTYPE;
    v_perfil_final INTEGER;
    v_norm_nome TEXT;
    v_prof professores%ROWTYPE;
    v_ativado BOOLEAN := false;
    v_norm_func TEXT;
BEGIN
    IF v_norm_email = '' OR p_senha IS NULL OR length(p_senha) < 4 THEN
        RETURN QUERY SELECT false, false, 'Dados inválidos.';
        RETURN;
    END IF;

    SELECT id INTO v_existente FROM usuarios WHERE lower(email) = v_norm_email LIMIT 1;
    IF v_existente IS NOT NULL THEN
        RETURN QUERY SELECT false, false, 'Este email já está cadastrado. Faça login ou use outro email.';
        RETURN;
    END IF;

    SELECT * INTO v_perfil FROM perfis WHERE id = p_perfil_id;
    IF NOT FOUND THEN
        SELECT * INTO v_perfil FROM perfis WHERE lower(nome) = 'professor' LIMIT 1;
    END IF;

    v_norm_func := lower(translate(v_perfil.nome,
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
        'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'));
    IF v_norm_func NOT IN ('professor', 'professor do aee', 'gestao escolar') THEN
        v_perfil_final := (SELECT id FROM perfis WHERE lower(nome) = 'professor' LIMIT 1);
    ELSE
        v_perfil_final := v_perfil.id;
    END IF;

    IF v_perfil_final IS NULL THEN
        v_perfil_final := (SELECT id FROM perfis WHERE id = 3 LIMIT 1);
    END IF;

    -- Matrícula precisa existir em professores para professor/AEE
    IF v_norm_func IN ('professor', 'professor do aee') THEN
        SELECT * INTO v_prof FROM professores
         WHERE regexp_replace(coalesce(matricula, ''), '[^0-9]', '', 'g') = v_matricula
         LIMIT 1;
        IF NOT FOUND THEN
            RETURN QUERY SELECT false, false, 'Matrícula não encontrada na tabela de professores. Cadastro não permitido.';
            RETURN;
        END IF;

        v_norm_nome := lower(regexp_replace(trim(coalesce(p_nome, '')), '\s+', ' ', 'g'));
        v_norm_func := lower(regexp_replace(trim(coalesce(v_prof.nome, '')), '\s+', ' ', 'g'));
        IF v_norm_nome = v_norm_func THEN
            v_ativado := true;
        END IF;
    END IF;

    INSERT INTO usuarios (nome, email, matricula, senha_hash, perfil_id, ativo, created_at, updated_at)
    VALUES (p_nome, v_norm_email, v_matricula, crypt(p_senha, gen_salt('bf', 10)), v_perfil_final, v_ativado, NOW(), NOW());

    RETURN QUERY SELECT true, v_ativado, NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_usuario(TEXT, TEXT, TEXT, TEXT, INTEGER) TO anon, authenticated;
