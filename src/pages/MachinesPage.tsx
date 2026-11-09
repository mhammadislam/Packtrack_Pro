import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Cog, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DEPARTMENTS, DEPARTMENT_BY_CODE, type DepartmentCode } from '@/lib/constants';
import { createMachine, deleteMachine, fetchMachines } from '@/lib/masters';
import type { Machine } from '@/lib/types';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';

const PAGE_SIZE = 10;

export function MachinesPage() {
  const { isAdmin } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentCode | 'all'>('all');
  const [page, setPage] = useState(1);
  const [newDepartment, setNewDepartment] = useState<DepartmentCode>(DEPARTMENTS[0].code);
  const [newName, setNewName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Machine | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadMachines = async () => {
    setLoading(true);
    setError(null);
    try {
      setMachines(await fetchMachines());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMachines();
  }, []);

  useEffect(() => setPage(1), [search, departmentFilter]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return machines.filter(
      (machine) =>
        (departmentFilter === 'all' || machine.department === departmentFilter) &&
        (!term || machine.name.toLowerCase().includes(term)),
    );
  }, [machines, search, departmentFilter]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    if (!newName.trim()) {
      setFormError('Enter the machine name.');
      return;
    }
    setSaving(true);
    try {
      await createMachine(newDepartment, newName);
      setNewName('');
      setNotice('Machine added.');
      await loadMachines();
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteMachine(deleting.id);
      setMachines((current) => current.filter((machine) => machine.id !== deleting.id));
      setDeleting(null);
    } catch (caught) {
      setDeleteError(errorMessage(caught));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-lg bg-slate-100 p-2 text-slate-900">
              <Cog className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Add new machine</h2>
              <p className="text-sm text-slate-600">New machines appear in that department's entry form.</p>
            </div>
          </div>
          <form onSubmit={handleAdd} className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_1fr_auto]" noValidate>
            <Field label="Department" htmlFor="new_machine_department" required>
              <SelectInput id="new_machine_department" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value as DepartmentCode)}>
                {DEPARTMENTS.map((department) => (
                  <option key={department.code} value={department.code}>{department.shortName}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Machine name" htmlFor="new_machine_name" required error={formError ?? undefined}>
              <TextInput id="new_machine_name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Printing M4" />
            </Field>
            <Button type="submit" loading={saving} icon={<Plus className="h-4 w-4" />}>
              Add machine
            </Button>
          </form>
          {notice && <div className="mt-4"><Alert tone="success">{notice}</Alert></div>}
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
          <div className="relative sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <TextInput aria-label="Search machines" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search machines" className="pl-9" />
          </div>
          <SelectInput aria-label="Filter by department" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value as DepartmentCode | 'all')} className="sm:w-64">
            <option value="all">All departments</option>
            {DEPARTMENTS.map((department) => (
              <option key={department.code} value={department.code}>{department.shortName}</option>
            ))}
          </SelectInput>
        </div>
        {error && <div className="p-4"><Alert tone="error">Machines could not be loaded. {error}</Alert></div>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Machine</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={3} className="px-5 py-6 text-sm text-slate-600">Loading machines...</td></tr>
              )}
              {!loading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-sm text-slate-600">
                    {machines.length === 0 ? 'No machines yet.' : 'No machines match your filters.'}
                  </td>
                </tr>
              )}
              {pageRows.map((machine) => (
                <tr key={machine.id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{machine.name}</td>
                  <td className="px-5 py-3 text-slate-700">{DEPARTMENT_BY_CODE[machine.department].name}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(machine);
                          }}
                          className="rounded-lg p-2 text-slate-600 transition hover:bg-red-50 hover:text-red-700"
                          aria-label={`Delete machine ${machine.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">View only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </section>

      <Modal
        open={deleting !== null}
        title="Delete machine?"
        onClose={() => setDeleting(null)}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} loading={deleteBusy}>
              Delete machine
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            <strong className="text-slate-900">{deleting?.name}</strong> will be moved to Trash and hidden from the machine list. An admin can restore it from Trash. Past entries keep their recorded machine name.
          </p>
          {deleteError && <Alert tone="error">{deleteError}</Alert>}
        </div>
      </Modal>
    </div>
  );
}
