import { DrugFormValues, DrugItem, ImportMode } from '../types/drug';
import { generateId, normalizeBarcode } from './storage';

const CSV_HEADERS = ['批價碼', '藥名', '物編', '條碼', '儲位', '價格'] as const;

function escapeCsvCell(value: string): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportDrugsToCsv(drugs: DrugItem[]): string {
  const headerLine = CSV_HEADERS.join(',');
  const rows = drugs.map((d) =>
    [
      escapeCsvCell(d.chargeCode),
      escapeCsvCell(d.drugName),
      escapeCsvCell(d.itemCode),
      escapeCsvCell(d.barcode),
      escapeCsvCell(d.location),
      escapeCsvCell(d.price ?? ''),
    ].join(',')
  );
  // Prepend UTF-8 BOM for direct Excel compatibility in Traditional Chinese environments
  return `\uFEFF${[headerLine, ...rows].join('\r\n')}`;
}

export function exportDrugsToJson(drugs: DrugItem[]): string {
  const cleanPayload = drugs.map((d) => ({
    chargeCode: d.chargeCode,
    drugName: d.drugName,
    itemCode: d.itemCode,
    barcode: d.barcode,
    location: d.location,
    price: d.price ?? '',
  }));
  return JSON.stringify(cleanPayload, null, 2);
}

export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function parseCsvRows(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i += 1) {
    const ch = cleanText[i];
    const next = cleanText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentCell);
      currentCell = '';
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim() !== ''));
}

export function mapRawRecordToDrugValues(raw: Record<string, unknown>): DrugFormValues | null {
  const pick = (keys: string[]): string => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null && String(raw[k]).trim() !== '') {
        return String(raw[k]).trim();
      }
    }
    return '';
  };

  const chargeCode = pick(['chargeCode', '批價碼', 'ChargeCode', 'charge_code']).toUpperCase();
  const drugName = pick(['drugName', '藥名', 'DrugName', 'drug_name', '品名']);
  const itemCode = pick(['itemCode', '物編', 'ItemCode', 'item_code']).toUpperCase();
  const barcode = normalizeBarcode(pick(['barcode', '條碼', 'Barcode']));
  const location = pick(['location', '儲位', 'Location']).toUpperCase();
  const price = pick(['price', '價格', '價格(選填)', 'Price']);

  if (!drugName && !barcode && !chargeCode && !location) {
    return null;
  }

  return {
    chargeCode,
    drugName,
    itemCode,
    barcode,
    location,
    price,
  };
}

export function parseImportedDrugs(rawText: string, fileName?: string): DrugFormValues[] {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    throw new Error('檔案內容為空');
  }

  const looksLikeJson =
    (fileName && fileName.toLowerCase().endsWith('.json')) ||
    trimmed.startsWith('[') ||
    trimmed.startsWith('{');

  if (looksLikeJson) {
    const parsed = JSON.parse(trimmed);
    const list: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.data)
        ? parsed.data
        : Array.isArray(parsed?.drugs)
          ? parsed.drugs
          : [];

    if (!Array.isArray(list) || list.length === 0) {
      throw new Error('JSON 內找不到有效的藥品陣列資料');
    }

    const mapped = list
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map(mapRawRecordToDrugValues)
      .filter((item): item is DrugFormValues => item !== null);

    if (mapped.length === 0) {
      throw new Error('無法解析 JSON 中的藥品欄位');
    }
    return mapped;
  }

  const rows = parseCsvRows(trimmed);
  if (rows.length < 2) {
    throw new Error('CSV 至少需要標題列與一筆資料列');
  }

  const headers = rows[0].map((h) => h.trim());
  const result: DrugFormValues[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] ?? '';
    });
    const mapped = mapRawRecordToDrugValues(obj);
    if (mapped) {
      result.push(mapped);
    }
  }

  if (result.length === 0) {
    throw new Error('CSV 內未解析到有效藥品資料');
  }

  return result;
}

export interface MergeSummary {
  nextDrugs: DrugItem[];
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
}

export function applyDrugImport(
  existing: DrugItem[],
  incoming: DrugFormValues[],
  mode: ImportMode
): MergeSummary {
  const now = new Date().toISOString();

  if (mode === 'replace') {
    const deduped: DrugItem[] = [];
    const seenBarcodes = new Set<string>();
    let skippedCount = 0;

    for (const item of incoming) {
      const cleanBarcode = normalizeBarcode(item.barcode);
      if (cleanBarcode) {
        const key = cleanBarcode.toLowerCase();
        if (seenBarcodes.has(key)) {
          skippedCount += 1;
          continue;
        }
        seenBarcodes.add(key);
      }
      deduped.push({
        id: generateId(),
        ...item,
        barcode: cleanBarcode,
        updatedAt: now,
      });
    }

    return {
      nextDrugs: deduped,
      addedCount: deduped.length,
      updatedCount: 0,
      skippedCount,
    };
  }

  // Merge mode: match by barcode first, else match by chargeCode + itemCode
  const nextDrugs = existing.map((d) => ({ ...d }));
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const item of incoming) {
    const cleanBarcode = normalizeBarcode(item.barcode);
    let matchIndex = -1;

    if (cleanBarcode) {
      matchIndex = nextDrugs.findIndex(
        (d) => normalizeBarcode(d.barcode).toLowerCase() === cleanBarcode.toLowerCase()
      );
    }

    if (matchIndex === -1 && item.chargeCode && item.itemCode) {
      matchIndex = nextDrugs.findIndex(
        (d) =>
          d.chargeCode.toLowerCase() === item.chargeCode.toLowerCase() &&
          d.itemCode.toLowerCase() === item.itemCode.toLowerCase()
      );
    }

    if (matchIndex >= 0) {
      const target = nextDrugs[matchIndex];
      // Prevent barcode collision with a different existing record
      if (cleanBarcode) {
        const collision = nextDrugs.some(
          (d, idx) =>
            idx !== matchIndex &&
            normalizeBarcode(d.barcode).toLowerCase() === cleanBarcode.toLowerCase()
        );
        if (collision) {
          skippedCount += 1;
          continue;
        }
      }

      nextDrugs[matchIndex] = {
        ...target,
        chargeCode: item.chargeCode || target.chargeCode,
        drugName: item.drugName || target.drugName,
        itemCode: item.itemCode || target.itemCode,
        barcode: cleanBarcode || target.barcode,
        location: item.location || target.location,
        price: item.price !== undefined && item.price !== '' ? item.price : target.price,
        updatedAt: now,
      };
      updatedCount += 1;
    } else {
      nextDrugs.unshift({
        id: generateId(),
        ...item,
        barcode: cleanBarcode,
        updatedAt: now,
      });
      addedCount += 1;
    }
  }

  return {
    nextDrugs,
    addedCount,
    updatedCount,
    skippedCount,
  };
}
