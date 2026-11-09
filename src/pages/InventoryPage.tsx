import { useEffect, useState } from 'react';
import { BarChart3, Download, LayoutDashboard, ListTree, PackageMinus, PackagePlus, Plus, Printer, ScrollText, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { InventoryDashboard } from '@/components/inventory/InventoryDashboard';
import { StockItemsView } from '@/components/inventory/StockItemsView';
import { LedgerView } from '@/components/inventory/LedgerView';
import { InventoryReports } from '@/components/inventory/InventoryReports';
import { ItemFormModal } from '@/components/inventory/ItemFormModal';
import { PurchaseFormModal } from '@/components/inventory/PurchaseFormModal';
import { IssueFormModal } from '@/components/inventory/IssueFormModal';
import { AdjustmentFormModal } from '@/components/inventory/AdjustmentFormModal';
import { BarcodeModal } from '@/components/inventory/BarcodeModal';
import { DeleteStockItemModal } from '@/components/inventory/DeleteStockItemModal';
import { useAuth } from '@/contexts/AuthContext';
import { exportStockSummaryToExcel, printStockReport } from '@/lib/inventoryExports';
import { fetchStockSummary, type StockSummary } from '@/lib/inventory';

type InventoryTab = 'overview' | 'items' | 'ledger' | 'reports';

type InventoryModal =
  | { kind: 'item'; item: StockSummary | null }
  | { kind: 'purchase' }
  | { kind: 'issue' }
  | { kind: 'adjustment' }
  | { kind: 'barcode'; item: StockSummary }
  | { kind: 'delete'; item: StockSummary };

const TABS: { id: InventoryTab; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'items', label: 'Stock items', icon: ListTree },
  { id: 'ledger', label: 'Stock ledger', icon: ScrollText },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

export function InventoryPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<InventoryTab>('overview');
  const [items, setItems] = useState<StockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState<InventoryModal | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchStockSummary()
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version]);

  const closeModal = () => setModal(null);

  const handleSaved = (message: string) => {
    setModal(null);
    setNotice(message);
    setVersion((value) => value + 1);
  };

  const handleExport = () => {
    try {
      exportStockSummaryToExcel(items);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const handlePrint = () => {
    try {
      printStockReport(items);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const renderTab = () => {
    if (loading && items.length === 0) {
      return (
        <div className="flex flex-col gap-3" aria-label="Loading">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      );
    }
    switch (tab) {
      case 'overview':
        return <InventoryDashboard items={items} />;
      case 'items':
        return (
          <StockItemsView
            items={items}
            onEdit={(item) => setModal({ kind: 'item', item })}
            onBarcode={(item) => setModal({ kind: 'barcode', item })}
            onDelete={isAdmin ? (item) => setModal({ kind: 'delete', item }) : undefined}
          />
        );
      case 'ledger':
        return <LedgerView items={items} version={version} />;
      case 'reports':
        return <InventoryReports version={version} />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Stores</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Stock and inventory</h2>
          <p className="text-sm text-slate-600">Track raw materials, work in progress and finished goods in real time.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setModal({ kind: 'item', item: null })} icon={<Plus className="h-4 w-4" />}>
            New item
          </Button>
          <Button variant="secondary" onClick={() => setModal({ kind: 'adjustment' })} icon={<SlidersHorizontal className="h-4 w-4" />}>
            Adjustment
          </Button>
          <Button variant="secondary" onClick={() => setModal({ kind: 'issue' })} icon={<PackageMinus className="h-4 w-4" />}>
            Issue stock
          </Button>
          <Button onClick={() => setModal({ kind: 'purchase' })} icon={<PackagePlus className="h-4 w-4" />}>
            Add stock
          </Button>
        </div>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">Stock data could not be loaded. {error}</Alert>}

      <div className="flex flex-col gap-3 border-b border-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Inventory views">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </nav>
        <div className="flex flex-wrap gap-2 pb-3 sm:pb-2">
          <Button variant="secondary" onClick={handleExport} disabled={items.length === 0} icon={<Download className="h-4 w-4" />}>
            Export Excel
          </Button>
          <Button variant="secondary" onClick={handlePrint} disabled={items.length === 0} icon={<Printer className="h-4 w-4" />}>
            Print report
          </Button>
        </div>
      </div>

      {renderTab()}

      {modal?.kind === 'item' && (
        <ItemFormModal item={modal.item} onClose={closeModal} onSaved={() => handleSaved(modal.item ? 'Item updated.' : 'Item created. Its code has been generated automatically.')} />
      )}
      {modal?.kind === 'purchase' && (
        <PurchaseFormModal items={items} onClose={closeModal} onSaved={() => handleSaved('Stock added and recorded in the ledger.')} />
      )}
      {modal?.kind === 'issue' && (
        <IssueFormModal items={items} onClose={closeModal} onSaved={() => handleSaved('Stock issued to the department.')} />
      )}
      {modal?.kind === 'adjustment' && (
        <AdjustmentFormModal items={items} onClose={closeModal} onSaved={() => handleSaved('Stock adjustment saved.')} />
      )}
      {modal?.kind === 'barcode' && <BarcodeModal item={modal.item} onClose={closeModal} />}
      {modal?.kind === 'delete' && (
        <DeleteStockItemModal item={modal.item} onClose={closeModal} onDeleted={() => handleSaved(`${modal.item.item_code} moved to Trash.`)} />
      )}
    </div>
  );
}
