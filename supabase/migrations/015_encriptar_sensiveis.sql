-- SIEAC - Migration 015: Encriptação de dados sensíveis (LGPD Art. 46/11)
-- - estudantes.cpf        → pgp_sym_encrypt (AES-256 via app_secret.pgp_key)
-- - usuarios.senha_hash   → bcrypt (já irreversível, migrations 011/014)
-- - logs.email            → pgp_sym_encrypt; decript somente admin (RPC listar_logs)
-- - NEE: protegido por RLS need-to-know (FK impede criptografia de coluna — ver RIPD)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Chave AES-256 para pgp_sym_encrypt/decrypt. NUNCA sai do banco (não há
-- política de SELECT e não é exposta por RPC).
INSERT INTO app_secret (key, value)
SELECT 'pgp_key', encode(gen_random_bytes(32), 'hex')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1. estudantes.cpf
-- A migration 004 removeu a coluna cpf de estudantes. As funções abaixo são
-- criadas de qualquer forma (o corpo só é avaliado em tempo de execução) e o
-- trigger/UPDATE só são criados se a coluna existir de fato — evita o erro
-- 42P01 em bancos cujo schema seguiu a 004.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enc_cpf()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE v_key TEXT;
BEGIN
    IF NEW.cpf IS NOT NULL AND NEW.cpf <> '' AND left(NEW.cpf, 9) <> '-----BEGIN' THEN
        SELECT value INTO v_key FROM app_secret WHERE key = 'pgp_key';
        NEW.cpf := pgp_sym_encrypt(NEW.cpf::text, v_key);
    END IF;
    RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'estudantes'
                AND column_name = 'cpf') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_enc_cpf ON estudantes';
    EXECUTE 'CREATE TRIGGER trg_enc_cpf BEFORE INSERT OR UPDATE OF cpf ON estudantes FOR EACH ROW EXECUTE FUNCTION enc_cpf()';
    -- Migra valores já gravados em texto puro.
    EXECUTE 'UPDATE estudantes SET cpf = cpf WHERE cpf IS NOT NULL AND cpf <> '''' AND left(cpf, 9) <> ''-----BEGIN''';
  END IF;
END $$;

-- RPC de decript: somente admin/gestão. (A UI não usa cpf hoje; fica pronto
-- para uso futuro sem expor a chave.)
CREATE OR REPLACE FUNCTION sieac_decrypt_cpf(p_estudante_id INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
    v_cpf TEXT;
    v_key TEXT;
BEGIN
    IF NOT sieac_e_gestao() THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    SELECT cpf INTO v_cpf FROM estudantes WHERE id = p_estudante_id;
    IF v_cpf IS NULL OR v_cpf = '' OR left(v_cpf, 9) <> '-----BEGIN' THEN
        RETURN v_cpf;
    END IF;

    SELECT value INTO v_key FROM app_secret WHERE key = 'pgp_key';
    RETURN pgp_sym_decrypt(v_cpf::bytea, v_key);
END;
$$;

REVOKE EXECUTE ON FUNCTION sieac_decrypt_cpf(INTEGER) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION sieac_decrypt_cpf(INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. logs.email
-- ---------------------------------------------------------------------------
-- A saída armada do pgp_sym_encrypt tem ~1000+ caracteres; email precisava de
-- VARCHAR(255) (migration 006), que truncaria o valor criptografado. Amplia
-- para TEXT antes de criar o trigger. O DROP TRIGGER vem antes porque o ALTER
-- não pode mudar o tipo de coluna referenciada em "UPDATE OF email" (0A000).
DROP TRIGGER IF EXISTS trg_enc_log_email ON logs;
ALTER TABLE logs ALTER COLUMN email TYPE TEXT;

CREATE OR REPLACE FUNCTION enc_log_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE v_key TEXT;
BEGIN
    IF NEW.email IS NOT NULL AND NEW.email <> '' AND left(NEW.email, 9) <> '-----BEGIN' THEN
        SELECT value INTO v_key FROM app_secret WHERE key = 'pgp_key';
        NEW.email := pgp_sym_encrypt(NEW.email::text, v_key);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enc_log_email ON logs;
CREATE TRIGGER trg_enc_log_email
    BEFORE INSERT OR UPDATE OF email ON logs
    FOR EACH ROW EXECUTE FUNCTION enc_log_email();

UPDATE logs SET email = email
WHERE email IS NOT NULL AND email <> '' AND left(email, 9) <> '-----BEGIN';

-- Leitura de logs SOMENTE por admin, com email decriptado. Filtros equivalentes
-- aos da tela de logs (busca, ação, período) + paginação.
CREATE OR REPLACE FUNCTION listar_logs(
    p_busca TEXT DEFAULT NULL,
    p_acao TEXT DEFAULT NULL,
    p_de TIMESTAMP DEFAULT NULL,
    p_ate TIMESTAMP DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id INTEGER,
    usuario_nome TEXT,
    email TEXT,
    acao TEXT,
    detalhes JSONB,
    created_at TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE v_key TEXT;
BEGIN
    IF NOT sieac_e_admin() THEN
        RAISE EXCEPTION 'Acesso negado: somente administradores.';
    END IF;

    SELECT value INTO v_key FROM app_secret WHERE key = 'pgp_key';

    RETURN QUERY
    SELECT l.id,
           l.usuario_nome::text,
           CASE WHEN l.email IS NULL OR l.email = '' OR left(l.email, 9) <> '-----BEGIN'
                THEN l.email
                ELSE pgp_sym_decrypt(l.email::bytea, v_key)
           END AS email,
           l.acao::text,
           l.detalhes,
           l.created_at
      FROM logs l
     WHERE (p_busca IS NULL OR p_busca = ''
            OR l.usuario_nome ILIKE '%' || p_busca || '%')
       AND (p_acao IS NULL OR p_acao = '' OR l.acao = p_acao)
       AND (p_de IS NULL OR l.created_at >= p_de)
       AND (p_ate IS NULL OR l.created_at <= p_ate)
     ORDER BY l.created_at DESC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 1000)
     OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION listar_logs(TEXT, TEXT, TIMESTAMP, TIMESTAMP, INTEGER, INTEGER) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION listar_logs(TEXT, TEXT, TIMESTAMP, TIMESTAMP, INTEGER, INTEGER) TO authenticated;
