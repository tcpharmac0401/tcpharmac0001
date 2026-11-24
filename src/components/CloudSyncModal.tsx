import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Cloud,
  CloudDownload,
  CloudUpload,
  Code2,
  Copy,
  X,
} from 'lucide-react';
import { DrugItem, GAS_TEMPLATE_CODE, ImportMode, SyncConfig } from '../types/drug';
import { applyDrugImport, mapRawRecordToDrugValues } from '../utils/csvJson';

interface CloudSyncModalProps {
  isOpen: boolean;
  syncConfig: SyncConfig;
  drugs: DrugItem[];
  onClose: () => void;
  onSaveConfig: (config: SyncConfig) => void;
  onPullComplete: (nextDrugs: DrugItem[], message: string, syncedAt: string) => void;
  onPushComplete: (message: string, syncedAt: string) => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  syncConfig,
  drugs,
  onClose,
  onSaveConfig,
  onPullComplete,
  onPushComplete,
}) => {
  const [urlInput, setUrlInput] = useState(syncConfig.gasUrl);
  const [pullMode, setPullMode] = useState<ImportMode>('merge');
  const [busyAction, setBusyAction] = useState<'pull' | 'push' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUrlInput(syncConfig.gasUrl);
      setFeedback(null);
    }
  }, [isOpen, syncConfig.gasUrl]);

  if (!isOpen) return null;

  const trimmedUrl = urlInput.trim();
  const isValidGasUrl = /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/i.test(trimmedUrl) || /^https?:\/\//i.test(trimmedUrl);

  const handleSaveUrl = () => {
    onSaveConfig({
      ...syncConfig,
      gasUrl: trimmedUrl,
    });
    setFeedback({ type: 'ok', text: '已儲存 Google Apps Script Web App 網址' });
  };

  const handlePull = async () => {
    if (!trimmedUrl) {
      setFeedback({ type: 'err', text: '請先輸入 Google Apps Script Web App 網址' });
      return;
    }

    setBusyAction('pull');
    setFeedback(null);

    try {
      const response = await fetch(trimmedUrl, {
        method: 'GET',
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();
      const rawList: unknown[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.drugs)
            ? json.drugs
            : [];

      const mapped = rawList
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map(mapRawRecordToDrugValues)
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const summary = applyDrugImport(drugs, mapped, pullMode);
      const now = new Date().toISOString();
      onSaveConfig({ gasUrl: trimmedUrl, lastSyncedAt: now });

      const msg =
        pullMode === 'merge'
          ? `雲端拉取合併完成：新增 ${summary.addedCount} 筆、更新 ${summary.updatedCount} 筆`
          : `雲端覆蓋本機完成：共載入 ${summary.addedCount} 筆藥品`;

      onPullComplete(summary.nextDrugs, msg, now);
      setFeedback({ type: 'ok', text: msg });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: `拉取失敗：${err instanceof Error ? err.message : '無法連線至 GAS Web App，請確認部署權限為「所有人」'}`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handlePush = async () => {
    if (!trimmedUrl) {
      setFeedback({ type: 'err', text: '請先輸入 Google Apps Script Web App 網址' });
      return;
    }

    setBusyAction('push');
    setFeedback(null);

    try {
      const payload = {
        action: 'replaceAll',
        sheet: '工作表1',
        data: drugs.map((d) => ({
          chargeCode: d.chargeCode,
          drugName: d.drugName,
          itemCode: d.itemCode,
          barcode: d.barcode,
          location: d.location,
          price: d.price ?? '',
        })),
      };

      // Use text/plain to send a CORS-simple POST request directly to Google Apps Script
      const response = await fetch(trimmedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json().catch(() => ({ status: 'ok' }));
      if (result?.status === 'error') {
        throw new Error(result.message || '試算表寫入錯誤');
      }

      const now = new Date().toISOString();
      onSaveConfig({ gasUrl: trimmedUrl, lastSyncedAt: now });
      const msg = `已成功推送 ${drugs.length} 筆藥品至 drugsite 雲端試算表`;
      onPushComplete(msg, now);
      setFeedback({ type: 'ok', text: msg });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: `推送失敗：${err instanceof Error ? err.message : '無法寫入 GAS Web App，請檢查網址與部署設定'}`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(GAS_TEMPLATE_CODE);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Google Apps Script 雲端試算表同步"
    >
      <div className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-teal-700" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Google Apps Script 試算表雙向同步
              </h2>
              <p className="text-xs text-slate-500">
                對應試算表「drugsite / 工作表1」 · 同步跨裝置藥局儲位資料
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="關閉雲端同步視窗"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Web App URL */}
          <div className="space-y-2">
            <label htmlFor="gas-url-input" className="block text-xs font-semibold text-slate-700">
              GAS Web App API 網址
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="gas-url-input"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="flex-1 min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-mono-tabular bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
              />
              <button
                type="button"
                onClick={handleSaveUrl}
                disabled={!trimmedUrl}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                儲存網址
              </button>
            </div>
            {syncConfig.lastSyncedAt && (
              <p className="text-xs text-slate-500 font-mono-tabular">
                上次同步時間：{new Date(syncConfig.lastSyncedAt).toLocaleString('zh-TW')}
              </p>
            )}
          </div>

          {/* Pull Mode + Sync Actions */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">從雲端拉取時的本機處理方式</span>
              <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPullMode('merge')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    pullMode === 'merge'
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  合併更新
                </button>
                <button
                  type="button"
                  onClick={() => setPullMode('replace')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    pullMode === 'replace'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  雲端覆蓋本機
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void handlePull()}
                disabled={busyAction !== null || !isValidGasUrl}
                className="min-h-[46px] px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:border-teal-600 hover:bg-teal-50/40 disabled:opacity-50 text-slate-900 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <CloudDownload className="w-4 h-4 text-teal-700" />
                {busyAction === 'pull' ? '正在拉取試算表...' : '從試算表拉取 (Pull)'}
              </button>

              <button
                type="button"
                onClick={() => void handlePush()}
                disabled={busyAction !== null || !isValidGasUrl}
                className="min-h-[46px] px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <CloudUpload className="w-4 h-4" />
                {busyAction === 'push'
                  ? '正在推送至雲端...'
                  : `推送本機 ${drugs.length} 筆至試算表 (Push)`}
              </button>
            </div>
          </div>

          {feedback && (
            <div
              className={`rounded-xl border p-3.5 flex items-start gap-2 text-xs leading-relaxed ${
                feedback.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
              role="status"
            >
              {feedback.type === 'ok' ? (
                <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* GAS Setup Guide & Template */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowTemplate((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                <Code2 className="w-4 h-4" />
                {showTemplate ? '隱藏試算表 Apps Script (Code.gs) 範本' : '查看試算表 Apps Script (Code.gs) 部署範本'}
              </button>

              {showTemplate && (
                <button
                  type="button"
                  onClick={() => void handleCopyCode()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode ? '已複製程式碼' : '複製 Code.gs'}
                </button>
              )}
            </div>

            {showTemplate && (
              <div className="space-y-2">
                <ol className="text-xs text-slate-600 list-decimal list-inside space-y-1">
                  <li>開啟您的 Google 試算表「drugsite」，確認工作表名稱為「工作表1」。</li>
                  <li>點選上方選單「擴充功能」&gt;「Apps Script」，將下方程式碼完整貼上並儲存。</li>
                  <li>點選「部署」&gt;「新增部署作業」&gt; 類型選「網頁應用程式」，存取權限設為「所有人」，複製產生的 URL 貼回上方即可雙向同步。</li>
                </ol>
                <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono-tabular overflow-x-auto max-h-60 leading-relaxed">
                  {GAS_TEMPLATE_CODE}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
