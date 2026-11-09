import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Field, TextInput } from '@/components/ui/Field';
import { ItemSelectField } from '@/components/inventory/ItemSelectField';
import { formatNumber } from '@/lib/dates';
import { insertStockTransaction, type StockSummary } from '@/lib/inventory';
import { buildPurchasePayload, purchaseFormEmpty, validatePurchaseForm, type PurchaseFormValues } from '@/lib/inventoryForms';

const FORM_ID = 'stock-purchase-form';

interface PurchaseFormModalProps {
  items: StockSummary[];
  onClose: () => void;
  onSaved: () => void;
}

export function PurchaseFormModal({ items, onClose, onSaved }: PurchaseFormModalProps) {
  const [values, setValues] = useState<PurchaseFormValues>(purchaseFormEmpty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = items.find((item) => item.id === values.item_id) ?? null;
  const total = Number(values.quantity) * Number(values.rate);

  const setField = <K extends keyof PurchaseFormValues>(key: K, value: PurchaseFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const chooseItem = (itemId: string) => {
    const item = items.find((candidate) => candidate.id === itemId);
    setValues((current) => ({
      ...current,
      item_id: itemId,
      supplier_name: current.supplier_name || item?.supplier || '',
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = validatePurchaseForm(values);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await insertStockTransaction(buildPurchasePayload(values));
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
        Add stock
      </Button>
    </>
  );

  return (
    <Modal open title="Add stock (purchase entry)" onClose={onClose} footer={footer} size="lg">
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="purchase-date" required>
            <TextInput id="purchase-date" type="date" value={values.txn_date} onChange={(event) => setField('txn_date', event.target.value)} />
          </Field>
          <ItemSelectField items={items} value={values.item_id} onChange={chooseItem} selected={selected} />
          <Field label="GRN number" htmlFor="purchase-grn" required>
            <TextInput id="purchase-grn" value={values.grn_no} onChange={(event) => setField('grn_no', event.target.value)} placeholder="GRN-0001" />
          </Field>
          <Field label="Supplier invoice no" htmlFor="purchase-invoice">
            <TextInput id="purchase-invoice" value={values.supplier_invoice_no} onChange={(event) => setField('supplier_invoice_no', event.target.value)} />
          </Field>
          <Field label="Supplier" htmlFor="purchase-supplier">
            <TextInput id="purchase-supplier" value={values.supplier_name} onChange={(event) => setField('supplier_name', event.target.value)} />
          </Field>
          <Field label={`Quantity${selected ? ` (${selected.unit})` : ''}`} htmlFor="purchase-qty" required>
            <TextInput id="purchase-qty" type="number" min="0" step="0.001" inputMode="decimal" value={values.quantity} onChange={(event) => setField('quantity', event.target.value)} />
          </Field>
          <Field label={`Rate per ${selected?.unit ?? 'unit'}`} htmlFor="purchase-rate">
            <TextInput id="purchase-rate" type="number" min="0" step="0.01" inputMode="decimal" value={values.rate} onChange={(event) => setField('rate', event.target.value)} />
          </Field>
          <div className="glass-inset flex flex-col justify-center px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Total amount</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
              {Number.isFinite(total) && total > 0 ? formatNumber(total) : '0'}
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}
