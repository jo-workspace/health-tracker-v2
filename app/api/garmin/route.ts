import { NextRequest, NextResponse } from 'next/server';
import {
  obtainGarminBearerToken,
  fetchGarminSleepForDate,
  fetchGarminRecentSleepMap,
  fetchGarminRunningActivities,
  fetchGarminMenstrualCycle,
} from '@/lib/garmin';
import type { GarminOverviewData } from '@/lib/types';

const DEFAULT_EXPIRES_AT = process.env.GARMIN_API_KEY_EXPIRES_AT || '2027-11-19';

interface OverviewCache {
  keyHash: string;
  data: GarminOverviewData;
  timestamp: number;
}

let cachedOverview: OverviewCache | null = null;
const OVERVIEW_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

function getTaipeiDateStr(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86400 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function getMondayOfCurrentWeekTaipei(todayStr: string): string {
  const [y, m, d] = todayStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0 is Sunday
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

function computeExpiryInfo(expiresAtStr: string): {
  expiresAt: string;
  daysUntilExpiry: number;
  isExpiringSoon: boolean;
} {
  const cleanDate = expiresAtStr.trim() || DEFAULT_EXPIRES_AT;
  const todayStr = getTaipeiDateStr(0);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const [ey, em, ed] = cleanDate.split('-').map(Number);

  const todayMs = Date.UTC(ty, (tm || 1) - 1, td || 1);
  const expMs = Date.UTC(ey || 2027, (em || 11) - 1, ed || 19);
  const daysUntilExpiry = Math.round((expMs - todayMs) / (1000 * 60 * 60 * 24));

  return {
    expiresAt: cleanDate,
    daysUntilExpiry,
    isExpiringSoon: daysUntilExpiry <= 14,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedPassword = process.env.APP_PASSWORD;
    if (expectedPassword && authHeader !== `Bearer ${expectedPassword}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customApiKey = request.headers.get('x-garmin-api-key')?.trim();
    const customExpiresAt = request.headers.get('x-garmin-expires-at')?.trim();

    const apiKey = customApiKey || process.env.GARMIN_PERSONAL_API_KEY || '';
    const expiresAtStr = customExpiresAt || DEFAULT_EXPIRES_AT;
    const expiryInfo = computeExpiryInfo(expiresAtStr);

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'overview';
    const forceRefresh = searchParams.get('refresh') === '1';

    if (!apiKey) {
      if (mode === 'sleep') {
        return NextResponse.json({ configured: false, sleep: null });
      }
      const emptyOverview: GarminOverviewData = {
        configured: false,
        ...expiryInfo,
        cycle: null,
        running: {
          weeklyRuns: 0,
          weeklyDistanceKm: 0,
          weeklyDurationSeconds: 0,
          weeklyTrainingLoad: 0,
          recentActivities: [],
        },
        recentSleepMap: {},
        fetchedAt: Date.now(),
      };
      return NextResponse.json(emptyOverview);
    }

    const token = await obtainGarminBearerToken(apiKey, forceRefresh);

    if (mode === 'sleep') {
      const targetDate = searchParams.get('date') || getTaipeiDateStr(0);
      const sleep = await fetchGarminSleepForDate(token, targetDate);
      return NextResponse.json({
        configured: true,
        sleep,
      });
    }

    // Overview mode
    const keyHash = `${apiKey.slice(0, 16)}:${expiresAtStr}`;
    if (
      !forceRefresh &&
      cachedOverview &&
      cachedOverview.keyHash === keyHash &&
      Date.now() - cachedOverview.timestamp < OVERVIEW_CACHE_TTL_MS
    ) {
      return NextResponse.json(cachedOverview.data);
    }

    const todayStr = getTaipeiDateStr(0);
    const start10DaysAgo = getTaipeiDateStr(-9);

    const [cycle, activities, recentSleepMap] = await Promise.all([
      fetchGarminMenstrualCycle(token, todayStr),
      fetchGarminRunningActivities(token, 20),
      fetchGarminRecentSleepMap(token, start10DaysAgo, todayStr),
    ]);

    const mondayStr = getMondayOfCurrentWeekTaipei(todayStr);
    const thisWeekRuns = activities.filter(a => a.date >= mondayStr);

    const weeklyRuns = thisWeekRuns.length;
    const weeklyDistanceKm = +thisWeekRuns
      .reduce((sum, a) => sum + (a.distanceKm || 0), 0)
      .toFixed(1);
    const weeklyDurationSeconds = thisWeekRuns.reduce(
      (sum, a) => sum + (a.durationSeconds || 0),
      0
    );
    const weeklyTrainingLoad = Math.round(
      thisWeekRuns.reduce((sum, a) => sum + (a.trainingLoad || 0), 0)
    );

    const overviewData: GarminOverviewData = {
      configured: true,
      ...expiryInfo,
      cycle,
      running: {
        weeklyRuns,
        weeklyDistanceKm,
        weeklyDurationSeconds,
        weeklyTrainingLoad,
        recentActivities: activities.slice(0, 15),
      },
      recentSleepMap,
      fetchedAt: Date.now(),
    };

    cachedOverview = {
      keyHash,
      data: overviewData,
      timestamp: Date.now(),
    };

    return NextResponse.json(overviewData);
  } catch (error: any) {
    console.error('[API/garmin GET] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Garmin API request failed' },
      { status: 500 }
    );
  }
}
