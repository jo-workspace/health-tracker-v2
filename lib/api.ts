import type { HealthData, SyncPayload } from './types';

/** 同步資料到 Google Sheets */
export async function syncBatch(payload: SyncPayload): Promise<HealthData> {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`Failed to parse API response: ${res.status}`);
  }
  
  if (!res.ok || data.status === 'error') {
    throw new Error(`[Server API Error]: ${data.message || res.statusText || 'Unknown error'}`);
  }
  return data as HealthData;
}
