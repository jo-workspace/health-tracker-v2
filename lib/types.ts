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
  category: string;
  frequency: string;
  timeOfDay: string[];
  dosage: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  status: 'active' | 'archived';
  lastUpdated: number;
}

export interface PainLog {
  id: string;
  date: string;
  location: string;
  trigger: string;
  intensity: number;
  notes?: string;
  status: 'active' | 'recovered' | 'discontinued';
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
  medication?: string;
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
  clientTimestamp: number;
}
