import React, { useEffect, useMemo, useState } from 'react';
import { AlertOctagon, Check, ScanBarcode, X } from 'lucide-react';
import { DrugFormValues, DrugItem } from '../types/drug';
import { findDuplicateByBarcode, normalizeBarcode } from '../utils/storage';

interface DrugFormModalProps {
  isOpen: boolean;
  editingDrug: DrugItem | null;
  prefillBarcode?: string;
  existingDrugs: DrugItem[];
  onClose: () => void;
  onSave: (values: DrugFormValues, existingId?: string) => void;
  onRequestBarcodeScan: (currentValues: DrugFormValues) => void;
  draftOverride?: DrugFormValues | null;
}

const EMPTY_VALUES: DrugFormValues = {
  chargeCode: '',
  drugName: '',
  itemCode: '',
  barcode: '',
  location: '',
  price: '',
};

export const DrugFormModal: React.FC<DrugFormModalProps> = ({
  isOpen,
  editingDrug,
  prefillBarcode = '',
  existingDrugs,
  onClose,
  onSave,
  onRequestBarcodeScan,
  draftOverride,
}) => {
  const [form, setForm] = useState<DrugFormValues>(EMPTY_VALUES);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSubmitAttempted(false);
    if (draftOverride) {
      setForm(draftOverride);
    } else if (editingDrug) {
      setForm({
        chargeCode: editingDrug.chargeCode,
        drugName: editingDrug.drugName,
        itemCode: editingDrug.itemCode,
        barcode: editingDrug.barcode,
        location: editingDrug.location,
        price: editingDrug.price ?? '',
      });
    } else {
      setForm({
        ...EMPTY_VALUES,
        barcode: prefillBarcode,
      });
    }
  }, [draftOverride, editingDrug, isOpen, prefillBarcode]);

  const duplicateDrug = useMemo(() => {
    if (!form.barcode.trim()) return undefined;
    return findDuplicateByBarcode(existingDrugs, form.barcode, editingDrug?.id);
  }, [editingDrug?.id, existingDrugs, form.barcode]);

  const missingRequired =
    !form.drugName.trim() || !form.location.trim() || !form.chargeCode.trim();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    if (missingRequired || duplicateDrug) {
      return;
    }

    onSave(
      {
        chargeCode: form.chargeCode.trim().toUpperCase(),
        drugName: form.drugName.trim(),
        itemCode: form.itemCode.trim().toUpperCase(),
        barcode: normalizeBarcode(form.barcode),
        location: form.location.trim().toUpperCase(),
        price: form.price ? form.price.trim() : '',
      },
      editingDrug?.id
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editingDrug ? '編輯藥品資料' : '新增藥品資料'}
    >
      <div className="w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {editingDrug ? '編輯藥品資料' : '新增藥品資料'}
            </h2>
            <p className="text-xs text-slate-500">
              對應試算表欄位：批價碼、藥名、物編、條碼、儲位、價格
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="關閉表單"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Drug Name */}
          <div>
            <label htmlFor="drug-name-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
              藥名 / 規格 <span className="text-red-600">*</span>
            </label>
            <input
              id="drug-name-input"
              type="text"
              required
              value={form.drugName}
              onChange={(e) => setForm((prev) => ({ ...prev, drugName: e.target.value }))}
              placeholder="例如 Adapalene Gel 0.1% 15gm/tube(Adapalene)"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
            />
            {submitAttempted && !form.drugName.trim() && (
              <p className="mt-1 text-xs text-red-600">請輸入藥品名稱</p>
            )}
          </div>

          {/* Location + Charge Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="drug-location-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                調劑儲位 <span className="text-red-600">*</span>
              </label>
              <input
                id="drug-location-input"
                type="text"
                required
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value.toUpperCase() }))}
                placeholder="例如 D44"
                className="w-full min-h-[44px] px-3.5 py-2 text-base font-bold font-mono-tabular uppercase bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
              />
              {submitAttempted && !form.location.trim() && (
                <p className="mt-1 text-xs text-red-600">請輸入藥櫃儲位</p>
              )}
            </div>

            <div>
              <label htmlFor="drug-charge-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                批價碼 <span className="text-red-600">*</span>
              </label>
              <input
                id="drug-charge-input"
                type="text"
                required
                value={form.chargeCode}
                onChange={(e) => setForm((prev) => ({ ...prev, chargeCode: e.target.value.toUpperCase() }))}
                placeholder="例如 EADAP"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-semibold font-mono-tabular uppercase bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
              />
              {submitAttempted && !form.chargeCode.trim() && (
                <p className="mt-1 text-xs text-red-600">請輸入批價碼</p>
              )}
            </div>
          </div>

          {/* Barcode with Live Duplicate Guard + Inline Scan */}
          <div>
            <label htmlFor="drug-barcode-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
              藥盒條碼 (防重複偵測)
            </label>
            <div className="flex gap-2">
              <input
                id="drug-barcode-input"
                type="text"
                inputMode="numeric"
                value={form.barcode}
                onChange={(e) => setForm((prev) => ({ ...prev, barcode: e.target.value }))}
                placeholder="例如 4711934355895"
                className={`flex-1 min-h-[44px] px-3.5 py-2 text-sm font-mono-tabular rounded-xl border text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  duplicateDrug
                    ? 'bg-red-50 border-red-400 focus:ring-red-500 focus:border-red-500'
                    : 'bg-white border-slate-300 focus:ring-teal-600 focus:border-teal-600'
                }`}
              />
              <button
                type="button"
                onClick={() => onRequestBarcodeScan(form)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                title="使用鏡頭掃描帶入條碼"
              >
                <ScanBarcode className="w-4 h-4 text-teal-700" />
                掃碼填入
              </button>
            </div>

            {duplicateDrug && (
              <div
                className="mt-2 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 flex items-start gap-2"
                role="alert"
              >
                <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs text-red-800 leading-relaxed">
                  <span className="font-bold">條碼重複，已阻擋建檔：</span>
                  條碼 <span className="font-mono-tabular font-semibold">{duplicateDrug.barcode}</span>{' '}
                  已存在於「{duplicateDrug.drugName}」（儲位{' '}
                  <span className="font-mono-tabular font-bold">{duplicateDrug.location}</span>）。
                </div>
              </div>
            )}
          </div>

          {/* Item Code + Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="drug-itemcode-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                物編
              </label>
              <input
                id="drug-itemcode-input"
                type="text"
                value={form.itemCode}
                onChange={(e) => setForm((prev) => ({ ...prev, itemCode: e.target.value.toUpperCase() }))}
                placeholder="例如 7EADAPA015"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono-tabular uppercase bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
              />
            </div>

            <div>
              <label htmlFor="drug-price-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                價格 (選填)
              </label>
              <input
                id="drug-price-input"
                type="text"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="例如 120"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono-tabular bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={Boolean(duplicateDrug)}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:bg-red-200 disabled:text-red-700 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              {duplicateDrug ? '條碼重複無法儲存' : editingDrug ? '儲存更新' : '確認新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
