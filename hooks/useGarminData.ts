'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchGarminOverview } from '@/lib/api';
import type { GarminOverviewData } from '@/lib/types';

const CACHE_KEY = 'garmin_overview_cache_v1';
const THROTTLE_MS = 300 * 1000; // 5 分鐘節流，防止切換視窗頻繁重試

export function useGarminData() {
  const [garminData, setGarminData] = useState<GarminOverviewData | null>(null);
  const [garminLoading, setGarminLoading] = useState(true);
  const [garminRefreshing, setGarminRefreshing] = useState(false);

  const lastFetchRef = useRef<number>(0);

  const loadGarmin = useCallback(async (forceRefresh = false, silent = false) => {
    if (!silent && !forceRefresh) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          setGarminData(JSON.parse(cached));
          setGarminLoading(false);
        } catch {}
      }
    }

    setGarminRefreshing(true);
    try {
      const res = await fetchGarminOverview(forceRefresh);
      setGarminData(res);
      localStorage.setItem(CACHE_KEY, JSON.stringify(res));
      lastFetchRef.current = Date.now();
    } catch (e) {
      console.warn('[useGarminData] Failed to load Garmin overview:', e);
    } finally {
      setGarminLoading(false);
      setGarminRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    // 只有在完全無本地快取時才進行首次強制抓取；已有快取時一律走標準同步，避免每次重載頁面燒光 Sheets 配額
    const shouldForce = !cached;
    loadGarmin(shouldForce, false);
  }, [loadGarmin]);

  useEffect(() => {
    const handleFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (Date.now() - lastFetchRef.current > THROTTLE_MS) {
          loadGarmin(false, true);
        }
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [loadGarmin]);

  return {
    garminData,
    garminLoading,
    garminRefreshing,
    refreshGarmin: (force = true) => loadGarmin(force, false),
  };
}
