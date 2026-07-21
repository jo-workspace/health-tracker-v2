'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Salad, ChevronRight, X, Plus, Check } from 'lucide-react';
import type { SyncPayload, RainbowDietLog } from '@/lib/types';

interface Props {
  data?: RainbowDietLog[];
  updateData: (payload: SyncPayload) => void;
}

const COLOR_MAPPING: Record<string, string> = {
  // 紅色 (red)
  "番茄": "red", "西紅柿": "red", "蘋果": "red", "草莓": "red", "櫻桃": "red", "紅甜椒": "red", "紅椒": "red", "西瓜": "red", "蔓越莓": "red", "甜菜根": "red", "紅石榴": "red", "紅鳳菜": "red", "枸杞": "red", "紅豆": "red", "蓮霧": "red", "紅棗": "red", "紅火龍果": "red", "紅李": "red",
  // 橘黃色 (orange-yellow)
  "胡蘿蔔": "orange-yellow", "紅蘿蔔": "orange-yellow", "南瓜": "orange-yellow", "木瓜": "orange-yellow", "芒果": "orange-yellow", "香蕉": "orange-yellow", "地瓜": "orange-yellow", "番薯": "orange-yellow", "甘薯": "orange-yellow", "柑橘": "orange-yellow", "橘子": "orange-yellow", "柳丁": "orange-yellow", "柳橙": "orange-yellow", "黃甜椒": "orange-yellow", "黃椒": "orange-yellow", "玉米": "orange-yellow", "鳳梨": "orange-yellow", "柿子": "orange-yellow", "檸檬": "orange-yellow", "黃豆": "orange-yellow", "燕麥": "orange-yellow", "小米": "orange-yellow", "哈密瓜": "orange-yellow", "百香果": "orange-yellow", "枇杷": "orange-yellow", "黃豆芽": "orange-yellow", "栗子": "orange-yellow", "黃金果": "orange-yellow",
  // 綠色 (green)
  "菠菜": "green", "花椰菜": "green", "綠花椰菜": "green", "青花菜": "green", "空心菜": "green", "青江菜": "green", "奇異果": "green", "小黃瓜": "green", "黃瓜": "green", "蘆筍": "green", "青椒": "green", "芹菜": "green", "綠茶": "green", "芭樂": "green", "韭菜": "green", "四季豆": "green", "豌豆": "green", "毛豆": "green", "高麗菜": "green", "萵苣": "green", "綠豆": "green", "秋葵": "green", "地瓜葉": "green", "絲瓜": "green", "苦瓜": "green", "冬瓜": "green", "芥蘭": "green", "小白菜": "green", "油菜": "green", "茼蒿": "green", "青蔥": "green", "蔥": "green", "九層塔": "green", "香菜": "green", "莧菜": "green", "龍鬚菜": "green", "酪梨": "green", "綠葡萄": "green",
  // 藍紫色 (blue-purple)
  "藍莓": "blue-purple", "茄子": "blue-purple", "紫甘藍": "blue-purple", "葡萄": "blue-purple", "桑椹": "blue-purple", "紫地瓜": "blue-purple", "黑莓": "blue-purple", "李子": "blue-purple", "紫洋蔥": "blue-purple", "紫米": "blue-purple", "無花果": "blue-purple", "黑醋栗": "blue-purple", "甜菜": "blue-purple", "紫高麗菜": "blue-purple", "紫山藥": "blue-purple",
  // 白褐色 (white-brown)
  "洋蔥": "white-brown", "大蒜": "white-brown", "蒜頭": "white-brown", "白蘿蔔": "white-brown", "蘿蔔": "white-brown", "椰子": "white-brown", "山藥": "white-brown", "白花椰菜": "white-brown", "白花菜": "white-brown", "蘑菇": "white-brown", "金針菇": "white-brown", "杏鮑菇": "white-brown", "香菇": "white-brown", "豆腐": "white-brown", "糙米": "white-brown", "薏仁": "white-brown", "蓮子": "white-brown", "百合": "white-brown", "銀耳": "white-brown", "白木耳": "white-brown", "馬鈴薯": "white-brown", "洋芋": "white-brown", "竹筍": "white-brown", "白芝麻": "white-brown", "花生": "white-brown", "核桃": "white-brown", "腰果": "white-brown", "杏仁": "white-brown", "無籽西瓜": "white-brown", "白精靈菇": "white-brown", "燕麥片": "white-brown",
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

export default function RainbowDietCard({ data = [], updateData }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSelectingColor, setIsSelectingColor] = useState(false);
  const [pendingPlantName, setPendingPlantName] = useState('');
  const [optimisticLogs, setOptimisticLogs] = useState<RainbowDietLog[]>([]);
  const [isSuccessAnim, setIsSuccessAnim] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 當真實資料回來時，清除樂觀更新
  useEffect(() => {
    setOptimisticLogs([]);
  }, [data]);

  // 取得本週的起迄日期 (週一 ~ 週日)
  const getWeekDates = () => {
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); 
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { monday, sunday };
  };

  const { monday, sunday } = getWeekDates();

  // 過濾出本週的紀錄 (包含樂觀更新)
  const thisWeekLogs = [...data, ...optimisticLogs].filter(log => {
    const logDate = new Date(log.date);
    return logDate >= monday && logDate <= sunday && log.status !== 'deleted';
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
  
  // 動態學習使用者的歷史顏色紀錄 (從全部資料中萃取)
  const historicalColorMap = new Map<string, string>();
  data.forEach(log => {
    if (log.plantName && log.color && log.status !== 'deleted') {
      historicalColorMap.set(log.plantName, log.color); // 越新的紀錄會覆蓋舊的
    }
  });
  
  const target = 30;
  const progressPercent = Math.min(100, (plantCount / target) * 100);
  const isGoalReached = plantCount >= target;

  const getAchievementLabel = (count: number) => {
    if (count >= 30) return '👑 彩虹精靈';
    if (count >= 20) return '🌿 枝繁葉茂';
    if (count >= 10) return '🪴 成長茁壯';
    return '🌱 萌芽階段';
  };

  const submitLog = (plantName: string, color: string) => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const newLog: RainbowDietLog = {
      id: `diet-${Date.now()}`,
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    const plant = inputValue.trim();
    // 優先使用內建對應，若無則查詢歷史紀錄，都找不到才彈出選擇器
    const mappedColor = COLOR_MAPPING[plant] || historicalColorMap.get(plant);
    
    if (mappedColor) {
      submitLog(plant, mappedColor);
    } else {
      setPendingPlantName(plant);
      setIsSelectingColor(true);
    }
  };

  useEffect(() => {
    if (isModalOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen]);

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

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleFormSubmit} className="relative">
              <input 
                type="text" 
                list="diet-suggestions"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="輸入今日植物食材，如：蘋果"
                className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6ba388]/30 transition-shadow"
              />
              <datalist id="diet-suggestions">
                {Array.from(new Set([...Object.keys(COLOR_MAPPING), ...historicalColorMap.keys()])).map(plant => (
                  <option key={plant} value={plant} />
                ))}
              </datalist>
              <button type="submit" className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md transition-all duration-300 ${
                isSuccessAnim ? 'bg-[#5b8c74] text-white scale-110' : 'bg-[#6ba388] text-white hover:bg-[#5b8c74]'
              }`}>
                {isSuccessAnim ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
              </button>
            </form>
            
            {isSelectingColor && (
              <div className="absolute top-full left-0 w-full mt-1 p-2 bg-white rounded-lg shadow-lg border border-stone-200 z-10 animate-fade-in">
                <div className="text-xs text-stone-500 mb-2 font-medium">請為「{pendingPlantName}」選擇顏色：</div>
                <div className="flex justify-between gap-1">
                  {COLOR_INFO.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => submitLog(pendingPlantName, c.id)}
                      className={`flex-1 aspect-square rounded-md flex flex-col items-center justify-center gap-1 hover:opacity-80 transition-opacity ${c.textActive}`}
                      style={{ backgroundColor: c.hex }}
                    >
                      <span className="text-[10px] font-bold">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsModalOpen(false)} />
          <div className="absolute bottom-0 left-0 w-full sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md bg-[#fdfdfc] rounded-t-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] sm:shadow-2xl border-t border-stone-200 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full duration-300">
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
              <h4 className="text-sm font-bold text-stone-700 mb-3 border-b border-stone-100 pb-2">本週已吃植物清單</h4>
              
              {plantCount === 0 ? (
                <div className="text-center text-stone-400 py-8 text-sm">
                  本週還沒有紀錄任何植物喔！<br/>快在首頁輸入吃過的食材吧！
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
                          {plantsInColor.map(p => (
                            <span key={p.id} className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-md border border-stone-200">
                              {p.plantName}
                            </span>
                          ))}
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
