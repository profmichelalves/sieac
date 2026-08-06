-- SIEAC - Migration 017: Migração para Supabase Auth (GoTrue)
-- Substitui o JWT próprio HS256 (011/012) pelo Supabase Auth. O PostgREST do
-- projeto decodifica apenas ES256 (JWKS do projeto); o token HS256 emitido em
-- 012 é rejeitado com PGRST301. A tabela usuarios permanece como perfil/rol
-- local, agora vinculada a auth.users e com os claims lidos de app_metadata.
--
-- ORDEM: aplicar 014 (migração dos hashes para bcrypt) ANTES desta migration.
--
-- Regras de decisão de acesso passam a usar:
--   - auth.uid()            -> sub do GoTrue (uuid)
--   - auth.jwt() -> 'app_metadata'
--     * perfil_id (id local em perfis)
--     * user_id   (id local em usuarios)
--     * matricula
--     * nome

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 0. Vínculo usuarios -> auth.users
-- ---------------------------------------------------------------------------
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_auth_user_id ON usuarios(auth_user_id);

-- ---------------------------------------------------------------------------
-- 1. Helpers de autorização (lidos nas expressões de RLS)
--    Agora leem app_metadata do JWT do GoTrue. user_id fica em app_metadata
--    (e não via subconsulta em usuarios) para evitar recursão infinita nas
--    políticas da própria tabela usuarios.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sieac_perfil_id()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'perfil_id', '')::INTEGER
$$;

CREATE OR REPLACE FUNCTION sieac_user_id()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'user_id', '')::INTEGER
$$;

CREATE OR REPLACE FUNCTION sieac_e_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT sieac_perfil_id() = (SELECT id FROM perfis WHERE nome = 'Administrador' LIMIT 1)
$$;

CREATE OR REPLACE FUNCTION sieac_e_gestao()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT sieac_perfil_id() IN (
      SELECT id FROM perfis WHERE nome IN ('Administrador', 'Gestao Escolar')
  )
$$;

-- professores.id do usuário autenticado, descoberto pela matrícula (mesma
-- lógica do getProfessorVinculo no frontend). NULL para quem não é professor.
CREATE OR REPLACE FUNCTION sieac_professor_id()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT p.id
    FROM professores p
   WHERE regexp_replace(COALESCE(p.matricula, ''), '[^0-9]', '', 'g') =
         regexp_replace(COALESCE(auth.jwt() -> 'app_metadata' ->> 'matricula', ''), '[^0-9]', '', 'g')
   LIMIT 1
$$;

-- ---------------------------------------------------------------------------
-- 2. Importação de contas existentes para auth.users
--    encrypted_password recebe o hash bcrypt (GoTrue aceita $2a$); email é
--    marcado como confirmado para não depender de e-mail de confirmação.
--    Hashes legados em texto puro ganham senha aleatória (não copiar texto
--    puro para auth.users): a 014 deve ter convertido tudo antes.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
    created_at, updated_at
)
SELECT
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    lower(trim(u.email)),
    CASE WHEN u.senha_hash LIKE '$2%' THEN u.senha_hash
         ELSE crypt(gen_random_uuid()::text, gen_salt('bf', 10)) END,
    NOW(),
    '', '', '', '',
    jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email'),
        'perfil_id', u.perfil_id,
        'matricula', u.matricula,
        'nome', u.nome
    ),
    jsonb_build_object('nome', u.nome),
    false, false,
    u.created_at, NOW()
FROM usuarios u
WHERE lower(trim(u.email)) NOT IN (SELECT lower(email) FROM auth.users WHERE email IS NOT NULL)
ON CONFLICT DO NOTHING;

-- Vincula usuarios.auth_user_id ao auth.users recém-criado (ou já existente).
UPDATE usuarios u
SET auth_user_id = (
    SELECT au.id FROM auth.users au WHERE lower(au.email) = lower(trim(u.email)) LIMIT 1
)
WHERE u.auth_user_id IS NULL;

-- Sincroniza app_metadata (perfil/matricula/nome/user_id) para todos os
-- usuários vinculados, inclusive os já existentes em auth.users.
UPDATE auth.users au
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'perfil_id', u.perfil_id,
    'matricula', u.matricula,
    'nome', u.nome,
    'user_id', u.id
)
FROM usuarios u
WHERE u.auth_user_id = au.id
  AND (au.raw_app_meta_data IS NULL OR NOT (au.raw_app_meta_data ? 'user_id'));

-- ---------------------------------------------------------------------------
-- 3. registrar_usuario: além da linha em usuarios, cria o usuário no GoTrue
--    (mesmo hash bcrypt, email confirmado, app_metadata com perfil/matricula).
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
    v_senha_hash TEXT;
    v_auth_id UUID;
    v_user_id INTEGER;
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

    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_norm_email LIMIT 1) THEN
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

    v_senha_hash := crypt(p_senha, gen_salt('bf', 10));

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
        created_at, updated_at
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(), 'authenticated', 'authenticated', v_norm_email, v_senha_hash,
        NOW(), '', '', '', '',
        jsonb_build_object(
            'provider', 'email',
            'providers', jsonb_build_array('email'),
            'perfil_id', v_perfil_final,
            'matricula', v_matricula,
            'nome', p_nome
        ),
        jsonb_build_object('nome', p_nome),
        false, false, NOW(), NOW()
    )
    RETURNING id INTO v_auth_id;

    INSERT INTO usuarios (nome, email, matricula, senha_hash, perfil_id, ativo, auth_user_id, created_at, updated_at)
    VALUES (p_nome, v_norm_email, v_matricula, v_senha_hash, v_perfil_final, v_ativado, v_auth_id, NOW(), NOW())
    RETURNING id INTO v_user_id;

    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('user_id', v_user_id)
    WHERE id = v_auth_id;

    RETURN QUERY SELECT true, v_ativado, NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_usuario(TEXT, TEXT, TEXT, TEXT, INTEGER) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. atualizar_usuario: mantém os claims do GoTrue em sincronia
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
DECLARE
    v_auth_id UUID;
    v_perfil_id INTEGER;
BEGIN
    IF NOT sieac_e_admin() THEN
        RAISE EXCEPTION 'Acesso negado: somente administradores.';
    END IF;

    UPDATE usuarios
       SET perfil_id = COALESCE(p_perfil_id, perfil_id),
           ativo     = COALESCE(p_ativo, ativo),
           updated_at = NOW()
     WHERE id = p_id
     RETURNING auth_user_id, perfil_id INTO v_auth_id, v_perfil_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Usuário não encontrado.';
        RETURN;
    END IF;

    IF v_auth_id IS NOT NULL THEN
        UPDATE auth.users
           SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('perfil_id', v_perfil_id)
         WHERE id = v_auth_id;
    END IF;

    RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION atualizar_usuario(INTEGER, INTEGER, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. excluir_usuario: também remove a conta do GoTrue (sessões caem)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION excluir_usuario(p_id INTEGER)
RETURNS TABLE(success BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
    v_auth_id UUID;
BEGIN
    IF NOT sieac_e_admin() THEN
        RAISE EXCEPTION 'Acesso negado: somente administradores.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = p_id) THEN
        RETURN QUERY SELECT false, 'Usuário não encontrado.';
        RETURN;
    END IF;

    SELECT auth_user_id INTO v_auth_id FROM usuarios WHERE id = p_id;

    -- Mantém a trilha de auditoria: desvincula os logs do usuário excluído.
    UPDATE logs SET usuario_id = NULL WHERE usuario_id = p_id;
    DELETE FROM usuarios WHERE id = p_id;

    IF v_auth_id IS NOT NULL THEN
        DELETE FROM auth.identities WHERE user_id = v_auth_id;
        DELETE FROM auth.sessions WHERE user_id = v_auth_id;
        DELETE FROM auth.users WHERE id = v_auth_id;
    END IF;

    RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION excluir_usuario(INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Verificação (opcional): usuários ainda sem auth_user_id
-- SELECT id, nome, email FROM usuarios WHERE auth_user_id IS NULL;
-- ---------------------------------------------------------------------------
