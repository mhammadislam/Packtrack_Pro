import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import {
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
  RAW_MATERIAL_TYPES,
  insertInventoryItem,
  updateInventoryItem,
  type StockSummary,
} from '@/lib/inventory';
import {
  buildNewItemPayload,
  itemFormEmpty,
  itemFormFromSummary,
  validateItemForm,
  type ItemFormValues,
} from '@/lib/inventoryForms';

const FORM_ID = 'inventory-item-form';

interface ItemFormModalProps {
  item: StockSummary | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ItemFormModal({ item, onClose, onSaved }: ItemFormModalProps) {
  const editing = item !== null;
  const [values, setValues] = useState<ItemFormValues>(() => (item ? itemFormFromSummary(item) : itemFormEmpty()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = <K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const setCategory = (category: ItemFormValues['category']) =>
    setValues((current) => ({
      ...current,
      category,
      material_type: category === 'Raw Material' ? current.material_type : '',
    }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = validateItemForm(values, editing);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (item) {
        await updateInventoryItem(item.id, {
          item_name: values.item_name.trim(),
          supplier: values.supplier.trim(),
          minimum_stock: Number(values.minimum_stock),
          reorder_level: Number(values.reorder_level),
        });
      } else {
        await insertInventoryItem(buildNewItemPayload(values));
      }
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
        {editing ? 'Save changes' : 'Create item'}
      </Button>
    </>
  );

  return (
    <Modal open title={editing ? `Edit ${item.item_code}` : 'New inventory item'} onClose={onClose} footer={footer} size="lg">
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Item name" htmlFor="item-name" required className="sm:col-span-2">
            <TextInput id="item-name" value={values.item_name} onChange={(event) => setField('item_name', event.target.value)} placeholder="e.g. BOPP Film 20 micron" />
          </Field>
          <Field label="Category" htmlFor="item-category" required hint={editing ? 'Fixed after creation.' : undefined}>
            <SelectInput id="item-category" value={values.category} disabled={editing} onChange={(event) => setCategory(event.target.value as ItemFormValues['category'])}>
              <option value="">Select category</option>
              {INVENTORY_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </SelectInput>
          </Field>
          {values.category === 'Raw Material' && (
            <Field label="Material type" htmlFor="item-material" required hint={editing ? 'Fixed after creation.' : undefined}>
              <SelectInput id="item-material" value={values.material_type} disabled={editing} onChange={(event) => setField('material_type', event.target.value as ItemFormValues['material_type'])}>
                <option value="">Select material</option>
                {RAW_MATERIAL_TYPES.map((material) => (
                  <option key={material} value={material}>{material}</option>
                ))}
              </SelectInput>
            </Field>
          )}
          <Field label="Supplier" htmlFor="item-supplier">
            <TextInput id="item-supplier" value={values.supplier} onChange={(event) => setField('supplier', event.target.value)} placeholder="Supplier name" />
          </Field>
          <Field label="Unit" htmlFor="item-unit" required hint={editing ? 'Fixed after creation.' : undefined}>
            <SelectInput id="item-unit" value={values.unit} disabled={editing} onChange={(event) => setField('unit', event.target.value as ItemFormValues['unit'])}>
              <option value="">Select unit</option>
              {INVENTORY_UNITS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Opening stock" htmlFor="item-opening" hint={editing ? 'Fixed after creation. Later movements are in the ledger.' : undefined}>
            <TextInput id="item-opening" type="number" min="0" step="0.001" inputMode="decimal" value={values.opening_stock} disabled={editing} onChange={(event) => setField('opening_stock', event.target.value)} />
          </Field>
          <Field label="Opening rate per unit" htmlFor="item-opening-rate" hint={editing ? undefined : 'Used for the average rate and stock value.'}>
            <TextInput id="item-opening-rate" type="number" min="0" step="0.01" inputMode="decimal" value={values.opening_rate} disabled={editing} onChange={(event) => setField('opening_rate', event.target.value)} />
          </Field>
          <Field label="Minimum stock level" htmlFor="item-minimum" hint="Red alert when stock falls below this.">
            <TextInput id="item-minimum" type="number" min="0" step="0.001" inputMode="decimal" value={values.minimum_stock} onChange={(event) => setField('minimum_stock', event.target.value)} />
          </Field>
          <Field label="Reorder level" htmlFor="item-reorder" hint="Amber warning when stock reaches this.">
            <TextInput id="item-reorder" type="number" min="0" step="0.001" inputMode="decimal" value={values.reorder_level} onChange={(event) => setField('reorder_level', event.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
