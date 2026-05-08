import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import QRScanner from './pages/QRScanner';
import StoresNearMe from './pages/StoresNearMe';
import ManualEntry from './pages/ManualEntry';
import CheckResult from './pages/CheckResult';
import MyTickets from './pages/MyTickets';
import DrawResults from './pages/DrawResults';
import ManualNumbers from './pages/ManualNumbers';
import WinningStores from './pages/WinningStores';
import Guide from './pages/Guide';
import Admin from './pages/Admin';
import AdminLotteryPage from './pages/AdminLotteryPage';
import QRMinTest from './pages/QRMinTest';

import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="scanner" element={<QRScanner />} />
            <Route path="qr-min-test" element={<QRMinTest />} />
            <Route path="manual" element={<ManualEntry />} />
            <Route path="check" element={<CheckResult />} />
            <Route path="qr-result" element={<CheckResult />} />
            <Route path="my-tickets" element={<MyTickets />} />
            <Route path="manual-numbers" element={<ManualNumbers />} />
            <Route path="results" element={<DrawResults />} />
            <Route path="stores" element={<StoresNearMe />} />
            <Route path="winning-stores" element={<WinningStores />} />
            <Route path="guide" element={<Guide />} />
            <Route path="admin" element={<Admin />} />
            <Route path="admin-lottery" element={<AdminLotteryPage />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
