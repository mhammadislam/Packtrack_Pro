import { useState } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { UserAccessPanel } from '@/components/users/UserAccessPanel';
import { PendingApprovalsPanel } from '@/components/users/PendingApprovalsPanel';

type UsersTab = 'access' | 'pending';

const TABS: { id: UsersTab; label: string; icon: typeof ShieldCheck }[] = [
  { id: 'access', label: 'User access', icon: ShieldCheck },
  { id: 'pending', label: 'Pending approvals', icon: UserPlus },
];

export function UsersPage() {
  const [tab, setTab] = useState<UsersTab>('access');

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="User management" className="inline-flex w-fit flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map(({ id, label, icon: Icon }) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                selected ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'access' ? <UserAccessPanel /> : <PendingApprovalsPanel />}
    </div>
  );
}
