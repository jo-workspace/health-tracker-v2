'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import SupplementTracker from '@/components/SupplementTracker';
import SleepCard from '@/components/SleepCard';
import RainbowDietCard from '@/components/RainbowDietCard';
import RunningCard from '@/components/RunningCard';
import ActivePainsCard from '@/components/ActivePainsCard';
import AcuteIllnessCard from '@/components/AcuteIllnessCard';
import LongTermTracker from '@/components/LongTermTracker';
import SupplementInventoryTab from '@/components/SupplementInventoryTab';
import BottomNav, { type NavTabId } from '@/components/BottomNav';
import SettingsModal from '@/components/forms/SettingsModal';
import { useHealthData } from '@/hooks/useHealthData';
import { useGarminData } from '@/hooks/useGarminData';
import { Settings, Heart, KeyRound } from 'lucide-react';

export default function Dashboard() {
  const { data, loading, syncing, initialSynced, updateData, forceSync } = useHealthData();
  const { garminData, garminLoading, garminRefreshing, refreshGarmin } = useGarminData();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const syncedRef = useRef(false);
  useEffect(() => {
    if (
      !syncedRef.current &&
      garminData &&
      Object.keys(garminData.recentSleepMap || {}).length >= 60 &&
      Object.values(garminData.recentSleepMap || {}).some(s => Boolean(s.hrvStatus))
    ) {
      syncedRef.current = true;
      forceSync();
    }
  }, [garminData, forceSync]);
  const [activeTab, setActiveTab] = useState<NavTabId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('health_active_tab') as NavTabId | null;
      if (saved === 'today' || saved === 'inventory') {
        return saved;
      }
    }
    return 'today';
  });

  const handleTabChange = (tab: NavTabId) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('health_active_tab', tab);
    }
  };

  // 計算無未拆備用罐的品項數（作為 Tab Badge 提醒）
  const inventoryList = data?.supplementInventory;
  const zeroUnopenedCount = useMemo(() => {
    if (!inventoryList) return 0;
    return inventoryList.filter(
      item => item.status !== 'deleted' && !item.isArchived && (item.unopenedCount || 0) === 0
    ).length;
  }, [inventoryList]);

  const hasActiveIllness = useMemo(() => {
    return (data?.illnessLogs || []).some(log => log.status === 'active');
  }, [data?.illnessLogs]);

  const hasActivePain = useMemo(() => {
    return (data?.painLogs || []).some(log => log.status === 'active');
  }, [data?.painLogs]);

  const acuteIllnessElement = (
    <AcuteIllnessCard data={data?.illnessLogs} updateData={updateData} />
  );

  const activePainsElement = (
    <ActivePainsCard data={data?.painLogs} updateData={updateData} />
  );

  const longTermTrackerElement = (
    <LongTermTracker
      data={data?.longTermLogs}
      tmyLogs={data?.tmySymptomsLogs}
      splintLogs={data?.biteSplintLogs}
      allergyLogs={data?.allergyLogs}
      updateData={updateData}
    />
  );

  const cycle = garminData?.cycle;
  const isApiKeyExpiringSoon = Boolean(garminData?.isExpiringSoon);

  return (
    <div className="min-h-screen bg-[#f4f5f4] p-4 sm:p-6 pb-24 flex flex-col items-center font-sans">
      <header className="w-full max-w-md mb-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-stone-700 flex items-center gap-2">
            <img src="/icon.png" alt="logo" className="w-6 h-6 object-contain" />
            Health Tracker
          </h1>
          <div className="flex gap-3 items-center">
            {syncing && (
              <span className="text-[10px] text-stone-400 font-medium animate-pulse">
                儲存中...
              </span>
            )}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="relative p-2 bg-white rounded-full shadow-sm border border-stone-200 text-stone-500 hover:text-stone-800 transition-colors"
              title={
                isApiKeyExpiringSoon
                  ? `Garmin API Key 即將到期 (剩 ${garminData?.daysUntilExpiry} 天)`
                  : '系統設定'
              }
            >
              <Settings className={`w-5 h-5 ${syncing ? 'animate-spin text-[#6ba388]' : ''}`} />
              {isApiKeyExpiringSoon && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 border-2 border-white rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* 生理週期狀態膠囊 & API 到期提醒膠囊 */}
        {(cycle || isApiKeyExpiringSoon) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {cycle && (() => {
              let nextPeriodDisplay = '';
              if (cycle.predictedNextPeriodDate) {
                const parts = cycle.predictedNextPeriodDate.split('-');
                if (parts.length === 3) {
                  nextPeriodDisplay = `${Number(parts[1])}/${Number(parts[2])}`;
                }
              } else if (cycle.startDate && cycle.predictedCycleLength > 0) {
                const [y, m, d] = cycle.startDate.split('-').map(Number);
                const dt = new Date(Date.UTC(y, m - 1, d + cycle.predictedCycleLength));
                nextPeriodDisplay = `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
              }

              return (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#f6f1f1] text-[#8c5e60] border border-[#e6dada] shadow-2xs"
                  title={`本次週期起點：${cycle.startDate}（預測週期 ${cycle.predictedCycleLength} 天${
                    nextPeriodDisplay ? ` · 預計月經 ${nextPeriodDisplay}` : ''
                  }）`}
                >
                  <Heart size={11} className="text-[#a07072]" />
                  <span>
                    週期 D{cycle.dayInCycle} · {cycle.phaseName}
                    {nextPeriodDisplay ? ` · 預計月經 ${nextPeriodDisplay}` : ''}
                  </span>
                </span>
              );
            })()}

            {isApiKeyExpiringSoon && (
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                <KeyRound size={11} className="text-amber-600" />
                <span>
                  Garmin Key 剩 {garminData?.daysUntilExpiry} 天到期
                </span>
              </button>
            )}
          </div>
        )}
      </header>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onForceSync={forceSync}
        syncing={syncing}
        garminData={garminData}
        onRefreshGarmin={refreshGarmin}
        garminRefreshing={garminRefreshing}
      />

      <main className="w-full max-w-md space-y-0 pb-32">
        {loading ? (
          <div className="text-center text-stone-400 mt-20 animate-pulse text-sm font-medium">
            資料連線中...
          </div>
        ) : (
          <>
            {activeTab === 'today' ? (
              <div className="w-full max-w-md mx-auto pt-1 space-y-4">
                <SleepCard
                  data={data?.sleepLogs}
                  allergyLogs={data?.allergyLogs}
                  supplementLogs={data?.supplementLogs}
                  supplementSettings={data?.supplementSettings}
                  splintLogs={data?.biteSplintLogs}
                  garminSleepMap={garminData?.recentSleepMap}
                  runningActivities={garminData?.running?.recentActivities}
                  cycle={garminData?.cycle}
                  garminLoading={garminLoading}
                  updateData={updateData}
                  forceSync={forceSync}
                  initialSynced={initialSynced}
                  syncing={syncing}
                />
                <SupplementTracker
                  data={data?.supplementLogs}
                  settings={data?.supplementSettings}
                  updateData={updateData}
                />
                <RainbowDietCard data={data?.rainbowDietLogs} updateData={updateData} />
                {(garminData?.configured || garminLoading) && (
                  <RunningCard
                    weeklyRuns={garminData?.running?.weeklyRuns}
                    weeklyDistanceKm={garminData?.running?.weeklyDistanceKm}
                    weeklyDurationSeconds={garminData?.running?.weeklyDurationSeconds}
                    weeklyTrainingLoad={garminData?.running?.weeklyTrainingLoad}
                    activities={garminData?.running?.recentActivities}
                    scheduledWorkouts={garminData?.running?.scheduledWorkouts}
                    loading={garminLoading}
                    refreshing={garminRefreshing}
                    onRefresh={() => refreshGarmin(true)}
                  />
                )}
                {hasActiveIllness && acuteIllnessElement}
                {hasActivePain && activePainsElement}
                {longTermTrackerElement}
                {!hasActiveIllness && acuteIllnessElement}
                {!hasActivePain && activePainsElement}
              </div>
            ) : (
              <SupplementInventoryTab
                inventory={data?.supplementInventory}
                settings={data?.supplementSettings}
                updateData={updateData}
              />
            )}
          </>
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unopenedEmptyCount={zeroUnopenedCount}
      />
    </div>
  );
}
