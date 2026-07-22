'use client';
import { useState } from 'react';
import SupplementTracker from '@/components/SupplementTracker';
import SleepCard from '@/components/SleepCard';
import HRVCard from '@/components/HRVCard';
import RainbowDietCard from '@/components/RainbowDietCard';
import ActivePainsCard from '@/components/ActivePainsCard';
import LongTermTracker from '@/components/LongTermTracker';
import SettingsModal from '@/components/forms/SettingsModal';
import { useHealthData } from '@/hooks/useHealthData';
import { Settings } from 'lucide-react';

export default function Dashboard() {
  const { data, loading, syncing, updateData, forceSync } = useHealthData();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f4f5f4] p-4 sm:p-6 flex flex-col items-center font-sans">
      <header className="w-full max-w-md mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-700 flex items-center gap-2">
          <img src="/icon.svg" alt="logo" className="w-6 h-6 object-contain" />
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

      <main className="w-full max-w-md space-y-0">
        {loading ? (
          <div className="text-center text-stone-400 mt-20 animate-pulse text-sm font-medium">資料連線中...</div>
        ) : (
          <div className="w-full max-w-md mx-auto pt-6 px-4 space-y-4">
            <SleepCard data={data?.sleepLogs} updateData={updateData} forceSync={forceSync} />
            <HRVCard data={data?.sleepLogs} updateData={updateData} />
            <SupplementTracker data={data?.supplementLogs} settings={data?.supplementSettings} updateData={updateData} />
            <RainbowDietCard data={data?.rainbowDietLogs} updateData={updateData} />
            <ActivePainsCard data={data?.painLogs} updateData={updateData} />
            <LongTermTracker 
              data={data?.longTermLogs} 
              tmyLogs={data?.tmySymptomsLogs} 
              splintLogs={data?.biteSplintLogs} 
              updateData={updateData} 
            />
          </div>
        )}
      </main>
    </div>
  );
}
