// frontend/src/pages/ProductDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Calendar,
  Layers,
  BarChart3,
  Download,
  ShieldCheck,
  Zap,
  Sparkles,
  Info,
  Check
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import api from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { formatCurrency, formatDateTime, formatRelativeTime, formatDuration } from '../utils/formatters.js';

export function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [stats, setStats] = useState(null);
  const [scrapeSummary, setScrapeSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState(null);
  const [selectedInterval, setSelectedInterval] = useState(120);
  const [intervalSaving, setIntervalSaving] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Pagination for logs
  const [logPage, setLogPage] = useState(0);
  const logsPerPage = 20;

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [prodData, histData, logsData] = await Promise.all([
        api.getProduct(id),
        api.getProductHistory(id, 500),
        api.getProductLogs(id, 100, 0)
      ]);

      setProduct(prodData.product);
      setStats(prodData.stats);
      setScrapeSummary(prodData.scrapeSummary);
      setSelectedInterval(prodData.product?.scrape_interval_minutes || 120);
      setHistory(histData.history || []);
      setLogs(logsData.logs || []);
    } catch (err) {
      setError(err.message || 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  async function handleScrapeNow() {
    setScraping(true);
    try {
      const outcome = await api.scrapeProductNow(id);
      await loadData();
      showToast(`Scrape complete! Recorded status: ${outcome.outcome?.status || 'success'}`);
    } catch (err) {
      alert(`Manual scrape failed: ${err.message}`);
    } finally {
      setScraping(false);
    }
  }

  async function handleIntervalChange(newInterval) {
    setSelectedInterval(newInterval);
    setIntervalSaving(true);
    try {
      await api.updateProduct(id, { scrapeIntervalMinutes: newInterval });
      setProduct(prev => ({ ...prev, scrape_interval_minutes: newInterval }));
      showToast(`Schedule updated to every ${newInterval / 60} hours.`);
    } catch (err) {
      alert(`Failed to update interval: ${err.message}`);
    } finally {
      setIntervalSaving(false);
    }
  }

  function handleExportCsv() {
    if (!history || history.length === 0) {
      alert('No price history records to export yet.');
      return;
    }
    const headers = ['Timestamp', 'Price Cents', 'Formatted Price', 'Currency', 'In Stock', 'Stock Quantity', 'Flagged Jump'];
    const rows = history.map(h => [
      `"${new Date(h.scraped_at).toISOString()}"`,
      h.price_cents,
      (h.price_cents / 100).toFixed(2),
      `"${h.currency || 'INR'}"`,
      h.in_stock ? 'Yes' : 'No',
      h.stock_quantity !== null && h.stock_quantity !== undefined ? h.stock_quantity : 'N/A',
      h.flagged ? 'Yes' : 'No'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `product-${product?.store_product_id || id}-price-history.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV export downloaded successfully!');
  }

  if (loading && !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center text-slate-400">
        <RefreshCw className="w-9 h-9 animate-spin mx-auto text-blue-600 mb-3" />
        <p className="text-sm font-semibold text-slate-700">Loading product analysis & price history...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-rose-800">
          <h3 className="font-bold text-base">Unable to load product</h3>
          <p className="text-sm mt-1">{error || 'Product not found.'}</p>
          <Link to="/" className="inline-flex items-center text-sm font-semibold text-rose-700 hover:underline mt-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Format history for Recharts
  const chartData = history.map((item, index) => {
    const price = item.price_cents / 100;
    const date = new Date(item.scraped_at);
    return {
      index,
      timestamp: date.getTime(),
      formattedDate: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      formattedTime: date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      price,
      currency: item.currency || 'INR',
      stock: item.stock_quantity ?? (item.in_stock ? 1 : 0),
      inStock: item.in_stock,
      flagged: Boolean(item.flagged)
    };
  });

  const paginatedLogs = logs.slice(logPage * logsPerPage, (logPage + 1) * logsPerPage);
  const totalLogPages = Math.ceil(logs.length / logsPerPage);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-3 text-xs font-semibold animate-slide-up border border-slate-700">
          <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Back Navigation & Hero Header */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-blue-600 mb-4 transition group"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1 group-hover:-translate-x-0.5 transition" /> Back to Dashboard
        </Link>

        <div className="glass-panel p-6 rounded-3xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 border border-slate-200/90">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                Store ID: #{product.store_product_id}
              </span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {product.category || 'General'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
              {product.name}
            </h1>
            <p className="text-xs text-slate-500 max-w-2xl mt-1 leading-relaxed">
              {product.description || 'Target product tracked from demo.inelabteamdev.com.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`https://demo.inelabteamdev.com/product/${product.store_product_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3.5 py-2 rounded-xl transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              View on Store
              <ExternalLink className="w-3 h-3 ml-1 text-slate-400" />
            </a>

            <button
              onClick={handleScrapeNow}
              disabled={scraping}
              className="btn-primary-glow inline-flex items-center px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${scraping ? 'animate-spin' : ''}`} />
              {scraping ? 'Scraping Store...' : 'Scrape Now'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Price */}
        <div className="glass-panel interactive-card p-5 rounded-2xl shadow-xs relative overflow-hidden">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Price</p>
          <div className="text-3xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight">
            {stats ? formatCurrency(stats.currentPrice, stats.currency) : '—'}
          </div>
          <div className="flex items-center space-x-1.5 mt-1.5 text-xs">
            {stats && stats.priceChangePercent !== 0 && (
              <span
                className={`inline-flex items-center font-bold text-xs px-1.5 py-0.5 rounded ${
                  stats.priceChangePercent > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                {stats.priceChangePercent > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                )}
                {Math.abs(stats.priceChangePercent)}%
              </span>
            )}
            <span className="text-slate-400 text-[11px]">since tracking started</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-blue-100/40 rounded-full blur-2xl pointer-events-none"></div>
        </div>

        {/* Stock Status */}
        <div className="glass-panel interactive-card p-5 rounded-2xl shadow-xs relative overflow-hidden">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Stock Availability</p>
          <div className="mt-2">
            <StatusBadge status={stats?.inStock} type="stock" />
          </div>
          <p className="text-xs font-medium text-slate-500 mt-2">
            {stats?.stockQuantity !== null && stats?.stockQuantity !== undefined
              ? `${stats.stockQuantity} units in stock`
              : 'Inventory active'}
          </p>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-100/40 rounded-full blur-2xl pointer-events-none"></div>
        </div>

        {/* Historical Price Extremes */}
        <div className="glass-panel interactive-card p-5 rounded-2xl shadow-xs relative overflow-hidden">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Price Extremes</p>
          <div className="text-base font-extrabold text-slate-900 mt-1 font-mono">
            {stats
              ? `${formatCurrency(stats.minPrice, stats.currency)} – ${formatCurrency(stats.maxPrice, stats.currency)}`
              : '—'}
          </div>
          <p className="text-[11px] font-medium text-slate-500 mt-2">
            Avg: {stats ? formatCurrency(stats.avgPrice, stats.currency) : '—'} ({stats?.dataPointsCount || 0} quotes)
          </p>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-indigo-100/40 rounded-full blur-2xl pointer-events-none"></div>
        </div>

        {/* Reliability / Success Rate */}
        <div className="glass-panel interactive-card p-5 rounded-2xl shadow-xs relative overflow-hidden">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Audit Health Rate</p>
          <div className="text-3xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight">
            {scrapeSummary?.successRate ?? 100}%
          </div>
          <p className="text-[11px] font-medium text-slate-500 mt-1.5">
            {scrapeSummary?.successfulScrapes || 0} of {scrapeSummary?.totalScrapes || 0} attempts succeeded
          </p>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-amber-100/40 rounded-full blur-2xl pointer-events-none"></div>
        </div>
      </div>

      {/* Interactive Price & Stock History Area Chart */}
      <div className="glass-panel p-6 rounded-3xl shadow-xs space-y-4 border border-slate-200/90">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span>Price & Stock Trajectory</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Time-series price evolution with confirmed $\ge 40\%$ volatility jump indicators
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-medium text-slate-600">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block shadow-xs"></span>
              <span>Price ({stats?.currency || 'INR'})</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block shadow-xs"></span>
              <span>≥ 40% Jump Verified</span>
            </div>
            {history.length > 0 && (
              <button
                onClick={handleExportCsv}
                className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-2xs transition"
                title="Download complete price history as CSV"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                Export CSV
              </button>
            )}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="py-24 text-center text-slate-400">
            <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No price quotes recorded yet</p>
            <p className="text-xs text-slate-400 mt-0.5">Click "Scrape Now" above to retrieve the initial quote.</p>
          </div>
        ) : (
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="formattedTime"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl text-xs space-y-1.5 border border-slate-700">
                          <p className="text-slate-400 font-medium">{data.formattedDate} at {data.formattedTime}</p>
                          <div className="text-base font-extrabold text-white font-mono">
                            {formatCurrency(data.price, data.currency)}
                          </div>
                          <div className="flex items-center space-x-1.5 text-slate-300 text-[11px]">
                            <span className={`w-2 h-2 rounded-full ${data.inStock ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                            <span>{data.inStock ? `${data.stock} units (In Stock)` : 'Out of Stock'}</span>
                          </div>
                          {data.flagged && (
                            <p className="text-amber-400 font-bold flex items-center pt-1.5 border-t border-slate-700/80 text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                              ≥ 40% Jump Confirmed & Flagged
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#priceGradient)"
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (payload.flagged) {
                      return (
                        <circle
                          key={payload.index}
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill="#f59e0b"
                          stroke="#ffffff"
                          strokeWidth={2}
                          className="animate-pulse"
                        />
                      );
                    }
                    return (
                      <circle
                        key={payload.index}
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill="#2563eb"
                      />
                    );
                  }}
                  activeDot={{ r: 6, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Schedule Configuration Card */}
      <div className="glass-panel p-6 rounded-3xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-200/90">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Scraping Schedule Configuration</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configurable interval per product (validated as a multiple of 120 minutes).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <label className="text-xs font-bold text-slate-700">Interval:</label>
          <select
            value={selectedInterval}
            onChange={(e) => handleIntervalChange(Number(e.target.value))}
            disabled={intervalSaving}
            className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
          >
            <option value={120}>Every 2 Hours (120 min - Default)</option>
            <option value={240}>Every 4 Hours (240 min)</option>
            <option value={360}>Every 6 Hours (360 min)</option>
            <option value={720}>Every 12 Hours (720 min)</option>
            <option value={1440}>Every 24 Hours (1440 min)</option>
          </select>
          {intervalSaving && <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />}
        </div>
      </div>

      {/* Transparent Scrape Audit Log */}
      <div className="glass-panel rounded-3xl shadow-xs overflow-hidden border border-slate-200/90 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Honest Audit Trail (Scrape Log)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All attempts, retries, and failure reasons are transparently recorded with zero hidden data.
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-500">
            Total Logged: {logs.length} attempts
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-medium">No scrape attempts logged yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Started At</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Attempts</th>
                    <th className="py-3 px-4">HTTP Status</th>
                    <th className="py-3 px-4">Error Classification</th>
                    <th className="py-3 px-4 text-right">Raw Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {paginatedLogs.map((log) => {
                    const isExpanded = expandedLogId === log.id;

                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-slate-50/60 transition">
                          <td className="py-3.5 px-4">
                            <StatusBadge status={log.status} />
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {formatDateTime(log.started_at)}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {formatDuration(log.duration_ms)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold">
                              {log.attempts} {log.attempts === 1 ? 'attempt' : 'attempts'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {log.http_status ? (
                              <span
                                className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                                  log.http_status >= 200 && log.http_status < 300
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : log.http_status === 429
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {log.http_status}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {log.error_type ? (
                              <span className="font-mono text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                {log.error_type}
                              </span>
                            ) : (
                              <span className="text-slate-400">None (Healthy)</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg transition"
                            >
                              {isExpanded ? 'Hide Payload' : 'Inspect'}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Raw Extracted Payload */}
                        {isExpanded && (
                          <tr className="bg-slate-900 text-slate-200">
                            <td colSpan={7} className="p-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                                  <span>Log UUID: {log.id}</span>
                                  <span>Error Message: {log.error_message || 'None'}</span>
                                </div>
                                <pre className="font-mono text-[11px] overflow-x-auto text-emerald-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
                                  {JSON.stringify(log.extracted || { note: 'No extracted payload recorded for this attempt.' }, null, 2)}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Log Pagination */}
            {totalLogPages > 1 && (
              <div className="flex items-center justify-between pt-4 text-xs text-slate-600 border-t border-slate-100">
                <span>
                  Showing page {logPage + 1} of {totalLogPages}
                </span>
                <div className="space-x-2">
                  <button
                    onClick={() => setLogPage(p => Math.max(0, p - 1))}
                    disabled={logPage === 0}
                    className="px-3 py-1 bg-white border border-slate-300 rounded-lg disabled:opacity-40 font-semibold"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setLogPage(p => Math.min(totalLogPages - 1, p + 1))}
                    disabled={logPage === totalLogPages - 1}
                    className="px-3 py-1 bg-white border border-slate-300 rounded-lg disabled:opacity-40 font-semibold"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
