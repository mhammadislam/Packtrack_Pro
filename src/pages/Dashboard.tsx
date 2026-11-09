import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Gauge, PackageCheck, RefreshCw, Trash2 } from 'lucide-react';
import { DEPARTMENTS, DEPARTMENT_BY_CODE } from '@/lib/constants';
import { addDaysISO, formatNumber, todayISO } from '@/lib/dates';
import { fetchEntriesInRange } from '@/lib/entries';
import { fetchMachines } from '@/lib/masters';
import { groupByDepartment, sumEntries } from '@/lib/analytics';
import type { Machine, ProductionEntry } from '@/lib/types';
import { StatCard } from '@/components/ui/StatCard';
import { BarChart } from '@/components/ui/BarChart';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import type { Page } from '@/lib/navigation';

type ChartRange = 'today' | 'week';
type MachineState = 'running' | 'stopped' | 'idle';

const MACHINE_STATE_STYLE: Record<MachineState, { label: string; dot: string; badge: string }> = {
  running: { label: 'Running', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  stopped: { label: 'Stopped', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 ring-red-200' },
  idle: { label: 'No entry today', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700 ring-slate-200' },
};

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

function latestMachineStates(entries: ProductionEntry[]): Map<string, MachineState> {
  const sorted = [...entries].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const states = new Map<string, MachineState>();
  for (const entry of sorted) {
    const key = `${entry.department}|${entry.machine_name}`;
    if (states.has(key)) continue;
    states.set(key, entry.downtime_reason === 'No Issue' ? 'running' : 'stopped');
  }
  return states;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>('today');

  const today = todayISO();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rangeEntries, machineList] = await Promise.all([
        fetchEntriesInRange({ from: addDaysISO(today, -6), to: today }),
        fetchMachines(),
      ]);
      setEntries(rangeEntries);
      setMachines(machineList);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  const todayEntries = useMemo(() => entries.filter((entry) => entry.entry_date === today), [entries, today]);
  const todayTotals = useMemo(() => sumEntries(todayEntries), [todayEntries]);

  const chartEntries = useMemo(
    () => (chartRange === 'today' ? todayEntries : entries),
    [chartRange, entries, todayEntries],
  );
  const grouped = useMemo(() => groupByDepartment(chartEntries), [chartEntries]);
  const todayGrouped = useMemo(() => groupByDepartment(todayEntries), [todayEntries]);
  const activeDepartmentCount = DEPARTMENTS.filter((department) => todayGrouped[department.code].count > 0).length;

  const machineStates = useMemo(() => latestMachineStates(todayEntries), [todayEntries]);
  const machineRows = useMemo(
    () =>
      machines.map((machine) => ({
        ...machine,
        state: machineStates.get(`${machine.department}|${machine.name}`) ?? ('idle' as MachineState),
      })),
    [machines, machineStates],
  );
  const runningCount = machineRows.filter((machine) => machine.state === 'running').length;
  const stoppedCount = machineRows.filter((machine) => machine.state === 'stopped').length;

  const productionItems = DEPARTMENTS.map((department) => ({
    label: department.shortName,
    value: grouped[department.code].qtyKg,
    display: `${formatNumber(grouped[department.code].qtyKg, 1)} KG`,
  }));

  const wastageItems = DEPARTMENTS.map((department) => ({
    label: department.shortName,
    value: grouped[department.code].wastagePct,
    display: `${grouped[department.code].wastagePct.toFixed(1)}%`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Today at a glance</h2>
          <p className="text-sm text-slate-600">Live totals from every department, updated when you refresh.</p>
        </div>
        <Button variant="secondary" onClick={() => void load()} loading={loading} icon={<RefreshCw className="h-4 w-4" />}>
          Refresh
        </Button>
      </div>

      {error && <Alert tone="error">Dashboard data could not be loaded. {error}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's Total Production"
          value={formatNumber(todayTotals.qtyKg, 1)}
          unit="KG"
          icon={PackageCheck}
          tone="emerald"
          footnote={`${formatNumber(todayTotals.qtyMeters)} m · ${todayTotals.count} entries`}
        />
        <StatCard
          label="Today's Total Wastage"
          value={formatNumber(todayTotals.wastageKg, 1)}
          unit="KG"
          icon={Trash2}
          tone="red"
          footnote={`${todayTotals.wastagePct.toFixed(1)}% of material processed`}
        />
        <StatCard
          label="Machines Running"
          value={`${runningCount}`}
          unit={`/ ${machineRows.length}`}
          icon={Activity}
          tone="amber"
          footnote={`${stoppedCount} stopped with a downtime reason`}
        />
        <StatCard
          label="Active Departments"
          value={`${activeDepartmentCount}`}
          unit={`/ ${DEPARTMENTS.length}`}
          icon={Gauge}
          tone="slate"
          footnote="Departments with entries today"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="glass-panel p-5 sm:p-6 xl:col-span-2">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Department-wise production</h3>
              <p className="text-sm text-slate-600">Kilograms produced per department</p>
            </div>
            <RangeToggle value={chartRange} onChange={setChartRange} />
          </div>
          {loading ? <ChartSkeleton /> : <BarChart items={productionItems} barClassName="bg-emerald-500" />}
        </section>

        <section className="glass-panel p-5 sm:p-6">
          <div className="mb-5">
            <h3 className="text-base font-semibold text-slate-900">Machine status</h3>
            <p className="text-sm text-slate-600">Based on each machine's latest entry today</p>
          </div>
          {loading ? (
            <ChartSkeleton />
          ) : machineRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-600">No machines yet. Add them in Machine Master.</p>
          ) : (
            <ul className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
              {machineRows.map((machine) => {
                const style = MACHINE_STATE_STYLE[machine.state];
                return (
                  <li key={machine.id} className="flex items-center justify-between gap-3 rounded-lg glass-inset px-3 py-2.5 transition hover:border-slate-300">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{machine.name}</p>
                      <p className="truncate text-xs text-slate-600">{DEPARTMENT_BY_CODE[machine.department].shortName}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot} ${machine.state === 'running' ? 'animate-pulse' : ''}`} />
                      {style.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="glass-panel p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Wastage percentage by department</h3>
            <p className="text-sm text-slate-600">Wastage as a share of material processed ({chartRange === 'today' ? 'today' : 'last 7 days'})</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate({ kind: 'reports' })}
            className="glass-button self-start px-4 py-2 text-sm font-semibold sm:self-auto"
          >
            Open detailed reports
          </button>
        </div>
        {loading ? <ChartSkeleton /> : <BarChart items={wastageItems} barClassName="bg-red-500" emptyText="No wastage recorded for this period." />}
      </section>
    </div>
  );
}

function RangeToggle({ value, onChange }: { value: ChartRange; onChange: (value: ChartRange) => void }) {
  const options: { value: ChartRange; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Last 7 days' },
  ];
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Chart period">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
            value === option.value ? 'bg-black text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3" aria-label="Loading">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-3 rounded-full bg-slate-200" style={{ width: `${90 - index * 10}%` }} />
      ))}
    </div>
  );
}
