-- SIEAC - Migration 018: RPC resetar_senha (admin) — Supabase Auth
-- Define uma nova senha diretamente (sem depender do e-mail de recuperação),
-- mantendo auth.users e usuarios em sincronia e revogando as sessões ativas
-- do usuário (ele precisa entrar com a nova senha).

CREATE OR REPLACE FUNCTION resetar_senha(p_id INTEGER, p_nova_senha TEXT)
RETURNS TABLE(success BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
    v_auth_id UUID;
    v_senha_hash TEXT;
BEGIN
    IF NOT sieac_e_admin() THEN
        RAISE EXCEPTION 'Acesso negado: somente administradores.';
    END IF;

    IF p_nova_senha IS NULL OR length(p_nova_senha) < 4 THEN
        RETURN QUERY SELECT false, 'A senha deve ter no mínimo 4 caracteres.';
        RETURN;
    END IF;

    SELECT auth_user_id INTO v_auth_id FROM usuarios WHERE id = p_id;
    IF v_auth_id IS NULL THEN
        RETURN QUERY SELECT false, 'Usuário não encontrado ou sem vínculo com o Supabase Auth.';
        RETURN;
    END IF;

    v_senha_hash := crypt(p_nova_senha, gen_salt('bf', 10));

    UPDATE usuarios
       SET senha_hash = v_senha_hash,
           updated_at = NOW()
     WHERE id = p_id;

    UPDATE auth.users
       SET encrypted_password = v_senha_hash,
           email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
           updated_at = NOW()
     WHERE id = v_auth_id;

    -- Revoga as sessões ativas: o usuário precisa logar com a nova senha.
    DELETE FROM auth.sessions WHERE user_id = v_auth_id;

    RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION resetar_senha(INTEGER, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION resetar_senha(INTEGER, TEXT) TO authenticated;
