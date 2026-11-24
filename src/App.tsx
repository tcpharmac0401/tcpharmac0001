import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Download,
  Edit3,
  LayoutGrid,
  MapPin,
  Maximize2,
  Plus,
  RotateCcw,
  ScanBarcode,
  Search,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { DrugFormModal } from './components/DrugFormModal';
import { ImportExportModal } from './components/ImportExportModal';
import { LocationGuideModal } from './components/LocationGuideModal';
import {
  DrugFormValues,
  DrugItem,
  SEED_DRUGS,
  SearchMode,
  SyncConfig,
  ToastNotice,
  ViewLayout,
} from './types/drug';
import {
  createDrugRecord,
  filterDrugs,
  findDuplicateByBarcode,
  getLocationSummary,
  loadDrugsFromStorage,
  loadSyncConfig,
  normalizeBarcode,
  saveDrugsToStorage,
  saveSyncConfig,
} from './utils/storage';

export default function App() {
  const [drugs, setDrugs] = useState<DrugItem[]>(() => loadDrugsFromStorage());
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => loadSyncConfig());

  const [searchMode, setSearchMode] = useState<SearchMode>('keyword');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewLayout, setViewLayout] = useState<ViewLayout>('cards');

  // Scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerPurpose, setScannerPurpose] = useState<'lookup' | 'fill-field'>('lookup');

  // Location guide modal state
  const [guideOpen, setGuideOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [guideDrug, setGuideDrug] = useState<DrugItem | null>(null);

  // Add/Edit form modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingDrug, setEditingDrug] = useState<DrugItem | null>(null);
  const [prefillBarcode, setPrefillBarcode] = useState('');
  const [formDraft, setFormDraft] = useState<DrugFormValues | null>(null);

  // Import/Export & Cloud Sync modals
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [cloudSyncOpen, setCloudSyncOpen] = useState(false);

  // Confirmations
  const [deletingDrug, setDeletingDrug] = useState<DrugItem | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((type: ToastNotice['type'], message: string) => {
    const id = String(Date.now());
    setToast({ id, type, message });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 3600);
  }, []);

  // Persist drugs immediately to localStorage
  useEffect(() => {
    saveDrugsToStorage(drugs);
  }, [drugs]);

  // Keyboard shortcut `/` to focus search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        !scannerOpen &&
        !formOpen &&
        !importExportOpen &&
        !cloudSyncOpen
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cloudSyncOpen, formOpen, importExportOpen, scannerOpen]);

  const filteredDrugs = useMemo(
    () => filterDrugs(drugs, searchQuery, searchMode),
    [drugs, searchMode, searchQuery]
  );

  const locationSummary = useMemo(() => getLocationSummary(drugs), [drugs]);

  // Handlers
  const openLookupScanner = () => {
    setScannerPurpose('lookup');
    setScannerOpen(true);
  };

  const openAddModal = (barcodePrefill = '') => {
    setEditingDrug(null);
    setPrefillBarcode(barcodePrefill);
    setFormDraft(null);
    setFormOpen(true);
  };

  const openEditModal = (drug: DrugItem) => {
    setGuideOpen(false);
    setEditingDrug(drug);
    setPrefillBarcode('');
    setFormDraft(null);
    setFormOpen(true);
  };

  const handleBarcodeDetected = (rawCode: string) => {
    const clean = normalizeBarcode(rawCode);
    setScannerOpen(false);

    if (scannerPurpose === 'fill-field') {
      setFormDraft((prev) =>
        prev
          ? { ...prev, barcode: clean }
          : {
              chargeCode: '',
              drugName: '',
              itemCode: '',
              barcode: clean,
              location: '',
              price: '',
            }
      );
      setFormOpen(true);
      return;
    }

    // Lookup mode: check exact barcode match
    const match = findDuplicateByBarcode(drugs, clean);
    setScannedBarcode(clean);
    setGuideDrug(match ?? null);
    setGuideOpen(true);
  };

  const handleRequestInlineScan = (currentValues: DrugFormValues) => {
    setFormDraft(currentValues);
    setFormOpen(false);
    setScannerPurpose('fill-field');
    setScannerOpen(true);
  };

  const handleSaveDrug = (values: DrugFormValues, existingId?: string) => {
    // Extra safety guard against duplicate barcode
    const dup = values.barcode
      ? findDuplicateByBarcode(drugs, values.barcode, existingId)
      : undefined;
    if (dup) {
      showToast('error', `條碼重複，已阻擋儲存（與 ${dup.drugName} 衝突）`);
      return;
    }

    if (existingId) {
      setDrugs((prev) =>
        prev.map((item) =>
          item.id === existingId
            ? {
                ...item,
                ...values,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );
      showToast('success', `已更新「${values.drugName}」（儲位 ${values.location}）`);
    } else {
      const created = createDrugRecord(values);
      setDrugs((prev) => [created, ...prev]);
      showToast('success', `已新增「${values.drugName}」（儲位 ${values.location}）`);
    }

    setFormOpen(false);
    setEditingDrug(null);
    setFormDraft(null);
    setPrefillBarcode('');
  };

  const handleDeleteConfirm = () => {
    if (!deletingDrug) return;
    const removedName = deletingDrug.drugName;
    setDrugs((prev) => prev.filter((item) => item.id !== deletingDrug.id));
    setDeletingDrug(null);
    showToast('info', `已刪除「${removedName}」`);
  };

  const handleResetSeed = () => {
    setDrugs(SEED_DRUGS);
    setSearchQuery('');
    setResetConfirmOpen(false);
    showToast('success', `已還原預設 ${SEED_DRUGS.length} 筆示範藥品資料`);
  };

  const handleSaveSyncConfig = (nextConfig: SyncConfig) => {
    setSyncConfig(nextConfig);
    saveSyncConfig(nextConfig);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchMode === 'keyword' && searchQuery.trim()) {
      const exact = findDuplicateByBarcode(drugs, searchQuery.trim());
      if (exact) {
        setScannedBarcode(exact.barcode);
        setGuideDrug(exact);
        setGuideOpen(true);
      }
    }
  };

  const handleLocationClick = (loc: string) => {
    setSearchMode('location');
    setSearchQuery(loc);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-20 md:pb-8">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (4 single-line links) — Zone 3 (1 Primary CTA) */}
      <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => {
              setSearchMode('keyword');
              setSearchQuery('');
            }}
            className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-md"
          >
            drugsite
          </button>

          {/* Zone 2: Single-line action links */}
          <nav
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
            aria-label="系統管理功能"
          >
            <button
              type="button"
              onClick={() => openAddModal()}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 py-1"
            >
              新增藥品
            </button>
            <button
              type="button"
              onClick={() => setImportExportOpen(true)}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 py-1"
            >
              匯入與匯出
            </button>
            <button
              type="button"
              onClick={() => setCloudSyncOpen(true)}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 py-1"
            >
              雲端同步
            </button>
            <button
              type="button"
              onClick={() => setResetConfirmOpen(true)}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 py-1"
            >
              重設範例
            </button>
          </nav>

          {/* Zone 3: Primary CTA */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={openLookupScanner}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <ScanBarcode className="w-4 h-4 shrink-0" />
              掃描條碼
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Page Heading + Unboxed Metadata Summary */}
        <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 text-balance">
              藥局藥物查詢與儲位管理
            </h1>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-slate-500">
              <span>
                共 <strong className="font-mono-tabular text-slate-800">{drugs.length}</strong> 筆藥品
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="font-mono-tabular text-slate-800">{locationSummary.length}</strong>{' '}
                個調劑儲位
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {syncConfig.lastSyncedAt
                  ? `雲端已同步 (${new Date(syncConfig.lastSyncedAt).toLocaleDateString('zh-TW')})`
                  : '本機儲存中'}
              </span>
            </div>
          </div>

          {/* Mobile quick utility buttons (below header on small screens) */}
          <div className="flex md:hidden items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setImportExportOpen(true)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              匯入/匯出
            </button>
            <button
              type="button"
              onClick={() => setCloudSyncOpen(true)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Cloud className="w-3.5 h-3.5 text-teal-700" />
              試算表同步
            </button>
            <button
              type="button"
              onClick={() => setResetConfirmOpen(true)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重設範例
            </button>
          </div>

          {/* Desktop View Mode & Quick Add */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <div
              className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl"
              role="group"
              aria-label="顯示模式切換"
            >
              <button
                type="button"
                onClick={() => setViewLayout('cards')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  viewLayout === 'cards'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                卡片檢視
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('table')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  viewLayout === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                表格檢視
              </button>
            </div>

            <button
              type="button"
              onClick={() => openAddModal()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              新增藥品
            </button>
          </div>
        </section>

        {/* Dual-Mode Search Panel */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* Search Mode Segmented Control */}
            <div
              className="grid grid-cols-2 md:flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0"
              role="tablist"
              aria-label="搜尋模式切換"
            >
              <button
                type="button"
                role="tab"
                aria-selected={searchMode === 'keyword'}
                onClick={() => {
                  setSearchMode('keyword');
                  searchInputRef.current?.focus();
                }}
                className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  searchMode === 'keyword'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Search className="w-4 h-4 text-teal-700" />
                綜合關鍵字搜尋
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={searchMode === 'location'}
                onClick={() => {
                  setSearchMode('location');
                  searchInputRef.current?.focus();
                }}
                className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  searchMode === 'location'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapPin className="w-4 h-4" />
                儲位快速查詢
              </button>
            </div>

            {/* Instant Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={
                  searchMode === 'location'
                    ? '輸入儲位代碼找出該位置所有藥品，例如 D44、A12...'
                    : '搜尋藥名、批價碼 (EADAP)、物編、條碼或儲位... (按 / 聚焦)'
                }
                aria-label={searchMode === 'location' ? '儲位代碼搜尋' : '藥品綜合關鍵字搜尋'}
                className={`w-full min-h-[46px] pl-10 pr-10 py-2.5 text-sm sm:text-base rounded-xl border bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-colors ${
                  searchMode === 'location'
                    ? 'font-mono-tabular uppercase border-teal-300 focus:ring-teal-600 focus:border-teal-600'
                    : 'border-slate-300 focus:ring-teal-600 focus:border-teal-600'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                  aria-label="清除搜尋字詞"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Results Status Bar */}
        <div className="flex items-center justify-between gap-4 px-1">
          <p className="text-xs sm:text-sm text-slate-600">
            {searchQuery.trim() ? (
              <>
                {searchMode === 'location' ? '儲位查詢' : '關鍵字搜尋'}「
                <span className="font-semibold text-slate-900">{searchQuery.trim()}</span>」共找到{' '}
                <strong className="font-mono-tabular text-teal-700">{filteredDrugs.length}</strong> 筆藥品
              </>
            ) : (
              <>
                顯示全部{' '}
                <strong className="font-mono-tabular text-slate-900">{filteredDrugs.length}</strong>{' '}
                筆藥品資料
              </>
            )}
          </p>

          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              顯示全部藥品
            </button>
          )}
        </div>

        {/* Empty State */}
        {filteredDrugs.length === 0 ? (
          <section className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto flex items-center justify-center">
              <Search className="w-6 h-6 text-slate-400" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h2 className="text-base font-bold text-slate-900">
                {drugs.length === 0 ? '目前尚無任何藥品資料' : '找不到符合條件的藥品'}
              </h2>
              <p className="text-sm text-slate-500">
                {drugs.length === 0
                  ? '您可以新增第一筆藥品、從 CSV/JSON 匯入，或從 Google 試算表拉取資料。'
                  : '請嘗試更換關鍵字、切換搜尋模式，或直接點擊下方按鈕新增藥品。'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors"
                >
                  清除搜尋條件
                </button>
              )}
              <button
                type="button"
                onClick={() => openAddModal()}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                新增藥品
              </button>
            </div>
          </section>
        ) : viewLayout === 'table' ? (
          /* Desktop High-Density Table View */
          <section className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-5">藥名與調劑儲位</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">批價碼</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">物編</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">條碼</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">價格</th>
                    <th className="py-3.5 px-5 text-right whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredDrugs.map((drug) => (
                    <tr
                      key={drug.id}
                      className="hover:bg-slate-50/90 transition-colors group"
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-base font-bold text-slate-900 leading-snug">
                            {drug.drugName}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleLocationClick(drug.location)}
                            title={`點擊查詢儲位 ${drug.location} 內所有藥品`}
                            className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-slate-900 hover:bg-teal-700 text-white text-[2rem] leading-none font-extrabold font-mono-tabular tracking-tight transition-colors shrink-0"
                          >
                            {drug.location || '—'}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-sm font-semibold font-mono-tabular text-slate-800 whitespace-nowrap">
                        {drug.chargeCode || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-sm font-mono-tabular text-slate-600 whitespace-nowrap">
                        {drug.itemCode || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-sm font-mono-tabular text-slate-600 whitespace-nowrap">
                        {drug.barcode || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-sm font-mono-tabular text-slate-700 text-right whitespace-nowrap">
                        {drug.price ? `$${drug.price}` : '—'}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setScannedBarcode(drug.barcode);
                              setGuideDrug(drug);
                              setGuideOpen(true);
                            }}
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                            title="放大儲位指引卡"
                            aria-label={`放大 ${drug.drugName} 儲位`}
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(drug)}
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="編輯"
                            aria-label={`編輯 ${drug.drugName}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingDrug(drug)}
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="刪除"
                            aria-label={`刪除 ${drug.drugName}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* Card Grid View (Always rendered on mobile; rendered on desktop when viewLayout === 'cards') */}
        {filteredDrugs.length > 0 && (
          <section
            className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${
              viewLayout === 'table' ? 'md:hidden' : ''
            }`}
          >
            {filteredDrugs.map((drug) => (
              <article
                key={drug.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                {/* Drug Name immediately followed by 2rem High-Contrast Location Badge */}
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                    {drug.drugName}
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleLocationClick(drug.location)}
                    title={`點擊查看儲位 ${drug.location} 所有藥品`}
                    className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-teal-700 text-white text-[2rem] leading-none font-extrabold font-mono-tabular tracking-tight transition-colors shrink-0"
                  >
                    {drug.location || '—'}
                  </button>
                </div>

                {/* Unboxed Clean Metadata + Actions */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-slate-600 font-mono-tabular">
                    <span>
                      批價 <strong className="text-slate-900">{drug.chargeCode || '—'}</strong>
                    </span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span>物編 {drug.itemCode || '—'}</span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span>條碼 {drug.barcode || '—'}</span>
                    {drug.price && (
                      <>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span>${drug.price}</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setScannedBarcode(drug.barcode);
                        setGuideDrug(drug);
                        setGuideOpen(true);
                      }}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 hover:border-teal-600 hover:bg-teal-50/50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 transition-colors"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-teal-700" />
                      放大指引
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(drug)}
                      className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                      aria-label={`編輯 ${drug.drugName}`}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingDrug(drug)}
                      className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-600 hover:text-red-600 transition-colors"
                      aria-label={`刪除 ${drug.drugName}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>

      {/* Mobile Thumb-Zone Bottom Bar (<= 15% aggregate sticky height cap) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-14 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 flex items-center gap-3">
        <button
          type="button"
          onClick={openLookupScanner}
          className="flex-1 min-h-[44px] rounded-xl bg-teal-700 active:bg-teal-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
        >
          <ScanBarcode className="w-4 h-4" />
          掃描條碼尋藥
        </button>
        <button
          type="button"
          onClick={() => openAddModal()}
          className="min-h-[44px] px-4 rounded-xl bg-slate-900 active:bg-slate-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          新增
        </button>
      </div>

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-18 md:bottom-6 right-4 z-50 max-w-sm rounded-xl border px-4 py-3 shadow-lg flex items-center gap-2.5 text-sm font-medium ${
            toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : toast.type === 'info'
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Modals */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          if (scannerPurpose === 'fill-field') {
            setFormOpen(true);
          }
        }}
        onDetected={handleBarcodeDetected}
        sampleDrugs={drugs}
        title={scannerPurpose === 'fill-field' ? '掃描藥盒帶入條碼欄位' : '掃描條碼定位藥品儲位'}
      />

      <LocationGuideModal
        isOpen={guideOpen}
        scannedBarcode={scannedBarcode}
        matchedDrug={guideDrug}
        onClose={() => setGuideOpen(false)}
        onScanAgain={() => {
          setGuideOpen(false);
          openLookupScanner();
        }}
        onEditDrug={openEditModal}
        onCreateWithBarcode={(barcode) => {
          setGuideOpen(false);
          openAddModal(barcode);
        }}
      />

      <DrugFormModal
        isOpen={formOpen}
        editingDrug={editingDrug}
        prefillBarcode={prefillBarcode}
        existingDrugs={drugs}
        onClose={() => {
          setFormOpen(false);
          setEditingDrug(null);
          setFormDraft(null);
          setPrefillBarcode('');
        }}
        onSave={handleSaveDrug}
        onRequestBarcodeScan={handleRequestInlineScan}
        draftOverride={formDraft}
      />

      <ImportExportModal
        isOpen={importExportOpen}
        drugs={drugs}
        onClose={() => setImportExportOpen(false)}
        onApplyImport={(nextDrugs, summaryText) => {
          setDrugs(nextDrugs);
          showToast('success', summaryText);
        }}
        onExportSuccess={(msg) => showToast('success', msg)}
      />

      <CloudSyncModal
        isOpen={cloudSyncOpen}
        syncConfig={syncConfig}
        drugs={drugs}
        onClose={() => setCloudSyncOpen(false)}
        onSaveConfig={handleSaveSyncConfig}
        onPullComplete={(nextDrugs, msg) => {
          setDrugs(nextDrugs);
          showToast('success', msg);
        }}
        onPushComplete={(msg) => {
          showToast('success', msg);
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(deletingDrug)}
        title="確認刪除此藥品"
        description={
          deletingDrug
            ? `確定要刪除「${deletingDrug.drugName}」（儲位 ${deletingDrug.location}）嗎？此操作僅會從目前清單移除。`
            : ''
        }
        confirmLabel="確認刪除"
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingDrug(null)}
      />

      <ConfirmDialog
        isOpen={resetConfirmOpen}
        title="重設為預設示範藥品資料"
        description={`這將會把本機清單還原為 ${SEED_DRUGS.length} 筆預設藥品（包含 Adapalene Gel / D44 等範例），確定繼續嗎？`}
        confirmLabel="確定重設"
        destructive={false}
        onConfirm={handleResetSeed}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </div>
  );
}
