import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard,
    Users,
    Briefcase,
    Package,
    UserCheck,
    FileText,
    ChevronLeft,
    ChevronRight,
    CreditCard
} from 'lucide-react';

import LogoutButton from '../common/LogoutButton';

const Sidebar = () => {
    const { user, logout } = useAuth();
    // Use useNavigate to redirect after logout if needed, though useAuth usually handles state clearing. 
    // Sidebar didn't have navigate before, so we might need it? 
    // Layout.jsx used navigate('/login'). Sidebar already uses `Link` from react-router-dom, so we can use useNavigate?
    // Wait, Sidebar.jsx imports `useLocation` from 'react-router-dom', but not `useNavigate`.
    // Let's import useNavigate.

    // Oh wait, I can't add imports with this tool easily in the header block unless I target the top.
    // I am targeting lines 16-18. 

    // Let me check the imports first. Line 2 has `useLocation`.
    // I should probably do a separate replace for imports to be safe.

    // For now, let's just add the hook usage here assuming I fix imports in next step.
    const location = useLocation();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Define menu items based on user role
    const getMenuItems = () => {
        if (!user) return [];

        // Sales Executive: Dashboard, Client, Opportunities
        if (user.role === 'Sales Executive') {
            return [
                { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/executive' },
                { label: 'Client', icon: Users, path: '/clients' },
                { label: 'Opportunities', icon: Briefcase, path: '/opportunities' }
            ];
        }

        // Sales Manager: Dashboard, Client, Team Opportunities, Approvals
        if (user.role === 'Sales Manager') {
            return [
                { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/manager' },
                { label: 'Client', icon: Users, path: '/clients' },
                { label: 'Team Opportunities', icon: Briefcase, path: '/opportunities' },
                { label: 'Approvals', icon: FileText, path: '/approvals' }
            ];
        }

        // Delivery Team: Dashboard, Vendors, SME Management, Opportunities
        if (user.role === 'Delivery Team') {
            return [
                { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/delivery' },
                { label: 'SME Management', icon: Users, path: '/smes' },
                { label: 'Opportunities', icon: Package, path: '/opportunities' }
            ];
        }

        // Finance Role
        if (user.role === 'Finance') {
            return [
                { label: 'Dashboard', icon: LayoutDashboard, path: '/finance/dashboard' },
                { label: 'Finance', icon: CreditCard, path: '/finance' }
            ];
        }

        // Director: Dashboard, Client, Opportunities, Approvals
        if (user.role === 'Director') {
            return [
                { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/businesshead' },
                { label: 'Client', icon: Users, path: '/clients' },
                { label: 'Opportunities', icon: Briefcase, path: '/opportunities' },
                { label: 'Approvals', icon: FileText, path: '/approvals' }
            ];
        }

        return [];
    };

    const menuItems = getMenuItems();

    const isActive = (path) => {
        // Strict match for root or specific overlap cases
        if (path === '/' || path === '/finance') {
            return location.pathname === path;
        }
        // Default startsWith for others (like /clients, /opportunities which have detail pages)
        return location.pathname.startsWith(path);
    };



    return (
        <>
            {/* Sidebar */}
            <div
                className={`
          fixed top-0 left-0 h-screen bg-gradient-to-b from-primary-blue-dark/90 to-primary-blue/90 backdrop-blur-xl border-r border-white/20
          transition-all duration-300 z-40 flex flex-col shadow-2xl overflow-hidden
          ${isCollapsed ? 'w-20' : 'w-72'}
        `}
            >
                {/* Glass Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
                <div className="absolute -top-20 -left-20 w-40 h-40 bg-white/20 blur-3xl rounded-full pointer-events-none" />
                {/* Header - User & Toggle */}
                <div className={`flex items-center p-4 border-b border-white/10 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                    {!isCollapsed && (
                        <>
                            <div className="mr-3">
                                <img
                                    src="/gk-globe-logo.png"
                                    alt="Logo"
                                    className="w-10 h-10 object-contain drop-shadow-lg"
                                />
                            </div>
                            <div className="flex-1 overflow-hidden mr-3">
                                <h3 className="text-white font-bold text-sm truncate">{user?.name || 'User'}</h3>
                                <p className="text-white/70 text-xs truncate">{user?.role || 'Role'}</p>
                            </div>
                        </>
                    )}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex-shrink-0"
                    >
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
                </div>



                {/* Navigation Menu */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden py-6 px-4">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`
                  flex items-center space-x-3 px-4 py-3 mb-2 rounded-lg
                  transition-all duration-200 group whitespace-nowrap
                  ${active
                                        ? 'bg-white/20 text-white shadow-md'
                                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                                    }
                `}
                            >
                                <Icon size={20} className={active ? 'text-accent-yellow' : ''} />
                                {!isCollapsed && (
                                    <span className="flex-1 font-medium">{item.label}</span>
                                )}
                                {!isCollapsed && active && <ChevronRight size={16} className="text-accent-yellow" />}
                            </Link>
                        );
                    })}
                </nav>



                {/* Logout Button */}
                <div className="w-full mb-6 flex justify-center">
                    <LogoutButton onClick={handleLogout} isCollapsed={isCollapsed} />
                </div>
            </div>

            {/* Spacer for content */}
            <div className={`${isCollapsed ? 'w-20' : 'w-72'} transition-all duration-300 flex-shrink-0`}></div>
        </>
    );
};

export default Sidebar;
