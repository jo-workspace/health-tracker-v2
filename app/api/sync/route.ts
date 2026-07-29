import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheet } from '@/lib/google-sheets';
import { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';

const sheetsConfig: Record<string, { name: string; headers: string[] }> = {
  painLogs: { name: "PainLogs", headers: ["id", "date", "location", "intensity", "trigger", "notes", "status", "lastUpdated"] },
  longTermLogs: { name: "LongTermLogs", headers: ["id", "date", "itemName", "sizeWidth", "sizeHeight", "sizeDepth", "hospital", "doctor", "nextCheckupDate", "notes", "status", "lastUpdated"] },
  biteSplintLogs: { name: "BiteSplintLogs", headers: ["id", "date", "status", "lastUpdated"] },
  tmySymptomsLogs: { name: "TMJSymptomsLogs", headers: ["id", "date", "symptoms", "medication", "status", "lastUpdated"] },
  allergyLogs: { name: "AllergyLogs", headers: ["id", "date", "locations", "severity", "trigger", "medication", "notes", "status", "lastUpdated"] },
  sleepLogs: { name: "SleepLogs", headers: ["id", "date", "type", "bedtime", "fallAsleepTime", "wakeupTime", "sleepDuration", "deepSleep", "remSleep", "stress", "feeling", "hrv", "restingHeartRate", "notes", "status", "lastUpdated"] },
  rainbowDietLogs: { name: "RainbowDietLogs", headers: ["id", "date", "plantName", "color", "status", "lastUpdated"] },
  supplementLogs: { name: "SupplementLogs", headers: ["id", "date", "items", "status", "lastUpdated"] },
  supplementSettings: { name: "SupplementSettings", headers: ["id", "name", "time", "targetAmount", "status", "lastUpdated"] }
};

/** 自動處理 Google Sheets API 429 Rate Limit 之指數退避重試 */
async function withApiRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const is429 = err.message?.includes('429') || err.message?.includes('Quota exceeded');
      if (is429 && attempt < maxRetries) {
        console.warn(`[Google Sheets API 429] 觸發 60/min 限流，等待 ${1.5 * attempt} 秒後進行第 ${attempt}/${maxRetries} 次重試...`);
        await new Promise(res => setTimeout(res, 1500 * attempt));
      } else {
        throw err;
      }
    }
  }
}

/** 確保工作表第 1 列的標題欄位完整性，若遭毀損自動修正 */
async function ensureCorrectHeaders(sheet: GoogleSpreadsheetWorksheet, expectedHeaders: string[]) {
  try {
    await withApiRetry(() => sheet.loadHeaderRow());
    const currentHeaders = sheet.headerValues;
    const isMatching = expectedHeaders.every((h, i) => currentHeaders[i] === h);
    if (!isMatching) {
      console.warn(`[Header Mismatch] 工作表 ${sheet.title} 標題列毀損或不合，正在自動恢復預設標題列...`);
      await withApiRetry(() => sheet.setHeaderRow(expectedHeaders));
    }
  } catch (e) {
    await withApiRetry(() => sheet.setHeaderRow(expectedHeaders));
  }
}

const DELETED_IDS_SHEET_NAME = 'DeletedIds';
const DELETED_IDS_HEADERS = ['sheetKey', 'id', 'deletedAt'];

/**
 * 永久記錄已刪除的 id（獨立於主資料表之外）。
 * 手動在 Google Sheet 上刪除的列不會被記錄在這裡，
 * 因此只有透過 App 內建刪除（status: 'deleted'）才能真正阻止資料復活。
 */
async function getDeletedIdsMap(doc: any): Promise<{ sheet: GoogleSpreadsheetWorksheet; map: Record<string, Set<string>> }> {
  let sheet = doc.sheetsByTitle[DELETED_IDS_SHEET_NAME];
  if (!sheet) {
    sheet = await withApiRetry(() => doc.addSheet({ title: DELETED_IDS_SHEET_NAME, headerValues: DELETED_IDS_HEADERS }));
  }
  await ensureCorrectHeaders(sheet, DELETED_IDS_HEADERS);

  const rows = await withApiRetry<any[]>(() => sheet.getRows());
  const map: Record<string, Set<string>> = {};
  rows.forEach((row: any) => {
    const sheetKey = row.get('sheetKey');
    const id = row.get('id');
    if (!sheetKey || !id) return;
    if (!map[sheetKey]) map[sheetKey] = new Set();
    map[sheetKey].add(String(id));
  });

  return { sheet, map };
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedPassword = process.env.APP_PASSWORD;
    if (expectedPassword && authHeader !== `Bearer ${expectedPassword}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const doc = await withApiRetry(() => getGoogleSheet());
    await withApiRetry(() => doc.loadInfo());

    const { sheet: deletedIdsSheet, map: deletedIdsByKey } = await getDeletedIdsMap(doc);
    const newDeletedIdRows: { sheetKey: string; id: string; deletedAt: string }[] = [];

    const responsePayload: Record<string, any[]> = {};

    const payloadKeys = Object.keys(payload).filter(k => k !== 'clientTimestamp');
    const isFullSync = payloadKeys.length === 0;
    const keysToSync = Object.keys(sheetsConfig).filter(key => isFullSync || payloadKeys.includes(key));

    for (const key of keysToSync) {
      const config = sheetsConfig[key];
      let sheet = doc.sheetsByTitle[config.name];

      if (!sheet) {
        sheet = await withApiRetry(() => doc.addSheet({ title: config.name, headerValues: config.headers }));
      }

      // 檢查並保護工作表標題列
      await ensureCorrectHeaders(sheet, config.headers);

      const deletedSet = deletedIdsByKey[key] || (deletedIdsByKey[key] = new Set());

      // 讀取伺服器上的資料（永久刪除的 id 一律排除，避免手動刪列後又被舊快取復活）
      const serverLogs = (await getLogsFromSheet(sheet, config.headers)).filter(item => !deletedSet.has(item.id));

      if (payload[key] && Array.isArray(payload[key])) {
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

        // 寫入 Google Sheets
        await saveLogsToSheet(sheet, sheetList, config.headers);
        responsePayload[key] = mergedList;
      } else {
        const activeLogs = serverLogs.filter(item => item.status !== "deleted");
        responsePayload[key] = activeLogs;
      }
    }

    if (newDeletedIdRows.length > 0) {
      await withApiRetry(() => deletedIdsSheet.addRows(newDeletedIdRows));
    }

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error('[API/sync POST] Error:', error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
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
      obj[header] = val !== undefined && val !== null ? String(val) : "";
    });
    return obj;
  });
}

async function saveLogsToSheet(sheet: GoogleSpreadsheetWorksheet, logs: any[], headers: string[]) {
  const chunkSize = 100;
  const allRows = logs.map(log => {
    const rowObj: any = {};
    headers.forEach(header => {
      rowObj[header] = log[header] !== undefined && log[header] !== null ? String(log[header]) : "";
    });
    return rowObj;
  });

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
