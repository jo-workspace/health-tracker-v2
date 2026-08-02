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

export interface PainLog {
  id: string;
  date: string;
  location: string;
  trigger: string;
  intensity: number;
  notes?: string;
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
  clientTimestamp: number;
}
