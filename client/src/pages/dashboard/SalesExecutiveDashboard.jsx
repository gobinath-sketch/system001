import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Briefcase, CheckCircle, CircleDollarSign, IndianRupee, Target, ChevronRight } from 'lucide-react';
import DocumentStatusCard from '../../components/dashboard/DocumentStatusCard';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ComposedChart, Line, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import RevenueAnalyticsRow from './RevenueAnalyticsRow';
import { useCurrency } from '../../context/CurrencyContext';


const SalesExecutiveDashboard = ({ user }) => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [clientHealth, setClientHealth] = useState({ active: 0, mid: 0, inactive: 0 });
    const [performance, setPerformance] = useState(null);
    const [monthlyTrends, setMonthlyTrends] = useState([]);
    const [allOpps, setAllOpps] = useState([]); // For Document Status Modal
    const [loading, setLoading] = useState(true);
    const { currency } = useCurrency();
    const [showDocModal, setShowDocModal] = useState(false);

    // New State for Analytics
    const [activeFilter, setActiveFilter] = useState('overview'); // 'overview', 'opportunities', 'sectors', 'revenue'
    const [analyticsData, setAnalyticsData] = useState({
        typeDist: [],
        sectorDist: [],
        yearlyTrends: []
    });

    const EXCHANGE_RATE = 85; // Fixed rate for now
    const OPPORTUNITY_TYPES = ['Training', 'Product Support', 'Resource Support', 'Vouchers', 'Content Development', 'Lab Support'];

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = { Authorization: `Bearer ${token} ` };

                const statsRes = await axios.get('http://localhost:5000/api/dashboard/stats', { headers });
                setStats(statsRes.data);

                const perfRes = await axios.get(`http://localhost:5000/api/dashboard/performance/${user.id}`, { headers });
                setPerformance(perfRes.data);

                const trendsRes = await axios.get('http://localhost:5000/api/dashboard/monthly-trends', { headers });
                setMonthlyTrends(trendsRes.data);

                // Fetch all opps for document status card and top 5 clients
                const docsRes = await axios.get('http://localhost:5000/api/dashboard/all-opportunities', { headers });
                setAllOpps(docsRes.data);

                // Fetch client health metrics
                const healthRes = await axios.get('http://localhost:5000/api/dashboard/client-health', { headers });
                setClientHealth(healthRes.data);

                // Fetch Analytics Data
                const typeRes = await axios.get('http://localhost:5000/api/dashboard/analytics/type-distribution', { headers });
                const sectorRes = await axios.get('http://localhost:5000/api/dashboard/analytics/sector-distribution', { headers });
                const yearlyRes = await axios.get('http://localhost:5000/api/dashboard/analytics/yearly-trends', { headers });

                // Zero-fill Opportunity Types
                const filledTypeData = OPPORTUNITY_TYPES.map(type => {
                    const found = typeRes.data.find(item => item.type === type);
                    return found ? { type, count: found.count, revenue: found.revenue } : { type, count: 0, revenue: 0 };
                });

                setAnalyticsData({
                    typeDist: filledTypeData, // Use filled data
                    sectorDist: sectorRes.data,
                    yearlyTrends: yearlyRes.data
                });

                setLoading(false);
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user.id]);

    // Helper to format money based on selected currency
    const formatMoney = (amountInINR) => {
        if (amountInINR === undefined || amountInINR === null) return '0';

        if (currency === 'INR') {
            return `₹${amountInINR.toLocaleString('en-IN')}`;
        } else {
            const amountInUSD = amountInINR / EXCHANGE_RATE;
            return `$${amountInUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
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

    // Updated StatCard - Compact
    const StatCard = ({ title, value, icon: Icon, bgColor, iconColor, subtext, onClick }) => (
        <div
            onClick={onClick}
            style={glassCardStyle}
            className={`p-4 flex items-center space-x-3 ${onClick ? 'cursor-pointer hover:shadow-[0_8px_32px_0_rgba(255,255,255,0.3)] transition-all' : ''}`}
        >
            <div className={`p-2 rounded-full ${bgColor} flex items-center justify-center`}>
                {Icon && <Icon size={20} className={iconColor} />}
            </div>
            <div>
                <p className="text-xs text-black font-bold">{title}</p>
                <p className="text-lg font-bold text-black">{value}</p>
                {subtext && <p className="text-[10px] text-black font-bold">{subtext}</p>}
            </div>
        </div>
    );

    if (loading) return <div className="p-8 text-center text-black font-bold">Loading Dashboard...</div>;

    // Chart Theme Colors - Brand Colors
    const brandBlue = '#003D7A';
    const brandGreen = '#10b981';
    const brandGold = '#D4AF37';

    // Prepare trend data with currency conversion
    const trendData = monthlyTrends.map(item => ({
        ...item,
        revenue: currency === 'INR' ? item.revenue : (item.revenue / EXCHANGE_RATE)
    }));

    // --- New Progress Card Component - Compact ---
    const ProgressCard = ({ target, achieved, currency }) => {
        const percentage = target > 0 ? (achieved / target) * 100 : 0;
        const period = performance?.period || 'Yearly';
        const diff = achieved - target;
        const isAchieved = percentage >= 100;

        let statusColor = 'bg-red-500'; // Default Red (Under)
        let textColor = 'text-red-600';
        let barColor = 'bg-red-500';

        if (isAchieved) {
            if (percentage > 100) {
                statusColor = 'bg-blue-500';
                textColor = 'text-blue-600';
                barColor = 'bg-blue-500';
            } else {
                statusColor = 'bg-green-500';
                textColor = 'text-green-600';
                barColor = 'bg-green-500';
            }
        }

        return (
            <div style={glassCardStyle} className="p-4 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center space-x-2">
                        <div className={`p-1.5 rounded-full ${isAchieved ? 'bg-green-100' : 'bg-red-100'}`}>
                            {isAchieved ? <CheckCircle size={16} className="text-green-600" /> : <Target size={16} className="text-red-600" />}
                        </div>
                        <div>
                            <p className="text-xs text-black font-bold">Revenue Target</p>
                            <div className="flex items-baseline space-x-2">
                                <h3 className="text-lg font-bold text-black">{formatMoney(achieved)}</h3>
                                {isAchieved && <span className="text-lg">😊</span>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-black font-bold">
                        <span>Progress</span>
                        <span>Target: {formatMoney(target)}</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                            className={`h-2 rounded-full transition-all duration-1000 ${barColor}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                    </div>

                    {/* Status Text */}
                    <div className={`text-[10px] font-bold ${textColor} text-right`}>
                        {isAchieved
                            ? `Exceeded by ${formatMoney(diff)}`
                            : `Lagging by ${formatMoney(Math.abs(diff))}`
                        }
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 pb-4 space-y-4 bg-bg-page h-full">
            {/* Header */}
            {/* Header Removed */}

            {/* 1. KPI Cards - Revenue Target REMOVED */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Client Health Segmentation */}
                <div style={glassCardStyle} className="p-4 flex flex-col justify-center">
                    <div className="flex items-center space-x-2 mb-3">
                        <div className="p-1.5 rounded-full bg-blue-100">
                            <Users size={16} className="text-blue-600" />
                        </div>
                        <span className="text-sm text-black font-bold">Clients (Total: {clientHealth.active + clientHealth.mid + clientHealth.inactive})</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center">
                        <div>
                            <p className="text-2xl font-bold text-green-600">{clientHealth.active}</p>
                            <p className="text-xs text-black font-bold">Active</p>
                        </div>
                        <div className="border-l border-r border-gray-100">
                            <p className="text-2xl font-bold text-yellow-600">{clientHealth.mid}</p>
                            <p className="text-xs text-black font-bold">Mid</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-red-600">{clientHealth.inactive}</p>
                            <p className="text-xs text-black font-bold">Inactive</p>
                        </div>
                    </div>
                </div>

                {/* Total Opportunities */}
                <div style={glassCardStyle} className="p-4 flex flex-col justify-center">
                    <div className="flex items-center space-x-2 mb-3">
                        <div className="p-1.5 rounded-full bg-purple-100">
                            <Briefcase size={16} className="text-purple-600" />
                        </div>
                        <span className="text-sm text-black font-bold">Opportunities</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                        <div>
                            <p className="text-2xl font-bold text-yellow-600">{stats?.inProgressOpportunities || 0}</p>
                            <p className="text-xs text-black font-bold">In Progress</p>
                        </div>
                        <div className="border-l border-gray-100">
                            <p className="text-2xl font-bold text-green-600">{stats?.completedOpportunities || 0}</p>
                            <p className="text-xs text-black font-bold">Completed</p>
                        </div>
                    </div>
                </div>

                {/* Document Status Summary Card */}
                <div style={glassCardStyle} className="p-4 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                            <div className="p-1.5 rounded-full bg-indigo-100">
                                <CheckCircle size={16} className="text-indigo-600" />
                            </div>
                            <span className="text-sm text-black font-bold">Billing</span>
                        </div>
                        <button
                            onClick={() => setShowDocModal(true)}
                            className="px-3 py-1 bg-gray-100 rounded-md text-xs font-bold text-black border border-gray-200 hover:bg-gray-200 transition-colors"
                        >
                            <div className="flex items-center gap-1">
                                <span>View</span>
                                <ChevronRight size={14} />
                            </div>
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <p className="text-2xl font-bold text-black">
                                {allOpps.length}
                            </p>
                            <p className="text-xs text-black font-bold">Total</p>
                        </div>
                        <div className="border-l border-gray-100">
                            <p className="text-2xl font-bold text-blue-600">
                                {allOpps.filter(opp => opp.poDocument).length}
                            </p>
                            <p className="text-xs text-black font-bold">POs</p>
                        </div>
                        <div className="border-l border-gray-100">
                            <p className="text-2xl font-bold text-indigo-600">
                                {allOpps.filter(opp => opp.invoiceDocument).length}
                            </p>
                            <p className="text-xs text-black font-bold">Invoices</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Revenue & Analytics Row - NEW */}
            <RevenueAnalyticsRow
                allOpps={allOpps}
                yearlyTarget={performance?.target || 0}
                currency={currency}
                formatMoney={formatMoney}
                EXCHANGE_RATE={EXCHANGE_RATE}
            />

            {/* 3. Second Analytics Row */}
            <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                    {/* Left: otal Opportunities Ongoing / Completed (Count) */}
                    <div style={glassCardStyle} className="p-4 md:p-5 flex flex-col h-[280px] md:h-[300px]">
                        <h3 className="text-base font-bold text-black mb-3 md:mb-4">Total Opportunities Ongoing / Completed</h3>
                        <div className="flex-1 w-full min-h-[205px]">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={205}>
                                <BarChart data={analyticsData.typeDist} layout="vertical" margin={{ top: 4, right: 20, left: 2, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="type" type="category" width={112} tick={{ fontSize: 12, fill: '#000000', fontWeight: 'bold' }} />
                                    <Tooltip cursor={false} />
                                    <Bar dataKey="count" name="Opportunities" fill={brandBlue} barSize={15} radius={[0, 4, 4, 0]} label={{ position: 'right', fill: brandBlue, fontSize: 10 }} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Right: Top 5 Clients by Revenue (using PO Amount) */}
                    <div style={glassCardStyle} className="p-4 md:p-5 flex flex-col h-[280px] md:h-[300px]">
                        <h3 className="text-sm font-bold text-black mb-3 md:mb-4">Top 5 Clients by Revenue</h3>
                        <div className="flex-1 overflow-hidden">
                            {(() => {
                                // Calculate top 5 clients using PO Amount (poValue)
                                const clientMap = {};
                                allOpps.forEach(opp => {
                                    const cName = opp.clientName || 'Unknown';
                                    const revenue = opp.poValue || 0;
                                    clientMap[cName] = (clientMap[cName] || 0) + revenue;
                                });

                                const topClients = Object.entries(clientMap)
                                    .map(([name, revenue]) => ({ name, revenue }))
                                    .sort((a, b) => b.revenue - a.revenue)
                                    .slice(0, 5);

                                if (topClients.length === 0) {
                                    return (
                                        <div className="flex items-center justify-center h-full text-black font-bold text-sm">
                                            No client data available
                                        </div>
                                    );
                                }

                                const normalizedTopClients = [...topClients];
                                while (normalizedTopClients.length < 5) {
                                    normalizedTopClients.push({
                                        name: 'No client',
                                        revenue: 0,
                                        isPlaceholder: true
                                    });
                                }

                                return (
                                    <div className="h-full grid grid-rows-5 gap-2">
                                        {normalizedTopClients.map((client, index) => (
                                            <div
                                                key={index}
                                                className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors min-h-0 ${client.isPlaceholder ? 'bg-gray-50/60' : 'bg-gray-50 hover:bg-gray-100'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm ${client.isPlaceholder ? 'bg-gray-200 text-black' : 'bg-blue-100 text-blue-700'}`}>
                                                        {index + 1}
                                                    </div>
                                                    <span className={`font-bold text-sm ${client.isPlaceholder ? 'text-black font-bold' : 'text-black font-bold'}`}>
                                                        {client.name}
                                                    </span>
                                                </div>
                                                <span className={`font-bold text-sm ${client.isPlaceholder ? 'text-black font-bold' : 'text-green-600'}`}>
                                                    {client.isPlaceholder ? '-' : formatMoney(client.revenue)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Document Status Modal */}
            {
                showDocModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                                <h2 className="text-xl font-bold text-gray-800">Document Status Overview</h2>
                                <button onClick={() => setShowDocModal(false)} className="text-gray-500 hover:text-gray-700">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <div className="overflow-auto p-6 flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="py-3 px-4 font-semibold text-gray-600">Opportunity ID</th>
                                            <th className="py-3 px-4 font-semibold text-gray-600">Client</th>
                                            <th className="py-3 px-4 font-semibold text-gray-600 text-center">PO Status</th>
                                            <th className="py-3 px-4 font-semibold text-gray-600 text-center">Invoice Status</th>
                                            <th className="py-3 px-4 font-semibold text-gray-600">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allOpps.map(opp => (
                                            <tr key={opp._id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 font-mono text-primary-blue">{opp.opportunityNumber}</td>
                                                <td className="py-3 px-4 text-gray-800">{opp.clientName}</td>
                                                <td className="py-3 px-4 text-center">
                                                    {opp.poDocument ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                                            <CheckCircle size={12} className="mr-1" /> Uploaded
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
                                                            <CheckCircle size={12} className="mr-1" /> Uploaded
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                                            Pending
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <button
                                                        onClick={() => navigate(`/opportunities/${opp._id}`)}
                                                        className="text-primary-blue hover:underline text-sm"
                                                    >
                                                        View
                                                    </button>
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
        </div >
    );
};

export default SalesExecutiveDashboard;

