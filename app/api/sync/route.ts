import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheet } from '@/lib/google-sheets';
import { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';

const sheetsConfig: Record<string, { name: string; headers: string[] }> = {
  painLogs: { name: "PainLogs", headers: ["id", "date", "location", "intensity", "trigger", "notes", "status", "lastUpdated"] },
  longTermLogs: { name: "LongTermLogs", headers: ["id", "date", "itemName", "sizeWidth", "sizeHeight", "sizeDepth", "hospital", "doctor", "nextCheckupDate", "notes", "status", "lastUpdated"] },
  biteSplintLogs: { name: "BiteSplintLogs", headers: ["id", "date", "status", "lastUpdated"] },
  tmySymptomsLogs: { name: "TMJSymptomsLogs", headers: ["id", "date", "symptoms", "medication", "status", "lastUpdated"] },
  sleepLogs: { name: "SleepLogs", headers: ["id", "date", "type", "bedtime", "fallAsleepTime", "wakeupTime", "sleepDuration", "deepSleep", "remSleep", "stress", "feeling", "hrv", "restingHeartRate", "notes", "lastUpdated"] },
  rainbowDietLogs: { name: "RainbowDietLogs", headers: ["id", "date", "plantName", "color", "lastUpdated"] },
  supplementLogs: { name: "SupplementLogs", headers: ["id", "date", "items", "status", "lastUpdated"] },
  supplementSettings: { name: "SupplementSettings", headers: ["id", "name", "time", "targetAmount", "status", "lastUpdated"] }
};

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const doc = await getGoogleSheet();
    
    const responsePayload: Record<string, any[]> = {};

    for (const key of Object.keys(sheetsConfig)) {
      const config = sheetsConfig[key];
      let sheet = doc.sheetsByTitle[config.name];
      
      if (!sheet) {
        sheet = await doc.addSheet({ title: config.name, headerValues: config.headers });
      } else {
        try {
          await sheet.loadHeaderRow();
          const currentHeaders = sheet.headerValues;
          const missing = config.headers.filter(h => !currentHeaders.includes(h));
          if (missing.length > 0) {
            await sheet.setHeaderRow([...currentHeaders, ...missing]);
          }
        } catch (e) {
          // If loadHeaderRow fails (e.g., header row was deleted), just set it
          await sheet.setHeaderRow(config.headers);
        }
      }

      // 讀取伺服器上的資料
      const serverLogs = await getLogsFromSheet(sheet, config.headers);
      
      // 如果前端有傳送這個 key 的資料過來，代表需要「寫入/更新」
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
        // 如果前端沒傳這個 key，代表只是「讀取」，直接回傳 serverLogs
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
  try {
    await sheet.loadHeaderRow();
  } catch (e) {
    await sheet.setHeaderRow(headers);
  }
  
  let rows = [];
  try {
    rows = await sheet.getRows();
  } catch (e) {
    // Return empty array if getting rows fails
    return [];
  }
  return rows.map(row => {
    const obj: any = {};
    headers.forEach(header => {
      obj[header] = row.get(header) !== undefined ? String(row.get(header)) : "";
    });
    return obj;
  });
}

async function saveLogsToSheet(sheet: GoogleSpreadsheetWorksheet, logs: any[], headers: string[]) {
  await sheet.clearRows();
  if (logs.length === 0) return;
  
  // Google Sheets API 有時對一次寫入太多筆資料會超時，我們一次最多新增 100 筆
  const chunkSize = 100;
  for (let i = 0; i < logs.length; i += chunkSize) {
    const chunk = logs.slice(i, i + chunkSize);
    const rows = chunk.map(log => {
      const rowObj: any = {};
      headers.forEach(header => {
        rowObj[header] = log[header] !== undefined ? String(log[header]) : "";
      });
      return rowObj;
    });
    await sheet.addRows(rows);
  }
}
