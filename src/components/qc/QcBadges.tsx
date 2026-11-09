import type { QcGrade, QcStatus } from '@/lib/qc';

const STATUS_STYLE: Record<QcStatus, string> = {
  Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Hold: 'bg-amber-50 text-amber-800 ring-amber-200',
  Rejected: 'bg-red-50 text-red-700 ring-red-200',
};

const GRADE_STYLE: Record<QcGrade, string> = {
  A: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  B: 'bg-sky-50 text-sky-700 ring-sky-200',
  Rejected: 'bg-red-50 text-red-700 ring-red-200',
};

const PILL_BASE = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset';

export function QcStatusBadge({ status }: { status: QcStatus }) {
  return <span className={`${PILL_BASE} ${STATUS_STYLE[status]}`}>{status}</span>;
}

export function QcGradeBadge({ grade }: { grade: QcGrade }) {
  const label = grade === 'Rejected' ? 'Rejected' : `Grade ${grade}`;
  return <span className={`${PILL_BASE} ${GRADE_STYLE[grade]}`}>{label}</span>;
}
