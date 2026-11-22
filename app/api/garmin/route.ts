import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  obtainGarminBearerToken,
  fetchGarminSleepForDate,
  fetchGarminWellnessRange,
  fetchGarminRunningActivities,
  fetchGarminActivitySplits,
  fetchGarminMenstrualCycle,
  fetchGarminCalendarWorkouts,
} from '@/lib/garmin';
import { getGoogleSheet } from '@/lib/google-sheets';
import type {
  GarminOverviewData,
  GarminSleepData,
  GarminRunningActivity,
  GarminDailyWellnessLog,
  GarminScheduledWorkout,
  GarminMenstrualCycle,
} from '@/lib/types';

const DEFAULT_EXPIRES_AT = process.env.GARMIN_API_KEY_EXPIRES_AT || '2027-11-19';
const DEFAULT_CALENDAR_ICS_URL =
  process.env.GARMIN_CALENDAR_ICS_URL ||
  'https://connect.garmin.com/modern/calendar/export/b36fa1affbd1426cbdd9e8a920c8a2bc';

const GARMIN_CONFIG_SHEET_TITLE = 'GarminConfig';
const GARMIN_CONFIG_HEADERS = [
  'apiKey',
  'expiresAt',
  'calendarIcsUrl',
  'lastSyncDate',
  'updatedAt',
];

const GARMIN_RUNNING_SPLITS_SHEET_TITLE = 'GarminRunningSplits';
const GARMIN_RUNNING_SPLITS_HEADERS = [
  'activityId',
  'date',
  'lapIndex',
  'intensityType',
  'distanceMeters',
  'durationSeconds',
  'pace',
  'averageHR',
  'maxHR',
  'cadence',
  'strideLengthCm',
  'lastUpdated',
];

function getEncryptionKeyBuffer(): Buffer {
  const secret =
    process.env.APP_PASSWORD ||
    process.env.GOOGLE_PRIVATE_KEY ||
    process.env.GOOGLE_CLIENT_EMAIL ||
    'health-tracker-v2-garmin-secret';
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptSecretForSheet(plainText: string): string {
  const trimmed = plainText.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('ENC:')) return trimmed;
  const key = getEncryptionKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `ENC:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecretFromSheet(storedValue: string): string {
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
    console.warn('[GarminConfig] Failed to decrypt stored secret:', err);
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
  'scheduledWorkout',
  'lastUpdated',
];

const GARMIN_SCHEDULED_SHEET_TITLE = 'GarminScheduledWorkouts';
const GARMIN_SCHEDULED_HEADERS = ['date', 'summary', 'isRestDay', 'lastUpdated'];

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

const WELLNESS_LOGS_SHEET_TITLE = 'WellnessLogs';
const SLEEP_LOGS_SHEET_TITLE = WELLNESS_LOGS_SHEET_TITLE;
const SLEEP_LOGS_HEADERS = [
  'id',
  'date',
  'type',
  'bedtime',
  'fallAsleepTime',
  'wakeupTime',
  'sleepDuration',
  'napMinutes',
  'deepSleep',
  'remSleep',
  'stress',
  'feeling',
  'hrv',
  'hrvStatus',
  'restingHeartRate',
  'avgRespiration',
  'avgStress',
  'bodyBatteryHigh',
  'bodyBatteryLow',
  'totalSteps',
  'activeCalories',
  'cycleDay',
  'cyclePhase',
  'cycleStartDate',
  'scheduledWorkout',
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
  hasSplits?: boolean;
}

interface StoredConfigCache {
  apiKey: string;
  expiresAt: string;
  calendarIcsUrl: string;
  lastSyncDate: string;
  timestamp: number;
}

let cachedOverview: OverviewCache | null = null;
let cachedSheetConfig: StoredConfigCache | null = null;
const SHEET_CONFIG_CACHE_TTL_MS = 10 * 60 * 1000;

let garminSheetQueue: Promise<any> = Promise.resolve();
function enqueueGarminSheetOp<T>(op: () => Promise<T>): Promise<T> {
  const res = garminSheetQueue.then(op, op);
  garminSheetQueue = res.then(
    () => {},
    () => {}
  );
  return res;
}

async function withGarminApiRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const msg = String(err?.message || '');
      const isTransient =
        msg.includes('429') ||
        msg.includes('Quota exceeded') ||
        msg.includes('503') ||
        msg.includes('502') ||
        msg.includes('Service Unavailable');

      if (isTransient && attempt < maxRetries) {
        const delay = 1500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
        console.warn(`[Garmin Google Sheets API] Transient error (429/503), retrying ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw err;
      }
    }
  }
}

async function getOrCreateSheet(doc: any, title: string, headers: string[]) {
  const normTitle = title.trim().toLowerCase().replace(/[\s_-]+/g, '');
  const findSheet = () => {
    if (doc.sheetsByTitle[title]) return doc.sheetsByTitle[title];
    const exactMatch = Object.values(doc.sheetsByTitle).find((s: any) => {
      if (!s.title) return false;
      const sNorm = s.title.trim().toLowerCase().replace(/[\s_-]+/g, '');
      return sNorm === normTitle;
    });
    if (exactMatch) return exactMatch as any;

    if (normTitle === 'wellnesslogs' || normTitle === 'wellnesslog') {
      const legacyMatch = Object.values(doc.sheetsByTitle).find((s: any) => {
        if (!s.title) return false;
        const sNorm = s.title.trim().toLowerCase().replace(/[\s_-]+/g, '');
        return sNorm === 'wellness' || sNorm === 'sleeplogs' || sNorm === 'sleeplog';
      });
      if (legacyMatch) return legacyMatch as any;
    }
    return undefined;
  };

  let sheet = findSheet();
  if (!sheet) {
    try {
      sheet = await withGarminApiRetry(() => doc.addSheet({ title, headerValues: headers }));
    } catch {
      await withGarminApiRetry(() => doc.loadInfo());
      sheet = findSheet();
    }
  } else {
    // Automatically rename sheet tab if legacy spaced name is used (e.g. "sleep log" -> "SleepLogs")
    if (sheet.title !== title) {
      try {
        console.log(`[getOrCreateSheet] Renaming sheet '${sheet.title}' to '${title}'...`);
        await withGarminApiRetry(() => sheet.updateProperties({ title }));
        console.log(`[getOrCreateSheet] Successfully renamed sheet '${sheet.title}' to '${title}'.`);
      } catch (err) {
        console.warn(`[getOrCreateSheet] Could not rename sheet '${sheet.title}' to '${title}':`, err);
      }
    }

    try {
      await withGarminApiRetry(() => sheet.loadHeaderRow());
      const existing = sheet.headerValues || [];
      const missing = headers.filter(h => !existing.includes(h));
      if (missing.length > 0) {
        const merged = [...existing, ...missing];
        if (merged.length > sheet.columnCount) {
          await withGarminApiRetry(() => sheet.resize({ rowCount: sheet.rowCount, columnCount: merged.length }));
        }
        await withGarminApiRetry(() => sheet.setHeaderRow(merged));
      }
    } catch (err) {
      console.warn(`[getOrCreateSheet] Failed to update headers for ${title}:`, err);
    }
  }
  return sheet;
}

async function getGarminConfigFromSheet(): Promise<{
  apiKey: string;
  expiresAt: string;
  calendarIcsUrl: string;
  lastSyncDate: string;
} | null> {
  if (
    cachedSheetConfig &&
    Date.now() - cachedSheetConfig.timestamp < SHEET_CONFIG_CACHE_TTL_MS
  ) {
    return {
      apiKey: cachedSheetConfig.apiKey,
      expiresAt: cachedSheetConfig.expiresAt,
      calendarIcsUrl: cachedSheetConfig.calendarIcsUrl,
      lastSyncDate: cachedSheetConfig.lastSyncDate,
    };
  }

  return enqueueGarminSheetOp(async () => {
    try {
      const doc = await getGoogleSheet();
      const sheet = await getOrCreateSheet(doc, GARMIN_CONFIG_SHEET_TITLE, GARMIN_CONFIG_HEADERS);
      if (!sheet) return null;
      const rows = await sheet.getRows();
      if (rows.length === 0) return null;
      const latestRow = rows[rows.length - 1];
      const rawStoredKey = String(latestRow.get('apiKey') || '').trim();
      const rawStoredIcs = String(latestRow.get('calendarIcsUrl') || '').trim();
      const apiKey = decryptSecretFromSheet(rawStoredKey);
      const calendarIcsUrl =
        decryptSecretFromSheet(rawStoredIcs) || DEFAULT_CALENDAR_ICS_URL;
      const expiresAt = String(latestRow.get('expiresAt') || DEFAULT_EXPIRES_AT).trim();
      const lastSyncDate = String(latestRow.get('lastSyncDate') || '').trim();

      // If multiple duplicate rows exist or plain-text secret was stored, clean up to a single encrypted row
      const needsKeyEnc = rawStoredKey && !rawStoredKey.startsWith('ENC:');
      const needsIcsEnc = !rawStoredIcs || !rawStoredIcs.startsWith('ENC:');
      if (apiKey && (rows.length > 1 || needsKeyEnc || needsIcsEnc)) {
        const encryptedKey = encryptSecretForSheet(apiKey);
        const encryptedIcs = encryptSecretForSheet(calendarIcsUrl);
        await sheet.clearRows();
        await sheet.addRow({
          apiKey: encryptedKey,
          expiresAt,
          calendarIcsUrl: encryptedIcs,
          lastSyncDate,
          updatedAt: new Date().toISOString(),
        });
      }

      if (apiKey) {
        cachedSheetConfig = {
          apiKey,
          expiresAt,
          calendarIcsUrl,
          lastSyncDate,
          timestamp: Date.now(),
        };
        return { apiKey, expiresAt, calendarIcsUrl, lastSyncDate };
      }
      return null;
    } catch (err) {
      console.warn('[GarminConfig] Failed to read from Google Sheets:', err);
      return null;
    }
  });
}

async function saveGarminConfigToSheet(
  apiKey: string,
  expiresAt: string,
  lastSyncDate?: string,
  calendarIcsUrl?: string
): Promise<void> {
  const cleanKey = apiKey.trim();
  const cleanExp = expiresAt.trim() || DEFAULT_EXPIRES_AT;
  const cleanIcs =
    (calendarIcsUrl !== undefined
      ? calendarIcsUrl.trim()
      : cachedSheetConfig?.calendarIcsUrl) || DEFAULT_CALENDAR_ICS_URL;
  const cleanSyncDate =
    lastSyncDate !== undefined ? lastSyncDate : cachedSheetConfig?.lastSyncDate || '';

  if (cleanKey) {
    cachedSheetConfig = {
      apiKey: cleanKey,
      expiresAt: cleanExp,
      calendarIcsUrl: cleanIcs,
      lastSyncDate: cleanSyncDate,
      timestamp: Date.now(),
    };
  } else {
    cachedSheetConfig = null;
  }

  return enqueueGarminSheetOp(async () => {
    const doc = await getGoogleSheet();
    const sheet = await getOrCreateSheet(doc, GARMIN_CONFIG_SHEET_TITLE, GARMIN_CONFIG_HEADERS);
    const rows = await sheet.getRows();

    if (!cleanKey) {
      if (rows.length > 0) await sheet.clearRows();
      return;
    }

    const encryptedKey = encryptSecretForSheet(cleanKey);
    const encryptedIcs = encryptSecretForSheet(cleanIcs);
    const nowIso = new Date().toISOString();

    if (rows.length === 1) {
      rows[0].set('apiKey', encryptedKey);
      rows[0].set('expiresAt', cleanExp);
      rows[0].set('calendarIcsUrl', encryptedIcs);
      rows[0].set('lastSyncDate', cleanSyncDate);
      rows[0].set('updatedAt', nowIso);
      await rows[0].save();
    } else {
      if (rows.length > 0) await sheet.clearRows();
      await sheet.addRow({
        apiKey: encryptedKey,
        expiresAt: cleanExp,
        calendarIcsUrl: encryptedIcs,
        lastSyncDate: cleanSyncDate,
        updatedAt: nowIso,
      });
    }
  });
}

/**
 * Syncs Garmin Daily Wellness, Scheduled Workouts, Running Activities, and SleepLogs into Google Sheets.
 */
async function syncGarminDataToGoogleSheets(params: {
  dailyWellnessList: GarminDailyWellnessLog[];
  sleepMap: Record<string, GarminSleepData>;
  hrvByDate?: Record<string, any>;
  activities: GarminRunningActivity[];
  scheduledWorkouts: GarminScheduledWorkout[];
  cycle: GarminMenstrualCycle | null;
  apiKey: string;
  expiresAt: string;
  calendarIcsUrl: string;
  todayStr: string;
  token?: string;
}): Promise<void> {
  const {
    dailyWellnessList,
    sleepMap,
    hrvByDate = {},
    activities,
    scheduledWorkouts,
    cycle,
    apiKey,
    expiresAt,
    calendarIcsUrl,
    todayStr,
    token,
  } = params;
  const doc = await getGoogleSheet();

  const workoutByDate = new Map<string, string>();
  scheduledWorkouts.forEach(w => {
    if (w.date && w.summary) {
      workoutByDate.set(w.date, w.summary);
    }
  });

  // 1. Upsert GarminScheduledWorkouts (so Gemini NotebookLM can inspect upcoming schedule)
  const scheduledSheet = await getOrCreateSheet(
    doc,
    GARMIN_SCHEDULED_SHEET_TITLE,
    GARMIN_SCHEDULED_HEADERS
  );
  const existingScheduledRows = await scheduledSheet.getRows();
  const scheduledMap = new Map<string, any>();

  existingScheduledRows.forEach((r: any) => {
    const dt = String(r.get('date') || '').trim();
    if (!dt) return;
    scheduledMap.set(dt, {
      date: dt,
      summary: String(r.get('summary') || ''),
      isRestDay: String(r.get('isRestDay') || 'false'),
      lastUpdated: String(r.get('lastUpdated') || ''),
    });
  });

  const nowIso = new Date().toISOString();
  scheduledWorkouts.forEach(w => {
    scheduledMap.set(w.date, {
      date: w.date,
      summary: w.summary,
      isRestDay: w.isRestDay ? 'true' : 'false',
      lastUpdated: nowIso,
    });
  });

  const sortedScheduled = Array.from(scheduledMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
  if (sortedScheduled.length > 0) {
    await scheduledSheet.clearRows();
    await scheduledSheet.addRows(sortedScheduled);
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

  // 2.5 Upsert GarminRunningSplits (incremental sync for laps/splits)
  if (token && activities.length > 0) {
    try {
      const splitsSheet = await getOrCreateSheet(
        doc,
        GARMIN_RUNNING_SPLITS_SHEET_TITLE,
        GARMIN_RUNNING_SPLITS_HEADERS
      );
      const existingSplitRows = await splitsSheet.getRows();
      const existingSplitsActivityIds = new Set<string>();
      existingSplitRows.forEach((r: any) => {
        const actId = String(r.get('activityId') || '').trim();
        if (actId) existingSplitsActivityIds.add(actId);
      });

      // Find activities that haven't had their splits fetched yet (batch up to 10 activities per sync)
      const missingActivities = activities
        .filter(act => !existingSplitsActivityIds.has(String(act.activityId)))
        .slice(0, 10);

      if (missingActivities.length > 0) {
        console.log(`[Garmin Splits] Fetching splits for ${missingActivities.length} activities...`);
        const newSplitRows: any[] = [];
        for (const act of missingActivities) {
          try {
            const splits = await fetchGarminActivitySplits(token, act.activityId, act.date);
            splits.forEach(sp => {
              newSplitRows.push({
                activityId: sp.activityId,
                date: sp.date,
                lapIndex: sp.lapIndex,
                intensityType: sp.intensityType,
                distanceMeters: sp.distanceMeters,
                durationSeconds: sp.durationSeconds,
                pace: sp.pace,
                averageHR: sp.averageHR !== undefined && sp.averageHR !== null ? String(sp.averageHR) : '',
                maxHR: sp.maxHR !== undefined && sp.maxHR !== null ? String(sp.maxHR) : '',
                cadence: sp.cadence !== undefined && sp.cadence !== null ? String(sp.cadence) : '',
                strideLengthCm: sp.strideLengthCm !== undefined && sp.strideLengthCm !== null ? String(sp.strideLengthCm) : '',
                lastUpdated: nowIso,
              });
            });
            if (missingActivities.length > 1) {
              await new Promise(r => setTimeout(r, 200));
            }
          } catch (err) {
            console.warn(`[Garmin Splits] Failed to fetch splits for activity ${act.activityId}:`, err);
          }
        }

        if (newSplitRows.length > 0) {
          await withGarminApiRetry(() => splitsSheet.addRows(newSplitRows));
          console.log(`[Garmin Splits] Successfully wrote ${newSplitRows.length} split rows to Google Sheets.`);
        }
      }
    } catch (err) {
      console.warn('[Garmin Splits] Error syncing running splits:', err);
    }
  }

  // 3. Upsert unified SleepLogs (1 Day = 1 Row, merge legacy naps, 180-day backfill)
  const sleepSheet = await getOrCreateSheet(doc, SLEEP_LOGS_SHEET_TITLE, SLEEP_LOGS_HEADERS);
  const existingSleepRows = await sleepSheet.getRows();

  const existingMap = new Map<string, any>();
  const legacyNapMinutesByDate = new Map<string, number>();

  existingSleepRows.forEach((row: any) => {
    const dt = String(row.get('date') || '').trim();
    if (!dt) return;
    const type = String(row.get('type') || 'night').trim();
    const st = String(row.get('status') || 'active').trim();
    if (type === 'nap') {
      const durHours = Number(row.get('sleepDuration')) || 0;
      const mins = Math.round(durHours * 60);
      if (mins > 0) {
        legacyNapMinutesByDate.set(dt, (legacyNapMinutesByDate.get(dt) || 0) + mins);
      }
      return; // Do not preserve standalone nap rows
    }
    const existing = existingMap.get(dt);
    if (!existing || st !== 'deleted') {
      existingMap.set(dt, {
        id: String(row.get('id') || `sleep-garmin-${dt}`),
        date: dt,
        type: 'night',
        bedtime: String(row.get('bedtime') || ''),
        fallAsleepTime: String(row.get('fallAsleepTime') || ''),
        wakeupTime: String(row.get('wakeupTime') || ''),
        sleepDuration: String(row.get('sleepDuration') || ''),
        napMinutes: String(row.get('napMinutes') || ''),
        deepSleep: String(row.get('deepSleep') || ''),
        remSleep: String(row.get('remSleep') || ''),
        stress: String(row.get('stress') || ''),
        feeling: String(row.get('feeling') || ''),
        hrv: String(row.get('hrv') || ''),
        hrvStatus: String(row.get('hrvStatus') || ''),
        restingHeartRate: String(row.get('restingHeartRate') || ''),
        avgRespiration: String(row.get('avgRespiration') || ''),
        avgStress: String(row.get('avgStress') || ''),
        bodyBatteryHigh: String(row.get('bodyBatteryHigh') || ''),
        bodyBatteryLow: String(row.get('bodyBatteryLow') || ''),
        totalSteps: String(row.get('totalSteps') || ''),
        activeCalories: String(row.get('activeCalories') || ''),
        cycleDay: String(row.get('cycleDay') || ''),
        cyclePhase: String(row.get('cyclePhase') || ''),
        cycleStartDate: String(row.get('cycleStartDate') || ''),
        scheduledWorkout: String(row.get('scheduledWorkout') || ''),
        sleepScore: String(row.get('sleepScore') || ''),
        notes: String(row.get('notes') || ''),
        status: st,
        lastUpdated: String(row.get('lastUpdated') || ''),
      });
    }
  });

  dailyWellnessList.forEach(item => {
    const dt = item.date;
    if (!dt) return;
    const prev = existingMap.get(dt);
    const scheduled = workoutByDate.get(dt) || item.scheduledWorkout || prev?.scheduledWorkout || '';

    // Fold legacy nap duration into napMinutes if present
    const legacyNapMin = legacyNapMinutesByDate.get(dt) || 0;
    const garminNapMin = item.napMinutes !== '' && item.napMinutes !== undefined ? Number(item.napMinutes) : 0;
    const prevNapMin = prev?.napMinutes ? Number(prev.napMinutes) : 0;
    const totalNapMin = garminNapMin > 0 ? garminNapMin : (legacyNapMin > 0 ? legacyNapMin : (prevNapMin > 0 ? prevNapMin : ''));

    const mergedObj = {
      id: prev?.id || `sleep-garmin-${dt}`,
      date: dt,
      type: 'night',
      bedtime: item.bedtime || prev?.bedtime || '',
      fallAsleepTime: prev?.fallAsleepTime || item.bedtime || prev?.bedtime || '',
      wakeupTime: item.wakeupTime || prev?.wakeupTime || '',
      sleepDuration: (item.sleepHours !== '' && item.sleepHours !== undefined && Number(item.sleepHours) > 0)
        ? String(item.sleepHours)
        : (prev?.sleepDuration || ''),
      napMinutes: totalNapMin !== '' ? String(totalNapMin) : '',
      deepSleep: (item.deepSleepHours !== '' && item.deepSleepHours !== undefined && Number(item.deepSleepHours) > 0)
        ? String(item.deepSleepHours)
        : (prev?.deepSleep || ''),
      remSleep: (item.remSleepHours !== '' && item.remSleepHours !== undefined && Number(item.remSleepHours) > 0)
        ? String(item.remSleepHours)
        : (prev?.remSleep || ''),
      stress: prev?.stress || '',
      feeling: prev?.feeling || '',
      hrv: (item.hrv !== '' && item.hrv !== undefined && Number(item.hrv) > 0)
        ? String(item.hrv)
        : (prev?.hrv || ''),
      hrvStatus: item.hrvStatus || prev?.hrvStatus || '',
      restingHeartRate: (item.restingHeartRate !== '' && item.restingHeartRate !== undefined && Number(item.restingHeartRate) > 0)
        ? String(item.restingHeartRate)
        : (prev?.restingHeartRate || ''),
      avgRespiration: (item.avgRespiration !== '' && item.avgRespiration !== undefined)
        ? String(item.avgRespiration)
        : (prev?.avgRespiration || ''),
      avgStress: (item.avgStress !== '' && item.avgStress !== undefined)
        ? String(item.avgStress)
        : (prev?.avgStress || ''),
      bodyBatteryHigh: (item.bodyBatteryHigh !== '' && item.bodyBatteryHigh !== undefined)
        ? String(item.bodyBatteryHigh)
        : (prev?.bodyBatteryHigh || ''),
      bodyBatteryLow: (item.bodyBatteryLow !== '' && item.bodyBatteryLow !== undefined)
        ? String(item.bodyBatteryLow)
        : (prev?.bodyBatteryLow || ''),
      totalSteps: (item.totalSteps !== '' && item.totalSteps !== undefined)
        ? String(item.totalSteps)
        : (prev?.totalSteps || ''),
      activeCalories: (item.activeCalories !== '' && item.activeCalories !== undefined)
        ? String(item.activeCalories)
        : (prev?.activeCalories || ''),
      cycleDay: (item.cycleDay !== '' && item.cycleDay !== undefined)
        ? String(item.cycleDay)
        : (prev?.cycleDay || ''),
      cyclePhase: item.cyclePhase || prev?.cyclePhase || '',
      cycleStartDate: item.cycleStartDate || prev?.cycleStartDate || '',
      scheduledWorkout: scheduled,
      sleepScore: (item.sleepScore !== '' && item.sleepScore !== undefined && Number(item.sleepScore) > 0)
        ? String(item.sleepScore)
        : (prev?.sleepScore || ''),
      notes: prev?.notes || '',
      status: prev?.status || 'active',
      lastUpdated: prev?.lastUpdated || String(Date.now()),
    };

    existingMap.set(dt, mergedObj);
  });

  const sortedSleepLogs = Array.from(existingMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );

  if (sortedSleepLogs.length > 0) {
    const sanitizedRows = sortedSleepLogs.map(item => {
      const rowObj: any = {};
      SLEEP_LOGS_HEADERS.forEach(h => {
        const val = item[h];
        rowObj[h] = val !== undefined && val !== null ? String(val) : '';
      });
      return rowObj;
    });

    await withGarminApiRetry(() => sleepSheet.clearRows());
    const chunkSize = 100;
    for (let i = 0; i < sanitizedRows.length; i += chunkSize) {
      const chunk = sanitizedRows.slice(i, i + chunkSize);
      await withGarminApiRetry(() => sleepSheet.addRows(chunk));
    }
  }

  // Automatically delete obsolete GarminDailyWellness / Daily Wellness sheet tab to complete migration
  const oldWellnessSheet = Object.values(doc.sheetsByTitle).find((s: any) => {
    if (!s.title) return false;
    const sNorm = s.title.trim().toLowerCase().replace(/[\s_-]+/g, '');
    return sNorm === 'garmindailywellness' || sNorm === 'dailywellness';
  }) as any;
  if (oldWellnessSheet) {
    try {
      console.log(`[Garmin] Deleting obsolete worksheet '${oldWellnessSheet.title}' (ID: ${oldWellnessSheet.sheetId})...`);
      await withGarminApiRetry(() => oldWellnessSheet.delete());
      console.log(`[Garmin] Successfully deleted obsolete worksheet '${oldWellnessSheet.title}'.`);
    } catch (err) {
      console.warn('[Garmin] Failed to delete obsolete GarminDailyWellness sheet, falling back to clearRows:', err);
      try {
        await withGarminApiRetry(() => oldWellnessSheet.clearRows());
      } catch (e) {
        console.warn('[Garmin] Failed to clear rows:', e);
      }
    }
  }

  // 4. Record todayStr as lastSyncDate in GarminConfig
  await saveGarminConfigToSheet(apiKey, expiresAt, todayStr, calendarIcsUrl);
}

/**
 * Reads cached overview from Google Sheets when today has already been synced,
 * so we only hit Garmin API once per day!
 */
async function readOverviewFromGoogleSheets(params: {
  todayStr: string;
  expiryInfo: { expiresAt: string; daysUntilExpiry: number; isExpiringSoon: boolean };
  lastSyncDate: string;
  calendarIcsUrl: string;
}): Promise<GarminOverviewData | null> {
  try {
    const doc = await getGoogleSheet();
    const findSheet = (name: string) => {
      if (doc.sheetsByTitle[name]) return doc.sheetsByTitle[name];
      const norm = name.trim().toLowerCase().replace(/[\s_-]+/g, '');
      const exactMatch = Object.values(doc.sheetsByTitle).find((s: any) => {
        if (!s.title) return false;
        const sNorm = s.title.trim().toLowerCase().replace(/[\s_-]+/g, '');
        return sNorm === norm;
      });
      if (exactMatch) return exactMatch as any;

      if (norm === 'wellnesslogs' || norm === 'wellnesslog') {
        const legacyMatch = Object.values(doc.sheetsByTitle).find((s: any) => {
          if (!s.title) return false;
          const sNorm = s.title.trim().toLowerCase().replace(/[\s_-]+/g, '');
          return sNorm === 'wellness' || sNorm === 'sleeplogs' || sNorm === 'sleeplog';
        });
        if (legacyMatch) return legacyMatch as any;
      }
      return undefined;
    };
    const sleepSheet = findSheet(SLEEP_LOGS_SHEET_TITLE);
    const runningSheet = findSheet(GARMIN_RUNNING_SHEET_TITLE);
    const scheduledSheet = findSheet(GARMIN_SCHEDULED_SHEET_TITLE);
    const splitsSheet = findSheet(GARMIN_RUNNING_SPLITS_SHEET_TITLE);
    if (!sleepSheet || !runningSheet) return null;

    const [sRows, rRows, sSchedRows, splitRows] = await Promise.all([
      sleepSheet.getRows(),
      runningSheet.getRows(),
      scheduledSheet ? scheduledSheet.getRows() : Promise.resolve([]),
      splitsSheet ? splitsSheet.getRows() : Promise.resolve([]),
    ]);
    if (sRows.length === 0) return null;

    const recentSleepMap: Record<string, GarminSleepData> = {};
    let latestCycle: any = null;

    // Filter active night rows and sort rows by date ascending so latestCycle is guaranteed to be the most recent day
    const sortedSleepRows = sRows
      .filter((r: any) => String(r.get('status') || 'active') !== 'deleted' && String(r.get('type') || 'night') === 'night')
      .sort((a: any, b: any) =>
        String(a.get('date') || '').localeCompare(String(b.get('date') || ''))
      );

    sortedSleepRows.forEach((r: any) => {
      const dt = String(r.get('date') || '').trim();
      if (!dt) return;
      const dur = Number(r.get('sleepDuration')) || 0;
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
        deepSleepHours: Number(r.get('deepSleep')) || 0,
        remSleepHours: Number(r.get('remSleepHours') || r.get('remSleep')) || 0,
        lightSleepHours: 0,
        napMinutes: Number(r.get('napMinutes')) || 0,
        sleepScore: r.get('sleepScore') ? Number(r.get('sleepScore')) : undefined,
        hrv: r.get('hrv') ? Number(r.get('hrv')) : undefined,
        hrvStatus: String(r.get('hrvStatus') || '') || undefined,
        restingHeartRate: r.get('restingHeartRate')
          ? Number(r.get('restingHeartRate'))
          : undefined,
        avgRespiration: r.get('avgRespiration')
          ? Number(r.get('avgRespiration'))
          : undefined,
      };

      const cDay = Number(r.get('cycleDay'));
      const cPhase = String(r.get('cyclePhase') || '');
      if (cDay > 0 && cPhase) {
        const cStart = String(r.get('cycleStartDate') || '');
        let predictedNextPeriodDate: string | undefined;
        if (cStart && /^\d{4}-\d{2}-\d{2}$/.test(cStart)) {
          const [cy, cm, cd] = cStart.split('-').map(Number);
          const pDt = new Date(Date.UTC(cy, cm - 1, cd + 29));
          predictedNextPeriodDate = pDt.toISOString().slice(0, 10);
        }
        latestCycle = {
          startDate: cStart,
          dayInCycle: cDay,
          periodLength: 7,
          currentPhase: 0,
          phaseName: cPhase,
          lengthOfCurrentPhase: 0,
          daysUntilNextPhase: Math.max(0, 29 - cDay),
          predictedCycleLength: 29,
          predictedNextPeriodDate,
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

    let scheduledWorkouts: GarminScheduledWorkout[] = sSchedRows
      .map((r: any) => ({
        date: String(r.get('date') || '').trim(),
        summary: String(r.get('summary') || '').trim(),
        isRestDay: String(r.get('isRestDay') || '').toLowerCase() === 'true',
      }))
      .filter((w: GarminScheduledWorkout) => Boolean(w.date && w.summary))
      .sort((a: GarminScheduledWorkout, b: GarminScheduledWorkout) =>
        a.date.localeCompare(b.date)
      );

    // If GarminScheduledWorkouts sheet wasn't populated yet, fetch once from iCal URL
    if (scheduledWorkouts.length === 0 && params.calendarIcsUrl) {
      scheduledWorkouts = await fetchGarminCalendarWorkouts(params.calendarIcsUrl);
    }

    const mondayStr = getMondayOfCurrentWeekTaipei(params.todayStr);
    const thisWeekRuns = activities.filter(a => a.date >= mondayStr);

    const overviewData: GarminOverviewData = {
      configured: true,
      ...params.expiryInfo,
      calendarIcsConfigured: Boolean(params.calendarIcsUrl),
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
        scheduledWorkouts: scheduledWorkouts.filter(w => w.date >= params.todayStr),
      },
      recentSleepMap,
      fetchedAt: Date.now(),
    };
    (overviewData as any).hasSplits = splitRows.length > 0;
    return overviewData;
  } catch (err) {
    console.warn('[Garmin] Failed to read cached overview from Google Sheets:', err);
    return null;
  }
}

function dtBefore(dateA?: string, dateB?: string): boolean {
  if (!dateA || !dateB) return false;
  return dateA < dateB;
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
    const sheetConfig = await getGarminConfigFromSheet();

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

    // Reset lastSyncDate to empty when config is updated so next GET immediately runs a full sync
    await saveGarminConfigToSheet(apiKey, expiresAt, '', calendarIcsUrl);
    cachedOverview = null;

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
    const customCalendarIcs = request.headers.get('x-garmin-calendar-ics')?.trim();

    const sheetConfig = await getGarminConfigFromSheet();

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

    const keyHash = `${apiKey.slice(0, 16)}:${expiryInfo.expiresAt}:${calendarIcsUrl.slice(-12)}`;

    // Daily Gatekeeper: If already synced today and not forced, return in-memory or Google Sheets snapshot without calling Garmin API!
    if (!forceRefresh) {
      const hasCachedHrvStatus =
        cachedOverview &&
        Object.values(cachedOverview.data?.recentSleepMap || {}).some(s => Boolean(s.hrvStatus)) &&
        Object.keys(cachedOverview.data?.recentSleepMap || {}).length >= 60;
      const hasCachedSplits = Boolean(cachedOverview?.hasSplits);

      if (
        cachedOverview &&
        cachedOverview.keyHash === keyHash &&
        cachedOverview.dateStr === todayStr &&
        hasCachedHrvStatus &&
        hasCachedSplits
      ) {
        return NextResponse.json(cachedOverview.data);
      }

      if (lastSyncDate === todayStr) {
        const sheetOverview = await readOverviewFromGoogleSheets({
          todayStr,
          expiryInfo,
          lastSyncDate,
          calendarIcsUrl,
        });
        const hasHrvStatus =
          sheetOverview && Object.values(sheetOverview.recentSleepMap).some(s => Boolean(s.hrvStatus));
        const hasEnoughHistory =
          sheetOverview && Object.keys(sheetOverview.recentSleepMap).length >= 60;
        const hasSplits = Boolean((sheetOverview as any)?.hasSplits);

        // Ensure today's sleep AND scheduled workouts were captured AND wellness has been backfilled (>= 60 days) AND HRV status present AND running splits present
        if (
          sheetOverview &&
          sheetOverview.recentSleepMap[todayStr]?.sleepDurationHours &&
          sheetOverview.running.scheduledWorkouts.length > 0 &&
          hasEnoughHistory &&
          hasHrvStatus &&
          hasSplits
        ) {
          cachedOverview = {
            keyHash,
            dateStr: todayStr,
            data: sheetOverview,
            timestamp: Date.now(),
            hasSplits: true,
          };
          return NextResponse.json(sheetOverview);
        }
      }
    }

    // Perform Garmin fetch & Google Sheets sync (fetch 30 days detailed sleep & 180 days HRV history)
    const lookbackDays = -29;
    const startDate = getTaipeiDateStr(lookbackDays);
    const hrvStartDate = getTaipeiDateStr(-180); // 回補過去 180 天的 HRV 歷史數據

    const token = await obtainGarminBearerToken(apiKey, forceRefresh);
    const cycle = await fetchGarminMenstrualCycle(token, todayStr);
    const [{ sleepMap, dailyWellnessList, hrvByDate }, activities, allScheduledWorkouts] = await Promise.all([
      fetchGarminWellnessRange(token, startDate, todayStr, cycle, hrvStartDate),
      fetchGarminRunningActivities(token, 35),
      fetchGarminCalendarWorkouts(calendarIcsUrl),
    ]);

    // Sync to Google Sheets (SleepLogs, GarminScheduledWorkouts, GarminRunningLogs)
    try {
      await syncGarminDataToGoogleSheets({
        dailyWellnessList,
        sleepMap,
        hrvByDate,
        activities,
        scheduledWorkouts: allScheduledWorkouts,
        cycle,
        apiKey,
        expiresAt: expiryInfo.expiresAt,
        calendarIcsUrl,
        todayStr,
        token,
      });
    } catch (err) {
      console.error('[Garmin] Failed to sync to Google Sheets:', err);
    }

    const mondayStr = getMondayOfCurrentWeekTaipei(todayStr);
    const thisWeekRuns = activities.filter(a => a.date >= mondayStr);
    const upcomingScheduled = allScheduledWorkouts.filter(w => w.date >= todayStr);

    const overviewData: GarminOverviewData = {
      configured: true,
      ...expiryInfo,
      calendarIcsConfigured: Boolean(calendarIcsUrl),
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
        scheduledWorkouts: upcomingScheduled,
      },
      recentSleepMap: sleepMap,
      fetchedAt: Date.now(),
    };

    cachedOverview = {
      keyHash,
      dateStr: todayStr,
      data: overviewData,
      timestamp: Date.now(),
      hasSplits: true,
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
