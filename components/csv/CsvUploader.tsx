'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
  Sparkles,
  Trash2,
  XCircle,
  Loader2,
  RotateCcw,
  Info,
  Calendar,
  FileText,
  DollarSign,
  Layers,
} from 'lucide-react';
import { DEFAULT_CATEGORIES } from '@/types';
import type { CleanedCsvRow, CsvProcessingResult, CsvSkippedRow } from '@/lib/csv/cleaner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

interface CsvUploaderProps {
  onImportSuccess: (batchId: string, count: number) => void;
}

interface PreviewRow extends CleanedCsvRow {
  selected: boolean;
}

interface ImportBatch {
  batchId: string;
  importedAt: string;
  rowCount: number;
}

type UploadState =
  | { stage: 'idle' }
  | { stage: 'parsing' }
  | { stage: 'preview'; result: CsvProcessingResult; batchId: string; editedRows: PreviewRow[] }
  | { stage: 'committing' }
  | { stage: 'done'; batchId: string; savedCount: number; undoDeadline: number }
  | { stage: 'undoing'; batchId?: string }
  | { stage: 'error'; message: string };

export function CsvUploader({ onImportSuccess }: CsvUploaderProps) {
  const [state, setState] = useState<UploadState>({ stage: 'idle' });
  const [skippedOpen, setSkippedOpen] = useState(false);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const [recentBatches, setRecentBatches] = useState<ImportBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [undoingBatchId, setUndoingBatchId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success: toastSuccess, info: toastInfo, error: toastError } = useToast();

  // Load recent batches on mount (Issue 8: survives refresh, no 60s limit)
  const fetchRecentBatches = useCallback(async () => {
    try {
      setBatchesLoading(true);
      const res = await fetch('/api/csv/batches');
      if (res.ok) {
        const data = await res.json();
        setRecentBatches(data.batches || []);
      }
    } catch {
      // Non-blocking
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentBatches();
  }, [fetchRecentBatches]);

  // Issue 7: Use crypto.randomUUID()
  const generateBatchId = () => crypto.randomUUID();

  const uploadFile = useCallback(async (file: File) => {
    setState({ stage: 'parsing' });
    setSkippedOpen(false);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/csv/import', { method: 'POST', body: formData });
      const data: CsvProcessingResult = await res.json();

      if (!res.ok) {
        setState({ stage: 'error', message: (data as any).error || 'Failed to process file.' });
        return;
      }

      if (!data.success) {
        setState({ stage: 'error', message: data.error || 'No valid rows found.' });
        return;
      }

      const batchId = generateBatchId();
      // Issue 3: By default include non-duplicates; duplicates are flagged with isDuplicate: true and unselected by default
      const previewRows: PreviewRow[] = data.validRows.map((r) => ({
        ...r,
        selected: !r.isDuplicate,
      }));

      setState({
        stage: 'preview',
        result: data,
        batchId,
        editedRows: previewRows,
      });
    } catch {
      setState({ stage: 'error', message: 'Network error. Please check your connection and try again.' });
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleUseSample = async () => {
    try {
      const res = await fetch('/sample-transactions.csv');
      const text = await res.text();
      const file = new File([text], 'sample-transactions.csv', { type: 'text/csv' });
      uploadFile(file);
    } catch {
      setState({ stage: 'error', message: 'Could not load sample data. Please try again.' });
    }
  };

  const toggleRowSelected = (tempId: string) => {
    setState((prev) => {
      if (prev.stage !== 'preview') return prev;
      return {
        ...prev,
        editedRows: prev.editedRows.map((r) => (r.tempId === tempId ? { ...r, selected: !r.selected } : r)),
      };
    });
  };

  const toggleSelectAll = (selectAll: boolean) => {
    setState((prev) => {
      if (prev.stage !== 'preview') return prev;
      return {
        ...prev,
        editedRows: prev.editedRows.map((r) => ({ ...r, selected: selectAll })),
      };
    });
  };

  const updateRowCategory = (tempId: string, category: string) => {
    setState((prev) => {
      if (prev.stage !== 'preview') return prev;
      return {
        ...prev,
        editedRows: prev.editedRows.map((r) => (r.tempId === tempId ? { ...r, category } : r)),
      };
    });
  };

  const removePreviewRow = (tempId: string) => {
    setState((prev) => {
      if (prev.stage !== 'preview') return prev;
      const newRows = prev.editedRows.filter((r) => r.tempId !== tempId);
      if (newRows.length === 0) {
        return { stage: 'idle' };
      }
      return { ...prev, editedRows: newRows };
    });
  };

  const handleCommit = async () => {
    if (state.stage !== 'preview') return;
    const { batchId, editedRows } = state;

    const rowsToCommit = editedRows.filter((r) => r.selected);
    if (rowsToCommit.length === 0) {
      toastError('No rows selected', 'Please select at least one transaction to import.');
      return;
    }

    setState({ stage: 'committing' });

    try {
      const res = await fetch('/api/csv/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: rowsToCommit.map(({ tempId: _t, isDuplicate: _d, selected: _s, ...r }) => r),
          batchId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState({ stage: 'error', message: data.error || 'Failed to save transactions.' });
        return;
      }

      const deadline = Date.now() + 60_000;
      setUndoSecondsLeft(60);

      const timer = setInterval(() => {
        setUndoSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(timer);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      setUndoTimer(timer);

      setState({ stage: 'done', batchId, savedCount: data.savedCount, undoDeadline: deadline });
      onImportSuccess(batchId, data.savedCount);
      toastSuccess(`Imported ${data.savedCount} transactions`, 'Your transactions have been saved.');
      fetchRecentBatches();
    } catch {
      setState({ stage: 'error', message: 'Network error. Please try again.' });
    }
  };

  // Immediate undo from post-import screen
  const handleUndoImmediate = async () => {
    if (state.stage !== 'done') return;
    const { batchId, savedCount } = state;

    if (undoTimer) clearInterval(undoTimer);
    setState({ stage: 'undoing', batchId });

    try {
      const res = await fetch(`/api/csv/undo?batchId=${batchId}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        setState({ stage: 'error', message: data.error || 'Failed to undo import.' });
        return;
      }

      setState({ stage: 'idle' });
      toastInfo('Import Undone', `${savedCount} transactions removed.`);
      onImportSuccess('', 0);
      fetchRecentBatches();
    } catch {
      setState({ stage: 'error', message: 'Network error while undoing. Please try again.' });
    }
  };

  // Issue 8: Persistent Undo from Recent Imports list (survives refresh, no 60s limit)
  const handleUndoBatch = async (batchId: string, rowCount: number) => {
    if (!confirm(`Are you sure you want to remove all ${rowCount} transactions from this import batch?`)) {
      return;
    }

    try {
      setUndoingBatchId(batchId);
      const res = await fetch(`/api/csv/undo?batchId=${batchId}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toastError('Failed to undo import', data.error || 'Please try again.');
        return;
      }

      toastInfo('Import Removed', `${data.deletedCount ?? rowCount} transactions removed.`);
      onImportSuccess('', 0);
      fetchRecentBatches();
    } catch {
      toastError('Network error', 'Could not undo import. Please check your connection.');
    } finally {
      setUndoingBatchId(null);
    }
  };

  const reset = () => {
    if (undoTimer) clearInterval(undoTimer);
    setState({ stage: 'idle' });
    setSkippedOpen(false);
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderIdle = () => (
    <div className="space-y-6">
      {/* Issue 10: Explanation card of required columns and formats */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 text-xs text-indigo-950 space-y-2.5">
        <div className="flex items-center gap-1.5 font-bold text-indigo-900 text-sm">
          <Info className="h-4 w-4 text-indigo-600 flex-shrink-0" />
          <span>CSV File Format Guidelines</span>
        </div>
        <p className="text-indigo-800 leading-relaxed">
          Upload bank statements or expense sheets exported in <strong>.csv</strong> format. Your file must include these 4 columns:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <div className="rounded-lg bg-white/90 p-2.5 border border-indigo-100 shadow-2xs">
            <span className="font-semibold text-indigo-900 block flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              1. Date (Required)
            </span>
            <span className="text-slate-600 mt-0.5 block">
              Format: <code>DD-MM-YYYY</code> (e.g. <code>07-11-2026</code>) or <code>YYYY-MM-DD</code>. Day-first is default.
            </span>
          </div>
          <div className="rounded-lg bg-white/90 p-2.5 border border-indigo-100 shadow-2xs">
            <span className="font-semibold text-indigo-900 block flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              2. Description (Required)
            </span>
            <span className="text-slate-600 mt-0.5 block">
              Merchant or narrative (e.g. &quot;Swiggy Order&quot;). Max 500 characters.
            </span>
          </div>
          <div className="rounded-lg bg-white/90 p-2.5 border border-indigo-100 shadow-2xs">
            <span className="font-semibold text-indigo-900 block flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
              3. Amount (Required)
            </span>
            <span className="text-slate-600 mt-0.5 block">
              Positive number (e.g. <code>35,000</code> or <code>₹1,250.50</code>). Max ₹99,99,999.99. No trailing letters.
            </span>
          </div>
          <div className="rounded-lg bg-white/90 p-2.5 border border-indigo-100 shadow-2xs">
            <span className="font-semibold text-indigo-900 block flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              4. Type (Required)
            </span>
            <span className="text-slate-600 mt-0.5 block">
              <code>Income</code> or <code>Expense</code>. Also recognizes <code>CR</code>/<code>DR</code> and <code>Credit</code>/<code>Debit</code>.
            </span>
          </div>
        </div>
        <p className="text-[11px] text-indigo-700/80 pt-1">
          💡 <em>Duplicates:</em> Multiple identical items in the CSV are preserved. Rows already saved in your database will be flagged as duplicates so you can review and choose whether to include them.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 p-10 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-100/50 transition-colors"
      >
        <Upload className="h-10 w-10 text-indigo-500" />
        <div>
          <p className="font-semibold text-indigo-900">Drag & drop your bank statement CSV here</p>
          <p className="text-xs text-slate-500 mt-1">or click to browse your files — up to 2,000 rows (max 5 MB)</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <a
          href="/sample-transactions.csv"
          download
          className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <Download className="h-4 w-4" />
          Download Sample CSV
        </a>
        <button
          onClick={handleUseSample}
          className="flex items-center gap-2 rounded-xl border border-indigo-300 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors shadow-2xs"
        >
          <Sparkles className="h-4 w-4" />
          Use Sample Data (Instant Preview)
        </button>
      </div>

      {/* Issue 8: Recent Imports List (survives refresh) */}
      {recentBatches.length > 0 && (
        <div className="mt-8 border-t border-slate-200 pt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent Imports ({recentBatches.length})
            </h3>
            <span className="text-[11px] text-slate-500">Undo import at any time</span>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {recentBatches.map((batch) => (
              <div
                key={batch.batchId}
                className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 transition-colors text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {batch.rowCount} Transaction{batch.rowCount !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {batch.batchId.slice(0, 8)}...
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Imported on {formatDate(batch.importedAt)}
                  </span>
                </div>

                <button
                  onClick={() => handleUndoBatch(batch.batchId, batch.rowCount)}
                  disabled={undoingBatchId === batch.batchId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {undoingBatchId === batch.batchId ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Undoing...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Undo Import</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderParsing = () => (
    <div className="flex flex-col items-center gap-4 py-12">
      <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      <p className="text-slate-600 font-medium text-sm">Analysing and validating your CSV…</p>
    </div>
  );

  const renderPreview = () => {
    if (state.stage !== 'preview') return null;
    const { result, editedRows } = state;
    const { summary } = result;
    const previewRows = editedRows.slice(0, 30);
    const selectedCount = editedRows.filter((r) => r.selected).length;
    const allSelected = editedRows.every((r) => r.selected);

    return (
      <div className="space-y-4">
        {/* Summary banner */}
        <SummaryBanner summary={summary} skippedRows={result.skippedRows} />

        {/* Duplicate Selection Info (Issue 3) */}
        {summary.existingDuplicateCount > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>{summary.existingDuplicateCount} row(s)</strong> already exist in your saved transactions. They are unchecked by default to prevent duplicate entry.
              </span>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => toggleSelectAll(true)}
                className="px-2.5 py-1 rounded bg-amber-200/80 hover:bg-amber-300 font-semibold transition-colors"
              >
                Include All
              </button>
              <button
                type="button"
                onClick={() =>
                  setState((prev) =>
                    prev.stage === 'preview'
                      ? { ...prev, editedRows: prev.editedRows.map((r) => ({ ...r, selected: !r.isDuplicate })) }
                      : prev
                  )
                }
                className="px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 font-semibold transition-colors"
              >
                Exclude Duplicates
              </button>
            </div>
          </div>
        )}

        {/* Preview table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Preview ({selectedCount} of {editedRows.length} transactions selected for import)
            </h3>
            <button
              type="button"
              onClick={() => toggleSelectAll(!allSelected)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 text-center w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left">Date</th>
                  <th className="px-3 py-2.5 text-left">Description</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5 text-center">Type</th>
                  <th className="px-3 py-2.5 text-left">Category</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((row) => (
                  <tr
                    key={row.tempId}
                    className={`transition-colors ${
                      row.selected ? 'hover:bg-slate-50/80' : 'bg-slate-50/40 opacity-60'
                    }`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => toggleRowSelected(row.tempId)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatDate(row.date)}</td>
                    <td className="px-3 py-2 max-w-xs truncate font-medium text-slate-900" title={row.description}>
                      {row.description}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          row.type === 'income'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {row.type === 'income' ? 'Income' : 'Expense'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.category}
                        onChange={(e) => updateRowCategory(row.tempId, e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {DEFAULT_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {row.isDuplicate ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          <AlertTriangle className="w-3 h-3" />
                          Duplicate
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                          <CheckCircle className="w-3 h-3" />
                          New
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => removePreviewRow(row.tempId)}
                        title="Remove this row"
                        className="text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editedRows.length > 30 && (
            <p className="text-[11px] text-slate-400 mt-1.5 text-center">
              +{editedRows.length - 30} more valid transactions will be imported.
            </p>
          )}
        </div>

        {/* Skipped rows accordion */}
        {result.skippedRows.length > 0 && (
          <SkippedRowsAccordion
            skippedRows={result.skippedRows}
            open={skippedOpen}
            onToggle={() => setSkippedOpen((o) => !o)}
          />
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 justify-end pt-2">
          <button
            onClick={reset}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCommit}
            disabled={selectedCount === 0}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-50"
          >
            Import {selectedCount} Selected Transaction{selectedCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    );
  };

  const renderCommitting = () => (
    <div className="flex flex-col items-center gap-4 py-12">
      <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      <p className="text-slate-600 font-medium text-sm">Saving transactions to your account…</p>
    </div>
  );

  const renderDone = () => {
    if (state.stage !== 'done') return null;
    const { savedCount } = state;
    const canUndo = undoSecondsLeft > 0;

    return (
      <div className="flex flex-col items-center gap-5 py-10">
        <CheckCircle className="h-14 w-14 text-emerald-500" />
        <div className="text-center">
          <p className="text-lg font-bold text-slate-900">
            {savedCount} transaction{savedCount !== 1 ? 's' : ''} imported successfully!
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Your transactions are now reflected in your records and charts.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canUndo && (
            <button
              onClick={handleUndoImmediate}
              className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo Import ({undoSecondsLeft}s)</span>
            </button>
          )}
          <button
            onClick={reset}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-700 transition-colors"
          >
            Upload Another File
          </button>
        </div>
      </div>
    );
  };

  const renderUndoing = () => (
    <div className="flex flex-col items-center gap-4 py-12">
      <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
      <p className="text-slate-600 font-medium text-sm">Removing imported transactions…</p>
    </div>
  );

  const renderError = () => {
    if (state.stage !== 'error') return null;
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <div className="flex items-start gap-3">
          <XCircle className="h-6 w-6 text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-rose-800">Could not import CSV</p>
            <p className="text-xs text-rose-600 mt-1 leading-relaxed">{state.message}</p>
          </div>
        </div>
        <button
          onClick={reset}
          className="mt-4 rounded-xl border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Import Bank Statement (CSV)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-cleans headers, parses dates and amounts, detects duplicates, and auto-categorizes.
          </p>
        </div>
      </div>

      {state.stage === 'idle' && renderIdle()}
      {state.stage === 'parsing' && renderParsing()}
      {state.stage === 'preview' && renderPreview()}
      {state.stage === 'committing' && renderCommitting()}
      {state.stage === 'done' && renderDone()}
      {state.stage === 'undoing' && renderUndoing()}
      {state.stage === 'error' && renderError()}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryBanner({
  summary,
  skippedRows,
}: {
  summary: CsvProcessingResult['summary'];
  skippedRows: CsvSkippedRow[];
}) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
      <div className="flex flex-wrap gap-4 text-xs font-medium">
        <StatChip label="Valid Rows" value={summary.validCount} color="green" />
        <StatChip label="Skipped" value={summary.skippedCount} color="amber" />
        {summary.existingDuplicateCount > 0 && (
          <StatChip label="Already in DB" value={summary.existingDuplicateCount} color="orange" />
        )}
      </div>
      {skippedRows.length > 0 && (
        <p className="mt-2 text-xs text-indigo-700 flex items-center gap-1.5 font-normal">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{skippedRows.length} row{skippedRows.length !== 1 ? 's' : ''} skipped — expand below to inspect reasons.</span>
        </p>
      )}
    </div>
  );
}

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'green' | 'amber' | 'orange' | 'red';
}) {
  const colorMap = {
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    orange: 'bg-orange-100 text-orange-800',
    red: 'bg-rose-100 text-rose-800',
  };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${colorMap[color]}`}>{value}</span>
      <span className="text-slate-600">{label}</span>
    </span>
  );
}

function SkippedRowsAccordion({
  skippedRows,
  open,
  onToggle,
}: {
  skippedRows: CsvSkippedRow[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold text-amber-900 hover:bg-amber-100/70 transition-colors"
      >
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          {skippedRows.length} Skipped Row{skippedRows.length !== 1 ? 's' : ''} — View details
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="border-t border-amber-200 overflow-x-auto max-h-60">
          <table className="w-full text-xs">
            <thead className="bg-amber-100/70 text-amber-800">
              <tr>
                <th className="px-3 py-2 text-left">Row #</th>
                <th className="px-3 py-2 text-left">Reason for skipping</th>
                <th className="px-3 py-2 text-left">Raw data snippet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {skippedRows.map((row) => (
                <tr key={row.rowIndex} className="bg-white">
                  <td className="px-3 py-2 font-mono text-slate-500">{row.rowIndex}</td>
                  <td className="px-3 py-2 font-medium text-amber-900">{row.reason}</td>
                  <td className="px-3 py-2 text-slate-400 font-mono truncate max-w-xs">
                    {Object.values(row.raw).join(' | ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
