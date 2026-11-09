import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ImagePlus, Save } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Field, SelectInput, TextAreaInput, TextInput } from '@/components/ui/Field';
import { SignaturePad } from '@/components/qc/SignaturePad';
import {
  QC_DEFECT_TYPES,
  QC_NUMERIC_PARAMETERS,
  QC_RESULT_PARAMETERS,
  QC_SHIFTS,
  QC_STATUSES,
  buildQcPayload,
  gradeForCounts,
  insertQcReport,
  qcAttachmentUrl,
  qcFormValuesEmpty,
  qcFormValuesFromReport,
  statusForGrade,
  updateQcReport,
  uploadQcDefectImage,
  validateQcForm,
  validateQcImage,
  type QcFormValues,
  type QcGrade,
  type QcNumericKey,
  type QcReport,
  type QcResultKey,
  type QcStatus,
} from '@/lib/qc';

const FORM_ID = 'qc-report-form';

function liveGrade(values: QcFormValues): QcGrade | null {
  const sample = Number(values.sample_qty);
  const defective = Number(values.defective_qty);
  if (!Number.isInteger(sample) || sample <= 0 || !Number.isInteger(defective) || defective < 0 || defective > sample) {
    return null;
  }
  return gradeForCounts(sample, defective);
}

interface QcReportFormProps {
  report: QcReport | null;
  onClose: () => void;
  onSaved: () => void;
}

export function QcReportForm({ report, onClose, onSaved }: QcReportFormProps) {
  const [values, setValues] = useState<QcFormValues>(() => (report ? qcFormValuesFromReport(report) : qcFormValuesEmpty()));
  const [statusTouched, setStatusTouched] = useState(report !== null);
  const [defectFile, setDefectFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!defectFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(defectFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [defectFile]);

  const existingImageUrl = report?.defect_image_path ? qcAttachmentUrl(report.defect_image_path) : null;
  const imageUrl = previewUrl ?? existingImageUrl;
  const grade = liveGrade(values);

  const setField = <K extends 'report_date' | 'shift' | 'machine_no' | 'operator_name' | 'job_card_no' | 'customer_name' | 'film_structure' | 'defect_type' | 'officer_name' | 'notes'>(
    key: K,
    value: QcFormValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const setCount = (key: 'sample_qty' | 'defective_qty', raw: string) => {
    setValues((current) => {
      const next = { ...current, [key]: raw };
      const nextGrade = liveGrade(next);
      if (!statusTouched && nextGrade) next.status = statusForGrade(nextGrade);
      return next;
    });
  };

  const setStatus = (status: QcStatus) => {
    setStatusTouched(true);
    setValues((current) => ({ ...current, status }));
  };

  const setNumeric = (key: QcNumericKey, raw: string) =>
    setValues((current) => ({ ...current, numeric: { ...current.numeric, [key]: raw } }));

  const setResult = (key: QcResultKey, raw: '' | 'Pass' | 'Fail') =>
    setValues((current) => ({ ...current, results: { ...current.results, [key]: raw } }));

  const handleFile = (file: File | null) => {
    if (!file) {
      setDefectFile(null);
      return;
    }
    const problem = validateQcImage(file);
    if (problem) {
      setError(problem);
      setDefectFile(null);
      return;
    }
    setError(null);
    setDefectFile(file);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = validateQcForm(values);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const imagePath = defectFile ? await uploadQcDefectImage(defectFile) : (report?.defect_image_path ?? null);
      const payload = buildQcPayload(values, imagePath);
      if (report) {
        await updateQcReport(report.id, payload);
      } else {
        await insertQcReport(payload);
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
      <Button type="submit" form={FORM_ID} loading={saving} icon={<Save className="h-4 w-4" />}>
        {report ? 'Save changes' : 'Save QC report'}
      </Button>
    </>
  );

  return (
    <Modal open title={report ? `Edit ${report.report_no}` : 'New QC report'} onClose={onClose} size="xl" footer={footer}>
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error && <Alert tone="error">{error}</Alert>}

        <QcSection title="Job details" description="Who ran the job, on which machine, and for which customer.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Date" htmlFor="qc-date" required>
              <TextInput id="qc-date" type="date" value={values.report_date} onChange={(e) => setField('report_date', e.target.value)} />
            </Field>
            <Field label="Shift" htmlFor="qc-shift" required>
              <SelectInput id="qc-shift" value={values.shift} onChange={(e) => setField('shift', e.target.value as QcFormValues['shift'])}>
                <option value="">Select shift</option>
                {QC_SHIFTS.map((shift) => (
                  <option key={shift} value={shift}>
                    Shift {shift}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Machine No" htmlFor="qc-machine" required>
              <TextInput id="qc-machine" value={values.machine_no} onChange={(e) => setField('machine_no', e.target.value)} placeholder="e.g. PR-03" />
            </Field>
            <Field label="Operator Name" htmlFor="qc-operator" required>
              <TextInput id="qc-operator" value={values.operator_name} onChange={(e) => setField('operator_name', e.target.value)} />
            </Field>
            <Field label="Job Card No" htmlFor="qc-job" required>
              <TextInput id="qc-job" value={values.job_card_no} onChange={(e) => setField('job_card_no', e.target.value)} />
            </Field>
            <Field label="Customer Name" htmlFor="qc-customer" required>
              <TextInput id="qc-customer" value={values.customer_name} onChange={(e) => setField('customer_name', e.target.value)} />
            </Field>
            <Field label="Film Structure" htmlFor="qc-film" required className="sm:col-span-2 lg:col-span-3" hint="For example PET/MET PET/PE">
              <TextInput id="qc-film" value={values.film_structure} onChange={(e) => setField('film_structure', e.target.value)} />
            </Field>
          </div>
        </QcSection>

        <QcSection title="QC parameters" description="Enter measured values. Leave a test blank if it was not run.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {QC_NUMERIC_PARAMETERS.map(({ key, label, unit }) => (
              <Field key={key} label={`${label} (${unit})`} htmlFor={`qc-${key}`}>
                <TextInput
                  id={`qc-${key}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={values.numeric[key]}
                  onChange={(e) => setNumeric(key, e.target.value)}
                />
              </Field>
            ))}
            {QC_RESULT_PARAMETERS.map(({ key, label }) => (
              <Field key={key} label={label} htmlFor={`qc-${key}`}>
                <SelectInput id={`qc-${key}`} value={values.results[key]} onChange={(e) => setResult(key, e.target.value as '' | 'Pass' | 'Fail')}>
                  <option value="">Not tested</option>
                  <option value="Pass">Pass</option>
                  <option value="Fail">Fail</option>
                </SelectInput>
              </Field>
            ))}
          </div>
        </QcSection>

        <QcSection title="Sampling and defects" description="Grade and defect percentage are calculated automatically.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Sample Qty Checked" htmlFor="qc-sample" required>
              <TextInput id="qc-sample" type="number" min="1" step="1" inputMode="numeric" value={values.sample_qty} onChange={(e) => setCount('sample_qty', e.target.value)} />
            </Field>
            <Field label="Defective Qty" htmlFor="qc-defective" required>
              <TextInput id="qc-defective" type="number" min="0" step="1" inputMode="numeric" value={values.defective_qty} onChange={(e) => setCount('defective_qty', e.target.value)} />
            </Field>
            <Field label="Defect Type" htmlFor="qc-defect-type">
              <SelectInput id="qc-defect-type" value={values.defect_type} onChange={(e) => setField('defect_type', e.target.value as QcFormValues['defect_type'])}>
                <option value="">None</option>
                {QC_DEFECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Status" htmlFor="qc-status">
              <SelectInput id="qc-status" value={values.status} onChange={(e) => setStatus(e.target.value as QcStatus)}>
                {QC_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <CalcTile label="Defect %" value={grade ? `${((Number(values.defective_qty) / Number(values.sample_qty)) * 100).toFixed(2)}%` : '-'} />
            <CalcTile label="Grade" value={grade === 'Rejected' ? 'Rejected' : grade ?? '-'} />
            <CalcTile label="Rule" value="A under 2%, B 2-5%, Rejected over 5%" small />
          </div>
        </QcSection>

        <QcSection title="Evidence and sign-off">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Field label="Defect photo" htmlFor="qc-image" hint="JPG, PNG or WebP, up to 5 MB">
                <label
                  htmlFor="qc-image"
                  className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-sm text-slate-600 transition hover:border-slate-500 hover:bg-slate-100"
                >
                  {imageUrl ? (
                    <img src={imageUrl} alt="Defect preview" className="max-h-44 w-full rounded-lg object-contain" />
                  ) : (
                    <>
                      <ImagePlus className="h-6 w-6" aria-hidden="true" />
                      <span>Click to choose a defect photo</span>
                    </>
                  )}
                </label>
                <input
                  id="qc-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </Field>
            </div>
            <div className="flex flex-col gap-4">
              <Field label="QC officer name" htmlFor="qc-officer">
                <TextInput id="qc-officer" value={values.officer_name} onChange={(e) => setField('officer_name', e.target.value)} />
              </Field>
              <Field label="QC officer signature">
                <SignaturePad value={values.signature_data} onChange={(dataUrl) => setValues((current) => ({ ...current, signature_data: dataUrl }))} />
              </Field>
            </div>
            <Field label="Remarks" htmlFor="qc-notes" className="lg:col-span-2">
              <TextAreaInput id="qc-notes" value={values.notes} onChange={(e) => setField('notes', e.target.value)} />
            </Field>
          </div>
        </QcSection>
      </form>
    </Modal>
  );
}

function QcSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function CalcTile({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1 font-semibold text-slate-900 ${small ? 'text-xs' : 'text-lg'}`}>{value}</p>
    </div>
  );
}
