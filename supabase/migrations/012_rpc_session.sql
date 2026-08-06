-- SIEAC - Migration 012: Sessão JWT própria (HS256)
-- O auth_login passa a emitir um JWT assinado com o segredo do projeto. O
-- frontend guarda o token e o envia como "Authorization: Bearer <jwt>", o que
-- faz o PostgREST tratar a requisição como role "authenticated" e habilitar as
-- políticas RLS por perfil criadas na migration 013.
--
-- IMPORTANTE: app_secret.jwt_secret PRECISA ser o MESMO valor do "JWT Secret"
-- do projeto Supabase (Dashboard > Settings > API > JWT Secret), senão o
-- PostgREST rejeita o token com 401. A migration tenta ler o valor de
-- current_setting('app.settings.jwt_secret') (configurado via config.toml
-- [auth] jwt_secret); se não existir, gera um valor aleatório e o operador
-- deve alinhá-lo manualmente (ver Fase 2 - rotação).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- app_secret: chaves e segredos que NUNCA devem ser expostos por REST/RLS.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_secret (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO app_secret (key, value)
SELECT 'jwt_secret',
       COALESCE(NULLIF(current_setting('app.settings.jwt_secret', true), ''), gen_random_uuid()::text)
ON CONFLICT (key) DO NOTHING;

REVOKE ALL ON app_secret FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------------
-- Helpers base64url e emissão de JWT (uso interno; não expostos via REST).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION url_encode(data BYTEA)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT rtrim(replace(replace(encode(data, 'base64'), '+', '-'), '/', '_'), '=')
$$;

CREATE OR REPLACE FUNCTION jwt_emit(p_id INTEGER, p_perfil_id INTEGER, p_nome TEXT, p_matricula TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
    v_secret TEXT;
    v_header TEXT;
    v_payload TEXT;
    v_signing_input TEXT;
    v_sig TEXT;
BEGIN
    SELECT value INTO v_secret FROM app_secret WHERE key = 'jwt_secret';
    IF v_secret IS NULL THEN
        RAISE EXCEPTION 'app_secret.jwt_secret não configurado';
    END IF;

    v_header := url_encode(convert_to('{"alg":"HS256","typ":"JWT"}', 'UTF8'));
    v_payload := url_encode(convert_to(json_build_object(
        -- Kong (gateway do Supabase) exige iss/ref idênticos ao do projeto,
        -- senão rejeita o token com 401 mesmo com assinatura válida.
        'iss', 'supabase',
        'ref', 'hoxqkdxtaplbwlznakjg',
        'role', 'authenticated',
        'sub', p_id::text,
        'perfil_id', p_perfil_id,
        'nome', p_nome,
        'matricula', COALESCE(p_matricula, ''),
        'iat', floor(extract(epoch FROM now()))::bigint,
        'exp', floor(extract(epoch FROM now() + interval '4 hours'))::bigint
    )::text, 'UTF8'));

    v_signing_input := v_header || '.' || v_payload;
    v_sig := url_encode(hmac(convert_to(v_signing_input, 'UTF8'), convert_to(v_secret, 'UTF8'), 'sha256'));

    RETURN v_signing_input || '.' || v_sig;
END;
$$;

REVOKE ALL ON FUNCTION url_encode(BYTEA) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION jwt_emit(INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- auth_login agora também devolve o token de sessão (claims: role
-- authenticated, sub, perfil_id, nome, matricula, iat, exp 4h). Nunca devolve
-- senha_hash.
--
-- O CREATE OR REPLACE abaixo muda o tipo de retorno (adiciona a coluna token),
-- o que o PostgreSQL não permite via REPLACE (erro 42P13). Por isso a função é
-- dropada e recriada; o GRANT ao final reestabelece a permissão de execução.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS auth_login(TEXT, TEXT);
CREATE OR REPLACE FUNCTION auth_login(p_email TEXT, p_senha TEXT)
RETURNS TABLE(
    id INTEGER,
    nome TEXT,
    email TEXT,
    matricula TEXT,
    perfil_id INTEGER,
    ativo BOOLEAN,
    token TEXT
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
    SELECT u.id, u.nome::text, u.email::text, u.matricula::text, u.perfil_id, u.ativo,
           jwt_emit(u.id, u.perfil_id, u.nome, u.matricula);
END;
$$;

GRANT EXECUTE ON FUNCTION auth_login(TEXT, TEXT) TO anon, authenticated;
