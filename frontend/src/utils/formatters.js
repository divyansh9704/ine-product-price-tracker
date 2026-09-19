// frontend/src/utils/formatters.js

export function formatCurrency(amount, currency = 'INR', isCents = false) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }

  const numeric = isCents ? amount / 100 : amount;
  const curr = currency || 'INR';

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 2,
      minimumFractionDigits: numeric % 1 === 0 ? 0 : 2
    }).format(numeric);
  } catch {
    return `${curr} ${numeric.toFixed(2)}`;
  }
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return isoString;
  }
}

export function formatRelativeTime(isoString) {
  if (!isoString) return 'Never';
  try {
    const d = new Date(isoString);
    const diffSec = Math.round((Date.now() - d.getTime()) / 1000);

    if (diffSec < 0) {
      const futureSec = Math.abs(diffSec);
      if (futureSec < 60) return `in ${futureSec}s`;
      if (futureSec < 3600) return `in ${Math.round(futureSec / 60)}m`;
      return `in ${Math.round(futureSec / 3600)}h`;
    }

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
    return `${Math.round(diffSec / 86400)}d ago`;
  } catch {
    return '—';
  }
}

export function formatDuration(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
