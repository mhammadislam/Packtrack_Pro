import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { DISPATCH_GST_RATE, PAYMENT_STATUSES, calculateTotals, createDispatch, formatMoney, type PaymentStatus } from '@/lib/dispatch';
import {
  DISPATCH_MAX_LINES,
  buildDispatchInput,
  dispatchFormEmpty,
  lineAmount,
  newDispatchLine,
  validateDispatchForm,
  type DispatchFormValues,
  type DispatchLineForm,
} from '@/lib/dispatchForms';
import type { StockSummary } from '@/lib/inventory';

const FORM_ID = 'dispatch-form';

interface DispatchFormModalProps {
  items: StockSummary[];
  onClose: () => void;
  onSaved: () => void;
}

export function DispatchFormModal({ items, onClose, onSaved }: DispatchFormModalProps) {
  const [values, setValues] = useState<DispatchFormValues>(dispatchFormEmpty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = <K extends keyof DispatchFormValues>(key: K, value: DispatchFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const updateLine = (key: string, patch: Partial<DispatchLineForm>) =>
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }));

  const addLine = () =>
    setValues((current) => ({ ...current, lines: [...current.lines, newDispatchLine()] }));

  const removeLine = (key: string) =>
    setValues((current) => ({ ...current, lines: current.lines.filter((line) => line.key !== key) }));

  const totals = calculateTotals(values.lines.map((line) => lineAmount(line, items)));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = validateDispatchForm(values, items);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createDispatch(buildDispatchInput(values));
      onSaved();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" form={FORM_ID} loading={saving}>
        Save dispatch
      </Button>
    </>
  );

  return (
    <Modal open title="New dispatch" onClose={onClose} footer={footer} size="xl">
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error && <Alert tone="error">{error}</Alert>}

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-slate-900">Dispatch details</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Dispatch date" htmlFor="dispatch-date" required>
              <TextInput id="dispatch-date" type="date" value={values.dispatch_date} onChange={(event) => setField('dispatch_date', event.target.value)} />
            </Field>
            <Field label="Customer" htmlFor="dispatch-customer" required className="lg:col-span-2">
              <TextInput id="dispatch-customer" value={values.customer_name} onChange={(event) => setField('customer_name', event.target.value)} placeholder="Customer name" maxLength={200} />
            </Field>
            <Field label="PO number" htmlFor="dispatch-po">
              <TextInput id="dispatch-po" value={values.po_number} onChange={(event) => setField('po_number', event.target.value)} maxLength={100} />
            </Field>
            <Field label="Vehicle no" htmlFor="dispatch-vehicle">
              <TextInput id="dispatch-vehicle" value={values.vehicle_no} onChange={(event) => setField('vehicle_no', event.target.value)} placeholder="ABC-123" maxLength={50} />
            </Field>
            <Field label="LR / Bilty no" htmlFor="dispatch-lr">
              <TextInput id="dispatch-lr" value={values.lr_no} onChange={(event) => setField('lr_no', event.target.value)} maxLength={100} />
            </Field>
            <Field label="Payment status" htmlFor="dispatch-payment" required>
              <SelectInput id="dispatch-payment" value={values.payment_status} onChange={(event) => setField('payment_status', event.target.value as PaymentStatus)}>
                {PAYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </SelectInput>
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Products</h3>
            <Button type="button" variant="secondary" onClick={addLine} disabled={values.lines.length >= DISPATCH_MAX_LINES} icon={<Plus className="h-4 w-4" />}>
              Add product
            </Button>
          </div>

          {items.length === 0 && (
            <Alert tone="error">No finished goods items are in the inventory yet. Add them in Inventory before creating a dispatch.</Alert>
          )}

          {values.lines.map((line, index) => {
            const item = items.find((candidate) => candidate.id === line.item_id);
            const unit = item?.unit ?? 'Kg / Pcs';
            return (
              <div key={line.key} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-6">
                <Field label={`Product ${index + 1}`} htmlFor={`line-item-${line.key}`} required className="sm:col-span-2 lg:col-span-2">
                  <SelectInput id={`line-item-${line.key}`} value={line.item_id} onChange={(event) => updateLine(line.key, { item_id: event.target.value })}>
                    <option value="">Select finished product</option>
                    {items.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.item_code} - {candidate.item_name} ({candidate.current_stock} {candidate.unit} in stock)
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Size" htmlFor={`line-size-${line.key}`}>
                  <TextInput id={`line-size-${line.key}`} value={line.size} onChange={(event) => updateLine(line.key, { size: event.target.value })} placeholder="e.g. 12x18" maxLength={100} />
                </Field>
                <Field label="Qty (Kg)" htmlFor={`line-kg-${line.key}`}>
                  <TextInput id={`line-kg-${line.key}`} type="number" min="0" step="0.001" inputMode="decimal" value={line.qty_kg} onChange={(event) => updateLine(line.key, { qty_kg: event.target.value })} />
                </Field>
                <Field label="Qty (Pcs)" htmlFor={`line-pcs-${line.key}`}>
                  <TextInput id={`line-pcs-${line.key}`} type="number" min="0" step="0.001" inputMode="decimal" value={line.qty_pcs} onChange={(event) => updateLine(line.key, { qty_pcs: event.target.value })} />
                </Field>
                <Field label={`Rate per ${unit}`} htmlFor={`line-rate-${line.key}`}>
                  <TextInput id={`line-rate-${line.key}`} type="number" min="0" step="0.01" inputMode="decimal" value={line.rate} onChange={(event) => updateLine(line.key, { rate: event.target.value })} />
                </Field>
                <div className="flex flex-wrap items-end justify-between gap-3 sm:col-span-2 lg:col-span-6">
                  <p className="text-sm text-slate-600">
                    Amount: <span className="font-semibold text-slate-900">{formatMoney(lineAmount(line, items))}</span>
                  </p>
                  {values.lines.length > 1 && (
                    <Button type="button" variant="ghost" onClick={() => removeLine(line.key)} icon={<Trash2 className="h-4 w-4" />}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <section className="ml-auto flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:max-w-sm">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span className="font-medium text-slate-900">{formatMoney(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>GST ({DISPATCH_GST_RATE}%)</span>
            <span className="font-medium text-slate-900">{formatMoney(totals.gst)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900">
            <span>Grand total</span>
            <span>{formatMoney(totals.total)}</span>
          </div>
        </section>
      </form>
    </Modal>
  );
}
