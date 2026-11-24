import { DrugFormValues, DrugItem, SEED_DRUGS, SearchMode, SyncConfig } from '../types/drug';

const DRUGS_STORAGE_KEY = 'drugsite_rwd_inventory_v1';
const SYNC_STORAGE_KEY = 'drugsite_rwd_sync_config_v1';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `drug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeCode(val: string): string {
  return val.trim();
}

export function normalizeBarcode(val: string): string {
  return val.trim().replace(/^'+/, '');
}

export function loadDrugsFromStorage(): DrugItem[] {
  try {
    const raw = localStorage.getItem(DRUGS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(DRUGS_STORAGE_KEY, JSON.stringify(SEED_DRUGS));
      return SEED_DRUGS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        id: String(item.id || generateId()),
        chargeCode: String(item.chargeCode || '').trim(),
        drugName: String(item.drugName || '').trim(),
        itemCode: String(item.itemCode || '').trim(),
        barcode: normalizeBarcode(String(item.barcode || '')),
        location: String(item.location || '').trim(),
        price: item.price !== undefined && item.price !== null ? String(item.price).trim() : '',
        updatedAt: String(item.updatedAt || new Date().toISOString()),
      }));
    }
  } catch {
    // Fallback to seed data on corrupted storage
  }
  return SEED_DRUGS;
}

export function saveDrugsToStorage(drugs: DrugItem[]): void {
  try {
    localStorage.setItem(DRUGS_STORAGE_KEY, JSON.stringify(drugs));
  } catch {
    // Storage quota exceeded or unavailable
  }
}

export function loadSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(SYNC_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        gasUrl: typeof parsed.gasUrl === 'string' ? parsed.gasUrl : '',
        lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
      };
    }
  } catch {
    // ignore
  }
  return { gasUrl: '', lastSyncedAt: null };
}

export function saveSyncConfig(config: SyncConfig): void {
  try {
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function findDuplicateByBarcode(
  drugs: DrugItem[],
  barcode: string,
  excludeId?: string
): DrugItem | undefined {
  const clean = normalizeBarcode(barcode);
  if (!clean) return undefined;
  return drugs.find(
    (d) => d.id !== excludeId && normalizeBarcode(d.barcode).toLowerCase() === clean.toLowerCase()
  );
}

export function filterDrugs(
  drugs: DrugItem[],
  query: string,
  mode: SearchMode
): DrugItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return drugs;

  if (mode === 'location') {
    return drugs.filter((drug) => drug.location.toLowerCase().includes(q));
  }

  return drugs.filter((drug) => {
    return (
      drug.drugName.toLowerCase().includes(q) ||
      drug.chargeCode.toLowerCase().includes(q) ||
      drug.itemCode.toLowerCase().includes(q) ||
      drug.barcode.toLowerCase().includes(q) ||
      drug.location.toLowerCase().includes(q)
    );
  });
}

export function getLocationSummary(drugs: DrugItem[]): Array<{ location: string; count: number }> {
  const counts = new Map<string, number>();
  for (const drug of drugs) {
    const loc = drug.location.trim().toUpperCase();
    if (!loc) continue;
    counts.set(loc, (counts.get(loc) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => a.location.localeCompare(b.location, 'en', { numeric: true }));
}

export function createDrugRecord(values: DrugFormValues): DrugItem {
  return {
    id: generateId(),
    chargeCode: values.chargeCode.trim().toUpperCase(),
    drugName: values.drugName.trim(),
    itemCode: values.itemCode.trim().toUpperCase(),
    barcode: normalizeBarcode(values.barcode),
    location: values.location.trim().toUpperCase(),
    price: values.price ? values.price.trim() : '',
    updatedAt: new Date().toISOString(),
  };
}
