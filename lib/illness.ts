import type { IllnessLog, IllnessHistoryEntry, IllnessCategory } from './types';

export interface CategoryConfig {
  id: IllnessCategory;
  label: string;
  badgeClass: string;
  presetNames: string[];
  presetSymptoms: string[];
  presetMeds: string[];
}

export const ILLNESS_CATEGORIES: CategoryConfig[] = [
  {
    id: 'respiratory',
    label: '呼吸道',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    presetNames: ['感冒', '流感', '喉嚨發炎', '扁桃腺炎', '鼻竇炎'],
    presetSymptoms: ['發燒/畏寒', '喉嚨痛', '咳嗽(乾咳)', '咳嗽(帶痰)', '流鼻水', '鼻塞', '頭痛', '全身痠痛', '疲憊倦怠'],
    presetMeds: ['診所藥包', '退燒止痛藥', '普拿疼', '止咳化痰藥', '抗組織胺', '抗生素']
  },
  {
    id: 'digestive',
    label: '腸胃',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    presetNames: ['急性腸胃炎', '胃痙攣/胃痛', '胃食道逆流', '脹氣腹瀉', '食物不適'],
    presetSymptoms: ['腹痛/絞痛', '腹瀉', '水瀉', '噁心/嘔吐', '胃酸逆流', '脹氣', '發燒', '食慾不振'],
    presetMeds: ['止瀉藥', '止吐/消脹氣', '胃乳/制酸劑', '電解質水', '診所藥包']
  },
  {
    id: 'head_nerve',
    label: '頭部/神經',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    presetNames: ['偏頭痛', '緊縮型頭痛', '突發暈眩'],
    presetSymptoms: ['搏動性頭痛', '單側頭痛', '眼窩緊繃', '畏光/畏聲', '暈眩', '噁心'],
    presetMeds: ['偏頭痛特效藥', '止痛藥', '止暈藥', '肌肉鬆弛劑']
  },
  {
    id: 'skin_mucosa',
    label: '皮膚黏膜',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    presetNames: ['嘴破(口腔潰瘍)', '唇皰疹', '針眼(麥粒腫)', '接觸性皮膚炎'],
    presetSymptoms: ['局部刺痛', '潰瘍破損', '紅腫熱痛', '水泡', '搔癢'],
    presetMeds: ['口內膏', '抗病毒藥膏', '眼藥水/藥膏', '類固醇藥膏']
  },
  {
    id: 'urinary_other',
    label: '泌尿/其他',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    presetNames: ['急性尿道炎', '牙齦腫痛', '外傷發炎'],
    presetSymptoms: ['頻尿/急尿', '灼熱刺痛', '局部腫痛', '化膿發炎'],
    presetMeds: ['抗生素療程', '止痛消炎藥']
  },
  {
    id: 'custom',
    label: '其他自訂',
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
    presetNames: [],
    presetSymptoms: [],
    presetMeds: []
  }
];

export interface SeverityOption {
  level: number;
  label: string;
  badgeClass: string;
  dotClass: string;
}

export const SEVERITY_LEVELS: SeverityOption[] = [
  {
    level: 1,
    label: '輕微',
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
    dotClass: 'bg-stone-400'
  },
  {
    level: 2,
    label: '中度',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500'
  },
  {
    level: 3,
    label: '嚴重',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    dotClass: 'bg-red-500'
  }
];

export const MEDICAL_CARE_OPTIONS = [
  { id: 'home', label: '居家休養' },
  { id: 'clinic', label: '診所就醫' },
  { id: 'hospital', label: '醫院就醫' },
  { id: 'other', label: '其他處置' }
] as const;

export function getCategoryOption(categoryId?: IllnessCategory): CategoryConfig {
  const found = ILLNESS_CATEGORIES.find(c => c.id === categoryId);
  return found || ILLNESS_CATEGORIES[0];
}

export function getSeverityOption(level?: number): SeverityOption {
  const num = Number(level);
  if (num === 3) return SEVERITY_LEVELS[2];
  if (num === 2) return SEVERITY_LEVELS[1];
  return SEVERITY_LEVELS[0];
}

export function getIllnessDurationDays(startDateStr: string, endDateStr?: string): number {
  if (!startDateStr) return 1;
  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);

  const end = endDateStr ? new Date(endDateStr) : new Date();
  end.setHours(0, 0, 0, 0);

  const diffMs = end.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd}`;
  } catch {
    return dateStr;
  }
}

export function ensureIllnessLogHistory(log: IllnessLog): IllnessHistoryEntry[] {
  if (Array.isArray(log.history) && log.history.length > 0) {
    return [...log.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  const initialSeverity = log.severity || 1;
  return [
    {
      id: `${log.id}-init`,
      date: log.startDate || new Date(log.lastUpdated || Date.now()).toLocaleDateString('en-CA'),
      symptoms: log.symptoms || [],
      severity: initialSeverity,
      temperature: log.temperature || '',
      medicationsTaken: log.medicationsTaken || log.prescribedMedications || [],
      medicationCourseProgress: log.medicationDaysTotal ? `第 1/${log.medicationDaysTotal} 天` : '第 1 天',
      notes: log.notes || '',
      timestamp: log.lastUpdated || Date.now()
    }
  ];
}
