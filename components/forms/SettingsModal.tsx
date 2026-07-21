'use client';
import { useState, useEffect } from 'react';
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

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-stone-100 bg-stone-50">
          <h2 className="font-bold text-stone-700 flex items-center gap-2">
            <Settings className="w-5 h-5 text-stone-500" />
            系統設定
          </h2>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-bold text-stone-600 flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              雲端同步密碼
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="請輸入 Vercel 環境變數密碼"
                className="flex-1 p-2.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#8bbd9f] focus:border-transparent"
              />
              <button 
                onClick={handleSavePassword}
                className="px-4 py-2 bg-stone-800 text-white font-medium rounded-lg hover:bg-stone-700 transition-colors flex items-center gap-1"
              >
                {saved ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : '儲存'}
              </button>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              此密碼將儲存於您的設備。若未設定或密碼錯誤，將無法與 Google Sheets 進行同步。
            </p>
          </div>

          <div className="pt-4 border-t border-stone-100 space-y-3">
             <label className="text-sm font-bold text-stone-600">
              資料同步
            </label>
            <button 
              onClick={onForceSync}
              disabled={syncing}
              className="w-full py-3 bg-[#f0f4f2] text-[#5b8c74] font-bold rounded-lg hover:bg-[#e2ebe6] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? '正在同步雲端資料...' : '強制重新同步'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
