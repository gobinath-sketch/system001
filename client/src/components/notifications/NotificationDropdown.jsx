import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Check, FileText, DollarSign, Briefcase, X, ArrowLeft, Search, Bell as BellIcon, CheckCheck } from 'lucide-react';
import NotificationBellIcon from '../common/NotificationBellIcon';
import searchIcon from '../../assets/search-square-svgrepo-com.svg';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const NotificationDropdown = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const navigate = useNavigate();
    const { user } = useAuth();

    // Role-based filter options
    const getFilterOptions = () => {
        const baseFilters = [
            { id: 'all', label: 'All', icon: BellIcon },
            { id: 'unread', label: 'Unread', icon: BellIcon },
        ];

        const roleSpecificFilters = {
            'Sales Executive': [
                { id: 'opportunity_created', label: 'Opportunities', icon: Briefcase },
                { id: 'approval_status_change', label: 'Approvals', icon: CheckCheck },
                { id: 'document_upload', label: 'Documents', icon: FileText },
            ],
            'Sales Manager': [
                { id: 'gp_approval_request', label: 'GP Approvals', icon: DollarSign },
                { id: 'opportunity_created', label: 'Opportunities', icon: Briefcase },
                { id: 'approval_granted', label: 'Approved', icon: Check },
            ],
            'Operations Manager': [
                { id: 'document_upload', label: 'Documents', icon: FileText },
                { id: 'expense_edit', label: 'Expenses', icon: DollarSign },
            ],
            'Business Head': [
                { id: 'gp_approval_request', label: 'GP Approvals', icon: DollarSign },
                { id: 'approval_status_change', label: 'Status Changes', icon: CheckCheck },
            ],
            'Finance Manager': [
                { id: 'expense_edit', label: 'Expenses', icon: DollarSign },
                { id: 'gp_approval_request', label: 'GP Approvals', icon: DollarSign },
            ],
            'Director': [
                { id: 'gp_approval_request', label: 'GP Approvals', icon: DollarSign },
                { id: 'approval_status_change', label: 'Approvals', icon: CheckCheck },
                { id: 'opportunity_created', label: 'Opportunities', icon: Briefcase },
            ],
        };

        const userRole = user?.role || 'Sales Executive';
        const specificFilters = roleSpecificFilters[userRole] || roleSpecificFilters['Sales Executive'];

        return [...baseFilters, ...specificFilters];
    };

    // --- Helpers ---
    const formatFieldName = (field) => {
        return field
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace('Common Details.', '')
            .replace('Type Specific Details.', '');
    };

    const getStyleConfig = (type) => {
        switch (type) {
            case 'approval_granted':
            case 'document_upload':
                return {
                    bg: 'bg-gradient-to-br from-emerald-50 to-green-50',
                    iconBg: 'bg-gradient-to-br from-emerald-400 to-green-500',
                    iconColor: 'text-white',
                    icon: Check,
                    borderColor: 'border-l-emerald-400'
                };
            case 'expense_edit':
            case 'gp_approval_request':
                return {
                    bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
                    iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500',
                    iconColor: 'text-white',
                    icon: DollarSign,
                    borderColor: 'border-l-amber-400'
                };
            case 'opportunity_created':
            case 'approval_status_change':
                return {
                    bg: 'bg-gradient-to-br from-blue-50 to-indigo-50',
                    iconBg: 'bg-gradient-to-br from-blue-400 to-indigo-500',
                    iconColor: 'text-white',
                    icon: Briefcase,
                    borderColor: 'border-l-blue-400'
                };
            default:
                return {
                    bg: 'bg-gradient-to-br from-gray-50 to-slate-50',
                    iconBg: 'bg-gradient-to-br from-gray-400 to-slate-500',
                    iconColor: 'text-white',
                    icon: 'notification',
                    borderColor: 'border-l-gray-400'
                };
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };

    const { socket } = useSocket();

    useEffect(() => {
        let isMounted = true;

        const loadNotifications = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                const res = await axios.get('http://localhost:5000/api/notifications', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!isMounted) return;
                setNotifications(res.data.notifications);
                setUnreadCount(res.data.unreadCount);
            } catch (err) {
                console.error('Error fetching notifications:', err);
            }
        };

        loadNotifications();

        return () => {
            isMounted = false;
        };
    }, []);

    // Real-time listener: Listen for NEW notifications from Socket.io
    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (newNotification) => {
            // Prepend new notification to state
            setNotifications(prev => [newNotification, ...prev]);
            setUnreadCount(prev => prev + 1);

            // Optional: You could play a sound here
        };

        socket.on('notification_received', handleNewNotification);

        return () => {
            socket.off('notification_received', handleNewNotification);
        };
    }, [socket]);

    const filteredNotifications = useMemo(() => {
        let filtered = notifications;

        // Apply type filter
        if (activeFilter === 'unread') {
            filtered = filtered.filter(n => !n.isRead);
        } else if (activeFilter !== 'all') {
            filtered = filtered.filter(n => n.type === activeFilter);
        }

        // Apply search filter
        if (searchQuery.trim()) {
            filtered = filtered.filter(n =>
                (n?.message || '').toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        return filtered;
    }, [notifications, activeFilter, searchQuery]);

    const handleMarkAsRead = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            const token = localStorage.getItem('token');
            await axios.put(`http://localhost:5000/api/notifications/${id}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(notifications.map(n => n._id === id ? { ...n, isRead: true } : n));
            setUnreadCount(Math.max(0, unreadCount - 1));
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.put('http://localhost:5000/api/notifications/read-all', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(notifications.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    // 1. CLICK ON LIST ITEM -> OPEN PREVIEW
    const handleNotificationClick = async (notification) => {
        if (!notification.isRead) {
            handleMarkAsRead(notification._id);
        }
        setSelectedNotification(notification);
    };

    // 2. CLICK "VIEW PAGE" IN PREVIEW -> NAVIGATE
    const handlePreviewNavigate = (notification) => {
        setIsOpen(false);
        setSelectedNotification(null);

        if (notification.type === 'gp_approval_request' || notification.type === 'approval_status_change') {
            if (notification.opportunityId) {
                navigate(`/opportunities/${notification.opportunityId}`, { state: { activeTab: 'expenses' } });
            } else {
                navigate('/approvals');
            }
        } else if (notification.type === 'approval_granted' || notification.type === 'approval_rejected') {
            if (notification.opportunityId) {
                navigate(`/opportunities/${notification.opportunityId}`, { state: { activeTab: 'expenses' } });
            }
        } else if (notification.opportunityId) {
            const state = notification.targetTab ? { activeTab: notification.targetTab } : {};
            navigate(`/opportunities/${notification.opportunityId}`, { state });
        } else {
            navigate('/dashboard');
        }
    };

    const filterOptions = getFilterOptions();

    return (
        <>
            {/* Notification Icon Trigger */}
            <button
                onClick={() => setIsOpen(true)}
                className="relative p-2 text-gray-500 hover:text-primary-blue hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110"
                aria-label="Notifications"
            >
                <NotificationBellIcon className="w-7 h-7" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 h-5 w-5 bg-gradient-to-br from-red-500 to-pink-600 text-white text-xs flex items-center justify-center rounded-full animate-pulse shadow-lg">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Modal Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
                    {/* Backdrop with Enhanced Glassmorphism Blur */}
                    <div
                        className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/30 to-black/40 backdrop-blur-xl transition-all duration-300"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Modal Content - Professional Design with Fixed Height */}
                    <div className="relative bg-white/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl h-[85vh] sm:h-[80vh] overflow-hidden border border-white/50 transform transition-all scale-100 animate-in fade-in zoom-in duration-300 flex flex-col">

                        {selectedNotification ? (
                            // PREVIEW MODE
                            <div className="flex flex-col h-full">
                                {/* Preview Header */}
                                <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-primary-blue to-blue-600 text-white shadow-lg relative z-10">
                                    <button
                                        onClick={() => setSelectedNotification(null)}
                                        className="p-2 -ml-2 rounded-full hover:bg-white/20 transition-all group"
                                    >
                                        <ArrowLeft size={20} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
                                    </button>
                                    <h3 className="text-lg font-bold">Notification Details</h3>
                                    <div className="ml-auto">
                                        <button
                                            onClick={() => setIsOpen(false)}
                                            className="p-2 rounded-full hover:bg-white/20 transition-all"
                                        >
                                            <X size={20} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>

                                {/* Preview Content */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 bg-gradient-to-br from-gray-50 to-blue-50/30">
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-4 sm:p-6 mb-6 hover:shadow-xl transition-shadow">
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className={`p-4 rounded-2xl flex-shrink-0 shadow-lg ${getStyleConfig(selectedNotification.type).iconBg}`}>
                                                {getStyleConfig(selectedNotification.type).icon === 'notification' ? (
                                                    <NotificationBellIcon className="w-7 h-7 brightness-0 invert" />
                                                ) : (
                                                    React.createElement(getStyleConfig(selectedNotification.type).icon, {
                                                        size: 28,
                                                        className: getStyleConfig(selectedNotification.type).iconColor,
                                                        strokeWidth: 2.5
                                                    })
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-base font-bold text-slate-900 leading-snug mb-2">
                                                    {selectedNotification.message}
                                                </p>
                                                <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
                                                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                                    {formatTime(selectedNotification.createdAt)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Divider */}
                                        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-5"></div>

                                        {/* Change Log Details */}
                                        {selectedNotification.changes && Object.keys(selectedNotification.changes).length > 0 ? (
                                            <div className="space-y-4">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                    <FileText size={14} /> Full Change Log
                                                </h4>
                                                <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-slate-200 overflow-hidden shadow-inner">
                                                    {Object.entries(selectedNotification.changes).map(([key, value], index) => (
                                                        <div key={key} className={`p-4 grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3 ${index !== 0 ? 'border-t border-slate-200' : ''} hover:bg-white/50 transition-colors`}>
                                                            <span className="text-sm font-bold text-slate-700">{formatFieldName(key)}</span>
                                                            <span className="text-sm text-slate-900 font-medium break-words bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                                                                {typeof value === 'object' ? safeStringify(value) : String(value)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-500 italic text-center py-6 bg-slate-50 rounded-xl border border-slate-100">
                                                No specific field changes recorded.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Preview Footer Actions */}
                                <div className="flex-shrink-0 p-3 sm:p-5 bg-white border-t border-gray-200 flex justify-end gap-2 sm:gap-3 z-10 shadow-lg">
                                    <button
                                        onClick={() => setSelectedNotification(null)}
                                        className="px-6 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all hover:scale-105"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={() => handlePreviewNavigate(selectedNotification)}
                                        className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-primary-blue to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-200 transition-all hover:scale-105 flex items-center gap-2"
                                    >
                                        View in Page
                                        <ArrowLeft size={16} className="rotate-180" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // LIST MODE
                            <>
                                {/* Header with Gradient - Fixed Height */}
                                <div className="flex-shrink-0 px-4 sm:px-8 py-4 sm:py-6 bg-gradient-to-r from-primary-blue to-blue-600 text-white shadow-lg z-20 relative">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-start mb-4 gap-3">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-2xl font-bold tracking-tight">Notifications</h3>
                                                {unreadCount > 0 && (
                                                    <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                                                        {unreadCount} New
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                            {unreadCount > 0 && (
                                                <button
                                                    onClick={handleMarkAllRead}
                                                    className="text-sm font-medium text-white/90 hover:text-white transition-colors flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm"
                                                >
                                                    <CheckCheck size={16} />
                                                    Mark all read
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setIsOpen(false)}
                                                className="p-2 rounded-full hover:bg-white/20 transition-all"
                                            >
                                                <X size={22} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Search Bar */}
                                    <div className="relative mb-4">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center z-10 pointer-events-none">
                                            <img
                                                src={searchIcon}
                                                alt="Search"
                                                className="w-full h-full object-contain brightness-0 invert opacity-90"
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search notifications..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-14 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all relative z-0"
                                        />
                                    </div>

                                    {/* Filter Buttons */}
                                    <div className="flex flex-wrap gap-2">
                                        {filterOptions.map((filter) => {
                                            const Icon = filter.icon;
                                            const isActive = activeFilter === filter.id;
                                            return (
                                                <button
                                                    key={filter.id}
                                                    onClick={() => setActiveFilter(filter.id)}
                                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${isActive
                                                        ? 'bg-white text-primary-blue shadow-lg scale-105'
                                                        : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm'
                                                        }`}
                                                >
                                                    <Icon size={16} />
                                                    {filter.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Notification List - Scrollable Area */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-6 py-4 sm:py-6 bg-gradient-to-br from-gray-50 to-blue-50/30">
                                    {filteredNotifications.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-center">
                                            <div className="bg-gradient-to-br from-blue-100 to-indigo-100 p-8 rounded-full shadow-lg mb-6 ring-4 ring-blue-50 animate-pulse">
                                                <NotificationBellIcon className="w-16 h-16 opacity-40" />
                                            </div>
                                            <h4 className="text-slate-800 font-bold text-xl mb-2">All caught up!</h4>
                                            <p className="text-slate-500 text-sm max-w-xs mx-auto">
                                                {searchQuery || activeFilter !== 'all'
                                                    ? 'No notifications match your filters.'
                                                    : 'You have no new notifications.'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {filteredNotifications.map((notification) => (
                                                <NotificationItem
                                                    key={notification._id}
                                                    notification={notification}
                                                    onRead={handleMarkAsRead}
                                                    onNavigate={handleNotificationClick}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Footer - Fixed Height */}
                                <div className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-blue-50/50 p-4 text-center border-t border-gray-200/50 shadow-inner">
                                    <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                                        Global Knowledge Technologies
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

// Sub-component for individual notification item
const NotificationItem = ({ notification, onRead, onNavigate }) => {
    // Premium Color Logic based on type
    const getStyleConfig = (type) => {
        switch (type) {
            case 'approval_granted':
            case 'document_upload':
                return {
                    bg: 'bg-gradient-to-br from-emerald-50 to-green-50',
                    iconBg: 'bg-gradient-to-br from-emerald-400 to-green-500',
                    iconColor: 'text-white',
                    icon: Check,
                    hoverBorder: 'border-emerald-300',
                    borderColor: 'border-l-emerald-400'
                };
            case 'expense_edit':
            case 'gp_approval_request':
                return {
                    bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
                    iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500',
                    iconColor: 'text-white',
                    icon: DollarSign,
                    hoverBorder: 'border-amber-300',
                    borderColor: 'border-l-amber-400'
                };
            case 'opportunity_created':
            case 'approval_status_change':
                return {
                    bg: 'bg-gradient-to-br from-blue-50 to-indigo-50',
                    iconBg: 'bg-gradient-to-br from-blue-400 to-indigo-500',
                    iconColor: 'text-white',
                    icon: Briefcase,
                    hoverBorder: 'border-blue-300',
                    borderColor: 'border-l-blue-400'
                };
            default:
                return {
                    bg: 'bg-gradient-to-br from-gray-50 to-slate-50',
                    iconBg: 'bg-gradient-to-br from-gray-400 to-slate-500',
                    iconColor: 'text-white',
                    icon: 'notification',
                    hoverBorder: 'border-gray-300',
                    borderColor: 'border-l-gray-400'
                };
        }
    };

    const style = getStyleConfig(notification.type);
    const Icon = style.icon;

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };

    return (
        <div
            onClick={() => onNavigate(notification)}
            className={`
                group relative p-4 rounded-2xl cursor-pointer transition-all duration-300 ease-out
                bg-white border-l-4 ${style.borderColor} border border-gray-100
                hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1
                flex items-center gap-4
            `}
        >
            {/* Unread Indicator Dot */}
            {!notification.isRead && (
                <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-blue-500 shadow-lg shadow-blue-200 animate-pulse"></div>
            )}

            {/* Icon Container with Gradient */}
            <div className={`
                flex-shrink-0 w-12 h-12 rounded-xl ${style.iconBg} 
                flex items-center justify-center shadow-lg relative z-10
                group-hover:scale-110 transition-transform duration-300
            `}>
                {Icon === 'notification' ? (
                    <NotificationBellIcon className="w-[22px] h-[22px] brightness-0 invert" />
                ) : (
                    <Icon size={20} className={style.iconColor} strokeWidth={2.5} />
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex justify-between items-start gap-3">
                    <p className={`text-sm leading-snug ${!notification.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {notification.message}
                    </p>
                    <span className="text-xs font-semibold text-slate-400 shrink-0 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                        {formatTime(notification.createdAt)}
                    </span>
                </div>

                {/* Read Action (Hover) */}
                {!notification.isRead && (
                    <div className="h-0 group-hover:h-auto overflow-hidden transition-all duration-200">
                        <button
                            onClick={(e) => onRead(notification._id, e)}
                            className="opacity-0 group-hover:opacity-100 text-xs font-semibold text-blue-500 hover:text-blue-700 transition-all mt-2 flex items-center gap-1"
                        >
                            <Check size={12} />
                            Mark as Read
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationDropdown;
    const safeStringify = (value) => {
        try {
            return typeof value === 'string' ? value : JSON.stringify(value);
        } catch {
            return '[Unserializable data]';
        }
    };
