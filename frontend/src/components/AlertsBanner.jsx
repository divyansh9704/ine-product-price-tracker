// frontend/src/components/AlertsBanner.jsx
import React from 'react';
import { AlertOctagon, CheckCircle2 } from 'lucide-react';
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
    <div className="bg-rose-50 border-b border-rose-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div key={alert.id} className="flex items-center justify-between flex-wrap gap-2 text-sm text-rose-800">
              <div className="flex items-center space-x-2">
                <AlertOctagon className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span className="font-semibold uppercase text-xs tracking-wider bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded">
                  {alert.type}
                </span>
                <span>{alert.message || 'Store structure or challenge protocol alteration detected. Zero unverified data was stored.'}</span>
              </div>
              <button
                onClick={() => handleAcknowledge(alert.id)}
                className="inline-flex items-center text-xs font-medium text-rose-700 hover:text-rose-900 bg-rose-100 hover:bg-rose-200 px-2.5 py-1 rounded transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-rose-600" />
                Acknowledge
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
