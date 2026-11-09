import { Printer } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { code39Layout } from '@/lib/barcode';
import type { StockSummary } from '@/lib/inventory';

interface BarcodeModalProps {
  item: StockSummary;
  onClose: () => void;
}

export function BarcodeModal({ item, onClose }: BarcodeModalProps) {
  const layout = code39Layout(item.item_code);

  const footer = (
    <Button onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>
      Print label
    </Button>
  );

  return (
    <Modal open title={`Barcode - ${item.item_code}`} onClose={onClose} footer={footer} size="md">
      <div id="barcode-print-area" className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-6">
        <p className="text-sm font-semibold text-slate-900">{item.item_name}</p>
        <svg
          viewBox={`0 0 ${layout.width} 80`}
          className="h-28 w-full max-w-sm"
          role="img"
          aria-label={`Barcode for ${item.item_code}`}
          preserveAspectRatio="none"
        >
          {layout.bars.map((bar) => (
            <rect key={bar.x} x={bar.x} y={0} width={bar.width} height={80} fill="#0f172a" />
          ))}
        </svg>
        <p className="font-mono text-sm tracking-[0.2em] text-slate-700">{item.item_code}</p>
        <p className="text-xs text-slate-500">
          {item.category}
          {item.material_type ? ` - ${item.material_type}` : ''}
        </p>
      </div>
    </Modal>
  );
}
