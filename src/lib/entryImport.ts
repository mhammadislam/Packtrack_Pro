import * as XLSX from 'xlsx';
import type { DepartmentConfig } from '@/lib/constants';
import { buildEntryPayload } from '@/lib/entries';
import { columnsForDepartment, type EntryColumn } from '@/lib/entryColumns';
import { emptyValues, validate } from '@/lib/entryValues';
import type { EntryFormValues } from '@/lib/types';

interface ImportedEntry {
  line: number;
  payload: ReturnType<typeof buildEntryPayload>;
}

interface ImportIssue {
  line: number;
  message: string;
}

export interface ImportParseResult {
  entries: ImportedEntry[];
  issues: ImportIssue[];
}

const pad = (value: number) => String(value).padStart(2, '0');

function dateCellToText(raw: unknown): string {
  if (typeof raw === 'number') {
    const parsed = XLSX.SSF.parse_date_code(raw);
    return parsed ? `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}` : '';
  }
  const text = String(raw).trim();
  const dmy = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${pad(Number(dmy[2]))}-${pad(Number(dmy[1]))}`;
  const ymd = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${pad(Number(ymd[2]))}-${pad(Number(ymd[3]))}`;
  return text;
}

function clockCellToText(raw: unknown): string {
  if (typeof raw === 'number') {
    const minutes = Math.round((raw - Math.floor(raw)) * 24 * 60) % (24 * 60);
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  }
  const text = String(raw).trim();
  const clock = text.match(/^(\d{1,2}):(\d{2})/);
  return clock ? `${pad(Number(clock[1]))}:${clock[2]}` : text;
}

function cellToText(raw: unknown, column: EntryColumn): string {
  if (raw === null || raw === undefined || raw === '') return '';
  if (column.kind === 'date') return dateCellToText(raw);
  if (column.kind === 'clock') return clockCellToText(raw);
  return String(raw).trim();
}

function formatProblem(column: EntryColumn, text: string): string | null {
  if (column.kind === 'date' && text && !/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${column.header} must be a date like 2026-10-30.`;
  if (column.kind === 'clock' && text && !/^\d{2}:\d{2}$/.test(text)) return `${column.header} must be a time like 08:30.`;
  if (column.kind === 'choice' && text && column.options && !column.options.includes(text)) {
    return `${column.header} must be one of: ${column.options.join(', ')}.`;
  }
  return null;
}

export async function parseEntryWorkbook(file: File, department: DepartmentConfig): Promise<ImportParseResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('The file does not contain any sheet.');

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true, blankrows: false });
  const [headerRow = [], ...dataRows] = matrix;
  const columns = columnsForDepartment(department).filter((column) => !column.derived);
  const headerIndex = new Map(headerRow.map((cell, index) => [String(cell).trim().toLowerCase(), index]));
  const matched = columns.filter((column) => headerIndex.has(column.header.toLowerCase()));
  if (matched.length === 0) {
    throw new Error('None of the column headings match this department. Download the template and copy your data into it.');
  }

  const result: ImportParseResult = { entries: [], issues: [] };
  dataRows.forEach((row, index) => {
    const line = index + 2;
    if (row.every((cell) => cell === '' || cell === null)) return;
    const values = importRowValues(row, columns, headerIndex, result, line);
    if (values) addRow(values, department, line, result);
  });
  return { entries: result.entries, issues: result.issues };
}

function importRowValues(
  row: unknown[],
  columns: EntryColumn[],
  headerIndex: Map<string, number>,
  result: ImportParseResult,
  line: number,
): EntryFormValues | null {
  const values: Record<keyof EntryFormValues, string> = { ...emptyValues() };
  let problem: string | null = null;
  for (const column of columns) {
    const index = headerIndex.get(column.header.toLowerCase());
    const text = index === undefined ? '' : cellToText(row[index], column);
    const formatIssue = formatProblem(column, text);
    if (formatIssue && !problem) problem = formatIssue;
    if (column.kind === 'choice' && text === '') continue;
    values[column.field] = text;
  }
  if (problem) {
    result.issues.push({ line, message: problem });
    return null;
  }
  return values as EntryFormValues;
}

function addRow(values: EntryFormValues, department: DepartmentConfig, line: number, result: ImportParseResult) {
  const errors = Object.values(validate(values, department)).filter(Boolean);
  if (errors.length > 0) {
    result.issues.push({ line, message: errors.join(' ') });
    return;
  }
  result.entries.push({ line, payload: buildEntryPayload(values, department) });
}

export async function downloadEntryTemplate(department: DepartmentConfig) {
  const columns = columnsForDepartment(department);
  const workbook = XLSX.utils.book_new();

  const entriesSheet = XLSX.utils.aoa_to_sheet([columns.map((column) => column.header)]);
  entriesSheet['!cols'] = columns.map((column) => ({ wch: Math.max(16, column.header.length + 2) }));
  XLSX.utils.book_append_sheet(workbook, entriesSheet, 'Entries');

  const optionRows = columns
    .filter((column) => column.options)
    .map((column) => [column.header, (column.options ?? []).join(' / ')]);
  const optionsSheet = XLSX.utils.aoa_to_sheet([['Column', 'Allowed values'], ...optionRows]);
  optionsSheet['!cols'] = [{ wch: 28 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, optionsSheet, 'Options');

  XLSX.writeFile(workbook, `${department.code}-entry-template.xlsx`);
}
