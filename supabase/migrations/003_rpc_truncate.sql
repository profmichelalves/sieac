-- SIEAC - Migration 003: RPC para truncar dados educacionais
-- Chama via: SELECT * FROM limpar_dados(ARRAY['notas','frequencias']);

CREATE OR REPLACE FUNCTION limpar_dados(tabelas TEXT[])
RETURNS TABLE(tabela TEXT, linhas INTEGER, sequencia_reset BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  t TEXT;
  seq TEXT;
  cnt INTEGER;
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    EXECUTE format('SELECT count(*) FROM %I', t) INTO cnt;
    IF cnt > 0 THEN
      EXECUTE format('TRUNCATE TABLE %I CASCADE', t);
    END IF;
    seq := t || '_id_seq';
    BEGIN
      EXECUTE format('ALTER SEQUENCE %I RESTART WITH 1', seq);
      sequencia_reset := true;
    EXCEPTION WHEN undefined_table THEN
      sequencia_reset := false;
    END;
    RETURN QUERY SELECT t, cnt, sequencia_reset;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION limpar_dados TO anon;
