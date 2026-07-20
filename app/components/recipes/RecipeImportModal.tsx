'use client';

import { useState, useEffect } from 'react';
import type { Recipe } from '@/lib/types';
import { useToast } from '../layout/Toast';

interface RecipeImportModalProps {
  onClose: () => void;
  onImportSuccess: (parsedRecipe: Partial<Recipe>) => void;
  isOneOff?: boolean;
}

export default function RecipeImportModal({ onClose, onImportSuccess, isOneOff = false }: RecipeImportModalProps) {
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('pantry_gemini_key');
    if (savedKey) setApiKey(savedKey);
    
    // 嘗試讀取剪貼簿 (需要瀏覽器權限，可能失敗)
    navigator.clipboard.readText().then(clip => {
      if (clip) {
        setText(clip);
        showToast('已自動貼上剪貼簿內容', 'success');
      }
    }).catch(() => {});
  }, [showToast]);

  const handleAiParse = async () => {
    if (!text.trim()) {
      showToast('請先輸入食譜文字', 'error');
      return;
    }
    if (!apiKey.trim()) {
      showToast('請輸入 Gemini API Key', 'error');
      setShowApiKey(true);
      return;
    }

    localStorage.setItem('pantry_gemini_key', apiKey.trim());
    setIsParsing(true);
    showToast('AI 正在解析中，請稍候...', 'success');

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `請分析以下食譜文字並提取結構化資訊：\n\n${text}\n\n請以繁體中文 (zh-TW) 回傳 JSON 資料。`
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", description: "食譜名稱" },
                ingredients_main: {
                  type: "ARRAY",
                  description: "主要食材列表（非調味料）",
                  items: {
                    type: "OBJECT",
                    properties: {
                      name: { type: "STRING", description: "食材名稱" },
                      quantity: { type: "NUMBER", description: "數值數量（如果是適量/少許填 0）" },
                      unit: { type: "STRING", description: "單位，例如：克、包、顆、適量、少許" }
                    },
                    required: ["name", "quantity", "unit"]
                  }
                },
                seasonings: {
                  type: "ARRAY",
                  description: "調味料列表",
                  items: {
                    type: "OBJECT",
                    properties: {
                      name: { type: "STRING", description: "調味料名稱" },
                      quantity: { type: "NUMBER", description: "數值數量（如果是適量/少許填 0）" },
                      unit: { type: "STRING", description: "單位，例如：匙、克、適量、少許" }
                    },
                    required: ["name", "quantity", "unit"]
                  }
                },
                instructions: {
                  type: "STRING",
                  description: "純文字的步驟說明，請用換行符號隔開，每行開頭請加上數字 (例如：1. 第一步\\n2. 第二步)"
                }
              },
              required: ["name", "ingredients_main", "seasonings", "instructions"]
            }
          }
        })
      });

      if (!res.ok) throw new Error('API Request Failed');

      const data = await res.json();
      const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!contentText) throw new Error('No content returned');

      const parsed = JSON.parse(contentText);
      
      onImportSuccess({
        ...parsed,
        isOneOff,
      });
    } catch (err) {
      console.error(err);
      showToast('解析失敗，請確認 API Key 是否正確，或稍後再試。', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  const handleLocalParse = () => {
    if (!text.trim()) {
      showToast('請先輸入食譜文字', 'error');
      return;
    }
    // 簡單的本機解析降級版
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    onImportSuccess({
      name: lines[0],
      isOneOff,
      instructions: lines.slice(1).join('\n'),
      ingredients_main: [],
      seasonings: []
    });
    showToast('已本機快速載入，請手動整理食材', 'success');
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 sm:items-center sm:justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="w-full sm:max-w-lg bg-[var(--bg)] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col h-[90vh] sm:h-[80vh] overflow-hidden" 
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="flex justify-between items-center p-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-bold text-[var(--text)]">📝 匯入食譜文字</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--bg-secondary)] hover:bg-[var(--surface)] transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <textarea 
            rows={10} 
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="請貼上網頁食譜或是 IG 上的食譜文字..."
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--primary)] resize-none text-sm"
          />

          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setShowApiKey(!showApiKey)}
              className="text-sm font-semibold text-left flex justify-between items-center" 
              style={{ color: 'var(--text-secondary)' }}
            >
              ⚙️ AI 解析設定 {showApiKey ? '▲' : '▼'}
            </button>
            {showApiKey && (
              <input 
                type="password" 
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="請貼上 Gemini API Key" 
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none text-sm"
              />
            )}
          </div>
        </div>

        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t flex flex-col gap-2 shrink-0 bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleAiParse}
            disabled={isParsing}
            className="w-full py-3 rounded-xl font-bold text-white transition-opacity active:opacity-80 flex items-center justify-center gap-2"
            style={{ background: 'var(--primary)' }}
          >
            {isParsing ? '解析中...' : '✨ AI 智慧解析食譜'}
          </button>
          <button
            onClick={handleLocalParse}
            disabled={isParsing}
            className="w-full py-3 rounded-xl font-bold transition-colors bg-[var(--bg-secondary)] hover:bg-[var(--border)] text-[var(--text)]"
          >
            本機簡單匯入 (不使用 AI)
          </button>
        </div>
      </div>
    </div>
  );
}
