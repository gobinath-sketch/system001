import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import Card from '../../components/ui/Card';
const FinanceModulePage = () => {
  useAuth();
  const {
    socket
  } = useSocket();
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    fetchOpportunities();
  }, []);
  useEffect(() => {
    if (!socket) return;
    const handleEntityUpdated = event => {
      if (event?.entity === 'opportunity') {
        fetchOpportunities();
      }
    };
    socket.on('entity_updated', handleEntityUpdated);
    return () => socket.off('entity_updated', handleEntityUpdated);
  }, [socket]);
  const fetchOpportunities = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/opportunities', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setOpportunities(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching opportunities:', err);
      setLoading(false);
    }
  };
  const filteredOpportunities = opportunities.filter(op => op.opportunityNumber.toLowerCase().includes(searchTerm.toLowerCase()) || op.client?.companyName?.toLowerCase().includes(searchTerm.toLowerCase()));
  return <div className="p-3 sm:p-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-primary-blue mb-6 sm:mb-8">Finance Management</h1>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                    <h3 className="text-gray-500 text-sm font-medium">Total Receivables</h3>
                    <p className="text-2xl font-bold text-green-600 mt-2">
                        ₹ {opportunities.reduce((sum, op) => sum + (op.financeDetails?.clientReceivables?.amountReceivable || 0), 0).toLocaleString()}
                    </p>
                </Card>
                <Card>
                    <h3 className="text-gray-500 text-sm font-medium">Total Payables</h3>
                    <p className="text-2xl font-bold text-red-600 mt-2">
                        ₹ {opportunities.reduce((sum, op) => sum + (op.financeDetails?.vendorPayables?.trainerFinalExpenses || 0), 0).toLocaleString()}
                    </p>
                </Card>
                <Card>
                    <h3 className="text-gray-500 text-sm font-medium">Active Opportunities</h3>
                    <p className="text-2xl font-bold text-blue-600 mt-2">
                        {opportunities.length}
                    </p>
                </Card>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-gray-50">
                    <h2 className="font-semibold text-gray-700">Opportunities List</h2>
                    <div className="relative w-full sm:w-auto">
                        <input type="text" placeholder="Search Opportunities..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-brand-blue w-full sm:w-auto" />
                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-center text-sm">
                        <thead className="border-b border-gray-200 bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-3 font-semibold text-gray-900 text-center">Opportunity ID</th>
                                <th className="px-6 py-3 font-semibold text-gray-900 text-center">Created By</th>
                                <th className="px-6 py-3 font-semibold text-gray-900 text-center">Type</th>
                                <th className="px-6 py-3 font-semibold text-gray-900 text-center">Client Receivables (₹)</th>
                                <th className="px-6 py-3 font-semibold text-gray-900 text-center">Vendor Payables (₹)</th>
                                <th className="px-6 py-3 font-semibold text-gray-900 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? <tr><td colSpan="6" className="p-6 text-center text-gray-500">Loading...</td></tr> : filteredOpportunities.length === 0 ? <tr><td colSpan="6" className="p-6 text-center text-gray-500">No opportunities found</td></tr> : filteredOpportunities.map(op => <tr key={op._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-gray-900 text-center">{op.opportunityNumber}</td>
                                        <td className="px-6 py-4 text-gray-700 text-center">{op.createdBy?.name || 'Unknown'}</td>
                                        <td className="px-6 py-4 text-gray-700 text-center">{op.type}</td>
                                        <td className="px-6 py-4 text-center font-medium text-green-600">
                                            {op.financeDetails?.clientReceivables?.amountReceivable ? `₹ ${op.financeDetails.clientReceivables.amountReceivable.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center font-medium text-red-600">
                                            {op.financeDetails?.vendorPayables?.trainerFinalExpenses ? `₹ ${op.financeDetails.vendorPayables.trainerFinalExpenses.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Link to={`/finance/${op._id}`} className="text-brand-blue hover:text-blue-800 flex items-center justify-center gap-1 font-medium">
                                                View <ArrowRight size={14} />
                                            </Link>
                                        </td>
                                    </tr>)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>;
};
export default FinanceModulePage;