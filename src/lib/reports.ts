import { DEPARTMENT_BY_CODE, type DepartmentCode } from '@/lib/constants';
import { currentISOWeek, currentYearMonth, formatDate, monthRange, todayISO, weekRange } from '@/lib/dates';
import type { EntryRangeFilter } from '@/lib/entries';

export type ReportType = 'day' | 'week' | 'month' | 'operator' | 'machine';

export interface ReportFormState {
  type: ReportType;
  department: DepartmentCode | 'all';
  day: string;
  week: string;
  month: string;
  operator: string;
  machine: string;
  from: string;
  to: string;
}

export interface ResolvedReport {
  query: EntryRangeFilter;
  title: string;
  subtitle: string;
  fileName: string;
  breakdownBy: 'department' | 'operator';
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  day: 'Per Day',
  week: 'Weekly',
  month: 'Monthly',
  operator: 'Operator Wise',
  machine: 'Machine Wise',
};

export function encodeMachine(department: DepartmentCode, name: string): string {
  return `${department}|${name}`;
}

export function defaultReportForm(): ReportFormState {
  const month = currentYearMonth();
  return {
    type: 'day',
    department: 'all',
    day: todayISO(),
    week: currentISOWeek(),
    month,
    operator: '',
    machine: '',
    from: `${month}-01`,
    to: todayISO(),
  };
}

export function decodeMachine(value: string): { department: DepartmentCode; name: string } | null {
  const [department, ...rest] = value.split('|');
  const name = rest.join('|');
  if (!department || !name || !(department in DEPARTMENT_BY_CODE)) return null;
  return { department: department as DepartmentCode, name };
}

function fileSafe(text: string): string {
  return text.replace(/[^a-zA-Z0-9-]+/g, '_').replace(/^_+|_+$/g, '');
}

export function resolveReport(state: ReportFormState): { report: ResolvedReport | null; error: string | null } {
  const departmentLabel = state.department === 'all' ? 'All Departments' : DEPARTMENT_BY_CODE[state.department].shortName;
  const departmentFilter = state.department === 'all' ? undefined : state.department;

  switch (state.type) {
    case 'day': {
      if (!state.day) return { report: null, error: 'Select a date.' };
      return {
        report: {
          query: { from: state.day, to: state.day, department: departmentFilter },
          title: `Daily Production Report - ${formatDate(state.day)}`,
          subtitle: departmentLabel,
          fileName: fileSafe(`Daily_${state.day}_${departmentLabel}`),
          breakdownBy: 'department',
        },
        error: null,
      };
    }
    case 'week': {
      const range = weekRange(state.week);
      if (!range) return { report: null, error: 'Select a week.' };
      return {
        report: {
          query: { ...range, department: departmentFilter },
          title: `Weekly Production Report - ${formatDate(range.from)} to ${formatDate(range.to)}`,
          subtitle: `${departmentLabel} | Monday to Sunday`,
          fileName: fileSafe(`Weekly_${state.week}_${departmentLabel}`),
          breakdownBy: 'department',
        },
        error: null,
      };
    }
    case 'month': {
      const range = monthRange(state.month);
      if (!range) return { report: null, error: 'Select a month.' };
      return {
        report: {
          query: { ...range, department: departmentFilter },
          title: `Monthly Production Report - ${state.month}`,
          subtitle: `${departmentLabel} | ${formatDate(range.from)} to ${formatDate(range.to)}`,
          fileName: fileSafe(`Monthly_${state.month}_${departmentLabel}`),
          breakdownBy: 'department',
        },
        error: null,
      };
    }
    case 'operator': {
      if (!state.operator) return { report: null, error: 'Select an operator.' };
      if (!state.from || !state.to) return { report: null, error: 'Select a start and end date.' };
      if (state.from > state.to) return { report: null, error: 'The start date must be before the end date.' };
      return {
        report: {
          query: { from: state.from, to: state.to, operatorName: state.operator },
          title: `Operator Performance - ${state.operator}`,
          subtitle: `${formatDate(state.from)} to ${formatDate(state.to)} | All departments`,
          fileName: fileSafe(`Operator_${state.operator}_${state.from}_${state.to}`),
          breakdownBy: 'department',
        },
        error: null,
      };
    }
    case 'machine': {
      const machine = decodeMachine(state.machine);
      if (!machine) return { report: null, error: 'Select a machine.' };
      if (!state.from || !state.to) return { report: null, error: 'Select a start and end date.' };
      if (state.from > state.to) return { report: null, error: 'The start date must be before the end date.' };
      return {
        report: {
          query: { from: state.from, to: state.to, department: machine.department, machineName: machine.name },
          title: `Machine Production History - ${machine.name}`,
          subtitle: `${DEPARTMENT_BY_CODE[machine.department].name} | ${formatDate(state.from)} to ${formatDate(state.to)}`,
          fileName: fileSafe(`Machine_${machine.name}_${state.from}_${state.to}`),
          breakdownBy: 'operator',
        },
        error: null,
      };
    }
  }
}
