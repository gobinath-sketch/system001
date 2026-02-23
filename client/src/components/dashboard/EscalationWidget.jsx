import axios from 'axios';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config/api';
const EscalationWidget = ({
  opportunities,
  onEscalate
}) => {
  useNavigate();
  const {
    addToast
  } = useToast();

  // Filter for Low GP (10-15%) & Not Escalated yet (assuming we filter out 'Pending Manager' in parent or check here)
  // Actually, Opportunities generally don't have 'approvalStatus' until delivery. 
  // But we are adding a layer where Sales triggers it. 
  // For now, let's assume we pass in opportunities that *need* attention.
  // Or we filter here: GP between 10-15 AND status not pending manager.

  // We need to calculate GP effectively. 
  // Sales View: GP = ((TOV - TotalExpenses)/TOV) * 100.
  // We need TOV and Expenses.
  // Assuming `opportunities` prop has detailed data.

  const calculateGP = opp => {
    const tov = opp.commonDetails?.tov || 0;
    const expense = opp.financials?.totalExpense || 0; // Or sum explicit expenses if financials not set
    if (!tov) return 0;
    return (tov - expense) / tov * 100;
  };
  const lowGPOpps = opportunities.filter(opp => {
    const gp = calculateGP(opp);
    // We only care if between 10 and 15
    return gp >= 10 && gp < 15 && opp.commonDetails?.status === 'Active'; // And maybe check if not already escalated?
    // Checking existing escalation is hard without fetching approvals. 
    // Let's assume the parent component handles the logic of "Actable" items or we just show them and handle error on duplicate escalate.
  });
  const handlePush = async opp => {
    calculateGP(opp);
    opp.commonDetails?.tov || 0;
    opp.financials?.totalExpense || 0;
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_BASE}/api/opportunities/${opp._id}/escalate`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      addToast(`Escalated ${opp.opportunityNumber} to Manager`, 'success');
      if (onEscalate) onEscalate(); // Assuming fetchEscalations is handled by onEscalate prop
    } catch (err) {
      addToast(err.response?.data?.message || 'Escalation failed', 'error');
    }
  };
  if (lowGPOpps.length === 0) return null;
  return <div className="bg-white p-6 rounded-lg shadow-sm border border-red-100">
            <div className="flex items-center mb-4 text-red-600">
                <AlertCircle className="mr-2" size={20} />
                <h3 className="text-lg font-bold">GP Alert (10% - 15%)</h3>
            </div>
            <div className="space-y-4">
                {lowGPOpps.map(opp => {
        const gp = calculateGP(opp);
        return <div key={opp._id} className="border border-red-100 rounded-lg p-3 bg-red-50 flex justify-between items-center">
                            <div>
                                <div className="font-bold text-gray-800">{opp.opportunityNumber}</div>
                                <div className="text-sm text-gray-600">{opp.client?.companyName}</div>
                                <div className="text-xs font-bold text-red-600">GP: {gp.toFixed(1)}%</div>
                            </div>
                            <button onClick={() => handlePush(opp)} className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 flex items-center">
                                Push to Manager <ArrowRight size={12} className="ml-1" />
                            </button>
                        </div>;
      })}
            </div>
        </div>;
};
export default EscalationWidget;