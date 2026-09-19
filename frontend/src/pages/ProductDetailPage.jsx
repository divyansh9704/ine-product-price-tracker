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
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot
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

  // Pagination for logs
  const [logPage, setLogPage] = useState(0);
  const logsPerPage = 20;

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
      await api.scrapeProductNow(id);
      await loadData();
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
    } catch (err) {
      alert(`Failed to update interval: ${err.message}`);
    } finally {
      setIntervalSaving(false);
    }
  }

  if (loading && !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
        <p className="text-sm font-medium">Loading product analysis and logs...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800">
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back Navigation & Hero Header */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-blue-600 mb-4 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Dashboard
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                Store ID: #{product.store_product_id}
              </span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {product.category || 'General'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{product.name}</h1>
            <p className="text-xs text-slate-500 max-w-2xl mt-1">{product.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`https://demo.inelabteamdev.com/product/${product.store_product_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition"
            >
              View on Store
              <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </a>

            <button
              onClick={handleScrapeNow}
              disabled={scraping}
              className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-lg shadow-sm transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${scraping ? 'animate-spin' : ''}`} />
              {scraping ? 'Scraping Store...' : 'Scrape Now'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Price */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Price</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {stats ? formatCurrency(stats.currentPrice, stats.currency) : '—'}
          </p>
          <div className="flex items-center space-x-1.5 mt-1 text-xs">
            {stats && stats.priceChangePercent !== 0 && (
              <span
                className={`inline-flex items-center font-semibold ${
                  stats.priceChangePercent > 0 ? 'text-rose-600' : 'text-emerald-600'
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
            <span className="text-slate-400">since tracking started</span>
          </div>
        </div>

        {/* Stock Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Stock Availability</p>
          <div className="mt-1.5">
            <StatusBadge status={stats?.inStock} type="stock" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {stats?.stockQuantity !== null && stats?.stockQuantity !== undefined
              ? `${stats.stockQuantity} units available`
              : 'Quantity unavailable'}
          </p>
        </div>

        {/* Historical Extremes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Price Range (Min / Max)</p>
          <p className="text-sm font-bold text-slate-900 mt-1">
            {stats
              ? `${formatCurrency(stats.minPrice, stats.currency)} – ${formatCurrency(stats.maxPrice, stats.currency)}`
              : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Avg: {stats ? formatCurrency(stats.avgPrice, stats.currency) : '—'} ({stats?.dataPointsCount || 0} quotes)
          </p>
        </div>

        {/* Reliability / Success Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Audit Health Rate</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {scrapeSummary?.successRate ?? 100}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {scrapeSummary?.successfulScrapes || 0} of {scrapeSummary?.totalScrapes || 0} attempts succeeded
          </p>
        </div>
      </div>

      {/* Interactive Price & Stock History Chart */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span>Price & Stock History</span>
            </h2>
            <p className="text-xs text-slate-500">
              Complete historical price trajectory with volatility jump confirmation markers
            </p>
          </div>

          <div className="flex items-center space-x-4 text-xs font-medium text-slate-600">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
              <span>Price ({stats?.currency || 'INR'})</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
              <span>$\ge 40\%$ Jump Verified</span>
            </div>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">No price data points recorded yet</p>
            <p className="text-xs text-slate-400">Click "Scrape Now" above to retrieve the initial price quote.</p>
          </div>
        ) : (
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
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
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                          <p className="text-slate-400">{data.formattedDate} at {data.formattedTime}</p>
                          <p className="text-sm font-bold text-white">
                            {formatCurrency(data.price, data.currency)}
                          </p>
                          <p className="text-slate-300">
                            Stock: {data.inStock ? `${data.stock} units (In Stock)` : 'Out of Stock'}
                          </p>
                          {data.flagged && (
                            <p className="text-amber-400 font-semibold flex items-center pt-1 border-t border-slate-700">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              $\ge 40\%$ Volatility Jump (Confirmed)
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#2563eb"
                  strokeWidth={2.5}
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
                  activeDot={{ r: 6, fill: '#2563eb' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Configuration & Schedule Controls */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Scraping Schedule Configuration</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Must be a multiple of 120 minutes per system specification (default: 2 hours).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <label className="text-xs font-semibold text-slate-700">Interval:</label>
          <select
            value={selectedInterval}
            onChange={(e) => handleIntervalChange(Number(e.target.value))}
            disabled={intervalSaving}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={120}>Every 2 Hours (120 min)</option>
            <option value={240}>Every 4 Hours (240 min)</option>
            <option value={360}>Every 6 Hours (360 min)</option>
            <option value={720}>Every 12 Hours (720 min)</option>
            <option value={1440}>Every 24 Hours (1440 min)</option>
          </select>
          {intervalSaving && <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />}
        </div>
      </div>

      {/* Honest Scrape Log Audit Trail */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Scrape Audit Log (Honest Audit Trail)</span>
            </h2>
            <p className="text-xs text-slate-500">
              All attempts, retries, and failures are transparently recorded with exact error taxonomy.
            </p>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Total Logged Attempts: <span className="font-bold text-slate-900">{logs.length}</span>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <p className="text-sm">No scrape logs recorded for this product yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">HTTP Status</th>
                  <th className="py-3 px-4">Error Classification</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono text-slate-700" title={formatDateTime(log.started_at)}>
                          {formatDateTime(log.started_at)}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={log.status} />
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {log.attempts || 1} / 4
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {formatDuration(log.duration_ms)}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {log.http_status ? (
                            <span
                              className={`px-2 py-0.5 rounded font-semibold ${
                                log.http_status === 200
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {log.http_status}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {log.error_type ? (
                            <span className="font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-2xs uppercase tracking-wider">
                              {log.error_type}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {(log.error_message || log.extracted) && (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="inline-flex items-center text-slate-500 hover:text-slate-800 font-medium transition"
                            >
                              {isExpanded ? (
                                <>
                                  Hide <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                                </>
                              ) : (
                                <>
                                  Inspect <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-100">
                          <td colSpan={7} className="p-4 space-y-2">
                            {log.error_message && (
                              <div>
                                <p className="text-xs font-bold text-rose-800">Error Description:</p>
                                <p className="text-xs font-mono text-rose-700 bg-rose-50/60 p-2 rounded border border-rose-100 mt-1">
                                  {log.error_message}
                                </p>
                              </div>
                            )}

                            {log.extracted && (
                              <div>
                                <p className="text-xs font-bold text-slate-700">Raw Extracted Payload:</p>
                                <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto mt-1 max-h-40">
                                  {JSON.stringify(log.extracted, null, 2)}
                                </pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalLogPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-600">
                <span>
                  Showing page {logPage + 1} of {totalLogPages}
                </span>
                <div className="space-x-2">
                  <button
                    onClick={() => setLogPage(p => Math.max(p - 1, 0))}
                    disabled={logPage === 0}
                    className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setLogPage(p => Math.min(p + 1, totalLogPages - 1))}
                    disabled={logPage === totalLogPages - 1}
                    className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
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
