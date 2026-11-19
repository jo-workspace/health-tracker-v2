'use client';
import { createPortal } from 'react-dom';
import { X, Footprints, RefreshCw, Activity, Zap, Heart } from 'lucide-react';
import type { GarminRunningActivity } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  weeklyRuns: number;
  weeklyDistanceKm: number;
  weeklyDurationSeconds: number;
  weeklyTrainingLoad: number;
  activities: GarminRunningActivity[];
  onRefresh?: () => void;
  refreshing?: boolean;
}

function formatTotalHoursMinutes(sec: number): string {
  if (!sec || sec <= 0) return '0m';
  const totalMin = Math.round(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function RunningDetailModal({
  isOpen,
  onClose,
  weeklyRuns,
  weeklyDistanceKm,
  weeklyDurationSeconds,
  weeklyTrainingLoad,
  activities = [],
  onRefresh,
  refreshing = false,
}: Props) {
  if (!isOpen) return null;

  const totalRecentKm = +activities
    .reduce((sum, a) => sum + (a.distanceKm || 0), 0)
    .toFixed(1);
  const totalRecentLoad = Math.round(
    activities.reduce((sum, a) => sum + (a.trainingLoad || 0), 0)
  );

  return typeof document !== 'undefined'
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm transition-opacity">
          <div className="absolute inset-0" onClick={onClose} />

          <div className="relative bg-[#fcfcfc] w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0 bg-white">
              <h2 className="text-base font-bold text-stone-800 flex items-center gap-2">
                <Footprints size={18} className="text-stone-700" />
                <span>跑步與訓練紀錄</span>
              </h2>
              <div className="flex items-center gap-1.5">
                {onRefresh && (
                  <button
                    type="button"
                    onClick={onRefresh}
                    disabled={refreshing}
                    title="同步最新 Garmin 運動紀錄"
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-50 text-stone-500 hover:bg-stone-200 hover:text-stone-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin text-[#5b8c74]' : ''} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-50 text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4">
              {/* 本週與近期統計摘要 */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-[#fffdf7] border border-[#f2ebe1] rounded-xl p-3">
                  <span className="text-[10px] font-bold text-stone-400 block">本週累積 (週一至今)</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-xl font-extrabold text-[#8a6d4d]">
                      {weeklyDistanceKm.toFixed(1)}
                    </span>
                    <span className="text-xs font-bold text-stone-500">km</span>
                    <span className="text-[11px] text-stone-400 ml-auto">{weeklyRuns} 跑</span>
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1 flex items-center justify-between">
                    <span>時長 {formatTotalHoursMinutes(weeklyDurationSeconds)}</span>
                    <span>負荷 {weeklyTrainingLoad}</span>
                  </div>
                </div>

                <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-stone-400 block">
                    近 {activities.length} 筆課表總計
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-xl font-extrabold text-stone-700">
                      {totalRecentKm.toFixed(1)}
                    </span>
                    <span className="text-xs font-bold text-stone-500">km</span>
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1 flex items-center justify-between">
                    <span>總負荷 {totalRecentLoad}</span>
                    <span>平均 {activities.length > 0 ? (totalRecentKm / activities.length).toFixed(1) : '0'} km/次</span>
                  </div>
                </div>
              </div>

              {/* 課表清單 */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-bold text-stone-400 px-0.5 block">
                  近期課表與跑步動態
                </span>

                {activities.length === 0 ? (
                  <div className="text-center py-8 text-xs text-stone-400 bg-stone-50 rounded-xl border border-stone-100">
                    尚無近期跑步紀錄
                  </div>
                ) : (
                  activities.map(act => {
                    const shortDate = act.date.slice(5).replace('-', '/');
                    const timePart = act.startTimeLocal.slice(11, 16);
                    return (
                      <div
                        key={act.activityId}
                        className="bg-white border border-stone-200/90 rounded-xl p-3 shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-[#8a6d4d] bg-[#fdf8f0] border border-[#f2e5d0] px-1.5 py-0.2 rounded">
                                {shortDate}
                              </span>
                              <span className="text-[10px] text-stone-400">{timePart}</span>
                              <h4 className="text-xs font-bold text-stone-700 truncate">
                                {act.cleanName}
                              </h4>
                            </div>
                          </div>
                          {act.trainingLoad !== undefined && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-stone-100 text-stone-600 shrink-0">
                              負荷 {act.trainingLoad}
                            </span>
                          )}
                        </div>

                        {/* 核心數據列 */}
                        <div className="grid grid-cols-4 gap-1.5 bg-stone-50/80 rounded-lg p-2 text-center">
                          <div>
                            <div className="text-[10px] text-stone-400">距離</div>
                            <div className="text-xs font-bold text-stone-700">
                              {act.distanceKm} <span className="text-[10px] font-normal">km</span>
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-stone-400">配速</div>
                            <div className="text-xs font-bold text-stone-700">
                              {act.paceFormatted.replace('/km', '')}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-stone-400">時間</div>
                            <div className="text-xs font-bold text-stone-700">
                              {act.durationFormatted}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-stone-400">心率</div>
                            <div className="text-xs font-bold text-stone-700">
                              {act.averageHR || '-'}
                              {act.maxHR ? (
                                <span className="text-[10px] font-normal text-stone-400">
                                  /{act.maxHR}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* 進階動態指標 (功率、步頻、訓練效果、觸地時間) */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500 px-0.5">
                          {act.avgPower && (
                            <span className="inline-flex items-center gap-1">
                              <Zap size={11} className="text-stone-400" />
                              功率 {act.avgPower}W
                            </span>
                          )}
                          {act.cadence && (
                            <span className="inline-flex items-center gap-1">
                              <Activity size={11} className="text-stone-400" />
                              步頻 {act.cadence}
                            </span>
                          )}
                          {act.aerobicTE !== undefined && (
                            <span className="inline-flex items-center gap-1">
                              <Heart size={11} className="text-stone-400" />
                              有氧 {act.aerobicTE}
                              {act.anaerobicTE ? ` / 無氧 ${act.anaerobicTE}` : ''}
                            </span>
                          )}
                          {act.groundContactTimeMs && (
                            <span className="text-stone-400">
                              觸地 {act.groundContactTimeMs}ms
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
}
