import { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import { CheckCircle, XCircle } from 'lucide-react';
import AlertModal from '../components/ui/AlertModal';
import { API_BASE } from '../config/api';
const ApprovalsPage = () => {
  const {
    addToast
  } = useToast();
  const {
    socket
  } = useSocket();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'info'
  });
  useEffect(() => {
    fetchApprovals();
  }, []);
  useEffect(() => {
    if (!socket) return;
    const handleEntityUpdated = event => {
      if (['approval', 'opportunity'].includes(event?.entity)) {
        fetchApprovals();
      }
    };
    socket.on('entity_updated', handleEntityUpdated);
    return () => socket.off('entity_updated', handleEntityUpdated);
  }, [socket]);
  const fetchApprovals = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/api/approvals`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setApprovals(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };
  const executeApprove = async id => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_BASE}/api/approvals/${id}/approve`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      addToast('Approval granted successfully!', 'success');
      fetchApprovals();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to approve', 'error');
    }
  };
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    approval: null
  });

  const [rejectionModal, setRejectionModal] = useState({
    isOpen: false,
    id: null,
    reason: ''
  });
  const handleReject = () => {
    if (!previewModal.approval) return;
    setRejectionModal({
      isOpen: true,
      id: previewModal.approval._id,
      reason: ''
    });
    setPreviewModal({ isOpen: false, approval: null });
  };
  const handleApprove = () => {
    if (!previewModal.approval) return;
    const id = previewModal.approval._id;
    setPreviewModal({ isOpen: false, approval: null });
    executeApprove(id);
  };
  const confirmRejection = async () => {
    if (!rejectionModal.reason.trim()) {
      addToast('Please enter a rejection reason', 'error');
      return;
    }
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_BASE}/api/approvals/${rejectionModal.id}/reject`, {
        reason: rejectionModal.reason
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      addToast('Approval rejected', 'info');
      setRejectionModal({
        isOpen: false,
        id: null,
        reason: ''
      });
      fetchApprovals();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to reject', 'error');
    }
  };
  const markAsRead = async (id, currentStatus) => {
    if (currentStatus) return; // Already read
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_BASE}/api/approvals/${id}/read`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      // Update local state to reflect read status
      setApprovals(prev => prev.map(a => a._id === id ? {
        ...a,
        isRead: true
      } : a));
    } catch (err) {
      console.error(err);
    }
  };
  if (loading) return <div className="p-5">Loading approvals...</div>;
  return <div className="p-5 relative">
    <h1 className="text-3xl font-bold text-primary-blue mb-8">Approvals Management</h1>

    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-red-50 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">Approval Requests</h3>
        <span className="px-3 py-1 bg-red-600 text-white rounded-full text-sm font-bold" title="Pending Count">
          {approvals.filter(a => a.status === 'Pending').length}
        </span>
      </div>

      {approvals.length === 0 ? <div className="p-8 text-center text-gray-500">
        <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
        <p>No approval requests found</p>
      </div> : <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 border-b-2 border-gray-100">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-600">Opp ID</th>
              <th className="px-6 py-3 font-semibold text-gray-600">Created By</th>
              <th className="px-6 py-3 font-semibold text-gray-600">TOV</th>
              <th className="px-6 py-3 font-semibold text-gray-600">Total Expense</th>
              <th className="px-6 py-3 font-semibold text-gray-600">GKT Revenue</th>
              <th className="px-6 py-3 font-semibold text-gray-600">GP</th>
              <th className="px-6 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {approvals.map(approval => {
              const snap = approval.snapshot || {};

              // Logic for TOV Display:
              // 1. Newest: 'tov' exists in snapshot.
              // 2. Middle (Buggy Window): 'tov' missing, 'gktRevenue' == 'grossProfit' (Net Rev). Reconstruct TOV = Net + Exp.
              // 3. Oldest: 'tov' missing, 'gktRevenue' != 'grossProfit'. 'gktRevenue' stored TOV.
              let displayTov = 0;
              if (snap.tov !== undefined) {
                displayTov = snap.tov;
              } else if (snap.gktRevenue === snap.grossProfit) {
                displayTov = (Number(snap.gktRevenue) || 0) + (Number(snap.totalExpense) || 0);
              } else {
                displayTov = snap.gktRevenue;
              }

              // Logic for GKT Revenue Display:
              // Always use 'grossProfit' field as it consistently stored Net Revenue across versions.
              // Fallback to 'gktRevenue' only if 'grossProfit' is missing (unlikely) AND we have 'tov' (Newest).
              const displayGktRevenue = snap.grossProfit !== undefined ? snap.grossProfit : snap.tov !== undefined ? snap.gktRevenue : 0;
              return <tr key={approval._id} className={`hover:bg-blue-50 transition ${!approval.isRead ? 'bg-blue-50' : ''}`} onMouseEnter={() => markAsRead(approval._id, approval.isRead)}>
                <td className="px-6 py-4 font-mono text-brand-blue font-medium">
                  {approval.opportunity?.opportunityNumber}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {approval.requestedBy?.name}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  ₹{parseFloat(displayTov || 0).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  ₹{parseFloat(snap.totalExpense || 0).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-gray-600 font-medium text-gray-800">
                  ₹{parseFloat(displayGktRevenue || 0).toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${approval.gpPercent < 10 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>
                    {approval.gpPercent.toFixed(1)}%
                  </span>
                </td>
                <td className="px-6 py-4">
                  {approval.status === 'Pending' ? <div className="flex space-x-2">
                    <button onClick={() => setPreviewModal({ isOpen: true, approval })} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center space-x-1">
                      <span>Review</span>
                    </button>
                  </div> : <span className={`px-2 py-1 rounded text-xs font-bold ${approval.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {approval.status}
                  </span>}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>}
    </div>

    <AlertModal isOpen={alertConfig.isOpen} onClose={() => setAlertConfig(prev => ({
      ...prev,
      isOpen: false
    }))} title={alertConfig.title} message={alertConfig.message} onConfirm={alertConfig.onConfirm} confirmText={alertConfig.confirmText} type={alertConfig.type} />
    {/* Custom Review Modal */}
    {previewModal.isOpen && previewModal.approval && <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{
      backgroundColor: 'rgba(0, 0, 0, 0.4)'
    }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg transform transition-all animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-blue-50">
          <h3 className="text-lg font-semibold text-blue-900">
            Review {previewModal.approval.triggerReason === 'gp' ? 'Sales Profit' : 'Contingency'} Approval
          </h3>
          <button onClick={() => setPreviewModal({ isOpen: false, approval: null })} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XCircle size={20} />
          </button>
        </div>
        {(() => {
          const snap = previewModal.approval.snapshot || {};
          const exp = previewModal.approval.opportunity?.expenses || {};
          const tov = parseFloat(snap.tov) || parseFloat(previewModal.approval.opportunity?.commonDetails?.tov) || 0;
          const totalExpense = parseFloat(snap.totalExpense) || parseFloat(exp.totalExpenses) || 0;

          // Exact Values based on the state at the time
          const gpPercent = previewModal.approval.gpPercent ?? exp.targetGpPercent ?? 0;
          const contPercent = previewModal.approval.contingencyPercent ?? exp.contingencyPercent ?? 0;
          const mktPercent = exp.marketingPercent ?? 0;

          const contAmount = (totalExpense * contPercent) / 100;
          const mktAmount = (tov * mktPercent) / 100;

          // Recalculating Overall and GP Amount exactly as the UI does
          const overallExp = totalExpense + contAmount + mktAmount;
          const gpAmount = tov - overallExp;

          const highlightGp = previewModal.approval.triggerReason === 'gp';
          const highlightCont = previewModal.approval.triggerReason === 'contingency';

          return <div className="p-6 space-y-5">
            <div className="bg-amber-50 border border-amber-200 rounded p-4 mb-2 shadow-sm">
              <p className="text-sm font-semibold text-amber-800 mb-1 uppercase tracking-wider">Requested Exception:</p>
              <p className="text-2xl font-bold text-amber-900">
                {highlightGp ? `Sales Profit: ${gpPercent.toFixed(1)}%` : `Contingency: ${contPercent.toFixed(1)}%`}
              </p>
            </div>

            <div className="space-y-3 text-[15px] text-gray-700 bg-gray-50 rounded-lg p-5 border border-gray-200 shadow-inner">
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="font-medium text-gray-600">Proposal Value (TOV)</span>
                <span className="text-lg font-bold text-gray-900">₹{tov.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>

              <div className={`flex justify-between items-center py-1 ${highlightGp ? 'bg-amber-100/50 -mx-2 px-2 rounded font-medium' : ''}`}>
                <span className={highlightGp ? 'text-amber-900' : 'text-gray-500'}>Sales Profit ({gpPercent.toFixed(1)}%)</span>
                <span className={highlightGp ? 'text-amber-900' : 'text-gray-900'}>₹{Math.max(0, gpAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>

              <div className={`flex justify-between items-center py-1 ${highlightCont ? 'bg-amber-100/50 -mx-2 px-2 rounded font-medium' : ''}`}>
                <span className={highlightCont ? 'text-amber-900' : 'text-gray-500'}>Contingency ({contPercent.toFixed(1)}%)</span>
                <span className={highlightCont ? 'text-amber-900' : 'text-gray-900'}>₹{contAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-gray-500">Marketing ({mktPercent.toFixed(1)}%)</span>
                <span className="text-gray-900">₹{mktAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-200 mt-2">
                <span className="font-semibold text-gray-700">Overall Expenses</span>
                <span className="text-lg font-bold text-red-600">₹{overallExp.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={handleReject} className="px-5 py-2 text-sm font-medium text-red-600 bg-white border-2 border-red-200 rounded-lg hover:bg-red-50 hover:border-red-600 transition-all flex items-center space-x-1 shadow-sm">
                <XCircle size={18} className="mr-1" /> Reject
              </button>
              <button onClick={handleApprove} className="px-6 py-2 text-sm font-medium text-white bg-green-600 border-2 border-green-600 rounded-lg hover:bg-green-700 hover:border-green-700 transition-all flex items-center space-x-1 shadow-sm">
                <CheckCircle size={18} className="mr-1" /> Approve
              </button>
            </div>
          </div>;
        })()}
      </div>
    </div>}

    {/* Custom Rejection Modal */}
    {rejectionModal.isOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{
      backgroundColor: 'rgba(0, 0, 0, 0.4)'
    }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b bg-red-50 rounded-t-lg">
          <h3 className="text-lg font-semibold text-red-800">Reject Opportunity</h3>
          <button onClick={() => setRejectionModal({
            ...rejectionModal,
            isOpen: false
          })} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XCircle size={20} />
          </button>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for Rejection <span className="text-red-500">*</span>
          </label>
          <textarea value={rejectionModal.reason} onChange={e => setRejectionModal({
            ...rejectionModal,
            reason: e.target.value
          })} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none h-32 text-sm" placeholder="Please explain why this opportunity is being rejected..." autoFocus />
        </div>
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
          <button onClick={() => setRejectionModal({
            ...rejectionModal,
            isOpen: false
          })} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={confirmRejection} disabled={!rejectionModal.reason.trim()} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>}
  </div>;
};
export default ApprovalsPage;
