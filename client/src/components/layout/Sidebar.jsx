import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Users, Briefcase, Package, FileText, ChevronLeft, ChevronRight, CreditCard, Settings } from 'lucide-react';
import LogoutButton from '../common/LogoutButton';
const Sidebar = ({
  isMobileOpen = false,
  onCloseMobile = () => {}
}) => {
  const {
    user,
    logout
  } = useAuth();
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
      return [{
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/dashboard/executive'
      }, {
        label: 'Client',
        icon: Users,
        path: '/clients'
      }, {
        label: 'Opportunities',
        icon: Briefcase,
        path: '/opportunities'
      }, {
        label: 'Settings',
        icon: Settings,
        path: '/settings'
      }];
    }

    // Sales Manager: Dashboard, Client, Team Opportunities, Approvals
    if (user.role === 'Sales Manager') {
      return [{
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/dashboard/manager'
      }, {
        label: 'Client',
        icon: Users,
        path: '/clients'
      }, {
        label: 'Team Opportunities',
        icon: Briefcase,
        path: '/opportunities'
      }, {
        label: 'Approvals',
        icon: FileText,
        path: '/approvals'
      }, {
        label: 'Settings',
        icon: Settings,
        path: '/settings'
      }];
    }

    // Delivery Team: Dashboard, Vendors, SME Management, Opportunities
    if (user.role === 'Delivery Team') {
      return [{
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/dashboard/delivery'
      }, {
        label: 'SME Management',
        icon: Users,
        path: '/smes'
      }, {
        label: 'Opportunities',
        icon: Package,
        path: '/opportunities'
      }, {
        label: 'Settings',
        icon: Settings,
        path: '/settings'
      }];
    }

    // Finance Role
    if (user.role === 'Finance') {
      return [{
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/finance/dashboard'
      }, {
        label: 'Finance',
        icon: CreditCard,
        path: '/finance'
      }, {
        label: 'Settings',
        icon: Settings,
        path: '/settings'
      }];
    }

    // Business Head: Dashboard, Client, Opportunities, Approvals
    if (user.role === 'Business Head') {
      return [{
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/dashboard/businesshead'
      }, {
        label: 'Client',
        icon: Users,
        path: '/clients'
      }, {
        label: 'Opportunities',
        icon: Briefcase,
        path: '/opportunities'
      }, {
        label: 'Approvals',
        icon: FileText,
        path: '/approvals'
      }, {
        label: 'Settings',
        icon: Settings,
        path: '/settings'
      }];
    }

    // Director: Dashboard, Client, Opportunities, Approvals
    if (user.role === 'Director') {
      return [{
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/dashboard/director'
      }, {
        label: 'Client',
        icon: Users,
        path: '/clients'
      }, {
        label: 'Opportunities',
        icon: Briefcase,
        path: '/opportunities'
      }, {
        label: 'Approvals',
        icon: FileText,
        path: '/approvals'
      }, {
        label: 'Settings',
        icon: Settings,
        path: '/settings'
      }];
    }
    return [];
  };
  const menuItems = getMenuItems();
  const isActive = path => {
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
  return <>
            {/* Mobile Backdrop */}
            {isMobileOpen && <button type="button" className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onCloseMobile} aria-label="Close menu" />}

            {/* Sidebar */}
            <div className={`
          fixed top-0 left-0 h-screen min-h-screen bg-[linear-gradient(165deg,#0b4a8a_0%,#0a3b72_46%,#082f5c_100%)] border-r border-[#5ea2df]/35
          transition-all duration-300 z-50 lg:z-40 flex flex-col shadow-2xl overflow-hidden
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          ${isCollapsed ? 'w-20' : 'w-72'}
        `}>
                {/* Glass Shine Effect */}
                <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_10%_0%,rgba(147,203,255,0.22)_0%,rgba(147,203,255,0)_45%)] pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(100%_70%_at_80%_100%,rgba(7,26,54,0.45)_0%,rgba(7,26,54,0)_55%)] pointer-events-none" />
                {/* Header - User & Toggle */}
                <div className={`flex items-center p-4 border-b border-white/10 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                    {!isCollapsed && <>
                            <div className="mr-3 w-11 h-11 rounded-md overflow-hidden border border-white/20 bg-white/10 flex items-center justify-center shrink-0">
                                {avatarUrl ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" /> : <img src="/profile-default.svg" alt="Logo" className="w-full h-full object-contain p-1 drop-shadow-lg" />}
                            </div>
                            <div className="flex-1 overflow-hidden mr-3">
                                <h3 className="text-white font-bold text-sm truncate">{user?.name || 'User'}</h3>
                                <p className="text-white text-xs truncate">{user?.role || 'Role'}</p>
                            </div>
                        </>}
                    <div className="flex items-center gap-2">
                        <button onClick={onCloseMobile} className="lg:hidden p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex-shrink-0" aria-label="Close menu">
                            <ChevronLeft size={18} />
                        </button>
                        <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden lg:flex p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex-shrink-0" aria-label="Toggle collapse">
                            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        </button>
                    </div>
                </div>



                {/* Navigation Menu */}
                <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-6 ${isCollapsed ? 'px-2.5' : 'px-4'}`}>
                    {menuItems.map(item => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return <Link key={item.path} to={item.path} className="block mb-3" style={{
            textDecoration: 'none'
          }}>
                                <StyledWrapper>
                                    <div className={`button ${active ? 'active' : ''} ${isCollapsed ? 'justify-center px-2 py-3' : ''}`}>
                                        <div className="inner-press" />
                                        <Icon size={isCollapsed ? 20 : 20} strokeWidth={isCollapsed ? 2.2 : 2} className={`relative z-10 shrink-0 transition-colors duration-300 ${active ? 'text-white' : 'text-white/95'}`} />

                                        {!isCollapsed && <span className="ml-3 font-medium truncate relative z-10 text-sm">
                                                {item.label}
                                            </span>}

                                    </div>
                                </StyledWrapper>
                            </Link>;
        })}
                </nav>



                {/* Logout Button */}
                <div className="w-full mb-6 flex justify-center">
                    <LogoutButton onClick={handleLogout} isCollapsed={isCollapsed} />
                </div>
            </div>

            {/* Spacer for content */}
            <div className={`${isCollapsed ? 'lg:w-20' : 'lg:w-72'} transition-all duration-300 flex-shrink-0 hidden lg:block`}></div>
        </>;
};
const StyledWrapper = styled.div`
  width: 100%;

  .button {
    width: 100%;
    min-height: 44px;
    display: flex;
    align-items: center;
    position: relative;
    cursor: pointer;
    padding: 7px 16px;
    border-radius: 12px;
    border: 1px solid rgba(74, 140, 205, 0.55);
    background: linear-gradient(
      180deg,
      rgba(41, 107, 177, 0.94) 0%,
      rgba(20, 74, 134, 0.96) 100%
    );
    box-shadow:
      0 1px 3px rgba(0, 24, 54, 0.46),
      inset 0 1px 0 rgba(108, 173, 237, 0.28),
      inset 0 -1px 0 rgba(2, 23, 48, 0.46);
    color: rgb(255 255 255 / 0.95);
    transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.2s ease;
    overflow: hidden;
  }

  .button::before {
    content: "";
    position: absolute;
    inset: 4px;
    border-radius: 8px;
    background: linear-gradient(
      180deg,
      rgba(56, 126, 197, 0.52) 0%,
      rgba(24, 83, 145, 0.54) 100%
    );
    box-shadow: none;
    pointer-events: none;
    z-index: 0;
  }

  .button .inner-press {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    box-shadow: inset 0 2px 8px -2px rgba(0, 0, 0, 0);
    transition: all 0.3s ease;
    z-index: 1;
  }

  .button:hover {
    transform: translateY(-1px);
    box-shadow:
      0 6px 14px rgba(0, 37, 77, 0.42),
      inset 0 1px 0 rgba(122, 189, 247, 0.34),
      inset 0 -1px 0 rgba(3, 31, 61, 0.28);
  }

  .button:active {
    transform: scale(0.995);
    box-shadow:
      0 0px 1px rgba(0, 24, 54, 0.45),
      inset 0 2px 7px rgba(1, 26, 54, 0.55),
      inset 0 1px 0 rgba(93, 160, 223, 0.22);
  }

  .button:active .inner-press {
    box-shadow: inset 0 2px 8px -2px rgba(0, 0, 0, 0.65);
  }

  .button.active {
    border-color: rgba(96, 168, 236, 0.78);
    background: linear-gradient(
      180deg,
      rgba(52, 129, 206, 0.98) 0%,
      rgba(22, 88, 160, 0.98) 100%
    );
    box-shadow:
      0 8px 16px rgba(0, 34, 70, 0.4),
      inset 0 1px 0 rgba(112, 183, 246, 0.36),
      inset 0 -1px 0 rgba(5, 40, 76, 0.28);
  }
`;
export default Sidebar;