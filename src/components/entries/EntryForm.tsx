import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { BAG_TYPES, DOWNTIME_REASONS, EXTRUSION_MATERIALS, PRINTING_SHIFTS, PUNCH_ZIPPER_OPTIONS, SHIFTS, type DepartmentConfig } from '@/lib/constants';
import { buildEntryPayload, insertEntry, updateEntry } from '@/lib/entries';
import { emptyValues, valuesFromEntry, validate, type FormErrors } from '@/lib/entryValues';
import { createOperator, fetchOperators } from '@/lib/masters';
import type { EntryFormValues, Machine, Operator, ProductionEntry } from '@/lib/types';
import { Field, SelectInput, TextAreaInput, TextInput } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { FormSection } from '@/components/entries/FormSection';
import { PrintingFields } from '@/components/entries/PrintingFields';

interface EntryFormProps {
  department: DepartmentConfig;
  machines: Machine[];
  entry?: ProductionEntry;
  onSaved?: () => void;
  onCancel?: () => void;
}

export function EntryForm({ department, machines, entry, onSaved, onCancel }: EntryFormProps) {
  const [values, setValues] = useState<EntryFormValues>(() => (entry ? valuesFromEntry(entry) : emptyValues()));
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isEditing = Boolean(entry);
  const isExtrusion = department.hasExtrusionFields;
  const isPrinting = department.hasPrintingFields;

  useEffect(() => {
    setValues(entry ? valuesFromEntry(entry) : emptyValues());
    setErrors({});
    setServerError(null);
    setSuccess(null);
  }, [entry, department.code]);

  const update = <K extends keyof EntryFormValues>(field: K, value: EntryFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setSuccess(null);

    const validationErrors = validate(values, department);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      const payload = buildEntryPayload(values, department);
      if (entry) await updateEntry(entry.id, payload);
      else await insertEntry(payload);
      if (!entry) {
        setValues(emptyValues());
        setSuccess('Entry saved. The form is ready for the next one.');
      }
      onSaved?.();
    } catch (caught) {
      setServerError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const machineOptions = machines.map((machine) => machine.name);
  const machineList = values.machine_name && !machineOptions.includes(values.machine_name)
    ? [...machineOptions, values.machine_name]
    : machineOptions;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <FormSection title="Shift and job">
        <Field label="Date" htmlFor="entry_date" required error={errors.entry_date}>
          <TextInput id="entry_date" type="date" value={values.entry_date} onChange={(e) => update('entry_date', e.target.value)} />
        </Field>
        {!isExtrusion && (
          <Field label="Shift" htmlFor="shift" required>
            <SelectInput id="shift" value={values.shift} onChange={(e) => update('shift', e.target.value as EntryFormValues['shift'])}>
              {(isPrinting ? PRINTING_SHIFTS : SHIFTS).map((shift) => (
                <option key={shift} value={shift}>{shift}</option>
              ))}
            </SelectInput>
          </Field>
        )}
        <OperatorPicker value={values.operator_name} error={errors.operator_name} onChange={(name) => update('operator_name', name)} />
        <Field label="Machine No" htmlFor="machine_name" required error={errors.machine_name}>
          <SelectInput id="machine_name" value={values.machine_name} onChange={(e) => update('machine_name', e.target.value)}>
            <option value="">Select machine</option>
            {machineList.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </SelectInput>
        </Field>
        {!isExtrusion && (
          <Field
            label={isPrinting ? 'Order Number' : 'Job Card No / Customer Name'}
            htmlFor="job_ref"
            required
            error={errors.job_ref}
            className="sm:col-span-2"
          >
            <TextInput
              id="job_ref"
              value={values.job_ref}
              onChange={(e) => update('job_ref', e.target.value)}
              placeholder={isPrinting ? 'e.g. ORD-1024' : 'e.g. JC-2041 / Al Noor Foods'}
            />
          </Field>
        )}
      </FormSection>

      <FormSection title="Material and specification">
        <Field label="Material / Film Type" htmlFor="material" error={errors.material}>
          {isExtrusion ? (
            <SelectInput id="material" value={values.material} onChange={(e) => update('material', e.target.value)}>
              <option value="">Select material</option>
              {EXTRUSION_MATERIALS.map((material) => (
                <option key={material} value={material}>{material}</option>
              ))}
            </SelectInput>
          ) : (
            <TextInput id="material" value={values.material} onChange={(e) => update('material', e.target.value)} placeholder="e.g. BOPP" />
          )}
        </Field>
        <Field label="Size / Specification" htmlFor="size_spec">
          <TextInput id="size_spec" value={values.size_spec} onChange={(e) => update('size_spec', e.target.value)} placeholder="e.g. 450 mm x 1000 m" />
        </Field>
      </FormSection>

      {department.hasPrintingFields && <PrintingFields values={values} errors={errors} onChange={update} />}

      {isExtrusion && (
        <FormSection title="Extrusion details">
          <Field label="Lot Number" htmlFor="lot_number" required error={errors.lot_number}>
            <TextInput id="lot_number" value={values.lot_number} onChange={(e) => update('lot_number', e.target.value)} placeholder="e.g. LOT-1021" />
          </Field>
          <Field label="Micron" htmlFor="micron" error={errors.micron}>
            <TextInput id="micron" type="number" inputMode="decimal" min="0" step="any" value={values.micron} onChange={(e) => update('micron', e.target.value)} placeholder="e.g. 20" />
          </Field>
          <Field label="Order Qty" htmlFor="order_qty" error={errors.order_qty}>
            <TextInput id="order_qty" type="number" inputMode="decimal" min="0" step="any" value={values.order_qty} onChange={(e) => update('order_qty', e.target.value)} />
          </Field>
          <Field label="Weight (KG)" htmlFor="weight_kg" error={errors.weight_kg}>
            <TextInput id="weight_kg" type="number" inputMode="decimal" min="0" step="any" value={values.weight_kg} onChange={(e) => update('weight_kg', e.target.value)} />
          </Field>
          <Field label="Trim (KG)" htmlFor="trim_kg" error={errors.trim_kg}>
            <TextInput id="trim_kg" type="number" inputMode="decimal" min="0" step="any" value={values.trim_kg} onChange={(e) => update('trim_kg', e.target.value)} />
          </Field>
          <Field label="Wastage (KG)" htmlFor="wastage_kg" error={errors.wastage_kg}>
            <TextInput id="wastage_kg" type="number" inputMode="decimal" min="0" step="any" value={values.wastage_kg} onChange={(e) => update('wastage_kg', e.target.value)} />
          </Field>
        </FormSection>
      )}

      {department.hasBagFields && (
        <FormSection title="Bag details">
          <Field label="Bag Length (mm)" htmlFor="bag_length" required error={errors.bag_length}>
            <TextInput id="bag_length" type="number" inputMode="decimal" min="0" step="any" value={values.bag_length} onChange={(e) => update('bag_length', e.target.value)} />
          </Field>
          <Field label="Bag Width (mm)" htmlFor="bag_width" required error={errors.bag_width}>
            <TextInput id="bag_width" type="number" inputMode="decimal" min="0" step="any" value={values.bag_width} onChange={(e) => update('bag_width', e.target.value)} />
          </Field>
          <Field label="Bag Type" htmlFor="bag_type" required error={errors.bag_type}>
            <SelectInput id="bag_type" value={values.bag_type} onChange={(e) => update('bag_type', e.target.value as EntryFormValues['bag_type'])}>
              <option value="">Select bag type</option>
              {BAG_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Total Pcs" htmlFor="total_pcs" required error={errors.total_pcs}>
            <TextInput id="total_pcs" type="number" inputMode="numeric" min="0" step="1" value={values.total_pcs} onChange={(e) => update('total_pcs', e.target.value)} />
          </Field>
          <Field label="Punch / Zipper" htmlFor="punch_zipper">
            <SelectInput id="punch_zipper" value={values.punch_zipper} onChange={(e) => update('punch_zipper', e.target.value as EntryFormValues['punch_zipper'])}>
              {PUNCH_ZIPPER_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </SelectInput>
          </Field>
        </FormSection>
      )}

      {!isExtrusion && (
        <FormSection title="Production and wastage">
          <Field label="Production (KG)" htmlFor="qty_kg" error={errors.qty_kg} hint="Enter KG or meters (at least one).">
            <TextInput id="qty_kg" type="number" inputMode="decimal" min="0" step="any" value={values.qty_kg} onChange={(e) => update('qty_kg', e.target.value)} />
          </Field>
          <Field label="Production (Meters)" htmlFor="qty_meters" error={errors.qty_meters}>
            <TextInput id="qty_meters" type="number" inputMode="decimal" min="0" step="any" value={values.qty_meters} onChange={(e) => update('qty_meters', e.target.value)} />
          </Field>
          <Field label="Wastage (KG)" htmlFor="wastage_kg" error={errors.wastage_kg}>
            <TextInput id="wastage_kg" type="number" inputMode="decimal" min="0" step="any" value={values.wastage_kg} onChange={(e) => update('wastage_kg', e.target.value)} />
          </Field>
        </FormSection>
      )}

      {!isExtrusion && (
        <FormSection title="Downtime and notes">
          <Field label="Downtime / Stoppage Reason" htmlFor="downtime_reason">
            <SelectInput id="downtime_reason" value={values.downtime_reason} onChange={(e) => update('downtime_reason', e.target.value as EntryFormValues['downtime_reason'])}>
              {DOWNTIME_REASONS.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Remarks" htmlFor="remarks" className="sm:col-span-2">
            <TextAreaInput id="remarks" value={values.remarks} onChange={(e) => update('remarks', e.target.value)} placeholder="Anything the next shift should know" />
          </Field>
        </FormSection>
      )}

      {serverError && <Alert tone="error">{serverError}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          {isEditing ? 'Save changes' : 'Save entry'}
        </Button>
      </div>
    </form>
  );
}

function OperatorPicker({ value, error, onChange }: { value: string; error?: string; onChange: (name: string) => void }) {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchOperators()
      .then((list) => {
        if (active) setOperators(list);
      })
      .catch((caught: unknown) => {
        if (active) setLoadError(errorMessage(caught));
      });
    return () => {
      active = false;
    };
  }, []);

  const names = operators.map((operator) => operator.name);
  const options = value && !names.includes(value) ? [...names, value] : names;

  const saveNewOperator = async () => {
    setAddError(null);
    if (!newName.trim()) {
      setAddError('Enter the operator name.');
      return;
    }
    setSaving(true);
    try {
      const created = await createOperator(newName);
      setOperators((current) =>
        current.some((operator) => operator.id === created.id)
          ? current
          : [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      onChange(created.name);
      setNewName('');
      setAdding(false);
    } catch (caught) {
      setAddError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Field label="Operator Name" htmlFor="operator_name" required error={error ?? loadError ?? undefined} className="sm:col-span-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <SelectInput id="operator_name" value={value} onChange={(e) => onChange(e.target.value)} className="sm:flex-1">
          <option value="">Select operator</option>
          {options.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </SelectInput>
        <Button type="button" variant="secondary" onClick={() => setAdding((open) => !open)} icon={<Plus className="h-4 w-4" />} className="shrink-0">
          Add new operator
        </Button>
      </div>
      {adding && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 sm:flex-row">
          <TextInput
            aria-label="New operator name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Full name of the operator"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void saveNewOperator();
              }
            }}
          />
          <Button type="button" onClick={() => void saveNewOperator()} loading={saving} className="shrink-0">
            Save operator
          </Button>
          {addError && <p className="text-xs font-medium text-red-600 sm:w-full">{addError}</p>}
        </div>
      )}
    </Field>
  );
}
