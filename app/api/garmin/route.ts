import { NextRequest, NextResponse } from 'next/server';
import {
  obtainGarminBearerToken,
  fetchGarminSleepForDate,
  fetchGarminWellnessRange,
  fetchGarminRunningActivities,
  fetchGarminMenstrualCycle,
  fetchGarminCalendarWorkouts,
} from '@/lib/garmin';
import {
  DEFAULT_CALENDAR_ICS_URL,
  getGarminConfigFromSheet,
  saveGarminConfigToSheet,
  syncGarminDataToGoogleSheets,
  readOverviewFromGoogleSheets,
  buildOverviewData,
} from '@/lib/garmin/sheets';
import {
  DEFAULT_EXPIRES_AT,
  getTaipeiDateStr,
  computeExpiryInfo,
} from '@/lib/garmin/time';
import type { GarminOverviewData } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedPassword = process.env.APP_PASSWORD;
    if (expectedPassword && authHeader !== `Bearer ${expectedPassword}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const sheetConfig = await getGarminConfigFromSheet(true);

    const rawInputKey = String(body.apiKey || '').trim();
    const apiKey = rawInputKey || sheetConfig?.apiKey || process.env.GARMIN_PERSONAL_API_KEY || '';
    const expiresAt = String(body.expiresAt || sheetConfig?.expiresAt || DEFAULT_EXPIRES_AT).trim();
    const calendarIcsUrl =
      body.calendarIcsUrl !== undefined
        ? String(body.calendarIcsUrl).trim() || DEFAULT_CALENDAR_ICS_URL
        : sheetConfig?.calendarIcsUrl || DEFAULT_CALENDAR_ICS_URL;

    if (apiKey) {
      await obtainGarminBearerToken(apiKey, true);
    }

    // Reset lastSyncDate so next GET immediately runs a full sync
    await saveGarminConfigToSheet(apiKey, expiresAt, '', calendarIcsUrl);

    return NextResponse.json({
      status: 'ok',
      configured: Boolean(apiKey),
      calendarIcsConfigured: Boolean(calendarIcsUrl),
      ...computeExpiryInfo(expiresAt),
    });
  } catch (error: any) {
    console.error('[API/garmin POST] Error:', error);
    return NextResponse.json(
      { error: error?.message || '儲存 Garmin 金鑰至 Google Sheets 失敗' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'overview';
    const forceRefresh = searchParams.get('refresh') === '1' || mode === 'cron';

    const authHeader = request.headers.get('authorization');
    const expectedPassword = process.env.APP_PASSWORD;
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;
    if (
      expectedPassword &&
      authHeader !== `Bearer ${expectedPassword}` &&
      !isCronAuthorized
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customApiKey = request.headers.get('x-garmin-api-key')?.trim();
    const customExpiresAt = request.headers.get('x-garmin-expires-at')?.trim();
    const customCalendarIcs = request.headers.get('x-garmin-calendar-ics')?.trim();

    let sheetConfig: Awaited<ReturnType<typeof getGarminConfigFromSheet>> = null;
    let sheetConfigError: unknown = null;
    try {
      sheetConfig = await getGarminConfigFromSheet(forceRefresh);
    } catch (err) {
      sheetConfigError = err;
      console.warn('[GarminConfig] Failed to read from Google Sheets:', err);
    }

    const apiKey =
      customApiKey || process.env.GARMIN_PERSONAL_API_KEY || sheetConfig?.apiKey || '';
    const expiresAtStr =
      customExpiresAt ||
      process.env.GARMIN_API_KEY_EXPIRES_AT ||
      sheetConfig?.expiresAt ||
      DEFAULT_EXPIRES_AT;
    const calendarIcsUrl =
      customCalendarIcs ||
      sheetConfig?.calendarIcsUrl ||
      DEFAULT_CALENDAR_ICS_URL;
    const lastSyncDate = sheetConfig?.lastSyncDate || '';

    const expiryInfo = computeExpiryInfo(expiresAtStr);
    const todayStr = getTaipeiDateStr(0);

    if (!apiKey) {
      if (sheetConfigError) {
        return NextResponse.json(
          { error: '暫時無法讀取 Garmin 設定，請稍後再試' },
          { status: 503 }
        );
      }
      if (mode === 'sleep') {
        return NextResponse.json({ configured: false, sleep: null });
      }
      const emptyOverview: GarminOverviewData = {
        configured: false,
        ...expiryInfo,
        calendarIcsConfigured: Boolean(calendarIcsUrl),
        cycle: null,
        running: {
          weeklyRuns: 0,
          weeklyDistanceKm: 0,
          weeklyDurationSeconds: 0,
          weeklyTrainingLoad: 0,
          recentActivities: [],
          scheduledWorkouts: [],
        },
        recentSleepMap: {},
        fetchedAt: Date.now(),
      };
      return NextResponse.json(emptyOverview);
    }

    if (mode === 'sleep') {
      const token = await obtainGarminBearerToken(apiKey, forceRefresh);
      const targetDate = searchParams.get('date') || todayStr;
      const sleep = await fetchGarminSleepForDate(token, targetDate);
      return NextResponse.json({
        configured: true,
        sleep,
      });
    }

    // Daily Gatekeeper: read directly from Google Sheets (single source of truth across all Serverless instances)
    if (!forceRefresh && lastSyncDate === todayStr) {
      const sheetOverview = await readOverviewFromGoogleSheets({
        todayStr,
        expiryInfo,
        lastSyncDate,
        calendarIcsUrl,
      });
      if (sheetOverview) {
        return NextResponse.json(sheetOverview);
      }
    }

    // Full Garmin fetch + non-destructive Google Sheets sync
    const startDate = getTaipeiDateStr(-29);
    const hrvStartDate = getTaipeiDateStr(-180);

    const token = await obtainGarminBearerToken(apiKey, forceRefresh);
    const cycle = await fetchGarminMenstrualCycle(token, todayStr);
    const [{ sleepMap, dailyWellnessList }, activities, allScheduledWorkouts] = await Promise.all([
      fetchGarminWellnessRange(token, startDate, todayStr, cycle, hrvStartDate),
      fetchGarminRunningActivities(token, 35),
      fetchGarminCalendarWorkouts(calendarIcsUrl),
    ]);

    // Persist to Google Sheets before returning success so UI never shows unsaved phantom state
    await syncGarminDataToGoogleSheets({
      dailyWellnessList,
      sleepMap,
      activities,
      scheduledWorkouts: allScheduledWorkouts,
      apiKey,
      expiresAt: expiryInfo.expiresAt,
      calendarIcsUrl,
      todayStr,
      token,
    });

    const overviewData = buildOverviewData({
      todayStr,
      expiryInfo,
      lastSyncDate: todayStr,
      calendarIcsUrl,
      cycle,
      activities,
      scheduledWorkouts: allScheduledWorkouts,
      recentSleepMap: sleepMap,
    });

    return NextResponse.json(overviewData);
  } catch (error: any) {
    console.error('[API/garmin GET] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Garmin API request failed' },
      { status: 500 }
    );
  }
}
