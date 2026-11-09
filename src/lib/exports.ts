import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEPARTMENT_BY_CODE } from '@/lib/constants';
import { formatDate, formatNumber } from '@/lib/dates';
import { ENTRY_COLUMNS, type EntryColumnKind } from '@/lib/entryColumns';
import { valuesFromEntry } from '@/lib/entryValues';
import type { ProductionEntry } from '@/lib/types';

export interface ReportSummaryItem {
  label: string;
  value: string;
}

export interface ReportExportInput {
  title: string;
  subtitle: string;
  rows: ProductionEntry[];
  summary: ReportSummaryItem[];
  fileName: string;
}

const EXCEL_HEADERS = ['Department', ...ENTRY_COLUMNS.map((column) => column.header)];

function excelCell(raw: string, kind: EntryColumnKind): string | number {
  if (raw === '') return '';
  return kind === 'number' ? Number(raw) : raw;
}

function excelRow(entry: ProductionEntry): (string | number)[] {
  const values = valuesFromEntry(entry);
  return [
    DEPARTMENT_BY_CODE[entry.department].shortName,
    ...ENTRY_COLUMNS.map((column) => excelCell(values[column.field], column.kind)),
  ];
}

export function exportReportToExcel({ title, subtitle, rows, summary, fileName }: ReportExportInput) {
  const workbook = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.aoa_to_sheet([
    [title],
    [subtitle],
    [],
    ...summary.map((item) => [item.label, item.value]),
  ]);
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  const entriesSheet = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...rows.map(excelRow)]);
  entriesSheet['!cols'] = EXCEL_HEADERS.map((header) => ({ wch: Math.max(14, header.length + 2) }));
  entriesSheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(EXCEL_HEADERS.length - 1)}1` };
  XLSX.utils.book_append_sheet(workbook, entriesSheet, 'Entries');

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

const PDF_HEADERS = ['Date', 'Dept', 'Shift', 'Operator', 'Machine', 'Job / Customer', 'Material', 'Size', 'KG', 'Meters', 'Wastage KG', 'Downtime'];

function pdfRow(entry: ProductionEntry): string[] {
  return [
    formatDate(entry.entry_date),
    DEPARTMENT_BY_CODE[entry.department].shortName,
    entry.shift,
    entry.operator_name,
    entry.machine_name,
    entry.job_ref,
    entry.material,
    entry.size_spec,
    formatNumber(entry.qty_kg, 3),
    formatNumber(entry.qty_meters),
    formatNumber(entry.wastage_kg, 3),
    entry.downtime_reason,
  ];
}

export function exportReportToPdf({ title, subtitle, rows, summary, fileName }: ReportExportInput) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const generatedAt = new Date().toLocaleString('en-GB');

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, 'F');
  doc.setTextColor(251, 191, 36);
  doc.setFontSize(9);
  doc.text('PACKTRACK PRO - PACKAGING ERP', 14, 9);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(title, 14, 17);

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(10);
  doc.text(subtitle, 14, 30);
  doc.text(`Generated: ${generatedAt}`, 14, 35);

  const summaryText = summary.map((item) => `${item.label}: ${item.value}`).join('     ');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(doc.splitTextToSize(summaryText, 270), 14, 42);

  const totalKg = rows.reduce((sum, entry) => sum + entry.qty_kg, 0);
  const totalMeters = rows.reduce((sum, entry) => sum + entry.qty_meters, 0);
  const totalWastage = rows.reduce((sum, entry) => sum + entry.wastage_kg, 0);

  autoTable(doc, {
    startY: 50,
    head: [PDF_HEADERS],
    body: rows.map(pdfRow),
    foot: [[
      'Total', '', '', '', '', '', '', '',
      formatNumber(totalKg, 3),
      formatNumber(totalMeters),
      formatNumber(totalWastage, 3),
      '',
    ]],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
    footStyles: { fillColor: [251, 191, 36], textColor: [15, 23, 42], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${page} of ${pageCount}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
  }

  doc.save(`${fileName}.pdf`);
}
