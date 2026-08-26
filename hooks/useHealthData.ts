'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { syncBatch } from '@/lib/api';
import type { HealthData, SyncPayload } from '@/lib/types';

const THROTTLE_INTERVAL_MS = 30 * 1000; // 喚醒自動同步間隔至少 30 秒

export function useHealthData() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [initialSynced, setInitialSynced] = useState(false);

  const lastSyncTimeRef = useRef<number>(0);
  const lastKnownDateRef = useRef<string>('');

  const loadData = useCallback(async (silent = false) => {
    // 1. Optimistic UI: 從本地快取立即載入
    if (!silent) {
      const cached = localStorage.getItem('health_data_cache');
      if (cached) {
        try {
          setData(JSON.parse(cached));
          setLoading(false);
        } catch (e) {
          console.error('Cache parsing error:', e);
        }
      }
    }

    // 2. 雲端同步
    setSyncing(true);
    try {
      const res = await syncBatch({ clientTimestamp: Date.now() });
      setData(res);
      localStorage.setItem('health_data_cache', JSON.stringify(res));
      lastSyncTimeRef.current = Date.now();
    } catch (e: any) {
      console.error(e);
      if (!silent) {
        alert('同步失敗：' + e.message);
      }
    } finally {
      setLoading(false);
      setSyncing(false);
      setInitialSynced(true);
    }
  }, []);

  // 初始載入
  useEffect(() => {
    lastKnownDateRef.current = new Date().toLocaleDateString('en-CA');
    loadData(false);
  }, [loadData]);

  // 跨日與頁面喚醒 (Visibility / Focus) 偵測
  useEffect(() => {
    const handleWakeOrDateChange = () => {
      if (typeof document === 'undefined') return;

      const isVisible = document.visibilityState === 'visible';
      if (!isVisible) return;

      const currentDateStr = new Date().toLocaleDateString('en-CA');
      const isDateChanged = lastKnownDateRef.current && lastKnownDateRef.current !== currentDateStr;
      const now = Date.now();
      const isThrottled = now - lastSyncTimeRef.current < THROTTLE_INTERVAL_MS;

      // 若跨日或是超過節流間隔切回，在背景靜默同步最新雲端資料
      if (isDateChanged || !isThrottled) {
        if (isDateChanged) {
          lastKnownDateRef.current = currentDateStr;
        }
        loadData(true);
      }
    };

    document.addEventListener('visibilitychange', handleWakeOrDateChange);
    window.addEventListener('focus', handleWakeOrDateChange);

    return () => {
      document.removeEventListener('visibilitychange', handleWakeOrDateChange);
      window.removeEventListener('focus', handleWakeOrDateChange);
    };
  }, [loadData]);

  const updateData = async (payload: SyncPayload) => {
    setSyncing(true);
    try {
      const res = await syncBatch(payload);
      setData(prev => {
        const newData = prev ? { ...prev, ...res } as HealthData : res;
        localStorage.setItem('health_data_cache', JSON.stringify(newData));
        return newData;
      });
      lastSyncTimeRef.current = Date.now();
    } catch (e: any) {
      console.error(e);
      alert('儲存失敗：' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  return {
    data,
    loading,
    syncing,
    initialSynced,
    updateData,
    forceSync: () => loadData(false)
  };
}
