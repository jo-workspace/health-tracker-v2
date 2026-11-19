import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  obtainGarminBearerToken,
  fetchGarminSleepForDate,
  fetchGarminWellnessRange,
  fetchGarminRunningActivities,
  fetchGarminMenstrualCycle,
} from '@/lib/garmin';
import { getGoogleSheet } from '@/lib/google-sheets';
import type {
  GarminOverviewData,
  GarminSleepData,
  GarminRunningActivity,
  GarminDailyWellnessLog,
} from '@/lib/types';

const DEFAULT_EXPIRES_AT = process.env.GARMIN_API_KEY_EXPIRES_AT || '2027-11-19';
const GARMIN_CONFIG_SHEET_TITLE = 'GarminConfig';
const GARMIN_CONFIG_HEADERS = ['apiKey', 'expiresAt', 'lastSyncDate', 'updatedAt'];

function getEncryptionKeyBuffer(): Buffer {
  const secret =
    process.env.APP_PASSWORD ||
    process.env.GOOGLE_PRIVATE_KEY ||
    process.env.GOOGLE_CLIENT_EMAIL ||
    'health-tracker-v2-garmin-secret';
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptApiKeyForSheet(plainKey: string): string {
  const trimmed = plainKey.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('ENC:')) return trimmed;
  const key = getEncryptionKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `ENC:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptApiKeyFromSheet(storedValue: string): string {
  const trimmed = storedValue.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('ENC:')) {
    return trimmed;
  }
  try {
    const parts = trimmed.split(':');
    if (parts.length !== 4) return '';
    const iv = Buffer.from(parts[1], 'base64');
    const authTag = Buffer.from(parts[2], 'base64');
    const encrypted = Buffer.from(parts[3], 'base64');
    const key = getEncryptionKeyBuffer();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.warn('[GarminConfig] Failed to decrypt stored API key:', err);
    return '';
  }
}

const GARMIN_WELLNESS_SHEET_TITLE = 'GarminDailyWellness';
const GARMIN_WELLNESS_HEADERS = [
  'date',
  'sleepScore',
  'sleepHours',
  'deepSleepHours',
  'remSleepHours',
  'bedtime',
  'wakeupTime',
  'hrv',
  'hrvStatus',
  'restingHeartRate',
  'avgStress',
  'bodyBatteryHigh',
  'bodyBatteryLow',
  'totalSteps',
  'activeCalories',
  'cycleDay',
  'cyclePhase',
  'cycleStartDate',
  'lastUpdated',
];

const GARMIN_RUNNING_SHEET_TITLE = 'GarminRunningLogs';
const GARMIN_RUNNING_HEADERS = [
  'activityId',
  'date',
  'startTime',
  'name',
  'distanceKm',
  'durationMinutes',
  'pace',
  'averageHR',
  'maxHR',
  'avgPower',
  'cadence',
  'strideLengthCm',
  'groundContactTimeMs',
  'aerobicTE',
  'anaerobicTE',
  'trainingLoad',
  'calories',
  'lastUpdated',
];

const SLEEP_LOGS_SHEET_TITLE = 'SleepLogs';
const SLEEP_LOGS_HEADERS = [
  'id',
  'date',
  'type',
  'bedtime',
  'fallAsleepTime',
  'wakeupTime',
  'sleepDuration',
  'deepSleep',
  'remSleep',
  'stress',
  'feeling',
  'hrv',
  'restingHeartRate',
  'sleepScore',
  'notes',
  'status',
  'lastUpdated',
];

interface OverviewCache {
  keyHash: string;
  dateStr: string;
  data: GarminOverviewData;
  timestamp: number;
}

interface StoredConfigCache {
  apiKey: string;
  expiresAt: string;
  lastSyncDate: string;
  timestamp: number;
}

let cachedOverview: OverviewCache | null = null;
let cachedSheetConfig: StoredConfigCache | null = null;
const SHEET_CONFIG_CACHE_TTL_MS = 10 * 60 * 1000;

async function getOrCreateSheet(doc: any, title: string, headers: string[]) {
  let sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    try {
      sheet = await doc.addSheet({ title, headerValues: headers });
    } catch {
      await doc.loadInfo();
      sheet = doc.sheetsByTitle[title];
    }
  } else {
    try {
      await sheet.loadHeaderRow();
      const existing = sheet.headerValues || [];
      const missing = headers.filter(h => !existing.includes(h));
      if (missing.length > 0) {
        const merged = [...existing, ...missing];
        if (merged.length > sheet.columnCount) {
          await sheet.resize({ rowCount: sheet.rowCount, columnCount: merged.length });
        }
        await sheet.setHeaderRow(merged);
      }
    } catch {}
  }
  return sheet;
}

async function getGarminConfigFromSheet(): Promise<{
  apiKey: string;
  expiresAt: string;
  lastSyncDate: string;
} | null> {
  if (
    cachedSheetConfig &&
    Date.now() - cachedSheetConfig.timestamp < SHEET_CONFIG_CACHE_TTL_MS
  ) {
    return {
      apiKey: cachedSheetConfig.apiKey,
      expiresAt: cachedSheetConfig.expiresAt,
      lastSyncDate: cachedSheetConfig.lastSyncDate,
    };
  }

  try {
    const doc = await getGoogleSheet();
    const sheet = doc.sheetsByTitle[GARMIN_CONFIG_SHEET_TITLE];
    if (!sheet) return null;
    const rows = await sheet.getRows();
    if (rows.length === 0) return null;
    const latestRow = rows[rows.length - 1];
    const rawStoredKey = String(latestRow.get('apiKey') || '').trim();
    const apiKey = decryptApiKeyFromSheet(rawStoredKey);
    const expiresAt = String(latestRow.get('expiresAt') || DEFAULT_EXPIRES_AT).trim();
    const lastSyncDate = String(latestRow.get('lastSyncDate') || '').trim();

    // If an old plain-text key was stored, auto-upgrade it to encrypted in the sheet
    if (apiKey && rawStoredKey && !rawStoredKey.startsWith('ENC:')) {
      latestRow.set('apiKey', encryptApiKeyForSheet(apiKey));
      await latestRow.save().catch(() => {});
    }

    if (apiKey) {
      cachedSheetConfig = {
        apiKey,
        expiresAt,
        lastSyncDate,
        timestamp: Date.now(),
      };
      return { apiKey, expiresAt, lastSyncDate };
    }
    return null;
  } catch (err) {
    console.warn('[GarminConfig] Failed to read from Google Sheets:', err);
    return null;
  }
}

async function saveGarminConfigToSheet(
  apiKey: string,
  expiresAt: string,
  lastSyncDate?: string
): Promise<void> {
  const cleanKey = apiKey.trim();
  const cleanExp = expiresAt.trim() || DEFAULT_EXPIRES_AT;
  const cleanSyncDate =
    lastSyncDate !== undefined ? lastSyncDate : cachedSheetConfig?.lastSyncDate || '';

  const doc = await getGoogleSheet();
  const sheet = await getOrCreateSheet(doc, GARMIN_CONFIG_SHEET_TITLE, GARMIN_CONFIG_HEADERS);
  await sheet.clearRows();

  if (cleanKey) {
    const encryptedKey = encryptApiKeyForSheet(cleanKey);
    await sheet.addRow({
      apiKey: encryptedKey,
      expiresAt: cleanExp,
      lastSyncDate: cleanSyncDate,
      updatedAt: new Date().toISOString(),
    });
    cachedSheetConfig = {
      apiKey: cleanKey,
      expiresAt: cleanExp,
      lastSyncDate: cleanSyncDate,
      timestamp: Date.now(),
    };
  } else {
    cachedSheetConfig = null;
  }
}

/**
 * Syncs Garmin Daily Wellness, Running Activities, and SleepLogs into Google Sheets.
 * Also returns whether any existing Google Sheets data was already present (to decide 30-day backfill vs 7-day update).
 */
async function syncGarminDataToGoogleSheets(params: {
  dailyWellnessList: GarminDailyWellnessLog[];
  sleepMap: Record<string, GarminSleepData>;
  activities: GarminRunningActivity[];
  apiKey: string;
  expiresAt: string;
  todayStr: string;
}): Promise<void> {
  const { dailyWellnessList, sleepMap, activities, apiKey, expiresAt, todayStr } = params;
  const doc = await getGoogleSheet();

  // 1. Upsert GarminDailyWellness
  const wellnessSheet = await getOrCreateSheet(
    doc,
    GARMIN_WELLNESS_SHEET_TITLE,
    GARMIN_WELLNESS_HEADERS
  );
  const existingWellnessRows = await wellnessSheet.getRows();
  const wellnessMap = new Map<string, any>();

  existingWellnessRows.forEach((r: any) => {
    const dt = String(r.get('date') || '').trim();
    if (!dt) return;
    const obj: any = {};
    GARMIN_WELLNESS_HEADERS.forEach(h => {
      obj[h] = r.get(h) ?? '';
    });
    wellnessMap.set(dt, obj);
  });

  dailyWellnessList.forEach(item => {
    const prev = wellnessMap.get(item.date) || {};
    wellnessMap.set(item.date, {
      ...prev,
      ...item,
      // Keep previous cycleDay/cyclePhase if current item didn't compute one
      cycleDay: item.cycleDay !== '' ? item.cycleDay : prev.cycleDay || '',
      cyclePhase: item.cyclePhase !== '' ? item.cyclePhase : prev.cyclePhase || '',
      cycleStartDate:
        item.cycleStartDate !== '' ? item.cycleStartDate : prev.cycleStartDate || '',
    });
  });

  const sortedWellness = Array.from(wellnessMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
  if (sortedWellness.length > 0) {
    await wellnessSheet.clearRows();
    await wellnessSheet.addRows(sortedWellness);
  }

  // 2. Upsert GarminRunningLogs
  const runningSheet = await getOrCreateSheet(
    doc,
    GARMIN_RUNNING_SHEET_TITLE,
    GARMIN_RUNNING_HEADERS
  );
  const existingRunRows = await runningSheet.getRows();
  const runMap = new Map<string, any>();

  existingRunRows.forEach((r: any) => {
    const id = String(r.get('activityId') || '').trim();
    if (!id) return;
    const obj: any = {};
    GARMIN_RUNNING_HEADERS.forEach(h => {
      obj[h] = r.get(h) ?? '';
    });
    runMap.set(id, obj);
  });

  const nowIso = new Date().toISOString();
  activities.forEach(act => {
    const id = String(act.activityId);
    runMap.set(id, {
      activityId: id,
      date: act.date,
      startTime: act.startTimeLocal.slice(11, 16),
      name: act.cleanName,
      distanceKm: act.distanceKm,
      durationMinutes: +(act.durationSeconds / 60).toFixed(1),
      pace: act.paceFormatted,
      averageHR: act.averageHR ?? '',
      maxHR: act.maxHR ?? '',
      avgPower: act.avgPower ?? '',
      cadence: act.cadence ?? '',
      strideLengthCm: act.strideLengthCm ?? '',
      groundContactTimeMs: act.groundContactTimeMs ?? '',
      aerobicTE: act.aerobicTE ?? '',
      anaerobicTE: act.anaerobicTE ?? '',
      trainingLoad: act.trainingLoad ?? '',
      calories: act.calories ?? '',
      lastUpdated: nowIso,
    });
  });

  const sortedRuns = Array.from(runMap.values()).sort((a, b) =>
    String(b.date).localeCompare(String(a.date))
  );
  if (sortedRuns.length > 0) {
    await runningSheet.clearRows();
    await runningSheet.addRows(sortedRuns);
  }

  // 3. Auto-populate SleepLogs so the user doesn't have to wait or manually load sleep
  const sleepSheet = await getOrCreateSheet(doc, SLEEP_LOGS_SHEET_TITLE, SLEEP_LOGS_HEADERS);
  const existingSleepRows = await sleepSheet.getRows();
  let sleepModified = false;

  const existingNightRowByDate = new Map<string, any>();
  existingSleepRows.forEach((row: any) => {
    const dt = String(row.get('date') || '').trim();
    const tp = String(row.get('type') || 'night').trim();
    const st = String(row.get('status') || 'active').trim();
    if (dt && tp === 'night' && st !== 'deleted') {
      existingNightRowByDate.set(dt, row);
    }
  });

  const newSleepRowsToAdd: any[] = [];
  for (const [dateStr, gSleep] of Object.entries(sleepMap)) {
    if (!gSleep || gSleep.sleepDurationHours <= 0) continue;
    const existingRow = existingNightRowByDate.get(dateStr);
    if (!existingRow) {
      // Auto-create night sleep row with feeling = '' (pending 1-tap feeling check-in on today)
      newSleepRowsToAdd.push({
        id: `sleep-garmin-${dateStr}`,
        date: dateStr,
        type: 'night',
        bedtime: gSleep.bedtime12h,
        fallAsleepTime: gSleep.bedtime12h,
        wakeupTime: gSleep.wakeupTime24h,
        sleepDuration: String(gSleep.sleepDurationHours),
        deepSleep: gSleep.deepSleepHours > 0 ? String(gSleep.deepSleepHours) : '',
        remSleep: gSleep.remSleepHours > 0 ? String(gSleep.remSleepHours) : '',
        stress: gSleep.sleepStress !== undefined ? String(gSleep.sleepStress) : '',
        feeling: '', // Empty so today's 1-tap feeling prompt triggers!
        hrv: gSleep.hrv !== undefined ? String(gSleep.hrv) : '',
        restingHeartRate:
          gSleep.restingHeartRate !== undefined ? String(gSleep.restingHeartRate) : '',
        sleepScore: gSleep.sleepScore !== undefined ? String(gSleep.sleepScore) : '',
        notes: '',
        status: 'active',
        lastUpdated: String(Date.now()),
      });
      sleepModified = true;
    } else {
      // Backfill missing objective fields (like sleepScore, hrv, deepSleep) on existing row without touching user's feeling/bedtime
      let rowChanged = false;
      if (!existingRow.get('sleepScore') && gSleep.sleepScore !== undefined) {
        existingRow.set('sleepScore', String(gSleep.sleepScore));
        rowChanged = true;
      }
      if (!existingRow.get('hrv') && gSleep.hrv !== undefined) {
        existingRow.set('hrv', String(gSleep.hrv));
        rowChanged = true;
      }
      if (!existingRow.get('restingHeartRate') && gSleep.restingHeartRate !== undefined) {
        existingRow.set('restingHeartRate', String(gSleep.restingHeartRate));
        rowChanged = true;
      }
      if (!existingRow.get('deepSleep') && gSleep.deepSleepHours > 0) {
        existingRow.set('deepSleep', String(gSleep.deepSleepHours));
        rowChanged = true;
      }
      if (!existingRow.get('remSleep') && gSleep.remSleepHours > 0) {
        existingRow.set('remSleep', String(gSleep.remSleepHours));
        rowChanged = true;
      }
      if (rowChanged) {
        await existingRow.save();
      }
    }
  }

  if (newSleepRowsToAdd.length > 0 && sleepModified) {
    await sleepSheet.addRows(newSleepRowsToAdd);
  }

  // 4. Record todayStr as lastSyncDate in GarminConfig
  await saveGarminConfigToSheet(apiKey, expiresAt, todayStr);
}

/**
 * Reads cached overview from Google Sheets when today has already been synced,
 * so we only hit Garmin API once per day!
 */
async function readOverviewFromGoogleSheets(params: {
  todayStr: string;
  expiryInfo: { expiresAt: string; daysUntilExpiry: number; isExpiringSoon: boolean };
  lastSyncDate: string;
}): Promise<GarminOverviewData | null> {
  try {
    const doc = await getGoogleSheet();
    const wellnessSheet = doc.sheetsByTitle[GARMIN_WELLNESS_SHEET_TITLE];
    const runningSheet = doc.sheetsByTitle[GARMIN_RUNNING_SHEET_TITLE];
    if (!wellnessSheet || !runningSheet) return null;

    const [wRows, rRows] = await Promise.all([
      wellnessSheet.getRows(),
      runningSheet.getRows(),
    ]);
    if (wRows.length === 0) return null;

    const recentSleepMap: Record<string, GarminSleepData> = {};
    let latestCycle: any = null;

    wRows.forEach((r: any) => {
      const dt = String(r.get('date') || '').trim();
      if (!dt) return;
      const dur = Number(r.get('sleepHours')) || 0;
      const bedtime12h = String(r.get('bedtime') || '');
      const m = bedtime12h.match(/(\d{1,2}:\d{2})\s*(AM|PM)/i);
      const totalMin = Math.round(dur * 60);

      recentSleepMap[dt] = {
        date: dt,
        bedtime12h,
        bedtimeTime: m ? m[1] : '',
        bedtimePeriod: (m && m[2].toUpperCase() === 'AM' ? 'AM' : 'PM') as 'AM' | 'PM',
        wakeupTime24h: String(r.get('wakeupTime') || ''),
        sleepDurationHours: dur,
        durationHoursPart: Math.floor(totalMin / 60),
        durationMinutesPart: totalMin % 60,
        deepSleepHours: Number(r.get('deepSleepHours')) || 0,
        remSleepHours: Number(r.get('remSleepHours')) || 0,
        lightSleepHours: 0,
        napMinutes: 0,
        sleepScore: r.get('sleepScore') ? Number(r.get('sleepScore')) : undefined,
        hrv: r.get('hrv') ? Number(r.get('hrv')) : undefined,
        hrvStatus: String(r.get('hrvStatus') || '') || undefined,
        restingHeartRate: r.get('restingHeartRate')
          ? Number(r.get('restingHeartRate'))
          : undefined,
      };

      const cDay = Number(r.get('cycleDay'));
      const cPhase = String(r.get('cyclePhase') || '');
      if (cDay > 0 && cPhase) {
        latestCycle = {
          startDate: String(r.get('cycleStartDate') || ''),
          dayInCycle: cDay,
          periodLength: 7,
          currentPhase: 0,
          phaseName: cPhase,
          lengthOfCurrentPhase: 0,
          daysUntilNextPhase: Math.max(0, 29 - cDay),
          predictedCycleLength: 29,
        };
      }
    });

    const activities: GarminRunningActivity[] = rRows.map((r: any) => {
      const durMin = Number(r.get('durationMinutes')) || 0;
      const h = Math.floor(durMin / 60);
      const m = Math.round(durMin % 60);
      const dt = String(r.get('date') || '');
      const st = String(r.get('startTime') || '06:00');
      return {
        activityId: Number(r.get('activityId')) || 0,
        name: String(r.get('name') || '跑步'),
        cleanName: String(r.get('name') || '跑步'),
        date: dt,
        startTimeLocal: `${dt} ${st}:00`,
        distanceKm: Number(r.get('distanceKm')) || 0,
        durationSeconds: Math.round(durMin * 60),
        durationFormatted: h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`,
        paceFormatted: String(r.get('pace') || '-'),
        averageHR: r.get('averageHR') ? Number(r.get('averageHR')) : undefined,
        maxHR: r.get('maxHR') ? Number(r.get('maxHR')) : undefined,
        avgPower: r.get('avgPower') ? Number(r.get('avgPower')) : undefined,
        cadence: r.get('cadence') ? Number(r.get('cadence')) : undefined,
        strideLengthCm: r.get('strideLengthCm') ? Number(r.get('strideLengthCm')) : undefined,
        groundContactTimeMs: r.get('groundContactTimeMs')
          ? Number(r.get('groundContactTimeMs'))
          : undefined,
        aerobicTE: r.get('aerobicTE') ? Number(r.get('aerobicTE')) : undefined,
        anaerobicTE: r.get('anaerobicTE') ? Number(r.get('anaerobicTE')) : undefined,
        trainingLoad: r.get('trainingLoad') ? Number(r.get('trainingLoad')) : undefined,
        calories: r.get('calories') ? Number(r.get('calories')) : undefined,
      };
    });

    const mondayStr = getMondayOfCurrentWeekTaipei(params.todayStr);
    const thisWeekRuns = activities.filter(a => a.date >= mondayStr);

    return {
      configured: true,
      ...params.expiryInfo,
      lastSyncDate: params.lastSyncDate,
      syncedToday: true,
      cycle: latestCycle,
      running: {
        weeklyRuns: thisWeekRuns.length,
        weeklyDistanceKm: +thisWeekRuns
          .reduce((sum, a) => sum + (a.distanceKm || 0), 0)
          .toFixed(1),
        weeklyDurationSeconds: thisWeekRuns.reduce(
          (sum, a) => sum + (a.durationSeconds || 0),
          0
        ),
        weeklyTrainingLoad: Math.round(
          thisWeekRuns.reduce((sum, a) => sum + (a.trainingLoad || 0), 0)
        ),
        recentActivities: activities.slice(0, 15),
      },
      recentSleepMap,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    console.warn('[Garmin] Failed to read cached overview from Google Sheets:', err);
    return null;
  }
}

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
  const day = dt.getUTCDay();
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

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedPassword = process.env.APP_PASSWORD;
    if (expectedPassword && authHeader !== `Bearer ${expectedPassword}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const apiKey = String(body.apiKey || '').trim();
    const expiresAt = String(body.expiresAt || DEFAULT_EXPIRES_AT).trim();

    if (apiKey) {
      await obtainGarminBearerToken(apiKey, true);
    }

    // Reset lastSyncDate to empty when key is updated so next GET immediately runs a full 30-day sync
    await saveGarminConfigToSheet(apiKey, expiresAt, '');
    cachedOverview = null;

    return NextResponse.json({
      status: 'ok',
      configured: Boolean(apiKey),
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

    // Allow Vercel Cron or APP_PASSWORD
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

    const sheetConfig = await getGarminConfigFromSheet();

    const apiKey =
      customApiKey || process.env.GARMIN_PERSONAL_API_KEY || sheetConfig?.apiKey || '';
    const expiresAtStr =
      customExpiresAt ||
      process.env.GARMIN_API_KEY_EXPIRES_AT ||
      sheetConfig?.expiresAt ||
      DEFAULT_EXPIRES_AT;
    const lastSyncDate = sheetConfig?.lastSyncDate || '';

    const expiryInfo = computeExpiryInfo(expiresAtStr);
    const todayStr = getTaipeiDateStr(0);

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

    if (mode === 'sleep') {
      const token = await obtainGarminBearerToken(apiKey, forceRefresh);
      const targetDate = searchParams.get('date') || todayStr;
      const sleep = await fetchGarminSleepForDate(token, targetDate);
      return NextResponse.json({
        configured: true,
        sleep,
      });
    }

    const keyHash = `${apiKey.slice(0, 16)}:${expiryInfo.expiresAt}`;

    // Daily Gatekeeper: If already synced today and not forced, return in-memory or Google Sheets snapshot without calling Garmin API!
    if (!forceRefresh) {
      if (
        cachedOverview &&
        cachedOverview.keyHash === keyHash &&
        cachedOverview.dateStr === todayStr
      ) {
        return NextResponse.json(cachedOverview.data);
      }

      if (lastSyncDate === todayStr) {
        const sheetOverview = await readOverviewFromGoogleSheets({
          todayStr,
          expiryInfo,
          lastSyncDate,
        });
        // Ensure today's sleep was already captured; if user opened app at 5am before waking up, and now opens at 8am, allow re-sync if today's sleep is missing
        if (sheetOverview && sheetOverview.recentSleepMap[todayStr]?.sleepDurationHours) {
          cachedOverview = {
            keyHash,
            dateStr: todayStr,
            data: sheetOverview,
            timestamp: Date.now(),
          };
          return NextResponse.json(sheetOverview);
        }
      }
    }

    // Perform the once-a-day Garmin fetch & Google Sheets sync!
    // If never synced before (lastSyncDate is empty), backfill 30 days; otherwise fetch last 10 days.
    const lookbackDays = !lastSyncDate ? -29 : -9;
    const startDate = getTaipeiDateStr(lookbackDays);

    const token = await obtainGarminBearerToken(apiKey, forceRefresh);
    const cycle = await fetchGarminMenstrualCycle(token, todayStr);
    const [{ sleepMap, dailyWellnessList }, activities] = await Promise.all([
      fetchGarminWellnessRange(token, startDate, todayStr, cycle),
      fetchGarminRunningActivities(token, !lastSyncDate ? 35 : 20),
    ]);

    // Sync to Google Sheets (GarminDailyWellness, GarminRunningLogs, SleepLogs)
    await syncGarminDataToGoogleSheets({
      dailyWellnessList,
      sleepMap,
      activities,
      apiKey,
      expiresAt: expiryInfo.expiresAt,
      todayStr,
    }).catch(err => {
      console.warn('[Garmin] Failed to sync to Google Sheets:', err);
    });

    const mondayStr = getMondayOfCurrentWeekTaipei(todayStr);
    const thisWeekRuns = activities.filter(a => a.date >= mondayStr);

    const overviewData: GarminOverviewData = {
      configured: true,
      ...expiryInfo,
      lastSyncDate: todayStr,
      syncedToday: true,
      cycle,
      running: {
        weeklyRuns: thisWeekRuns.length,
        weeklyDistanceKm: +thisWeekRuns
          .reduce((sum, a) => sum + (a.distanceKm || 0), 0)
          .toFixed(1),
        weeklyDurationSeconds: thisWeekRuns.reduce(
          (sum, a) => sum + (a.durationSeconds || 0),
          0
        ),
        weeklyTrainingLoad: Math.round(
          thisWeekRuns.reduce((sum, a) => sum + (a.trainingLoad || 0), 0)
        ),
        recentActivities: activities.slice(0, 15),
      },
      recentSleepMap: sleepMap,
      fetchedAt: Date.now(),
    };

    cachedOverview = {
      keyHash,
      dateStr: todayStr,
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
