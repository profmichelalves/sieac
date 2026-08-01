import { supabaseFetchAll, supabaseUpsert } from './supabase.js';
import { parseNumber } from '../utils/helpers.js';

const BATCH_SIZE = 500;

const norm = s => String(s ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function buildColIndex(headers) {
  const col = {};
  headers.forEach((h, i) => { col[norm(h)] = i; });
  return key => col[norm(key)];
}

async function upsertTabela(table, rows, onConflict) {
  if (!rows.length) return { inseridos: 0, erros: 0 };
  let inseridos = 0, erros = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabaseUpsert(table, batch, onConflict);
    if (error) { erros += batch.length; } else { inseridos += batch.length; }
  }
  return { inseridos, erros };
}

async function carregarMapa(table, naturalColumn) {
  const { data } = await supabaseFetchAll(table, { select: `id,${naturalColumn}` });
  const map = {};
  (data || []).forEach(r => { if (r[naturalColumn] != null) map[String(r[naturalColumn])] = r.id; });
  return map;
}

function calcularMedia(nota) {
  const bims = [nota.nota_1bim, nota.nota_2bim, nota.nota_3bim, nota.nota_4bim]
    .filter(v => v != null && !isNaN(v));
  if (!bims.length) return null;
  return Math.round((bims.reduce((a, b) => a + b, 0) / bims.length) * 10) / 10;
}

async function verificarRelacoes() {
  const [sRes, tRes] = await Promise.all([
    supabaseFetchAll('series', { select: 'id,etapa_ensino_id' }),
    supabaseFetchAll('turmas', { select: 'id,serie_id' }),
  ]);
  const series = sRes.data || [];
  const turmas = tRes.data || [];
  return {
    series_total: series.length,
    series_com_etapa: series.filter(s => s.etapa_ensino_id != null).length,
    turmas_total: turmas.length,
    turmas_com_serie: turmas.filter(t => t.serie_id != null).length,
  };
}

function parseXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
        resolve(json);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function importarNotas(file, onProgress) {
  const startTime = Date.now();
  const errosDetalhes = [];
  const ignorados = [];
  let erros = 0, inseridos = 0;

  const data = await parseXLSX(file);
  if (!data || data.length < 3) return { error: 'Arquivo inválido ou vazio' };

  const col = buildColIndex(data[2]);
  const rows = data.slice(3);

  const etapas = new Map();
  const seriesList = new Map();
  const turmasList = new Map();
  const professoresList = new Map();
  const componentesList = new Map();
  const estudantesList = new Map();
  const alocacoesList = new Map();
  const notasList = [];

  for (const row of rows) {
    const estudanteNome = row[col('NOME PESSOA')];
    const turmaNome = row[col('TURMA')];
    if (!estudanteNome || !turmaNome) { erros++; continue; }

    const idEtapa = parseInt(row[col('ID ETAPA ENSINO')]);
    const idSerie = parseInt(row[col('ID SÉRIE')]);
    const idTurma = parseInt(row[col('ID TURMA')]);
    const idProf = parseInt(row[col('ID PESSOA (PROFESSOR)')]);
    const idComp = parseInt(row[col('ID COMPONENTE CURRICULAR')]);
    const idEst = parseInt(row[col('ID PESSOA')]);

    const add = (map, id, val) => { if (id && !map.has(String(id))) map.set(String(id), val); };

    add(etapas, idEtapa, { id_etapa: idEtapa, nome: row[col('ETAPA ENSINO')] || '' });
    add(seriesList, idSerie, { id_serie: idSerie, nome: row[col('SÉRIE')] || '', id_etapa: idEtapa });
    add(turmasList, idTurma, { id_turma: idTurma, nome: turmaNome, turno: row[col('TURNO')] || '', id_serie: idSerie });
    add(professoresList, idProf, { id_pessoa: idProf, nome: row[col('NOME DO PROFESSOR')] || '', matricula: String(row[col('MATRICULA (PROFESSOR)')] || '').trim() });
    add(componentesList, idComp, { id_componente: idComp, nome: row[col('COMPONENTE CURRICULAR')] || '' });
    add(estudantesList, idEst, { id_pessoa: idEst, nome: estudanteNome, matricula: String(row[col('MATRÍCULA ESTUDANTE')] || '').trim() });

    if (idProf && idTurma && idComp) {
      const key = `${idProf}_${idTurma}_${idComp}`;
      if (!alocacoesList.has(key)) {
        alocacoesList.set(key, {
          professor_natural: idProf,
          turma_natural: idTurma,
          componente_natural: idComp,
          data_inicio: row[col('DATA INÍCIO ALOCAÇÃO')] || null,
          data_fim: row[col('DATA FIM ALOCAÇÃO')] || null,
        });
      }
    }

    if (idEst) {
      notasList.push({
        estudante_id: idEst,
        professor_id: idProf,
        turma_id: idTurma,
        componente_id: idComp,
        nota_1bim: parseNumber(row[col('NOTA 1º BIMESTRE')]),
        nota_2bim: parseNumber(row[col('NOTA 2º BIMESTRE')]),
        nota_3bim: parseNumber(row[col('NOTA 3º BIMESTRE')]),
        nota_4bim: parseNumber(row[col('NOTA 4º BIMESTRE')]),
        media_final: parseNumber(row[col('MÉDIA FINAL')]),
        resultado_final: row[col('RESULTADO FINAL')],
      });
    }
  }

  // Fase 1: tabelas de referência, resolvendo as FKs na ordem correta
  onProgress(5, 'Inserindo etapas de ensino...');
  const rEtapas = await upsertTabela('etapas_ensino', [...etapas.values()], 'id_etapa');
  inseridos += rEtapas.inseridos; erros += rEtapas.erros;

  onProgress(10, 'Mapeando etapas → séries...');
  const etapaIdMap = await carregarMapa('etapas_ensino', 'id_etapa');
  const seriesRows = [...seriesList.values()].map(s => ({
    id_serie: s.id_serie,
    nome: s.nome,
    etapa_ensino_id: s.id_etapa != null ? (etapaIdMap[String(s.id_etapa)] || null) : null,
  }));
  const rSeries = await upsertTabela('series', seriesRows, 'id_serie');
  inseridos += rSeries.inseridos; erros += rSeries.erros;

  onProgress(15, 'Mapeando séries → turmas...');
  const serieIdMap = await carregarMapa('series', 'id_serie');
  const turmasRows = [...turmasList.values()].map(t => ({
    id_turma: t.id_turma,
    nome: t.nome,
    turno: t.turno || '',
    serie_id: t.id_serie != null ? (serieIdMap[String(t.id_serie)] || null) : null,
  }));
  const rTurmas = await upsertTabela('turmas', turmasRows, 'id_turma');
  inseridos += rTurmas.inseridos; erros += rTurmas.erros;

  onProgress(22, 'Inserindo professores...');
  const rProf = await upsertTabela('professores', [...professoresList.values()], 'id_pessoa');
  inseridos += rProf.inseridos; erros += rProf.erros;

  onProgress(26, 'Inserindo componentes curriculares...');
  const rComp = await upsertTabela('componentes_curriculares', [...componentesList.values()], 'id_componente');
  inseridos += rComp.inseridos; erros += rComp.erros;

  onProgress(30, 'Inserindo estudantes...');
  const rEst = await upsertTabela('estudantes', [...estudantesList.values()], 'id_pessoa');
  inseridos += rEst.inseridos; erros += rEst.erros;

  // Fase 2: mapear IDs naturais → IDs do Supabase
  onProgress(35, 'Mapeando IDs...');
  const [profMap, turmaMap, compMap, estMap] = await Promise.all([
    carregarMapa('professores', 'id_pessoa'),
    carregarMapa('turmas', 'id_turma'),
    carregarMapa('componentes_curriculares', 'id_componente'),
    carregarMapa('estudantes', 'id_pessoa'),
  ]);

  // Fase 3: alocações (professor ↔ turma ↔ disciplina)
  onProgress(40, 'Inserindo alocações...');
  const { data: alocExistentes } = await supabaseFetchAll('alocacoes', { select: 'id,professor_id,turma_id,componente_id' });
  const existentesSet = new Set((alocExistentes || []).map(a => `${a.professor_id}_${a.turma_id}_${a.componente_id}`));
  const alocParaInserir = [...alocacoesList.values()]
    .map(a => {
      const professor_id = profMap[String(a.professor_natural)];
      const turma_id = turmaMap[String(a.turma_natural)];
      const componente_id = compMap[String(a.componente_natural)];
      if (!professor_id || !turma_id || !componente_id) return null;
      if (existentesSet.has(`${professor_id}_${turma_id}_${componente_id}`)) return null;
      return { professor_id, turma_id, componente_id, data_inicio: a.data_inicio, data_fim: a.data_fim };
    })
    .filter(Boolean);
  const rAloc = await upsertTabela('alocacoes', alocParaInserir, null);
  inseridos += rAloc.inseridos; erros += rAloc.erros;

  // Fase 4: notas (upsert por estudante + alocação)
  onProgress(45, 'Inserindo notas...');
  const { data: alocacoesDB } = await supabaseFetchAll('alocacoes', { select: 'id,professor_id,turma_id,componente_id' });
  const alocLookup = {};
  (alocacoesDB || []).forEach(a => { alocLookup[`${a.professor_id}_${a.turma_id}_${a.componente_id}`] = a.id; });

  const notasParaInserir = notasList.map(n => {
    const estudante_id = estMap[String(n.estudante_id)];
    const alocacao_id = alocLookup[`${profMap[String(n.professor_id)]}_${turmaMap[String(n.turma_id)]}_${compMap[String(n.componente_id)]}`];
    if (!estudante_id || !alocacao_id) {
      const causa = !estudante_id && !alocacao_id ? 'estudante e alocação'
        : !estudante_id ? 'estudante' : 'alocação';
      const motivo = causa === 'estudante e alocação'
        ? 'Estudante e alocação não encontrados'
        : causa === 'estudante'
          ? 'Estudante não encontrado'
          : 'Alocação não encontrada';
      ignorados.push({
        tipo: 'nota',
        registro: n.estudante_id || '(sem id)',
        turma: n.turma_id || '(sem turma)',
        disciplina: n.componente_id || '(sem componente)',
        motivo,
      });
      return null;
    }
    const media = n.media_final != null ? n.media_final : calcularMedia(n);
    const rFinal = String(n.resultado_final || '').trim().toUpperCase();
    let resultado = n.resultado_final;
    if (media == null) {
      resultado = null;
    } else if (!rFinal || rFinal === 'MATRICULADO') {
      resultado = media >= 6 ? 'APROVADO' : 'REPROVADO';
    }
    return {
      estudante_id,
      alocacao_id,
      nota_1bim: n.nota_1bim,
      nota_2bim: n.nota_2bim,
      nota_3bim: n.nota_3bim,
      nota_4bim: n.nota_4bim,
      media_final: media,
      resultado_final: resultado,
    };
  }).filter(r => r);

  const totalNotas = notasParaInserir.length;
  for (let i = 0; i < totalNotas; i += BATCH_SIZE) {
    const batch = notasParaInserir.slice(i, i + BATCH_SIZE);
    const res = await upsertTabela('notas', batch, 'estudante_id,alocacao_id');
    inseridos += res.inseridos; erros += res.erros;
    const pct = totalNotas ? Math.min(45 + Math.round((i + BATCH_SIZE) / totalNotas * 50), 95) : 95;
    onProgress(pct, `Notas: ${Math.min(i + BATCH_SIZE, totalNotas)}/${totalNotas}`);
  }

  const relacoes = await verificarRelacoes();
  if (relacoes.series_com_etapa < relacoes.series_total || relacoes.turmas_com_serie < relacoes.turmas_total) {
    errosDetalhes.push(`Atenção: ${relacoes.series_total - relacoes.series_com_etapa} série(s) sem etapa e ${relacoes.turmas_total - relacoes.turmas_com_serie} turma(s) sem série — verifique as colunas ID ETAPA ENSINO / ID SÉRIE na planilha`);
  }

  onProgress(100, 'Importação concluída!');
  const tempoMs = Date.now() - startTime;

  return { success: true, registros: notasList.length, inseridos, atualizados: 0, erros, relacoes, errosDetalhes: errosDetalhes.slice(0, 10), ignorados: ignorados.slice(0, 500), tempoMs };
}

export async function importarFrequencia(file, onProgress) {
  const startTime = Date.now();
  const errosDetalhes = [];
  let erros = 0, inseridos = 0;

  const data = await parseXLSX(file);
  if (!data || data.length < 5) return { error: 'Arquivo inválido ou vazio' };

  const col = buildColIndex(data[4]);
  const rows = data.slice(5);

  const freqList = [];
  for (const row of rows) {
    try {
      const matricula = String(row[col('MATRÍCULA')] || '').trim();
      const turmaNome = row[col('TURMA')];
      if (!matricula || !turmaNome) { erros++; continue; }
      freqList.push({
        matricula,
        turma: turmaNome,
        mes_referencia: String(row[col('MÊS DE REFERÊNCIA')] || ''),
        percentual_frequencia: parseNumber(row[col('% FREQUÊNCIA')]),
      });
    } catch (e) {
      erros++; errosDetalhes.push(e.message);
    }
  }

  if (!freqList.length) return { error: 'Nenhum registro válido encontrado' };

  onProgress(10, 'Buscando referências...');
  const [estRes, turmaRes] = await Promise.all([
    supabaseFetchAll('estudantes', { select: 'id,matricula' }),
    supabaseFetchAll('turmas', { select: 'id,nome' }),
  ]);

  const normTurma = s => String(s).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '');
  const normMatricula = s => String(s).trim().replace(/[^\d]/g, '').replace(/^0+/, '');

  const estMap = {};
  const estNumMap = {};
  (estRes.data || []).forEach(e => {
    if (!e.matricula) return;
    const m = String(e.matricula).trim();
    estMap[m] = e.id;
    const num = normMatricula(m);
    if (num && !estNumMap[num]) estNumMap[num] = e.id;
  });
  const turmaMap = {};
  const turmaNormMap = {};
  (turmaRes.data || []).forEach(t => {
    if (!t.nome) return;
    const n = String(t.nome).trim();
    turmaMap[n] = t.id;
    const key = normTurma(n);
    if (key && !turmaNormMap[key]) turmaNormMap[key] = t.id;
  });

  const resolverMatricula = (v) => {
    const m = String(v).trim();
    if (estMap[m] != null) return estMap[m];
    const num = normMatricula(m);
    return num ? (estNumMap[num] ?? null) : null;
  };
  const resolverTurma = (v) => {
    const n = String(v).trim();
    if (turmaMap[n] != null) return turmaMap[n];
    const key = normTurma(n);
    return key ? (turmaNormMap[key] ?? null) : null;
  };

  const ignorados = [];
  const totalFreq = freqList.length;

  onProgress(20, 'Inserindo frequências...');
  for (let i = 0; i < totalFreq; i += BATCH_SIZE) {
    const batch = freqList.slice(i, i + BATCH_SIZE);
    const rowsIns = [];
    for (const f of batch) {
      const estId = resolverMatricula(f.matricula);
      const turId = resolverTurma(f.turma);
      if (!estId || !turId) {
        const causa = !estId && !turId ? 'matrícula e turma' : !estId ? 'matrícula' : 'turma';
        const motivo = causa === 'matrícula e turma'
          ? 'Matrícula e turma não encontradas'
          : causa === 'matrícula'
            ? 'Matrícula não encontrada'
            : 'Turma não encontrada';
        ignorados.push({ tipo: 'frequencia', matricula: f.matricula, turma: f.turma, motivo });
        continue;
      }
      rowsIns.push({
        estudante_id: estId,
        turma_id: turId,
        mes_referencia: f.mes_referencia,
        percentual_frequencia: f.percentual_frequencia,
      });
    }
    if (rowsIns.length) {
      const res = await upsertTabela('frequencias', rowsIns, 'estudante_id,turma_id,mes_referencia');
      inseridos += res.inseridos;
      erros += res.erros;
    }
    const pct = Math.min(20 + Math.round((i + BATCH_SIZE) / totalFreq * 75), 95);
    onProgress(pct, `Frequências: ${Math.min(i + BATCH_SIZE, totalFreq)}/${totalFreq}`);
  }

  if (ignorados.length) errosDetalhes.push(`${ignorados.length} ignorados (estudante/turma não encontrados)`);

  onProgress(100, 'Importação concluída!');
  const tempoMs = Date.now() - startTime;

  return { success: true, registros: totalFreq, inseridos, atualizados: 0, erros, errosDetalhes: errosDetalhes.slice(0, 10), ignorados: ignorados.slice(0, 500), tempoMs };
}
