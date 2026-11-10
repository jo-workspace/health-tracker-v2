import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheet } from '@/lib/google-sheets';
import { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';

const sheetsConfig: Record<string, { name: string; headers: string[] }> = {
  painLogs: { name: "PainLogs", headers: ["id", "date", "location", "intensity", "trigger", "notes", "status", "lastUpdated", "startDate", "recoveredDate", "level", "treatments", "history"] },
  longTermLogs: { name: "LongTermLogs", headers: ["id", "date", "itemName", "sizeWidth", "sizeHeight", "sizeDepth", "hospital", "doctor", "nextCheckupDate", "notes", "status", "lastUpdated"] },
  biteSplintLogs: { name: "BiteSplintLogs", headers: ["id", "date", "status", "lastUpdated"] },
  tmySymptomsLogs: { name: "TMJSymptomsLogs", headers: ["id", "date", "symptoms", "medication", "status", "lastUpdated", "side"] },
  allergyLogs: { name: "AllergyLogs", headers: ["id", "date", "timeSlot", "time", "locations", "severity", "trigger", "medication", "notes", "status", "lastUpdated", "sleepImpact"] },
  sleepLogs: { name: "SleepLogs", headers: ["id", "date", "type", "bedtime", "fallAsleepTime", "wakeupTime", "sleepDuration", "deepSleep", "remSleep", "stress", "feeling", "hrv", "restingHeartRate", "notes", "status", "lastUpdated"] },
  rainbowDietLogs: { name: "RainbowDietLogs", headers: ["id", "date", "plantName", "color", "status", "lastUpdated"] },
  supplementLogs: { name: "SupplementLogs", headers: ["id", "date", "items", "status", "lastUpdated"] },
  supplementSettings: { name: "SupplementSettings", headers: ["id", "name", "time", "targetAmount", "status", "lastUpdated", "category", "rotationGroup"] },
  supplementInventory: { name: "SupplementInventory", headers: ["id", "name", "brand", "category", "openedCount", "unopenedCount", "targetUsers", "location", "notes", "status", "lastUpdated", "isArchived"] },
  illnessLogs: { name: "IllnessLogs", headers: ["id", "name", "category", "startDate", "recoveredDate", "severity", "temperature", "medicalCare", "medicationDaysTotal", "symptoms", "prescribedMedications", "medicationsTaken", "notes", "status", "lastUpdated", "history"] }
};

// 伺服器端記憶體快取：大幅壓低 Google Sheets API 讀取請求，防止 60 req/min 限流擊穿
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const serverLogsCache = new Map<string, CacheEntry<any[]>>();
const SERVER_LOGS_CACHE_TTL = 60_000; // 讀取快取 60 秒

let cachedDeletedIds: CacheEntry<Record<string, Set<string>>> | null = null;
const DELETED_IDS_CACHE_TTL = 300_000; // 刪除 ID 記錄快取 5 分鐘

const verifiedHeadersSheets = new Set<string>();

/** 自動處理 Google Sheets API 429 / 503 等暫態錯誤之指數退避重試 */
async function withApiRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const msg = String(err?.message || '');
      const isTransient =
        msg.includes('429') ||
        msg.includes('Quota exceeded') ||
        msg.includes('503') ||
        msg.includes('Service Unavailable');

      if (isTransient && attempt < maxRetries) {
        const delay = 1500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
        console.warn(`[Google Sheets API] 暫態限流 (429/503)，等待 ${delay}ms 進行第 ${attempt}/${maxRetries} 次重試...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw err;
      }
    }
  }
}

/** 安全取得或建立工作表，防止並行請求或重試時觸發 Google API 400 "already exists" 錯誤 */
async function getOrCreateSheet(doc: any, title: string, headers: string[]): Promise<GoogleSpreadsheetWorksheet> {
  const findSheet = () => {
    if (doc.sheetsByTitle[title]) return doc.sheetsByTitle[title];
    const normalized = title.trim().toLowerCase();
    return Object.values(doc.sheetsByTitle).find(
      (s: any) => s.title && s.title.trim().toLowerCase() === normalized
    ) as GoogleSpreadsheetWorksheet | undefined;
  };

  let sheet = findSheet();
  if (!sheet) {
    try {
      sheet = await withApiRetry(() => doc.addSheet({ title, headerValues: headers }));
      verifiedHeadersSheets.add(title);
    } catch (err: any) {
      if (err.message?.includes('already exists') || err.message?.includes('Invalid requests[0].addSheet')) {
        await withApiRetry(() => doc.loadInfo());
        sheet = findSheet();
      }
      if (!sheet) throw err;
    }
  }
  return sheet;
}

const DELETED_IDS_SHEET_NAME = 'DeletedIds';
const DELETED_IDS_HEADERS = ['sheetKey', 'id', 'deletedAt'];

/**
 * 永久記錄已刪除的 id（支援內存快取）。
 */
async function getDeletedIdsMap(doc: any): Promise<{ sheet: GoogleSpreadsheetWorksheet; map: Record<string, Set<string>> }> {
  const sheet = await getOrCreateSheet(doc, DELETED_IDS_SHEET_NAME, DELETED_IDS_HEADERS);

  if (cachedDeletedIds && Date.now() - cachedDeletedIds.timestamp < DELETED_IDS_CACHE_TTL) {
    return { sheet, map: cachedDeletedIds.data };
  }

  const rows = await withApiRetry<any[]>(() => sheet.getRows());
  const map: Record<string, Set<string>> = {};
  rows.forEach((row: any) => {
    const sheetKey = row.get('sheetKey');
    const id = row.get('id');
    if (!sheetKey || !id) return;
    if (!map[sheetKey]) map[sheetKey] = new Set();
    map[sheetKey].add(String(id));
  });

  cachedDeletedIds = { data: map, timestamp: Date.now() };
  return { sheet, map };
}

// 全域排程互斥鎖（Server Write Mutex Queue）：強制所有同步讀寫按順序執行
let syncQueue: Promise<any> = Promise.resolve();

function enqueueSync<T>(operation: () => Promise<T>): Promise<T> {
  const result = syncQueue.then(operation, operation);
  syncQueue = result.then(() => {}, () => {});
  return result;
}

export async function POST(request: NextRequest) {
  return enqueueSync(async () => {
    try {
      const authHeader = request.headers.get('authorization');
      const expectedPassword = process.env.APP_PASSWORD;
      if (expectedPassword && authHeader !== `Bearer ${expectedPassword}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const payload = await request.json();
      // 使用快取的 doc 實例，避免每次 POST 重新 loadInfo 消耗 quota
      const doc = await withApiRetry(() => getGoogleSheet());

      const { sheet: deletedIdsSheet, map: deletedIdsByKey } = await getDeletedIdsMap(doc);
      const newDeletedIdRows: { sheetKey: string; id: string; deletedAt: string }[] = [];

      const responsePayload: Record<string, any[]> = {};

      const payloadKeys = Object.keys(payload).filter(k => k !== 'clientTimestamp');
      const isFullSync = payloadKeys.length === 0;
      const keysToSync = Object.keys(sheetsConfig).filter(key => isFullSync || payloadKeys.includes(key));

      for (const key of keysToSync) {
        const config = sheetsConfig[key];
        const isMutating = Boolean(payload[key] && Array.isArray(payload[key]));
        const deletedSet = deletedIdsByKey[key] || (deletedIdsByKey[key] = new Set());

        let serverLogs: any[] = [];
        let sheet: GoogleSpreadsheetWorksheet | null = null;

        // 若為純讀取且內存快取仍新鮮，直接使用快取資料，避免觸發 Google 60 req/min 限流
        const cached = serverLogsCache.get(key);
        if (!isMutating && cached && Date.now() - cached.timestamp < SERVER_LOGS_CACHE_TTL) {
          serverLogs = cached.data;
        } else {
          sheet = await getOrCreateSheet(doc, config.name, config.headers);
          const rawServerLogs = await getLogsFromSheet(sheet, config.headers);
          serverLogs = rawServerLogs.filter(item => {
            if (!item.id && item.date) {
              item.id = `${key}-${item.date}`;
            }
            return item.id && !deletedSet.has(item.id);
          });
          serverLogsCache.set(key, { data: serverLogs, timestamp: Date.now() });
        }

        if (isMutating) {
          if (!sheet) {
            sheet = await getOrCreateSheet(doc, config.name, config.headers);
          }

          const clientLogs = payload[key];
          const mergedMap: Record<string, any> = {};

          serverLogs.forEach(item => {
            if (item.id) mergedMap[item.id] = item;
          });

          clientLogs.forEach((item: any) => {
            if (!item.id || deletedSet.has(item.id)) return;

            if (item.status === 'deleted') {
              newDeletedIdRows.push({ sheetKey: key, id: item.id, deletedAt: String(Date.now()) });
              deletedSet.add(item.id);
              delete mergedMap[item.id];
              return;
            }

            const existing = mergedMap[item.id];
            if (!existing || Number(item.lastUpdated) > Number(existing.lastUpdated)) {
              mergedMap[item.id] = item;
            }
          });

          const mergedList = Object.values(mergedMap);
          const sheetList = mergedList.filter(item => item.status !== "deleted");

          // 防禦性檢查：若伺服器原先有資料，但合併結果意外為 0 筆，禁止抹除雲端資料
          if (sheetList.length === 0 && serverLogs.length > 0) {
            console.warn(`[Sync Safety] Aborted empty overwrite for ${config.name} (server had ${serverLogs.length} rows)`);
            responsePayload[key] = serverLogs;
          } else {
            // 寫入 Google Sheets
            await saveLogsToSheet(sheet, sheetList, config.headers);
            // Write-through 更新內存快取
            serverLogsCache.set(key, { data: sheetList, timestamp: Date.now() });
            responsePayload[key] = mergedList;
          }
        } else {
          const activeLogs = serverLogs.filter(item => item.status !== "deleted");
          responsePayload[key] = activeLogs;
        }
      }

      if (newDeletedIdRows.length > 0) {
        await withApiRetry(() => deletedIdsSheet.addRows(newDeletedIdRows));
        // 同步更新快取的 deletedIds
        if (cachedDeletedIds) {
          newDeletedIdRows.forEach(row => {
            if (!cachedDeletedIds!.data[row.sheetKey]) {
              cachedDeletedIds!.data[row.sheetKey] = new Set();
            }
            cachedDeletedIds!.data[row.sheetKey].add(row.id);
          });
        }
      }

      return NextResponse.json(responsePayload);
    } catch (error: any) {
      console.error('[API/sync POST] Error:', error);
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }
  });
}

async function getLogsFromSheet(sheet: GoogleSpreadsheetWorksheet, headers: string[]) {
  let rows = [];
  try {
    rows = await withApiRetry(() => sheet.getRows());
  } catch (e) {
    throw new Error('Failed to fetch existing rows from Google Sheets: ' + (e as Error).message);
  }
  return rows.map(row => {
    const obj: any = {};
    headers.forEach(header => {
      const val = row.get(header);
      if (val !== undefined && val !== null) {
        const strVal = String(val);
        if ((header === 'history' || header === 'treatments' || header === 'symptoms' || header === 'prescribedMedications' || header === 'medicationsTaken') && (strVal.trim().startsWith('[') || strVal.trim().startsWith('{'))) {
          try {
            obj[header] = JSON.parse(strVal);
          } catch {
            obj[header] = strVal;
          }
        } else if (header === 'isArchived') {
          obj[header] = strVal === 'true' || strVal === 'TRUE' || strVal === '1';
        } else {
          obj[header] = strVal;
        }
      } else {
        obj[header] = "";
      }
    });
    return obj;
  });
}

async function saveLogsToSheet(sheet: GoogleSpreadsheetWorksheet, logs: any[], headers: string[]) {
  // 僅在尚未驗證過的工作表檢查表頭，避免每次存檔重複消耗 read quota
  if (!verifiedHeadersSheets.has(sheet.title)) {
    try {
      let existingHeaders: string[] = [];
      try {
        await withApiRetry(() => sheet.loadHeaderRow());
        existingHeaders = sheet.headerValues || [];
      } catch {
        if (headers.length > sheet.columnCount) {
          await withApiRetry(() => sheet.resize({ rowCount: sheet.rowCount, columnCount: headers.length }));
        }
        await withApiRetry(() => sheet.setHeaderRow(headers));
        existingHeaders = headers;
      }

      const missingHeaders = headers.filter(h => !existingHeaders.includes(h));
      if (missingHeaders.length > 0) {
        const newHeaders = [...existingHeaders, ...missingHeaders];
        if (newHeaders.length > sheet.columnCount) {
          await withApiRetry(() => sheet.resize({ rowCount: sheet.rowCount, columnCount: newHeaders.length }));
        }
        await withApiRetry(() => sheet.setHeaderRow(newHeaders));
      }
      verifiedHeadersSheets.add(sheet.title);
    } catch (err) {
      console.warn(`[Sync] Check/update header row failed for ${sheet.title}:`, err);
    }
  }

  const chunkSize = 100;
  const allRows = logs.map(log => {
    const rowObj: any = {};
    headers.forEach(header => {
      const val = log[header];
      if (val !== undefined && val !== null) {
        rowObj[header] = typeof val === 'object' ? JSON.stringify(val) : String(val);
      } else {
        rowObj[header] = "";
      }
    });
    return rowObj;
  });

  if (allRows.length === 0 && sheet.rowCount > 1) {
    console.warn(`[Sync Safety] Aborted clearRows on ${sheet.title} because target rows are empty.`);
    return;
  }

  await withApiRetry(() => sheet.clearRows());
  
  if (allRows.length > 0) {
    try {
      for (let i = 0; i < allRows.length; i += chunkSize) {
        const chunk = allRows.slice(i, i + chunkSize);
        await withApiRetry(() => sheet.addRows(chunk));
      }
    } catch (error) {
      console.error('Critical Error saving to sheet:', error);
      throw new Error('Failed to save to Google Sheets. The sheet might be partially cleared.');
    }
  }
}
