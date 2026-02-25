import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Check, FileText, DollarSign, Briefcase, X, ArrowLeft, Search, Bell as BellIcon, CheckCheck, CircleCheck } from 'lucide-react';
import NotificationBellIcon from '../common/NotificationBellIcon';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { API_BASE } from '../../config/api';

const FILTER_TYPE_GROUPS = {
    approvals: ['approval_request', 'approval_granted', 'approval_rejected', 'approval_status_change', 'gp_approval_request'],
    opportunities: ['opportunity_created', 'opportunity_update'],
    documents: ['document_upload'],
    expenses: ['expense_edit'],
    gp_approvals: ['approval_request', 'gp_approval_request']
};

const safeStringify = (value) => {
    try {
        return typeof value === 'string' ? value : JSON.stringify(value);
    } catch {
        return '[Unserializable data]';
    }
};

const NotificationDropdown = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [isNavigating, setIsNavigating] = useState(false);
    const navigationTimerRef = useRef(null);
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
                { id: 'opportunities', label: 'Opportunities', icon: Briefcase },
                { id: 'approvals', label: 'Approvals', icon: CheckCheck },
                { id: 'documents', label: 'Documents', icon: FileText },
            ],
            'Sales Manager': [
                { id: 'gp_approvals', label: 'GP Approvals', icon: DollarSign },
                { id: 'opportunities', label: 'Opportunities', icon: Briefcase },
                { id: 'approval_granted', label: 'Approved', icon: Check },
            ],
            'Operations Manager': [
                { id: 'documents', label: 'Documents', icon: FileText },
                { id: 'expenses', label: 'Expenses', icon: DollarSign },
            ],
            'Business Head': [
                { id: 'gp_approvals', label: 'GP Approvals', icon: DollarSign },
                { id: 'approvals', label: 'Status Changes', icon: CheckCheck },
            ],
            'Finance Manager': [
                { id: 'expenses', label: 'Expenses', icon: DollarSign },
                { id: 'gp_approvals', label: 'GP Approvals', icon: DollarSign },
            ],
            'Director': [
                { id: 'gp_approvals', label: 'GP Approvals', icon: DollarSign },
                { id: 'approvals', label: 'Approvals', icon: CheckCheck },
                { id: 'opportunities', label: 'Opportunities', icon: Briefcase },
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
            case 'approval_request':
            case 'document_upload':
                return {
                    bg: 'bg-emerald-50',
                    iconBg: 'bg-emerald-100',
                    iconColor: 'text-emerald-700',
                    icon: Check,
                    borderColor: 'border-l-emerald-500'
                };
            case 'approval_rejected':
                return {
                    bg: 'bg-rose-50',
                    iconBg: 'bg-rose-100',
                    iconColor: 'text-rose-700',
                    icon: X,
                    borderColor: 'border-l-rose-500'
                };
            case 'expense_edit':
            case 'gp_approval_request':
                return {
                    bg: 'bg-amber-50',
                    iconBg: 'bg-amber-100',
                    iconColor: 'text-amber-700',
                    icon: DollarSign,
                    borderColor: 'border-l-amber-500'
                };
            case 'opportunity_created':
            case 'approval_status_change':
                return {
                    bg: 'bg-blue-50',
                    iconBg: 'bg-blue-100',
                    iconColor: 'text-blue-700',
                    icon: Briefcase,
                    borderColor: 'border-l-blue-500'
                };
            default:
                return {
                    bg: 'bg-slate-50',
                    iconBg: 'bg-slate-100',
                    iconColor: 'text-slate-700',
                    icon: 'notification',
                    borderColor: 'border-l-slate-400'
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

    const loadNotifications = useCallback(async () => {
        try {
            const token = sessionStorage.getItem('token');
            if (!token) return;

            const res = await axios.get(`${API_BASE}/api/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setNotifications(res.data.notifications);
            setUnreadCount(res.data.unreadCount);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    }, []);

    useEffect(() => {
        const initialFetchTimer = setTimeout(() => {
            loadNotifications();
        }, 0);

        // Fallback sync for multi-system setups where socket event may not arrive.
        const intervalId = setInterval(loadNotifications, 1000);
        return () => {
            clearTimeout(initialFetchTimer);
            clearInterval(intervalId);
        };
    }, [loadNotifications]);

    useEffect(() => {
        return () => {
            if (navigationTimerRef.current) {
                clearTimeout(navigationTimerRef.current);
            }
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
            const groupTypes = FILTER_TYPE_GROUPS[activeFilter];
            filtered = Array.isArray(groupTypes)
                ? filtered.filter(n => groupTypes.includes(n.type))
                : filtered.filter(n => n.type === activeFilter);
        }

        // Apply search filter
        if (searchQuery.trim()) {
            filtered = filtered.filter(n =>
                (n?.message || '').toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        return filtered;
    }, [notifications, activeFilter, searchQuery]);

    const filterOptions = useMemo(() => getFilterOptions(), [user?.role]);

    useEffect(() => {
        if (!filterOptions.some((option) => option.id === activeFilter)) {
            setActiveFilter('all');
        }
    }, [filterOptions, activeFilter]);

    const handleMarkAsRead = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            const token = sessionStorage.getItem('token');
            await axios.put(`${API_BASE}/api/notifications/${id}/read`, {}, {
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
            const token = sessionStorage.getItem('token');
            await axios.put(`${API_BASE}/api/notifications/read-all`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(notifications.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    // CLICK ON LIST ITEM -> NAVIGATE DIRECTLY (no details preview screen)
    const handleNotificationClick = async (notification) => {
        if (isNavigating) return;
        if (!notification.isRead) {
            handleMarkAsRead(notification._id);
        }
        handlePreviewNavigate(notification);
    };

    // 2. CLICK "VIEW PAGE" IN PREVIEW -> NAVIGATE
    const handlePreviewNavigate = (notification) => {
        if (isNavigating) return;
        setIsNavigating(true);
        setIsOpen(false);
        setSelectedNotification(null);

        // Show a short transition loader so each click is visually distinct.
        navigationTimerRef.current = setTimeout(() => {
            if (notification.opportunityId) {
                navigate(`/opportunities/${notification.opportunityId}`, { state: { activeTab: 'sales' } });
            } else if (['approval_request', 'approval_granted', 'approval_rejected', 'approval_status_change', 'gp_approval_request'].includes(notification.type)) {
                navigate('/approvals');
            } else {
                navigate('/dashboard');
            }
            setIsNavigating(false);
            navigationTimerRef.current = null;
        }, 1000);
    };

    return (
        <>
            {/* Notification Icon Trigger */}
            <button
                onClick={() => setIsOpen(true)}
                className="relative p-2 text-slate-600 hover:text-primary-blue hover:bg-slate-100 rounded-full transition-all duration-200"
                aria-label="Notifications"
            >
                <NotificationBellIcon className="w-7 h-7" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center rounded-full shadow-sm">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Modal Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-all duration-200"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Modal Content */}
                    <div className="relative bg-white rounded-2xl shadow-[0_28px_70px_rgba(0,32,77,0.30)] w-full max-w-2xl h-[86vh] sm:h-[80vh] overflow-hidden border border-blue-100 flex flex-col">

                        {selectedNotification ? (
                            // PREVIEW MODE
                            <div className="flex flex-col h-full">
                                {/* Preview Header */}
                                <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 bg-white relative z-10">
                                    <button
                                        onClick={() => setSelectedNotification(null)}
                                        className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-all group text-slate-700"
                                    >
                                        <ArrowLeft size={20} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
                                    </button>
                                    <h3 className="text-lg font-semibold text-slate-900">Notification Details</h3>
                                    <div className="ml-auto">
                                        <button
                                            onClick={() => setIsOpen(false)}
                                            className="p-2 rounded-full hover:bg-slate-100 transition-all text-slate-600"
                                        >
                                            <X size={20} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>

                                {/* Preview Content */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 bg-slate-50">
                                    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 mb-6">
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className={`p-3 rounded-xl flex-shrink-0 ${getStyleConfig(selectedNotification.type).iconBg}`}>
                                                {getStyleConfig(selectedNotification.type).icon === 'notification' ? (
                                                    <NotificationBellIcon className="w-6 h-6" />
                                                ) : (
                                                    React.createElement(getStyleConfig(selectedNotification.type).icon, {
                                                        size: 24,
                                                        className: getStyleConfig(selectedNotification.type).iconColor,
                                                        strokeWidth: 2.2
                                                    })
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-base font-semibold text-slate-900 leading-snug mb-2">
                                                    {selectedNotification.message}
                                                </p>
                                                <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                                                    {formatTime(selectedNotification.createdAt)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Divider */}
                                        <div className="h-px bg-slate-200 my-5"></div>

                                        {/* Change Log Details */}
                                        {selectedNotification.changes && Object.keys(selectedNotification.changes).length > 0 ? (
                                            <div className="space-y-4">
                                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                                    <FileText size={14} /> Full Change Log
                                                </h4>
                                                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                                    {Object.entries(selectedNotification.changes).map(([key, value], index) => (
                                                        <div key={key} className={`p-4 grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3 ${index !== 0 ? 'border-t border-slate-200' : ''}`}>
                                                            <span className="text-sm font-semibold text-slate-700">{formatFieldName(key)}</span>
                                                            <span className="text-sm text-slate-900 font-medium break-words bg-white px-3 py-2 rounded-lg border border-slate-200">
                                                                {typeof value === 'object' ? safeStringify(value) : String(value)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-500 italic text-center py-6 bg-slate-50 rounded-xl border border-slate-200">
                                                No specific field changes recorded.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Preview Footer Actions */}
                                <div className="flex-shrink-0 p-3 sm:p-4 bg-white border-t border-slate-200 flex justify-end gap-2 sm:gap-3 z-10">
                                    <button
                                        onClick={() => setSelectedNotification(null)}
                                        className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={() => handlePreviewNavigate(selectedNotification)}
                                        className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-primary-blue hover:bg-blue-700 transition-colors flex items-center gap-2"
                                    >
                                        View in Page
                                        <ArrowLeft size={16} className="rotate-180" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // LIST MODE
                            <>
                                {/* Header */}
                                <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-gradient-to-r from-primary-blue to-[#0a4f93] border-b border-blue-900/20 z-20 relative">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-start mb-4 gap-3">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-xl font-semibold tracking-tight text-white">Notifications</h3>
                                                {unreadCount > 0 && (
                                                    <span className="bg-accent-yellow/90 text-primary-blue-dark text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
                                                        {unreadCount} New
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                            {unreadCount > 0 && (
                                                <button
                                                    onClick={handleMarkAllRead}
                                                    className="text-sm font-medium text-white hover:text-white transition-colors flex items-center gap-2 bg-white/15 hover:bg-white/25 px-3 py-2 rounded-lg backdrop-blur-sm"
                                                >
                                                    <CheckCheck size={16} />
                                                    Mark all read
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setIsOpen(false)}
                                                className="p-2 rounded-full hover:bg-white/20 transition-all text-white"
                                            >
                                                <X size={22} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Search Bar */}
                                    <div className="relative mb-4">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                            <Search size={17} />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search notifications..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-11 pr-4 py-2.5 bg-white border border-white/55 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-yellow/35 focus:border-accent-yellow/70 transition-all"
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
                                                    className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border ${isActive
                                                        ? 'bg-white text-primary-blue border-white shadow-[0_3px_10px_rgba(0,0,0,0.12)]'
                                                        : 'bg-white/8 text-white border-white/35 hover:bg-white/18 hover:text-white'
                                                        }`}
                                                >
                                                    <Icon size={15} />
                                                    {filter.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Notification List - Scrollable Area */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-4 py-4 bg-gradient-to-b from-[#eef4fb] to-[#f5f8fc]">
                                    {filteredNotifications.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-center">
                                            <div className="bg-slate-100 p-6 rounded-full mb-5 border border-slate-200">
                                                <NotificationBellIcon className="w-14 h-14 opacity-40" />
                                            </div>
                                            <h4 className="text-slate-800 font-semibold text-lg mb-2">All caught up</h4>
                                            <p className="text-slate-500 text-sm max-w-xs mx-auto">
                                                {searchQuery || activeFilter !== 'all'
                                                    ? 'No notifications match your filters.'
                                                    : 'You have no new notifications.'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2.5">
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

                                {/* Footer */}
                                <div className="flex-shrink-0 bg-white p-3 text-center border-t border-blue-100">
                                    <span className="text-xs text-primary-blue/70 font-medium tracking-wide">
                                        Notification Center
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {isNavigating && (
                <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white rounded-xl shadow-xl border border-blue-100 px-6 py-5 flex items-center gap-3">
                        <span className="w-5 h-5 border-2 border-blue-200 border-t-primary-blue rounded-full animate-spin" />
                    </div>
                </div>
            )}
        </>
    );
};

// Sub-component for individual notification item
const NotificationItem = ({ notification, onRead, onNavigate }) => {
    // Visual style by notification type
    const getStyleConfig = (type) => {
        switch (type) {
            case 'approval_granted':
            case 'approval_request':
            case 'document_upload':
                return {
                    bg: 'bg-emerald-50/65',
                    iconBg: 'bg-emerald-100',
                    iconColor: 'text-emerald-700',
                    icon: Check
                };
            case 'approval_rejected':
                return {
                    bg: 'bg-rose-50/70',
                    iconBg: 'bg-rose-100',
                    iconColor: 'text-rose-700',
                    icon: X
                };
            case 'expense_edit':
            case 'gp_approval_request':
                return {
                    bg: 'bg-amber-50/70',
                    iconBg: 'bg-amber-100',
                    iconColor: 'text-amber-700',
                    icon: DollarSign
                };
            case 'opportunity_created':
            case 'approval_status_change':
                return {
                    bg: 'bg-blue-50/70',
                    iconBg: 'bg-blue-100',
                    iconColor: 'text-blue-700',
                    icon: Briefcase
                };
            default:
                return {
                    bg: 'bg-slate-50',
                    iconBg: 'bg-slate-100',
                    iconColor: 'text-slate-700',
                    icon: 'notification'
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

    const renderMessageWithHighlightedId = (message) => {
        if (!message) return '';
        const idPattern = /(\s*GK[A-Z0-9]+)/gi;
        const parts = String(message).split(idPattern);
        const isIdPart = /^\s*GK[A-Z0-9]+$/i;
        return parts.map((part, index) => (
            isIdPart.test(part)
                ? <span key={`${part}-${index}`} className="font-bold text-slate-900 whitespace-nowrap">{part}</span>
                : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
        ));
    };

    return (
        <div
            onClick={() => onNavigate(notification)}
            className={`
                group relative px-4 sm:px-5 py-3.5 cursor-pointer transition-all duration-200
                flex items-center gap-3 sm:gap-4
                rounded-xl ${!notification.isRead
                    ? 'bg-[#eef5ff] ring-1 ring-[#bfd8f4] shadow-[0_4px_14px_rgba(0,61,122,0.14)]'
                    : 'bg-white ring-1 ring-[#dbe8f6] shadow-[0_1px_6px_rgba(0,35,82,0.06)]'}
                hover:shadow-[0_8px_20px_rgba(0,35,82,0.12)] hover:-translate-y-[1px] hover:ring-[#c9def3]
            `}
        >
            {/* Icon Container */}
            <div className={`
                flex-shrink-0 w-10 h-10 rounded-xl ${!notification.isRead ? 'bg-blue-100' : style.bg}
                flex items-center justify-center
            `}>
                {Icon === 'notification' ? (
                    <NotificationBellIcon className="w-[18px] h-[18px]" />
                ) : (
                    <Icon size={18} className={style.iconColor} strokeWidth={2.1} />
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                    <p className={`text-[13px] leading-5 pr-2 tracking-[-0.01em] ${!notification.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {renderMessageWithHighlightedId(notification.message)}
                    </p>
                    <div className="shrink-0 flex items-center justify-end gap-2 min-w-[78px]">
                        {!notification.isRead && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary-blue/10 text-primary-blue">
                                New
                            </span>
                        )}
                        <span className="text-[11px] font-medium text-primary-blue/70">
                            {formatTime(notification.createdAt)}
                        </span>
                        {!notification.isRead && (
                            <button
                                onClick={(e) => onRead(notification._id, e)}
                                className="h-7 w-7 rounded-md border border-blue-200 bg-white text-primary-blue hover:bg-primary-blue hover:text-white hover:border-primary-blue opacity-100 transition-all flex items-center justify-center"
                                aria-label="Mark as read"
                            >
                                <CircleCheck size={14} strokeWidth={2.2} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationDropdown;
