'use client';
import { useState } from 'react';
import { Footprints, ChevronRight } from 'lucide-react';
import type { GarminRunningActivity } from '@/lib/types';
import RunningDetailModal from './RunningDetailModal';

interface Props {
  weeklyRuns?: number;
  weeklyDistanceKm?: number;
  weeklyDurationSeconds?: number;
  weeklyTrainingLoad?: number;
  activities?: GarminRunningActivity[];
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export default function RunningCard({
  weeklyRuns = 0,
  weeklyDistanceKm = 0,
  weeklyDurationSeconds = 0,
  weeklyTrainingLoad = 0,
  activities = [],
  loading = false,
  refreshing = false,
  onRefresh,
}: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const latestRun = activities[0];
  const shortDate = latestRun ? latestRun.date.slice(5).replace('-', '/') : '';

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className="w-full max-w-md mx-auto bg-[#fdfdfc] rounded-lg shadow-sm border border-stone-200 mb-4 transition-all hover:shadow-md cursor-pointer group"
      >
        <div className="p-4">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2 text-[#8a6d4d] flex-wrap">
              <Footprints size={18} strokeWidth={2.3} />
              <h3 className="font-bold text-stone-700 text-base">跑步訓練</h3>
              {weeklyRuns > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#fdf8f0] text-[#8a6d4d] border border-[#f2e5d0]">
                  本週 {weeklyRuns} 跑
                </span>
              )}
              {weeklyTrainingLoad > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-stone-100 text-stone-500">
                  負荷 {weeklyTrainingLoad}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-[#444]">
                  {weeklyDistanceKm > 0 ? weeklyDistanceKm.toFixed(1) : '0.0'}
                </span>
                <span className="text-stone-400 font-medium text-xs">km</span>
              </div>
              <ChevronRight
                size={16}
                className="text-stone-300 group-hover:text-stone-500 transition-colors"
              />
            </div>
          </div>

          {/* Latest Workout Row */}
          {loading && !latestRun ? (
            <div className="text-xs text-stone-400 py-1 animate-pulse">
              同步 Garmin 跑步紀錄中...
            </div>
          ) : latestRun ? (
            <div className="bg-stone-50/90 border border-stone-200/70 rounded-lg p-2.5 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-bold text-[#8a6d4d] shrink-0">
                    {shortDate}
                  </span>
                  <span className="text-xs font-bold text-stone-700 truncate">
                    {latestRun.cleanName}
                  </span>
                </div>
                <span className="text-xs font-bold text-stone-700 shrink-0">
                  {latestRun.distanceKm} km
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium">
                <span>
                  {[
                    latestRun.paceFormatted,
                    latestRun.durationFormatted,
                    latestRun.averageHR ? `均心 ${latestRun.averageHR}` : '',
                    latestRun.avgPower ? `${latestRun.avgPower}W` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {latestRun.trainingLoad !== undefined && (
                  <span className="text-[10px] text-stone-400">
                    負荷 {latestRun.trainingLoad}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-stone-400 border-t border-stone-100 pt-2">
              尚無近期 Garmin 跑步紀錄
            </div>
          )}
        </div>
      </div>

      <RunningDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        weeklyRuns={weeklyRuns}
        weeklyDistanceKm={weeklyDistanceKm}
        weeklyDurationSeconds={weeklyDurationSeconds}
        weeklyTrainingLoad={weeklyTrainingLoad}
        activities={activities}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
    </>
  );
}
