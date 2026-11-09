import { useEffect, useMemo, useState } from 'react';
import { fetchEntriesInRange } from '@/lib/entries';
import { fetchMachines, fetchOperators } from '@/lib/masters';
import { defaultReportForm, resolveReport, type ReportFormState } from '@/lib/reports';
import type { Machine, Operator, ProductionEntry } from '@/lib/types';
import { errorMessage, Alert } from '@/components/ui/Alert';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ReportResults } from '@/components/reports/ReportResults';
import type { EntryRangeFilter } from '@/lib/entries';

export function ReportsPage() {
  const [form, setForm] = useState<ReportFormState>(defaultReportForm);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [rows, setRows] = useState<ProductionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const { report, error: validationError } = useMemo(() => resolveReport(form), [form]);
  const queryKey = report ? JSON.stringify(report.query) : null;

  useEffect(() => {
    let active = true;
    Promise.all([fetchOperators(), fetchMachines()])
      .then(([operatorList, machineList]) => {
        if (!active) return;
        setOperators(operatorList);
        setMachines(machineList);
      })
      .catch((caught: unknown) => {
        if (active) setLookupError(errorMessage(caught));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!queryKey) {
      setRows([]);
      setError(null);
      return;
    }
    let active = true;
    const query = JSON.parse(queryKey) as EntryRangeFilter;
    setLoading(true);
    setError(null);
    fetchEntriesInRange(query)
      .then((result) => {
        if (active) setRows(result);
      })
      .catch((caught: unknown) => {
        if (active) {
          setRows([]);
          setError(errorMessage(caught));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [queryKey]);

  const updateForm = (patch: Partial<ReportFormState>) => setForm((current) => ({ ...current, ...patch }));

  return (
    <div className="flex flex-col gap-6">
      <ReportFilters form={form} operators={operators} machines={machines} onChange={updateForm} />

      {lookupError && <Alert tone="error">Operators or machines could not be loaded. {lookupError}</Alert>}
      {error && <Alert tone="error">The report could not be generated. {error}</Alert>}

      {!report && validationError && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">{validationError}</p>
      )}

      {report && loading && (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-5 w-1/3 animate-pulse rounded bg-slate-200" />
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      )}

      {report && !loading && !error && <ReportResults key={queryKey ?? ''} report={report} rows={rows} />}
    </div>
  );
}
