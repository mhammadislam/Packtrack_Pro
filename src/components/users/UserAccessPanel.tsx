import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProfiles, setUserAccess, type UserAccessUpdate } from '@/lib/masters';
import type { Profile } from '@/lib/types';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Toggle } from '@/components/ui/Toggle';

function accessOf(profile: Profile): UserAccessUpdate {
  return {
    role: profile.role,
    is_suspended: profile.is_suspended,
    can_delete_entries: profile.can_delete_entries,
    can_view_reports: profile.can_view_reports,
  };
}

export function UserAccessPanel() {
  const { profile: currentProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetchProfiles()
      .then((list) => {
        if (active) setProfiles(list.filter((item) => item.status !== 'pending_approval' && item.status !== 'rejected'));
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
  }, []);

  const saveAccess = async (target: Profile, patch: Partial<UserAccessUpdate>) => {
    const next: Profile = {
      ...target,
      role: patch.role ?? target.role,
      is_suspended: patch.is_suspended ?? target.is_suspended,
      can_delete_entries: patch.can_delete_entries ?? target.can_delete_entries,
      can_view_reports: patch.can_view_reports ?? target.can_view_reports,
    };
    const replace = (rows: Profile[], row: Profile) => rows.map((item) => (item.id === target.id ? row : item));
    setSavingId(target.id);
    setRowError(null);
    setProfiles((current) => replace(current, next));
    try {
      await setUserAccess(target.id, accessOf(next));
    } catch (caught) {
      setProfiles((current) => replace(current, target));
      setRowError({ id: target.id, message: errorMessage(caught) });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <span className="rounded-lg bg-amber-100 p-2 text-amber-700">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Manage users and access</h2>
          <p className="mt-1 text-sm text-slate-600">
            Changes apply immediately. Administrators always have every permission. Suspended users cannot sign in to records or data.
            You cannot change your own access.
          </p>
        </div>
      </div>

      {error && <Alert tone="error">Users could not be loaded. {error}</Alert>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-5 py-3">User</th>
                <th className="whitespace-nowrap px-5 py-3">Role</th>
                <th className="whitespace-nowrap px-5 py-3">Status</th>
                <th className="whitespace-nowrap px-5 py-3">Can delete entries</th>
                <th className="whitespace-nowrap px-5 py-3">Can view reports</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={5} className="px-5 py-6 text-slate-500">Loading users...</td></tr>
              )}
              {!loading && profiles.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">No users found.</td></tr>
              )}
              {profiles.map((item) => {
                const isSelf = item.id === currentProfile?.id;
                const isSaving = savingId === item.id;
                const locked = isSelf || isSaving;
                const isAdmin = item.role === 'admin';
                const name = item.full_name || 'Unnamed user';
                return (
                  <tr key={item.id} className="align-top transition hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">
                        {name}
                        {isSelf && <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-amber-400">You</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{item.email || 'No email on record'}</p>
                      {rowError?.id === item.id && <p className="mt-1 text-xs font-medium text-red-600">{rowError.message}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Toggle
                          label={`Administrator access for ${name}`}
                          checked={isAdmin}
                          disabled={locked}
                          onChange={(on) => void saveAccess(item, { role: on ? 'admin' : 'operator' })}
                        />
                        <span className="text-slate-700">{isAdmin ? 'Admin' : 'Operator'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Toggle
                          label={`Access for ${name}`}
                          checked={!item.is_suspended}
                          disabled={locked}
                          onChange={(active) => void saveAccess(item, { is_suspended: !active })}
                        />
                        <span className={item.is_suspended ? 'font-medium text-red-700' : 'text-slate-700'}>
                          {item.is_suspended ? 'Suspended' : 'Active'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {isAdmin ? (
                        <span className="text-xs font-medium text-slate-500">Always on</span>
                      ) : (
                        <Toggle
                          label={`Can delete entries for ${name}`}
                          checked={item.can_delete_entries}
                          disabled={locked}
                          onChange={(on) => void saveAccess(item, { can_delete_entries: on })}
                        />
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {isAdmin ? (
                        <span className="text-xs font-medium text-slate-500">Always on</span>
                      ) : (
                        <Toggle
                          label={`Can view reports for ${name}`}
                          checked={item.can_view_reports}
                          disabled={locked}
                          onChange={(on) => void saveAccess(item, { can_view_reports: on })}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
