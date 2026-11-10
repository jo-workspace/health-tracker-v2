import type { HealthData, SyncPayload } from './types';

/** 同步資料到 Google Sheets */
export async function syncBatch(payload: SyncPayload): Promise<HealthData> {
  const password = typeof window !== 'undefined' ? localStorage.getItem('app_password') || '' : '';
  const controller = new AbortController();
  // 延長逾時至 60 秒，避免 Google Sheets 進行指數退避重試時被前端 AbortController 提早中斷
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${password}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`無法解析伺服器回應 (${res.status})`);
    }
    
    if (!res.ok || data.status === 'error') {
      throw new Error(`[Server API Error]: ${data.message || res.statusText || 'Unknown error'}`);
    }
    return data as HealthData;
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      throw new Error('同步連線逾時（Google Sheets 伺服器正在處理中），請稍候片刻再試');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
