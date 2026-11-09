import { useEffect, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { QcFilters } from '@/components/qc/QcFilters';
import { QcReportTable } from '@/components/qc/QcReportTable';
import { QcStats } from '@/components/qc/QcStats';
import { QcReportDetail } from '@/components/qc/QcReportDetail';
import { QcReportForm } from '@/components/qc/QcReportForm';
import { exportQcToExcel } from '@/lib/qcExports';
import {
  defaultQcFilter,
  fetchQcCustomers,
  fetchQcReports,
  type QcFilter,
  type QcReport,
} from '@/lib/qc';

export function QcPage() {
  const { isAdmin, session } = useAuth();
  const userId = session?.user.id ?? null;
  const [filters, setFilters] = useState<QcFilter>(defaultQcFilter);
  const [reports, setReports] = useState<QcReport[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [form, setForm] = useState<{ report: QcReport | null } | null>(null);
  const [selected, setSelected] = useState<QcReport | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      fetchQcReports(filters)
        .then((rows) => {
          if (active) setReports(rows);
        })
        .catch((caught) => {
          if (active) setError(errorMessage(caught));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [filters, version]);

  useEffect(() => {
    let active = true;
    fetchQcCustomers()
      .then((names) => {
        if (active) setCustomers(names);
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught));
      });
    return () => {
      active = false;
    };
  }, [version]);

  const canEdit = (report: QcReport) => isAdmin || report.created_by === userId;

  const handleExport = () => {
    try {
      exportQcToExcel(reports);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const handleSaved = () => {
    setForm(null);
    setVersion((value) => value + 1);
  };

  const handleDeleted = () => {
    setSelected(null);
    setVersion((value) => value + 1);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quality control</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">QC reports</h2>
          <p className="text-sm text-slate-600">Grade every batch, track defects, and issue certificates.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleExport} disabled={reports.length === 0} icon={<Download className="h-4 w-4" />}>
            Export Excel
          </Button>
          <Button onClick={() => setForm({ report: null })} icon={<Plus className="h-4 w-4" />}>
            New QC report
          </Button>
        </div>
      </div>

      {error && <Alert tone="error">QC data could not be loaded. {error}</Alert>}

      <QcStats reports={reports} />

      <QcFilters
        filters={filters}
        customers={customers}
        onChange={setFilters}
        onReset={() => setFilters(defaultQcFilter())}
      />

      <section className="glass-panel overflow-hidden">
        {loading ? (
          <div className="flex flex-col gap-3 p-6" aria-label="Loading">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : (
          <QcReportTable reports={reports} onOpen={setSelected} />
        )}
      </section>

      {selected && (
        <QcReportDetail
          report={selected}
          canEdit={canEdit(selected)}
          canDelete={isAdmin}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setForm({ report: selected });
            setSelected(null);
          }}
          onDeleted={handleDeleted}
        />
      )}

      {form && <QcReportForm report={form.report} onClose={() => setForm(null)} onSaved={handleSaved} />}
    </div>
  );
}
