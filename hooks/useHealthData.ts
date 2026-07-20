'use client';
import { useState, useEffect, useCallback } from 'react';
import { syncBatch } from '@/lib/api';
import type { HealthData, SyncPayload } from '@/lib/types';

export function useHealthData() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await syncBatch({});
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  return { data, loading, syncing, updateData };
}
