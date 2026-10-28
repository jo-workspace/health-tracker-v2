'use client';
import { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import type { AllergyLog } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: Partial<AllergyLog>) => void;
  initialData?: AllergyLog | null;
}

const PRESET_LOCATIONS = ["鼻子", "皮膚", "眼睛"];
const PRESET_TRIGGERS = ["鬆緊帶摩擦", "灰塵", "食物", "不明", "其他"];
const PRESET_MEDS = [
  { id: "antihistamine", label: "抗組織胺" },
  { id: "steroid_cream", label: "類固醇藥膏" }
];
const TIME_SLOTS = ["早", "中", "晚", "睡前"];
const SLEEP_IMPACT_OPTIONS: { id: 'none' | 'mild' | 'severe'; label: string }[] = [
  { id: 'none', label: '無' },
  { id: 'mild', label: '輕' },
  { id: 'severe', label: '重' }
];

const SEVERITY_OPTIONS = [
  { value: 0, label: "無症狀", desc: "" },
  { value: 2, label: "輕微", desc: "輕微不適，不影響日常" },
  { value: 5, label: "中度", desc: "明顯不適，需要吃藥緩解" },
  { value: 8, label: "嚴重", desc: "大範圍發作，嚴重干擾活動" }
];

const getDefaultTimeSlot = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return '早';
  if (h >= 12 && h < 18) return '中';
  if (h >= 18 && h < 22) return '晚';
  return '睡前';
};

export default function AllergyFormModal({ isOpen, onClose, onSave, initialData }: Props) {
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [timeSlot, setTimeSlot] = useState(getDefaultTimeSlot());
  const [severity, setSeverity] = useState(0);
  const [locations, setLocations] = useState<string[]>([]);
  const [trigger, setTrigger] = useState('');
  const [customTrigger, setCustomTrigger] = useState('');
  const [meds, setMeds] = useState<string[]>([]);
  const [sleepImpact, setSleepImpact] = useState<'none' | 'mild' | 'severe'>('none');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setDate(initialData.date || new Date().toLocaleDateString('en-CA'));
        setTimeSlot(initialData.timeSlot || getDefaultTimeSlot());
        
        // 嚴重度檔位回填
        const rawSev = Number(initialData.severity ?? 0);
        if (rawSev === 0) setSeverity(0);
        else if (rawSev <= 3) setSeverity(2);
        else if (rawSev <= 6) setSeverity(5);
        else setSeverity(8);

        setLocations(initialData.locations ? initialData.locations.split(',').map(s => s.trim()).filter(Boolean) : []);
        
        const trig = initialData.trigger || '';
        if (PRESET_TRIGGERS.includes(trig)) {
          setTrigger(trig);
          setCustomTrigger('');
        } else if (trig) {
          setTrigger('其他');
          setCustomTrigger(trig);
        } else {
          setTrigger('');
          setCustomTrigger('');
        }

        setMeds(initialData.medication ? initialData.medication.split(',').map(s => s.trim()).filter(Boolean) : []);
        setSleepImpact(initialData.sleepImpact || 'none');
        setNotes(initialData.notes || '');
      } else {
        setDate(new Date().toLocaleDateString('en-CA'));
        setTimeSlot(getDefaultTimeSlot());
        setSeverity(0);
        setLocations([]);
        setTrigger('');
        setCustomTrigger('');
        setMeds([]);
        setSleepImpact('none');
        setNotes('');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const toggleLocation = (l: string) => {
    setLocations(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  };

  const toggleMed = (m: string) => {
    setMeds(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const currentSeverityOpt = SEVERITY_OPTIONS.find(o => o.value === severity);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalTrigger = trigger;
    if (trigger === '其他') {
      finalTrigger = customTrigger.trim() || '其他';
    }

    onSave({
      id: initialData?.id || crypto.randomUUID(),
      date,
      timeSlot,
      locations: severity === 0 ? '' : locations.join(', '),
      severity: Number(severity),
      trigger: severity === 0 ? undefined : (finalTrigger.trim() || undefined),
      medication: meds.join(', '),
      sleepImpact: severity === 0 ? 'none' : sleepImpact,
      notes: notes.trim() || undefined,
      status: 'active',
      lastUpdated: Date.now()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-[#fcfcfc] w-full sm:w-[440px] sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
          <h2 className="text-base font-bold text-stone-800 flex items-center gap-2">
            <Sparkles size={18} className="text-[#c084a1]" />
            {initialData ? '編輯過敏' : '紀錄過敏'}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* 日期與時段並列 */}
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <label className="text-xs font-bold text-stone-700">日期</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:min-h-[1.5em] w-full min-w-0 px-2.5 sm:px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400 min-h-[36px]"
                required
              />
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <label className="text-xs font-bold text-stone-700">時段</label>
              <div className="flex rounded-lg border border-stone-200 bg-stone-100 p-0.5">
                {TIME_SLOTS.map(slot => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTimeSlot(slot)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                      timeSlot === slot
                        ? 'bg-white text-stone-800 shadow-2xs'
                        : 'text-stone-400 hover:text-stone-600'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 程度 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-700">程度</label>
            <div className="grid grid-cols-4 gap-2">
              {SEVERITY_OPTIONS.map(opt => {
                const isSelected = severity === opt.value;
                let activeStyle = 'bg-stone-800 text-white border-stone-800 shadow-2xs';
                if (opt.value === 0 && isSelected) {
                  activeStyle = 'bg-[#3e7256] text-white border-[#3e7256] shadow-2xs';
                } else if (opt.value === 8 && isSelected) {
                  activeStyle = 'bg-[#a07d7e] text-white border-[#a07d7e] shadow-2xs';
                }
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSeverity(opt.value)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                      isSelected
                        ? activeStyle
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {currentSeverityOpt?.desc ? (
              <div className="text-[11px] text-stone-400 pl-0.5 mt-0.5">
                {currentSeverityOpt.desc}
              </div>
            ) : null}
          </div>

          {/* 若嚴重度大於 0，漸進展開發作細節 */}
          {severity > 0 && (
            <>
              {/* 部位 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-700">部位</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_LOCATIONS.map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => toggleLocation(l)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                        locations.includes(l)
                          ? 'bg-[#c084a1] text-white border-[#c084a1]'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* 觸發原因 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-700">觸發原因</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_TRIGGERS.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTrigger(t)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                        trigger === t
                          ? 'bg-stone-800 text-white border-stone-800'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {trigger === '其他' && (
                  <input
                    type="text"
                    value={customTrigger}
                    onChange={e => setCustomTrigger(e.target.value)}
                    placeholder="輸入其他原因..."
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400 min-h-[36px] mt-1"
                  />
                )}
              </div>
            </>
          )}

          {/* 用藥與影響睡眠：未發作時只顯示用藥，發作時雙欄並列 */}
          {severity === 0 ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-700">用藥</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_MEDS.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMed(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      meds.includes(m.id)
                        ? 'bg-stone-700 text-white border-stone-700'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-700">用藥</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_MEDS.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMed(m.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        meds.includes(m.id)
                          ? 'bg-stone-700 text-white border-stone-700'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-700">影響睡眠</label>
                <div className="flex rounded-lg border border-stone-200 bg-stone-100 p-0.5">
                  {SLEEP_IMPACT_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSleepImpact(opt.id)}
                      className={`flex-1 py-1 rounded-md text-xs font-bold transition-all text-center ${
                        sleepImpact === opt.id
                          ? 'bg-white text-stone-800 shadow-2xs'
                          : 'text-stone-400 hover:text-stone-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 備註：輕量單線格 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-700">備註</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="選填備註..."
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400 min-h-[36px]"
            />
          </div>

          <div className="mt-2 pt-2 border-t border-stone-100">
            <button
              type="submit"
              className="w-full py-2.5 bg-stone-800 text-white rounded-xl font-bold text-sm shadow-2xs hover:bg-stone-900 transition-colors"
            >
              儲存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
