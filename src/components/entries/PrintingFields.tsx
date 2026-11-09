import { useId } from 'react';
import { INK_COLORS, INK_SERIES } from '@/lib/constants';
import { inkUsedText, type FormErrors } from '@/lib/entryValues';
import type { EntryFormValues } from '@/lib/types';
import { Field, TextInput } from '@/components/ui/Field';
import { FormSection } from '@/components/entries/FormSection';

interface PrintingFieldsProps {
  values: EntryFormValues;
  errors: FormErrors;
  onChange: <K extends keyof EntryFormValues>(field: K, value: EntryFormValues[K]) => void;
}

export function PrintingFields({ values, errors, onChange }: PrintingFieldsProps) {
  return (
    <>
      <FormSection title="Printing details">
        <Field label="Micron" htmlFor="micron" error={errors.micron}>
          <TextInput id="micron" type="number" inputMode="decimal" min="0" step="any" value={values.micron} onChange={(e) => onChange('micron', e.target.value)} placeholder="e.g. 20" />
        </Field>
        <Field label="Machine Speed" htmlFor="machine_speed" error={errors.machine_speed} hint="Enter the speed shown on the machine.">
          <TextInput id="machine_speed" type="number" inputMode="decimal" min="0" step="any" value={values.machine_speed} onChange={(e) => onChange('machine_speed', e.target.value)} />
        </Field>
        <Field label="Solvent (KG)" htmlFor="solvent_kg" error={errors.solvent_kg}>
          <TextInput id="solvent_kg" type="number" inputMode="decimal" min="0" step="any" value={values.solvent_kg} onChange={(e) => onChange('solvent_kg', e.target.value)} />
        </Field>
        <Field label="Ethyl (KG)" htmlFor="ethyl_kg" error={errors.ethyl_kg}>
          <TextInput id="ethyl_kg" type="number" inputMode="decimal" min="0" step="any" value={values.ethyl_kg} onChange={(e) => onChange('ethyl_kg', e.target.value)} />
        </Field>
        <Field label="Start Time" htmlFor="start_time">
          <TextInput id="start_time" type="time" value={values.start_time} onChange={(e) => onChange('start_time', e.target.value)} />
        </Field>
        <Field label="Job Approval Time" htmlFor="job_approval_time">
          <TextInput id="job_approval_time" type="time" value={values.job_approval_time} onChange={(e) => onChange('job_approval_time', e.target.value)} />
        </Field>
        <Field label="Run Time (Minutes)" htmlFor="run_minutes" error={errors.run_minutes} hint="How long this job ran.">
          <TextInput id="run_minutes" type="number" inputMode="numeric" min="0" step="1" value={values.run_minutes} onChange={(e) => onChange('run_minutes', e.target.value)} />
        </Field>
      </FormSection>

      <FormSection title="Ink colours">
        <p className="text-sm text-slate-500 sm:col-span-2">Record the ink received and returned for each colour. Used is calculated automatically.</p>
        <div className="grid grid-cols-1 gap-3 sm:col-span-2 md:grid-cols-2 xl:grid-cols-3">
          {INK_COLORS.map((color) => (
            <InkCard key={color.key} label={color.label} fieldKey={color.key} values={values} errors={errors} onChange={onChange} />
          ))}
        </div>
      </FormSection>
    </>
  );
}

interface InkCardProps extends Omit<PrintingFieldsProps, 'values'> {
  label: string;
  fieldKey: (typeof INK_COLORS)[number]['key'];
  values: EntryFormValues;
}

function InkCard({ label, fieldKey, values, errors, onChange }: InkCardProps) {
  const idPrefix = useId();
  const series = `ink_${fieldKey}_series` as const;
  const received = `ink_${fieldKey}_received` as const;
  const returned = `ink_${fieldKey}_returned` as const;
  const seriesId = `${idPrefix}-${series}`;
  const receivedId = `${idPrefix}-${received}`;
  const returnedId = `${idPrefix}-${returned}`;
  const usedId = `${idPrefix}-used`;
  const used = inkUsedText(values[received], values[returned]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold text-slate-900" title={label}>{label}</p>
        <div className="w-32 shrink-0">
          <label htmlFor={seriesId} className="sr-only">Series for {label}</label>
          <select
            id={seriesId}
            value={values[series]}
            onChange={(e) => onChange(series, e.target.value)}
            className={COMPACT_INPUT}
          >
            <option value="">Series</option>
            {INK_SERIES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {errors[series] && <p className={COMPACT_ERROR}>{errors[series]}</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={receivedId} className={COMPACT_LABEL}>Received</label>
          <input id={receivedId} type="number" inputMode="decimal" min="0" step="any" value={values[received]} onChange={(e) => onChange(received, e.target.value)} className={COMPACT_INPUT} />
          {errors[received] && <p className={COMPACT_ERROR}>{errors[received]}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={returnedId} className={COMPACT_LABEL}>Returned</label>
          <input id={returnedId} type="number" inputMode="decimal" min="0" step="any" value={values[returned]} onChange={(e) => onChange(returned, e.target.value)} className={COMPACT_INPUT} />
          {errors[returned] && <p className={COMPACT_ERROR}>{errors[returned]}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={usedId} className={COMPACT_LABEL}>Used</label>
          <output id={usedId} className="block h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold leading-6 tabular-nums text-slate-900">
            {used || '-'}
          </output>
        </div>
      </div>
    </div>
  );
}

const COMPACT_LABEL = 'text-[11px] font-medium uppercase tracking-wide text-slate-500';
const COMPACT_INPUT =
  'h-8 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20';
const COMPACT_ERROR = 'text-[11px] text-red-600';
