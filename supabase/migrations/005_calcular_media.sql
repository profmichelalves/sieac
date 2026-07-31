-- SIEAC - Migration 005: recalcula media_final e resultado_final
-- A planilha de notas preenche apenas os bimestres; o campo MÉDIA FINAL costuma
-- vir vazio (ou 0) e RESULTADO FINAL vem "MATRICULADO". Sem esses valores, os
-- dashboards e o Relatório de Notas não conseguem calcular nada.

-- 1) media_final = média dos bimestres com nota > 0 quando não houver média informada
UPDATE notas SET media_final = sub.media
FROM (
  SELECT n.id,
         AVG(b.bim) AS media
  FROM notas n
  CROSS JOIN LATERAL (
    VALUES (n.nota_1bim), (n.nota_2bim), (n.nota_3bim), (n.nota_4bim)
  ) AS b(bim)
  WHERE b.bim IS NOT NULL AND b.bim > 0
    AND (n.media_final IS NULL OR n.media_final <= 0)
  GROUP BY n.id
) AS sub
WHERE notas.id = sub.id;

-- 2) resultado_final derivado da média (corte 6) quando não informado/matriculado
UPDATE notas
SET resultado_final = CASE WHEN media_final >= 6 THEN 'APROVADO' ELSE 'REPROVADO' END
WHERE media_final IS NOT NULL
  AND (resultado_final IS NULL OR UPPER(TRIM(resultado_final)) = 'MATRICULADO');
