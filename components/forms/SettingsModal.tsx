'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, Lock, RefreshCw, CheckCircle2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onForceSync: () => void;
  syncing: boolean;
}

export default function SettingsModal({ isOpen, onClose, onForceSync, syncing }: SettingsModalProps) {
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword(localStorage.getItem('app_password') || '');
      setSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSavePassword = () => {
    localStorage.setItem('app_password', password);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return typeof document !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
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
        
        <div className="p-5 space-y-3">
          <label className="text-xs font-bold text-stone-600 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
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
              title="強制同步"
              className="p-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg border border-stone-200 transition-colors flex items-center justify-center min-h-[38px] shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-[#5b8c74]' : ''}`} />
            </button>
          </div>
          <p className="text-[11px] text-stone-400 leading-relaxed">
            此密碼儲存於本地設備。若未設定或密碼錯誤，將無法與 Google Sheets 同步。
          </p>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
