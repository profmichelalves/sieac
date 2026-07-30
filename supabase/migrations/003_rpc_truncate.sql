-- SIEAC - Migration 003: RPC para limpar dados educacionais
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
  -- Ordem segura para FKs: filhos antes dos pais
  ordem TEXT[] := ARRAY[
    'notas', 'frequencias', 'alocacoes', 'importacoes',
    'estudantes', 'turmas', 'professores', 'componentes_curriculares',
    'series', 'etapas_ensino', 'escolas'
  ];
BEGIN
  FOREACH t IN ARRAY ordem
  LOOP
    IF t = ANY(tabelas) THEN
      EXECUTE format('SELECT count(*) FROM %I', t) INTO cnt;
      IF cnt > 0 THEN
        EXECUTE format('DELETE FROM %I', t);
      END IF;
      seq := t || '_id_seq';
      BEGIN
        EXECUTE format('ALTER SEQUENCE %I RESTART WITH 1', seq);
        sequencia_reset := true;
      EXCEPTION WHEN undefined_table THEN
        sequencia_reset := false;
      END;
      RETURN QUERY SELECT t, cnt, sequencia_reset;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION limpar_dados TO anon;
