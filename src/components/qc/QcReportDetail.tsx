import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Pencil, Printer, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { QcGradeBadge, QcStatusBadge } from '@/components/qc/QcBadges';
import { printQcCertificate } from '@/lib/qcExports';
import {
  QC_NUMERIC_PARAMETERS,
  QC_RESULT_PARAMETERS,
  deleteQcReport,
  qcAttachmentUrl,
  qcQrText,
  type QcReport,
} from '@/lib/qc';
import { formatDate, formatNumber } from '@/lib/dates';

interface QcReportDetailProps {
  report: QcReport;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}

type BusyAction = 'print' | 'delete';

export function QcReportDetail({ report, canEdit, canDelete, onClose, onEdit, onDeleted }: QcReportDetailProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qcQrText(report), { margin: 1, width: 220, color: { dark: '#0b1020', light: '#ffffff' } })
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {
        if (active) setQrUrl(null);
      });
    return () => {
      active = false;
    };
  }, [report]);

  const photoUrl = report.defect_image_path ? qcAttachmentUrl(report.defect_image_path) : null;

  const handlePrint = async () => {
    setBusy('print');
    setError(null);
    try {
      await printQcCertificate(report);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    setBusy('delete');
    setError(null);
    try {
      await deleteQcReport(report.id);
      onDeleted();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(null);
    }
  };

  const footer = (
    <>
      {canDelete &&
        (confirmDelete ? (
          <>
            <Button variant="danger" onClick={() => void handleDelete()} loading={busy === 'delete'}>
              Confirm delete
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={busy !== null}>
              Keep report
            </Button>
          </>
        ) : (
          <Button variant="danger" onClick={() => setConfirmDelete(true)} icon={<Trash2 className="h-4 w-4" />}>
            Delete
          </Button>
        ))}
      {canEdit && (
        <Button variant="secondary" onClick={onEdit} icon={<Pencil className="h-4 w-4" />}>
          Edit
        </Button>
      )}
      <Button onClick={() => void handlePrint()} loading={busy === 'print'} icon={<Printer className="h-4 w-4" />}>
        Print certificate
      </Button>
    </>
  );

  return (
    <Modal open title={report.report_no} onClose={onClose} size="xl" footer={footer}>
      <div className="flex flex-col gap-6">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <QcStatusBadge status={report.status} />
            <QcGradeBadge grade={report.grade} />
          </div>
          <p className="text-sm text-slate-600">
            Defect rate <span className="font-semibold text-slate-900">{report.defect_pct.toFixed(2)}%</span> ({report.defective_qty} of {report.sample_qty})
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_auto]">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <DetailItem label="Date" value={formatDate(report.report_date)} />
            <DetailItem label="Shift" value={report.shift} />
            <DetailItem label="Customer" value={report.customer_name} />
            <DetailItem label="Job Card No" value={report.job_card_no} />
            <DetailItem label="Machine No" value={report.machine_no} />
            <DetailItem label="Operator" value={report.operator_name} />
            <DetailItem label="Film Structure" value={report.film_structure} className="col-span-2" />
            <DetailItem label="Defect Type" value={report.defect_type ?? 'None'} />
            <DetailItem label="QC Officer" value={report.officer_name || '-'} />
          </dl>
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
            {qrUrl ? <img src={qrUrl} alt={`QR code for ${report.report_no}`} className="h-36 w-36" /> : <div className="h-36 w-36 animate-pulse rounded-lg bg-slate-200" />}
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">{report.report_no}</p>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">QC parameters</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {QC_NUMERIC_PARAMETERS.map(({ key, label, unit }) => (
              <ParameterRow key={key} label={label} value={report[key] === null ? 'Not recorded' : `${formatNumber(report[key], 2)} ${unit}`} />
            ))}
            {QC_RESULT_PARAMETERS.map(({ key, label }) => (
              <ParameterRow key={key} label={label} value={report[key] ?? 'Not recorded'} tone={report[key]} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Defect photo</p>
            {photoUrl ? (
              <a href={photoUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-200">
                <img src={photoUrl} alt="Defect" className="max-h-56 w-full object-contain bg-slate-100" />
              </a>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">No defect photo</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">QC officer signature</p>
            {report.signature_data ? (
              <img src={report.signature_data} alt="QC officer signature" className="h-40 w-full rounded-xl border border-slate-200 bg-white object-contain" />
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">Not signed</p>
            )}
          </div>
        </div>

        {report.notes && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Remarks</p>
            <p className="whitespace-pre-line text-sm text-slate-700">{report.notes}</p>
          </div>
        )}

        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Logged {formatDate(report.created_at.slice(0, 10))}
        </p>
      </div>
    </Modal>
  );
}

function DetailItem({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-1 truncate font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function ParameterRow({ label, value, tone }: { label: string; value: string; tone?: 'Pass' | 'Fail' | null }) {
  const valueClass = tone === 'Fail' ? 'text-red-700' : tone === 'Pass' ? 'text-emerald-700' : 'text-slate-900';
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}
