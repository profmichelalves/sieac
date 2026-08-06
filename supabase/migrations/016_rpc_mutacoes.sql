-- SIEAC - Migration 016: RPCs de mutação com checagem de papel (Fase 2)
-- Remove do cliente as escritas diretas (supabaseUpsert/supabaseDelete) em
-- tabelas sensíveis: usuarios, NEE e turma_conselheiros. Todos os RPCs são
-- SECURITY DEFINER (rodam como owner) e validam o papel via claims do JWT.

-- ---------------------------------------------------------------------------
-- NEE: salvar_necessidades — gestão ou professor do AEE vinculado
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION salvar_necessidades(
    p_estudante_id INTEGER,
    p_tipo_ids INTEGER[] DEFAULT '{}',
    p_professor_aee_id INTEGER DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
    v_tipo INTEGER;
    v_aee_id INTEGER := (SELECT id FROM perfis WHERE nome = 'Professor do AEE' LIMIT 1);
BEGIN
    IF NOT sieac_e_gestao() THEN
        -- Professor do AEE só altera estudantes a ele vinculados
        IF sieac_perfil_id() = v_aee_id AND EXISTS (
            SELECT 1 FROM estudante_professores_aee epa
             WHERE epa.estudante_id = p_estudante_id
               AND epa.professor_id = sieac_professor_id()
        ) THEN
            NULL;
        ELSE
            RETURN QUERY SELECT false, 'Acesso negado: apenas gestão escolar ou professor do AEE vinculado.';
            RETURN;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM estudantes WHERE id = p_estudante_id) THEN
        RETURN QUERY SELECT false, 'Estudante não encontrado.';
        RETURN;
    END IF;

    DELETE FROM estudante_necessidades WHERE estudante_id = p_estudante_id;

    FOREACH v_tipo IN ARRAY COALESCE(p_tipo_ids, '{}')
    LOOP
        INSERT INTO estudante_necessidades (estudante_id, tipo_necessidade_id)
        VALUES (p_estudante_id, v_tipo)
        ON CONFLICT (estudante_id, tipo_necessidade_id) DO NOTHING;
    END LOOP;

    IF p_professor_aee_id IS NULL THEN
        DELETE FROM estudante_professores_aee WHERE estudante_id = p_estudante_id;
    ELSE
        INSERT INTO estudante_professores_aee (estudante_id, professor_id)
        VALUES (p_estudante_id, p_professor_aee_id)
        ON CONFLICT (estudante_id)
        DO UPDATE SET professor_id = EXCLUDED.professor_id;
    END IF;

    RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION salvar_necessidades(INTEGER, INTEGER[], INTEGER) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION salvar_necessidades(INTEGER, INTEGER[], INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- Usuários: atualizar/excluir somente admin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION atualizar_usuario(
    p_id INTEGER,
    p_perfil_id INTEGER DEFAULT NULL,
    p_ativo BOOLEAN DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
    IF NOT sieac_e_admin() THEN
        RAISE EXCEPTION 'Acesso negado: somente administradores.';
    END IF;

    UPDATE usuarios
       SET perfil_id = COALESCE(p_perfil_id, perfil_id),
           ativo     = COALESCE(p_ativo, ativo),
           updated_at = NOW()
     WHERE id = p_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Usuário não encontrado.';
        RETURN;
    END IF;

    RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION atualizar_usuario(INTEGER, INTEGER, BOOLEAN) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION atualizar_usuario(INTEGER, INTEGER, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION excluir_usuario(p_id INTEGER)
RETURNS TABLE(success BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
    IF NOT sieac_e_admin() THEN
        RAISE EXCEPTION 'Acesso negado: somente administradores.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = p_id) THEN
        RETURN QUERY SELECT false, 'Usuário não encontrado.';
        RETURN;
    END IF;

    -- Mantém a trilha de auditoria: desvincula os logs do usuário excluído.
    UPDATE logs SET usuario_id = NULL WHERE usuario_id = p_id;

    DELETE FROM usuarios WHERE id = p_id;
    RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION excluir_usuario(INTEGER) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION excluir_usuario(INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- Conselheiro de turma: somente gestão
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION salvar_conselheiro(p_id_turma INTEGER, p_id_pessoa INTEGER)
RETURNS TABLE(success BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
    IF NOT sieac_e_gestao() THEN
        RAISE EXCEPTION 'Acesso negado: somente gestão escolar/administrador.';
    END IF;

    IF p_id_pessoa IS NULL THEN
        DELETE FROM turma_conselheiros WHERE id_turma = p_id_turma;
    ELSE
        INSERT INTO turma_conselheiros (id_turma, id_pessoa)
        VALUES (p_id_turma, p_id_pessoa)
        ON CONFLICT (id_turma)
        DO UPDATE SET id_pessoa = EXCLUDED.id_pessoa;
    END IF;

    RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION salvar_conselheiro(INTEGER, INTEGER) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION salvar_conselheiro(INTEGER, INTEGER) TO authenticated;
