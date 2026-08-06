-- SIEAC - Migration 013: RLS por perfil via claims do JWT próprio
-- Depois da Fase 0, nenhuma política TO anon restante. As funções helper
-- sieac_* leem os claims do JWT (sub/perfil_id/matricula) para decidir o
-- acesso. Mutação de dados sensíveis fica restrita a RPCs SECURITY DEFINER
-- com checagem de papel (Fase 2).

-- ---------------------------------------------------------------------------
-- 0. Helpers de autorização (lidos nas expressões de RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sieac_perfil_id()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() ->> 'perfil_id', '')::INTEGER
$$;

CREATE OR REPLACE FUNCTION sieac_user_id()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() ->> 'sub', '')::INTEGER
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
         regexp_replace(COALESCE(auth.jwt() ->> 'matricula', ''), '[^0-9]', '', 'g')
   LIMIT 1
$$;

-- Turmas internas em que o professor leciona OU é conselheiro.
CREATE OR REPLACE FUNCTION sieac_turmas_do_professor(v_professor_id INTEGER)
RETURNS SETOF INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT a.turma_id FROM alocacoes a WHERE a.professor_id = v_professor_id
  UNION
  SELECT DISTINCT t.id
    FROM turmas t
    JOIN turma_conselheiros tc ON tc.id_turma = t.id_turma
    JOIN professores p ON p.id_pessoa = tc.id_pessoa
   WHERE p.id = v_professor_id
$$;

-- Turmas internas de um estudante (via notas→alocação e frequências).
CREATE OR REPLACE FUNCTION sieac_turmas_do_estudante(v_estudante_id INTEGER)
RETURNS SETOF INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT a.turma_id
    FROM notas n
    JOIN alocacoes a ON a.id = n.alocacao_id
   WHERE n.estudante_id = v_estudante_id
  UNION
  SELECT DISTINCT f.turma_id FROM frequencias f WHERE f.estudante_id = v_estudante_id
$$;

-- Professor enxerga o estudante quando leciona/conselheiro em ao menos uma
-- das turmas dele.
CREATE OR REPLACE FUNCTION sieac_professor_ve_estudante(v_estudante_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT sieac_professor_id() IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM sieac_turmas_do_estudante(v_estudante_id) te
        WHERE te IN (SELECT * FROM sieac_turmas_do_professor(sieac_professor_id()))
     )
$$;

-- ---------------------------------------------------------------------------
-- 1. Derruba TODAS as políticas existentes nas tabelas do sistema (inclusive
--    as que sobraram de 009_turma_conselheiros.sql).
-- ---------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN (
         'perfis', 'usuarios', 'escolas', 'etapas_ensino', 'series', 'turmas',
         'professores', 'componentes_curriculares', 'estudantes', 'alocacoes',
         'notas', 'frequencias', 'importacoes', 'logs', 'tipo_necessidades',
         'estudante_necessidades', 'estudante_professores_aee', 'turma_conselheiros'
       )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Políticas novas (nenhuma TO anon)
-- ---------------------------------------------------------------------------

-- usuarios: leitura só de si mesmo ou admin; alteração só admin.
-- (Desvio consciente do plano "UPDATE próprio": UPDATE próprio permitiria
--  auto-elevação de perfil — vetor de escalonamento de privilégio. Todas as
--  alterações passam pelos RPCs atualizar_usuario/excluir_usuario, admin-only.)
CREATE POLICY "usuarios_select_own_or_admin" ON usuarios FOR SELECT TO authenticated
  USING (sieac_user_id() = id OR sieac_e_admin());
CREATE POLICY "usuarios_update_admin" ON usuarios FOR UPDATE TO authenticated
  USING (sieac_e_admin()) WITH CHECK (sieac_e_admin());

-- Referências: leitura para qualquer autenticado; escrita (importação) só gestão.
-- Nota: escolas foi removida pela migration 004 — o loop abaixo só cria políticas
-- para tabelas que existem de fato (to_regclass), evitando o erro 42P01.
CREATE POLICY "ref_select_authenticated" ON perfis FOR SELECT TO authenticated USING (true);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
      'escolas', 'etapas_ensino', 'series', 'turmas', 'professores',
      'componentes_curriculares', 'importacoes'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('CREATE POLICY "ref_select_authenticated" ON %I FOR SELECT TO authenticated USING (true)', t);
      EXECUTE format('CREATE POLICY "ref_insert_gestao" ON %I FOR INSERT TO authenticated WITH CHECK (sieac_e_gestao())', t);
      EXECUTE format('CREATE POLICY "ref_update_gestao" ON %I FOR UPDATE TO authenticated USING (sieac_e_gestao()) WITH CHECK (sieac_e_gestao())', t);
    END IF;
  END LOOP;
END $$;

-- Dados educacionais: leitura para autenticados; escrita (importação) só gestão.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['estudantes', 'alocacoes', 'notas', 'frequencias']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('CREATE POLICY "dados_select_authenticated" ON %I FOR SELECT TO authenticated USING (true)', t);
      EXECUTE format('CREATE POLICY "dados_insert_gestao" ON %I FOR INSERT TO authenticated WITH CHECK (sieac_e_gestao())', t);
      EXECUTE format('CREATE POLICY "dados_update_gestao" ON %I FOR UPDATE TO authenticated USING (sieac_e_gestao()) WITH CHECK (sieac_e_gestao())', t);
    END IF;
  END LOOP;
END $$;

-- turma_conselheiros: leitura autenticado; escrita apenas via RPC
-- salvar_conselheiro (gestão, SECURITY DEFINER).
CREATE POLICY "conselheiro_select_authenticated" ON turma_conselheiros FOR SELECT TO authenticated USING (true);

-- logs: INSERT autenticado (normalmente via RPC registrar_log), SELECT só admin.
CREATE POLICY "logs_insert_authenticated" ON logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "logs_select_admin" ON logs FOR SELECT TO authenticated
  USING (sieac_e_admin());

-- NEE: leitura restrita (need-to-know). Escrita apenas via RPC salvar_necessidades.
CREATE POLICY "nee_select_authenticated" ON tipo_necessidades FOR SELECT TO authenticated USING (true);

CREATE POLICY "nee_select_gestao_ou_professor" ON estudante_necessidades FOR SELECT TO authenticated
  USING (
    sieac_e_gestao()
    OR (
      sieac_perfil_id() = (SELECT id FROM perfis WHERE nome = 'Professor do AEE' LIMIT 1)
      AND EXISTS (
        SELECT 1 FROM estudante_professores_aee epa
         WHERE epa.estudante_id = estudante_necessidades.estudante_id
           AND epa.professor_id = sieac_professor_id()
      )
    )
    OR sieac_professor_ve_estudante(estudante_necessidades.estudante_id)
  );

CREATE POLICY "nee_select_gestao_ou_professor" ON estudante_professores_aee FOR SELECT TO authenticated
  USING (
    sieac_e_gestao()
    OR (
      sieac_perfil_id() = (SELECT id FROM perfis WHERE nome = 'Professor do AEE' LIMIT 1)
      AND professor_id = sieac_professor_id()
    )
    OR sieac_professor_ve_estudante(estudante_id)
  );

-- ---------------------------------------------------------------------------
-- 3. limpar_dados recriado: SECURITY DEFINER, somente admin, allowlist com
--    format(%I) para eliminar injeção de SQL via nome de tabela.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION limpar_dados(tabelas TEXT[])
RETURNS TABLE(tabela TEXT, linhas INTEGER, sequencia_reset BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
    t TEXT;
    seq TEXT;
    cnt INTEGER;
BEGIN
    IF NOT sieac_e_admin() THEN
        RAISE EXCEPTION 'Acesso negado: somente administradores podem limpar dados.';
    END IF;

    FOREACH t IN ARRAY tabelas
    LOOP
        IF t NOT IN (
            'notas', 'frequencias', 'alocacoes', 'importacoes', 'estudantes',
            'turmas', 'professores', 'componentes_curriculares', 'series',
            'etapas_ensino', 'logs'
        ) THEN
            RAISE EXCEPTION 'Tabela não permitida: %', t;
        END IF;

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

REVOKE EXECUTE ON FUNCTION limpar_dados(TEXT[]) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION limpar_dados(TEXT[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Auditoria: nenhuma política TO anon
-- SELECT c.relname, p.polname, p.polroles
-- FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
-- WHERE 'anon' = ANY (p.polroles::regrole[]);
-- ---------------------------------------------------------------------------
