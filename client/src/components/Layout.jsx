import { useState } from 'react';
import Sidebar from './layout/Sidebar';
import NotificationDropdown from './notifications/NotificationDropdown';
import RealisticToggle from './common/RealisticToggle';
import { useCurrency } from '../context/CurrencyContext';
import { Menu } from 'lucide-react';
const Layout = ({
  children
}) => {
  const {
    currency,
    setCurrency
  } = useCurrency();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  return <div className="flex h-screen min-h-screen bg-bg-page overflow-hidden">
            {/* New Sidebar */}
            <Sidebar isMobileOpen={isMobileSidebarOpen} onCloseMobile={() => setIsMobileSidebarOpen(false)} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Top Header Bar - Compact for 100% zoom */}
                <header className="h-16 bg-bg-card shadow-sm flex items-center justify-between px-3 sm:px-6 border-b border-gray-200">
                    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                        <button type="button" onClick={() => setIsMobileSidebarOpen(true)} className="lg:hidden p-2 rounded-md text-gray-600 hover:text-primary-blue hover:bg-gray-100 transition-colors" aria-label="Open menu">
                            <Menu size={20} />
                        </button>
                        {/* Globe Logo */}
                        <img src="/gk-globe-logo.png" alt="Global Knowledge" className="h-8 w-8 sm:h-10 sm:w-10 object-contain shrink-0" />
                        {/* Company Name */}
                        <h1 className="text-sm sm:text-lg font-bold text-primary-blue truncate">
                            Global Knowledge Technologies
                        </h1>
                    </div>

                    {/* User Actions */}
                    <div className="flex items-center space-x-1 sm:space-x-2">
                        {/* Portal Target for Page-Specific Filters */}
                        <div id="header-filter-portal" className="mr-2 sm:mr-4 font-normal hidden sm:block"></div>

                        {/* Global Currency Toggle */}
                        <div className="mr-1 sm:mr-4">
                            <RealisticToggle checked={currency === 'USD'} onChange={isChecked => setCurrency(isChecked ? 'USD' : 'INR')} />
                        </div>

                        {/* Notification Bell */}
                        <NotificationDropdown />

                        {/* Logout Button Removed (Moved to Sidebar) */}
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 bg-bg-page">
                    {children}
                </main>
            </div>
        </div>;
};
export default Layout;