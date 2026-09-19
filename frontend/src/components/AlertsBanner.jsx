// frontend/src/components/AlertsBanner.jsx
import React from 'react';
import { AlertOctagon, CheckCircle2, ShieldAlert } from 'lucide-react';
import api from '../api.js';

export function AlertsBanner({ alerts, onAlertDismissed }) {
  if (!alerts || alerts.length === 0) return null;

  async function handleAcknowledge(alertId) {
    try {
      await api.ackAlert(alertId);
      if (onAlertDismissed) onAlertDismissed(alertId);
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  }

  return (
    <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 text-white border-b border-rose-500/30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div key={alert.id} className="flex items-center justify-between flex-wrap gap-3 text-sm">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0 border border-rose-500/30">
                  <ShieldAlert className="w-4 h-4 animate-pulse text-rose-400" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider bg-rose-500/30 text-rose-300 px-2 py-0.5 rounded border border-rose-500/40">
                      {alert.type || 'DOM_ALTERATION'}
                    </span>
                    <span className="text-xs text-rose-200/90 font-medium">Anti-Corruption Circuit Tripped</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 font-normal">
                    {alert.message || 'Store structure or challenge protocol alteration detected. Zero corrupted data was stored.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleAcknowledge(alert.id)}
                className="inline-flex items-center text-xs font-semibold text-rose-200 hover:text-white bg-rose-900/60 hover:bg-rose-800/80 border border-rose-700/60 px-3 py-1.5 rounded-xl shadow-sm transition active:scale-95"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
                Acknowledge Alert
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
