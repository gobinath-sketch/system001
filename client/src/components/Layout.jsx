import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './layout/Sidebar';
import NotificationDropdown from './notifications/NotificationDropdown';
import RealisticToggle from './common/RealisticToggle';
import { useCurrency } from '../context/CurrencyContext';

const Layout = ({ children }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { currency, setCurrency } = useCurrency();

    return (
        <div className="flex h-screen bg-bg-page">
            {/* New Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header Bar - Compact for 100% zoom */}
                <header className="h-16 bg-bg-card shadow-sm flex items-center justify-between px-6 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        {/* Globe Logo */}
                        <img
                            src="/gk-globe-logo.png"
                            alt="Global Knowledge"
                            className="h-10 w-10 object-contain"
                        />
                        {/* Company Name */}
                        <h1 className="text-lg font-bold text-primary-blue">
                            Global Knowledge Technologies
                        </h1>
                    </div>

                    {/* User Actions */}
                    <div className="flex items-center space-x-2">
                        {/* Global Currency Toggle */}
                        <div className="mr-4">
                            <RealisticToggle
                                checked={currency === 'USD'}
                                onChange={(isChecked) => setCurrency(isChecked ? 'USD' : 'INR')}
                            />
                        </div>

                        {/* Notification Bell */}
                        <NotificationDropdown />

                        {/* Logout Button Removed (Moved to Sidebar) */}
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;
