// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
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

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Product Price Tracker &bull; INE Internship Assignment</span>
          <span className="text-slate-400">Target Store: https://demo.inelabteamdev.com &bull; 2-Hour Scheduling</span>
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
