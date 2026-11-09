import { useState, type ReactNode } from 'react';
import { Factory, Gauge, LayoutGrid, LogOut, Menu, Settings2, ShieldCheck, Trash2, Users, X, FileBarChart, Cog, ScanLine, Boxes, Truck } from 'lucide-react';
import { DEPARTMENTS, type DepartmentCode } from '@/lib/constants';
import { todayISO, formatDate } from '@/lib/dates';
import { useAuth } from '@/contexts/AuthContext';
import type { Page } from '@/lib/navigation';

interface AppShellProps {
  page: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}

interface NavItemProps {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

function NavItem({ active, label, icon, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-150 ${
        active
          ? 'bg-black text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="px-3 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{children}</p>;
}

function pageTitle(page: Page): string {
  switch (page.kind) {
    case 'dashboard':
      return 'Production Dashboard';
    case 'reports':
      return 'Reports';
    case 'qc':
      return 'Quality Control';
    case 'inventory':
      return 'Stock & Inventory';
    case 'dispatch':
      return 'Dispatch & Billing';
    case 'operators':
      return 'Operator Master';
    case 'machines':
      return 'Machine Master';
    case 'users':
      return 'User Management';
    case 'trash':
      return 'Deleted Items';
    case 'department': {
      const department = DEPARTMENTS.find((item) => item.code === page.code);
      return department?.name ?? 'Department';
    }
  }
}

export function AppShell({ page, onNavigate, children }: AppShellProps) {
  const { profile, isAdmin, isFirstAdmin, canViewReports, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const go = (next: Page) => {
    onNavigate(next);
    setDrawerOpen(false);
  };

  const isActiveDepartment = (code: DepartmentCode) => page.kind === 'department' && page.code === code;

  const sidebar = (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white text-slate-700">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-5">
        <span className="rounded-lg bg-black p-2 text-white">
          <Factory className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight text-slate-900">PackTrack Pro</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Packaging ERP</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6" aria-label="Main navigation">
        <SectionLabel>Overview</SectionLabel>
        <div className="flex flex-col gap-1">
          <NavItem active={page.kind === 'dashboard'} label="Dashboard" icon={<Gauge className="h-4 w-4" />} onClick={() => go({ kind: 'dashboard' })} />
          {canViewReports && (
            <NavItem active={page.kind === 'reports'} label="Reports" icon={<FileBarChart className="h-4 w-4" />} onClick={() => go({ kind: 'reports' })} />
          )}
        </div>

        <SectionLabel>Quality</SectionLabel>
        <div className="flex flex-col gap-1">
          <NavItem active={page.kind === 'qc'} label="QC Reports" icon={<ScanLine className="h-4 w-4" />} onClick={() => go({ kind: 'qc' })} />
        </div>

        <SectionLabel>Stores</SectionLabel>
        <div className="flex flex-col gap-1">
          <NavItem active={page.kind === 'inventory'} label="Inventory" icon={<Boxes className="h-4 w-4" />} onClick={() => go({ kind: 'inventory' })} />
          <NavItem active={page.kind === 'dispatch'} label="Dispatch & Billing" icon={<Truck className="h-4 w-4" />} onClick={() => go({ kind: 'dispatch' })} />
        </div>

        <SectionLabel>Departments</SectionLabel>
        <div className="flex flex-col gap-1">
          {DEPARTMENTS.map((department) => {
            const Icon = department.icon;
            return (
              <NavItem
                key={department.code}
                active={isActiveDepartment(department.code)}
                label={department.shortName}
                icon={<Icon className="h-4 w-4" />}
                onClick={() => go({ kind: 'department', code: department.code })}
              />
            );
          })}
        </div>

        <SectionLabel>Masters</SectionLabel>
        <div className="flex flex-col gap-1">
          <NavItem active={page.kind === 'operators'} label="Operators" icon={<Users className="h-4 w-4" />} onClick={() => go({ kind: 'operators' })} />
          <NavItem active={page.kind === 'machines'} label="Machines" icon={<Cog className="h-4 w-4" />} onClick={() => go({ kind: 'machines' })} />
          {isFirstAdmin && (
            <NavItem active={page.kind === 'users'} label="User Management" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => go({ kind: 'users' })} />
          )}
          {isAdmin && (
            <NavItem active={page.kind === 'trash'} label="Trash" icon={<Trash2 className="h-4 w-4" />} onClick={() => go({ kind: 'trash' })} />
          )}
        </div>
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-900 ring-1 ring-inset ring-slate-200">
            {(profile?.full_name || '?').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{profile?.full_name}</p>
            <p className="text-xs text-slate-500">{isAdmin ? 'Administrator' : 'Data Entry Operator'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="glass-button w-full px-3 py-2 text-sm font-medium"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl animate-[slideIn_200ms_ease-out]">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="glass-button absolute right-3 top-4 z-10 p-1.5"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="glass-button p-2 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">{pageTitle(page)}</h1>
              <p className="hidden text-xs text-slate-500 sm:block">{formatDate(todayISO())}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 md:flex">
            {isAdmin ? <Settings2 className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
            {isAdmin ? 'Administrator' : 'Data Entry Operator'}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
