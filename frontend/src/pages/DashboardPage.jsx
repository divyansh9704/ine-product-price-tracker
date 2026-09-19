// frontend/src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  TrendingUp,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Trash2,
  Search,
  ExternalLink,
  Plus
} from 'lucide-react';
import api from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { formatCurrency, formatRelativeTime, formatDateTime } from '../utils/formatters.js';

export function DashboardPage({ onOpenTrackModal }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [scrapingId, setScrapingId] = useState(null);

  async function loadProducts() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProducts();
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message || 'Failed to load tracked products');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadProducts, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleScrapeNow(product) {
    setScrapingId(product.id);
    try {
      await api.scrapeProductNow(product.id);
      await loadProducts();
    } catch (err) {
      alert(`Scrape failed: ${err.message}`);
    } finally {
      setScrapingId(null);
    }
  }

  async function handleDelete(product) {
    if (!window.confirm(`Stop tracking "${product.name}" and delete its history?`)) return;
    try {
      await api.deleteProduct(product.id);
      setProducts(prev => prev.filter(p => p.id !== product.id));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }

  // Filtered products
  const filteredProducts = products.filter(p => {
    const matchesSearch =
      !searchFilter ||
      p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(searchFilter.toLowerCase())) ||
      String(p.store_product_id).includes(searchFilter);

    if (!matchesSearch) return false;
    if (stockFilter === 'in_stock') return p.inStock === true;
    if (stockFilter === 'out_of_stock') return p.inStock === false;
    return true;
  });

  // Aggregated KPI Stats
  const totalTracked = products.length;
  const inStockCount = products.filter(p => p.inStock === true).length;
  const outOfStockCount = products.filter(p => p.inStock === false).length;
  const successfulScrapes = products.filter(p => p.lastStatus === 'success' || p.lastStatus === 'retried').length;
  const successRate = totalTracked > 0 ? Math.round((successfulScrapes / totalTracked) * 100) : 100;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Top Banner / Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight gradient-heading">
            Tracked Products Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Unattended 2-hour automated scraping with zero wrong prices stored and atomic guarantees.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadProducts}
            disabled={loading}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white/90 border border-slate-300/80 hover:bg-slate-50 rounded-xl shadow-xs transition duration-150 disabled:opacity-50"
            title="Refresh product list"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            Refresh
          </button>
          <button
            onClick={onOpenTrackModal}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm hover:shadow-md hover:shadow-blue-500/25 transition duration-150"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Track New Product
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel interactive-card p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Products</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalTracked}</p>
            <p className="text-xs text-slate-500 mt-0.5">Automated every 2 hours</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel interactive-card p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Stock Availability</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              <span className="text-emerald-600">{inStockCount}</span>
              <span className="text-slate-300 text-lg font-normal mx-1.5">/</span>
              <span className="text-rose-500 text-lg">{outOfStockCount}</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{inStockCount} in stock, {outOfStockCount} out of stock</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel interactive-card p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Scrape Health Rate</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{successRate}%</p>
            <p className="text-xs text-slate-500 mt-0.5">{successfulScrapes} healthy of {totalTracked}</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel interactive-card p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Next Scheduled Run</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">Due</p>
            <p className="text-xs text-slate-500 mt-0.5">Fixed 2-hour schedule</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter tracked products..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <span className="text-xs font-medium text-slate-500">Stock:</span>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All ({products.length})</option>
            <option value="in_stock">In Stock ({inStockCount})</option>
            <option value="out_of_stock">Out of Stock ({outOfStockCount})</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && products.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
          <p className="text-sm font-medium">Loading tracked products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">No Tracked Products Yet</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Start tracking products from the INE mock store. The backend will automatically scrape price and stock every 2 hours and record complete audit logs.
          </p>
          <div className="flex justify-center items-center space-x-4">
            <button
              onClick={onOpenTrackModal}
              className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4 mr-2" />
              Search & Track Product
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Product</th>
                  <th className="py-3.5 px-6">Current Price</th>
                  <th className="py-3.5 px-6">Stock Status</th>
                  <th className="py-3.5 px-6">Last Scraped</th>
                  <th className="py-3.5 px-6">Next Run</th>
                  <th className="py-3.5 px-6">Last Outcome</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredProducts.map((prod) => {
                  const isScrapingThis = scrapingId === prod.id;

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/60 transition group">
                      {/* Product Name & ID */}
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-mono text-xs font-semibold flex-shrink-0">
                            #{prod.store_product_id}
                          </div>
                          <div>
                            <Link
                              to={`/products/${prod.id}`}
                              className="font-semibold text-slate-900 hover:text-blue-600 transition block truncate max-w-xs"
                            >
                              {prod.name}
                            </Link>
                            <span className="text-xs font-medium text-slate-400">
                              {prod.category || 'General'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Current Price */}
                      <td className="py-4 px-6 font-semibold text-slate-900">
                        {prod.latestPrice !== null ? (
                          <span className="text-base font-bold text-slate-900">
                            {formatCurrency(prod.latestPrice, prod.currency)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">Pending first scrape</span>
                        )}
                      </td>

                      {/* Stock Status */}
                      <td className="py-4 px-6">
                        <StatusBadge status={prod.inStock} type="stock" />
                        {prod.stockQuantity !== null && prod.stockQuantity !== undefined && (
                          <span className="text-xs text-slate-500 ml-2">({prod.stockQuantity} units)</span>
                        )}
                      </td>

                      {/* Last Scraped */}
                      <td className="py-4 px-6 text-xs text-slate-600" title={formatDateTime(prod.lastScrapedAt)}>
                        {formatRelativeTime(prod.lastScrapedAt)}
                      </td>

                      {/* Next Scrape */}
                      <td className="py-4 px-6 text-xs text-slate-600" title={formatDateTime(prod.next_scrape_at)}>
                        <span className="inline-flex items-center font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3 mr-1 text-slate-400" />
                          {formatRelativeTime(prod.next_scrape_at)}
                        </span>
                      </td>

                      {/* Last Status */}
                      <td className="py-4 px-6">
                        <StatusBadge status={isScrapingThis ? 'running' : prod.lastStatus} />
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          onClick={() => handleScrapeNow(prod)}
                          disabled={isScrapingThis}
                          className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
                          title="Scrape immediately"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isScrapingThis ? 'animate-spin' : ''}`} />
                          Scrape Now
                        </button>

                        <Link
                          to={`/products/${prod.id}`}
                          className="inline-flex items-center text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition"
                          title="View price history and logs"
                        >
                          Details
                          <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                        </Link>

                        <button
                          onClick={() => handleDelete(prod)}
                          className="inline-flex items-center text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 p-1.5 rounded-lg transition"
                          title="Delete tracked product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
