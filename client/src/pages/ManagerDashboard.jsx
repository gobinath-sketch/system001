import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Briefcase, Activity, CheckCircle, Clock, AlertCircle, Grid, Target } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SetTargetModal from '../components/dashboard/SetTargetModal';
import DocumentTracking from '../components/dashboard/DocumentTracking';

const ManagerDashboard = ({ user: userProp }) => {
    const navigate = useNavigate();
    const { user: authUser } = useAuth();
    const user = userProp || authUser;
    const [stats, setStats] = useState(null);
    const [teamPerformance, setTeamPerformance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeline, setTimeline] = useState('Yearly');
    const [showTargetModal, setShowTargetModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState('all'); // 'all' or userId

    useEffect(() => {
        fetchDashboardData();
    }, [timeline]);

    const fetchDashboardData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const statsRes = await axios.get('http://localhost:5000/api/dashboard/manager/stats', { headers });
            setStats(statsRes.data);

            const perfRes = await axios.get(`http://localhost:5000/api/dashboard/manager/team-performance?timeline=${timeline}`, { headers });
            setTeamPerformance(perfRes.data);

            setLoading(false);
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            setLoading(false);
        }
    };

    // Get chart data based on selected employee
    const getChartData = () => {
        if (selectedEmployee === 'all') {
            // Aggregate all team members
            const totalTarget = teamPerformance.reduce((sum, member) => sum + member.target, 0);
            const totalAchieved = teamPerformance.reduce((sum, member) => sum + member.achieved, 0);
            return [{ name: 'Team Total', target: totalTarget, achieved: totalAchieved }];
        } else {
            // Show specific employee
            return teamPerformance.filter(member => member.userId === selectedEmployee);
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

    const StatCard = ({ title, value, icon: Icon, bgColor, iconColor, subtext, onClick }) => (
        <div
            onClick={onClick}
            style={glassCardStyle}
            className={`p-6 flex items-center space-x-4 ${onClick ? 'cursor-pointer hover:shadow-[0_8px_32px_0_rgba(255,255,255,0.3)] transition-all' : ''}`}
        >
            <div className={`p-3 rounded-full ${bgColor} flex items-center justify-center`}>
                {Icon && <Icon size={24} className={iconColor} />}
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">{title}</p>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
                {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
            </div>
        </div>
    );

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;

    // Chart Theme Colors
    const brandBlue = '#1e40af';      // blue (achieved)
    const brandYellow = '#FCD34D';    // yellow (target)

    return (
        <div className="p-6 space-y-8 bg-bg-page h-full">
            {/* Header */}
            {/* Header Removed */}

            {/* 1. KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Clients */}
                <StatCard
                    title="Total Clients"
                    value={stats?.totalClients || 0}
                    icon={Grid}
                    bgColor="bg-blue-100"
                    iconColor="text-blue-600"
                    subtext="Handled by team"
                    onClick={() => navigate('/clients')}
                />

                {/* Split Opportunity Card */}
                <div style={glassCardStyle} className="p-6 flex flex-col justify-center">
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="p-2 rounded-full bg-purple-100">
                            <Briefcase size={20} className="text-purple-600" />
                        </div>
                        <span className="text-sm text-gray-500 font-medium">Total Opportunities</span>
                    </div>
                    <div className="flex items-center justify-between mt-2 px-2">
                        <div className="text-center">
                            <p className="text-xl font-bold text-yellow-600">{stats?.inProgressOpportunities || 0}</p>
                            <p className="text-xs text-gray-400">In Progress</p>
                        </div>
                        <div className="h-8 w-px bg-gray-200"></div>
                        <div className="text-center">
                            <p className="text-xl font-bold text-green-600">{stats?.completedOpportunities || 0}</p>
                            <p className="text-xs text-gray-400">Completed</p>
                        </div>
                    </div>
                </div>

                {/* Team Members */}
                <StatCard
                    title="Team Members"
                    value={stats?.teamMembersCount || 0}
                    icon={Users}
                    bgColor="bg-green-100"
                    iconColor="text-green-600"
                    subtext="Sales Executives"
                />
            </div>

            {/* 2. Team Performance Section */}
            <div style={glassCardStyle} className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800">Team Performance</h3>
                    <div className="flex gap-3">
                        <select
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                            <option value="all">All Team Members</option>
                            {teamPerformance.map((member) => (
                                <option key={member.userId} value={member.userId}>
                                    {member.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={timeline}
                            onChange={(e) => setTimeline(e.target.value)}
                            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                            <option value="Yearly">Yearly</option>
                            <option value="Half-Yearly">Half-Yearly</option>
                            <option value="Quarterly">Quarterly</option>
                        </select>
                    </div>
                </div>

                {/* Side-by-side layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Chart (2/3 width) */}
                    <div className="lg:col-span-2">
                        <h4 className="text-md font-semibold text-gray-700 mb-4">Achieved vs Target</h4>
                        <div style={{ width: '100%', height: '350px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={selectedEmployee === 'all' ? teamPerformance : teamPerformance.filter(m => m.userId === selectedEmployee)}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="name"
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                    />
                                    <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                                    <Tooltip cursor={false} formatter={(value) => `₹${value.toLocaleString()}`} />
                                    <Legend />
                                    <Bar dataKey="target" name="Target" fill="#FCD34D" />
                                    <Bar dataKey="achieved" name="Achieved" fill="#1E40AF" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Right: Set Target Panel (1/3 width) */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <h4 className="text-md font-semibold text-gray-700 mb-4">Set Target</h4>
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Assign revenue targets to your team members to track their performance.
                            </p>

                            <button
                                onClick={() => setShowTargetModal(true)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-blue text-white rounded-md hover:bg-blue-700 transition-colors"
                            >
                                <Target size={18} />
                                Set New Target
                            </button>

                            {/* Quick Stats */}
                            <div className="pt-4 border-t border-gray-300 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Team Members:</span>
                                    <span className="font-semibold text-gray-800">{teamPerformance.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Total Target:</span>
                                    <span className="font-semibold text-yellow-600">
                                        ₹{teamPerformance.reduce((sum, m) => sum + m.target, 0).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Total Achieved:</span>
                                    <span className="font-semibold text-blue-600">
                                        ₹{teamPerformance.reduce((sum, m) => sum + m.achieved, 0).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm pt-2 border-t border-gray-300">
                                    <span className="text-gray-600">Team Achievement:</span>
                                    <span className={`font-bold ${(teamPerformance.reduce((sum, m) => sum + m.achieved, 0) /
                                        teamPerformance.reduce((sum, m) => sum + m.target, 0) * 100) >= 100
                                        ? 'text-green-600'
                                        : 'text-gray-800'
                                        }`}>
                                        {((teamPerformance.reduce((sum, m) => sum + m.achieved, 0) /
                                            teamPerformance.reduce((sum, m) => sum + m.target, 0) * 100) || 0).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Document Tracking Section */}
            <DocumentTracking />

            {/* Set Target Modal */}
            {showTargetModal && (
                <SetTargetModal
                    onClose={() => setShowTargetModal(false)}
                    onSuccess={() => {
                        setShowTargetModal(false);
                        fetchDashboardData();
                    }}
                />
            )}
        </div>
    );
};

export default ManagerDashboard;
