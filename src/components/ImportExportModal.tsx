import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';
import { DrugFormValues, DrugItem, ImportMode } from '../types/drug';
import {
  applyDrugImport,
  exportDrugsToCsv,
  exportDrugsToJson,
  parseImportedDrugs,
  triggerFileDownload,
} from '../utils/csvJson';

interface ImportExportModalProps {
  isOpen: boolean;
  drugs: DrugItem[];
  onClose: () => void;
  onApplyImport: (nextDrugs: DrugItem[], summaryText: string) => void;
  onExportSuccess: (message: string) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  drugs,
  onClose,
  onApplyImport,
  onExportSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<DrugFormValues[] | null>(null);
  const [parseError, setParseError] = useState<string>('');

  const previewSummary = useMemo(() => {
    if (!parsedRows) return null;
    return applyDrugImport(drugs, parsedRows, importMode);
  }, [drugs, importMode, parsedRows]);

  if (!isOpen) return null;

  const handleExportCsv = () => {
    const csv = exportDrugsToCsv(drugs);
    const stamp = new Date().toISOString().slice(0, 10);
    triggerFileDownload(csv, `drugsite_${stamp}.csv`, 'text/csv;charset=utf-8;');
    onExportSuccess(`已匯出 ${drugs.length} 筆藥品至 UTF-8 BOM CSV`);
  };

  const handleExportJson = () => {
    const json = exportDrugsToJson(drugs);
    const stamp = new Date().toISOString().slice(0, 10);
    triggerFileDownload(json, `drugsite_${stamp}.json`, 'application/json;charset=utf-8;');
    onExportSuccess(`已匯出 ${drugs.length} 筆藥品至 JSON`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError('');
    setParsedRows(null);

    try {
      const content = await file.text();
      const rows = parseImportedDrugs(content, file.name);
      setParsedRows(rows);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : '檔案解析失敗，請確認格式');
    }
  };

  const handleConfirmImport = () => {
    if (!previewSummary) return;
    const label =
      importMode === 'merge'
        ? `合併匯入完成：新增 ${previewSummary.addedCount} 筆、更新 ${previewSummary.updatedCount} 筆`
        : `覆蓋匯入完成：共載入 ${previewSummary.addedCount} 筆藥品`;
    onApplyImport(
      previewSummary.nextDrugs,
      previewSummary.skippedCount > 0 ? `${label}（略過 ${previewSummary.skippedCount} 筆重複條碼）` : label
    );
    setParsedRows(null);
    setFileName('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="整份資料匯入與匯出"
    >
      <div className="w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">資料匯入 / 匯出</h2>
            <p className="text-xs text-slate-500">
              支援 Excel 相容 UTF-8 BOM CSV 與 JSON 雙格式備份還原
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="關閉匯入匯出視窗"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Tabs */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className={`min-h-[40px] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'export'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Download className="w-4 h-4" />
              匯出目前資料
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className={`min-h-[40px] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'import'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-4 h-4" />
              匯入檔案
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {activeTab === 'export' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                目前本機共有{' '}
                <span className="font-mono-tabular font-bold text-slate-900">{drugs.length}</span>{' '}
                筆藥品資料，可匯出為試算表或系統備份檔。
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={drugs.length === 0}
                  className="p-4 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 text-left transition-colors disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-6 h-6 text-teal-700 mb-2" />
                  <p className="text-sm font-bold text-slate-900">匯出 CSV 表格</p>
                  <p className="text-xs text-slate-500 mt-1">
                    UTF-8 BOM 編碼，Windows Excel 直接開啟中文不亂碼
                  </p>
                </button>

                <button
                  type="button"
                  onClick={handleExportJson}
                  disabled={drugs.length === 0}
                  className="p-4 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 text-left transition-colors disabled:opacity-50"
                >
                  <FileJson className="w-6 h-6 text-slate-800 mb-2" />
                  <p className="text-sm font-bold text-slate-900">匯出 JSON 備份</p>
                  <p className="text-xs text-slate-500 mt-1">
                    保留完整欄位鍵值，適合跨裝置還原或系統移轉
                  </p>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mode Selector */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">匯入更新模式</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      importMode === 'merge'
                        ? 'border-teal-600 bg-teal-50/70'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-900">合併更新 (Merge)</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      依條碼或批價碼更新既有品項，新藥品則自動加入
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      importMode === 'replace'
                        ? 'border-amber-600 bg-amber-50/70'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-900">完全覆蓋 (Replace)</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      清空目前本機資料，完全改用匯入檔案內容
                    </p>
                  </button>
                </div>
              </div>

              {/* File Input */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  onChange={(e) => void handleFileChange(e)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 px-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-teal-600 hover:bg-slate-50 flex flex-col items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-6 h-6 text-teal-700" />
                  <span className="text-sm font-semibold text-slate-800">
                    {fileName ? `已選擇：${fileName}` : '點擊選擇 .csv 或 .json 藥品檔案'}
                  </span>
                  <span className="text-xs text-slate-500">
                    標題支援：批價碼, 藥名, 物編, 條碼, 儲位, 價格（或英文欄位名）
                  </span>
                </button>
              </div>

              {parseError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}

              {parsedRows && previewSummary && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <CheckCircle2 className="w-4 h-4 text-teal-700" />
                    <span>
                      解析成功：共{' '}
                      <span className="font-mono-tabular">{parsedRows.length}</span> 筆有效資料
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-mono-tabular">
                    <span>新增：{previewSummary.addedCount} 筆</span>
                    <span>更新：{previewSummary.updatedCount} 筆</span>
                    {previewSummary.skippedCount > 0 && (
                      <span className="text-amber-700">
                        略過重複條碼：{previewSummary.skippedCount} 筆
                      </span>
                    )}
                  </div>

                  <div className="border-t border-slate-200 pt-2.5 space-y-1">
                    {parsedRows.slice(0, 3).map((row, idx) => (
                      <div key={idx} className="text-xs text-slate-600 truncate">
                        <span className="font-mono-tabular font-bold text-slate-900 mr-2">
                          [{row.location || '無儲位'}]
                        </span>
                        <span>{row.drugName || row.chargeCode}</span>
                      </div>
                    ))}
                    {parsedRows.length > 3 && (
                      <p className="text-[11px] text-slate-400">
                        尚有其餘 {parsedRows.length - 3} 筆資料...
                      </p>
                    )}
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      className="min-h-[44px] px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold transition-colors"
                    >
                      確認執行匯入
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
