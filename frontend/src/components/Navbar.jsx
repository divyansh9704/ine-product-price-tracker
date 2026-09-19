// frontend/src/components/Navbar.jsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TrendingUp, Plus, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';

export function Navbar({ onOpenTrackModal, alertsCount = 0 }) {
  const location = useLocation();

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Navigation */}
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-2.5">
              <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg text-slate-900 leading-tight block">Price Tracker</span>
                <span className="text-xs text-slate-500 font-medium leading-none block">Reliable Scraper & Analytics</span>
              </div>
            </Link>

            <nav className="hidden md:flex space-x-1">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  location.pathname === '/'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Tracked Products
              </Link>
            </nav>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center space-x-4">
            {/* Target Store Link */}
            <a
              href="https://demo.inelabteamdev.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center text-xs font-medium text-slate-500 hover:text-blue-600 transition bg-slate-100 hover:bg-blue-50 px-2.5 py-1.5 rounded-md border border-slate-200"
              title="Only target store scraped"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              demo.inelabteamdev.com
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>

            {/* Alerts Count */}
            {alertsCount > 0 && (
              <div className="flex items-center bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-md text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                {alertsCount} {alertsCount === 1 ? 'Alert' : 'Alerts'}
              </div>
            )}

            {/* Track Product Button */}
            <button
              onClick={onOpenTrackModal}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Track Product
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
