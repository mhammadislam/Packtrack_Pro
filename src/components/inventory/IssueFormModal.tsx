import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { ItemSelectField } from '@/components/inventory/ItemSelectField';
import { INVENTORY_DEPARTMENTS, insertStockTransaction, type StockSummary } from '@/lib/inventory';
import { buildIssuePayload, issueFormEmpty, validateIssueForm, type IssueFormValues } from '@/lib/inventoryForms';

const FORM_ID = 'stock-issue-form';

interface IssueFormModalProps {
  items: StockSummary[];
  onClose: () => void;
  onSaved: () => void;
}

export function IssueFormModal({ items, onClose, onSaved }: IssueFormModalProps) {
  const [values, setValues] = useState<IssueFormValues>(issueFormEmpty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = items.find((item) => item.id === values.item_id) ?? null;

  const setField = <K extends keyof IssueFormValues>(key: K, value: IssueFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = validateIssueForm(values);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await insertStockTransaction(buildIssuePayload(values));
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
        Issue stock
      </Button>
    </>
  );

  return (
    <Modal open title="Issue stock to production" onClose={onClose} footer={footer} size="lg">
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="issue-date" required>
            <TextInput id="issue-date" type="date" value={values.txn_date} onChange={(event) => setField('txn_date', event.target.value)} />
          </Field>
          <ItemSelectField items={items} value={values.item_id} onChange={(itemId) => setField('item_id', itemId)} selected={selected} />
          <Field label="Department issued to" htmlFor="issue-department" required>
            <SelectInput id="issue-department" value={values.department} onChange={(event) => setField('department', event.target.value as IssueFormValues['department'])}>
              <option value="">Select department</option>
              {INVENTORY_DEPARTMENTS.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Job card number" htmlFor="issue-job-card" required>
            <TextInput id="issue-job-card" value={values.job_card_no} onChange={(event) => setField('job_card_no', event.target.value)} placeholder="JC-0001" />
          </Field>
          <Field label={`Quantity issued${selected ? ` (${selected.unit})` : ''}`} htmlFor="issue-qty" required className="sm:col-span-2">
            <TextInput id="issue-qty" type="number" min="0" step="0.001" inputMode="decimal" value={values.quantity} onChange={(event) => setField('quantity', event.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
