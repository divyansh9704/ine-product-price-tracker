// frontend/src/components/ColdStartNotification.jsx
import React, { useState, useEffect } from 'react';
import { Loader2, Server } from 'lucide-react';
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
    <div className="fixed bottom-4 right-4 z-50 animate-bounce">
      <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center space-x-3 text-sm border border-slate-700">
        <Server className="w-5 h-5 text-blue-400 animate-pulse" />
        <div>
          <p className="font-medium text-slate-100">Connecting to Backend...</p>
          <p className="text-xs text-slate-400">Render free tier may take ~30s on cold start.</p>
        </div>
        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
      </div>
    </div>
  );
}
