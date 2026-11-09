import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { deleteInventoryItem, type StockSummary } from '@/lib/inventory';

interface DeleteStockItemModalProps {
  item: StockSummary;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteStockItemModal({ item, onClose, onDeleted }: DeleteStockItemModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteInventoryItem(item.id);
      onDeleted();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title="Move item to Trash"
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Keep item
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()} loading={busy} icon={<Trash2 className="h-4 w-4" />}>
            Move to Trash
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">
            {item.item_code} - {item.item_name}
          </span>{' '}
          will be hidden from stock lists and reports. An admin can restore it from the Trash page at any time.
        </p>
      </div>
    </Modal>
  );
}
