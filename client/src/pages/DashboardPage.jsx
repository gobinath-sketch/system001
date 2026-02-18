import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Users, Briefcase, Activity, Clock, UserCheck } from 'lucide-react';
import TargetProgress from '../components/dashboard/TargetProgress';
import EscalationWidget from '../components/dashboard/EscalationWidget';

import SalesExecutiveDashboard from './dashboard/SalesExecutiveDashboard';
import ManagerDashboard from './ManagerDashboard';

const DashboardPage = ({ mockRole }) => {
    const { user: authUser, updateUserRole } = useAuth();
    const { socket } = useSocket();
    // Allow mockRole to override authUser for testing
    const user = mockRole ? { ...authUser, role: mockRole } : authUser;

    useEffect(() => {
        // Only update role if. mockRole is explicitly provided
        if (mockRole && authUser?.role !== mockRole && updateUserRole) {
            updateUserRole(mockRole);
        }
    }, [mockRole, user]);

    // Redirect to specialized dashboard
    if (user?.role === 'Sales Executive') {
        return <SalesExecutiveDashboard user={user} />;
    }

    if (user?.role === 'Sales Manager') {
        return <ManagerDashboard user={user} />;
    }

    // Redirect other roles to their specific dashboards
    if (user?.role === 'Business Head') return <Navigate to="/dashboard/businesshead" replace />;
    if (user?.role === 'Director') return <Navigate to="/dashboard/director" replace />;
    if (user?.role === 'Delivery Team') return <Navigate to="/dashboard/delivery" replace />;
    if (user?.role === 'Finance') return <Navigate to="/finance/dashboard" replace />;

    const [stats, setStats] = useState(null);
    const [opportunities, setOpportunities] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');

            // Fetch Stats
            const statsRes = await axios.get('http://localhost:5000/api/dashboard/stats', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(statsRes.data);

            // Fetch Recent Opportunities (Fetch all for Escalation Widget logic, slice for table)
            const oppsRes = await axios.get('http://localhost:5000/api/opportunities', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setOpportunities(oppsRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [mockRole]);

    useEffect(() => {
        if (!socket) return;
        const handleEntityUpdated = (event) => {
            if (['opportunity', 'client', 'user'].includes(event?.entity)) {
                fetchData();
            }
        };
        socket.on('entity_updated', handleEntityUpdated);
        return () => socket.off('entity_updated', handleEntityUpdated);
    }, [socket, mockRole]);

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

    const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
        <div style={glassCardStyle} className="p-6 flex items-center space-x-4">
            <div className={`p-3 rounded-full ${color} bg-opacity-10`}>
                <Icon size={24} className={color.replace('bg-', 'text-')} />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">{title}</p>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
                {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
            </div>
        </div>
    );

    if (loading) return <div className="p-5">Loading dashboard...</div>;

    return (
        <div className="p-5">
            {/* Header Removed */}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Total Clients"
                    value={stats?.totalClients || 0}
                    icon={Users}
                    color="text-blue-600 bg-blue-600"
                    subtext="Assigned to you"
                />
                <StatCard
                    title="Total Opportunities"
                    value={stats?.totalOpportunities || 0}
                    icon={Briefcase}
                    color="text-purple-600 bg-purple-600"
                    subtext="Created by you"
                />
                <StatCard
                    title="Active Opportunities"
                    value={stats?.activeOpportunities || 0}
                    icon={Activity}
                    color="text-green-600 bg-green-600"
                    subtext="In pipeline"
                />
                <StatCard
                    title="Pending Opportunities"
                    value={stats?.pendingOpportunities || 0}
                    icon={Clock}
                    color="text-yellow-600 bg-yellow-600"
                    subtext="Waiting approval"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Target Progress Module */}
                <div className="lg:col-span-2">
                    <TargetProgress userId={user?.id} />
                </div>

                {/* Escalation / GP Monitor */}
                <div>
                    <EscalationWidget
                        opportunities={opportunities}
                        onEscalate={() => window.location.reload()}
                    />
                </div>
            </div>
        </div>
    );
};

DashboardPage.propTypes = {
    mockRole: PropTypes.string
};

export default DashboardPage;

