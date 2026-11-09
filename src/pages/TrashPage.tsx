import { useEffect, useMemo, useState } from 'react';
import { ArchiveRestore, Trash2 } from 'lucide-react';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { Field, SelectInput } from '@/components/ui/Field';
import { PurgeTrashItemModal } from '@/components/trash/PurgeTrashItemModal';
import { fetchProfiles } from '@/lib/masters';
import { fetchTrashItems, restoreTrashItem, TRASH_KIND_LABEL, type TrashItem, type TrashKind } from '@/lib/trash';

const PAGE_SIZE = 10;

const HEADER_CLASS = 'whitespace-nowrap px-4 py-3 font-semibold';

const KIND_FILTERS = Object.keys(TRASH_KIND_LABEL) as TrashKind[];

type KindFilter = TrashKind | 'all';

function formatDeletedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<KindFilter>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);
  const [purging, setPurging] = useState<TrashItem | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchTrashItems()
      .then((rows) => {
        if (active) setItems(rows);
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
  }, [version]);

  useEffect(() => {
    let active = true;
    fetchProfiles()
      .then((profiles) => {
        if (active) setNames(Object.fromEntries(profiles.map((profile) => [profile.id, profile.full_name])));
      })
      .catch(() => {
        if (active) setNames({});
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => (kind === 'all' ? items : items.filter((item) => item.kind === kind)), [items, kind]);
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleKindChange = (value: string) => {
    setKind(value as KindFilter);
    setPage(1);
  };

  const handleRestore = async (item: TrashItem) => {
    setRestoringKey(item.key);
    setError(null);
    setNotice(null);
    try {
      await restoreTrashItem(item);
      setNotice(`${item.name} was restored to ${item.department}.`);
      setVersion((value) => value + 1);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setRestoringKey(null);
    }
  };

  const handlePurged = (item: TrashItem) => {
    setPurging(null);
    setNotice(`${item.name} was permanently deleted.`);
    setVersion((value) => value + 1);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="glass-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Items in Trash</p>
            <p className="text-sm text-slate-500">
              Deleted items from every department appear here. Restore an item to put it back where it was.
            </p>
          </div>
        </div>
        <div className="w-full sm:w-64">
          <Field label="Item type" htmlFor="trash-kind">
            <SelectInput id="trash-kind" value={kind} onChange={(event) => handleKindChange(event.target.value)}>
              <option value="all">All types</option>
              {KIND_FILTERS.map((option) => (
                <option key={option} value={option}>
                  {TRASH_KIND_LABEL[option]}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="glass-panel overflow-hidden">
        {loading && items.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">Loading deleted items...</p>
        ) : visible.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-slate-500">
            {items.length === 0 ? 'The Trash is empty. Items deleted from any department will show up here.' : 'No deleted items of this type.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className={HEADER_CLASS}>Item name</th>
                  <th className={HEADER_CLASS}>Original department</th>
                  <th className={HEADER_CLASS}>Type</th>
                  <th className={HEADER_CLASS}>Date deleted</th>
                  <th className={HEADER_CLASS}>Deleted by</th>
                  <th className={`${HEADER_CLASS} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pageItems.map((item) => (
                  <tr key={item.key} className="text-slate-700 transition-colors duration-150 hover:bg-slate-50">
                    <td className="max-w-[260px] px-4 py-3">
                      <p className="truncate font-medium text-slate-900">{item.name}</p>
                      {item.details && <p className="truncate text-xs text-slate-500">{item.details}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{item.department}</td>
                    <td className="whitespace-nowrap px-4 py-3">{TRASH_KIND_LABEL[item.kind]}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDeletedAt(item.deletedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{item.deletedBy ? (names[item.deletedBy] ?? 'Unknown user') : '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          icon={<ArchiveRestore className="h-4 w-4" />}
                          loading={restoringKey === item.key}
                          disabled={restoringKey !== null && restoringKey !== item.key}
                          onClick={() => void handleRestore(item)}
                        >
                          Restore
                        </Button>
                        <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setPurging(item)} disabled={restoringKey !== null}>
                          Delete permanently
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={currentPage} pageSize={PAGE_SIZE} total={visible.length} onPageChange={setPage} />
      </div>

      {purging && <PurgeTrashItemModal item={purging} onClose={() => setPurging(null)} onPurged={handlePurged} />}
    </div>
  );
}
