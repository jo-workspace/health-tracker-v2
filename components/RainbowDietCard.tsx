'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Salad, ChevronRight, X, Plus, Check, Camera, Loader2, Sparkles, RotateCw, Lightbulb } from 'lucide-react';
import type { SyncPayload, RainbowDietLog } from '@/lib/types';

interface Props {
  data?: RainbowDietLog[];
  updateData: (payload: SyncPayload) => void;
}

interface DetectedItem {
  plantName: string;
  color: string;
  selected: boolean;
}

interface PendingImage {
  image: string;
  mimeType: string;
}

const COLOR_MAPPING: Record<string, string> = {
  // 紅色 (red)
  "番茄": "red", "西紅柿": "red", "蘋果": "red", "草莓": "red", "櫻桃": "red", "紅甜椒": "red", "紅椒": "red", "西瓜": "red", "蔓越莓": "red", "甜菜根": "red", "紅石榴": "red", "紅鳳菜": "red", "枸杞": "red", "紅豆": "red", "蓮霧": "red", "紅棗": "red", "紅火龍果": "red", "紅李": "red",
  // 橘黃色 (orange-yellow)
  "胡蘿蔔": "orange-yellow", "紅蘿蔔": "orange-yellow", "南瓜": "orange-yellow", "木瓜": "orange-yellow", "芒果": "orange-yellow", "香蕉": "orange-yellow", "地瓜": "orange-yellow", "番薯": "orange-yellow", "甘薯": "orange-yellow", "柑橘": "orange-yellow", "橘子": "orange-yellow", "柳丁": "orange-yellow", "柳橙": "orange-yellow", "黃甜椒": "orange-yellow", "黃椒": "orange-yellow", "玉米": "orange-yellow", "鳳梨": "orange-yellow", "柿子": "orange-yellow", "檸檬": "orange-yellow", "黃豆": "orange-yellow", "燕麥": "orange-yellow", "小米": "orange-yellow", "哈密瓜": "orange-yellow", "百香果": "orange-yellow", "枇杷": "orange-yellow", "栗子": "orange-yellow", "黃金果": "orange-yellow",
  // 綠色 (green)
  "菠菜": "green", "花椰菜": "green", "綠花椰菜": "green", "青花菜": "green", "空心菜": "green", "青江菜": "green", "奇異果": "green", "小黃瓜": "green", "黃瓜": "green", "蘆筍": "green", "青椒": "green", "芹菜": "green", "綠茶": "green", "芭樂": "green", "韭菜": "green", "四季豆": "green", "豌豆": "green", "毛豆": "green", "高麗菜": "green", "萵苣": "green", "綠豆": "green", "秋葵": "green", "地瓜葉": "green", "絲瓜": "green", "苦瓜": "green", "冬瓜": "green", "芥蘭": "green", "小白菜": "green", "油菜": "green", "茼蒿": "green", "青蔥": "green", "蔥": "green", "九層塔": "green", "香菜": "green", "莧菜": "green", "龍鬚菜": "green", "酪梨": "green", "綠葡萄": "green",
  // 藍紫色 (blue-purple)
  "藍莓": "blue-purple", "茄子": "blue-purple", "紫甘藍": "blue-purple", "葡萄": "blue-purple", "桑椹": "blue-purple", "紫地瓜": "blue-purple", "黑莓": "blue-purple", "李子": "blue-purple", "紫洋蔥": "blue-purple", "紫米": "blue-purple", "無花果": "blue-purple", "黑醋栗": "blue-purple", "甜菜": "blue-purple", "紫高麗菜": "blue-purple", "紫山藥": "blue-purple",
  // 白褐色 (white-brown)
  "洋蔥": "white-brown", "大蒜": "white-brown", "蒜頭": "white-brown", "白蘿蔔": "white-brown", "蘿蔔": "white-brown", "椰子": "white-brown", "山藥": "white-brown", "白花椰菜": "white-brown", "白花菜": "white-brown", "蘑菇": "white-brown", "金針菇": "white-brown", "杏鮑菇": "white-brown", "香菇": "white-brown", "豆腐": "white-brown", "豆芽": "white-brown", "綠豆芽": "white-brown", "黃豆芽": "white-brown", "豆芽菜": "white-brown", "銀芽": "white-brown", "糙米": "white-brown", "薏仁": "white-brown", "蓮子": "white-brown", "百合": "white-brown", "銀耳": "white-brown", "白木耳": "white-brown", "馬鈴薯": "white-brown", "洋芋": "white-brown", "竹筍": "white-brown", "白芝麻": "white-brown", "花生": "white-brown", "核桃": "white-brown", "腰果": "white-brown", "杏仁": "white-brown", "榛果": "white-brown", "夏威夷豆": "white-brown", "夏威夷果": "white-brown", "無籽西瓜": "white-brown", "白精靈菇": "white-brown", "燕麥片": "white-brown",
  // 黑色 (black)
  "黑木耳": "black", "木耳": "black", "黑豆": "black", "黑芝麻": "black", "黑米": "black", "海帶": "black", "紫菜": "black", "昆布": "black", "黑棗": "black", "奇亞籽": "black", "黑香菇": "black", "髮菜": "black"
};

const COLOR_INFO = [
  { id: 'red', label: '紅', hex: '#c4998e', textActive: 'text-white' },
  { id: 'orange-yellow', label: '橘黃', hex: '#c1a88b', textActive: 'text-white' },
  { id: 'green', label: '綠', hex: '#9ca896', textActive: 'text-white' },
  { id: 'blue-purple', label: '藍紫', hex: '#8fa0b5', textActive: 'text-white' },
  { id: 'white-brown', label: '白褐', hex: '#e2ded5', textActive: 'text-stone-600' },
  { id: 'black', label: '黑', hex: '#4a4a4a', textActive: 'text-white' }
];

export type PlantCategory = 'vegetables' | 'fruits' | 'grains' | 'legumes' | 'nuts-seeds' | 'spices';

export const CATEGORY_LABELS: Record<PlantCategory, string> = {
  'vegetables': '蔬菜',
  'fruits': '水果',
  'grains': '全穀雜糧',
  'legumes': '豆類',
  'nuts-seeds': '堅果種子',
  'spices': '辛香料'
};

const CATEGORY_MAPPING: Record<string, PlantCategory> = {
  // 堅果種子 (nuts-seeds)
  "核桃": "nuts-seeds", "腰果": "nuts-seeds", "杏仁": "nuts-seeds", "花生": "nuts-seeds",
  "南瓜子": "nuts-seeds", "葵花子": "nuts-seeds", "亞麻仁籽": "nuts-seeds", "奇亞籽": "nuts-seeds",
  "黑芝麻": "nuts-seeds", "白芝麻": "nuts-seeds", "松子": "nuts-seeds", "夏威夷豆": "nuts-seeds", "夏威夷果": "nuts-seeds",
  "開心果": "nuts-seeds", "榛果": "nuts-seeds", "栗子": "nuts-seeds",

  // 豆類 (legumes)
  "毛豆": "legumes", "黑豆": "legumes", "黃豆": "legumes", "紅豆": "legumes", "綠豆": "legumes",
  "豆腐": "legumes", "豆漿": "legumes", "豆乾": "legumes", "豆皮": "legumes", "鷹嘴豆": "legumes",
  "扁豆": "legumes", "四季豆": "legumes", "豌豆": "legumes",

  // 蔬菜類芽菜 (vegetables)
  "豆芽": "vegetables", "豆芽菜": "vegetables", "黃豆芽": "vegetables", "綠豆芽": "vegetables", "銀芽": "vegetables",

  // 全穀雜糧 (grains)
  "糙米": "grains", "紫米": "grains", "黑米": "grains", "紅米": "grains", "燕麥": "grains",
  "燕麥片": "grains", "地瓜": "grains", "番薯": "grains", "甘薯": "grains", "南瓜": "grains",
  "玉米": "grains", "芋頭": "grains", "山藥": "grains", "紫地瓜": "grains", "紫山藥": "grains",
  "馬鈴薯": "grains", "洋芋": "grains", "小米": "grains", "蕎麥": "grains", "紅藜": "grains",
  "藜麥": "grains", "薏仁": "grains", "蓮子": "grains",

  // 水果 (fruits)
  "蘋果": "fruits", "香蕉": "fruits", "奇異果": "fruits", "藍莓": "fruits", "葡萄": "fruits",
  "綠葡萄": "fruits", "草莓": "fruits", "櫻桃": "fruits", "西瓜": "fruits", "無籽西瓜": "fruits",
  "木瓜": "fruits", "芒果": "fruits", "柑橘": "fruits", "橘子": "fruits", "柳丁": "fruits",
  "柳橙": "fruits", "鳳梨": "fruits", "檸檬": "fruits", "芭樂": "fruits", "蓮霧": "fruits",
  "火龍果": "fruits", "紅火龍果": "fruits", "百香果": "fruits", "桑椹": "fruits", "柿子": "fruits",
  "哈密瓜": "fruits", "酪梨": "fruits", "無花果": "fruits", "蔓越莓": "fruits", "黑莓": "fruits",
  "李子": "fruits", "紅李": "fruits", "枇杷": "fruits", "黃金果": "fruits", "椰子": "fruits",

  // 辛香料與香草 (spices)
  "大蒜": "spices", "蒜頭": "spices", "生薑": "spices", "薑": "spices", "青蔥": "spices",
  "蔥": "spices", "辣椒": "spices", "紅辣椒": "spices", "九層塔": "spices", "羅勒": "spices",
  "香菜": "spices", "芫荽": "spices", "洋蔥": "spices", "紫洋蔥": "spices", "薑黃": "spices",
  "肉桂": "spices", "黑胡椒": "spices", "白胡椒": "spices", "迷迭香": "spices", "薄荷": "spices",
  "枸杞": "spices", "紅棗": "spices", "黑棗": "spices"
};

function getPlantCategory(name: string): PlantCategory {
  if (!name) return 'vegetables';
  const trimmed = name.trim();
  if (CATEGORY_MAPPING[trimmed]) return CATEGORY_MAPPING[trimmed];

  // 豆芽菜等發芽蔬菜在營養分類上為蔬菜類
  if (trimmed.includes('豆芽') || trimmed.includes('芽菜') || trimmed === '銀芽') {
    return 'vegetables';
  }

  if (trimmed.endsWith('子') || trimmed.endsWith('籽') || trimmed.includes('芝麻') || trimmed.includes('堅果')) {
    return 'nuts-seeds';
  }
  if (trimmed.includes('豆') && !trimmed.includes('地瓜')) {
    return 'legumes';
  }
  if (trimmed.includes('米') || trimmed.includes('麥') || trimmed.includes('薯') || trimmed.includes('芋') || trimmed.includes('藜')) {
    return 'grains';
  }
  if (trimmed.endsWith('莓') || trimmed.endsWith('果') || (trimmed.endsWith('瓜') && !['小黃瓜', '黃瓜', '苦瓜', '絲瓜', '冬瓜'].includes(trimmed))) {
    return 'fruits';
  }
  if (trimmed.includes('蒜') || trimmed.includes('薑') || trimmed.includes('蔥') || trimmed.includes('椒') || trimmed.includes('香草') || trimmed.includes('桂')) {
    return 'spices';
  }
  return 'vegetables';
}

function getDietSuggestion(
  uniquePlants: RainbowDietLog[],
  activeColors: Set<string>,
  target: number
): string {
  if (uniquePlants.length === 0) {
    return '補給靈感：本週開啟彩虹飲食，試試深綠蔬菜或全穀';
  }

  const categoryCounts: Record<PlantCategory, number> = {
    'nuts-seeds': 0,
    'legumes': 0,
    'grains': 0,
    'spices': 0,
    'fruits': 0,
    'vegetables': 0
  };

  uniquePlants.forEach(p => {
    const cat = getPlantCategory(p.plantName);
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  // 第一優先：類別為 0 的植物群 (順序: 堅果種子 -> 豆類 -> 全穀 -> 辛香料 -> 水果 -> 蔬菜)
  if (categoryCounts['nuts-seeds'] === 0) {
    return '補給靈感：堅果種子（如黑芝麻、核桃）';
  }
  if (categoryCounts['legumes'] === 0) {
    return '補給靈感：少豆類（如黑豆、毛豆、豆腐）';
  }
  if (categoryCounts['grains'] === 0) {
    return '補給靈感：全穀雜糧（如燕麥、糙米）';
  }
  if (categoryCounts['spices'] === 0) {
    return '補給靈感：辛香料（如大蒜、薑黃、黑胡椒）';
  }
  if (categoryCounts['fruits'] === 0) {
    return '補給靈感：水果（如藍莓、奇異果）';
  }
  if (categoryCounts['vegetables'] === 0) {
    return '補給靈感：深色蔬菜（如菠菜、青花菜）';
  }

  // 第二優先：缺少特定顏色 (順序: 藍紫 -> 黑 -> 紅 -> 橘黃 -> 綠 -> 白褐)
  if (!activeColors.has('blue-purple')) {
    return '補給靈感：少藍紫色（如紫洋蔥、藍莓）';
  }
  if (!activeColors.has('black')) {
    return '補給靈感：少黑色（如黑芝麻、黑木耳）';
  }
  if (!activeColors.has('red')) {
    return '補給靈感：少紅色（如番茄、甜菜根）';
  }
  if (!activeColors.has('orange-yellow')) {
    return '補給靈感：少橘黃色（如胡蘿蔔、南瓜）';
  }
  if (!activeColors.has('green')) {
    return '補給靈感：少綠色（如青花菜、菠菜）';
  }
  if (!activeColors.has('white-brown')) {
    return '補給靈感：少白褐色（如洋蔥、菇類）';
  }

  // 第三優先：六大類與各色皆已吃過至少 1 種
  if (uniquePlants.length >= target) {
    return '補給靈感：各類植物與各色系已均衡';
  }

  const lowestCat = (Object.entries(categoryCounts) as [PlantCategory, number][])
    .sort((a, b) => a[1] - b[1])[0][0];

  switch (lowestCat) {
    case 'nuts-seeds':
      return '補給靈感：多來點堅果種子（如奇亞籽、南瓜子）';
    case 'legumes':
      return '補給靈感：補充豆類（如毛豆、扁豆）';
    case 'grains':
      return '補給靈感：多些全穀（如紫米、藜麥）';
    case 'spices':
      return '補給靈感：增添辛香料（如羅勒、肉桂）';
    case 'fruits':
      return '補給靈感：補充水果（如芭樂、柑橘）';
    default:
      return '補給靈感：豐富多樣，朝目標 30 種邁進';
  }
}

export default function RainbowDietCard({ data = [], updateData }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSelectingColor, setIsSelectingColor] = useState(false);
  const [pendingPlantName, setPendingPlantName] = useState('');
  const [pendingQueue, setPendingQueue] = useState<string[]>([]);
  const [optimisticLogs, setOptimisticLogs] = useState<RainbowDietLog[]>([]);
  const [isSuccessAnim, setIsSuccessAnim] = useState(false);
  
  // AI 圖片辨識相關 State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [analyzeError, setAnalyzeError] = useState('');
  const [retrySeconds, setRetrySeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 429 冷卻倒數，倒數歸零後才開放重試
  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = setTimeout(() => setRetrySeconds(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [retrySeconds]);

  // 當真實資料回來時，清除樂觀更新
  useEffect(() => {
    setOptimisticLogs([]);
  }, [data]);

  // 取得本週的起迄日期字串 (週一 ~ 週日，格式 YYYY-MM-DD)
  const getWeekDates = () => {
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); 
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return {
      mondayStr: monday.toLocaleDateString('en-CA'),
      sundayStr: sunday.toLocaleDateString('en-CA'),
    };
  };

  const { mondayStr, sundayStr } = getWeekDates();

  // 過濾出本週的紀錄 (包含樂觀更新，使用 ISO 字典序比對排除時區偏差陷阱)
  const thisWeekLogs = [...data, ...optimisticLogs].filter(log => {
    return log.date >= mondayStr && log.date <= sundayStr && log.status !== 'deleted';
  });

  // 計算 unique 植物種類與涵蓋顏色
  const uniquePlantsMap = new Map<string, RainbowDietLog>();
  thisWeekLogs.forEach(log => {
    if (!uniquePlantsMap.has(log.plantName)) {
      uniquePlantsMap.set(log.plantName, log);
    }
  });

  const uniquePlants = Array.from(uniquePlantsMap.values());
  const plantCount = uniquePlants.length;
  const activeColors = new Set(uniquePlants.map(p => p.color));
  
  // 動態學習使用者的歷史顏色紀錄
  const historicalColorMap = new Map<string, string>();
  data.forEach(log => {
    if (log.plantName && log.color && log.status !== 'deleted') {
      historicalColorMap.set(log.plantName, log.color);
    }
  });
  
  const target = 30;
  const progressPercent = Math.min(100, (plantCount / target) * 100);
  const isGoalReached = plantCount >= target;

  const categoryStats = useMemo(() => {
    const counts: Record<PlantCategory, number> = {
      'nuts-seeds': 0,
      'legumes': 0,
      'grains': 0,
      'spices': 0,
      'fruits': 0,
      'vegetables': 0
    };
    uniquePlants.forEach(p => {
      const cat = getPlantCategory(p.plantName);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [uniquePlants]);

  const dietSuggestion = useMemo(() => {
    return getDietSuggestion(uniquePlants, activeColors, target);
  }, [uniquePlants, activeColors, target]);

  const getAchievementLabel = (count: number) => {
    if (count >= 30) return '👑 彩虹精靈';
    if (count >= 20) return '🌿 枝繁葉茂';
    if (count >= 10) return '🪴 成長茁壯';
    return '🌱 萌芽階段';
  };

  const submitLog = (plantName: string, color: string) => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const newLog: RainbowDietLog = {
      id: `diet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: todayStr,
      plantName,
      color,
      status: 'active',
      lastUpdated: Date.now().toString(),
    };
    
    setOptimisticLogs(prev => [...prev, newLog]);
    setIsSuccessAnim(true);
    setTimeout(() => setIsSuccessAnim(false), 2000);
    
    updateData({
      rainbowDietLogs: [newLog],
      clientTimestamp: Date.now()
    });
    
    setInputValue('');
    setIsSelectingColor(false);
  };

  const submitBatchLogs = (items: DetectedItem[]) => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const selectedItems = items.filter(i => i.selected);
    if (selectedItems.length === 0) return;

    const newLogs: RainbowDietLog[] = selectedItems.map((item, idx) => ({
      id: `diet-${Date.now()}-${idx}`,
      date: todayStr,
      plantName: item.plantName,
      color: item.color,
      status: 'active',
      lastUpdated: Date.now().toString(),
    }));

    setOptimisticLogs(prev => [...prev, ...newLogs]);
    setIsSuccessAnim(true);
    setTimeout(() => setIsSuccessAnim(false), 2000);

    updateData({
      rainbowDietLogs: newLogs,
      clientTimestamp: Date.now()
    });

    setIsAiModalOpen(false);
  };

  const runAnalysis = async (img: PendingImage) => {
    setIsAnalyzing(true);
    setAnalyzeError('');

    try {
      const password = typeof window !== 'undefined' ? localStorage.getItem('app_password') || '' : '';
      const res = await fetch('/api/analyze-diet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
        body: JSON.stringify({
          image: img.image,
          mimeType: img.mimeType
        })
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err: any = new Error(resData.error || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }

      if (resData.items && Array.isArray(resData.items) && resData.items.length > 0) {
        const parsedItems: DetectedItem[] = resData.items.map((it: any) => ({
          plantName: it.plantName,
          color: COLOR_MAPPING[it.plantName] || historicalColorMap.get(it.plantName) || it.color || 'green',
          selected: true
        }));
        setDetectedItems(parsedItems);
        setIsAiModalOpen(true);
        // 成功後才釋放暫存的照片
        setPendingImage(null);
      } else {
        setAnalyzeError('未能辨識出餐點中的植物食材。可直接重試一次，或更換清晰照片、手動輸入。');
        setRetrySeconds(0);
      }
    } catch (error: any) {
      console.error('Diet image analysis error:', error);
      const msg = error.message || '';
      const isRateLimited = error.status === 429 || msg.includes('429') || msg.includes('Rate Limit');
      if (isRateLimited) {
        setAnalyzeError('Google API 次數暫時達上限。照片已保留，倒數結束後直接按「重新辨識」即可，不用重拍。');
        setRetrySeconds(15);
      } else {
        setAnalyzeError(`AI 辨識失敗：${msg || '請稍後再試'}。照片已保留，可直接重試。`);
        setRetrySeconds(0);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (!file) return;

    setIsAnalyzing(true);
    setAnalyzeError('');
    setRetrySeconds(0);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const img: PendingImage = {
        image: event.target?.result as string,
        mimeType: file.type || 'image/jpeg'
      };
      setPendingImage(img);
      await runAnalysis(img);
    };
    reader.onerror = (err) => {
      console.error('Diet image read error:', err);
      setPendingImage(null);
      setAnalyzeError('讀取照片失敗，請重新選擇檔案。');
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;
    
    // 支援半形逗號 (,)、全形逗號 (，)、與換行符號切割多項食材
    const rawItems = inputValue
      .split(/[,，\n]/)
      .map(s => s.trim())
      .filter(Boolean);

    if (rawItems.length === 0) return;

    const knownItems: DetectedItem[] = [];
    const unknownItems: string[] = [];

    rawItems.forEach(plant => {
      const mappedColor = COLOR_MAPPING[plant] || historicalColorMap.get(plant);
      if (mappedColor) {
        knownItems.push({ plantName: plant, color: mappedColor, selected: true });
      } else {
        unknownItems.push(plant);
      }
    });

    if (knownItems.length > 0) {
      submitBatchLogs(knownItems);
    }

    if (unknownItems.length > 0) {
      setPendingQueue(unknownItems.slice(1));
      setPendingPlantName(unknownItems[0]);
      setIsSelectingColor(true);
    } else {
      setInputValue('');
    }

    inputRef.current?.blur();
  };

  const handleSelectPendingColor = (color: string) => {
    if (!pendingPlantName) return;

    submitLog(pendingPlantName, color);

    if (pendingQueue.length > 0) {
      const nextPlant = pendingQueue[0];
      setPendingQueue(prev => prev.slice(1));
      setPendingPlantName(nextPlant);
    } else {
      setPendingPlantName('');
      setIsSelectingColor(false);
      setInputValue('');
    }
  };

  useEffect(() => {
    if (isModalOpen || isAiModalOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen, isAiModalOpen]);

  return (
    <>
      <div onClick={() => setIsModalOpen(true)} className="w-full max-w-md mx-auto bg-[#fdfdfc] rounded-lg shadow-sm border border-stone-200 mb-4 transition-all hover:shadow-md cursor-pointer group">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-stone-700">
              <Salad size={18} strokeWidth={2.5} className="text-[#6ba388]" />
              <h3 className="font-bold text-base">彩虹飲食</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#6ba388] mr-1">{getAchievementLabel(plantCount)}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-stone-700 leading-none">{plantCount}</span>
                <span className="text-xs text-stone-400 font-medium">/ {target}</span>
              </div>
            </div>
          </div>

          <div className="flex w-full h-1.5 rounded-full overflow-hidden bg-stone-100 mb-4">
            <div 
              className={`h-full transition-all duration-700 ${isGoalReached ? 'rainbow-gradient-fill' : 'bg-[#6ba388]'}`} 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>

          <div className="flex justify-between items-center gap-1.5 mb-4">
            {COLOR_INFO.map(c => {
              const isActive = activeColors.has(c.id);
              return (
                <div 
                  key={c.id} 
                  className={`flex-1 h-6 rounded-md flex items-center justify-center text-[10px] font-bold transition-all border border-stone-200/50 ${
                    isActive 
                      ? `${c.textActive} shadow-sm opacity-100` 
                      : 'opacity-25 grayscale-[80%] text-white'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                >
                  {c.label}
                </div>
              );
            })}
          </div>

          {/* 補給靈感建議條 */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-3 bg-stone-50 border border-stone-200/70 rounded-md text-stone-600">
            <Lightbulb size={13} className="text-[#6ba388] shrink-0" />
            <span className="text-[11px] font-medium leading-tight truncate">
              {dietSuggestion}
            </span>
          </div>

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleFormSubmit} className="relative">
              <input 
                ref={inputRef}
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFormSubmit(e);
                  }
                }}
                placeholder="輸入食材 (可用逗號分隔) 或拍照辨識..."
                className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-3 pr-16 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6ba388]/30 transition-shadow"
              />

              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 transition-colors disabled:opacity-50"
                  title="拍照/傳圖 AI 自動辨識彩虹食材"
                >
                  {isAnalyzing ? <Loader2 size={13} className="animate-spin text-[#6ba388]" /> : <Camera size={13} />}
                </button>
                <button type="submit" className={`w-6 h-6 flex items-center justify-center rounded-md transition-all duration-300 ${
                  isSuccessAnim ? 'bg-[#5b8c74] text-white scale-110' : 'bg-[#6ba388] text-white hover:bg-[#5b8c74]'
                }`}>
                  {isSuccessAnim ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
                </button>
              </div>

              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            </form>
            
            {isSelectingColor && (
              <div className="absolute top-full left-0 w-full mt-1 p-2 bg-white rounded-lg shadow-lg border border-stone-200 z-10 animate-fade-in">
                <div className="text-xs text-stone-500 mb-2 font-medium">請為「{pendingPlantName}」選擇顏色：</div>
                <div className="flex justify-between gap-1">
                  {COLOR_INFO.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectPendingColor(c.id)}
                      className={`flex-1 aspect-square rounded-md flex flex-col items-center justify-center gap-1 hover:opacity-80 transition-opacity ${c.textActive}`}
                      style={{ backgroundColor: c.hex }}
                    >
                      <span className="text-[10px] font-bold">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {analyzeError && (
              <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex flex-col gap-2">
                <p className="text-[11px] leading-relaxed text-amber-800">{analyzeError}</p>
                {pendingImage && (
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setPendingImage(null); setAnalyzeError(''); setRetrySeconds(0); }}
                      className="px-2.5 py-1 text-[11px] font-bold text-stone-500 bg-white border border-stone-200 rounded-full hover:bg-stone-50 transition-colors"
                    >
                      放棄
                    </button>
                    <button
                      type="button"
                      onClick={() => runAnalysis(pendingImage)}
                      disabled={isAnalyzing || retrySeconds > 0}
                      className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-white bg-[#6ba388] rounded-full hover:bg-[#5b8c74] transition-colors disabled:opacity-50 disabled:hover:bg-[#6ba388]"
                    >
                      {isAnalyzing
                        ? <><Loader2 size={12} className="animate-spin" />辨識中...</>
                        : retrySeconds > 0
                          ? <>{retrySeconds} 秒後可重試</>
                          : <><RotateCw size={12} />重新辨識</>}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI 照片辨識結果確認 Modal */}
      {isAiModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsAiModalOpen(false)} />
          <div className="relative bg-[#fdfdfc] w-full max-w-sm rounded-2xl shadow-2xl p-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-stone-100">
              <h3 className="font-bold text-stone-800 text-base flex items-center gap-1.5">
                <Sparkles size={18} className="text-[#6ba388]" />
                AI 辨識出的彩虹食材
              </h3>
              <button onClick={() => setIsAiModalOpen(false)} className="p-1 rounded-full text-stone-400 hover:bg-stone-100">
                <X size={16} />
              </button>
            </div>
            
            <p className="text-xs text-stone-500 mb-4">請確認本次餐點包含的植物食材，取消勾選不需要的項目：</p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-5">
              {detectedItems.map((item, idx) => {
                const colorObj = COLOR_INFO.find(c => c.id === item.color) || COLOR_INFO[2];
                return (
                  <label 
                    key={idx}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors cursor-pointer ${
                      item.selected ? 'bg-stone-50 border-stone-200' : 'bg-white border-stone-100 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input 
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => {
                          setDetectedItems(prev => prev.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it));
                        }}
                        className="w-4 h-4 accent-[#6ba388] rounded"
                      />
                      <span className="text-sm font-bold text-stone-700">{item.plantName}</span>
                    </div>

                    <span 
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colorObj.textActive}`}
                      style={{ backgroundColor: colorObj.hex }}
                    >
                      {colorObj.label}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="flex-1 py-2.5 text-stone-500 font-bold text-xs bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => submitBatchLogs(detectedItems)}
                className="flex-1 py-2.5 text-white font-bold text-xs bg-[#6ba388] rounded-xl hover:bg-[#5b8c74] transition-colors shadow-sm"
              >
                一鍵登錄 (選取 {detectedItems.filter(i => i.selected).length} 項)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 詳情統計 Modal */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsModalOpen(false)} />
          <div className="absolute bottom-0 left-0 w-full sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md bg-[#fdfdfc] rounded-t-2xl sm:rounded-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] sm:shadow-2xl border-t border-stone-200 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full duration-300">
            <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
              <div className="w-8 h-8" />
              <div className="w-12 h-1.5 bg-stone-200 rounded-full sm:hidden" />
              <div className="hidden sm:block text-sm font-bold text-stone-400">詳情面板</div>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 shrink-0 flex justify-between items-end border-b border-stone-50">
              <div>
                <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                  <Salad size={20} className="text-[#6ba388]" /> 彩虹飲食統計
                </h2>
                <p className="text-xs text-stone-500 mt-1">本週成就進度：{plantCount} / 30 種</p>
              </div>
            </div>

            <div className="p-4 overflow-y-auto">
              {/* 六大植物群覆蓋狀況 */}
              <div className="mb-4 p-3 bg-stone-50 border border-stone-200/60 rounded-xl">
                <div className="text-xs font-bold text-stone-600 mb-2 flex items-center justify-between">
                  <span>六大植物群覆蓋</span>
                  <span className="text-[10px] text-stone-400 font-medium">
                    {Object.values(categoryStats).filter(c => c > 0).length} / 6 群已點亮
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.entries(CATEGORY_LABELS) as [PlantCategory, string][]).map(([catKey, label]) => {
                    const count = categoryStats[catKey] || 0;
                    return (
                      <div 
                        key={catKey} 
                        className={`p-1.5 rounded-lg border text-center transition-all ${
                          count > 0 
                            ? 'bg-white border-stone-200 text-stone-700 font-bold shadow-xs' 
                            : 'bg-transparent border-dashed border-stone-200 text-stone-400'
                        }`}
                      >
                        <div className="text-[10px]">{label}</div>
                        <div className="text-xs">{count} 種</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <h4 className="text-sm font-bold text-stone-700 mb-3 border-b border-stone-100 pb-2">本週已吃植物清單</h4>
              
              {plantCount === 0 ? (
                <div className="text-center text-stone-400 py-8 text-sm">
                  本週還沒有紀錄任何植物喔！<br/>快在首頁輸入或拍照辨識吃過的食材吧！
                </div>
              ) : (
                <div className="flex flex-col gap-4 pb-8">
                  {COLOR_INFO.map(colorInfo => {
                    const plantsInColor = uniquePlants.filter(p => p.color === colorInfo.id);
                    if (plantsInColor.length === 0) return null;
                    
                    return (
                      <div key={colorInfo.id} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorInfo.hex }}></div>
                          <span className="text-xs font-bold text-stone-600">{colorInfo.label}色系</span>
                          <span className="text-[10px] text-stone-400 font-medium ml-auto">{plantsInColor.length} 種</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pl-5">
                          {plantsInColor.map(p => {
                            const cat = getPlantCategory(p.plantName);
                            return (
                              <span key={p.id} className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-md border border-stone-200 flex items-center gap-1">
                                <span>{p.plantName}</span>
                                <span className="text-[10px] text-stone-400">· {CATEGORY_LABELS[cat]}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
