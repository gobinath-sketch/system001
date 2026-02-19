import { useAuth } from '../../context/AuthContext';
import GPReportSection from '../../components/reports/GPReportSection';
import ClientWiseGPChart from '../../components/charts/ClientWiseGPChart';
const FinanceDashboard = () => {
  useAuth();
  return <div className="p-6">
            {/* Header Removed */}

            {/* GP Report Section */}
            <GPReportSection />

            {/* Client-wise GP Graph */}
            <ClientWiseGPChart />

            {/* Vendor-wise Graph */}
            {/* Vendor-wise Graph Removed */}
        </div>;
};
export default FinanceDashboard;