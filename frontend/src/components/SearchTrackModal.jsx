// frontend/src/components/SearchTrackModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, Check, AlertCircle, Clock, Package, Sparkles, Tag } from 'lucide-react';
import api from '../api.js';

const QUICK_FILTERS = [
  { label: 'All Items', query: '' },
  { label: 'Solar Charger #125', query: '125' },
  { label: 'Smart Mug #239', query: '239' },
  { label: 'Air Purifier #404', query: '404' },
  { label: 'Headphones', query: 'headphone' }
];

const FREQUENCY_OPTIONS = [
  { value: 120, label: 'Every 2 Hours', badge: 'Assignment Default' },
  { value: 240, label: 'Every 4 Hours' },
  { value: 360, label: 'Every 6 Hours' },
  { value: 720, label: 'Every 12 Hours' },
  { value: 1440, label: 'Daily (24h)' }
];

export function SearchTrackModal({ isOpen, onClose, onProductTracked, trackedProductIds = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trackingId, setTrackingId] = useState(null);
  const [intervalMinutes, setIntervalMinutes] = useState(120);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.searchCatalog(query);
        setResults(data.items || []);
      } catch (err) {
        setError(err.message || 'Failed to search store catalog');
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Handle ESC key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleTrack(product) {
    setTrackingId(product.id);
    setError(null);
    try {
      const payload = {
        storeProductId: product.id,
        name: product.name,
        category: product.category,
        imageUrl: null,
        description: product.description,
        scrapeIntervalMinutes: intervalMinutes
      };
      const res = await api.trackProduct(payload);
      if (onProductTracked) onProductTracked(res.product);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to track product');
    } finally {
      setTrackingId(null);
    }
  }

  const trackedSet = new Set(trackedProductIds.map(id => Number(id)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Specular Accent */}
        <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-400" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Track Store Product</h2>
              <p className="text-xs text-slate-500">Search live catalog or test mock items from demo.inelabteamdev.com</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="hidden sm:inline-block text-[10px] font-mono font-medium px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md border border-slate-200">
              ESC
            </span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-200/60 transition"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Input & Controls */}
        <div className="p-6 border-b border-slate-100 space-y-4 bg-white">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, category, or product ID (e.g. 125, Solar Charger)..."
              autoFocus
              className="w-full pl-11 pr-10 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition shadow-inner"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filter Suggestions */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-slate-400 text-[11px] font-medium mr-1 flex items-center">
              <Tag className="w-3 h-3 mr-1" /> Quick suggestions:
            </span>
            {QUICK_FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setQuery(f.query)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                  query === f.query
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Frequency Selector Pills */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1.5 font-medium text-slate-700">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Automated Scrape Schedule:</span>
              </div>
              <span className="text-[11px] text-slate-500">Cron will trigger via Render backend</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIntervalMinutes(opt.value)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition text-center relative ${
                    intervalMinutes === opt.value
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  <div>{opt.label}</div>
                  {opt.badge && (
                    <div className={`text-[9px] font-normal mt-0.5 leading-tight ${
                      intervalMinutes === opt.value ? 'text-blue-100' : 'text-blue-600'
                    }`}>
                      {opt.badge}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center space-x-2 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5 bg-slate-50/40">
          {loading && (
            <div className="py-14 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
              <span className="text-xs font-medium text-slate-500">Querying mock store catalog...</span>
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="py-14 text-center text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Package className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No matching products found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Try searching for a different keyword or click one of the quick suggestions above.
              </p>
            </div>
          )}

          {!loading && results.map((prod) => {
            const isTracked = trackedSet.has(Number(prod.id));
            const isTrackingThis = trackingId === prod.id;

            return (
              <div
                key={prod.id}
                className="bg-white p-3.5 rounded-2xl border border-slate-200/80 hover:border-blue-300 hover:shadow-md transition flex items-center justify-between gap-4 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                      #{prod.id}
                    </span>
                    <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-md">
                      {prod.category || 'General'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition">
                    {prod.name}
                  </h4>
                  <p className="text-xs text-slate-500 truncate mt-0.5 font-normal">
                    {prod.description}
                  </p>
                </div>

                <div className="flex-shrink-0">
                  {isTracked ? (
                    <span className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Tracked
                    </span>
                  ) : (
                    <button
                      onClick={() => handleTrack(prod)}
                      disabled={isTrackingThis}
                      className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg transition"
                    >
                      {isTrackingThis ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Tracking...
                        </>
                      ) : (
                        'Track Product'
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div className="flex items-center space-x-1">
            <span>Tracking triggers immediate snapshot upon addition.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
