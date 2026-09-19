// frontend/src/components/Navbar.jsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TrendingUp, Plus, ExternalLink, ShieldCheck, AlertTriangle, Activity } from 'lucide-react';

export function Navbar({ onOpenTrackModal, alertsCount = 0 }) {
  const location = useLocation();

  return (
    <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/90 sticky top-0 z-30 transition-all shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Navigation */}
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition duration-200">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight leading-tight block">
                    Price<span className="text-blue-600">Tracker</span>
                  </span>
                  <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    Pro
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium leading-none block mt-0.5">
                  Resilient Scraper & Analytics
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex space-x-1">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  location.pathname === '/'
                    ? 'bg-blue-50/80 text-blue-700 border border-blue-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                Dashboard
              </Link>
            </nav>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Live Telemetry Pill */}
            <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1 bg-slate-100/80 rounded-full border border-slate-200/80 text-[11px] font-medium text-slate-600">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Scraper Engine Active</span>
            </div>

            {/* Target Store Link */}
            <a
              href="https://demo.inelabteamdev.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center text-xs font-medium text-slate-600 hover:text-blue-600 transition bg-slate-50 hover:bg-blue-50 px-2.5 py-1.5 rounded-xl border border-slate-200"
              title="Only target store scraped"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              <span>demo.inelabteamdev.com</span>
              <ExternalLink className="w-3 h-3 ml-1 text-slate-400" />
            </a>

            {/* Alerts Pill */}
            {alertsCount > 0 && (
              <div className="flex items-center bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-xl text-xs font-bold animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
                {alertsCount} {alertsCount === 1 ? 'Alert' : 'Alerts'}
              </div>
            )}

            {/* Track Product CTA Button */}
            <button
              onClick={onOpenTrackModal}
              className="btn-primary-glow inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4 mr-1.5 stroke-[2.5]" />
              Track Product
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
