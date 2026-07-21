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

  const updateData = async (payload: SyncPayload) => {
    setSyncing(true);
    try {
      const res = await syncBatch(payload);
      setData(res);
      localStorage.setItem('health_data_cache', JSON.stringify(res));
    } catch (e: any) {
      console.error(e);
      alert('儲存失敗：' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  return { data, loading, syncing, updateData, forceSync: loadData };
}
