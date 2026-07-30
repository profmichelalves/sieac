import { supabaseUpsert, supabaseQuery } from './supabase.js';
import { parseNumber, showToast } from '../utils/helpers.js';

export async function importarNotas(file) {
  const startTime = Date.now();
  const data = await parseXLSX(file);
  if (!data || data.length < 3) {
    return { error: 'Arquivo inválido ou vazio' };
  }

  const headers = data[2];
  const rows = data.slice(3);

  const col = {};
  headers.forEach((h, i) => col[h] = i);

  let inseridos = 0;
  let atualizados = 0;
  let erros = 0;
  const errosDetalhes = [];

  for (const row of rows) {
    try {
      const escolaNome = row[col['ESCOLA']];
      const serieNome = row[col['SÉRIE']];
      const turmaNome = row[col['TURMA']];
      const turno = row[col['TURNO']];
      const profNome = row[col['NOME DO PROFESSOR']];
      const profMatricula = row[col['MATRICULA (PROFESSOR)']];
      const profVinculo = row[col['VÍNCULO']];
      const profIdPessoa = row[col['ID PESSOA (PROFESSOR)']];
      const compNome = row[col['COMPONENTE CURRICULAR']];
      const compPeriodicidade = row[col['PERIODICIDADE COMPONENTE CURRICULAR']];
      const compId = row[col['ID COMPONENTE CURRICULAR']];
      const estudanteNome = row[col['NOME PESSOA']];
      const estudanteCpf = row[col['CPF PESSOA']];
      const estudanteMatricula = row[col['MATRÍCULA ESTUDANTE']];
      const estudanteIdPessoa = row[col['ID PESSOA']];
      const etapaEnsino = row[col['ETAPA ENSINO']];
      const etapaPeriodicidade = row[col['PERIODICIDADE ETAPA ENSINO']];
      const serieId = row[col['ID SÉRIE']];

      const n1 = parseNumber(row[col['NOTA 1º BIMESTRE']]);
      const n2 = parseNumber(row[col['NOTA 2º BIMESTRE']]);
      const n3 = parseNumber(row[col['NOTA 3º BIMESTRE']]);
      const n4 = parseNumber(row[col['NOTA 4º BIMESTRE']]);
      const mediaAnual = parseNumber(row[col['MÉDIA ANUAL']]);
      const exameFinal = parseNumber(row[col['EXAME FINAL']]);
      const avEspecial = parseNumber(row[col['AVALIAÇÃO ESPECIAL']]);
      const mediaFinal = parseNumber(row[col['MÉDIA FINAL']]);
      const resultadoFinal = row[col['RESULTADO FINAL']];
      const aproveitamento = row[col['APROVEITAMENTO DE ESTUDO']];

      if (!estudanteNome || !turmaNome) {
        erros++;
        continue;
      }
    } catch (e) {
      erros++;
      errosDetalhes.push(e.message);
    }
  }

  const tempoMs = Date.now() - startTime;
  return {
    success: true,
    registros: rows.length,
    inseridos,
    atualizados,
    erros,
    errosDetalhes: errosDetalhes.slice(0, 10),
    tempoMs
  };
}

export async function importarFrequencia(file) {
  const startTime = Date.now();
  const data = await parseXLSX(file);
  if (!data || data.length < 5) {
    return { error: 'Arquivo inválido ou vazio' };
  }

  const headers = data[4];
  const rows = data.slice(5);

  const col = {};
  headers.forEach((h, i) => col[h] = i);

  let inseridos = 0;
  let atualizados = 0;
  let erros = 0;
  const errosDetalhes = [];

  for (const row of rows) {
    try {
      const alunoNome = row[col['ALUNO']];
      const matricula = row[col['MATRÍCULA']];
      const turmaNome = row[col['TURMA']];
      if (!alunoNome || !turmaNome) { erros++; continue; }

      const freqData = {
        estudante_matricula: matricula,
        aluno: alunoNome,
        turma: turmaNome,
        serie: row[col['SÉRIE']],
        turno: row[col['TURNO']],
        mes_referencia: row[col['MÊS DE REFERÊNCIA']],
        ano_letivo: row[col['ANO LETIVO']],
        aulas_previstas: parseInt(row[col['AULAS PREVISTAS']]) || 0,
        aulas_dadas: parseInt(row[col['AULAS DADAS']]) || 0,
        presencas: parseInt(row[col['PRESENÇAS']]) || 0,
        percentual_frequencia: parseNumber(row[col['% FREQUÊNCIA']])
      };
    } catch (e) {
      erros++;
      errosDetalhes.push(e.message);
    }
  }

  const tempoMs = Date.now() - startTime;
  return {
    success: true,
    registros: rows.length,
    inseridos,
    atualizados,
    erros,
    errosDetalhes: errosDetalhes.slice(0, 10),
    tempoMs
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
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
