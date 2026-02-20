import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import DirectorDashboard from './pages/DirectorDashboard';
import SalesManagerDashboard from './pages/dashboard/SalesManagerDashboard';
import BusinessHeadDashboard from './pages/dashboard/BusinessHeadDashboard';
import ClientPage from './pages/ClientPage';
import OpportunityPage from './pages/OpportunityPage';
import OpportunityDetailPage from './pages/OpportunityDetailPage';
import DeliveryDashboard from './pages/DeliveryDashboard';
import ProgramExecutionList from './pages/ProgramExecutionList';
import SMEManagement from './pages/SMEManagement';
import ApprovalsPage from './pages/ApprovalsPage';
import FinanceDashboard from './pages/finance/FinanceDashboard';
import FinanceModulePage from './pages/finance/FinanceModulePage';
import FinanceDetails from './pages/finance/FinanceDetails';
import SettingsPage from './pages/SettingsPage';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './context/ToastContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { SocketProvider } from './context/SocketContext';
function App() {
  useEffect(() => {
    const handleWheel = () => {
      if (document.activeElement.type === 'number') {
        document.activeElement.blur();
      }
    };
    document.addEventListener('wheel', handleWheel, {
      passive: false
    });
    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);
  return <AuthProvider>
    <SocketProvider>
      <CurrencyProvider>
        <ToastProvider>
          <Router basename={import.meta.env.BASE_URL}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              {/* Role-Based Dashboard Routes */}
              <Route path="/" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/director" element={<ProtectedRoute><Layout><DirectorDashboard /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/businesshead" element={<ProtectedRoute><Layout><BusinessHeadDashboard /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/manager" element={<ProtectedRoute><Layout><SalesManagerDashboard /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/executive" element={<ProtectedRoute><Layout><DashboardPage mockRole="Sales Executive" /></Layout></ProtectedRoute>} />

              {/* Shared Routes */}
              <Route path="/clients" element={<ProtectedRoute><Layout><ClientPage /></Layout></ProtectedRoute>} />
              <Route path="/opportunities" element={<ProtectedRoute><Layout><OpportunityPage /></Layout></ProtectedRoute>} />
              <Route path="/opportunities/:id" element={<ProtectedRoute><Layout><OpportunityDetailPage /></Layout></ProtectedRoute>} />
              <Route path="/approvals" element={<ProtectedRoute><Layout><ApprovalsPage /></Layout></ProtectedRoute>} />

              {/* Delivery Routes */}
              <Route path="/dashboard/delivery" element={<ProtectedRoute><Layout><DeliveryDashboard /></Layout></ProtectedRoute>} />
              <Route path="/delivery/execution" element={<ProtectedRoute><Layout><ProgramExecutionList /></Layout></ProtectedRoute>} />


              <Route path="/smes" element={<ProtectedRoute><Layout><SMEManagement /></Layout></ProtectedRoute>} />

              {/* Finance Routes */}
              <Route path="/finance/dashboard" element={<ProtectedRoute><Layout><FinanceDashboard /></Layout></ProtectedRoute>} />
              <Route path="/finance" element={<ProtectedRoute><Layout><FinanceModulePage /></Layout></ProtectedRoute>} />
              <Route path="/finance/:id" element={<ProtectedRoute><Layout><FinanceDetails /></Layout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Layout><SettingsPage /></Layout></ProtectedRoute>} />
            </Routes>
          </Router>
        </ToastProvider>
      </CurrencyProvider>
    </SocketProvider>
  </AuthProvider>;
}
export default App;
