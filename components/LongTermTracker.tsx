'use client';
import { useState } from 'react';
import { ClipboardList, Edit3, Trash2, CalendarPlus, FileText, Plus } from 'lucide-react';
import type { LongTermLog, TmySymptomLog, BiteSplintLog, SyncPayload } from '@/lib/types';
import LongTermFormModal from '@/components/forms/LongTermFormModal';
import TmySymptomFormModal from '@/components/forms/TmySymptomFormModal';
import TmySummaryModal from '@/components/forms/TmySummaryModal';

interface Props {
  data?: LongTermLog[];
  tmyLogs?: TmySymptomLog[];
  splintLogs?: BiteSplintLog[];
  updateData: (payload: SyncPayload) => void;
}

export default function LongTermTracker({ data = [], tmyLogs = [], splintLogs = [], updateData }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<LongTermLog | null>(null);
  
  const [isTmySymptomModalOpen, setIsTmySymptomModalOpen] = useState(false);
  const [isTmySummaryModalOpen, setIsTmySummaryModalOpen] = useState(false);

  const activeItems = data.filter(log => log.status !== 'deleted');

  // Group by itemName and get latest record
  const latestItemsMap = new Map<string, LongTermLog>();
  activeItems.forEach(log => {
    const existing = latestItemsMap.get(log.itemName);
    if (!existing || 
        new Date(log.date).getTime() > new Date(existing.date).getTime() || 
        (new Date(log.date).getTime() === new Date(existing.date).getTime() && log.lastUpdated > existing.lastUpdated)) {
      latestItemsMap.set(log.itemName, log);
    }
  });

  const latestItems = Array.from(latestItemsMap.values());
  latestItems.sort((a, b) => {
    const dateA = a.nextCheckupDate ? new Date(a.nextCheckupDate).getTime() : Infinity;
    const dateB = b.nextCheckupDate ? new Date(b.nextCheckupDate).getTime() : Infinity;
    if (dateA !== dateB) return dateA - dateB;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Calculate TMJ specific stats
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const recentTmyLogs = tmyLogs.filter(l => l.status !== 'deleted' && new Date(l.date).getTime() >= thirtyDaysAgo);
  
  let symptomCount = 0;
  let medCount = 0;
  recentTmyLogs.forEach(l => {
    if (l.symptoms && l.symptoms.trim() !== '') symptomCount++;
    if (l.medication && l.medication.includes('muscle_relaxant')) medCount++;
  });

  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff)).setHours(0,0,0,0);
  };
  
  const now = new Date();
  const currentWeekStart = getStartOfWeek(now);
  const lastWeekStart = currentWeekStart - 7 * 24 * 60 * 60 * 1000;

  const validSplintLogs = splintLogs.filter(l => l.status !== 'deleted');
  const currentWeekSplintCount = validSplintLogs.filter(l => new Date(l.date).getTime() >= currentWeekStart).length;
  const lastWeekSplintCount = validSplintLogs.filter(l => {
    const t = new Date(l.date).getTime();
    return t >= lastWeekStart && t < currentWeekStart;
  }).length;

  let yearlyWeeklyAvg = 0;
  if (validSplintLogs.length > 0) {
    const firstDate = new Date(Math.min(...validSplintLogs.map(l => new Date(l.date).getTime())));
    const weeksPassed = Math.max(1, (Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
    yearlyWeeklyAvg = Number((validSplintLogs.length / weeksPassed).toFixed(1));
  }

  const getCheckupBadge = (nextCheckupDateStr?: string) => {
    if (!nextCheckupDateStr) return null;
    
    const nextDate = new Date(nextCheckupDateStr);
    nextDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffDays = Math.round((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      if (diffDays <= 7) {
        return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-[#fef3c7] text-[#d97706]">📅 剩 {diffDays} 天</span>;
      }
      return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-[#e2e7e1] text-[#5b6657]">📅 剩 {diffDays} 天</span>;
    } else if (diffDays === 0) {
      return <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-[#fef2f2] text-[#dc2626] border border-[#fca5a5]">📅 今天回診</span>;
    }
    return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-[#fef2f2] text-[#dc2626] border border-[#fca5a5]">📅 逾期 {Math.abs(diffDays)} 天</span>;
  };

  const getRelativeTimeStr = (timestamp: number) => {
    const daysAgo = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (daysAgo === 0) return '今天';
    if (daysAgo > 30) return `${Math.floor(daysAgo / 30)} 個月前`;
    return `${daysAgo} 天前`;
  };

  const markDeleted = (id: string) => {
    const updatedLogs = data.map(log => {
      if (log.id === id) return { ...log, status: 'deleted' as const, lastUpdated: Date.now() };
      return log;
    });
    updateData({ longTermLogs: updatedLogs, clientTimestamp: Date.now() });
  };

  const handleSave = (logData: Partial<LongTermLog>) => {
    let updatedLogs = [...data];
    const existingIndex = updatedLogs.findIndex(l => l.id === logData.id);
    if (existingIndex >= 0) {
      updatedLogs[existingIndex] = { ...updatedLogs[existingIndex], ...logData } as LongTermLog;
    } else {
      updatedLogs.push(logData as LongTermLog);
    }
    updateData({ longTermLogs: updatedLogs, clientTimestamp: Date.now() });
  };

  const openNewModal = () => {
    setEditingLog(null);
    setIsModalOpen(true);
  };

  const openEditModal = (log: LongTermLog) => {
    setEditingLog(log);
    setIsModalOpen(true);
  };

  const openNewCheckupModal = (log: LongTermLog) => {
    setEditingLog({ ...log, id: '', date: new Date().toLocaleDateString('en-CA'), nextCheckupDate: '' });
    setIsModalOpen(true);
  };

  const handleRecordSplint = () => {
    const today = new Date().toLocaleDateString('en-CA');
    const newLogs = [...splintLogs, { id: crypto.randomUUID(), date: today, status: 'active' as const, lastUpdated: Date.now() }];
    updateData({ biteSplintLogs: newLogs, clientTimestamp: Date.now() });
    setTimeout(() => {
      alert(`🦷 成功紀錄：${today} 已配戴咬合板！`);
    }, 10);
  };

  const handleSaveTmySymptom = (logData: Partial<TmySymptomLog>) => {
    const newLogs = [...tmyLogs, logData as TmySymptomLog];
    updateData({ tmySymptomsLogs: newLogs, clientTimestamp: Date.now() });
  };

  return (
    <div className="w-full max-w-md mx-auto mb-8">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-stone-700 font-bold flex items-center gap-2">
          <ClipboardList size={18} className="text-stone-600" />
          長期健康追蹤
        </h2>
        <button 
          onClick={openNewModal}
          className="text-xs text-stone-500 hover:text-stone-700 font-bold flex items-center gap-1"
        >
          + 新增追蹤項目
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {latestItems.length === 0 ? (
          <div className="bg-stone-50 rounded-xl p-8 flex flex-col items-center justify-center text-stone-500 text-center border border-stone-100">
            <ClipboardList size={32} className="mb-3 text-stone-400" />
            <h4 className="font-bold text-stone-700 mb-1">尚無長期追蹤項目</h4>
            <p className="text-xs">點擊上方「新增追蹤項目」開始記錄您的就醫或物品追蹤。</p>
          </div>
        ) : (
          latestItems.map(log => {
            let sizeStr = "";
            if (log.sizeWidth) {
              sizeStr = `尺寸: ${log.sizeWidth}`;
              if (log.sizeHeight) sizeStr += `×${log.sizeHeight}`;
              if (log.sizeDepth)  sizeStr += `×${log.sizeDepth}`;
              sizeStr += " mm | ";
            }
            const clinicInfo = [log.hospital, log.doctor].filter(Boolean).join(" ");
            
            // Format date to yyyy/mm/dd
            let displayDate = log.date;
            try {
              const d = new Date(log.date);
              if (!isNaN(d.getTime())) {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                displayDate = `${yyyy}/${mm}/${dd}`;
              }
            } catch (e) {}
            
            let displayNextCheckup = log.nextCheckupDate;
            try {
              if (log.nextCheckupDate) {
                const d = new Date(log.nextCheckupDate);
                if (!isNaN(d.getTime())) {
                  const yyyy = d.getFullYear();
                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                  const dd = String(d.getDate()).padStart(2, '0');
                  displayNextCheckup = `${yyyy}/${mm}/${dd}`;
                }
              }
            } catch (e) {}

            return (
              <div key={log.id} className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden mb-3">
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-stone-700 text-base">{log.itemName}</h3>
                      {getCheckupBadge(log.nextCheckupDate)}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button onClick={() => openEditModal(log)} className="p-1.5 hover:bg-stone-100 rounded text-sm transition-colors" title="編輯項目">✏️</button>
                      <button onClick={() => openNewCheckupModal(log)} className="p-1.5 hover:bg-stone-100 rounded text-sm transition-colors" title="新增回診紀錄">📅</button>
                    </div>
                  </div>

                  <div className="flex gap-3 text-[13px] mb-2">
                    <span className="text-stone-400 font-medium shrink-0">詳情</span>
                    <span className="text-stone-600 leading-snug">
                      <span className="font-bold">{displayDate}</span> {clinicInfo ? `| ${clinicInfo}` : ''}<br/>
                      {sizeStr && <span className="text-stone-500">{sizeStr}</span>}
                      {displayNextCheckup && <span className="text-stone-500">下次回診: {displayNextCheckup}</span>}
                    </span>
                  </div>

                  {log.notes && (
                    <div className="flex gap-3 text-[13px] mt-2">
                      <span className="text-stone-400 font-medium shrink-0">備註</span>
                      <span className="text-stone-600 leading-snug whitespace-pre-wrap">{log.notes}</span>
                    </div>
                  )}

                  <div className="text-[10px] text-stone-400 text-right mt-1 mb-2">
                    更新於 {getRelativeTimeStr(log.lastUpdated)}
                  </div>

                  {/* 顳顎關節特製面板 */}
                  {log.itemName === '顳顎關節' && (
                    <div className="mt-4 flex flex-col gap-2">
                      <div className="p-3 bg-blue-50/50 border-l-4 border-blue-400 rounded-r-lg relative mt-2">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-stone-700 text-sm flex items-center gap-1.5">
                            咬合板配戴
                          </span>
                        </div>
                        <div className="flex gap-4 text-[11px] text-stone-500">
                          <span>本週：<strong className="text-stone-700">{currentWeekSplintCount}</strong> 次</span>
                          <span>上週：<strong className="text-stone-700">{lastWeekSplintCount}</strong> 次</span>
                          <span>年平均：<strong className="text-stone-700">{yearlyWeeklyAvg}</strong> 次/週</span>
                        </div>
                        <div className="absolute -top-3 -right-1 flex gap-1 z-10">
                          <button 
                            onClick={handleRecordSplint} 
                            className="w-8 h-8 bg-white border border-stone-200 rounded-full flex items-center justify-center text-stone-500 hover:text-stone-800 hover:bg-stone-50 shadow-sm transition-colors" 
                            title="記配戴"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="p-3 bg-red-50/50 border-l-4 border-[#e28e94] rounded-r-lg relative mt-2">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-stone-700 text-sm flex items-center gap-1.5">
                            症狀監測 (30天)
                          </span>
                        </div>
                        <div className="flex gap-4 text-[11px] text-stone-500">
                          <span>發作次數：<strong className="text-[#e28e94]">{symptomCount}</strong> 次</span>
                          <span>肌肉鬆弛劑：<strong className="text-stone-700">{medCount}</strong> 次</span>
                        </div>
                        <div className="absolute -top-3 -right-1 flex gap-1 z-10">
                          <button 
                            onClick={() => setIsTmySummaryModalOpen(true)} 
                            className="w-8 h-8 bg-white border border-stone-200 rounded-full flex items-center justify-center text-stone-500 hover:text-stone-800 hover:bg-stone-50 shadow-sm transition-colors" 
                            title="摘要"
                          >
                            <FileText size={14} />
                          </button>
                          <button 
                            onClick={() => setIsTmySymptomModalOpen(true)} 
                            className="w-8 h-8 bg-white border border-stone-200 rounded-full flex items-center justify-center text-stone-500 hover:text-stone-800 hover:bg-stone-50 shadow-sm transition-colors" 
                            title="新增發作紀錄"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <LongTermFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingLog}
      />

      <TmySymptomFormModal
        isOpen={isTmySymptomModalOpen}
        onClose={() => setIsTmySymptomModalOpen(false)}
        onSave={handleSaveTmySymptom}
      />

      <TmySummaryModal
        isOpen={isTmySummaryModalOpen}
        onClose={() => setIsTmySummaryModalOpen(false)}
        logs={tmyLogs}
      />
    </div>
  );
}
