// frontend/src/components/SearchTrackModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, Check, AlertCircle, Clock, Package } from 'lucide-react';
import api from '../api.js';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200/80 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Track a Product from Mock Store</h2>
            <p className="text-xs text-slate-500">Search the store catalog or enter an ID (e.g. 125, 239, 404)</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Configuration Bar */}
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by product name, category, or ID (e.g. Copperpot Solar Charger)..."
              autoFocus
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600 bg-blue-50/60 border border-blue-100 p-3 rounded-xl">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-slate-700">Scheduled Frequency:</span>
            </div>
            <select
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value))}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={120}>Every 2 Hours (Assignment Default)</option>
              <option value={240}>Every 4 Hours</option>
              <option value={360}>Every 6 Hours</option>
              <option value={720}>Every 12 Hours</option>
              <option value={1440}>Every 24 Hours</option>
            </select>
          </div>

          {error && (
            <div className="flex items-center space-x-2 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-6 divide-y divide-slate-100 space-y-2">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs">Searching store catalog...</span>
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium">No products found</p>
              <p className="text-xs text-slate-400">Try searching for a different keyword or enter a store product ID.</p>
            </div>
          )}

          {!loading && results.map((prod) => {
            const isTracked = trackedSet.has(Number(prod.id));
            const isTrackingThis = trackingId === prod.id;

            return (
              <div
                key={prod.id}
                className="pt-3 first:pt-0 flex items-center justify-between gap-4 hover:bg-slate-50 p-2 rounded-xl transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                      #{prod.id}
                    </span>
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                      {prod.category || 'General'}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                    {prod.name}
                  </h4>
                  <p className="text-xs text-slate-500 truncate">{prod.description}</p>
                </div>

                <div>
                  {isTracked ? (
                    <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Tracked
                    </span>
                  ) : (
                    <button
                      onClick={() => handleTrack(prod)}
                      disabled={isTrackingThis}
                      className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-lg shadow-sm transition"
                    >
                      {isTrackingThis ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Tracking...
                        </>
                      ) : (
                        'Track'
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
