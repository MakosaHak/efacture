import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { PwaUpdateToast } from './components/pwa/PwaUpdateToast';
import { OfflineSync } from './components/pwa/OfflineSync';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ScannerPage from './pages/ScannerPage';
import InvoiceListPage from './pages/InvoiceListPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import ValidateInvoicePage from './pages/ValidateInvoicePage';
import PriceComparePage from './pages/PriceComparePage';
import SuppliersPage from './pages/SuppliersPage';
import ForecastPage from './pages/ForecastPage';
import OptimizePage from './pages/OptimizePage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <AuthProvider>
      <PwaUpdateToast />
      <OfflineSync />
      <Routes>
        <Route path="/auth/connexion" element={<LoginPage />} />
        <Route path="/auth/inscription" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/scanner" element={<ScannerPage />} />
          <Route path="/factures" element={<InvoiceListPage />} />
          <Route path="/factures/:id" element={<InvoiceDetailPage />} />
          <Route path="/factures/:id/valider" element={<ValidateInvoicePage />} />
          <Route path="/stats/prix" element={<PriceComparePage />} />
          <Route path="/stats/previsions" element={<ForecastPage />} />
          <Route path="/stats/optimisation" element={<OptimizePage />} />
          <Route path="/stats/fournisseurs" element={<SuppliersPage />} />
          <Route path="/profil" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
