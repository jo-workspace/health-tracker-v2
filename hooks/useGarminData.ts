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
  const [garminError, setGarminError] = useState<string | null>(null);

  const lastFetchRef = useRef<number>(0);

  const loadGarmin = useCallback(async (forceRefresh = false, silent = false) => {
    if (!silent) {
      setGarminError(null);
    }
    if (!silent && !forceRefresh) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as GarminOverviewData;
          if (parsed?.configured) {
            setGarminData(parsed);
            setGarminLoading(false);
          }
        } catch {}
      }
    }

    setGarminRefreshing(true);
    try {
      const res = await fetchGarminOverview(forceRefresh);
      if (res.configured) {
        setGarminData(prev => {
          if (
            prev?.configured &&
            prev.fetchedAt &&
            res.fetchedAt &&
            res.fetchedAt < prev.fetchedAt
          ) {
            return prev;
          }
          localStorage.setItem(CACHE_KEY, JSON.stringify(res));
          return res;
        });
      } else {
        localStorage.removeItem(CACHE_KEY);
        if (!silent) {
          setGarminData(prev => (prev?.configured ? prev : res));
        }
      }
      setGarminError(null);
      lastFetchRef.current = Date.now();
    } catch (e: any) {
      console.warn('[useGarminData] Failed to load Garmin overview:', e);
      if (!silent) {
        setGarminError(e?.message || 'Garmin 同步失敗');
      }
    } finally {
      setGarminLoading(false);
      setGarminRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    let hasConfiguredCache = false;
    if (cached) {
      try {
        hasConfiguredCache = Boolean(JSON.parse(cached)?.configured);
      } catch {}
    }
    // 只有在完全無有效快取時才進行首次強制抓取；已有快取時一律走標準同步，避免每次重載頁面燒光 Sheets 配額
    loadGarmin(!hasConfiguredCache, false);
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
    garminError,
    refreshGarmin: (force = true) => loadGarmin(force, false),
  };
}
