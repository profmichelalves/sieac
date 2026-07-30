import { supabaseQuery, supabaseUpsert } from './supabase.js';
import { parseNumber } from '../utils/helpers.js';

const BATCH_SIZE = 500;

export async function importarNotas(file, onProgress) {
  const startTime = Date.now();
  const errosDetalhes = [];
  let erros = 0, inseridos = 0;

  const data = await parseXLSX(file);
  if (!data || data.length < 3) return { error: 'Arquivo inválido ou vazio' };

  const headers = data[2];
  const rows = data.slice(3);
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  const escolas = new Map();
  const etapas = new Map();
  const seriesList = new Map();
  const turmasList = new Map();
  const professoresList = new Map();
  const componentesList = new Map();
  const estudantesList = new Map();
  const alocacoesList = new Map();
  const notasList = [];

  for (const row of rows) {
    const estudanteNome = row[col['NOME PESSOA']];
    const turmaNome = row[col['TURMA']];
    if (!estudanteNome || !turmaNome) { erros++; continue; }

    const add = (map, id, val) => { if (id != null && id !== '' && !map.has(String(id))) map.set(String(id), val); };

    add(escolas, row[col['ID ESCOLA']], {
      id_escola: parseInt(row[col['ID ESCOLA']]),
      nome: row[col['ESCOLA']] || '',
      inep: String(row[col['INEP ESCOLA']] || ''),
      direc_id: row[col['ID DIREC']] ? parseInt(row[col['ID DIREC']]) : null,
      direc: row[col['DIREC']] || '',
      municipio_id: row[col['ID MUNICÍPIO']] ? parseInt(row[col['ID MUNICÍPIO']]) : null,
      municipio: row[col['MUNICÍPIO']] || '',
    });

    add(etapas, row[col['ID ETAPA ENSINO']], {
      id_etapa: parseInt(row[col['ID ETAPA ENSINO']]),
      nome: row[col['ETAPA ENSINO']] || '',
      periodicidade: row[col['PERIODICIDADE ETAPA ENSINO']] || '',
    });

    add(seriesList, row[col['ID SÉRIE']], {
      id_serie: parseInt(row[col['ID SÉRIE']]),
      nome: row[col['SÉRIE']] || '',
    });

    add(turmasList, row[col['ID TURMA']], {
      id_turma: parseInt(row[col['ID TURMA']]),
      nome: turmaNome,
      turno: row[col['TURNO']] || '',
    });

    add(professoresList, row[col['ID PESSOA (PROFESSOR)']], {
      id_pessoa: parseInt(row[col['ID PESSOA (PROFESSOR)']]),
      nome: row[col['NOME DO PROFESSOR']] || '',
      matricula: String(row[col['MATRICULA (PROFESSOR)']] || ''),
      vinculo: row[col['VÍNCULO']] || '',
    });

    add(componentesList, row[col['ID COMPONENTE CURRICULAR']], {
      id_componente: parseInt(row[col['ID COMPONENTE CURRICULAR']]),
      nome: row[col['COMPONENTE CURRICULAR']] || '',
      periodicidade: row[col['PERIODICIDADE COMPONENTE CURRICULAR']] || '',
    });

    add(estudantesList, row[col['ID PESSOA']], {
      id_pessoa: parseInt(row[col['ID PESSOA']]),
      nome: estudanteNome,
      cpf: String(row[col['CPF PESSOA']] || ''),
      matricula: String(row[col['MATRÍCULA ESTUDANTE']] || ''),
    });

    const prId = row[col['ID PESSOA (PROFESSOR)']];
    const tuId = row[col['ID TURMA']];
    const coId = row[col['ID COMPONENTE CURRICULAR']];
    if (prId && tuId && coId) {
      const key = `${prId}_${tuId}_${coId}`;
      if (!alocacoesList.has(key)) {
        alocacoesList.set(key, {
          professor_natural: parseInt(prId),
          turma_natural: parseInt(tuId),
          componente_natural: parseInt(coId),
          data_inicio: row[col['DATA INÍCIO ALOCAÇÃO']] || null,
          data_fim: row[col['DATA FIM ALOCAÇÃO']] || null,
        });
      }
    }

    const esId = row[col['ID PESSOA']];
    if (esId) {
      notasList.push({
        estudante_id: parseInt(esId),
        professor_id: parseInt(prId),
        turma_id: parseInt(tuId),
        componente_id: parseInt(coId),
        nota_1bim: parseNumber(row[col['NOTA 1º BIMESTRE']]),
        nota_2bim: parseNumber(row[col['NOTA 2º BIMESTRE']]),
        nota_3bim: parseNumber(row[col['NOTA 3º BIMESTRE']]),
        nota_4bim: parseNumber(row[col['NOTA 4º BIMESTRE']]),
        media_anual: parseNumber(row[col['MÉDIA ANUAL']]),
        exame_final: parseNumber(row[col['EXAME FINAL']]),
        av_especial: parseNumber(row[col['AVALIAÇÃO ESPECIAL']]),
        media_final: parseNumber(row[col['MÉDIA FINAL']]),
        resultado_final: row[col['RESULTADO FINAL']],
        aproveitamento: row[col['APROVEITAMENTO DE ESTUDO']],
      });
    }
  }

  // Fase 1a: inserir referências sem FK (podem ser inseridas em qq ordem)
  onProgress(5, 'Inserindo escolas...');
  await inserirNovos('escolas', [...escolas.values()], 'id_escola');

  onProgress(10, 'Inserindo etapas de ensino...');
  await inserirNovos('etapas_ensino', [...etapas.values()], 'id_etapa');

  onProgress(12, 'Inserindo séries...');
  await inserirNovos('series', [...seriesList.values()], 'id_serie');

  onProgress(15, 'Inserindo professores...');
  await inserirNovos('professores', [...professoresList.values()], 'id_pessoa');

  onProgress(18, 'Inserindo componentes curriculares...');
  await inserirNovos('componentes_curriculares', [...componentesList.values()], 'id_componente');

  onProgress(20, 'Inserindo estudantes...');
  await inserirNovos('estudantes', [...estudantesList.values()], 'id_pessoa');

  // Fase 1b: carregar IDs de series para mapear turmas
  onProgress(22, 'Mapeando séries...');
  const { data: seriesDB } = await supabaseQuery('series', { select: 'id,id_serie' });
  const serieIdMap = {};
  (seriesDB || []).forEach(s => serieIdMap[s.id_serie] = s.id);

  // Fase 1c: inserir turmas COM serie_id
  onProgress(25, 'Inserindo turmas...');
  const turmasParaInserir = [...turmasList.values()].map(t => ({
    ...t,
    serie_id: serieIdMap[t.id_serie] || null,
  }));
  await inserirNovos('turmas', turmasParaInserir, 'id_turma');

  // Fase 2: carregar IDs do Supabase para todas as referências
  onProgress(30, 'Mapeando IDs...');
  const map = await carregarMapas();

  // Fase 3: inserir alocações com Supabase IDs
  onProgress(35, 'Inserindo alocações...');
  const alocRows = [...alocacoesList.values()].map(a => ({
    professor_id: map.professores[a.professor_natural],
    turma_id: map.turmas[a.turma_natural],
    componente_id: map.componentes[a.componente_natural],
    data_inicio: a.data_inicio,
    data_fim: a.data_fim,
  })).filter(a => a.professor_id && a.turma_id && a.componente_id);

  await inserirNovosAlocacoes(alocRows);

  // Fase 4: carregar IDs das alocações
  onProgress(40, 'Mapeando alocações...');
  const alocLookup = await carregarLookupAlocacoes(map);

  // Fase 5: inserir notas
  onProgress(45, 'Inserindo notas...');
  const notasParaInserir = notasList.map(n => ({
    estudante_id: map.estudantes[n.estudante_id],
    alocacao_id: alocLookup[`${n.professor_id}_${n.turma_id}_${n.componente_id}`],
    nota_1bim: n.nota_1bim,
    nota_2bim: n.nota_2bim,
    nota_3bim: n.nota_3bim,
    nota_4bim: n.nota_4bim,
    media_anual: n.media_anual,
    exame_final: n.exame_final,
    av_especial: n.av_especial,
    media_final: n.media_final,
    resultado_final: n.resultado_final,
    aproveitamento: n.aproveitamento,
  })).filter(n => n.estudante_id && n.alocacao_id);

  const totalNotas = notasParaInserir.length;
  for (let i = 0; i < notasParaInserir.length; i += BATCH_SIZE) {
    const batch = notasParaInserir.slice(i, i + BATCH_SIZE);
    const res = await batchInserir('notas', batch);
    inseridos += res.inseridos;
    erros += res.erros;
    const pct = Math.min(55 + Math.round((i + BATCH_SIZE) / totalNotas * 40), 95);
    onProgress(pct, `Notas: ${Math.min(i + BATCH_SIZE, totalNotas)}/${totalNotas}`);
  }

  onProgress(100, 'Importação concluída!');
  const tempoMs = Date.now() - startTime;

  return { success: true, registros: totalNotas, inseridos, atualizados: 0, erros, errosDetalhes: errosDetalhes.slice(0, 10), tempoMs };
}

export async function importarFrequencia(file, onProgress) {
  const startTime = Date.now();
  const errosDetalhes = [];
  let erros = 0, inseridos = 0;

  const data = await parseXLSX(file);
  if (!data || data.length < 5) return { error: 'Arquivo inválido ou vazio' };

  const headers = data[4];
  const rows = data.slice(5);
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  const freqList = [];

  for (const row of rows) {
    try {
      const matricula = String(row[col['MATRÍCULA']] || '').trim();
      const alunoNome = row[col['ALUNO']];
      const turmaNome = row[col['TURMA']];
      if (!alunoNome || !turmaNome) { erros++; continue; }

      freqList.push({
        matricula,
        turma: turmaNome,
        mes_referencia: String(row[col['MÊS DE REFERÊNCIA']] || ''),
        ano_letivo: parseInt(row[col['ANO LETIVO']]) || 2026,
        aulas_previstas: parseInt(row[col['AULAS PREVISTAS']]) || 0,
        aulas_dadas: parseInt(row[col['AULAS DADAS']]) || 0,
        presencas: parseInt(row[col['PRESENÇAS']]) || 0,
        percentual_frequencia: parseNumber(row[col['% FREQUÊNCIA']]),
      });
    } catch (e) {
      erros++; errosDetalhes.push(e.message);
    }
  }

  onProgress(10, 'Buscando referências...');
  const [estRes, turmaRes] = await Promise.all([
    supabaseQuery('estudantes', { select: 'id,matricula' }),
    supabaseQuery('turmas', { select: 'id,nome' }),
  ]);

  const estMap = {};
  (estRes.data || []).forEach(e => { if (e.matricula) estMap[e.matricula] = e.id; });
  const turmaMap = {};
  (turmaRes.data || []).forEach(t => turmaMap[t.nome] = t.id);

  let skipped = 0;
  const totalFreq = freqList.length;

  onProgress(20, 'Inserindo frequências...');
  for (let i = 0; i < freqList.length; i += BATCH_SIZE) {
    const batch = freqList.slice(i, i + BATCH_SIZE);
    const rows = batch.map(f => {
      const estId = estMap[f.matricula];
      const turId = turmaMap[f.turma];
      if (!estId || !turId) { skipped++; return null; }
      return {
        estudante_id: estId,
        turma_id: turId,
        mes_referencia: f.mes_referencia,
        ano_letivo: f.ano_letivo,
        aulas_previstas: f.aulas_previstas,
        aulas_dadas: f.aulas_dadas,
        presencas: f.presencas,
        percentual_frequencia: f.percentual_frequencia,
      };
    }).filter(r => r);

    if (rows.length) {
      const res = await batchInserir('frequencias', rows);
      inseridos += res.inseridos;
      erros += res.erros;
    }

    const pct = Math.min(20 + Math.round((i + BATCH_SIZE) / totalFreq * 75), 95);
    onProgress(pct, `Frequências: ${Math.min(i + BATCH_SIZE, totalFreq)}/${totalFreq}`);
  }

  if (skipped > 0) errosDetalhes.push(`${skipped} ignorados (estudante/turma não encontrados)`);

  onProgress(100, 'Importação concluída!');
  const tempoMs = Date.now() - startTime;

  return { success: true, registros: totalFreq, inseridos, atualizados: 0, erros, errosDetalhes: errosDetalhes.slice(0, 10), tempoMs };
}

async function inserirNovos(table, rows, idColumn) {
  if (!rows.length) return;
  // Buscar IDs existentes
  const { data: existentes } = await supabaseQuery(table, { select: idColumn });
  const existentesSet = new Set((existentes || []).map(r => String(r[idColumn])));
  const novos = rows.filter(r => !existentesSet.has(String(r[idColumn])));
  if (!novos.length) return;
  await batchInserir(table, novos);
}

async function inserirNovosAlocacoes(rows) {
  if (!rows.length) return;
  // Buscar alocações existentes pela combinação das FKs
  const { data: existentes } = await supabaseQuery('alocacoes', { select: 'professor_id,turma_id,componente_id' });
  const existentesSet = new Set((existentes || []).map(a => `${a.professor_id}_${a.turma_id}_${a.componente_id}`));
  const novos = rows.filter(a => !existentesSet.has(`${a.professor_id}_${a.turma_id}_${a.componente_id}`));
  if (!novos.length) return;
  await batchInserir('alocacoes', novos);
}

async function batchInserir(table, rows) {
  let inseridos = 0, erros = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabaseUpsert(table, batch, null);
    if (error) { erros += batch.length; }
    else { inseridos += batch.length; }
  }
  return { inseridos, erros };
}

async function carregarMapas() {
  const [profRes, turmaRes, compRes, estRes] = await Promise.all([
    supabaseQuery('professores', { select: 'id,id_pessoa' }),
    supabaseQuery('turmas', { select: 'id,id_turma' }),
    supabaseQuery('componentes_curriculares', { select: 'id,id_componente' }),
    supabaseQuery('estudantes', { select: 'id,id_pessoa' }),
  ]);

  const professores = {};
  const turmas = {};
  const componentes = {};
  const estudantes = {};

  (profRes.data || []).forEach(e => professores[e.id_pessoa] = e.id);
  (turmaRes.data || []).forEach(e => turmas[e.id_turma] = e.id);
  (compRes.data || []).forEach(e => componentes[e.id_componente] = e.id);
  (estRes.data || []).forEach(e => estudantes[e.id_pessoa] = e.id);

  return { professores, turmas, componentes, estudantes };
}

async function carregarLookupAlocacoes(map) {
  const { data } = await supabaseQuery('alocacoes', {
    select: 'id,professor_id,turma_id,componente_id',
  });

  const profRev = {}; Object.entries(map.professores).forEach(([nat, sup]) => profRev[sup] = parseInt(nat));
  const turRev = {};  Object.entries(map.turmas).forEach(([nat, sup]) => turRev[sup] = parseInt(nat));
  const compRev = {}; Object.entries(map.componentes).forEach(([nat, sup]) => compRev[sup] = parseInt(nat));

  const lookup = {};
  (data || []).forEach(a => {
    const pn = profRev[a.professor_id];
    const tn = turRev[a.turma_id];
    const cn = compRev[a.componente_id];
    if (pn && tn && cn) lookup[`${pn}_${tn}_${cn}`] = a.id;
  });

  return lookup;
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
