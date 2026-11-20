import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  obtainGarminBearerToken,
  fetchGarminSleepForDate,
  fetchGarminWellnessRange,
  fetchGarminRunningActivities,
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
  activities: GarminRunningActivity[];
  scheduledWorkouts: GarminScheduledWorkout[];
  apiKey: string;
  expiresAt: string;
  calendarIcsUrl: string;
  todayStr: string;
}): Promise<void> {
  const {
    dailyWellnessList,
    sleepMap,
    activities,
    scheduledWorkouts,
    apiKey,
    expiresAt,
    calendarIcsUrl,
    todayStr,
  } = params;
  const doc = await getGoogleSheet();

  const workoutByDate = new Map<string, string>();
  scheduledWorkouts.forEach(w => {
    if (w.date && w.summary) {
      workoutByDate.set(w.date, w.summary);
    }
  });

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
    if (workoutByDate.has(dt)) {
      obj.scheduledWorkout = workoutByDate.get(dt);
    }
    wellnessMap.set(dt, obj);
  });

  dailyWellnessList.forEach(item => {
    const prev = wellnessMap.get(item.date) || {};
    const scheduled =
      workoutByDate.get(item.date) || item.scheduledWorkout || prev.scheduledWorkout || '';
    wellnessMap.set(item.date, {
      ...prev,
      ...item,
      cycleDay: item.cycleDay !== '' ? item.cycleDay : prev.cycleDay || '',
      cyclePhase: item.cyclePhase !== '' ? item.cyclePhase : prev.cyclePhase || '',
      cycleStartDate:
        item.cycleStartDate !== '' ? item.cycleStartDate : prev.cycleStartDate || '',
      scheduledWorkout: scheduled,
    });
  });

  const sortedWellness = Array.from(wellnessMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
  if (sortedWellness.length > 0) {
    await wellnessSheet.clearRows();
    await wellnessSheet.addRows(sortedWellness);
  }

  // 2. Upsert GarminScheduledWorkouts (so Gemini NotebookLM can inspect upcoming schedule)
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

  // 3. Upsert GarminRunningLogs
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

  // 4. Auto-populate SleepLogs so the user doesn't have to wait or manually load sleep
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
        feeling: '',
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

  // 5. Record todayStr as lastSyncDate in GarminConfig
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
    const wellnessSheet = doc.sheetsByTitle[GARMIN_WELLNESS_SHEET_TITLE];
    const runningSheet = doc.sheetsByTitle[GARMIN_RUNNING_SHEET_TITLE];
    const scheduledSheet = doc.sheetsByTitle[GARMIN_SCHEDULED_SHEET_TITLE];
    if (!wellnessSheet || !runningSheet) return null;

    const [wRows, rRows, sRows] = await Promise.all([
      wellnessSheet.getRows(),
      runningSheet.getRows(),
      scheduledSheet ? scheduledSheet.getRows() : Promise.resolve([]),
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

    let scheduledWorkouts: GarminScheduledWorkout[] = sRows
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

    return {
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
          calendarIcsUrl,
        });
        // Ensure today's sleep AND scheduled workouts were captured
        if (
          sheetOverview &&
          sheetOverview.recentSleepMap[todayStr]?.sleepDurationHours &&
          sheetOverview.running.scheduledWorkouts.length > 0
        ) {
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
    const lookbackDays = !lastSyncDate ? -29 : -9;
    const startDate = getTaipeiDateStr(lookbackDays);

    const token = await obtainGarminBearerToken(apiKey, forceRefresh);
    const cycle = await fetchGarminMenstrualCycle(token, todayStr);
    const [{ sleepMap, dailyWellnessList }, activities, allScheduledWorkouts] = await Promise.all([
      fetchGarminWellnessRange(token, startDate, todayStr, cycle),
      fetchGarminRunningActivities(token, !lastSyncDate ? 35 : 20),
      fetchGarminCalendarWorkouts(calendarIcsUrl),
    ]);

    // Sync to Google Sheets (GarminDailyWellness, GarminScheduledWorkouts, GarminRunningLogs, SleepLogs)
    await syncGarminDataToGoogleSheets({
      dailyWellnessList,
      sleepMap,
      activities,
      scheduledWorkouts: allScheduledWorkouts,
      apiKey,
      expiresAt: expiryInfo.expiresAt,
      calendarIcsUrl,
      todayStr,
    }).catch(err => {
      console.warn('[Garmin] Failed to sync to Google Sheets:', err);
    });

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
