import { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const ROLES = [
    'Director', 'Business Head', 'Sales Manager', 'Sales Executive',
    'Delivery Head', 'Delivery Executive', 'Finance'
];

const UserApprovals = () => {
    const [pendingUsers, setPendingUsers] = useState([]);
    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();
    const [selections, setSelections] = useState({});
    const [submitting, setSubmitting] = useState(null); // store id of row being acted on

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const [pendingRes, authRes] = await Promise.all([
                fetch(`${API_BASE}/api/users/pending`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE}/api/users/managers`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            if (pendingRes.ok && authRes.ok) {
                const pendingData = await pendingRes.json();
                const managersData = await authRes.json();
                setPendingUsers(pendingData);
                setManagers(managersData);
                const initialSelections = {};
                pendingData.forEach(p => {
                    initialSelections[p._id] = { role: 'Sales Executive', reportingManagerId: '' };
                });
                setSelections(initialSelections);
            }
        } catch (error) {
            console.error('Failed to fetch data', error);
            addToast('Failed to load pending users.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectChange = (id, field, value) => {
        setSelections(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    };

    const handleApprove = async (pendingUser) => {
        const selection = selections[pendingUser._id];
        if (!selection?.role) { addToast('Please select a role.', 'error'); return; }

        setSubmitting(pendingUser._id);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE}/api/users/approve-pending`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    pendingUserId: pendingUser._id,
                    role: selection.role,
                    reportingManagerId: selection.reportingManagerId || ''
                })
            });
            if (!response.ok) throw new Error('Failed to approve');
            addToast(`${pendingUser.name} approved as ${selection.role}. Notification email sent.`, 'success');
            setPendingUsers(prev => prev.filter(u => u._id !== pendingUser._id));
        } catch {
            addToast('Error approving user', 'error');
        } finally {
            setSubmitting(null);
        }
    };

    const handleReject = async (pendingUser) => {
        setSubmitting(pendingUser._id);
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE}/api/users/reject-pending`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ pendingUserId: pendingUser._id })
            });
            if (!response.ok) throw new Error('Failed to reject');
            addToast(`${pendingUser.name}'s request has been rejected. Notification email sent.`, 'info');
            setPendingUsers(prev => prev.filter(u => u._id !== pendingUser._id));
        } catch {
            addToast('Error rejecting user', 'error');
        } finally {
            setSubmitting(null);
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 text-gray-800">
            <div className="flex justify-between items-end border-b pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Clock className="text-orange-500" />
                        Pending User Approvals
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Review new Outlook login attempts and assign access rights.</p>
                </div>
            </div>

            {pendingUsers.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
                    <CheckCircle size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
                    <p className="text-gray-500 text-sm mt-1">There are no pending user access requests at the moment.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b">
                            <tr>
                                <th className="px-5 py-3 font-semibold text-slate-600">Name</th>
                                <th className="px-5 py-3 font-semibold text-slate-600">Email</th>
                                <th className="px-5 py-3 font-semibold text-slate-600">Assign Role</th>
                                <th className="px-5 py-3 font-semibold text-slate-600">Reporting Manager</th>
                                <th className="px-5 py-3 font-semibold text-slate-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {pendingUsers.map(user => {
                                const isActing = submitting === user._id;
                                return (
                                    <tr key={user._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-4 font-medium text-gray-900">{user.name}</td>
                                        <td className="px-5 py-4 text-gray-500 font-mono text-xs">{user.email}</td>

                                        <td className="px-5 py-3">
                                            <select
                                                className="border rounded-md px-3 py-1.5 text-sm bg-white"
                                                value={selections[user._id]?.role || 'Sales Executive'}
                                                onChange={(e) => handleSelectChange(user._id, 'role', e.target.value)}
                                            >
                                                {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                                            </select>
                                        </td>

                                        <td className="px-5 py-3">
                                            <select
                                                className="border rounded-md px-3 py-1.5 text-sm bg-white min-w-[180px]"
                                                value={selections[user._id]?.reportingManagerId || ''}
                                                onChange={(e) => handleSelectChange(user._id, 'reportingManagerId', e.target.value)}
                                            >
                                                <option value="">-- No Manager --</option>
                                                {managers.map(m => (
                                                    <option key={m._id} value={m._id}>{m.name} ({m.role})</option>
                                                ))}
                                            </select>
                                        </td>

                                        <td className="px-5 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleReject(user)}
                                                    disabled={!!isActing}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 font-medium rounded hover:bg-red-100 transition-colors border border-red-200 disabled:opacity-50"
                                                >
                                                    <XCircle size={15} />
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(user)}
                                                    disabled={!!isActing}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 font-medium rounded hover:bg-green-100 transition-colors border border-green-200 disabled:opacity-50"
                                                >
                                                    <CheckCircle size={15} />
                                                    Approve
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default UserApprovals;
