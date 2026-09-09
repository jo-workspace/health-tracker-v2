'use client';
import { useState, useMemo } from 'react';
import SupplementTracker from '@/components/SupplementTracker';
import SleepCard from '@/components/SleepCard';
import HRVCard from '@/components/HRVCard';
import RainbowDietCard from '@/components/RainbowDietCard';
import ActivePainsCard from '@/components/ActivePainsCard';
import AcuteIllnessCard from '@/components/AcuteIllnessCard';
import LongTermTracker from '@/components/LongTermTracker';
import SupplementInventoryTab from '@/components/SupplementInventoryTab';
import BottomNav, { type NavTabId } from '@/components/BottomNav';
import SettingsModal from '@/components/forms/SettingsModal';
import { useHealthData } from '@/hooks/useHealthData';
import { Settings } from 'lucide-react';

export default function Dashboard() {
  const { data, loading, syncing, initialSynced, updateData, forceSync } = useHealthData();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
      item => item.status !== 'deleted' && (item.unopenedCount || 0) === 0
    ).length;
  }, [inventoryList]);

  return (
    <div className="min-h-screen bg-[#f4f5f4] p-4 sm:p-6 pb-24 flex flex-col items-center font-sans">
      <header className="w-full max-w-md mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-700 flex items-center gap-2">
          <img src="/icon.png" alt="logo" className="w-6 h-6 object-contain" />
          Health Tracker
        </h1>
        <div className="flex gap-3 items-center">
          {syncing && <span className="text-[10px] text-stone-400 font-medium animate-pulse">儲存中...</span>}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 bg-white rounded-full shadow-sm border border-stone-200 text-stone-500 hover:text-stone-800 transition-colors"
          >
            <Settings className={`w-5 h-5 ${syncing ? 'animate-spin text-[#6ba388]' : ''}`} />
          </button>
        </div>
      </header>
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onForceSync={forceSync}
        syncing={syncing}
      />

      <main className="w-full max-w-md space-y-0 pb-32">
        {loading ? (
          <div className="text-center text-stone-400 mt-20 animate-pulse text-sm font-medium">資料連線中...</div>
        ) : (
          <>
            {activeTab === 'today' ? (
              <div className="w-full max-w-md mx-auto pt-2 space-y-4">
                <SleepCard data={data?.sleepLogs} allergyLogs={data?.allergyLogs} supplementLogs={data?.supplementLogs} splintLogs={data?.biteSplintLogs} updateData={updateData} forceSync={forceSync} initialSynced={initialSynced} />
                <HRVCard data={data?.sleepLogs} updateData={updateData} />
                <SupplementTracker data={data?.supplementLogs} settings={data?.supplementSettings} updateData={updateData} />
                <RainbowDietCard data={data?.rainbowDietLogs} updateData={updateData} />
                <AcuteIllnessCard data={data?.illnessLogs} updateData={updateData} />
                <ActivePainsCard data={data?.painLogs} updateData={updateData} />
                <LongTermTracker
                  data={data?.longTermLogs}
                  tmyLogs={data?.tmySymptomsLogs}
                  splintLogs={data?.biteSplintLogs}
                  allergyLogs={data?.allergyLogs}
                  updateData={updateData}
                />
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

