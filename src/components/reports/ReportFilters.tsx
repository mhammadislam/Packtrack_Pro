import { CalendarDays, Cog, Factory, UserRound } from 'lucide-react';
import { DEPARTMENTS, DEPARTMENT_BY_CODE, type DepartmentCode } from '@/lib/constants';
import { encodeMachine, REPORT_TYPE_LABELS, type ReportFormState, type ReportType } from '@/lib/reports';
import type { Machine, Operator } from '@/lib/types';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';

const REPORT_TYPES: ReportType[] = ['day', 'week', 'month', 'operator', 'machine'];

const TYPE_ICON = {
  day: CalendarDays,
  week: CalendarDays,
  month: CalendarDays,
  operator: UserRound,
  machine: Cog,
};

interface ReportFiltersProps {
  form: ReportFormState;
  operators: Operator[];
  machines: Machine[];
  onChange: (patch: Partial<ReportFormState>) => void;
}

export function ReportFilters({ form, operators, machines, onChange }: ReportFiltersProps) {
  const usesDepartment = form.type === 'day' || form.type === 'week' || form.type === 'month';
  const usesDateRange = form.type === 'operator' || form.type === 'machine';

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div role="tablist" aria-label="Report type" className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-1">
        {REPORT_TYPES.map((type) => {
          const Icon = TYPE_ICON[type];
          const active = form.type === type;
          return (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange({ type })}
              className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition ${
                active ? 'bg-black text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {REPORT_TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {usesDepartment && (
          <Field label="Department" htmlFor="report_department">
            <SelectInput
              id="report_department"
              value={form.department}
              onChange={(e) => onChange({ department: e.target.value as ReportFormState['department'] })}
            >
              <option value="all">All departments</option>
              {DEPARTMENTS.map((department) => (
                <option key={department.code} value={department.code}>{department.name}</option>
              ))}
            </SelectInput>
          </Field>
        )}

        {form.type === 'day' && (
          <Field label="Select date" htmlFor="report_day" required>
            <TextInput id="report_day" type="date" value={form.day} onChange={(e) => onChange({ day: e.target.value })} />
          </Field>
        )}

        {form.type === 'week' && (
          <Field label="Select week (Monday to Sunday)" htmlFor="report_week" required>
            <TextInput id="report_week" type="week" value={form.week} onChange={(e) => onChange({ week: e.target.value })} />
          </Field>
        )}

        {form.type === 'month' && (
          <Field label="Select month and year" htmlFor="report_month" required>
            <TextInput id="report_month" type="month" value={form.month} onChange={(e) => onChange({ month: e.target.value })} />
          </Field>
        )}

        {form.type === 'operator' && (
          <Field label="Operator" htmlFor="report_operator" required hint="Shows this operator's work across all departments.">
            <SelectInput id="report_operator" value={form.operator} onChange={(e) => onChange({ operator: e.target.value })}>
              <option value="">Select operator</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.name}>{operator.name}</option>
              ))}
            </SelectInput>
          </Field>
        )}

        {form.type === 'machine' && (
          <Field label="Machine" htmlFor="report_machine" required>
            <SelectInput id="report_machine" value={form.machine} onChange={(e) => onChange({ machine: e.target.value })}>
              <option value="">Select machine</option>
              {DEPARTMENTS.map((department) => {
                const list = machines.filter((machine) => machine.department === department.code);
                if (list.length === 0) return null;
                return (
                  <optgroup key={department.code} label={department.shortName}>
                    {list.map((machine) => (
                      <option key={machine.id} value={encodeMachine(machine.department, machine.name)}>{machine.name}</option>
                    ))}
                  </optgroup>
                );
              })}
            </SelectInput>
          </Field>
        )}

        {usesDateRange && (
          <>
            <Field label="From" htmlFor="report_from" required>
              <TextInput id="report_from" type="date" value={form.from} onChange={(e) => onChange({ from: e.target.value })} />
            </Field>
            <Field label="To" htmlFor="report_to" required>
              <TextInput id="report_to" type="date" value={form.to} onChange={(e) => onChange({ to: e.target.value })} />
            </Field>
          </>
        )}
      </div>

      {usesDepartment && form.department !== 'all' && (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Factory className="h-4 w-4" aria-hidden="true" />
          Showing only {DEPARTMENT_BY_CODE[form.department as DepartmentCode].name}.
        </p>
      )}
    </section>
  );
}
