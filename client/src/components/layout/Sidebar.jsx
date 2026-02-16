import React, { useEffect, useState } from 'react';
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
    CreditCard,
    Settings
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
    const [avatarUrl, setAvatarUrl] = useState('');
    const settingsKey = `app_settings_v2:${String(user?.id || user?.email || user?.name || 'anonymous').toLowerCase()}`;

    useEffect(() => {
        const loadAvatar = () => {
            try {
                const raw = localStorage.getItem(settingsKey);
                if (!raw) {
                    setAvatarUrl('');
                    return;
                }
                const parsed = JSON.parse(raw);
                setAvatarUrl(parsed?.profile?.avatarDataUrl || '');
            } catch {
                setAvatarUrl('');
            }
        };

        loadAvatar();
        window.addEventListener('settings-updated', loadAvatar);
        window.addEventListener('storage', loadAvatar);
        return () => {
            window.removeEventListener('settings-updated', loadAvatar);
            window.removeEventListener('storage', loadAvatar);
        };
    }, [settingsKey]);

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
                { label: 'Opportunities', icon: Briefcase, path: '/opportunities' },
                { label: 'Settings', icon: Settings, path: '/settings' }
            ];
        }

        // Sales Manager: Dashboard, Client, Team Opportunities, Approvals
        if (user.role === 'Sales Manager') {
            return [
                { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/manager' },
                { label: 'Client', icon: Users, path: '/clients' },
                { label: 'Team Opportunities', icon: Briefcase, path: '/opportunities' },
                { label: 'Approvals', icon: FileText, path: '/approvals' },
                { label: 'Settings', icon: Settings, path: '/settings' }
            ];
        }

        // Delivery Team: Dashboard, Vendors, SME Management, Opportunities
        if (user.role === 'Delivery Team') {
            return [
                { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/delivery' },
                { label: 'SME Management', icon: Users, path: '/smes' },
                { label: 'Opportunities', icon: Package, path: '/opportunities' },
                { label: 'Settings', icon: Settings, path: '/settings' }
            ];
        }

        // Finance Role
        if (user.role === 'Finance') {
            return [
                { label: 'Dashboard', icon: LayoutDashboard, path: '/finance/dashboard' },
                { label: 'Finance', icon: CreditCard, path: '/finance' },
                { label: 'Settings', icon: Settings, path: '/settings' }
            ];
        }

        // Business Head: Dashboard, Client, Opportunities, Approvals
        if (user.role === 'Business Head') {
            return [
                { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/businesshead' },
                { label: 'Client', icon: Users, path: '/clients' },
                { label: 'Opportunities', icon: Briefcase, path: '/opportunities' },
                { label: 'Approvals', icon: FileText, path: '/approvals' },
                { label: 'Settings', icon: Settings, path: '/settings' }
            ];
        }

        // Director: Dashboard, Client, Opportunities, Approvals
        if (user.role === 'Director') {
            return [
                { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/director' },
                { label: 'Client', icon: Users, path: '/clients' },
                { label: 'Opportunities', icon: Briefcase, path: '/opportunities' },
                { label: 'Approvals', icon: FileText, path: '/approvals' },
                { label: 'Settings', icon: Settings, path: '/settings' }
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
          fixed top-0 left-0 h-screen bg-gradient-to-b from-primary-blue/90 to-black/90 backdrop-blur-xl border-r border-white/20
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
                            <div className="mr-3 w-11 h-11 rounded-md overflow-hidden border border-white/20 bg-white/10 flex items-center justify-center shrink-0">
                                {avatarUrl ? (
                                    <img
                                        src={avatarUrl}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <img
                                        src="/profile-default.svg"
                                        alt="Logo"
                                        className="w-full h-full object-contain p-1 drop-shadow-lg"
                                    />
                                )}
                            </div>
                            <div className="flex-1 overflow-hidden mr-3">
                                <h3 className="text-white font-bold text-sm truncate">{user?.name || 'User'}</h3>
                                <p className="text-white text-xs truncate">{user?.role || 'Role'}</p>
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
                                className="relative block mb-3 group"
                                style={{ textDecoration: 'none' }}
                            >
                                {/* Shadow Layer */}
                                <span
                                    className="absolute inset-0 bg-black/25 rounded-lg transition-transform duration-300 ease-out group-hover:translate-y-1 group-active:translate-y-0.5"
                                    style={{ transform: 'translateY(2px)' }}
                                />

                                {/* Edge Layer */}
                                <span
                                    className="absolute inset-0 rounded-lg"
                                    style={{
                                        background: active
                                            ? 'linear-gradient(to left, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 1) 8%, rgba(255, 255, 255, 1) 92%, rgba(255, 255, 255, 0.9) 100%)'
                                            : 'linear-gradient(to left, hsl(217, 33%, 16%) 0%, hsl(217, 33%, 32%) 8%, hsl(217, 33%, 32%) 92%, hsl(217, 33%, 16%) 100%)'
                                    }}
                                />

                                {/* Front Layer */}
                                <div
                                    className={`
                                        relative flex items-center space-x-3 px-4 py-3 rounded-lg
                                        transition-transform duration-300 ease-out
                                        group-hover:-translate-y-1.5 group-active:-translate-y-0.5
                                        whitespace-nowrap overflow-hidden
                                        ${active
                                            ? 'bg-white text-primary-blue-dark shadow-2xl'
                                            : 'bg-primary-blue-dark/80 text-white'
                                        }
                                    `}
                                    style={{ transform: 'translateY(-4px)' }}
                                >
                                    {/* Simple shine effect for active state */}
                                    {active && (
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-transparent pointer-events-none" />
                                    )}
                                    <Icon size={20} className={active ? 'text-primary-blue-dark relative z-10' : 'text-white'} />
                                    {!isCollapsed && (
                                        <span className={`flex-1 font-medium select-none ${active ? 'relative z-10' : ''}`}>{item.label}</span>
                                    )}
                                    {!isCollapsed && active && <ChevronRight size={16} className="text-primary-blue-dark relative z-10" />}
                                </div>
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


