import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Briefcase, FileText, Grid, ExternalLink, Edit, Check, X } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import AlertModal from '../../components/ui/AlertModal';
import { PieChart, Pie, Cell } from 'recharts';
import { useCurrency } from '../../context/CurrencyContext';


const SalesManagerTeamView = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [documentStats, setDocumentStats] = useState({ poCount: 0, invoiceCount: 0 });
    const [monthlyPerformance, setMonthlyPerformance] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [teamOpportunities, setTeamOpportunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMember, setSelectedMember] = useState('all');
    const [analyticsMember, setAnalyticsMember] = useState('all');
    const [editingTarget, setEditingTarget] = useState(null);
    const [targetValue, setTargetValue] = useState('');
    const [targetPeriod, setTargetPeriod] = useState('Yearly');
    const [showDocumentModal, setShowDocumentModal] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'info' });
    const { currency } = useCurrency();

    const EXCHANGE_RATE = 84;

    const formatCurrency = (amount) => {
        if (!amount) return currency === 'INR' ? '₹0' : '$0';
        const val = currency === 'INR' ? amount : amount / EXCHANGE_RATE;
        return val.toLocaleString('en-US', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: 0
        });
    };

    const formatCompactCurrency = (amount) => {
        if (!amount) return currency === 'INR' ? '₹0' : '$0';
        const val = currency === 'INR' ? amount : amount / EXCHANGE_RATE;

        if (currency === 'INR') {
            if (val >= 100000) {
                return `₹${(val / 100000).toFixed(2).replace(/\.00$/, '').replace(/\.0$/, '')}L`;
            }
            if (val >= 1000) {
                return `₹${(val / 1000).toFixed(1).replace(/\.0$/, '')}k`;
            }
            return `₹${val.toFixed(0)}`;
        }

        if (val >= 1000) {
            return '$' + (val / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        }
        return '$' + val.toFixed(0);
    };

    // Check for pending approvals on mount (Once per session)
    useEffect(() => {
        const checkApprovals = async () => {
            const hasChecked = sessionStorage.getItem('hasCheckedApprovals');
            if (hasChecked) return;

            try {
                const token = localStorage.getItem('token');
                const res = await axios.get('http://localhost:5000/api/approvals?status=Pending', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                // Filter where current user is the approver (Manager level)
                const pendingForMe = res.data.filter(app => app.approvalLevel === 'Manager' && app.status === 'Pending');

                if (pendingForMe.length > 0) {
                    setAlertConfig({
                        isOpen: true,
                        title: 'Approval Required',
                        message: `You have ${pendingForMe.length} pending approval request(s) requiring your attention.`,
                        confirmText: 'Go to Approvals',
                        onConfirm: () => navigate('/approvals'),
                        type: 'warning'
                    });
                }
                sessionStorage.setItem('hasCheckedApprovals', 'true');
            } catch (error) {
                console.error("Failed to check approvals", error);
            }
        };
        checkApprovals();
    }, [navigate]);

    useEffect(() => {
        fetchDashboardData();
    }, [selectedMember]);

    const fetchDashboardData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Fetch KPI stats
            const statsRes = await axios.get('http://localhost:5000/api/dashboard/manager/stats', { headers });
            setStats(statsRes.data);

            // Fetch document stats
            const docStatsRes = await axios.get('http://localhost:5000/api/dashboard/manager/document-stats', { headers });
            setDocumentStats(docStatsRes.data);

            // Fetch monthly performance
            const perfUrl = selectedMember === 'all'
                ? 'http://localhost:5000/api/dashboard/manager/monthly-performance'
                : `http://localhost:5000/api/dashboard/manager/monthly-performance?userId=${selectedMember}`;
            const perfRes = await axios.get(perfUrl, { headers });
            setMonthlyPerformance(perfRes.data);

            // Fetch team members for filter
            const teamRes = await axios.get('http://localhost:5000/api/dashboard/manager/team-members', { headers });
            setTeamMembers(teamRes.data || []);

            // Fetch team opportunities for document modal
            const oppsRes = await axios.get('http://localhost:5000/api/opportunities', { headers });
            const formattedOpps = oppsRes.data.map(opp => ({
                ...opp,
                clientName: opp.client?.companyName || 'N/A'
            }));
            setTeamOpportunities(formattedOpps);

            setLoading(false);
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            setLoading(false);
        }
    };

    // Calculate Analytics Data (Filtered by analyticsMember)
    const analyticsData = React.useMemo(() => {
        if (!teamOpportunities.length) return { topClients: [], typeDist: [] };

        let filteredOpps = teamOpportunities;
        if (analyticsMember !== 'all') {
            filteredOpps = teamOpportunities.filter(o => o.createdBy?._id === analyticsMember || o.createdBy === analyticsMember);
        }

        // 1. Top 5 Clients by Revenue
        const clientMap = {};
        filteredOpps.forEach(opp => {
            const name = opp.clientName || 'Unknown';
            // Use PO Value as requested for Revenue
            const val = opp.poValue || 0;
            if (val > 0) {
                clientMap[name] = (clientMap[name] || 0) + val;
            }
        });
        const topClients = Object.entries(clientMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        // 2. Revenue by Type
        const typeMap = {};
        filteredOpps.forEach(opp => {
            const type = opp.type || 'Unknown';
            // Use PO Value as requested for Revenue
            const val = opp.poValue || 0;

            if (val > 0) {
                if (!typeMap[type]) {
                    typeMap[type] = { value: 0, count: 0 };
                }
                typeMap[type].value += val;
                typeMap[type].count += 1;
            }
        });

        const typeDist = Object.entries(typeMap)
            .map(([name, data]) => ({ name, value: data.value, count: data.count }))
            .filter(item => item.value > 0); // Double check filter

        return { topClients, typeDist };
    }, [teamOpportunities, analyticsMember]);

    const COLORS = ['#003D7A', '#10b981', '#D4AF37', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

    const handleEditTarget = (memberId, currentTarget, period = 'Yearly') => {
        setEditingTarget(memberId);
        // Correctly set initial value based on currency
        const val = currency === 'INR' ? currentTarget : currentTarget / EXCHANGE_RATE;
        setTargetValue(val ? Math.round(val) : ''); // Round for cleaner editing
        setTargetPeriod(period);
    };

    const handleSaveTarget = async (memberId) => {
        try {
            const token = localStorage.getItem('token');
            // Convert back to INR if saving in USD
            const amountInInr = currency === 'INR' ? parseFloat(targetValue) : parseFloat(targetValue) * EXCHANGE_RATE;

            await axios.put(
                `http://localhost:5000/api/dashboard/manager/set-target/${memberId}`,
                {
                    period: targetPeriod,
                    year: new Date().getFullYear(),
                    amount: amountInInr
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            addToast('Target updated successfully', 'success');
            setEditingTarget(null);
            setTargetPeriod('Yearly');
            fetchDashboardData();
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to update target', 'error');
        }
    };

    // Glass Style for Cards
    const glassCardStyle = {
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0))',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 0 30px rgba(255, 255, 255, 0.3), inset 0 0 10px rgba(255, 255, 255, 0.5)',
        borderTop: '1px solid rgba(255, 255, 255, 0.8)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.8)',
        overflow: 'hidden',
        position: 'relative'
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;

    return (
        <div className="p-3 sm:p-6 space-y-6 sm:space-y-8 bg-bg-page h-full">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 sm:mb-8 gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Sales Manager Dashboard</h1>
                    <p className="text-gray-600">Welcome back, {user?.name}</p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Currency Toggle moved to global header */}
                </div>
            </div>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Combined Client & Team Members Card */}
                <div style={glassCardStyle} className="p-6">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 rounded-full bg-blue-100">
                            <Grid size={20} className="text-blue-600" />
                        </div>
                        <span className="text-sm text-gray-500 font-medium">Team Overview</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="text-center border-r border-gray-200">
                            <p className="text-2xl font-bold text-blue-600">{stats?.totalClients || 0}</p>
                            <p className="text-xs text-gray-400 mt-1">Total Clients</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{stats?.teamMembersCount || 0}</p>
                            <p className="text-xs text-gray-400 mt-1">Team Members</p>
                        </div>
                    </div>
                </div>

                {/* Opportunities Card */}
                <div style={glassCardStyle} className="p-6">
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="p-2 rounded-full bg-purple-100">
                            <Briefcase size={20} className="text-purple-600" />
                        </div>
                        <span className="text-sm text-gray-500 font-medium">Total Opportunities</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <div className="text-center border-r border-gray-200">
                            <p className="text-2xl font-bold text-yellow-600">{stats?.inProgressOpportunities || 0}</p>
                            <p className="text-xs text-gray-400 mt-1">In Progress</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{stats?.completedOpportunities || 0}</p>
                            <p className="text-xs text-gray-400 mt-1">Completed</p>
                        </div>
                    </div>
                </div>

                {/* Document Status Card */}
                <div style={glassCardStyle} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 rounded-full bg-indigo-100">
                                <FileText size={20} className="text-indigo-600" />
                            </div>
                            <span className="text-sm text-gray-500 font-medium">Billing</span>
                        </div>
                        <button
                            onClick={() => setShowDocumentModal(true)}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <ExternalLink size={16} />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="text-center border-r border-gray-200">
                            <p className="text-2xl font-bold text-blue-600">{documentStats.poCount}</p>
                            <p className="text-xs text-gray-400 mt-1">POs Uploaded</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{documentStats.invoiceCount}</p>
                            <p className="text-xs text-gray-400 mt-1">Invoices</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Row 2: Analytics & Targets (3 Columns) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Revenue by Type */}
                <div style={glassCardStyle} className="p-4 flex flex-col min-h-[300px]">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-gray-800">Revenue by Opportunity closure </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500">Filter:</span>
                            <select
                                value={analyticsMember}
                                onChange={(e) => setAnalyticsMember(e.target.value)}
                                className="text-[10px] border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-0.5 px-1"
                            >
                                <option value="all">All Team</option>
                                {teamMembers.map(member => (
                                    <option key={member._id} value={member._id}>{member.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={analyticsData.typeDist}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {analyticsData.typeDist.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white p-2 border border-gray-200 shadow-md rounded text-xs">
                                                    <p className="font-bold">{data.name}</p>
                                                    <p>Revenue: {formatCurrency(data.value)}</p>
                                                    <p>Count: {data.count} Opps</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend
                                    layout="horizontal"
                                    verticalAlign="bottom"
                                    align="center"
                                    wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Top 5 Clients */}
                <div style={glassCardStyle} className="p-4 flex flex-col min-h-[300px]">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-gray-800">Top 5 Clients by Revenue</h3>
                        <span className="text-[10px] text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded">
                            {analyticsMember === 'all' ? 'All Team' : teamMembers.find(m => m._id === analyticsMember)?.name || 'Member'}
                        </span>
                    </div>
                    <div className="flex-1 overflow-auto space-y-2">
                        {analyticsData.topClients.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-gray-400 text-xs">No data available</div>
                        ) : (
                            analyticsData.topClients.map((client, index) => (
                                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
                                            {index + 1}
                                        </div>
                                        <span className="font-medium text-gray-800 text-xs truncate max-w-[100px]" title={client.name}>{client.name}</span>
                                    </div>
                                    <span className="font-bold text-green-600 text-xs">{formatCurrency(client.value)}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 3. Set Team Targets */}
                <div style={glassCardStyle} className="p-4 flex flex-col min-h-[300px]">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-gray-800">Set Team Targets</h3>
                        <select
                            value={targetPeriod}
                            onChange={(e) => setTargetPeriod(e.target.value)}
                            className="text-[10px] border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-0.5 px-1"
                        >
                            <option value="Yearly">Yearly</option>
                            <option value="Half-Yearly">Half-Yearly</option>
                            <option value="Quarterly">Quarterly</option>
                        </select>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr className="border-b">
                                    <th className="text-left py-1.5 px-1.5 font-semibold text-gray-700">Member</th>
                                    <th className="text-right py-1.5 px-1.5 font-semibold text-gray-700">Target</th>
                                    <th className="text-center py-1.5 px-1.5 font-semibold text-gray-700">Edit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teamMembers.map(member => {
                                    const currentTarget = member.targets?.find(t => t.year === new Date().getFullYear() && t.period === targetPeriod)?.amount || 0;
                                    return (
                                        <tr key={member._id} className="border-b hover:bg-gray-50">
                                            <td className="py-1.5 px-1.5 text-xs truncate max-w-[80px]" title={member.name}>{member.name}</td>
                                            <td className="text-right py-1.5 px-1.5">
                                                {editingTarget === member._id ? (
                                                    <input
                                                        type="number"
                                                        value={targetValue}
                                                        onChange={(e) => setTargetValue(e.target.value)}
                                                        className="w-full text-right border border-gray-300 rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500"
                                                        autoFocus
                                                        onFocus={(e) => (targetValue == 0 || targetValue == '0') && setTargetValue('')}
                                                    />
                                                ) : (
                                                    <span className="font-medium text-xs">{formatCompactCurrency(currentTarget)}</span>
                                                )}
                                            </td>
                                            <td className="text-center py-1.5 px-1.5">
                                                {editingTarget === member._id ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => handleSaveTarget(member._id)}
                                                            className="text-green-600 hover:text-green-700"
                                                        >
                                                            <Check size={12} />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingTarget(null)}
                                                            className="text-red-600 hover:text-red-700"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleEditTarget(member._id, currentTarget, targetPeriod)}
                                                        className="text-blue-600 hover:text-blue-700"
                                                    >
                                                        <Edit size={12} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* --- Row 3: Trends (2 Columns) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Team Opportunity Trends */}
                <div style={glassCardStyle} className="p-4 flex flex-col min-h-[300px]">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-gray-800">Team Opportunity Trends</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500">Filter:</span>
                            <select
                                value={selectedMember}
                                onChange={(e) => setSelectedMember(e.target.value)}
                                className="text-[10px] border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-0.5 px-1"
                            >
                                <option value="all">All Team</option>
                                {teamMembers.map(member => (
                                    <option key={member._id} value={member._id}>{member.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyPerformance}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                <Tooltip cursor={false} contentStyle={{ fontSize: '11px' }} />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                <Bar dataKey="inProgress" name="In Progress" fill="#FCD34D" stackId="a" />
                                <Bar dataKey="completed" name="Completed" fill="#10B981" stackId="a" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Team Revenue Trends */}
                <div style={glassCardStyle} className="p-4 flex flex-col min-h-[300px]">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-gray-800">Team Revenue Trends</h3>
                        <div className="flex items-center gap-2">
                            {/* Re-use the same selectedMember state/filter logic if intended, or just replicate the UI sync */}
                            {/* The user didn't ask for a separate filter here, but kept the logic. I'll reuse the same state 'selectedMember' so one filter can drive both if desired, OR keep independent inputs bound to same state. 
                                 Wait, previously both used `selectedMember`. So changing one changes both. That is good behavior for "Team Trends". */}
                            <span className="text-[10px] text-gray-500">Filter:</span>
                            <select
                                value={selectedMember}
                                onChange={(e) => setSelectedMember(e.target.value)}
                                className="text-[10px] border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-0.5 px-1"
                            >
                                <option value="all">All Team</option>
                                {teamMembers.map(member => (
                                    <option key={member._id} value={member._id}>{member.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={monthlyPerformance}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCompactCurrency} />
                                <Tooltip
                                    cursor={false}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white p-2 border border-gray-200 shadow-lg rounded-lg text-xs">
                                                    <p className="font-bold text-gray-800 mb-1">{label}</p>
                                                    <p className="text-blue-600 font-semibold">Revenue: {formatCurrency(data.revenue)}</p>
                                                    <p className="text-gray-600 mt-1">Count: {data.revenueCount || 0} Opportunities</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                <Line type="monotone" dataKey="revenue" name="Total Revenue" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Document Modal */}
            {
                showDocumentModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
                            <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                                <h2 className="text-xl font-bold text-gray-800">Document Status Overview</h2>
                                <button onClick={() => setShowDocumentModal(false)} className="text-gray-500 hover:text-gray-700">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="overflow-auto p-3 sm:p-6 flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="py-3 px-4 font-semibold text-gray-600">Opportunity ID</th>
                                            <th className="py-3 px-4 font-semibold text-gray-600">Client</th>
                                            <th className="py-3 px-4 font-semibold text-gray-600">Created By</th>
                                            <th className="py-3 px-4 font-semibold text-gray-600 text-center">PO Status</th>
                                            <th className="py-3 px-4 font-semibold text-gray-600 text-center">Invoice Status</th>
                                            <th className="py-3 px-4 font-semibold text-gray-600">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teamOpportunities.map(opp => (
                                            <tr key={opp._id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 font-mono text-brand-blue">{opp.opportunityNumber}</td>
                                                <td className="py-3 px-4 text-gray-800">{opp.clientName}</td>
                                                <td className="py-3 px-4 text-gray-600 text-sm">{opp.createdBy?.name || 'N/A'}</td>
                                                <td className="py-3 px-4 text-center">
                                                    {opp.poDocument ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                                            <Check size={12} className="mr-1" /> Uploaded
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                                            Pending
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {opp.invoiceDocument ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                                            <Check size={12} className="mr-1" /> Uploaded
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                                            Pending
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <a href={`/opportunities/${opp._id}`} className="text-brand-blue hover:underline text-sm">
                                                        View
                                                    </a>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }
            <AlertModal
                isOpen={alertConfig.isOpen}
                onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                title={alertConfig.title}
                message={alertConfig.message}
                onConfirm={alertConfig.onConfirm}
                confirmText={alertConfig.confirmText}
                type={alertConfig.type}
            />
        </div >
    );
};

export default SalesManagerTeamView;
