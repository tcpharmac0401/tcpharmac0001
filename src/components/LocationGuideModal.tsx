import React from 'react';
import { AlertCircle, Edit3, MapPin, Plus, ScanBarcode, X } from 'lucide-react';
import { DrugItem } from '../types/drug';

interface LocationGuideModalProps {
  isOpen: boolean;
  scannedBarcode: string;
  matchedDrug: DrugItem | null;
  onClose: () => void;
  onScanAgain: () => void;
  onEditDrug: (drug: DrugItem) => void;
  onCreateWithBarcode: (barcode: string) => void;
}

export const LocationGuideModal: React.FC<LocationGuideModalProps> = ({
  isOpen,
  scannedBarcode,
  matchedDrug,
  onClose,
  onScanAgain,
  onEditDrug,
  onCreateWithBarcode,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label={matchedDrug ? '藥品儲位快速指引' : '查無對應條碼'}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            {matchedDrug ? (
              <MapPin className="w-5 h-5 text-teal-700" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600" />
            )}
            <h2 className="text-base font-bold text-slate-900">
              {matchedDrug ? '條碼定位命中 · 儲位指引' : '查無對應藥品條碼'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="關閉儲位指引"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {matchedDrug ? (
          <div className="p-6 space-y-6">
            {/* Oversized Location Focal Block */}
            <div className="rounded-2xl bg-slate-900 text-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-teal-300 tracking-wide">調劑台藥櫃儲位</p>
                <p className="text-sm text-slate-300 mt-1">請前往對應儲格取藥</p>
              </div>
              <div className="font-mono-tabular text-5xl sm:text-6xl font-extrabold tracking-tight text-white bg-teal-600 px-5 py-3 rounded-xl text-center min-w-[132px]">
                {matchedDrug.location || '未設'}
              </div>
            </div>

            {/* Drug Title */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">藥名與規格</p>
              <h3 className="text-xl font-bold text-slate-900 leading-snug">
                {matchedDrug.drugName}
              </h3>
            </div>

            {/* Structured Specs Grid */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div>
                <p className="text-xs text-slate-500">批價碼</p>
                <p className="text-sm font-semibold font-mono-tabular text-slate-900 mt-0.5">
                  {matchedDrug.chargeCode || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">物編</p>
                <p className="text-sm font-semibold font-mono-tabular text-slate-900 mt-0.5">
                  {matchedDrug.itemCode || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">國際條碼</p>
                <p className="text-sm font-semibold font-mono-tabular text-slate-900 mt-0.5">
                  {matchedDrug.barcode || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">參考單價</p>
                <p className="text-sm font-semibold font-mono-tabular text-slate-900 mt-0.5">
                  {matchedDrug.price ? `NT$ ${matchedDrug.price}` : '—'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onEditDrug(matchedDrug)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                編輯明細
              </button>
              <button
                type="button"
                onClick={onScanAgain}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <ScanBarcode className="w-4 h-4" />
                繼續掃描
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-1.5">
              <p className="text-sm font-semibold text-amber-900">
                本機藥品資料庫中尚無此條碼記錄
              </p>
              <p className="text-xs text-amber-800">
                掃描條碼：
                <span className="font-mono-tabular font-bold text-slate-900 ml-1">
                  {scannedBarcode}
                </span>
              </p>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              您可以直接將此條碼帶入新增藥品表單建立儲位檔案，或重新掃描其他藥盒條碼。
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onScanAgain}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <ScanBarcode className="w-4 h-4" />
                重新掃描
              </button>
              <button
                type="button"
                onClick={() => onCreateWithBarcode(scannedBarcode)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                以此條碼新增藥品
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
