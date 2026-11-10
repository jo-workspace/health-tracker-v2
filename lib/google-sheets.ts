import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// In-memory document and load deduplication
let cachedDoc: GoogleSpreadsheet | null = null;
let lastDocLoadTime = 0;
let docInflightPromise: Promise<GoogleSpreadsheet> | null = null;

// Helper to handle defensive private key escaping and sanitization
const getPrivateKey = () => {
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!key) return '';
  let sanitized = key.trim();
  if (
    (sanitized.startsWith('"') && sanitized.endsWith('"')) ||
    (sanitized.startsWith("'") && sanitized.endsWith("'"))
  ) {
    sanitized = sanitized.slice(1, -1);
  }
  return sanitized.replace(/\\n/g, '\n').replace(/\r/g, '').trim();
};

/** 快取失效：在需要強制重載 Google Sheets 實例時調用 */
export function invalidateDocCache(): void {
  cachedDoc = null;
  lastDocLoadTime = 0;
}

/**
 * 取得 GoogleSpreadsheet 實例，具備內存快取與並行請求去重防禦
 * 避免短時間內多次調用 doc.loadInfo() 燒光 Google Sheets 60 req/min 配額
 */
export async function getGoogleSheet(options?: {
  ttlMs?: number;
  forceRefresh?: boolean;
}): Promise<GoogleSpreadsheet> {
  const ttlMs = options?.ttlMs ?? 60_000;
  const forceRefresh = options?.forceRefresh ?? false;

  // 1. 若快取未過期且不強制刷新，直接回傳快取實例
  if (!forceRefresh && cachedDoc && Date.now() - lastDocLoadTime < ttlMs) {
    return cachedDoc;
  }

  // 2. 若當前已有正在進行中的 loadInfo 請求，共享同一個 Promise
  if (docInflightPromise) {
    return await docInflightPromise;
  }

  // 3. 執行單次 loadInfo 並快取
  docInflightPromise = (async () => {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = getPrivateKey();

    if (!sheetId || !clientEmail || !privateKey) {
      throw new Error(
        'Google Sheets API credentials are missing in Environment Variables. Please set GOOGLE_SHEET_ID, GOOGLE_CLIENT_EMAIL, and GOOGLE_PRIVATE_KEY in .env.local'
      );
    }

    const serviceAccountAuth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();

    cachedDoc = doc;
    lastDocLoadTime = Date.now();
    return doc;
  })().finally(() => {
    docInflightPromise = null;
  });

  return await docInflightPromise;
}
