import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { COMPANY } from '@/lib/company';
import { formatDate, formatNumber, todayISO } from '@/lib/dates';
import {
  QC_NUMERIC_PARAMETERS,
  QC_RESULT_PARAMETERS,
  qcAttachmentUrl,
  qcQrText,
  type QcReport,
} from '@/lib/qc';

const EXCEL_HEADERS = [
  'Report No', 'Date', 'Shift', 'Machine No', 'Operator', 'Job Card No', 'Customer', 'Film Structure',
  'GSM', 'Micron', 'Seal Strength (N/15mm)', 'Peeling Test', 'Lamination Bond', 'Corona (dyne)',
  'Registration', 'Delta E', 'Bag Check', 'Leak Test', 'Sample Qty', 'Defective Qty', 'Defect Type',
  'Defect %', 'Grade', 'Status', 'QC Officer', 'Notes',
];

function optional(value: number | string | null): number | string {
  return value ?? '';
}

function excelRow(report: QcReport): (string | number)[] {
  return [
    report.report_no,
    formatDate(report.report_date),
    report.shift,
    report.machine_no,
    report.operator_name,
    report.job_card_no,
    report.customer_name,
    report.film_structure,
    optional(report.gsm_check),
    optional(report.micron),
    optional(report.seal_strength_n),
    report.peel_test ?? '',
    optional(report.lamination_bond_strength),
    optional(report.corona_dyne),
    report.registration_check ?? '',
    optional(report.color_delta_e),
    report.bag_check ?? '',
    report.leak_test ?? '',
    report.sample_qty,
    report.defective_qty,
    report.defect_type ?? '',
    report.defect_pct,
    report.grade,
    report.status,
    report.officer_name,
    report.notes,
  ];
}

export function exportQcToExcel(rows: QcReport[]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...rows.map(excelRow)]);
  sheet['!cols'] = EXCEL_HEADERS.map((header) => ({ wch: Math.max(14, header.length + 2) }));
  sheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(EXCEL_HEADERS.length - 1)}1` };
  XLSX.utils.book_append_sheet(workbook, sheet, 'QC Reports');
  XLSX.writeFile(workbook, `QC-Reports-${todayISO()}.xlsx`);
}

function decodeImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image failed to load'));
    image.src = source;
  });
}

export async function loadPngImage(source: string): Promise<{ dataUrl: string; ratio: number } | null> {
  try {
    const image = await decodeImage(source);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    return { dataUrl: canvas.toDataURL('image/png'), ratio: canvas.width / canvas.height };
  } catch {
    return null;
  }
}

function fitBox(ratio: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const width = Math.min(maxWidth, maxHeight * ratio);
  return { width, height: width / ratio };
}

function resultLabel(value: string | null): string {
  return value ?? 'Not recorded';
}

export async function printQcCertificate(report: QcReport) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const [qrDataUrl, defectImage, signatureImage] = await Promise.all([
    QRCode.toDataURL(qcQrText(report), { margin: 1, width: 280, color: { dark: '#0b1020', light: '#ffffff' } }),
    report.defect_image_path ? loadPngImage(qcAttachmentUrl(report.defect_image_path)) : Promise.resolve(null),
    report.signature_data ? loadPngImage(report.signature_data) : Promise.resolve(null),
  ]);

  doc.setFillColor(11, 16, 32);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(251, 191, 36);
  doc.setFontSize(9);
  doc.text(COMPANY.name.toUpperCase(), 14, 12);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('Quality Control Certificate', 14, 24);
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(COMPANY.address, 14, 31);
  doc.text(`NTN: ${COMPANY.ntn}`, 14, 36);
  doc.addImage(qrDataUrl, 'PNG', pageWidth - 40, 5, 28, 28);

  const status = report.status;
  const statusColor: [number, number, number] = status === 'Approved' ? [16, 185, 129] : status === 'Rejected' ? [239, 68, 68] : [245, 158, 11];
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(`Report No: ${report.report_no}`, 14, 50);
  doc.text(`Date: ${formatDate(report.report_date)}`, 90, 50);
  doc.setFillColor(...statusColor);
  doc.roundedRect(pageWidth - 60, 44, 46, 10, 2, 2, 'F');
  doc.setTextColor(11, 16, 32);
  doc.setFont('helvetica', 'bold');
  doc.text(`${status.toUpperCase()}  |  GRADE ${report.grade}`, pageWidth - 37, 50.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');

  const label = (text: string) => ({ content: text, styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number] } });
  autoTable(doc, {
    startY: 58,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 57 }, 2: { cellWidth: 38 }, 3: { cellWidth: 57 } },
    body: [
      [label('Customer'), report.customer_name, label('Job Card No'), report.job_card_no],
      [label('Film Structure'), report.film_structure, label('Machine No'), report.machine_no],
      [label('Operator'), report.operator_name, label('Shift'), report.shift],
    ],
  });

  const parameterRows = [
    ...QC_NUMERIC_PARAMETERS.map(({ key, label: name, unit }) => {
      const value = report[key];
      return [name, unit, value === null ? 'Not recorded' : String(value)];
    }),
    ...QC_RESULT_PARAMETERS.map(({ key, label: name }) => {
      const value = report[key];
      return [name, 'Pass / Fail', resultLabel(value)];
    }),
  ];
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['QC Parameter', 'Specification / Unit', 'Result']],
    body: parameterRows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [11, 16, 32], textColor: [255, 255, 255] },
    didParseCell: (cell) => {
      if (cell.section !== 'body' || cell.column.index !== 2) return;
      if (cell.cell.raw === 'Fail') cell.cell.styles.textColor = [220, 38, 38];
      if (cell.cell.raw === 'Pass') cell.cell.styles.textColor = [5, 150, 105];
    },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['Sampling', 'Value']],
    body: [
      ['Sample quantity checked', formatNumber(report.sample_qty)],
      ['Defective quantity', formatNumber(report.defective_qty)],
      ['Defect type', report.defect_type ?? 'None'],
      ['Defect percentage', `${report.defect_pct.toFixed(2)}%`],
      ['Grade (A below 2%, B 2% to 5%, Rejected above 5%)', report.grade],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [11, 16, 32], textColor: [255, 255, 255] },
  });

  let cursorY = doc.lastAutoTable.finalY + 10;
  const boxWidth = 84;
  const boxHeight = 52;

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Defect photo', 14, cursorY);
  doc.text('QC officer signature', 110, cursorY);
  cursorY += 3;
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, cursorY, boxWidth, boxHeight);
  doc.rect(110, cursorY, boxWidth, boxHeight);

  if (defectImage) {
    const fit = fitBox(defectImage.ratio, boxWidth - 4, boxHeight - 4);
    doc.addImage(defectImage.dataUrl, 'PNG', 14 + (boxWidth - fit.width) / 2, cursorY + (boxHeight - fit.height) / 2, fit.width, fit.height);
  } else {
    doc.setTextColor(148, 163, 184);
    doc.text('No defect photo attached', 14 + boxWidth / 2, cursorY + boxHeight / 2, { align: 'center' });
  }

  if (signatureImage) {
    const fit = fitBox(signatureImage.ratio, boxWidth - 4, boxHeight - 4);
    doc.addImage(signatureImage.dataUrl, 'PNG', 110 + (boxWidth - fit.width) / 2, cursorY + (boxHeight - fit.height) / 2, fit.width, fit.height);
  }

  cursorY += boxHeight + 5;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.text(`QC Officer: ${report.officer_name || '-'}`, 110, cursorY);

  if (report.notes) {
    cursorY += 8;
    doc.setTextColor(71, 85, 105);
    doc.text(doc.splitTextToSize(`Remarks: ${report.notes}`, pageWidth - 28), 14, cursorY);
  }

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated ${new Date().toLocaleString('en-GB')}`, 14, pageHeight - 8);
  doc.text('Scan the QR code to verify report details.', pageWidth - 14, pageHeight - 8, { align: 'right' });

  doc.save(`${report.report_no}-QC-Certificate.pdf`);
}
