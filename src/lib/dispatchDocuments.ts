import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsPDF } from 'jspdf';
import { Factory } from 'lucide-react';
import { COMPANY } from '@/lib/company';
import { formatDate, formatNumber } from '@/lib/dates';
import { DISPATCH_GST_RATE, type DispatchLine, type DispatchRecord } from '@/lib/dispatch';
import { loadPngImage } from '@/lib/qcExports';

type Rgb = [number, number, number];

const INK: Rgb = [15, 23, 42];
const MUTED: Rgb = [100, 116, 139];
const WHITE: Rgb = [255, 255, 255];
const STRIPE: Rgb = [241, 245, 249];
const RULE: Rgb = [203, 213, 225];

const TABLE_LEFT = 14;
const TABLE_RIGHT = 196;
const TABLE_WIDTH = TABLE_RIGHT - TABLE_LEFT;

interface Column {
  label: string;
  x: number;
  align?: 'left' | 'right';
}

function setText(doc: jsPDF, size: number, options: { bold?: boolean; color?: Rgb } = {}) {
  const color = options.color ?? INK;
  doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
}

function setFill(doc: jsPDF, color: Rgb) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setDraw(doc: jsPDF, color: Rgb, width: number) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(width);
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function amountText(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function quantityText(value: number): string {
  return value > 0 ? formatNumber(value, 3) : '-';
}

async function loadLogo(): Promise<string | null> {
  const svg = renderToStaticMarkup(createElement(Factory, { size: 256, color: '#000000', strokeWidth: 2 }));
  const image = await loadPngImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  return image?.dataUrl ?? null;
}

async function openPdf(build: () => Promise<jsPDF>) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Allow pop-ups for this site to open the PDF.');
  try {
    const doc = await build();
    popup.location.href = String(doc.output('bloburl'));
  } catch (caught) {
    popup.close();
    throw caught;
  }
}

function drawHeader(doc: jsPDF, logo: string | null, title: string, dispatch: DispatchRecord) {
  const right = doc.internal.pageSize.getWidth() - 14;
  const nameX = logo ? 32 : 14;
  if (logo) doc.addImage(logo, 'PNG', 14, 12, 14, 14);

  setText(doc, 15, { bold: true });
  doc.text(COMPANY.name, nameX, 17);
  setText(doc, 8.5, { color: MUTED });
  doc.text(COMPANY.address, nameX, 23);
  doc.text(`NTN: ${COMPANY.ntn}`, nameX, 28);

  setText(doc, 18, { bold: true });
  doc.text(title, right, 17, { align: 'right' });
  setText(doc, 9, { bold: true });
  doc.text(dispatch.dispatch_no, right, 24, { align: 'right' });
  setText(doc, 8.5, { color: MUTED });
  doc.text(formatDate(dispatch.dispatch_date), right, 29, { align: 'right' });

  setDraw(doc, INK, 0.6);
  doc.line(14, 35, right, 35);
}

function drawLabeled(doc: jsPDF, label: string, value: string, x: number, y: number) {
  setText(doc, 7.5, { color: MUTED });
  doc.text(label.toUpperCase(), x, y);
  setText(doc, 10, { bold: true });
  doc.text(value || '-', x, y + 5);
}

function drawBlankField(doc: jsPDF, label: string, x: number, y: number, width: number) {
  setText(doc, 7.5, { color: MUTED });
  doc.text(label.toUpperCase(), x, y);
  setDraw(doc, RULE, 0.3);
  doc.line(x, y + 8, x + width, y + 8);
}

function drawTable(doc: jsPDF, columns: Column[], rows: string[][], startY: number, rowHeight = 7): number {
  setFill(doc, INK);
  doc.rect(TABLE_LEFT, startY, TABLE_WIDTH, rowHeight, 'F');
  setText(doc, 8, { bold: true, color: WHITE });
  const baseline = rowHeight * 0.66;
  columns.forEach((column) => doc.text(column.label, column.x, startY + baseline, { align: column.align ?? 'left' }));

  let y = startY + rowHeight;
  rows.forEach((row, index) => {
    if (index % 2 === 1) {
      setFill(doc, STRIPE);
      doc.rect(TABLE_LEFT, y, TABLE_WIDTH, rowHeight, 'F');
    }
    setText(doc, 9);
    row.forEach((cell, cellIndex) => {
      const column = columns[cellIndex];
      doc.text(cell, column.x, y + baseline, { align: column.align ?? 'left' });
    });
    y += rowHeight;
  });

  setDraw(doc, RULE, 0.2);
  doc.line(TABLE_LEFT, y, TABLE_RIGHT, y);
  return y;
}

function drawSignatures(doc: jsPDF, labels: string[], y: number) {
  const width = 50;
  const gap = (TABLE_WIDTH - width * labels.length) / (labels.length - 1);
  labels.forEach((label, index) => {
    const x = TABLE_LEFT + index * (width + gap);
    setDraw(doc, INK, 0.3);
    doc.line(x, y, x + width, y);
    setText(doc, 8.5, { color: MUTED });
    doc.text(label, x, y + 5);
  });
}

function drawStatusPill(doc: jsPDF, status: DispatchRecord['payment_status'], x: number, y: number) {
  const paid = status === 'Paid';
  setFill(doc, paid ? INK : WHITE);
  setDraw(doc, INK, 0.4);
  doc.roundedRect(x, y, 24, 7, 1.5, 1.5, 'FD');
  setText(doc, 8, { bold: true, color: paid ? WHITE : INK });
  doc.text(status.toUpperCase(), x + 12, y + 4.8, { align: 'center' });
}

function lineQuantityRows(lines: DispatchLine[]): string[][] {
  return lines.map((line, index) => [
    String(index + 1),
    clip(line.item_name, 40),
    clip(line.size || '-', 20),
    quantityText(line.qty_kg),
    quantityText(line.qty_pcs),
  ]);
}

export async function openInvoicePdf(dispatch: DispatchRecord) {
  await openPdf(async () => {
    const logo = await loadLogo();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    drawHeader(doc, logo, 'TAX INVOICE', dispatch);

    drawLabeled(doc, 'Bill to', dispatch.customer_name, 14, 44);
    drawLabeled(doc, 'Vehicle no', dispatch.vehicle_no, 110, 44);
    drawLabeled(doc, 'PO number', dispatch.po_number, 14, 58);
    drawLabeled(doc, 'LR / Bilty no', dispatch.lr_no, 110, 58);
    setText(doc, 7.5, { color: MUTED });
    doc.text('PAYMENT STATUS', 14, 72);
    drawStatusPill(doc, dispatch.payment_status, 14, 75);

    const columns: Column[] = [
      { label: '#', x: 16 },
      { label: 'Product', x: 24 },
      { label: 'Size', x: 92 },
      { label: 'Qty (Kg)', x: 124, align: 'right' },
      { label: 'Qty (Pcs)', x: 146, align: 'right' },
      { label: 'Rate', x: 170, align: 'right' },
      { label: 'Amount (PKR)', x: 194, align: 'right' },
    ];
    const rows = dispatch.lines.map((line, index) => [
      String(index + 1),
      clip(line.item_name, 40),
      clip(line.size || '-', 20),
      quantityText(line.qty_kg),
      quantityText(line.qty_pcs),
      amountText(line.rate),
      amountText(line.amount),
    ]);
    const tableEnd = drawTable(doc, columns, rows, 88);

    const totalsX = 150;
    const totalsY = tableEnd + 10;
    setText(doc, 9, { color: MUTED });
    doc.text('Subtotal', totalsX, totalsY);
    doc.text(`GST (${DISPATCH_GST_RATE}%)`, totalsX, totalsY + 7);
    doc.text(amountText(dispatch.subtotal), TABLE_RIGHT, totalsY, { align: 'right' });
    doc.text(amountText(dispatch.gst_amount), TABLE_RIGHT, totalsY + 7, { align: 'right' });
    setDraw(doc, INK, 0.4);
    doc.line(totalsX, totalsY + 11, TABLE_RIGHT, totalsY + 11);
    setText(doc, 11, { bold: true });
    doc.text('Grand total (PKR)', totalsX, totalsY + 18);
    doc.text(amountText(dispatch.grand_total), TABLE_RIGHT, totalsY + 18, { align: 'right' });

    setDraw(doc, INK, 0.3);
    doc.line(130, 262, TABLE_RIGHT, 262);
    setText(doc, 8.5, { color: MUTED });
    doc.text('Authorised signatory', 130, 267);
    doc.text('This is a computer generated invoice.', TABLE_LEFT, 282);
    return doc;
  });
}

export async function openGatePassPdf(dispatch: DispatchRecord) {
  await openPdf(async () => {
    const logo = await loadLogo();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    drawHeader(doc, logo, 'GATE PASS', dispatch);

    drawLabeled(doc, 'Customer', dispatch.customer_name, 14, 44);
    drawLabeled(doc, 'PO number', dispatch.po_number, 110, 44);
    drawLabeled(doc, 'Vehicle no', dispatch.vehicle_no, 14, 58);
    drawLabeled(doc, 'LR / Bilty no', dispatch.lr_no, 110, 58);

    const columns: Column[] = [
      { label: '#', x: 16 },
      { label: 'Product', x: 24 },
      { label: 'Size', x: 100 },
      { label: 'Qty (Kg)', x: 160, align: 'right' },
      { label: 'Qty (Pcs)', x: 194, align: 'right' },
    ];
    const tableEnd = drawTable(doc, columns, lineQuantityRows(dispatch.lines), 74, 8);

    const totalKg = dispatch.lines.reduce((sum, line) => sum + line.qty_kg, 0);
    const totalPcs = dispatch.lines.reduce((sum, line) => sum + line.qty_pcs, 0);
    setText(doc, 10, { bold: true });
    doc.text('Total', 24, tableEnd + 8);
    doc.text(quantityText(totalKg), 160, tableEnd + 8, { align: 'right' });
    doc.text(quantityText(totalPcs), 194, tableEnd + 8, { align: 'right' });

    setText(doc, 9, { color: MUTED });
    doc.text('Goods may leave the premises only with this gate pass signed by the store incharge.', TABLE_LEFT, 236);
    drawSignatures(doc, ['Security guard', 'Driver', 'Store incharge'], 258);
    return doc;
  });
}

export async function openBiltyPdf(dispatch: DispatchRecord) {
  await openPdf(async () => {
    const logo = await loadLogo();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    drawHeader(doc, logo, 'BILTY (LR)', dispatch);

    drawLabeled(doc, 'LR / Bilty no', dispatch.lr_no, 14, 44);
    drawLabeled(doc, 'Vehicle no', dispatch.vehicle_no, 110, 44);
    drawLabeled(doc, 'Consignor', COMPANY.name, 14, 58);
    drawLabeled(doc, 'Consignee', dispatch.customer_name, 110, 58);
    drawLabeled(doc, 'From', 'Korangi, Karachi', 14, 72);
    drawBlankField(doc, 'Destination', 110, 72, 82);
    drawLabeled(doc, 'PO number', dispatch.po_number, 14, 86);

    const columns: Column[] = [
      { label: '#', x: 16 },
      { label: 'Description of goods', x: 24 },
      { label: 'Size', x: 100 },
      { label: 'Packages (Pcs)', x: 160, align: 'right' },
      { label: 'Weight (Kg)', x: 194, align: 'right' },
    ];
    const rows = dispatch.lines.map((line, index) => [
      String(index + 1),
      clip(line.item_name, 46),
      clip(line.size || '-', 20),
      quantityText(line.qty_pcs),
      quantityText(line.qty_kg),
    ]);
    const tableEnd = drawTable(doc, columns, rows, 102, 8);

    const totalPcs = dispatch.lines.reduce((sum, line) => sum + line.qty_pcs, 0);
    const totalKg = dispatch.lines.reduce((sum, line) => sum + line.qty_kg, 0);
    setText(doc, 10, { bold: true });
    doc.text('Total', 24, tableEnd + 8);
    doc.text(quantityText(totalPcs), 160, tableEnd + 8, { align: 'right' });
    doc.text(quantityText(totalKg), 194, tableEnd + 8, { align: 'right' });

    setText(doc, 9, { color: MUTED });
    const declaration = doc.splitTextToSize(
      'Goods booked as described above, in the stated packages and weight. The carrier accepts them subject to the agreed terms of carriage.',
      TABLE_WIDTH,
    );
    doc.text(declaration, TABLE_LEFT, tableEnd + 24);
    drawSignatures(doc, ['Consignor', 'Transporter / Driver', 'Receiver'], 258);
    return doc;
  });
}
