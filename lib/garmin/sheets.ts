import { getGoogleSheet } from '@/lib/google-sheets';
import {
  fetchGarminActivitySplits,
  fetchGarminCalendarWorkouts,
} from '@/lib/garmin';
import type {
  GarminOverviewData,
  GarminSleepData,
  GarminRunningActivity,
  GarminDailyWellnessLog,
  GarminScheduledWorkout,
  GarminMenstrualCycle,
} from '@/lib/types';
import { encryptSecretForSheet, decryptSecretFromSheet } from './crypto';
import {
  DEFAULT_EXPIRES_AT,
  getMondayOfCurrentWeekTaipei,
} from './time';

export const DEFAULT_CALENDAR_ICS_URL =
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

const SLEEP_LOGS_SHEET_TITLE = 'WellnessLogs';
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

interface StoredConfigCache {
  apiKey: string;
  expiresAt: string;
  calendarIcsUrl: string;
  lastSyncDate: string;
  timestamp: number;
}

let cachedSheetConfig: StoredConfigCache | null = null;
const SHEET_CONFIG_CACHE_TTL_MS = 60 * 1000;

let garminSheetQueue: Promise<any> = Promise.resolve();
function enqueueGarminSheetOp<T>(op: () => Promise<T>): Promise<T> {
  const res = garminSheetQueue.then(op, op);
  garminSheetQueue = res.then(
    () => {},
    () => {}
  );
  return res;
}

export async function withGarminApiRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
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
        console.warn(
          `[Garmin Google Sheets API] Transient error (429/503), retrying ${attempt}/${maxRetries} after ${delay}ms...`
        );
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw err;
      }
    }
  }
}

async function getSheetRows(sheet: any): Promise<any[]> {
  return withGarminApiRetry<any[]>(() => sheet.getRows());
}

function findSheetByTitle(doc: any, title: string): any | undefined {
  if (doc.sheetsByTitle[title]) return doc.sheetsByTitle[title];
  const normTitle = title.trim().toLowerCase().replace(/[\s_-]+/g, '');
  const exactMatch = Object.values(doc.sheetsByTitle).find((s: any) => {
    if (!s.title) return false;
    const sNorm = s.title.trim().toLowerCase().replace(/[\s_-]+/g, '');
    return sNorm === normTitle;
  });
  if (exactMatch) return exactMatch;

  if (normTitle === 'wellnesslogs' || normTitle === 'wellnesslog') {
    const legacyMatch = Object.values(doc.sheetsByTitle).find((s: any) => {
      if (!s.title) return false;
      const sNorm = s.title.trim().toLowerCase().replace(/[\s_-]+/g, '');
      return sNorm === 'wellness' || sNorm === 'sleeplogs' || sNorm === 'sleeplog';
    });
    if (legacyMatch) return legacyMatch;
  }
  return undefined;
}

async function getOrCreateSheet(doc: any, title: string, headers: string[]) {
  let sheet = findSheetByTitle(doc, title);
  if (!sheet) {
    try {
      sheet = await withGarminApiRetry(() => doc.addSheet({ title, headerValues: headers }));
    } catch {
      await withGarminApiRetry(() => doc.loadInfo());
      sheet = findSheetByTitle(doc, title);
    }
  } else {
    if (sheet.title !== title) {
      try {
        await withGarminApiRetry(() => sheet.updateProperties({ title }));
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
          await withGarminApiRetry(() =>
            sheet.resize({ rowCount: sheet.rowCount, columnCount: merged.length })
          );
        }
        await withGarminApiRetry(() => sheet.setHeaderRow(merged));
      }
    } catch (err) {
      console.warn(`[getOrCreateSheet] Failed to update headers for ${title}:`, err);
    }
  }
  return sheet;
}

export async function getGarminConfigFromSheet(bypassCache = false): Promise<{
  apiKey: string;
  expiresAt: string;
  calendarIcsUrl: string;
  lastSyncDate: string;
} | null> {
  if (
    !bypassCache &&
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
    const doc = await withGarminApiRetry(() => getGoogleSheet());
    const sheet = await getOrCreateSheet(doc, GARMIN_CONFIG_SHEET_TITLE, GARMIN_CONFIG_HEADERS);
    if (!sheet) return null;
    const rows = await getSheetRows(sheet);
    if (rows.length === 0) return null;
    const latestRow = rows[rows.length - 1];
    const rawStoredKey = String(latestRow.get('apiKey') || '').trim();
    const rawStoredIcs = String(latestRow.get('calendarIcsUrl') || '').trim();
    const apiKey = decryptSecretFromSheet(rawStoredKey);
    const calendarIcsUrl = decryptSecretFromSheet(rawStoredIcs) || DEFAULT_CALENDAR_ICS_URL;
    const expiresAt = String(latestRow.get('expiresAt') || DEFAULT_EXPIRES_AT).trim();
    const lastSyncDate = String(latestRow.get('lastSyncDate') || '').trim();

    const needsKeyEnc = rawStoredKey && !rawStoredKey.startsWith('ENC:');
    const needsIcsEnc = !rawStoredIcs || !rawStoredIcs.startsWith('ENC:');
    if (apiKey && (rows.length > 1 || needsKeyEnc || needsIcsEnc)) {
      const encryptedKey = encryptSecretForSheet(apiKey);
      const encryptedIcs = encryptSecretForSheet(calendarIcsUrl);
      await withGarminApiRetry(() => sheet.clearRows());
      await withGarminApiRetry(() =>
        sheet.addRow({
          apiKey: encryptedKey,
          expiresAt,
          calendarIcsUrl: encryptedIcs,
          lastSyncDate,
          updatedAt: new Date().toISOString(),
        })
      );
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
  });
}

export async function saveGarminConfigToSheet(
  apiKey: string,
  expiresAt: string,
  lastSyncDate: string,
  calendarIcsUrl?: string
): Promise<void> {
  const cleanKey = apiKey.trim();
  const cleanExp = expiresAt.trim() || DEFAULT_EXPIRES_AT;
  const cleanSyncDate = lastSyncDate.trim();
  const cleanIcs = (calendarIcsUrl ?? DEFAULT_CALENDAR_ICS_URL).trim() || DEFAULT_CALENDAR_ICS_URL;

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
    const doc = await withGarminApiRetry(() => getGoogleSheet());
    const sheet = await getOrCreateSheet(doc, GARMIN_CONFIG_SHEET_TITLE, GARMIN_CONFIG_HEADERS);
    const rows = await getSheetRows(sheet);

    if (!cleanKey) {
      if (rows.length > 0) await withGarminApiRetry(() => sheet.clearRows());
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
      await withGarminApiRetry(() => rows[0].save());
    } else {
      if (rows.length > 0) await withGarminApiRetry(() => sheet.clearRows());
      await withGarminApiRetry(() =>
        sheet.addRow({
          apiKey: encryptedKey,
          expiresAt: cleanExp,
          calendarIcsUrl: encryptedIcs,
          lastSyncDate: cleanSyncDate,
          updatedAt: nowIso,
        })
      );
    }
  });
}

/**
 * Non-destructive incremental sync of Garmin data to Google Sheets.
 * 1. Updates/appends GarminScheduledWorkouts, GarminRunningLogs, WellnessLogs without clearing historical rows.
 * 2. Updates GarminConfig.lastSyncDate once core data is safely persisted.
 * 3. Best-effort incremental fetch of up to 2 missing .FIT splits after core data is committed.
 */
export async function syncGarminDataToGoogleSheets(params: {
  dailyWellnessList: GarminDailyWellnessLog[];
  sleepMap: Record<string, GarminSleepData>;
  activities: GarminRunningActivity[];
  scheduledWorkouts: GarminScheduledWorkout[];
  apiKey: string;
  expiresAt: string;
  calendarIcsUrl: string;
  todayStr: string;
  token?: string;
}): Promise<void> {
  const {
    dailyWellnessList,
    activities,
    scheduledWorkouts,
    apiKey,
    expiresAt,
    calendarIcsUrl,
    todayStr,
    token,
  } = params;

  const nowIso = new Date().toISOString();

  await enqueueGarminSheetOp(async () => {
    const doc = await withGarminApiRetry(() => getGoogleSheet());

    const workoutByDate = new Map<string, string>();
    scheduledWorkouts.forEach(w => {
      if (w.date && w.summary) {
        workoutByDate.set(w.date, w.summary);
      }
    });

    // 1. Incremental upsert: GarminScheduledWorkouts
    const scheduledSheet = await getOrCreateSheet(
      doc,
      GARMIN_SCHEDULED_SHEET_TITLE,
      GARMIN_SCHEDULED_HEADERS
    );
    const existingScheduledRows = await getSheetRows(scheduledSheet);
    const scheduledRowByDate = new Map<string, any>();
    existingScheduledRows.forEach((r: any) => {
      const dt = String(r.get('date') || '').trim();
      if (dt) scheduledRowByDate.set(dt, r);
    });

    const newScheduledRows: any[] = [];
    for (const w of scheduledWorkouts) {
      if (!w.date) continue;
      const targetRest = w.isRestDay ? 'true' : 'false';
      const existingRow = scheduledRowByDate.get(w.date);
      if (existingRow) {
        const curSummary = String(existingRow.get('summary') || '');
        const curRest = String(existingRow.get('isRestDay') || 'false');
        if (curSummary !== w.summary || curRest !== targetRest) {
          existingRow.set('summary', w.summary);
          existingRow.set('isRestDay', targetRest);
          existingRow.set('lastUpdated', nowIso);
          await withGarminApiRetry(() => existingRow.save());
        }
      } else {
        newScheduledRows.push({
          date: w.date,
          summary: w.summary,
          isRestDay: targetRest,
          lastUpdated: nowIso,
        });
      }
    }
    if (newScheduledRows.length > 0) {
      await withGarminApiRetry(() => scheduledSheet.addRows(newScheduledRows));
    }

    // 2. Incremental upsert: GarminRunningLogs (append new activities, update only if changed)
    const runningSheet = await getOrCreateSheet(
      doc,
      GARMIN_RUNNING_SHEET_TITLE,
      GARMIN_RUNNING_HEADERS
    );
    const existingRunRows = await getSheetRows(runningSheet);
    const runRowById = new Map<string, any>();
    existingRunRows.forEach((r: any) => {
      const id = String(r.get('activityId') || '').trim();
      if (id) runRowById.set(id, r);
    });

    const newRunRows: any[] = [];
    for (const act of activities) {
      const id = String(act.activityId);
      const payload: Record<string, string | number> = {
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
      };

      const existingRow = runRowById.get(id);
      if (existingRow) {
        const hasDiff = Object.entries(payload).some(
          ([k, v]) => String(existingRow.get(k) ?? '') !== String(v)
        );
        if (hasDiff) {
          Object.entries(payload).forEach(([k, v]) => existingRow.set(k, String(v)));
          existingRow.set('lastUpdated', nowIso);
          await withGarminApiRetry(() => existingRow.save());
        }
      } else {
        newRunRows.push({
          ...payload,
          lastUpdated: nowIso,
        });
      }
    }
    if (newRunRows.length > 0) {
      await withGarminApiRetry(() => runningSheet.addRows(newRunRows));
    }

    // 3. Incremental upsert: WellnessLogs (1 Day = 1 Row, never clear historical rows)
    const sleepSheet = await getOrCreateSheet(doc, SLEEP_LOGS_SHEET_TITLE, SLEEP_LOGS_HEADERS);
    const existingSleepRows = await getSheetRows(sleepSheet);

    const existingRowByDate = new Map<string, any>();
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
        return;
      }
      const existing = existingRowByDate.get(dt);
      if (!existing || st !== 'deleted') {
        existingRowByDate.set(dt, row);
      }
    });

    const newSleepRows: any[] = [];
    for (const item of dailyWellnessList) {
      const dt = item.date;
      if (!dt) continue;
      const prevRow = existingRowByDate.get(dt);
      const prevGet = (field: string) => (prevRow ? String(prevRow.get(field) || '') : '');

      const scheduled =
        workoutByDate.get(dt) || item.scheduledWorkout || prevGet('scheduledWorkout') || '';
      const legacyNapMin = legacyNapMinutesByDate.get(dt) || 0;
      const garminNapMin =
        item.napMinutes !== '' && item.napMinutes !== undefined ? Number(item.napMinutes) : 0;
      const prevNapMin = prevGet('napMinutes') ? Number(prevGet('napMinutes')) : 0;
      const totalNapMin =
        garminNapMin > 0
          ? garminNapMin
          : legacyNapMin > 0
          ? legacyNapMin
          : prevNapMin > 0
          ? prevNapMin
          : '';

      const mergedFields: Record<string, string> = {
        id: prevGet('id') || `sleep-garmin-${dt}`,
        date: dt,
        type: 'night',
        bedtime: item.bedtime || prevGet('bedtime') || '',
        fallAsleepTime: prevGet('fallAsleepTime') || item.bedtime || prevGet('bedtime') || '',
        wakeupTime: item.wakeupTime || prevGet('wakeupTime') || '',
        sleepDuration:
          item.sleepHours !== '' && item.sleepHours !== undefined && Number(item.sleepHours) > 0
            ? String(item.sleepHours)
            : prevGet('sleepDuration') || '',
        napMinutes: totalNapMin !== '' ? String(totalNapMin) : '',
        deepSleep:
          item.deepSleepHours !== '' &&
          item.deepSleepHours !== undefined &&
          Number(item.deepSleepHours) > 0
            ? String(item.deepSleepHours)
            : prevGet('deepSleep') || '',
        remSleep:
          item.remSleepHours !== '' &&
          item.remSleepHours !== undefined &&
          Number(item.remSleepHours) > 0
            ? String(item.remSleepHours)
            : prevGet('remSleep') || '',
        stress: prevGet('stress') || '',
        feeling: prevGet('feeling') || '',
        hrv:
          item.hrv !== '' && item.hrv !== undefined && Number(item.hrv) > 0
            ? String(item.hrv)
            : prevGet('hrv') || '',
        hrvStatus: item.hrvStatus || prevGet('hrvStatus') || '',
        restingHeartRate:
          item.restingHeartRate !== '' &&
          item.restingHeartRate !== undefined &&
          Number(item.restingHeartRate) > 0
            ? String(item.restingHeartRate)
            : prevGet('restingHeartRate') || '',
        avgRespiration:
          item.avgRespiration !== '' && item.avgRespiration !== undefined
            ? String(item.avgRespiration)
            : prevGet('avgRespiration') || '',
        avgStress:
          item.avgStress !== '' && item.avgStress !== undefined
            ? String(item.avgStress)
            : prevGet('avgStress') || '',
        bodyBatteryHigh:
          item.bodyBatteryHigh !== '' && item.bodyBatteryHigh !== undefined
            ? String(item.bodyBatteryHigh)
            : prevGet('bodyBatteryHigh') || '',
        bodyBatteryLow:
          item.bodyBatteryLow !== '' && item.bodyBatteryLow !== undefined
            ? String(item.bodyBatteryLow)
            : prevGet('bodyBatteryLow') || '',
        totalSteps:
          item.totalSteps !== '' && item.totalSteps !== undefined
            ? String(item.totalSteps)
            : prevGet('totalSteps') || '',
        activeCalories:
          item.activeCalories !== '' && item.activeCalories !== undefined
            ? String(item.activeCalories)
            : prevGet('activeCalories') || '',
        cycleDay:
          item.cycleDay !== '' && item.cycleDay !== undefined
            ? String(item.cycleDay)
            : prevGet('cycleDay') || '',
        cyclePhase: item.cyclePhase || prevGet('cyclePhase') || '',
        cycleStartDate: item.cycleStartDate || prevGet('cycleStartDate') || '',
        scheduledWorkout: scheduled,
        sleepScore:
          item.sleepScore !== '' && item.sleepScore !== undefined && Number(item.sleepScore) > 0
            ? String(item.sleepScore)
            : prevGet('sleepScore') || '',
        notes: prevGet('notes') || '',
        status: prevGet('status') || 'active',
      };

      if (prevRow) {
        const hasDiff = Object.entries(mergedFields).some(([k, v]) => prevGet(k) !== v);
        if (hasDiff) {
          Object.entries(mergedFields).forEach(([k, v]) => prevRow.set(k, v));
          prevRow.set('lastUpdated', String(Date.now()));
          await withGarminApiRetry(() => prevRow.save());
        }
      } else {
        newSleepRows.push({
          ...mergedFields,
          lastUpdated: String(Date.now()),
        });
      }
    }

    if (newSleepRows.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < newSleepRows.length; i += chunkSize) {
        const chunk = newSleepRows.slice(i, i + chunkSize);
        await withGarminApiRetry(() => sleepSheet.addRows(chunk));
      }
    }
  });

  // 4. Commit lastSyncDate only after core sheets succeeded
  await saveGarminConfigToSheet(apiKey, expiresAt, todayStr, calendarIcsUrl);

  // 5. Decoupled best-effort .FIT splits sync (max 2 missing activities per sync)
  if (token && activities.length > 0) {
    try {
      await enqueueGarminSheetOp(async () => {
        const doc = await withGarminApiRetry(() => getGoogleSheet());
        const splitsSheet = await getOrCreateSheet(
          doc,
          GARMIN_RUNNING_SPLITS_SHEET_TITLE,
          GARMIN_RUNNING_SPLITS_HEADERS
        );
        const existingSplitRows = await getSheetRows(splitsSheet);
        const existingSplitsActivityIds = new Set<string>();
        existingSplitRows.forEach((r: any) => {
          const actId = String(r.get('activityId') || '').trim();
          if (actId) existingSplitsActivityIds.add(actId);
        });

        const missingActivities = activities
          .filter(act => !existingSplitsActivityIds.has(String(act.activityId)))
          .slice(0, 2);

        if (missingActivities.length === 0) return;

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
                averageHR:
                  sp.averageHR !== undefined && sp.averageHR !== null ? String(sp.averageHR) : '',
                maxHR: sp.maxHR !== undefined && sp.maxHR !== null ? String(sp.maxHR) : '',
                cadence: sp.cadence !== undefined && sp.cadence !== null ? String(sp.cadence) : '',
                strideLengthCm:
                  sp.strideLengthCm !== undefined && sp.strideLengthCm !== null
                    ? String(sp.strideLengthCm)
                    : '',
                lastUpdated: nowIso,
              });
            });
          } catch (err) {
            console.warn(`[Garmin Splits] Failed to fetch splits for activity ${act.activityId}:`, err);
          }
        }

        if (newSplitRows.length > 0) {
          await withGarminApiRetry(() => splitsSheet.addRows(newSplitRows));
        }
      });
    } catch (err) {
      console.warn('[Garmin Splits] Best-effort splits sync skipped due to error:', err);
    }
  }
}

export function buildOverviewData(params: {
  todayStr: string;
  expiryInfo: { expiresAt: string; daysUntilExpiry: number; isExpiringSoon: boolean };
  lastSyncDate: string;
  calendarIcsUrl: string;
  cycle: GarminMenstrualCycle | null;
  activities: GarminRunningActivity[];
  scheduledWorkouts: GarminScheduledWorkout[];
  recentSleepMap: Record<string, GarminSleepData>;
}): GarminOverviewData {
  const {
    todayStr,
    expiryInfo,
    lastSyncDate,
    calendarIcsUrl,
    cycle,
    activities,
    scheduledWorkouts,
    recentSleepMap,
  } = params;

  const mondayStr = getMondayOfCurrentWeekTaipei(todayStr);
  const thisWeekRuns = activities.filter(a => a.date >= mondayStr);
  const upcomingScheduled = scheduledWorkouts.filter(w => w.date >= todayStr);

  return {
    configured: true,
    ...expiryInfo,
    calendarIcsConfigured: Boolean(calendarIcsUrl),
    lastSyncDate,
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
    recentSleepMap,
    fetchedAt: Date.now(),
  };
}

/**
 * Reads overview directly from Google Sheets (single source of truth across all Serverless instances).
 */
export async function readOverviewFromGoogleSheets(params: {
  todayStr: string;
  expiryInfo: { expiresAt: string; daysUntilExpiry: number; isExpiringSoon: boolean };
  lastSyncDate: string;
  calendarIcsUrl: string;
}): Promise<GarminOverviewData | null> {
  try {
    const doc = await withGarminApiRetry(() => getGoogleSheet());
    const sleepSheet = findSheetByTitle(doc, SLEEP_LOGS_SHEET_TITLE);
    const runningSheet = findSheetByTitle(doc, GARMIN_RUNNING_SHEET_TITLE);
    const scheduledSheet = findSheetByTitle(doc, GARMIN_SCHEDULED_SHEET_TITLE);
    if (!sleepSheet || !runningSheet) return null;

    const [sRows, rRows, sSchedRows] = await Promise.all([
      getSheetRows(sleepSheet),
      getSheetRows(runningSheet),
      scheduledSheet ? getSheetRows(scheduledSheet) : Promise.resolve([]),
    ]);
    if (sRows.length === 0) return null;

    const recentSleepMap: Record<string, GarminSleepData> = {};
    let latestCycle: GarminMenstrualCycle | null = null;

    const sortedSleepRows = sRows
      .filter(
        (r: any) =>
          String(r.get('status') || 'active') !== 'deleted' &&
          String(r.get('type') || 'night') === 'night'
      )
      .sort((a: any, b: any) => String(a.get('date') || '').localeCompare(String(b.get('date') || '')));

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
        avgRespiration: r.get('avgRespiration') ? Number(r.get('avgRespiration')) : undefined,
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

    const activities: GarminRunningActivity[] = rRows
      .map((r: any) => {
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
      })
      .sort((a, b) => {
        const cmp = b.startTimeLocal.localeCompare(a.startTimeLocal);
        return cmp !== 0 ? cmp : b.activityId - a.activityId;
      });

    let scheduledWorkouts: GarminScheduledWorkout[] = sSchedRows
      .map((r: any) => ({
        date: String(r.get('date') || '').trim(),
        summary: String(r.get('summary') || '').trim(),
        isRestDay: String(r.get('isRestDay') || '').toLowerCase() === 'true',
      }))
      .filter((w: GarminScheduledWorkout) => Boolean(w.date && w.summary))
      .sort((a: GarminScheduledWorkout, b: GarminScheduledWorkout) => a.date.localeCompare(b.date));

    if (scheduledWorkouts.length === 0 && params.calendarIcsUrl) {
      scheduledWorkouts = await fetchGarminCalendarWorkouts(params.calendarIcsUrl);
    }

    return buildOverviewData({
      todayStr: params.todayStr,
      expiryInfo: params.expiryInfo,
      lastSyncDate: params.lastSyncDate,
      calendarIcsUrl: params.calendarIcsUrl,
      cycle: latestCycle,
      activities,
      scheduledWorkouts,
      recentSleepMap,
    });
  } catch (err) {
    console.warn('[Garmin] Failed to read cached overview from Google Sheets:', err);
    return null;
  }
}
