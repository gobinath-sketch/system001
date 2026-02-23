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
import PublicRoute from './components/PublicRoute';
import { ToastProvider } from './context/ToastContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { SocketProvider } from './context/SocketContext';
function App() {
  const allRoles = ['Sales Executive', 'Sales Manager', 'Delivery Team', 'Finance', 'Business Head', 'Director', 'Super Admin'];
  const salesRoles = ['Sales Executive', 'Sales Manager', 'Business Head', 'Director', 'Super Admin'];
  const opportunityRoles = ['Sales Executive', 'Sales Manager', 'Business Head', 'Director', 'Delivery Team', 'Super Admin'];
  const approvalRoles = ['Sales Manager', 'Business Head', 'Director', 'Super Admin'];
  const deliveryRoles = ['Delivery Team', 'Delivery Manager', 'Delivery Head', 'Super Admin'];
  const financeRoles = ['Finance', 'Super Admin'];

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
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

              {/* Role-Based Dashboard Routes */}
              <Route path="/" element={<ProtectedRoute allowedRoles={allRoles}><Layout><DashboardPage /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/director" element={<ProtectedRoute allowedRoles={['Director', 'Super Admin']}><Layout><DirectorDashboard /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/businesshead" element={<ProtectedRoute allowedRoles={['Business Head', 'Super Admin']}><Layout><BusinessHeadDashboard /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/manager" element={<ProtectedRoute allowedRoles={['Sales Manager', 'Super Admin']}><Layout><SalesManagerDashboard /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/executive" element={<ProtectedRoute allowedRoles={['Sales Executive', 'Super Admin']}><Layout><DashboardPage /></Layout></ProtectedRoute>} />

              {/* Shared Routes */}
              <Route path="/clients" element={<ProtectedRoute allowedRoles={salesRoles}><Layout><ClientPage /></Layout></ProtectedRoute>} />
              <Route path="/opportunities" element={<ProtectedRoute allowedRoles={opportunityRoles}><Layout><OpportunityPage /></Layout></ProtectedRoute>} />
              <Route path="/opportunities/:id" element={<ProtectedRoute allowedRoles={opportunityRoles}><Layout><OpportunityDetailPage /></Layout></ProtectedRoute>} />
              <Route path="/approvals" element={<ProtectedRoute allowedRoles={approvalRoles}><Layout><ApprovalsPage /></Layout></ProtectedRoute>} />

              {/* Delivery Routes */}
              <Route path="/dashboard/delivery" element={<ProtectedRoute allowedRoles={deliveryRoles}><Layout><DeliveryDashboard /></Layout></ProtectedRoute>} />
              <Route path="/delivery/execution" element={<ProtectedRoute allowedRoles={deliveryRoles}><Layout><ProgramExecutionList /></Layout></ProtectedRoute>} />


              <Route path="/smes" element={<ProtectedRoute allowedRoles={deliveryRoles}><Layout><SMEManagement /></Layout></ProtectedRoute>} />

              {/* Finance Routes */}
              <Route path="/finance/dashboard" element={<ProtectedRoute allowedRoles={financeRoles}><Layout><FinanceDashboard /></Layout></ProtectedRoute>} />
              <Route path="/finance" element={<ProtectedRoute allowedRoles={financeRoles}><Layout><FinanceModulePage /></Layout></ProtectedRoute>} />
              <Route path="/finance/:id" element={<ProtectedRoute allowedRoles={financeRoles}><Layout><FinanceDetails /></Layout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={allRoles}><Layout><SettingsPage /></Layout></ProtectedRoute>} />
            </Routes>
          </Router>
        </ToastProvider>
      </CurrencyProvider>
    </SocketProvider>
  </AuthProvider>;
}
export default App;
