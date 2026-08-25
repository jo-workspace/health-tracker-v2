export interface SleepLog {
  id: string;
  date: string;
  type: string;
  bedtime: string;
  fallAsleepTime: string;
  wakeupTime: string;
  sleepDuration: string;
  deepSleep: string;
  remSleep: string;
  stress: string;
  feeling: string;
  hrv: string;
  restingHeartRate: string;
  notes: string;
  status: string; // 'active' | 'deleted'
  lastUpdated: string;
}

export interface SupplementLog {
  id: string;
  date: string;
  items: string; // JSON string
  status: string;
  lastUpdated: string;
}

export interface RainbowDietLog {
  id: string;
  date: string;
  plantName: string;
  color: string;
  status: string;
  lastUpdated: string;
}

export interface SupplementSetting {
  id: string;
  name: string;
  time: string;
  targetAmount: string;
  status: string;
  lastUpdated: string;
  category?: string;
}

export interface PainHistoryEntry {
  id: string;
  date: string;
  level: number;
  levelLabel?: string;
  treatments?: string[];
  notes?: string;
  timestamp: number;
}

export interface PainLog {
  id: string;
  date: string;
  startDate?: string;
  recoveredDate?: string;
  location: string;
  trigger: string;
  intensity: number;
  level?: number;
  treatments?: string[];
  notes?: string;
  history?: PainHistoryEntry[];
  status: 'active' | 'recovered' | 'discontinued' | 'deleted';
  lastUpdated: number;
}

export interface LongTermLog {
  id: string;
  itemName: string;
  date: string;
  hospital?: string;
  doctor?: string;
  sizeWidth?: string;
  sizeHeight?: string;
  sizeDepth?: string;
  nextCheckupDate?: string;
  notes?: string;
  status: 'active' | 'archived' | 'deleted';
  lastUpdated: number;
}

export interface BiteSplintLog {
  id: string;
  date: string;
  status: 'active' | 'deleted';
  lastUpdated: number;
}

export interface TmySymptomLog {
  id: string;
  date: string;
  symptoms: string;
  intensity: number;
  side?: 'left' | 'right' | 'both' | ''; // 發作側別：左 / 右 / 雙側（舊紀錄為空）
  medication?: string;
  notes?: string;
  status: 'active' | 'deleted';
  lastUpdated: number;
}

export interface AllergyLog {
  id: string;
  date: string;
  locations: string; // comma-separated: 鼻子,皮膚,眼睛
  severity: number; // 1-10
  trigger?: string;
  medication?: string; // comma-separated ids: antihistamine, steroid_cream
  sleepImpact?: 'none' | 'mild' | 'severe';
  notes?: string;
  status: 'active' | 'deleted';
  lastUpdated: number;
}

export type IllnessCategory = 'respiratory' | 'digestive' | 'head_nerve' | 'skin_mucosa' | 'urinary_other' | 'custom';

export interface IllnessHistoryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  symptoms: string[];
  severity: number; // 1: 輕微, 2: 中度, 3: 嚴重
  temperature?: string; // e.g. 38.2
  medicationsTaken?: string[]; // 今日實際服用的藥物
  medicationCourseProgress?: string; // e.g. "第 2/3 天" or "第 2 天"
  notes?: string;
  timestamp: number;
}

export interface IllnessLog {
  id: string;
  name: string; // e.g. 感冒, 急性腸胃炎, 偏頭痛
  category: IllnessCategory;
  startDate: string; // YYYY-MM-DD
  recoveredDate?: string; // YYYY-MM-DD
  symptoms: string[]; // 目前/最新症狀
  severity: number; // 1: 輕微, 2: 中度, 3: 嚴重
  temperature?: string; // 最新體溫 (°C)
  medicalCare?: 'home' | 'clinic' | 'hospital' | 'other' | ''; // 就醫狀態: 居家照護/診所就醫/醫院就醫
  prescribedMedications?: string[]; // 醫生開立或自備的所有藥物清單
  medicationDaysTotal?: number; // 處方天數 (e.g. 3 天份)
  medicationsTaken?: string[]; // 今日實際服用之藥物
  notes?: string;
  history?: IllnessHistoryEntry[];
  status: 'active' | 'recovered' | 'deleted';
  lastUpdated: number;
}

export interface HealthData {
  sleepLogs?: SleepLog[];
  rainbowDietLogs?: RainbowDietLog[];
  supplementLogs?: SupplementLog[];
  supplementSettings?: SupplementSetting[];
  painLogs?: PainLog[];
  longTermLogs?: LongTermLog[];
  tmySymptomsLogs?: TmySymptomLog[];
  biteSplintLogs?: BiteSplintLog[];
  allergyLogs?: AllergyLog[];
  illnessLogs?: IllnessLog[];
}

export interface SyncPayload {
  sleepLogs?: SleepLog[];
  rainbowDietLogs?: RainbowDietLog[];
  supplementLogs?: SupplementLog[];
  supplementSettings?: SupplementSetting[];
  painLogs?: PainLog[];
  longTermLogs?: LongTermLog[];
  tmySymptomsLogs?: TmySymptomLog[];
  biteSplintLogs?: BiteSplintLog[];
  allergyLogs?: AllergyLog[];
  illnessLogs?: IllnessLog[];
  clientTimestamp: number;
}

