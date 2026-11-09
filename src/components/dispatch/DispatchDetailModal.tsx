import { useState } from 'react';
import { FileText, MessageCircle, Printer, Truck } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { formatDate } from '@/lib/dates';
import {
  DISPATCH_GST_RATE,
  PAYMENT_STATUSES,
  dispatchShareMessage,
  formatMoney,
  updatePaymentStatus,
  whatsAppShareUrl,
  type DispatchRecord,
  type PaymentStatus,
} from '@/lib/dispatch';
import { openBiltyPdf, openGatePassPdf, openInvoicePdf } from '@/lib/dispatchDocuments';

interface DispatchDetailModalProps {
  dispatch: DispatchRecord;
  onClose: () => void;
  onPaymentChanged: (message: string) => void;
}

export function DispatchDetailModal({ dispatch, onClose, onPaymentChanged }: DispatchDetailModalProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDocument = async (key: string, action: (record: DispatchRecord) => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action(dispatch);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const changePayment = async (status: PaymentStatus) => {
    if (status === dispatch.payment_status) return;
    setBusy('payment');
    setError(null);
    try {
      await updatePaymentStatus(dispatch.id, status);
      onPaymentChanged(`${dispatch.dispatch_no} marked as ${status}.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const documentButtons = [
    { key: 'invoice', label: 'Invoice PDF', icon: <FileText className="h-4 w-4" />, action: openInvoicePdf },
    { key: 'gatepass', label: 'Gate pass', icon: <Printer className="h-4 w-4" />, action: openGatePassPdf },
    { key: 'bilty', label: 'Bilty', icon: <Truck className="h-4 w-4" />, action: openBiltyPdf },
  ];

  return (
    <Modal open title={`Dispatch ${dispatch.dispatch_no}`} onClose={onClose} size="xl">
      <div className="flex flex-col gap-6">
        {error && <Alert tone="error">{error}</Alert>}

        <dl className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Customer" value={dispatch.customer_name} />
          <Detail label="Dispatch date" value={formatDate(dispatch.dispatch_date)} />
          <Detail label="PO number" value={dispatch.po_number} />
          <Detail label="Vehicle no" value={dispatch.vehicle_no} />
          <Detail label="LR / Bilty no" value={dispatch.lr_no} />
          <div className="flex flex-col gap-1.5">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Payment status</dt>
            <dd className="flex gap-2">
              {PAYMENT_STATUSES.map((status) => {
                const active = dispatch.payment_status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={active}
                    disabled={busy !== null}
                    onClick={() => void changePayment(status)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors duration-150 disabled:opacity-50 ${
                      active ? 'border-black bg-black text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-900'
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </dd>
          </div>
        </dl>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase tracking-wide text-white">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Product</th>
                <th className="px-3 py-2.5 font-semibold">Size</th>
                <th className="px-3 py-2.5 text-right font-semibold">Qty (Kg)</th>
                <th className="px-3 py-2.5 text-right font-semibold">Qty (Pcs)</th>
                <th className="px-3 py-2.5 text-right font-semibold">Rate</th>
                <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {dispatch.lines.map((line) => (
                <tr key={line.id} className="text-slate-700">
                  <td className="px-3 py-2.5 font-medium text-slate-900">{line.item_name}</td>
                  <td className="px-3 py-2.5">{line.size || '-'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{line.qty_kg || '-'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{line.qty_pcs || '-'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{line.rate.toFixed(2)} / {line.unit}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-900">{formatMoney(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto flex w-full flex-col gap-2 sm:max-w-sm">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span className="font-medium text-slate-900">{formatMoney(dispatch.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>GST ({DISPATCH_GST_RATE}%)</span>
            <span className="font-medium text-slate-900">{formatMoney(dispatch.gst_amount)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900">
            <span>Grand total</span>
            <span>{formatMoney(dispatch.grand_total)}</span>
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Documents and sharing</h3>
          <div className="flex flex-wrap gap-2">
            {documentButtons.map((document) => (
              <Button
                key={document.key}
                variant="secondary"
                icon={document.icon}
                loading={busy === document.key}
                disabled={busy !== null && busy !== document.key}
                onClick={() => void runDocument(document.key, document.action)}
              >
                {document.label}
              </Button>
            ))}
            <a
              href={whatsAppShareUrl(dispatchShareMessage(dispatch))}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Share on WhatsApp
            </a>
          </div>
          <p className="text-xs text-slate-500">
            WhatsApp opens with the dispatch summary. Attach the invoice PDF yourself if the customer needs it.
          </p>
        </section>
      </div>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900">{value || '-'}</dd>
    </div>
  );
}
