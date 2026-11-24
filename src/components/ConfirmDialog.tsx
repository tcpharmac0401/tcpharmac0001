import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  destructive = true,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`w-5 h-5 ${destructive ? 'text-red-600' : 'text-amber-600'}`}
            />
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="取消"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-white text-sm font-semibold transition-colors ${
                destructive
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-teal-700 hover:bg-teal-800'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
