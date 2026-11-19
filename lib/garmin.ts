import type {
  GarminSleepData,
  GarminRunningActivity,
  GarminMenstrualCycle,
} from './types';

const GARMIN_BASE_URL = 'https://personal.connectapi.garmin.com';
const TOKEN_ENDPOINT = `${GARMIN_BASE_URL}/personalapitoken-service/personal-api/personal-api-key/token`;

interface CachedToken {
  apiKey: string;
  accessToken: string;
  expiresAtMs: number;
}

let cachedBearerToken: CachedToken | null = null;

function parseJwtExpMs(jwt: string): number {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return Date.now() + 23 * 3600 * 1000;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof payload.exp === 'number') {
      return payload.exp * 1000;
    }
  } catch {}
  return Date.now() + 23 * 3600 * 1000;
}

export async function obtainGarminBearerToken(apiKey: string, forceRefresh = false): Promise<string> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('Garmin Personal API Key is not configured');
  }

  // Reuse cached token if at least 1 hour remaining
  if (
    !forceRefresh &&
    cachedBearerToken &&
    cachedBearerToken.apiKey === cleanKey &&
    cachedBearerToken.expiresAtMs - Date.now() > 3600 * 1000
  ) {
    return cachedBearerToken.accessToken;
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `ApiKey ${cleanKey}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Garmin token exchange failed (${res.status}): ${errText.slice(0, 120)}`);
  }

  const rawText = (await res.text()).trim();
  let accessToken = rawText;
  if (rawText.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawText);
      accessToken = parsed.access_token || parsed.token || rawText;
    } catch {}
  }

  cachedBearerToken = {
    apiKey: cleanKey,
    accessToken,
    expiresAtMs: parseJwtExpMs(accessToken),
  };

  return accessToken;
}

async function garminGet<T = any>(token: string, path: string): Promise<T | null> {
  const res = await fetch(`${GARMIN_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (res.status === 204 || res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Garmin GET ${path} failed (${res.status}): ${text.slice(0, 120)}`);
  }

  const body = await res.text();
  if (!body || !body.trim()) return null;
  return JSON.parse(body) as T;
}

/**
 * Garmin `sleepStartTimestampLocal` and `sleepEndTimestampLocal` are epoch-like milliseconds
 * shifted into the user's local timezone (i.e. interpreting as UTC yields local wall-clock time).
 */
function formatLocalEpochTo12h(localMs?: number | null): {
  bedtime12h: string;
  bedtimeTime: string;
  bedtimePeriod: 'AM' | 'PM';
  time24h: string;
} {
  if (!localMs || isNaN(localMs)) {
    return { bedtime12h: '', bedtimeTime: '', bedtimePeriod: 'PM', time24h: '' };
  }
  const d = new Date(localMs);
  const h24 = d.getUTCHours();
  const m = d.getUTCMinutes();
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const mm = String(m).padStart(2, '0');
  const hh12 = String(h12).padStart(2, '0');
  const hh24 = String(h24).padStart(2, '0');
  return {
    bedtime12h: `${h12}:${mm} ${period}`,
    bedtimeTime: `${hh12}:${mm}`,
    bedtimePeriod: period,
    time24h: `${hh24}:${mm}`,
  };
}

function parseGarminSleepObject(
  sleepObj: any,
  hrvSummary?: any,
  rhrValue?: number
): GarminSleepData | null {
  if (!sleepObj || !sleepObj.calendarDate) return null;
  const sleepSec = Number(sleepObj.sleepTimeSeconds) || 0;
  const napSec = Number(sleepObj.napTimeSeconds) || 0;
  if (sleepSec <= 0 && napSec <= 0) return null;

  const startFormatted = formatLocalEpochTo12h(sleepObj.sleepStartTimestampLocal);
  const endFormatted = formatLocalEpochTo12h(sleepObj.sleepEndTimestampLocal);

  const totalMinutes = Math.round(sleepSec / 60);
  const durationHoursPart = Math.floor(totalMinutes / 60);
  const durationMinutesPart = totalMinutes % 60;
  const sleepDurationHours = +(sleepSec / 3600).toFixed(2);

  const deepSec = Number(sleepObj.deepSleepSeconds) || 0;
  const remSec = Number(sleepObj.remSleepSeconds) || 0;
  const lightSec = Number(sleepObj.lightSleepSeconds) || 0;

  const overallScore = sleepObj.sleepScores?.overall?.value;
  const overallQualifier = sleepObj.sleepScores?.overall?.qualifierKey;
  const sleepStress =
    typeof sleepObj.avgSleepStress === 'number' ? Math.round(sleepObj.avgSleepStress) : undefined;

  const hrv =
    typeof hrvSummary?.lastNightAvg === 'number'
      ? hrvSummary.lastNightAvg
      : typeof sleepObj.avgOvernightHrv === 'number'
      ? Math.round(sleepObj.avgOvernightHrv)
      : undefined;

  return {
    date: sleepObj.calendarDate,
    bedtime12h: startFormatted.bedtime12h,
    bedtimeTime: startFormatted.bedtimeTime,
    bedtimePeriod: startFormatted.bedtimePeriod,
    wakeupTime24h: endFormatted.time24h,
    sleepDurationHours,
    durationHoursPart,
    durationMinutesPart,
    deepSleepHours: +(deepSec / 3600).toFixed(2),
    remSleepHours: +(remSec / 3600).toFixed(2),
    lightSleepHours: +(lightSec / 3600).toFixed(2),
    napMinutes: Math.round(napSec / 60),
    sleepScore: typeof overallScore === 'number' ? overallScore : undefined,
    sleepScoreQualifier: overallQualifier || undefined,
    sleepStress,
    hrv,
    hrvStatus: hrvSummary?.status || undefined,
    restingHeartRate: rhrValue,
  };
}

export async function fetchGarminSleepForDate(
  token: string,
  date: string
): Promise<GarminSleepData | null> {
  const [sleepRes, hrvRes, summaryRes] = await Promise.all([
    garminGet<any>(token, `/sleep-service/sleep/dailySleep?date=${date}`).catch(() => null),
    garminGet<any>(token, `/hrv-service/hrv/${date}`).catch(() => null),
    garminGet<any>(
      token,
      `/usersummary-service/v2/dailysummaries?startDate=${date}&endDate=${date}`
    ).catch(() => null),
  ]);

  const dailySummary = summaryRes?.data?.[0];
  const rhr =
    typeof dailySummary?.heartRate?.restingValue === 'number'
      ? dailySummary.heartRate.restingValue
      : undefined;

  return parseGarminSleepObject(sleepRes, hrvRes?.hrvSummary, rhr);
}

export async function fetchGarminRecentSleepMap(
  token: string,
  startDate: string,
  endDate: string
): Promise<Record<string, GarminSleepData>> {
  const [sleepList, hrvData, summaryData] = await Promise.all([
    garminGet<any[]>(
      token,
      `/sleep-service/sleep/dailySleepSummariesByDate?startDate=${startDate}&endDate=${endDate}`
    ).catch(() => []),
    garminGet<any>(token, `/hrv-service/hrv/daily/${startDate}/${endDate}`).catch(() => null),
    garminGet<any>(
      token,
      `/usersummary-service/v2/dailysummaries?startDate=${startDate}&endDate=${endDate}`
    ).catch(() => null),
  ]);

  const hrvByDate: Record<string, any> = {};
  if (Array.isArray(hrvData?.hrvSummaries)) {
    hrvData.hrvSummaries.forEach((h: any) => {
      if (h?.calendarDate) hrvByDate[h.calendarDate] = h;
    });
  }

  const rhrByDate: Record<string, number> = {};
  if (Array.isArray(summaryData?.data)) {
    summaryData.data.forEach((d: any) => {
      if (d?.calendarDate && typeof d?.heartRate?.restingValue === 'number') {
        rhrByDate[d.calendarDate] = d.heartRate.restingValue;
      }
    });
  }

  const map: Record<string, GarminSleepData> = {};
  if (Array.isArray(sleepList)) {
    sleepList.forEach(item => {
      const parsed = parseGarminSleepObject(
        item,
        hrvByDate[item?.calendarDate],
        rhrByDate[item?.calendarDate]
      );
      if (parsed) {
        map[parsed.date] = parsed;
      }
    });
  }

  return map;
}

function formatPacePerKm(distanceMeters: number, durationSec: number): string {
  if (!distanceMeters || distanceMeters <= 0 || !durationSec || durationSec <= 0) return '-';
  const secPerKm = durationSec / (distanceMeters / 1000);
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  if (secs === 60) {
    return `${mins + 1}'00"/km`;
  }
  return `${mins}'${String(secs).padStart(2, '0')}"/km`;
}

function formatDurationCompact(durationSec: number): string {
  const totalMin = Math.round(durationSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  return `${m}m`;
}

function cleanActivityTitle(rawName?: string, locationName?: string): string {
  if (!rawName) return '跑步';
  let cleaned = rawName.trim();
  if (locationName && cleaned.startsWith(locationName)) {
    cleaned = cleaned.slice(locationName.length).replace(/^\s*[-·]\s*/, '').trim();
  }
  cleaned = cleaned.replace(/^[^\s]+區\s*[-·]\s*/, '').trim();
  return cleaned || rawName.trim();
}

export async function fetchGarminRunningActivities(
  token: string,
  limit = 20
): Promise<GarminRunningActivity[]> {
  const list = await garminGet<any[]>(
    token,
    `/activitylist-service/activities/search/activities?start=0&limit=${limit}`
  ).catch(() => []);

  if (!Array.isArray(list)) return [];

  const runningItems = list.filter(item => {
    const typeKey = item?.activityType?.typeKey || '';
    const sportId = item?.sportTypeId;
    return (
      typeKey.includes('running') ||
      typeKey === 'treadmill_running' ||
      typeKey === 'track_running' ||
      typeKey === 'trail_running' ||
      sportId === 1
    );
  });

  return runningItems.map(item => {
    const distMeters = Number(item.distance) || 0;
    const durSec = Number(item.duration) || 0;
    const startLocal = String(item.startTimeLocal || '');
    const datePart = startLocal.slice(0, 10);

    return {
      activityId: Number(item.activityId),
      name: String(item.activityName || '跑步'),
      cleanName: cleanActivityTitle(item.activityName, item.locationName),
      date: datePart,
      startTimeLocal: startLocal,
      distanceKm: +(distMeters / 1000).toFixed(2),
      durationSeconds: Math.round(durSec),
      durationFormatted: formatDurationCompact(durSec),
      paceFormatted: formatPacePerKm(distMeters, durSec),
      averageHR: typeof item.averageHR === 'number' ? Math.round(item.averageHR) : undefined,
      maxHR: typeof item.maxHR === 'number' ? Math.round(item.maxHR) : undefined,
      avgPower: typeof item.avgPower === 'number' ? Math.round(item.avgPower) : undefined,
      normPower: typeof item.normPower === 'number' ? Math.round(item.normPower) : undefined,
      cadence:
        typeof item.averageRunningCadenceInStepsPerMinute === 'number'
          ? Math.round(item.averageRunningCadenceInStepsPerMinute)
          : undefined,
      strideLengthCm:
        typeof item.avgStrideLength === 'number' ? Math.round(item.avgStrideLength) : undefined,
      groundContactTimeMs:
        typeof item.avgGroundContactTime === 'number'
          ? Math.round(item.avgGroundContactTime)
          : undefined,
      verticalOscillationCm:
        typeof item.avgVerticalOscillation === 'number'
          ? +item.avgVerticalOscillation.toFixed(1)
          : undefined,
      verticalRatioPct:
        typeof item.avgVerticalRatio === 'number' ? +item.avgVerticalRatio.toFixed(1) : undefined,
      aerobicTE:
        typeof item.aerobicTrainingEffect === 'number'
          ? +item.aerobicTrainingEffect.toFixed(1)
          : undefined,
      anaerobicTE:
        typeof item.anaerobicTrainingEffect === 'number'
          ? +item.anaerobicTrainingEffect.toFixed(1)
          : undefined,
      trainingLoad:
        typeof item.activityTrainingLoad === 'number'
          ? Math.round(item.activityTrainingLoad)
          : undefined,
      trainingEffectLabel: item.trainingEffectLabel || undefined,
      calories: typeof item.calories === 'number' ? Math.round(item.calories) : undefined,
    };
  });
}

const PHASE_NAMES: Record<number, string> = {
  1: '經期',
  2: '濾泡期',
  3: '排卵期',
  4: '黃體期',
};

export async function fetchGarminMenstrualCycle(
  token: string,
  date: string
): Promise<GarminMenstrualCycle | null> {
  const data = await garminGet<any>(
    token,
    `/periodichealth-service/menstrualcycle/summary/${date}`
  ).catch(() => null);

  if (!data || typeof data.dayInCycle !== 'number') return null;

  const phaseNum = Number(data.currentPhase) || 0;
  return {
    startDate: String(data.startDate || ''),
    dayInCycle: data.dayInCycle,
    periodLength: Number(data.periodLength) || 0,
    currentPhase: phaseNum,
    phaseName: PHASE_NAMES[phaseNum] || `階段 ${phaseNum}`,
    lengthOfCurrentPhase: Number(data.lengthOfCurrentPhase) || 0,
    daysUntilNextPhase: Number(data.daysUntilNextPhase) || 0,
    predictedCycleLength: Number(data.predictedCycleLength) || 0,
  };
}
