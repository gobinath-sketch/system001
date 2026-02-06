import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { CheckCircle, XCircle } from 'lucide-react';

import AlertModal from '../components/ui/AlertModal';

const ApprovalsPage = () => {
    const { addToast } = useToast();
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'info' });

    useEffect(() => {
        fetchApprovals();
    }, []);

    const fetchApprovals = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/approvals', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setApprovals(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const executeApprove = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`http://localhost:5000/api/approvals/${id}/approve`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            addToast('Approval granted successfully!', 'success');
            fetchApprovals();
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to approve', 'error');
        }
    };

    const handleApprove = (id) => {
        setAlertConfig({
            isOpen: true,
            title: 'Confirm Approval',
            message: 'Are you sure you want to approve this opportunity?',
            confirmText: 'Approve',
            type: 'success',
            onConfirm: () => {
                setAlertConfig(prev => ({ ...prev, isOpen: false }));
                executeApprove(id);
            }
        });
    };

    const [rejectionModal, setRejectionModal] = useState({ isOpen: false, id: null, reason: '' });

    const handleReject = (id) => {
        setRejectionModal({ isOpen: true, id: id, reason: '' });
    };

    const confirmRejection = async () => {
        if (!rejectionModal.reason.trim()) {
            addToast('Please enter a rejection reason', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post(`http://localhost:5000/api/approvals/${rejectionModal.id}/reject`,
                { reason: rejectionModal.reason },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            addToast('Approval rejected', 'info');
            setRejectionModal({ isOpen: false, id: null, reason: '' });
            fetchApprovals();
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to reject', 'error');
        }
    };

    const markAsRead = async (id, currentStatus) => {
        if (currentStatus) return; // Already read
        try {
            const token = localStorage.getItem('token');
            await axios.put(`http://localhost:5000/api/approvals/${id}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Update local state to reflect read status
            setApprovals(prev => prev.map(a => a._id === id ? { ...a, isRead: true } : a));
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div className="p-5">Loading approvals...</div>;

    return (
        <div className="p-5 relative">
            <h1 className="text-3xl font-bold text-primary-blue mb-8">Approvals Management</h1>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-red-50 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800">Pending Approvals</h3>
                    <span className="px-3 py-1 bg-red-600 text-white rounded-full text-sm font-bold">
                        {approvals.filter(a => a.status === 'Pending').length}
                    </span>
                </div>

                {approvals.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
                        <p>No pending approvals</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
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
                                {approvals.map((approval) => {
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
                                    const displayGktRevenue = snap.grossProfit !== undefined ? snap.grossProfit : (snap.tov !== undefined ? snap.gktRevenue : 0);

                                    return (
                                        <tr key={approval._id}
                                            className={`hover:bg-blue-50 transition ${!approval.isRead ? 'bg-blue-50' : ''}`}
                                            onMouseEnter={() => markAsRead(approval._id, approval.isRead)}
                                        >
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
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${approval.gpPercent < 10 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {approval.gpPercent.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {approval.status === 'Pending' && (
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => handleApprove(approval._id)}
                                                            className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center space-x-1"
                                                        >
                                                            <CheckCircle size={14} />
                                                            <span>Approve</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(approval._id)}
                                                            className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 flex items-center space-x-1"
                                                        >
                                                            <XCircle size={14} />
                                                            <span>Reject</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                    <strong>Note:</strong> Opportunities with Gross Profit (GP) below 10% require specific approval before proceeding.
                </p>
            </div>

            <AlertModal
                isOpen={alertConfig.isOpen}
                onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                title={alertConfig.title}
                message={alertConfig.message}
                onConfirm={alertConfig.onConfirm}
                confirmText={alertConfig.confirmText}
                type={alertConfig.type}
            />

            {/* Custom Rejection Modal */}
            {rejectionModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-4 border-b bg-red-50 rounded-t-lg">
                            <h3 className="text-lg font-semibold text-red-800">Reject Opportunity</h3>
                            <button
                                onClick={() => setRejectionModal({ ...rejectionModal, isOpen: false })}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Reason for Rejection <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={rejectionModal.reason}
                                onChange={(e) => setRejectionModal({ ...rejectionModal, reason: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none h-32 text-sm"
                                placeholder="Please explain why this opportunity is being rejected..."
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
                            <button
                                onClick={() => setRejectionModal({ ...rejectionModal, isOpen: false })}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmRejection}
                                disabled={!rejectionModal.reason.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default ApprovalsPage;

