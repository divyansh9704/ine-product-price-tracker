// frontend/src/components/ColdStartNotification.jsx
import React, { useState, useEffect } from 'react';
import { Loader2, Server, Activity } from 'lucide-react';
import { coldStartListeners } from '../api.js';

export function ColdStartNotification() {
  const [isCold, setIsCold] = useState(false);

  useEffect(() => {
    const listener = (cold) => setIsCold(cold);
    coldStartListeners.add(listener);
    return () => coldStartListeners.delete(listener);
  }, []);

  if (!isCold) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-slide-up">
      <div className="bg-slate-900/95 text-white px-4 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center space-x-3.5 text-sm border border-blue-500/30 max-w-sm">
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <Server className="w-5 h-5 text-blue-400" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-1.5">
            <p className="font-bold text-slate-100 text-xs tracking-tight">Waking Render Free-Tier</p>
            <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 text-[10px] rounded font-mono font-medium">Spinned Down</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
            Container spin-up takes ~25s. Subsequent queries respond in milliseconds.
          </p>
        </div>
        <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
      </div>
    </div>
  );
}
