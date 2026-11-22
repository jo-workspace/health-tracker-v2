'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchGarminOverview } from '@/lib/api';
import type { GarminOverviewData } from '@/lib/types';

const CACHE_KEY = 'garmin_overview_cache_v1';
const THROTTLE_MS = 120 * 1000; // 2 minutes throttle on window focus

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
    let shouldForce = false;
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const hasHrvStatus =
          parsed?.recentSleepMap &&
          Object.values(parsed.recentSleepMap).some((s: any) => Boolean(s.hrvStatus));
        const historyCount = parsed?.recentSleepMap ? Object.keys(parsed.recentSleepMap).length : 0;
        if (!hasHrvStatus || historyCount < 60) {
          shouldForce = true;
        }
      } catch {
        shouldForce = true;
      }
    } else {
      shouldForce = true;
    }
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
