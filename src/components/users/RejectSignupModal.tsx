import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, TextAreaInput } from '@/components/ui/Field';

const REASON_MIN = 3;
const REASON_MAX = 500;

interface RejectSignupModalProps {
  open: boolean;
  name: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function RejectSignupModal({ open, name, busy, error, onCancel, onConfirm }: RejectSignupModalProps) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const reasonError =
    trimmed.length < REASON_MIN
      ? `Please give a reason of at least ${REASON_MIN} characters. The user will see it.`
      : trimmed.length > REASON_MAX
        ? `Please keep the reason under ${REASON_MAX} characters.`
        : null;

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Modal
      open={open}
      title={`Reject ${name}'s request`}
      onClose={onCancel}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} disabled={!!reasonError} onClick={() => onConfirm(trimmed)}>
            Reject account
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          The user cannot sign in after rejection. The reason below is shown to them when they try to sign in.
        </p>
        <Field label="Reason for rejection" htmlFor="reject-reason" required error={reason ? reasonError ?? undefined : undefined}>
          <TextAreaInput
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={REASON_MAX + 50}
            placeholder="e.g. Not an employee of the company"
          />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Modal>
  );
}

export function remainingLabel(requestedAt: string, now: number): { text: string; overdue: boolean } {
  const deadline = new Date(requestedAt).getTime() + 24 * 60 * 60 * 1000;
  const diff = deadline - now;
  if (diff <= 0) return { text: 'Past 24 hours', overdue: true };
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return { text: `${hours}h ${minutes}m remaining`, overdue: false };
}

export function RemainingBadge({ requestedAt, now }: { requestedAt: string; now: number }) {
  const { text, overdue } = remainingLabel(requestedAt, now);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        overdue ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
      }`}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {text}
    </span>
  );
}
