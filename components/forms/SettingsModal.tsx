'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Settings,
  X,
  Lock,
  RefreshCw,
  CheckCircle2,
  Watch,
  AlertTriangle,
  KeyRound,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { GarminOverviewData } from '@/lib/types';
import { saveGarminConfig } from '@/lib/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onForceSync: () => void;
  syncing: boolean;
  garminData?: GarminOverviewData | null;
  onRefreshGarmin?: (force?: boolean) => void;
  garminRefreshing?: boolean;
  garminError?: string | null;
}

export default function SettingsModal({
  isOpen,
  onClose,
  onForceSync,
  syncing,
  garminData,
  onRefreshGarmin,
  garminRefreshing = false,
  garminError = null,
}: SettingsModalProps) {
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(false);

  const [garminKey, setGarminKey] = useState('');
  const [garminExpiresAt, setGarminExpiresAt] = useState('2027-11-19');
  const [garminCalendarIcs, setGarminCalendarIcs] = useState('');
  const [showKeyEditor, setShowKeyEditor] = useState(false);
  const [garminSaved, setGarminSaved] = useState(false);
  const [garminSaving, setGarminSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword(localStorage.getItem('app_password') || '');
      setGarminKey(localStorage.getItem('garmin_api_key') || '');
      setGarminExpiresAt(
        localStorage.getItem('garmin_api_expires_at') ||
          garminData?.expiresAt ||
          '2027-11-19'
      );
      setGarminCalendarIcs(localStorage.getItem('garmin_calendar_ics_url') || '');
      setSaved(false);
      setGarminSaved(false);
    }
  }, [isOpen, garminData?.expiresAt]);

  if (!isOpen) return null;

  const handleSavePassword = () => {
    localStorage.setItem('app_password', password);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveGarmin = async () => {
    const cleanKey = garminKey.trim();
    const cleanExp = garminExpiresAt.trim() || '2027-11-19';
    const cleanIcs = garminCalendarIcs.trim();
    if (cleanKey) {
      localStorage.setItem('garmin_api_key', cleanKey);
    } else {
      localStorage.removeItem('garmin_api_key');
    }
    localStorage.setItem('garmin_api_expires_at', cleanExp);
    if (cleanIcs) {
      localStorage.setItem('garmin_calendar_ics_url', cleanIcs);
    } else {
      localStorage.removeItem('garmin_calendar_ics_url');
    }

    setGarminSaving(true);
    try {
      await saveGarminConfig(cleanKey, cleanExp, cleanIcs || undefined);
      setGarminSaved(true);
      setTimeout(() => setGarminSaved(false), 2000);
      if (onRefreshGarmin) {
        onRefreshGarmin(true);
      }
    } catch (err: any) {
      alert('同步金鑰至雲端失敗：' + (err?.message || '請確認雲端同步密碼是否正確'));
    } finally {
      setGarminSaving(false);
    }
  };

  const expiresAtDisplay = (garminData?.expiresAt || garminExpiresAt || '2027-11-19').replace(
    /-/g,
    '/'
  );
  const daysLeft = garminData?.daysUntilExpiry;
  const isExpiringSoon = garminData?.isExpiringSoon ?? (typeof daysLeft === 'number' && daysLeft <= 14);
  const isExpired = typeof daysLeft === 'number' && daysLeft < 0;

  return typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={onClose}
        >
          <div
            className="relative bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-stone-100 bg-stone-50">
              <h2 className="font-bold text-stone-700 flex items-center gap-2 text-base">
                <Settings className="w-4 h-4 text-stone-500" />
                系統設定
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* 雲端同步密碼 */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-stone-600 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-stone-500" />
                  雲端同步密碼
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="請輸入環境變數密碼"
                    className="flex-1 min-w-0 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400 min-h-[38px]"
                  />
                  <button
                    type="button"
                    onClick={handleSavePassword}
                    className="px-3.5 py-2 bg-stone-800 text-white text-xs font-bold rounded-lg hover:bg-stone-700 transition-colors flex items-center justify-center gap-1 min-h-[38px] shrink-0"
                  >
                    {saved ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : '儲存'}
                  </button>
                  <button
                    type="button"
                    onClick={onForceSync}
                    disabled={syncing}
                    title="強制同步 Google Sheets"
                    className="p-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg border border-stone-200 transition-colors flex items-center justify-center min-h-[38px] shrink-0 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${syncing ? 'animate-spin text-[#5b8c74]' : ''}`}
                    />
                  </button>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  此密碼儲存於本地設備。若未設定或密碼錯誤，將無法與 Google Sheets 同步。
                </p>
              </div>

              {/* Garmin Personal API 狀態與到期提醒 */}
              <div className="pt-4 border-t border-stone-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-600 flex items-center gap-1.5">
                    <Watch className="w-3.5 h-3.5 text-stone-500" />
                    Garmin Personal API
                  </span>
                  <div className="flex items-center gap-1.5">
                    {garminData?.configured ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#eaf5ef] text-[#3e7256] border border-[#d8ece1]">
                        已連線
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-stone-100 text-stone-500">
                        未設定
                      </span>
                    )}
                    {onRefreshGarmin && (
                      <button
                        type="button"
                        onClick={() => onRefreshGarmin(true)}
                        disabled={garminRefreshing}
                        title="重新整理 Garmin 資料"
                        className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-md transition-colors disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            garminRefreshing ? 'animate-spin text-[#5b8c74]' : ''
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {garminError && (
                  <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    同步失敗：{garminError}
                  </div>
                )}

                {/* 到期日狀態框 */}
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    isExpired
                      ? 'bg-red-50/70 border-red-200 text-red-700'
                      : isExpiringSoon
                      ? 'bg-amber-50/80 border-amber-200 text-amber-800'
                      : 'bg-stone-50 border-stone-200/80 text-stone-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isExpiringSoon || isExpired ? (
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    ) : (
                      <KeyRound className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                    )}
                    <div>
                      <div className="font-bold">金鑰到期日：{expiresAtDisplay}</div>
                      {isExpiringSoon && !isExpired && (
                        <div className="text-[10px] mt-0.5 text-amber-700">
                          即將到期，請至 Garmin Connect 重新產生金鑰
                        </div>
                      )}
                      {isExpired && (
                        <div className="text-[10px] mt-0.5 text-red-600">
                          金鑰已過期，請更新 API Key
                        </div>
                      )}
                    </div>
                  </div>
                  {typeof daysLeft === 'number' && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                        isExpired
                          ? 'bg-red-100 text-red-700'
                          : isExpiringSoon
                          ? 'bg-amber-200/70 text-amber-900'
                          : 'bg-white border border-stone-200 text-stone-600'
                      }`}
                    >
                      {isExpired ? `過期 ${Math.abs(daysLeft)} 天` : `剩 ${daysLeft} 天`}
                    </span>
                  )}
                </div>

                {/* 展開更新金鑰與到期日 */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowKeyEditor(!showKeyEditor)}
                    className="text-[11px] font-medium text-stone-500 hover:text-stone-700 flex items-center gap-1"
                  >
                    {showKeyEditor ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    <span>{showKeyEditor ? '收起金鑰與課表設定' : '更新雲端 API Key / 課表行事曆'}</span>
                  </button>

                  {showKeyEditor && (
                    <div className="mt-2.5 p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
                      <div>
                        <label className="text-[10px] font-bold text-stone-500 block mb-1">
                          Personal API Key (自動加密同步至 Google Sheets)
                        </label>
                        <input
                          type="password"
                          value={garminKey}
                          onChange={e => setGarminKey(e.target.value)}
                          placeholder={garminData?.configured ? '已設定於雲端 (貼入新金鑰即可覆蓋)' : 'GCDC_...'}
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-stone-500 block mb-1">
                          Garmin 課表行事曆連結 (iCal 匯出網址，自動加密保存)
                        </label>
                        <input
                          type="password"
                          value={garminCalendarIcs}
                          onChange={e => setGarminCalendarIcs(e.target.value)}
                          placeholder={
                            garminData?.calendarIcsConfigured
                              ? '已綁定 Garmin 課表行事曆 (貼入新網址即可更新)'
                              : 'https://connect.garmin.com/modern/calendar/export/...'
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-stone-500 block mb-1">
                            到期日提醒
                          </label>
                          <input
                            type="date"
                            value={garminExpiresAt}
                            onChange={e => setGarminExpiresAt(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveGarmin}
                          disabled={garminSaving}
                          className="px-3 py-1.5 bg-stone-800 text-white text-xs font-bold rounded-lg hover:bg-stone-700 transition-colors flex items-center justify-center gap-1 h-[32px] shrink-0 disabled:opacity-50"
                        >
                          {garminSaving ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-300" />
                          ) : garminSaved ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            '套用'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
}
