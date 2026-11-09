import { useEffect, useState, useCallback } from 'react';
import { Pencil, Search, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { INK_COLORS, type DepartmentConfig } from '@/lib/constants';
import { formatDate, formatNumber } from '@/lib/dates';
import { deleteEntry, fetchEntriesPage } from '@/lib/entries';
import type { InkUsage, Machine, ProductionEntry } from '@/lib/types';
import { EntryForm } from '@/components/entries/EntryForm';
import { EntryImportModal } from '@/components/entries/EntryImportModal';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { TextInput } from '@/components/ui/Field';

const PAGE_SIZE = 10;

interface EntryRecordsProps {
  department: DepartmentConfig;
  machines: Machine[];
}

const HEADER_CLASS = 'whitespace-nowrap px-4 py-3';

function InkUsageCell({ usage }: { usage: InkUsage }) {
  const items = INK_COLORS.flatMap(({ key, label }) => {
    const item = usage[key];
    return item ? [{ key, label, series: item.series, used: item.received_kg - item.returned_kg }] : [];
  });

  if (items.length === 0) return <span className="text-sm text-slate-500">-</span>;

  return (
    <div className="flex max-w-[320px] flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item.key}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
        >
          <span className="font-medium text-slate-900">{item.label}</span>
          <span className="text-slate-500">{item.series || '-'}</span>
          <span className="font-semibold tabular-nums text-slate-900">{formatNumber(item.used, 2)} kg</span>
        </span>
      ))}
    </div>
  );
}

export function EntryRecords({ department, machines }: EntryRecordsProps) {
  const { isAdmin, canDeleteEntries, session } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ProductionEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductionEntry | null>(null);
  const [deleting, setDeleting] = useState<ProductionEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isExtrusion = department.hasExtrusionFields;
  const isPrinting = department.hasPrintingFields;
  const columnCount = (isExtrusion ? 12 : 11) + (isPrinting ? 1 : 0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchEntriesPage({ department: department.code, search: debouncedSearch, page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [department.code, debouncedSearch, page, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const canModify = (entry: ProductionEntry) => isAdmin || entry.created_by === session?.user.id;

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteEntry(deleting.id);
      setDeleting(null);
      reload();
    } catch (caught) {
      setDeleteError(errorMessage(caught));
    } finally {
      setDeleteBusy(false);
    }
  };

  const machinesForDepartment = machines.filter((machine) => machine.department === department.code);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <TextInput
            aria-label="Search records"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search job card, lot, customer, material, operator or machine"
            className="pl-9"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">
            {total} {total === 1 ? 'record' : 'records'} in {department.shortName}
          </p>
          <Button type="button" variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setImportOpen(true)}>
            Import from Excel
          </Button>
        </div>
      </div>

      {error && <Alert tone="error">Records could not be loaded. {error}</Alert>}
      {importNotice && <Alert tone="success">{importNotice}</Alert>}

      <EntryImportModal
        department={department}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(count) => {
          setImportOpen(false);
          setImportNotice(`${count} ${count === 1 ? 'entry was' : 'entries were'} imported.`);
          reload();
        }}
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className={HEADER_CLASS}>Date</th>
                {!isExtrusion && <th className={HEADER_CLASS}>Shift</th>}
                <th className={HEADER_CLASS}>Operator</th>
                <th className={HEADER_CLASS}>Machine</th>
                {isExtrusion ? (
                  <>
                    <th className={HEADER_CLASS}>Lot Number</th>
                    <th className={HEADER_CLASS}>Material</th>
                    <th className={HEADER_CLASS}>Size</th>
                    <th className={`${HEADER_CLASS} text-right`}>Micron</th>
                    <th className={`${HEADER_CLASS} text-right`}>Order Qty</th>
                    <th className={`${HEADER_CLASS} text-right`}>Weight KG</th>
                    <th className={`${HEADER_CLASS} text-right`}>Trim KG</th>
                    <th className={`${HEADER_CLASS} text-right`}>Wastage KG</th>
                  </>
                ) : (
                  <>
                    <th className={HEADER_CLASS}>{isPrinting ? 'Order Number' : 'Job / Customer'}</th>
                    <th className={HEADER_CLASS}>Material / Spec</th>
                    <th className={`${HEADER_CLASS} text-right`}>Prod. KG</th>
                    <th className={`${HEADER_CLASS} text-right`}>Meters</th>
                    <th className={`${HEADER_CLASS} text-right`}>Wastage KG</th>
                    <th className={HEADER_CLASS}>Downtime</th>
                  </>
                )}
                {isPrinting && <th className={HEADER_CLASS}>Ink Used</th>}
                <th className={`${HEADER_CLASS} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading &&
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="animate-pulse">
                    <td colSpan={columnCount} className="px-4 py-4">
                      <div className="h-3 rounded bg-slate-200" />
                    </td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-14 text-center text-sm text-slate-500">
                    {debouncedSearch ? 'No records match your search.' : `No ${department.shortName} entries yet. Use the Data Entry tab to add one.`}
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-amber-50/50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(row.entry_date)}</td>
                    {!isExtrusion && <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.shift}</td>}
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{row.operator_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.machine_name}</td>
                    {isExtrusion ? (
                      <>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.lot_number || '-'}</td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-slate-700" title={row.material}>{row.material || '-'}</td>
                        <td className="max-w-[160px] truncate px-4 py-3 text-slate-700" title={row.size_spec}>{row.size_spec || '-'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{row.micron === null ? '-' : formatNumber(row.micron)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{row.order_qty === null ? '-' : formatNumber(row.order_qty, 2)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{row.weight_kg === null ? '-' : formatNumber(row.weight_kg, 2)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{row.trim_kg === null ? '-' : formatNumber(row.trim_kg, 2)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-red-700">{formatNumber(row.wastage_kg, 2)}</td>
                      </>
                    ) : (
                      <>
                        <td className="max-w-[200px] truncate px-4 py-3 text-slate-700" title={row.job_ref}>{row.job_ref}</td>
                        <td className="max-w-[220px] px-4 py-3 text-slate-700">
                          <span className="block truncate" title={row.material}>{row.material || '-'}</span>
                          <span className="block truncate text-xs text-slate-500" title={row.size_spec}>
                            {row.size_spec || '-'}
                            {department.hasBagFields && row.bag_type ? ` · ${row.bag_type}` : ''}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatNumber(row.qty_kg, 2)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{formatNumber(row.qty_meters)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-red-700">{formatNumber(row.wastage_kg, 2)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              row.downtime_reason === 'No Issue' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {row.downtime_reason}
                          </span>
                        </td>
                      </>
                    )}
                    {isPrinting && (
                      <td className="px-4 py-3">
                        <InkUsageCell usage={row.ink_usage} />
                      </td>
                    )}
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {canModify(row) ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditing(row)}
                              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                              aria-label={`Edit entry for ${row.operator_name} on ${formatDate(row.entry_date)}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {canDeleteEntries && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeleting(row);
                                }}
                                className="rounded-lg p-2 text-slate-600 transition hover:bg-red-50 hover:text-red-700"
                                aria-label={`Delete entry for ${row.operator_name} on ${formatDate(row.entry_date)}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="px-2 text-xs text-slate-500">View only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      <Modal open={editing !== null} title={`Edit ${department.shortName} entry`} onClose={() => setEditing(null)} size="xl">
        {editing && (
          <EntryForm
            key={editing.id}
            department={department}
            machines={machinesForDepartment}
            entry={editing}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        title="Delete this entry?"
        onClose={() => setDeleting(null)}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Keep entry
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} loading={deleteBusy}>
              Delete entry
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            This removes the {department.shortName} entry for{' '}
            <strong className="text-slate-900">{deleting?.operator_name}</strong> on{' '}
            <strong className="text-slate-900">{deleting ? formatDate(deleting.entry_date) : ''}</strong>. It moves to Trash, where an admin can restore it.
          </p>
          {deleteError && <Alert tone="error">{deleteError}</Alert>}
        </div>
      </Modal>
    </div>
  );
}
