import { useEffect, useState } from 'react';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { approveSignup, fetchPendingApprovals, rejectSignup, type PendingApproval } from '@/lib/approvals';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { RejectSignupModal, RemainingBadge } from '@/components/users/RejectSignupModal';

const CLOCK_TICK_MS = 60_000;

function formatRequested(requestedAt: string): string {
  return new Date(requestedAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
}

export function PendingApprovalsPanel() {
  const [rows, setRows] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingApproval | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPendingApprovals()
      .then((list) => {
        if (active) setRows(list);
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const removeRow = (userId: string) => setRows((current) => current.filter((row) => row.user_id !== userId));

  const approve = async (row: PendingApproval) => {
    setBusyId(row.user_id);
    setRowError(null);
    try {
      await approveSignup(row.user_id);
      removeRow(row.user_id);
    } catch (caught) {
      setRowError({ id: row.user_id, message: errorMessage(caught) });
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async (reason: string) => {
    if (!rejectTarget) return;
    setRejectBusy(true);
    setRejectError(null);
    try {
      await rejectSignup(rejectTarget.user_id, reason);
      removeRow(rejectTarget.user_id);
      setRejectTarget(null);
    } catch (caught) {
      setRejectError(errorMessage(caught));
    } finally {
      setRejectBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <span className="rounded-lg bg-sky-100 p-2 text-sky-800">
          <UserPlus className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Pending approvals</h2>
          <p className="mt-1 text-sm text-slate-600">
            New sign-ups cannot use the app until you approve them. Each request should be reviewed within 24 hours.
          </p>
        </div>
      </div>

      {error && <Alert tone="error">Pending requests could not be loaded. {error}</Alert>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3">Applicant</th>
                <th className="whitespace-nowrap px-5 py-3">Phone</th>
                <th className="whitespace-nowrap px-5 py-3">Requested</th>
                <th className="whitespace-nowrap px-5 py-3">Time left</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={5} className="px-5 py-6 text-slate-500">Loading requests...</td></tr>
              )}
              {!loading && rows.length === 0 && !error && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-600" aria-hidden="true" />
                    No pending requests. New sign-ups will appear here.
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const busy = busyId === row.user_id;
                return (
                  <tr key={row.id} className="align-top transition hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{row.full_name || 'Unnamed applicant'}</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-700">@{row.username}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{row.email}</p>
                      {rowError?.id === row.user_id && <p className="mt-1 text-xs font-medium text-red-600">{rowError.message}</p>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">{row.phone || '-'}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatRequested(row.requested_at)}</td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <RemainingBadge requestedAt={row.requested_at} now={now} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="danger" disabled={busy} onClick={() => {
                          setRejectError(null);
                          setRejectTarget(row);
                        }}>
                          Reject
                        </Button>
                        <Button loading={busy} onClick={() => void approve(row)} icon={<CheckCircle2 className="h-4 w-4" />}>
                          Approve
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <RejectSignupModal
        open={rejectTarget !== null}
        name={rejectTarget?.full_name || rejectTarget?.username || 'this user'}
        busy={rejectBusy}
        error={rejectError}
        onCancel={() => setRejectTarget(null)}
        onConfirm={(reason) => void confirmReject(reason)}
      />
    </div>
  );
}
