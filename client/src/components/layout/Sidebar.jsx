import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
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

const Sidebar = ({ isMobileOpen = false, onCloseMobile = () => { } }) => {
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



    useEffect(() => {
        onCloseMobile();
        // Close mobile drawer on route change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    return (
        <>
            {/* Mobile Backdrop */}
            {isMobileOpen && (
                <button
                    type="button"
                    className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                    onClick={onCloseMobile}
                    aria-label="Close menu"
                />
            )}

            {/* Sidebar */}
            <div
                className={`
          fixed top-0 left-0 h-screen bg-gradient-to-b from-primary-blue/90 to-black/90 backdrop-blur-xl border-r border-white/20
          transition-all duration-300 z-50 lg:z-40 flex flex-col shadow-2xl overflow-hidden
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
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
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onCloseMobile}
                            className="lg:hidden p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex-shrink-0"
                            aria-label="Close menu"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="hidden lg:flex p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex-shrink-0"
                            aria-label="Toggle collapse"
                        >
                            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        </button>
                    </div>
                </div>



                {/* Navigation Menu */}
                <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-6 ${isCollapsed ? 'px-2.5' : 'px-4'}`}>
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className="block mb-3"
                                style={{ textDecoration: 'none' }}
                            >
                                <StyledWrapper>
                                    <div className={`button ${active ? 'active' : ''} ${isCollapsed ? 'justify-center px-2 py-3' : ''}`}>
                                        <div className="inner-press" />
                                        <Icon
                                            size={isCollapsed ? 20 : 20}
                                            strokeWidth={isCollapsed ? 2.2 : 2}
                                            className={`relative z-10 shrink-0 transition-colors duration-300 ${active ? 'text-white' : 'text-white/95'}`}
                                        />

                                        {!isCollapsed && (
                                            <span className="ml-3 font-medium truncate relative z-10 text-sm">
                                                {item.label}
                                            </span>
                                        )}

                                        {!isCollapsed && active && (
                                            <ChevronRight size={16} className="ml-auto text-white/80 relative z-10" />
                                        )}
                                    </div>
                                </StyledWrapper>
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
            <div className={`${isCollapsed ? 'lg:w-20' : 'lg:w-72'} transition-all duration-300 flex-shrink-0 hidden lg:block`}></div>
        </>
    );
};

const StyledWrapper = styled.div`
  /* Ensures the link fills the width */
  width: 100%;

  .button {
    /* Use 100% width to fill sidebar container instead of fixed min-width */
    width: 100%;
    min-height: 42px;
    
    /* Layout */
    display: flex;
    align-items: center;
    position: relative;
    cursor: pointer;

    padding: 6px 17px;
    border: 0;
    border-radius: 7px;

    /* Base Styles */
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.03) 100%
    );
    backdrop-filter: blur(4px); /* Adds glass effect */

    color: rgb(255, 255, 255, 0.75); /* Slightly brighter text for better contrast */

    transition: all 1s cubic-bezier(0.15, 0.83, 0.66, 1);
    overflow: hidden;
  }

  /* Active State Styling */
  .button.active {
    color: rgb(255, 255, 255, 1);
    transform: scale(1.05);
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.2) 0%,
      rgba(255, 255, 255, 0.08) 100%
    ); /* Brighter glass for active state */
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3), 0 0 15px rgba(255, 255, 255, 0.1);
  }

  .button.active::before {
    opacity: 1;
  }

  .button::before {
    content: "";
    width: 70%;
    height: 1px;

    position: absolute;
    bottom: 0;
    left: 15%;

    background: rgb(255, 255, 255);
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 1) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    opacity: 0.2;

    transition: all 1s cubic-bezier(0.15, 0.83, 0.66, 1);
  }

  /* Frutiger-style moving sheen layer (keeps existing colors) */
  .button::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(-65deg, rgba(255, 255, 255, 0) 40%, rgba(255, 255, 255, 0.45) 50%, rgba(255, 255, 255, 0) 70%);
    background-size: 200% 100%;
    background-repeat: no-repeat;
    animation: sidebarShine 3s ease infinite;
    z-index: 1;
  }

  /* Inner pressed depth on click */
  .button .inner-press {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    box-shadow: inset 0 2px 8px -2px rgba(0, 0, 0, 0);
    transition: all 0.3s ease;
    z-index: 1;
  }

  .button:active .inner-press {
    box-shadow: inset 0 2px 8px -2px rgba(0, 0, 0, 0.65);
  }

  @keyframes sidebarShine {
    0% {
      background-position: 130%;
      opacity: 1;
    }
    100% {
      background-position: -166%;
      opacity: 0;
    }
  }

  .button:hover {
    color: rgb(255, 255, 255, 1);
    transform: scale(1.05) translateY(-3px); /* Adjusted scale for sidebar context */
    z-index: 10;
  }

  .button:hover::before {
    opacity: 1;
  }
`;

export default Sidebar;


