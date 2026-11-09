import { useState, type ChangeEvent } from 'react';
import { Download } from 'lucide-react';
import type { DepartmentConfig } from '@/lib/constants';
import { insertEntries } from '@/lib/entries';
import { downloadEntryTemplate, parseEntryWorkbook, type ImportParseResult } from '@/lib/entryImport';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert, errorMessage } from '@/components/ui/Alert';

const PREVIEW_ISSUE_LIMIT = 10;

interface EntryImportModalProps {
  department: DepartmentConfig;
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}

export function EntryImportModal({ department, open, onClose, onImported }: EntryImportModalProps) {
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportParseResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setResult(null);
    setFileName('');
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setResult(null);
    setFileName(file.name);
    setParsing(true);
    try {
      setResult(await parseEntryWorkbook(file, department));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!result || result.entries.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      await insertEntries(result.entries.map((entry) => entry.payload));
      const count = result.entries.length;
      reset();
      onImported(count);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setImporting(false);
    }
  };

  const readyCount = result?.entries.length ?? 0;
  const issues = result?.issues ?? [];

  return (
    <Modal
      open={open}
      title={`Import ${department.shortName} entries from Excel`}
      onClose={close}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close} disabled={importing}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleImport()} disabled={readyCount === 0 || parsing} loading={importing}>
            {readyCount > 0 ? `Import ${readyCount} ${readyCount === 1 ? 'entry' : 'entries'}` : 'Import entries'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Step 1: download the template, fill one row per entry, then upload it below.
          </p>
          <Button
            type="button"
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={() => void downloadEntryTemplate(department)}
            className="shrink-0"
          >
            Download template
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-slate-700">Step 2: choose your filled Excel file</p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            disabled={parsing || importing}
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-black file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-slate-800 disabled:opacity-50"
          />
          {fileName && <p className="text-xs text-slate-500">Selected: {fileName}</p>}
        </div>

        {parsing && <p className="text-sm text-slate-600">Reading the file...</p>}
        {error && <Alert tone="error">{error}</Alert>}

        {result && (
          <div className="flex flex-col gap-3">
            <Alert tone={readyCount > 0 ? 'success' : 'error'}>
              {readyCount} {readyCount === 1 ? 'row is' : 'rows are'} ready to import.
            </Alert>
            {issues.length > 0 && (
              <Alert tone="error">
                <p className="mb-1 font-medium">{issues.length} {issues.length === 1 ? 'row has' : 'rows have'} problems and will be skipped:</p>
                <ul className="list-disc space-y-1 pl-5">
                  {issues.slice(0, PREVIEW_ISSUE_LIMIT).map((issue) => (
                    <li key={issue.line}>Row {issue.line}: {issue.message}</li>
                  ))}
                </ul>
                {issues.length > PREVIEW_ISSUE_LIMIT && (
                  <p className="mt-1">And {issues.length - PREVIEW_ISSUE_LIMIT} more.</p>
                )}
              </Alert>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
