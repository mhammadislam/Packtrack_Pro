import { useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Field, TextAreaInput, TextInput } from '@/components/ui/Field';
import { ItemSelectField } from '@/components/inventory/ItemSelectField';
import { insertStockTransaction, type StockSummary } from '@/lib/inventory';
import {
  adjustmentFormEmpty,
  buildAdjustmentPayload,
  validateAdjustmentForm,
  type AdjustmentFormValues,
} from '@/lib/inventoryForms';

const FORM_ID = 'stock-adjustment-form';

interface AdjustmentFormModalProps {
  items: StockSummary[];
  onClose: () => void;
  onSaved: () => void;
}

const DIRECTIONS = [
  { value: 'increase', label: 'Increase stock', icon: ArrowUpFromLine },
  { value: 'decrease', label: 'Decrease stock', icon: ArrowDownToLine },
] as const;

export function AdjustmentFormModal({ items, onClose, onSaved }: AdjustmentFormModalProps) {
  const [values, setValues] = useState<AdjustmentFormValues>(adjustmentFormEmpty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = items.find((item) => item.id === values.item_id) ?? null;

  const setField = <K extends keyof AdjustmentFormValues>(key: K, value: AdjustmentFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = validateAdjustmentForm(values);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await insertStockTransaction(buildAdjustmentPayload(values));
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
        Save adjustment
      </Button>
    </>
  );

  return (
    <Modal open title="Stock adjustment" onClose={onClose} footer={footer} size="lg">
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="adjust-date" required>
            <TextInput id="adjust-date" type="date" value={values.txn_date} onChange={(event) => setField('txn_date', event.target.value)} />
          </Field>
          <ItemSelectField items={items} value={values.item_id} onChange={(itemId) => setField('item_id', itemId)} selected={selected} />
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Direction</span>
            <div className="grid grid-cols-2 gap-2">
              {DIRECTIONS.map(({ value, label, icon: Icon }) => {
                const active = values.direction === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setField('direction', value)}
                    aria-pressed={active}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label={`Quantity${selected ? ` (${selected.unit})` : ''}`} htmlFor="adjust-qty" required>
            <TextInput id="adjust-qty" type="number" min="0" step="0.001" inputMode="decimal" value={values.quantity} onChange={(event) => setField('quantity', event.target.value)} />
          </Field>
          <Field label="Reason" htmlFor="adjust-reason" required className="sm:col-span-2">
            <TextAreaInput id="adjust-reason" value={values.reason} onChange={(event) => setField('reason', event.target.value)} placeholder="e.g. Physical count difference, damaged roll" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
