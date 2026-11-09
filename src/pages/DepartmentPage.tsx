import { useEffect, useState } from 'react';
import { ClipboardPen, ListChecks, type LucideIcon } from 'lucide-react';
import { DEPARTMENT_BY_CODE, type DepartmentCode } from '@/lib/constants';
import { fetchMachines } from '@/lib/masters';
import type { Machine } from '@/lib/types';
import { EntryForm } from '@/components/entries/EntryForm';
import { EntryRecords } from '@/components/entries/EntryRecords';
import { Alert, errorMessage } from '@/components/ui/Alert';

type Tab = 'entry' | 'records';

interface DepartmentPageProps {
  code: DepartmentCode;
}

export function DepartmentPage({ code }: DepartmentPageProps) {
  const department = DEPARTMENT_BY_CODE[code];
  const [tab, setTab] = useState<Tab>('entry');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machinesError, setMachinesError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchMachines()
      .then((list) => {
        if (active) setMachines(list);
      })
      .catch((caught: unknown) => {
        if (active) setMachinesError(errorMessage(caught));
      });
    return () => {
      active = false;
    };
  }, []);

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: 'entry', label: 'Data Entry', icon: ClipboardPen },
    { id: 'records', label: 'Records', icon: ListChecks },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">{department.name}</h2>
          <p className="text-sm text-slate-600">
            {tab === 'entry' ? 'Record today\u2019s production, wastage and downtime for this department.' : 'Search, edit and review every entry for this department.'}
          </p>
        </div>
        <div role="tablist" className="inline-flex self-start rounded-lg border border-slate-200 bg-slate-50 p-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
                  active ? 'bg-black text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {machinesError && <Alert tone="error">Machines could not be loaded. {machinesError}</Alert>}

      {tab === 'entry' ? (
        <section>
          <EntryForm department={department} machines={machines.filter((machine) => machine.department === code)} />
        </section>
      ) : (
        <EntryRecords department={department} machines={machines} />
      )}
    </div>
  );
}
