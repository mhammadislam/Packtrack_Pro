import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COMPANY } from '@/lib/company';
import { formatDate, formatNumber, todayISO } from '@/lib/dates';
import { STOCK_STATUS_LABEL, TXN_LABELS, stockStatus, type LedgerRow, type StockSummary } from '@/lib/inventory';

const SUMMARY_HEADERS = [
  'Item Code', 'Item Name', 'Category', 'Material', 'Supplier', 'Unit', 'Opening', 'Purchase In',
  'Issue Out', 'Adjust +', 'Adjust -', 'Current Stock', 'Minimum', 'Reorder Level', 'Avg Rate',
  'Stock Value', 'Status',
];

const LEDGER_HEADERS = [
  'Date', 'Item Code', 'Item Name', 'Movement', 'In', 'Out', 'Balance', 'Unit', 'Rate', 'Amount',
  'Supplier', 'GRN No', 'Supplier Invoice', 'Department', 'Job Card', 'Reason',
];

function summaryCells(item: StockSummary): (string | number)[] {
  return [
    item.item_code,
    item.item_name,
    item.category,
    item.material_type ?? '',
    item.supplier,
    item.unit,
    item.opening_stock,
    item.purchase_in,
    item.issue_out,
    item.adjust_in,
    item.adjust_out,
    item.current_stock,
    item.minimum_stock,
    item.reorder_level,
    item.avg_rate,
    item.stock_value,
    STOCK_STATUS_LABEL[stockStatus(item)],
  ];
}

function ledgerCells(row: LedgerRow): (string | number)[] {
  return [
    formatDate(row.txn_date),
    row.item_code,
    row.item_name,
    TXN_LABELS[row.txn_type],
    row.qty_in,
    row.qty_out,
    row.running_balance,
    row.unit,
    row.rate,
    row.amount,
    row.supplier_name,
    row.grn_no,
    row.supplier_invoice_no,
    row.department ?? '',
    row.job_card_no,
    row.reason,
  ];
}

function downloadSheet(headers: string[], rows: (string | number)[][], sheetName: string, fileName: string) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet['!cols'] = headers.map((header) => ({ wch: Math.max(12, header.length + 2) }));
  sheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}1` };
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

export function exportStockSummaryToExcel(items: StockSummary[]) {
  downloadSheet(SUMMARY_HEADERS, items.map(summaryCells), 'Stock Summary', `Stock-Summary-${todayISO()}.xlsx`);
}

export function exportLedgerToExcel(rows: LedgerRow[]) {
  downloadSheet(LEDGER_HEADERS, rows.map(ledgerCells), 'Stock Ledger', `Stock-Ledger-${todayISO()}.xlsx`);
}

export function printStockReport(items: StockSummary[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalValue = items.reduce((sum, item) => sum + item.stock_value, 0);
  const lowCount = items.filter((item) => stockStatus(item) === 'low').length;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('Stock Report', 14, 13);
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`${COMPANY.name}  |  ${COMPANY.address}`, 14, 20);
  doc.text(`Generated ${formatDate(todayISO())}`, pageWidth - 14, 13, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(`Items: ${items.length}`, 14, 38);
  doc.text(`Low stock items: ${lowCount}`, 60, 38);
  doc.text(`Total stock value: ${formatNumber(totalValue)}`, 120, 38);

  autoTable(doc, {
    startY: 44,
    head: [['Code', 'Item', 'Category', 'Supplier', 'Unit', 'Current', 'Minimum', 'Avg Rate', 'Value', 'Status']],
    body: items.map((item) => [
      item.item_code,
      item.item_name,
      item.category,
      item.supplier,
      item.unit,
      formatNumber(item.current_stock, 3),
      formatNumber(item.minimum_stock, 3),
      formatNumber(item.avg_rate),
      formatNumber(item.stock_value),
      STOCK_STATUS_LABEL[stockStatus(item)],
    ]),
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
    didParseCell: (cell) => {
      if (cell.section !== 'body' || cell.column.index !== 9) return;
      if (cell.cell.raw === STOCK_STATUS_LABEL.low) cell.cell.styles.textColor = [220, 38, 38];
      if (cell.cell.raw === STOCK_STATUS_LABEL.reorder) cell.cell.styles.textColor = [217, 119, 6];
    },
  });

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`NTN: ${COMPANY.ntn}`, 14, pageHeight - 8);

  const url = doc.output('bloburl');
  window.open(url, '_blank');
}
