import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheet } from '@/lib/google-sheets';
import { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';

const sheetsConfig: Record<string, { name: string; headers: string[] }> = {
  painLogs: { name: "PainLogs", headers: ["id", "date", "location", "intensity", "trigger", "notes", "status", "lastUpdated"] },
  longTermLogs: { name: "LongTermLogs", headers: ["id", "date", "itemName", "sizeWidth", "sizeHeight", "sizeDepth", "hospital", "doctor", "nextCheckupDate", "notes", "status", "lastUpdated"] },
  biteSplintLogs: { name: "BiteSplintLogs", headers: ["id", "date", "status", "lastUpdated"] },
  tmySymptomsLogs: { name: "TMJSymptomsLogs", headers: ["id", "date", "symptoms", "medication", "status", "lastUpdated"] },
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

      // 讀取伺服器上的資料
      const serverLogs = await getLogsFromSheet(sheet, config.headers);
      
      if (payload[key] && Array.isArray(payload[key])) {
        const clientLogs = payload[key];
        const mergedMap: Record<string, any> = {};
        
        serverLogs.forEach(item => {
          if (item.id) mergedMap[item.id] = item;
        });

        clientLogs.forEach((item: any) => {
          if (item.id) {
            const existing = mergedMap[item.id];
            if (!existing || Number(item.lastUpdated) > Number(existing.lastUpdated)) {
              mergedMap[item.id] = item;
            }
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
