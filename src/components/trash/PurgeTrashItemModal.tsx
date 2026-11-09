import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { purgeTrashItem, TRASH_KIND_LABEL, type TrashItem } from '@/lib/trash';

interface PurgeTrashItemModalProps {
  item: TrashItem;
  onClose: () => void;
  onPurged: (item: TrashItem) => void;
}

export function PurgeTrashItemModal({ item, onClose, onPurged }: PurgeTrashItemModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePurge = async () => {
    setBusy(true);
    setError(null);
    try {
      await purgeTrashItem(item);
      onPurged(item);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title="Delete permanently"
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void handlePurge()} loading={busy} icon={<Trash2 className="h-4 w-4" />}>
            Delete permanently
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-sm text-slate-700">
          The {TRASH_KIND_LABEL[item.kind].toLowerCase()}{' '}
          <span className="font-semibold text-slate-900">{item.name}</span> from {item.department} will be removed from the system.
          This cannot be undone.
        </p>
      </div>
    </Modal>
  );
}
