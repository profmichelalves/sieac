import { supabaseUpsert } from './supabase.js';
import { parseNumber } from '../utils/helpers.js';

const BATCH_SIZE = 500;

export async function importarNotas(file, onProgress) {
  const startTime = Date.now();
  let erros = 0, inseridos = 0, atualizados = 0;
  const errosDetalhes = [];
  const registros = [];

  const data = await parseXLSX(file);
  if (!data || data.length < 3) return { error: 'Arquivo inválido ou vazio' };

  const headers = data[2];
  const rows = data.slice(3);
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  // Coletar entidades únicas
  const escolasSet = new Map();
  const etapasSet = new Map();
  const seriesSet = new Map();
  const turmasSet = new Map();
  const professoresSet = new Map();
  const componentesSet = new Map();
  const estudantesSet = new Map();
  const alocacoesSet = new Map();
  const notasList = [];

  for (const row of rows) {
    try {
      const estudanteNome = row[col['NOME PESSOA']];
      const turmaNome = row[col['TURMA']];
      if (!estudanteNome || !turmaNome) { erros++; continue; }

      const escolaId = row[col['ID ESCOLA']];
      if (escolaId) {
        const key = String(escolaId);
        if (!escolasSet.has(key)) {
          escolasSet.set(key, {
            id_escola: parseInt(escolaId),
            inep: String(row[col['INEP ESCOLA']] || ''),
            nome: row[col['ESCOLA']] || '',
            direc_id: row[col['ID DIREC']] ? parseInt(row[col['ID DIREC']]) : null,
            direc: row[col['DIREC']] || '',
            municipio_id: row[col['ID MUNICÍPIO']] ? parseInt(row[col['ID MUNICÍPIO']]) : null,
            municipio: row[col['MUNICÍPIO']] || '',
          });
        }
      }

      const etapaNome = row[col['ETAPA ENSINO']];
      const etapaPeriod = row[col['PERIODICIDADE ETAPA ENSINO']];
      const etapaId = row[col['ID ETAPA ENSINO']];
      if (etapaId) {
        const key = String(etapaId);
        if (!etapasSet.has(key)) {
          etapasSet.set(key, { id_etapa: parseInt(etapaId), nome: etapaNome, periodicidade: etapaPeriod });
        }
      }

      const serieNome = row[col['SÉRIE']];
      const serieId = row[col['ID SÉRIE']];
      if (serieId) {
        const key = String(serieId);
        if (!seriesSet.has(key)) {
          seriesSet.set(key, { id_serie: parseInt(serieId), nome: serieNome, etapa_id: etapaId ? parseInt(etapaId) : null });
        }
      }

      const turmaId = row[col['ID TURMA']];
      if (turmaId) {
        const key = String(turmaId);
        if (!turmasSet.has(key)) {
          turmasSet.set(key, {
            id_turma: parseInt(turmaId), nome: turmaNome,
            serie_id: serieId ? parseInt(serieId) : null, turno: row[col['TURNO']] || ''
          });
        }
      }

      const profId = row[col['ID PESSOA (PROFESSOR)']];
      if (profId) {
        const key = String(profId);
        if (!professoresSet.has(key)) {
          professoresSet.set(key, {
            id_pessoa: parseInt(profId), nome: row[col['NOME DO PROFESSOR']] || '',
            matricula: String(row[col['MATRICULA (PROFESSOR)']] || ''),
            vinculo: row[col['VÍNCULO']] || ''
          });
        }
      }

      const compId = row[col['ID COMPONENTE CURRICULAR']];
      if (compId) {
        const key = String(compId);
        if (!componentesSet.has(key)) {
          componentesSet.set(key, {
            id_componente: parseInt(compId), nome: row[col['COMPONENTE CURRICULAR']] || '',
            periodicidade: row[col['PERIODICIDADE COMPONENTE CURRICULAR']] || ''
          });
        }
      }

      const estId = row[col['ID PESSOA']];
      if (estId) {
        const key = String(estId);
        if (!estudantesSet.has(key)) {
          estudantesSet.set(key, {
            id_pessoa: parseInt(estId), nome: estudanteNome,
            cpf: String(row[col['CPF PESSOA']] || ''),
            matricula: String(row[col['MATRÍCULA ESTUDANTE']] || '')
          });
        }
      }

      // Chave da alocação: professor + turma + componente
      if (profId && turmaId && compId) {
        const alocKey = `${profId}_${turmaId}_${compId}`;
        if (!alocacoesSet.has(alocKey)) {
          alocacoesSet.set(alocKey, {
            professor_id: parseInt(profId), turma_id: parseInt(turmaId),
            componente_id: parseInt(compId),
            data_inicio: row[col['DATA INÍCIO ALOCAÇÃO']] || null,
            data_fim: row[col['DATA FIM ALOCAÇÃO']] || null
          });
        }
      }

      notasList.push({
        estudante_id: parseInt(estId),
        professor_id: parseInt(profId),
        turma_id: parseInt(turmaId),
        componente_id: parseInt(compId),
        nota_1bim: parseNumber(row[col['NOTA 1º BIMESTRE']]),
        nota_2bim: parseNumber(row[col['NOTA 2º BIMESTRE']]),
        nota_3bim: parseNumber(row[col['NOTA 3º BIMESTRE']]),
        nota_4bim: parseNumber(row[col['NOTA 4º BIMESTRE']]),
        media_anual: parseNumber(row[col['MÉDIA ANUAL']]),
        exame_final: parseNumber(row[col['EXAME FINAL']]),
        av_especial: parseNumber(row[col['AVALIAÇÃO ESPECIAL']]),
        media_final: parseNumber(row[col['MÉDIA FINAL']]),
        resultado_final: row[col['RESULTADO FINAL']],
        aproveitamento: row[col['APROVEITAMENTO DE ESTUDO']]
      });
    } catch (e) {
      erros++;
      errosDetalhes.push(e.message);
    }
  }

  onProgress?.(10, 'Entidades coletadas. Inserindo escolas...');
  await batchUpsert('escolas', [...escolasSet.values()], 'id_escola');

  onProgress?.(20, 'Inserindo etapas de ensino...');
  await batchUpsert('etapas_ensino', [...etapasSet.values()], 'id_etapa');

  onProgress?.(30, 'Inserindo séries...');
  await batchUpsert('series', [...seriesSet.values()], 'id_serie');

  onProgress?.(40, 'Inserindo turmas...');
  await batchUpsert('turmas', [...turmasSet.values()], 'id_turma');

  onProgress?.(50, 'Inserindo professores...');
  await batchUpsert('professores', [...professoresSet.values()], 'id_pessoa');

  onProgress?.(55, 'Inserindo componentes curriculares...');
  await batchUpsert('componentes_curriculares', [...componentesSet.values()], 'id_componente');

  onProgress?.(60, 'Inserindo estudantes...');
  await batchUpsert('estudantes', [...estudantesSet.values()], 'id_pessoa');

  onProgress?.(65, 'Inserindo alocações...');
  await batchUpsert('alocacoes', [...alocacoesSet.values()], null);

  onProgress?.(70, 'Inserindo notas (lotes)...');

  // Mapear IDs naturais para Supabase IDs
  const mapeamentos = await carregarMapeamentos();

  const totalNotas = notasList.length;
  for (let i = 0; i < notasList.length; i += BATCH_SIZE) {
    const batch = notasList.slice(i, i + BATCH_SIZE);
    const rows = batch.map(n => ({
      estudante_id: mapeamentos.estudantes[n.estudante_id],
      alocacao_id: mapeamentos.alocacoes[`${n.professor_id}_${n.turma_id}_${n.componente_id}`],
      nota_1bim: n.nota_1bim,
      nota_2bim: n.nota_2bim,
      nota_3bim: n.nota_3bim,
      nota_4bim: n.nota_4bim,
      media_anual: n.media_anual,
      exame_final: n.exame_final,
      av_especial: n.av_especial,
      media_final: n.media_final,
      resultado_final: n.resultado_final,
      aproveitamento: n.aproveitamento
    })).filter(r => r.estudante_id && r.alocacao_id);

    if (rows.length) {
      const result = await supabaseUpsert('notas', rows, '(estudante_id, alocacao_id)');
      if (result.error) {
        erros += rows.length;
        errosDetalhes.push(`Lote ${i / BATCH_SIZE + 1}: ${result.error}`);
      } else {
        inseridos += rows.length;
      }
    }

    const pct = Math.min(70 + Math.round((i + BATCH_SIZE) / totalNotas * 25), 95);
    onProgress?.(pct, `Notas: ${Math.min(i + BATCH_SIZE, totalNotas)}/${totalNotas}`);
  }

  onProgress?.(100, 'Importação concluída!');
  const tempoMs = Date.now() - startTime;

  return { success: true, registros: totalNotas, inseridos, atualizados, erros, errosDetalhes: errosDetalhes.slice(0, 10), tempoMs };
}

export async function importarFrequencia(file, onProgress) {
  const startTime = Date.now();
  let erros = 0, inseridos = 0, atualizados = 0;
  const errosDetalhes = [];

  const data = await parseXLSX(file);
  if (!data || data.length < 5) return { error: 'Arquivo inválido ou vazio' };

  const headers = data[4];
  const rows = data.slice(5);
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  const estudantesFreq = new Map();
  const turmasFreq = new Map();
  const freqList = [];

  for (const row of rows) {
    try {
      const matricula = String(row[col['MATRÍCULA']] || '').trim();
      const alunoNome = row[col['ALUNO']];
      const turmaNome = row[col['TURMA']];
      if (!alunoNome || !turmaNome) { erros++; continue; }

      if (matricula) {
        const key = matricula;
        if (!estudantesFreq.has(key)) {
          estudantesFreq.set(key, {
            matricula,
            nome: alunoNome,
            cpf: String(row[col['CPF']] || '')
          });
        }
      }

      if (turmaNome) {
        const key = turmaNome;
        if (!turmasFreq.has(key)) {
          turmasFreq.set(key, { nome: turmaNome });
        }
      }

      freqList.push({
        estudante_matricula: matricula,
        aluno: alunoNome,
        turma: turmaNome,
        serie: row[col['SÉRIE']],
        turno: row[col['TURNO']],
        mes_referencia: String(row[col['MÊS DE REFERÊNCIA']] || ''),
        ano_letivo: parseInt(row[col['ANO LETIVO']]) || 2026,
        aulas_previstas: parseInt(row[col['AULAS PREVISTAS']]) || 0,
        aulas_dadas: parseInt(row[col['AULAS DADAS']]) || 0,
        presencas: parseInt(row[col['PRESENÇAS']]) || 0,
        percentual_frequencia: parseNumber(row[col['% FREQUÊNCIA']])
      });
    } catch (e) {
      erros++;
      errosDetalhes.push(e.message);
    }
  }

  onProgress?.(10, 'Coletando referências de estudantes e turmas...');

  // Carregar mapeamentos existentes
  const { supabaseQuery } = await import('./supabase.js');

  const { data: estudantesDB } = await supabaseQuery('estudantes', { select: 'id,matricula' });
  const estMap = {};
  (estudantesDB || []).forEach(e => { if (e.matricula) estMap[e.matricula] = e.id; });

  const { data: turmasDB } = await supabaseQuery('turmas', { select: 'id,nome' });
  const turmaMap = {};
  (turmasDB || []).forEach(t => turmaMap[t.nome] = t.id);

  onProgress?.(30, 'Inserindo frequências...');

  let skipped = 0;
  for (let i = 0; i < freqList.length; i += BATCH_SIZE) {
    const batch = freqList.slice(i, i + BATCH_SIZE);
    const rows = batch.map(f => {
      const estId = estMap[f.estudante_matricula];
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
        percentual_frequencia: f.percentual_frequencia
      };
    }).filter(r => r);

    if (rows.length) {
      const result = await supabaseUpsert('frequencias', rows, '(estudante_id, turma_id, mes_referencia)');
      if (result.error) {
        erros += rows.length;
        errosDetalhes.push(`Lote ${i / BATCH_SIZE + 1}: ${result.error}`);
      } else {
        inseridos += rows.length;
      }
    }

    const pct = Math.min(30 + Math.round((i + BATCH_SIZE) / freqList.length * 60), 95);
    onProgress?.(pct, `Frequências: ${Math.min(i + BATCH_SIZE, freqList.length)}/${freqList.length}`);
  }

  if (skipped > 0) errosDetalhes.push(`${skipped} registros ignorados (estudante ou turma não encontrados)`);

  onProgress?.(100, 'Importação concluída!');
  const tempoMs = Date.now() - startTime;

  return { success: true, registros: freqList.length, inseridos, atualizados, erros, errosDetalhes: errosDetalhes.slice(0, 10), tempoMs };
}

async function batchUpsert(table, rows, onConflict) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await supabaseUpsert(table, batch, onConflict);
  }
}

async function carregarMapeamentos() {
  const { supabaseQuery } = await import('./supabase.js');

  const [estRes, alocRes] = await Promise.all([
    supabaseQuery('estudantes', { select: 'id,id_pessoa' }),
    supabaseQuery('alocacoes', { select: 'id,professor_id,turma_id,componente_id' })
  ]);

  const estudantes = {};
  (estRes.data || []).forEach(e => estudantes[e.id_pessoa] = e.id);

  const alocacoes = {};
  (alocRes.data || []).forEach(a => {
    alocacoes[`${a.professor_id}_${a.turma_id}_${a.componente_id}`] = a.id;
  });

  return { estudantes, alocacoes };
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
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
