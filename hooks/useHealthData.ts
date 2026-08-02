'use client';
import { useState, useEffect, useCallback } from 'react';
import { syncBatch } from '@/lib/api';
import type { HealthData, SyncPayload } from '@/lib/types';

export function useHealthData() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    // 1. Optimistic UI: Load from cache immediately
    const cached = localStorage.getItem('health_data_cache');
    if (cached) {
      try {
        setData(JSON.parse(cached));
        setLoading(false); // Stop loading immediately if cache exists
      } catch (e) {
        console.error('Cache parsing error:', e);
      }
    }

    // 2. Background sync
    setSyncing(true);
    try {
      const res = await syncBatch({ clientTimestamp: Date.now() });
      setData(res);
      localStorage.setItem('health_data_cache', JSON.stringify(res));
    } catch (e: any) {
      console.error(e);
      alert('同步失敗：' + e.message);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 必須是穩定的參考：子元件 (如 SupplementTracker) 會把它放進 useEffect 依賴陣列，
  // 每次 render 都換一個新函式會讓那些 effect 無止盡重跑
  const updateData = useCallback(async (payload: SyncPayload) => {
    setSyncing(true);
    try {
      const res = await syncBatch(payload);
      setData(prev => {
        const newData = prev ? { ...prev, ...res } as HealthData : res;
        localStorage.setItem('health_data_cache', JSON.stringify(newData));
        return newData;
      });
    } catch (e: any) {
      console.error(e);
      alert('儲存失敗：' + e.message);
    } finally {
      setSyncing(false);
    }
  }, []);

  return { data, loading, syncing, updateData, forceSync: loadData };
}
