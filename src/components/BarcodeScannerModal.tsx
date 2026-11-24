import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, Check, Keyboard, RefreshCw, ScanBarcode, Sparkles, X } from 'lucide-react';
import { DrugItem } from '../types/drug';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
  sampleDrugs: DrugItem[];
  title?: string;
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
];

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
  sampleDrugs,
  title = '掃描藥盒條碼',
}) => {
  const readerDomId = useId().replace(/:/g, '') + '-qr-reader';
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledScanRef = useRef(false);

  const [cameraStatus, setCameraStatus] = useState<'starting' | 'active' | 'unavailable'>('starting');
  const [cameraError, setCameraError] = useState<string>('');
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [nativeSupport] = useState<boolean>(
    () => typeof window !== 'undefined' && 'BarcodeDetector' in window
  );

  const stopCamera = useCallback(async () => {
    const instance = scannerRef.current;
    scannerRef.current = null;
    if (instance) {
      try {
        if (instance.isScanning) {
          await instance.stop();
        }
      } catch {
        // Ignore stop errors if already stopped
      }
      try {
        instance.clear();
      } catch {
        // Ignore DOM cleanup errors
      }
    }
  }, []);

  const handleScanHit = useCallback(
    async (rawText: string) => {
      if (handledScanRef.current) return;
      const clean = rawText.trim();
      if (!clean) return;
      handledScanRef.current = true;
      await stopCamera();
      onDetected(clean);
    },
    [onDetected, stopCamera]
  );

  const startCamera = useCallback(
    async (preferredCameraId?: string) => {
      await stopCamera();
      setCameraStatus('starting');
      setCameraError('');

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('unavailable');
        setCameraError('此瀏覽器或目前環境未開放鏡頭裝置存取，請使用下方手動輸入或模擬掃碼。');
        return;
      }

      try {
        const detectedCameras = await Html5Qrcode.getCameras();
        if (!detectedCameras || detectedCameras.length === 0) {
          setCameraStatus('unavailable');
          setCameraError('未偵測到可用攝影機鏡頭，您可直接使用手動條碼輸入或一鍵模擬掃碼。');
          return;
        }

        setCameras(detectedCameras);
        const rearCamera =
          detectedCameras.find((c) => /back|rear|environment|後/i.test(c.label)) ||
          detectedCameras[detectedCameras.length - 1];
        const targetId = preferredCameraId || rearCamera.id;
        setSelectedCameraId(targetId);

        const qr = new Html5Qrcode(readerDomId, {
          formatsToSupport: SUPPORTED_FORMATS,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
          verbose: false,
        });
        scannerRef.current = qr;

        await qr.start(
          targetId,
          {
            fps: 12,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const width = Math.min(Math.floor(viewfinderWidth * 0.82), 340);
              const height = Math.min(Math.floor(viewfinderHeight * 0.52), 170);
              return { width: Math.max(width, 200), height: Math.max(height, 110) };
            },
            aspectRatio: 1.5,
          },
          (decodedText) => {
            void handleScanHit(decodedText);
          },
          () => {
            // Frame scan miss is normal; suppress noise
          }
        );

        setCameraStatus('active');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setCameraStatus('unavailable');
        if (/Permission|NotAllowed|denied/i.test(message)) {
          setCameraError('鏡頭權限未允許。請於瀏覽器網址列允許相機存取，或使用下方備援掃碼方式。');
        } else {
          setCameraError('無法啟動相機鏡頭（可能無硬體鏡頭或正被其他程式佔用），請使用下方備援掃碼。');
        }
      }
    },
    [handleScanHit, readerDomId, stopCamera]
  );

  useEffect(() => {
    if (!isOpen) {
      void stopCamera();
      return;
    }

    handledScanRef.current = false;
    setManualBarcode('');
    const timer = window.setTimeout(() => {
      void startCamera();
    }, 60);

    return () => {
      window.clearTimeout(timer);
      void stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBarcode.trim()) return;
    void handleScanHit(manualBarcode);
  };

  const triggerSimulatedScan = (targetBarcode?: string) => {
    if (targetBarcode) {
      void handleScanHit(targetBarcode);
      return;
    }
    const candidates = sampleDrugs.filter((d) => d.barcode.trim().length > 0);
    const chosen =
      candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)].barcode
        : '4711934355895';
    void handleScanHit(chosen);
  };

  const quickTestDrugs = sampleDrugs.filter((d) => d.barcode).slice(0, 3);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <ScanBarcode className="w-5 h-5 text-teal-700 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500">
                支援 EAN-13 / Code128 藥盒條碼{nativeSupport ? ' · 已啟用瀏覽器原生高速辨識' : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void stopCamera();
              onClose();
            }}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="關閉掃描視窗"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Camera viewport */}
          <div className="relative rounded-xl bg-slate-900 overflow-hidden border border-slate-800 min-h-[240px] flex flex-col items-center justify-center">
            <div id={readerDomId} className="w-full h-full min-h-[240px]" />

            {cameraStatus === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 text-slate-200 gap-2 p-6 text-center">
                <Camera className="w-8 h-8 text-teal-400 animate-pulse" />
                <p className="text-sm font-medium">正在啟動攝影機鏡頭...</p>
              </div>
            )}

            {cameraStatus === 'unavailable' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-200 gap-3 p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center">
                  <CameraOff className="w-6 h-6 text-amber-400" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <p className="text-sm font-semibold text-white">無鏡頭或權限未開啟</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{cameraError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void startCamera(selectedCameraId || undefined)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors min-h-[40px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  重新偵測鏡頭
                </button>
              </div>
            )}

            {cameraStatus === 'active' && (
              <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                <span className="text-[11px] font-medium text-white bg-slate-950/75 px-2.5 py-1 rounded-md">
                  將藥盒條碼對準中央掃描框
                </span>
                {cameras.length > 1 && (
                  <select
                    value={selectedCameraId}
                    onChange={(e) => void startCamera(e.target.value)}
                    className="pointer-events-auto text-xs bg-slate-950/85 text-white border border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    aria-label="切換鏡頭"
                  >
                    {cameras.map((cam, index) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label || `鏡頭 ${index + 1}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Fallback 1: Manual Barcode Entry */}
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label
              htmlFor="manual-barcode-input"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
            >
              <Keyboard className="w-4 h-4 text-slate-500" />
              手動條碼輸入 / 實體條碼槍掃入
            </label>
            <div className="flex gap-2">
              <input
                id="manual-barcode-input"
                type="text"
                inputMode="numeric"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder="輸入或掃入條碼，例如 4711934355895"
                className="flex-1 min-h-[44px] px-3.5 py-2 text-sm font-mono-tabular bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
              />
              <button
                type="submit"
                disabled={!manualBarcode.trim()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Check className="w-4 h-4" />
                確認查詢
              </button>
            </div>
          </form>

          {/* Fallback 2: Simulated Scan Testing */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-800">無鏡頭測試備援</p>
                <p className="text-xs text-slate-500">
                  一鍵模擬藥盒條碼掃描，立即驗證儲位指引視窗
                </p>
              </div>
              <button
                type="button"
                onClick={() => triggerSimulatedScan()}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                一鍵模擬掃碼測試
              </button>
            </div>

            {quickTestDrugs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {quickTestDrugs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => triggerSimulatedScan(item.barcode)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 text-left transition-colors"
                  >
                    <span className="block text-xs font-semibold text-slate-800 truncate max-w-[170px]">
                      {item.chargeCode || item.drugName}
                    </span>
                    <span className="block text-[11px] font-mono-tabular text-slate-500">
                      {item.barcode} · {item.location}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => triggerSimulatedScan('4719999000001')}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-dashed border-slate-300 bg-white hover:bg-amber-50 hover:border-amber-300 text-left transition-colors"
                >
                  <span className="block text-xs font-semibold text-amber-800">測試未建檔條碼</span>
                  <span className="block text-[11px] font-mono-tabular text-slate-500">
                    4719999000001
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
