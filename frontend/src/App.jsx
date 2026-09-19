// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { ShieldCheck, GitBranch, ExternalLink, Activity, Terminal } from 'lucide-react';
import api from './api.js';
import { Navbar } from './components/Navbar.jsx';
import { AlertsBanner } from './components/AlertsBanner.jsx';
import { ColdStartNotification } from './components/ColdStartNotification.jsx';
import { SearchTrackModal } from './components/SearchTrackModal.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { ProductDetailPage } from './pages/ProductDetailPage.jsx';

export function App() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [trackedIds, setTrackedIds] = useState([]);
  const navigate = useNavigate();

  async function loadAlertsAndProducts() {
    try {
      const [alertsData, productsData] = await Promise.all([
        api.getAlerts(true),
        api.getProducts()
      ]);
      setAlerts(alertsData.alerts || []);
      setTrackedIds((productsData.products || []).map(p => p.store_product_id));
    } catch {
      // Ignored if backend cold-starting
    }
  }

  useEffect(() => {
    loadAlertsAndProducts();
    const interval = setInterval(loadAlertsAndProducts, 30000);
    return () => clearInterval(interval);
  }, []);

  function handleProductTracked(newProduct) {
    if (newProduct) {
      setTrackedIds(prev => [...prev, newProduct.store_product_id]);
      navigate(`/products/${newProduct.id}`);
    }
  }

  function handleAlertDismissed(dismissedId) {
    setAlerts(prev => prev.filter(a => a.id !== dismissedId));
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* Subtle ambient decorative gradient orbs */}
      <div className="fixed top-0 -left-40 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-20 -right-40 w-96 h-96 bg-indigo-200/25 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-1/3 w-96 h-96 bg-emerald-100/30 rounded-full blur-3xl pointer-events-none -z-10" />

      <Navbar
        onOpenTrackModal={() => setIsTrackModalOpen(true)}
        alertsCount={alerts.length}
      />

      <AlertsBanner
        alerts={alerts}
        onAlertDismissed={handleAlertDismissed}
      />

      <main className="flex-1">
        <Routes>
          <Route
            path="/"
            element={<DashboardPage onOpenTrackModal={() => setIsTrackModalOpen(true)} />}
          />
          <Route
            path="/products/:id"
            element={<ProductDetailPage />}
          />
        </Routes>
      </main>

      {/* Enterprise SaaS Footer */}
      <footer className="bg-white/80 backdrop-blur-md border-t border-slate-200 py-8 text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>All Scraper Services Operational</span>
              </div>
              <span className="text-slate-300 hidden sm:inline">&bull;</span>
              <span className="text-slate-600 font-medium hidden sm:inline">
                Target: <code className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">demo.inelabteamdev.com</code>
              </span>
            </div>

            <div className="flex items-center space-x-6 text-slate-500 font-medium">
              <a
                href="https://github.com/divyansh9704/ine-product-price-tracker"
                target="_blank"
                rel="noreferrer"
                className="hover:text-blue-600 transition flex items-center space-x-1"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>GitHub Repository</span>
              </a>
              <a
                href="https://demo.inelabteamdev.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-blue-600 transition flex items-center space-x-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Live Target Store</span>
              </a>
              <span className="text-slate-400 text-[11px]">
                INE Software Engineer Intern Assignment
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Modals & Notifications */}
      <SearchTrackModal
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
        onProductTracked={handleProductTracked}
        trackedProductIds={trackedIds}
      />

      <ColdStartNotification />
    </div>
  );
}

export default App;
