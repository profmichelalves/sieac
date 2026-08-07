// Importa os vínculos de Necessidades Educacionais Especiais (NEE) a partir do
// Relatorio_Estudantes_NEE.xlsx para as tabelas de relacionamento.
//
// Uso: node scripts/importar_nee.mjs
// Requer: npm i xlsx (já presente em node_modules)
//
// A planilha possui colunas: Nome do Estudante | Turma | Tipo de Necessidade.
// Os estudantes são identificados pelo nome normalizado na tabela `estudantes`.
// O professor de AEE não consta no arquivo, portanto fica para cadastro na tela.

import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhveHFrZHh0YXBsYndsem5ha2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNzQ2ODAsImV4cCI6MjEwMDk1MDY4MH0.FdTqOsUJmm-Ueawvigf79jjFVQ1gyU5rzmxzZaczPQY';
const BASE = 'https://hoxqkdxtaplbwlznakjg.supabase.co';
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const norm = s => String(s ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

async function fetchAll(table, select) {
  const out = [];
  const step = 1000;
  for (let offset = 0; ; offset += step) {
    const url = `${BASE}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=id&offset=${offset}&limit=${step}`;
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) throw new Error(`GET ${table} -> ${r.status} ${await r.text()}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < step) break;
  }
  return out;
}

async function upsert(table, rows, onConflict) {
  let url = `${BASE}/rest/v1/${table}`;
  const headers = { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' };
  if (onConflict) url += `?on_conflict=${onConflict}`;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(rows) });
  if (r.status >= 400) throw new Error(`POST ${table} -> ${r.status} ${await r.text()}`);
  return r.status;
}

async function main() {
  const arquivo = path.resolve('exemplos_arquivos_importacao', 'Relatorio_Estudantes_NEE.xlsx');
  if (!fs.existsSync(arquivo)) throw new Error(`Arquivo não encontrado: ${arquivo}`);

  const wb = XLSX.readFile(arquivo);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }).slice(1);

  console.log('Lendo planilha...');
  const [estudantes, tipos] = await Promise.all([
    fetchAll('estudantes', 'id,id_pessoa,nome'),
    fetchAll('tipo_necessidades', 'id,nome'),
  ]);

  const estByNorm = {};
  for (const e of estudantes) (estByNorm[norm(e.nome)] = estByNorm[norm(e.nome)] || []).push(e);

  const tipoByNorm = {};
  for (const t of tipos) tipoByNorm[norm(t.nome)] = t;

  const vinculos = new Map(); // chave estudante_id|tipo_id
  let semEstudante = 0;
  let semTipo = 0;
  let multplo = 0;
  const nomesSemEstudante = new Set();
  const nomesMultiplos = new Set();
  const nomesSemTipo = new Set();

  for (const row of rows) {
    const nome = String(row[0]).trim();
    const turma = String(row[1]).trim();
    const tipoNome = String(row[2]).trim();

    const matches = estByNorm[norm(nome)] || [];
    if (matches.length === 0) { semEstudante++; nomesSemEstudante.add(`${nome} | ${turma}`); continue; }
    if (matches.length > 1) { multplo++; nomesMultiplos.add(`${nome} | ${turma} (${matches.length} registros)`); continue; }
    if (matches[0].id_pessoa == null) { semEstudante++; nomesSemEstudante.add(`${nome} | ${turma} (sem id externo)`); continue; }

    const tipo = tipoByNorm[norm(tipoNome)];
    if (!tipo) { semTipo++; nomesSemTipo.add(tipoNome); continue; }

    vinculos.set(`${matches[0].id_pessoa}|${tipo.id}`, { estudante_id_pessoa: matches[0].id_pessoa, tipo_necessidade_id: tipo.id });
  }

  console.log(`Linhas da planilha: ${rows.length}`);
  console.log(`Vínculos únicos a inserir: ${vinculos.size}`);
  console.log(`Sem estudante correspondente: ${semEstudante}`);
  console.log(`Nome duplicado na base (ignorado): ${multplo}`);
  console.log(`Tipo de necessidade não cadastrado: ${semTipo}`);

  if (nomesSemEstudante.size) { console.log('\n-- Estudantes não encontrados --'); [...nomesSemEstudante].forEach(n => console.log(' ', n)); }
  if (nomesMultiplos.size) { console.log('\n-- Nomes com mais de um registro na base --'); [...nomesMultiplos].forEach(n => console.log(' ', n)); }
  if (nomesSemTipo.size) { console.log('\n-- Tipos não cadastrados --'); [...nomesSemTipo].forEach(n => console.log(' ', n)); }

  const lista = [...vinculos.values()];
  if (lista.length) {
    console.log('\nInserindo vínculos em estudante_necessidades...');
    const step = 500;
    for (let i = 0; i < lista.length; i += step) {
      await upsert('estudante_necessidades', lista.slice(i, i + step), 'estudante_id_pessoa,tipo_necessidade_id');
    }
    console.log(`Concluído: ${lista.length} vínculos inseridos/atualizados.`);
  } else {
    console.log('Nada a inserir.');
  }
}

main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
