import { useState, type ReactNode } from 'react';
import { Factory, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { AppShell } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dashboard } from '@/pages/Dashboard';
import { DepartmentPage } from '@/pages/DepartmentPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { OperatorsPage } from '@/pages/OperatorsPage';
import { MachinesPage } from '@/pages/MachinesPage';
import { UsersPage } from '@/pages/UsersPage';
import { QcPage } from '@/pages/QcPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { DispatchPage } from '@/pages/DispatchPage';
import { TrashPage } from '@/pages/TrashPage';
import type { Page } from '@/lib/navigation';

function FullPageMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="rounded-xl bg-black p-3 text-white">
          <Factory className="h-7 w-7" aria-hidden="true" />
        </span>
        {children}
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const { profile, profileError, signOut, isAdmin, isFirstAdmin, canViewReports } = useAuth();
  const [page, setPage] = useState<Page>({ kind: 'dashboard' });

  if (!profile) {
    return (
      <FullPageMessage>
        <div className="max-w-sm">
          <Alert tone="error">{profileError ?? 'Your profile could not be loaded.'}</Alert>
        </div>
        <Button variant="secondary" onClick={() => void signOut()} icon={<LogOut className="h-4 w-4" />}>
          Sign out
        </Button>
      </FullPageMessage>
    );
  }

  const renderPage = () => {
    switch (page.kind) {
      case 'dashboard':
        return <Dashboard onNavigate={setPage} />;
      case 'department':
        return <DepartmentPage key={page.code} code={page.code} />;
      case 'reports':
        return canViewReports ? <ReportsPage /> : <Dashboard onNavigate={setPage} />;
      case 'qc':
        return <QcPage />;
      case 'operators':
        return <OperatorsPage />;
      case 'machines':
        return <MachinesPage />;
      case 'users':
        return isFirstAdmin ? <UsersPage /> : <Dashboard onNavigate={setPage} />;
      case 'inventory':
        return <InventoryPage />;
      case 'dispatch':
        return <DispatchPage />;
      case 'trash':
        return isAdmin ? <TrashPage /> : <Dashboard onNavigate={setPage} />;
    }
  };

  return (
    <AppShell page={page} onNavigate={setPage}>
      {renderPage()}
    </AppShell>
  );
}

function AppGate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <FullPageMessage>
        <p className="text-sm font-medium text-slate-600">Loading PackTrack Pro...</p>
      </FullPageMessage>
    );
  }

  if (!session) return <AuthScreen />;

  return <AuthenticatedApp />;
}

function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}

export default App;
