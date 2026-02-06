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

    // Get user initials for avatar
    const getUserInitials = () => {
        if (!user?.name) return 'U';
        const names = user.name.split(' ');
        if (names.length >= 2) {
            return names[0][0] + names[1][0];
        }
        return names[0][0];
    };

    return (
        <>
            {/* Sidebar */}
            <div
                className={`
          fixed top-0 left-0 h-screen bg-gradient-to-b from-primary-blue-dark to-primary-blue
          transition-all duration-300 z-40 flex flex-col shadow-2xl overflow-hidden
          ${isCollapsed ? 'w-20' : 'w-72'}
        `}
            >
                {/* User Profile Section */}
                {!isCollapsed && (
                    <div className="p-6 text-center border-b border-white/10 whitespace-nowrap">
                        {/* Avatar */}
                        <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-accent-yellow flex items-center justify-center text-primary-blue-dark font-bold text-2xl shadow-lg">
                            {getUserInitials()}
                        </div>
                        {/* User Name */}
                        <h3 className="text-white font-bold text-lg mb-1">{user?.name || 'User'}</h3>
                        {/* User Email */}
                        <p className="text-white/70 text-sm mb-3">{user?.email || 'user@example.com'}</p>
                        {/* Role Badge */}
                        <span className="inline-block px-3 py-1 bg-accent-yellow text-primary-blue-dark text-xs font-semibold rounded-full">
                            {user?.role || 'Role'}
                        </span>
                    </div>
                )}

                {/* Collapsed Avatar */}
                {isCollapsed && (
                    <div className="p-4 flex justify-center border-b border-white/10">
                        <div className="w-12 h-12 rounded-full bg-accent-yellow flex items-center justify-center text-primary-blue-dark font-bold text-lg shadow-lg">
                            {getUserInitials()}
                        </div>
                    </div>
                )}

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

                {/* Collapse Toggle */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="mx-4 mt-2 mb-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center justify-center"
                >
                    {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>

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
