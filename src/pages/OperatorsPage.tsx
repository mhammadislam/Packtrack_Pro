import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Search, Trash2, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createOperator, deleteOperator, fetchOperators } from '@/lib/masters';
import type { Operator } from '@/lib/types';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';

const PAGE_SIZE = 10;

export function OperatorsPage() {
  const { isAdmin } = useAuth();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Operator | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOperators = async () => {
    setLoading(true);
    setError(null);
    try {
      setOperators(await fetchOperators());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOperators();
  }, []);

  useEffect(() => setPage(1), [search]);

  const filtered = useMemo(
    () => operators.filter((operator) => operator.name.toLowerCase().includes(search.trim().toLowerCase())),
    [operators, search],
  );
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNameError(null);
    setNotice(null);
    if (!newName.trim()) {
      setNameError('Enter the operator name.');
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
      setNewName('');
      setNotice(`${created.name} has been added.`);
    } catch (caught) {
      setNameError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteOperator(deleting.id);
      setOperators((current) => current.filter((operator) => operator.id !== deleting.id));
      setDeleting(null);
    } catch (caught) {
      setDeleteError(errorMessage(caught));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-1">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-lg bg-slate-100 p-2 text-slate-900">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Add new operator</h2>
              <p className="text-sm text-slate-600">Operators appear in every entry form.</p>
            </div>
          </div>
          <form onSubmit={handleAdd} className="flex flex-col gap-4" noValidate>
            <Field label="Operator name" htmlFor="new_operator" required error={nameError ?? undefined}>
              <TextInput id="new_operator" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" />
            </Field>
            <Button type="submit" loading={saving} icon={<Plus className="h-4 w-4" />}>
              Add operator
            </Button>
          </form>
          {notice && <div className="mt-4"><Alert tone="success">{notice}</Alert></div>}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="border-b border-slate-200 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <TextInput aria-label="Search operators" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search operators" className="pl-9" />
            </div>
          </div>
          {error && <div className="p-4"><Alert tone="error">Operators could not be loaded. {error}</Alert></div>}
          <ul className="divide-y divide-slate-100">
            {loading && <li className="px-5 py-6 text-sm text-slate-600">Loading operators...</li>}
            {!loading && pageRows.length === 0 && (
              <li className="px-5 py-12 text-center text-sm text-slate-600">
                {operators.length === 0 ? 'No operators yet. Add the first one on the left.' : 'No operators match your search.'}
              </li>
            )}
            {pageRows.map((operator, index) => (
              <li key={operator.id} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-900 ring-1 ring-inset ring-slate-200">
                    {(operator.name.charAt(0) || '?').toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{operator.name}</p>
                    <p className="text-xs text-slate-600">#{(page - 1) * PAGE_SIZE + index + 1}</p>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleting(operator);
                    }}
                    className="rounded-lg p-2 text-slate-600 transition hover:bg-red-50 hover:text-red-700"
                    aria-label={`Delete operator ${operator.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </section>
      </div>

      <Modal
        open={deleting !== null}
        title="Delete operator?"
        onClose={() => setDeleting(null)}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} loading={deleteBusy}>
              Delete operator
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            <strong className="text-slate-900">{deleting?.name}</strong> will be moved to Trash and hidden from the operator list. An admin can restore it from Trash. Past entries keep their recorded name.
          </p>
          {deleteError && <Alert tone="error">{deleteError}</Alert>}
        </div>
      </Modal>
    </div>
  );
}
