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
  Plus,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Zap,
  Tag,
  ArrowUpDown,
  Sparkles,
  ChevronRight
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
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [scrapingId, setScrapingId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

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
    const interval = setInterval(loadProducts, 30000);
    return () => clearInterval(interval);
  }, []);

  function showToast(msg) {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 4000);
  }

  async function handleScrapeNow(product) {
    setScrapingId(product.id);
    try {
      const outcome = await api.scrapeProductNow(product.id);
      await loadProducts();
      showToast(`Scrape complete for "${product.name}"! Status: ${outcome.outcome?.status || 'success'}`);
    } catch (err) {
      alert(`Scrape failed: ${err.message}`);
    } finally {
      setScrapingId(null);
    }
  }

  async function handleDelete(product) {
    if (!window.confirm(`Stop tracking "${product.name}" and remove its scrape history?`)) return;
    try {
      await api.deleteProduct(product.id);
      setProducts(prev => prev.filter(p => p.id !== product.id));
      showToast(`Removed "${product.name}" from tracking.`);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }

  async function handleQuickTrack(storeProductId, name, category) {
    try {
      setLoading(true);
      const payload = {
        storeProductId,
        name,
        category,
        scrapeIntervalMinutes: 120
      };
      await api.trackProduct(payload);
      await loadProducts();
      showToast(`Successfully tracking ${name}!`);
    } catch (err) {
      alert(`Failed to track product: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Filtered & Sorted products
  const filteredProducts = products
    .filter(p => {
      const matchesSearch =
        !searchFilter ||
        p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(searchFilter.toLowerCase())) ||
        String(p.store_product_id).includes(searchFilter);

      if (!matchesSearch) return false;
      if (stockFilter === 'in_stock') return p.inStock === true;
      if (stockFilter === 'out_of_stock') return p.inStock === false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortBy === 'price_asc') return (a.latestPrice ?? 0) - (b.latestPrice ?? 0);
      if (sortBy === 'price_desc') return (b.latestPrice ?? 0) - (a.latestPrice ?? 0);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  // Aggregated KPI Stats
  const totalTracked = products.length;
  const inStockCount = products.filter(p => p.inStock === true).length;
  const outOfStockCount = products.filter(p => p.inStock === false).length;
  const successfulScrapes = products.filter(p => p.lastStatus === 'success' || p.lastStatus === 'retried').length;
  const successRate = totalTracked > 0 ? Math.round((successfulScrapes / totalTracked) * 100) : 100;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Toast Notification */}
      {feedbackMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-3 text-xs font-semibold animate-slide-up border border-slate-700">
          <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Top Banner / Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight gradient-heading">
              E-Commerce Monitor
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100/80 text-blue-800 border border-blue-200">
              <Zap className="w-3 h-3 mr-0.5 fill-blue-600 text-blue-600" />
              Automated 2h
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            Resilient unattended scraping targeting <code className="text-blue-600 font-mono bg-blue-50 px-1 py-0.5 rounded">demo.inelabteamdev.com</code> with cryptographic PoW solving, Wasm JIT cache, and zero-corrupted data guarantees.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 sm:space-x-3">
          <button
            onClick={loadProducts}
            disabled={loading}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300/80 rounded-xl shadow-xs transition disabled:opacity-50"
            title="Refresh product list"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            Refresh
          </button>
          <button
            onClick={onOpenTrackModal}
            className="btn-primary-glow inline-flex items-center px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4 mr-1.5 stroke-[2.5]" />
            Track New Product
          </button>
        </div>
      </div>

      {/* Bento KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Products */}
        <div className="glass-panel interactive-card p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Tracked</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">{totalTracked}</div>
            <p className="text-[11px] font-medium text-slate-500 mt-1 flex items-center">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
              Fixed 2h scrape schedule
            </p>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-blue-100/50 rounded-full blur-2xl pointer-events-none"></div>
        </div>

        {/* Stock Availability */}
        <div className="glass-panel interactive-card p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Stock Status</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-baseline space-x-2">
              <span className="text-emerald-600 font-mono">{inStockCount}</span>
              <span className="text-slate-300 font-normal text-xl">/</span>
              <span className="text-rose-500 font-mono text-xl">{outOfStockCount}</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${totalTracked > 0 ? (inStockCount / totalTracked) * 100 : 100}%` }}
              ></div>
            </div>
            <p className="text-[11px] font-medium text-slate-500 mt-1.5">
              {inStockCount} in stock, {outOfStockCount} unavailable
            </p>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-100/50 rounded-full blur-2xl pointer-events-none"></div>
        </div>

        {/* Audit Health Rate */}
        <div className="glass-panel interactive-card p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Scrape Health</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">{successRate}%</div>
            <p className="text-[11px] font-medium text-slate-500 mt-1 flex items-center">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
              {successfulScrapes} healthy of {totalTracked} items
            </p>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-indigo-100/50 rounded-full blur-2xl pointer-events-none"></div>
        </div>

        {/* Automation Engine */}
        <div className="glass-panel interactive-card p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cron Schedule</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">2 Hours</div>
            <p className="text-[11px] font-medium text-slate-500 mt-1 flex items-center">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>
              cron-job.org triggered
            </p>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-amber-100/50 rounded-full blur-2xl pointer-events-none"></div>
        </div>
      </div>

      {/* Filter, Search & View Switcher Bar */}
      <div className="glass-panel p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search tracked products..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
        </div>

        {/* Controls: Stock Filter, Sort & View Mode */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
          {/* Stock Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50/80 px-2.5 py-1 rounded-xl border border-slate-200 text-xs font-medium text-slate-600">
            <span>Stock:</span>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">All ({products.length})</option>
              <option value="in_stock">In Stock ({inStockCount})</option>
              <option value="out_of_stock">Out of Stock ({outOfStockCount})</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center space-x-1.5 bg-slate-50/80 px-2.5 py-1 rounded-xl border border-slate-200 text-xs font-medium text-slate-600">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="newest">Recently Added</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>

          {/* View Toggle: Grid vs Table */}
          <div className="flex items-center bg-slate-100/90 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Dense Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && products.length === 0 ? (
        <div className="py-24 text-center text-slate-400">
          <RefreshCw className="w-9 h-9 animate-spin mx-auto text-blue-600 mb-3" />
          <p className="text-sm font-semibold text-slate-700">Connecting to live Supabase cluster...</p>
          <p className="text-xs text-slate-400 mt-1">Querying active tracked products</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        /* Empty State with 1-Click Trackable Sample Products */
        <div className="glass-panel rounded-3xl p-8 sm:p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
            No Tracked Products Found
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1.5 mb-8">
            {searchFilter
              ? 'No products match your search query. Try clearing the filter.'
              : 'Start monitoring products from INE’s mock store. You can search the store or track these popular items instantly:'}
          </p>

          {/* Quick 1-Click Cards */}
          {!searchFilter && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto text-left">
              <div
                onClick={() => handleQuickTrack(125, 'Copperpot Solar Charger', 'Electronics')}
                className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">#125</span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mt-2">Copperpot Solar Charger</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Electronics • Assignment Demo Target</p>
                <div className="mt-3 text-[11px] font-bold text-blue-600 flex items-center">
                  <span>+ Quick Track in 1-Click</span>
                </div>
              </div>

              <div
                onClick={() => handleQuickTrack(239, 'Wireless Noise-Canceling Headphones', 'Audio')}
                className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">#239</span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mt-2">Noise-Canceling Headphones</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Audio • Active Mock Item</p>
                <div className="mt-3 text-[11px] font-bold text-blue-600 flex items-center">
                  <span>+ Quick Track in 1-Click</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={onOpenTrackModal}
              className="btn-primary-glow inline-flex items-center px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4 mr-1.5 stroke-[2.5]" />
              Browse Entire Catalog
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((prod) => {
            const isScrapingThis = scrapingId === prod.id;

            return (
              <div
                key={prod.id}
                className="glass-panel interactive-card rounded-3xl p-5 flex flex-col justify-between relative group border border-slate-200/90"
              >
                <div>
                  {/* Top Bar: Store ID & Stock status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                      ID #{prod.store_product_id}
                    </span>
                    <StatusBadge status={prod.inStock} type="stock" />
                  </div>

                  {/* Product Title & Category */}
                  <div className="mt-3">
                    <Link
                      to={`/products/${prod.id}`}
                      className="text-base font-bold text-slate-900 hover:text-blue-600 transition line-clamp-1 block"
                      title={prod.name}
                    >
                      {prod.name}
                    </Link>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mt-0.5">
                      {prod.category || 'General'}
                    </span>
                  </div>

                  {/* Price Section */}
                  <div className="mt-4 p-3 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                        Current Price
                      </span>
                      <div className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-0.5">
                        {prod.latestPrice !== null ? (
                          formatCurrency(prod.latestPrice, prod.currency)
                        ) : (
                          <span className="text-slate-400 text-sm font-normal">Pending first scrape</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                        Last Audit
                      </span>
                      <div className="mt-0.5">
                        <StatusBadge status={isScrapingThis ? 'running' : prod.lastStatus} />
                      </div>
                    </div>
                  </div>

                  {/* Telemetry info */}
                  <div className="mt-3.5 space-y-1.5 text-[11px] text-slate-500">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center text-slate-400">
                        <Clock className="w-3 h-3 mr-1 text-slate-400" />
                        Scraped:
                      </span>
                      <span className="font-medium text-slate-700" title={formatDateTime(prod.lastScrapedAt)}>
                        {formatRelativeTime(prod.lastScrapedAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center text-slate-400">
                        <RefreshCw className="w-3 h-3 mr-1 text-slate-400" />
                        Next Scrape:
                      </span>
                      <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded" title={formatDateTime(prod.next_scrape_at)}>
                        {formatRelativeTime(prod.next_scrape_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Toolbar */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleScrapeNow(prod)}
                    disabled={isScrapingThis}
                    className="inline-flex items-center text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-3 py-1.5 rounded-xl transition duration-150 disabled:opacity-50"
                    title="Scrape immediately"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isScrapingThis ? 'animate-spin' : ''}`} />
                    {isScrapingThis ? 'Scraping...' : 'Scrape Now'}
                  </button>

                  <div className="flex items-center space-x-1">
                    <Link
                      to={`/products/${prod.id}`}
                      className="inline-flex items-center text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-xl transition"
                      title="View Price Trajectory & Audit Logs"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-0.5 text-slate-400" />
                    </Link>

                    <button
                      onClick={() => handleDelete(prod)}
                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-xl transition"
                      title="Delete tracked product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DENSE TABLE VIEW */
        <div className="glass-panel rounded-3xl overflow-hidden shadow-xs border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Product & Store ID</th>
                  <th className="py-3.5 px-6">Current Price</th>
                  <th className="py-3.5 px-6">Stock Status</th>
                  <th className="py-3.5 px-6">Last Scraped</th>
                  <th className="py-3.5 px-6">Next Schedule</th>
                  <th className="py-3.5 px-6">Audit Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredProducts.map((prod) => {
                  const isScrapingThis = scrapingId === prod.id;

                  return (
                    <tr key={prod.id} className="hover:bg-blue-50/30 transition duration-150 group">
                      {/* Product Name & ID */}
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-mono text-[11px] font-bold flex-shrink-0">
                            #{prod.store_product_id}
                          </div>
                          <div>
                            <Link
                              to={`/products/${prod.id}`}
                              className="font-bold text-slate-900 hover:text-blue-600 transition block truncate max-w-xs"
                            >
                              {prod.name}
                            </Link>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              {prod.category || 'General'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Current Price */}
                      <td className="py-4 px-6">
                        {prod.latestPrice !== null ? (
                          <span className="text-sm font-extrabold text-slate-900 font-mono">
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
                          <span className="text-[11px] font-mono text-slate-500 ml-2">({prod.stockQuantity} units)</span>
                        )}
                      </td>

                      {/* Last Scraped */}
                      <td className="py-4 px-6 text-slate-600 font-medium" title={formatDateTime(prod.lastScrapedAt)}>
                        {formatRelativeTime(prod.lastScrapedAt)}
                      </td>

                      {/* Next Scrape */}
                      <td className="py-4 px-6 text-slate-600 font-medium" title={formatDateTime(prod.next_scrape_at)}>
                        <span className="inline-flex items-center font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                          <Clock className="w-3 h-3 mr-1 text-blue-500" />
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
                          className="inline-flex items-center text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-xl transition disabled:opacity-50"
                          title="Scrape immediately"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isScrapingThis ? 'animate-spin' : ''}`} />
                          Scrape Now
                        </button>

                        <Link
                          to={`/products/${prod.id}`}
                          className="inline-flex items-center text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-xl transition"
                          title="View price trajectory and logs"
                        >
                          <span>Details</span>
                          <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                        </Link>

                        <button
                          onClick={() => handleDelete(prod)}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-xl transition"
                          title="Delete tracked product"
                        >
                          <Trash2 className="w-4 h-4" />
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
