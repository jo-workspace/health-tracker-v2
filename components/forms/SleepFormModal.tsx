'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Moon, Wand2, Loader2, Calendar, Check, RotateCw } from 'lucide-react';
import type { SleepLog, BiteSplintLog } from '@/lib/types';

interface PendingImage {
  image: string;
  mimeType: string;
}

const readAsBase64 = (file: File): Promise<PendingImage> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve({
        image: event.target?.result as string,
        mimeType: file.type || 'image/jpeg'
      });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: Partial<SleepLog>, hasBiteSplint?: boolean) => void;
  initialData?: SleepLog | null;
  splintLogs?: BiteSplintLog[];
  defaultDate?: string;
  defaultType?: 'night' | 'nap';
}

const FEELINGS = [
  { id: 'excellent', emoji: '🤩', label: '神清氣爽' },
  { id: 'normal', emoji: '🙂', label: '精神OK' },
  { id: 'tired', emoji: '🥱', label: '昏沉想睡' },
  { id: 'sore', emoji: '🥵', label: '痠痛緊繃' },
  { id: 'poor', emoji: '🤢', label: '疲憊極差' }
];

export default function SleepFormModal({ isOpen, onClose, onSave, initialData, splintLogs = [], defaultDate, defaultType = 'night' }: Props) {
  const [date, setDate] = useState('');
  const [type, setType] = useState<'night' | 'nap'>('night');
  const [bedTime, setBedTime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [sleepDuration, setSleepDuration] = useState('');
  const [hrv, setHrv] = useState('');
  const [restingHeartRate, setRestingHeartRate] = useState('');
  const [deepSleep, setDeepSleep] = useState('');
  const [remSleep, setRemSleep] = useState('');
  const [stress, setStress] = useState('');
  const [feeling, setFeeling] = useState('normal');
  const [hasBiteSplint, setHasBiteSplint] = useState(false);
  const [notes, setNotes] = useState('');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [analyzeError, setAnalyzeError] = useState('');
  const [retrySeconds, setRetrySeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 429 冷卻倒數，倒數歸零後才開放重試
  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = setTimeout(() => setRetrySeconds(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [retrySeconds]);

  useEffect(() => {
    if (isOpen) {
      const targetDate = initialData?.date || defaultDate || new Date().toLocaleDateString('en-CA');
      const isSplintRecorded = splintLogs.some(l => l.date === targetDate && l.status !== 'deleted');

      if (initialData) {
        setDate(initialData.date || '');
        setType((initialData.type as 'night' | 'nap') || 'night');
        setBedTime(initialData.bedtime || '');
        setWakeTime(initialData.wakeupTime || '');
        setSleepDuration(initialData.sleepDuration || '');
        setHrv(initialData.hrv || '');
        setRestingHeartRate(initialData.restingHeartRate || '');
        setDeepSleep(initialData.deepSleep || '');
        setRemSleep(initialData.remSleep || '');
        setStress(initialData.stress || '');
        setFeeling(initialData.feeling || 'normal');
        setHasBiteSplint(isSplintRecorded);
        setNotes(initialData.notes || '');
      } else {
        setDate(defaultDate || new Date().toLocaleDateString('en-CA'));
        setType(defaultType);
        setBedTime('');
        setWakeTime('');
        setSleepDuration('');
        setHrv('');
        setRestingHeartRate('');
        setDeepSleep('');
        setRemSleep('');
        setStress('');
        setFeeling('normal');
        setHasBiteSplint(isSplintRecorded);
        setNotes('');
      }
      setPendingImages([]);
      setAnalyzeError('');
      setRetrySeconds(0);
    }
  }, [isOpen, initialData, defaultDate, splintLogs]);

  const runAnalysis = async (images: PendingImage[]) => {
    if (images.length === 0) return;

    setIsAnalyzing(true);
    setAnalyzeError('');

    try {
      const password = typeof window !== 'undefined' ? localStorage.getItem('app_password') || '' : '';

      const res = await fetch('/api/analyze-sleep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
        body: JSON.stringify({ images })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err: any = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }

      if (data.bedTime) setBedTime(data.bedTime);
      if (data.wakeTime) setWakeTime(data.wakeTime);
      if (data.totalSleep) setSleepDuration(String(data.totalSleep));
      if (data.deepSleep) setDeepSleep(String(data.deepSleep));
      if (data.remSleep) setRemSleep(String(data.remSleep));
      if (data.hrv) setHrv(String(data.hrv));
      if (data.restingHeartRate) setRestingHeartRate(String(data.restingHeartRate));
      if (data.stress) setStress(String(data.stress));

      // 成功後才釋放暫存的截圖
      setPendingImages([]);

    } catch (error: any) {
      console.error('Error analyzing image(s):', error);
      const msg = error.message || '';
      const isRateLimited = error.status === 429 || msg.includes('429') || msg.includes('Rate Limit');
      if (isRateLimited) {
        setAnalyzeError('Google Gemini 免費額度暫時達上限 (Too Many Requests)。截圖已保留，倒數結束後直接按「重新解析」即可，不用重新上傳。');
        setRetrySeconds(15);
      } else {
        setAnalyzeError(`解析截圖失敗：${msg || '請稍後再試'}。截圖已保留，可直接重試。`);
        setRetrySeconds(0);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setIsAnalyzing(true);
    setAnalyzeError('');
    setRetrySeconds(0);

    let imagesData: PendingImage[];
    try {
      imagesData = await Promise.all(fileList.map(readAsBase64));
    } catch (err) {
      console.error('Error reading image(s):', err);
      setPendingImages([]);
      setAnalyzeError('讀取圖片失敗，請重新選擇檔案。');
      setIsAnalyzing(false);
      return;
    }

    setPendingImages(imagesData);
    await runAnalysis(imagesData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isNap = type === 'nap';
    onSave({
      id: initialData?.id || crypto.randomUUID(),
      date,
      type,
      bedtime: isNap ? '' : bedTime,
      wakeupTime: isNap ? '' : wakeTime,
      sleepDuration,
      hrv: isNap ? '' : hrv,
      restingHeartRate: isNap ? '' : restingHeartRate,
      deepSleep: isNap ? '' : deepSleep,
      remSleep: isNap ? '' : remSleep,
      stress: isNap ? '' : stress,
      feeling: isNap ? '' : feeling,
      notes,
      status: 'active',
      lastUpdated: Date.now().toString()
    }, isNap ? false : hasBiteSplint);
    onClose();
  };

  if (!isOpen) return null;

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div 
        className="absolute bottom-0 left-0 w-full sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[420px] bg-[#fcfcfc] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full duration-300 overflow-x-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0 bg-white sm:rounded-t-2xl rounded-t-2xl">
          <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <Moon size={20} className="text-stone-600" />
            {initialData ? '編輯紀錄' : '新增紀錄'}
          </h2>
          
          <div className="flex items-center gap-2">
            {type === 'night' && (
              <>
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0ecfc] hover:bg-[#e4dcf9] text-[#7148e5] text-xs font-bold rounded-full transition-colors"
                  title="選擇一張或多張睡眠/心率/壓力截圖進行 AI 解析"
                >
                  {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  {isAnalyzing ? '解析中...' : 'AI 截圖解析'}
                </button>
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                />
              </>
            )}
            
            <button type="button" onClick={onClose} className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full transition-colors ml-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {analyzeError && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-col gap-2 shrink-0">
            <p className="text-[11px] leading-relaxed text-amber-800">{analyzeError}</p>
            {pendingImages.length > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-amber-600">
                  已保留 {pendingImages.length} 張截圖
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setPendingImages([]); setAnalyzeError(''); setRetrySeconds(0); }}
                    className="px-2.5 py-1 text-[11px] font-bold text-stone-500 bg-white border border-stone-200 rounded-full hover:bg-stone-50 transition-colors"
                  >
                    放棄
                  </button>
                  <button
                    type="button"
                    onClick={() => runAnalysis(pendingImages)}
                    disabled={isAnalyzing || retrySeconds > 0}
                    className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-white bg-[#7148e5] rounded-full hover:bg-[#5b36c2] transition-colors disabled:opacity-50 disabled:hover:bg-[#7148e5]"
                  >
                    {isAnalyzing
                      ? <><Loader2 size={12} className="animate-spin" />解析中...</>
                      : retrySeconds > 0
                        ? <>{retrySeconds} 秒後可重試</>
                        : <><RotateCw size={12} />重新解析</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto w-full flex-1 flex flex-col gap-4 overflow-x-hidden">
          {/* 紀錄類型 */}
          <div className="flex bg-stone-100 p-1 rounded-lg">
            <button 
              type="button" 
              onClick={() => setType('night')}
              className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${type === 'night' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}
            >
              🌙 主睡眠
            </button>
            <button 
              type="button" 
              onClick={() => setType('nap')}
              className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${type === 'nap' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}
            >
              💤 小睡
            </button>
          </div>

          {/* 日期與時間 */}
          {type === 'night' ? (
            <>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-[5fr_3fr] gap-2">
                  <div className="flex flex-col gap-1 min-w-0">
                    <label className="text-[11px] font-bold text-stone-500">起床日期</label>
                    <input 
                      type="date" 
                      value={date} 
                      onChange={e => setDate(e.target.value)}
                      className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                      required 
                    />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <label className="text-[11px] font-bold text-stone-500">睡眠時數</label>
                    <div className="relative">
                      <input 
                        type="text" inputMode="decimal"
                        value={sleepDuration} 
                        onChange={e => setSleepDuration(e.target.value)}
                        className="w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400" 
                        placeholder="6.5"
                        required
                      />
                      <span className="absolute right-2 top-2 text-sm text-stone-400">h</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1 min-w-0">
                    <label className="text-[11px] font-bold text-stone-500">上床時間</label>
                    <input 
                      type="time" 
                      value={bedTime} 
                      onChange={e => setBedTime(e.target.value)}
                      className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                    />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <label className="text-[11px] font-bold text-stone-500">起床時間</label>
                    <input 
                      type="time" 
                      value={wakeTime} 
                      onChange={e => setWakeTime(e.target.value)}
                      className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                    />
                  </div>
                </div>
              </div>

              {/* 心率與壓力資料 */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-stone-100">
                <div className="flex flex-col gap-1 min-w-0">
                  <label className="text-[10px] font-bold text-stone-500 whitespace-nowrap overflow-hidden text-ellipsis">HRV(ms)</label>
                  <input 
                    type="text" inputMode="decimal"
                    value={hrv} 
                    onChange={e => setHrv(e.target.value)}
                    className="w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                  />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <label className="text-[10px] font-bold text-stone-500 whitespace-nowrap overflow-hidden text-ellipsis">心率(bpm)</label>
                  <input 
                    type="text" inputMode="decimal"
                    value={restingHeartRate} 
                    onChange={e => setRestingHeartRate(e.target.value)}
                    className="w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                  />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <label className="text-[10px] font-bold text-stone-500 whitespace-nowrap overflow-hidden text-ellipsis">壓力分數</label>
                  <input 
                    type="text" inputMode="decimal"
                    value={stress} 
                    onChange={e => setStress(e.target.value)}
                    className="w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                  />
                </div>
              </div>

              {/* 睡眠階段 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1 min-w-0">
                  <label className="text-[10px] font-bold text-stone-500">深層睡眠 (h)</label>
                  <input 
                    type="text" inputMode="decimal"
                    value={deepSleep} 
                    onChange={e => setDeepSleep(e.target.value)}
                    className="w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                  />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <label className="text-[10px] font-bold text-stone-500">REM (h)</label>
                  <input 
                    type="text" inputMode="decimal"
                    value={remSleep} 
                    onChange={e => setRemSleep(e.target.value)}
                    className="w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                  />
                </div>
              </div>

              {/* 醒來感受 */}
              <div className="flex flex-col gap-1.5 pt-3 border-t border-stone-100">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-stone-500">醒來感受</label>
                  <button
                    type="button"
                    onClick={() => setHasBiteSplint(!hasBiteSplint)}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors ${
                      hasBiteSplint
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
                    }`}
                  >
                    <span>🦷</span> 戴咬合板
                  </button>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setFeeling('great')} className={`flex-1 py-1.5 rounded-lg border text-sm transition-colors ${feeling === 'great' ? 'bg-[#f0ecfc] border-[#d8ccf5] text-[#7148e5] font-bold' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}>很好</button>
                  <button type="button" onClick={() => setFeeling('normal')} className={`flex-1 py-1.5 rounded-lg border text-sm transition-colors ${feeling === 'normal' ? 'bg-[#f0ecfc] border-[#d8ccf5] text-[#7148e5] font-bold' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}>普通</button>
                  <button type="button" onClick={() => setFeeling('bad')} className={`flex-1 py-1.5 rounded-lg border text-sm transition-colors ${feeling === 'bad' ? 'bg-[#f0ecfc] border-[#d8ccf5] text-[#7148e5] font-bold' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}>差</button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-[5fr_3fr] gap-2">
              <div className="flex flex-col gap-1 min-w-0">
                <label className="text-[11px] font-bold text-stone-500">小睡日期</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)}
                  className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                  required 
                />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <label className="text-[11px] font-bold text-stone-500">小睡 (分鐘)</label>
                <div className="relative">
                  <input 
                    type="text" inputMode="decimal"
                    value={sleepDuration ? String(Math.round(Number(sleepDuration) * 60)) : ''} 
                    onChange={e => {
                      const mins = e.target.value;
                      setSleepDuration(mins ? String(+(Number(mins) / 60).toFixed(2)) : '');
                    }}
                    className="w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400" 
                    placeholder="30"
                    required
                  />
                  <span className="absolute right-2 top-2 text-xs text-stone-400">min</span>
                </div>
              </div>
            </div>
          )}

          {/* 備註 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-500">備註 (選填)</label>
            <textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)}
              className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400 min-h-[60px]"
              placeholder={type === 'nap' ? "例如：下午茶後小憩..." : "例如：睡前喝了酒、太熱醒來..."}
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full py-2.5 mt-1 bg-[#7148e5] hover:bg-[#5b36c2] text-white font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <Check size={18} />
            {initialData ? '更新紀錄' : '儲存紀錄'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  ) : null;
}
