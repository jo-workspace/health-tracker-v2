'use client';
import { CalendarCheck, Package } from 'lucide-react';

export type NavTabId = 'today' | 'inventory';

interface BottomNavProps {
  activeTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
  unopenedEmptyCount?: number;
}

export default function BottomNav({ activeTab, onTabChange, unopenedEmptyCount = 0 }: BottomNavProps) {
  const tabs: { id: NavTabId; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    {
      id: 'today',
      label: '今日健康',
      icon: CalendarCheck,
    },
    {
      id: 'inventory',
      label: '保健品庫存',
      icon: Package,
      badge: unopenedEmptyCount > 0 ? unopenedEmptyCount : undefined,
    },
  ];

  const handleTabClick = (tabId: NavTabId) => {
    if (tabId === activeTab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    onTabChange(tabId);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-stone-200 shadow-lg pb-[env(safe-area-inset-bottom,0px)]">
      <div className="max-w-md mx-auto h-16 flex items-center justify-around px-4">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full py-1.5 transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'text-[#52806b] font-semibold'
                  : 'text-stone-400 hover:text-stone-600 font-normal'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center leading-tight shadow-sm">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 tracking-tight ${isActive ? 'text-[#446e5b]' : 'text-stone-500'}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-8 h-0.5 bg-[#52806b] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
