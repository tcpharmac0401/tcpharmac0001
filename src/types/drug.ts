export interface DrugItem {
  id: string;
  chargeCode: string; // 批價碼
  drugName: string;   // 藥名
  itemCode: string;   // 物編
  barcode: string;    // 條碼
  location: string;   // 儲位
  price?: string;     // 價格 (選填)
  updatedAt: string;
}

export type DrugFormValues = Omit<DrugItem, 'id' | 'updatedAt'>;

export type SearchMode = 'keyword' | 'location';

export type ImportMode = 'merge' | 'replace';

export type ViewLayout = 'cards' | 'table';

export interface SyncConfig {
  gasUrl: string;
  lastSyncedAt: string | null;
}

export interface ToastNotice {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export const SEED_DRUGS: DrugItem[] = [
  {
    id: 'seed-eadap',
    chargeCode: 'EADAP',
    drugName: 'Adapalene Gel 0.1% 15gm/tube(Adapalene)',
    itemCode: '7EADAPA015',
    barcode: '4711934355895',
    location: 'D44',
    price: '120',
    updatedAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'seed-omox',
    chargeCode: 'OAMOX5',
    drugName: 'Amoxicillin Cap 500mg(Amolin)',
    itemCode: '7OAMOX5001',
    barcode: '4710984112035',
    location: 'A12',
    price: '4',
    updatedAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'seed-oaugm',
    chargeCode: 'OAUGM1',
    drugName: 'Amoxicillin 875mg + Clavulanate 125mg Tab(Curam 1000mg)',
    itemCode: '7OAUGM1002',
    barcode: '9002260015423',
    location: 'A12',
    price: '18',
    updatedAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'seed-oacet',
    chargeCode: 'OACET5',
    drugName: 'Acetaminophen Tab 500mg(Scanol)',
    itemCode: '7OACET5003',
    barcode: '4713168010214',
    location: 'B05',
    price: '2',
    updatedAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'seed-oibup',
    chargeCode: 'OIBUP4',
    drugName: 'Ibuprofen F.C. Tab 400mg(Purfen)',
    itemCode: '7OIBUP4004',
    barcode: '4711653220089',
    location: 'B05',
    price: '3',
    updatedAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'seed-ometf',
    chargeCode: 'OMETF5',
    drugName: 'Metformin HCl Tab 500mg(Glucophage)',
    itemCode: '7OMETF5005',
    barcode: '4714122030916',
    location: 'C18',
    price: '3',
    updatedAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'seed-oaml5',
    chargeCode: 'OAML5',
    drugName: 'Amlodipine Besylate Tab 5mg(Norvasc)',
    itemCode: '7OAML05006',
    barcode: '5415062310401',
    location: 'C22',
    price: '8',
    updatedAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'seed-oator',
    chargeCode: 'OATOR2',
    drugName: 'Atorvastatin Calcium F.C. Tab 20mg(Lipitor)',
    itemCode: '7OATOR2007',
    barcode: '5415062321896',
    location: 'C22',
    price: '16',
    updatedAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'seed-emup',
    chargeCode: 'EMUP',
    drugName: 'Mupirocin Ointment 2% 5gm/tube(Bactroban)',
    itemCode: '7EMUP00008',
    barcode: '4711245881021',
    location: 'D44',
    price: '95',
    updatedAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'seed-ebeta',
    chargeCode: 'EBETAG',
    drugName: 'Betamethasone + Gentamicin Cream 10gm/tube(Rinderon-VG)',
    itemCode: '7EBETAG009',
    barcode: '4710221045902',
    location: 'D45',
    price: '65',
    updatedAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'seed-osym',
    chargeCode: 'ISYM16',
    drugName: 'Budesonide 160mcg + Formoterol 4.5mcg/dose 120ds(Symbicort Turbuhaler)',
    itemCode: '7ISYM16010',
    barcode: '7321831234561',
    location: 'E08',
    price: '890',
    updatedAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'seed-iinsu',
    chargeCode: 'IINSGL',
    drugName: 'Insulin Glargine 100U/mL 3mL/pen(Lantus SoloStar)',
    itemCode: '7IINSGL011',
    barcode: '4030855019283',
    location: 'R02',
    price: '420',
    updatedAt: '2026-01-15T08:00:00.000Z',
  },
];

export const GAS_TEMPLATE_CODE = `// Google Apps Script Web App 範本 (對應試算表「drugsite / 工作表1」)
// 步驟：在試算表點選「擴充功能」>「Apps Script」，貼上此程式碼並部署為「網頁應用程式」
// 執行身分選「我」，誰可以存取選「所有人」。

const SHEET_NAME = '工作表1';
const HEADERS = ['批價碼', '藥名', '物編', '條碼', '儲位', '價格'];

function getTargetSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function doGet() {
  const sheet = getTargetSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', data: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const headerRow = rows[0].map(h => String(h).trim());
  const data = rows.slice(1)
    .filter(r => r.some(cell => String(cell).trim() !== ''))
    .map(r => ({
      chargeCode: String(r[headerRow.indexOf('批價碼')] ?? r[0] ?? '').trim(),
      drugName: String(r[headerRow.indexOf('藥名')] ?? r[1] ?? '').trim(),
      itemCode: String(r[headerRow.indexOf('物編')] ?? r[2] ?? '').trim(),
      barcode: String(r[headerRow.indexOf('條碼')] ?? r[3] ?? '').trim(),
      location: String(r[headerRow.indexOf('儲位')] ?? r[4] ?? '').trim(),
      price: String(r[headerRow.indexOf('價格')] ?? r[5] ?? '').trim(),
    }));

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const list = Array.isArray(payload.data) ? payload.data : [];
    const sheet = getTargetSheet();

    sheet.clearContents();
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

    if (list.length > 0) {
      const values = list.map(item => [
        item.chargeCode || '',
        item.drugName || '',
        item.itemCode || '',
        "'" + String(item.barcode || ''), // 避免長條碼被試算表轉成科學記號
        item.location || '',
        item.price || '',
      ]);
      sheet.getRange(2, 1, values.length, HEADERS.length).setValues(values);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', count: list.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;
