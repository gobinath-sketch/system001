import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE, API_ENDPOINTS } from '../config/api';
import { useToast } from '../context/ToastContext';
import { RefreshCw, Inbox, CheckCircle2, XCircle, ShieldCheck, Mail, Filter, CalendarDays, Users, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const authHeaders = () => ({
    Authorization: `Bearer ${sessionStorage.getItem('token') || ''}`
});

const openNativeDatePicker = (event) => {
    const input = event.currentTarget;
    if (typeof input.showPicker === 'function') {
        input.showPicker();
    }
};

const openNativeDatePickerOnMouseDown = (event) => {
    const input = event.currentTarget;
    if (typeof input.showPicker === 'function') {
        event.preventDefault();
        input.showPicker();
    }
};

const StatusBadge = ({ value }) => {
    const map = {
        processed: 'bg-green-100 text-green-700',
        needs_review: 'bg-amber-100 text-amber-700',
        failed: 'bg-red-100 text-red-700',
        ignored: 'bg-slate-100 text-slate-700',
        queued: 'bg-blue-100 text-blue-700'
    };
    return (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${map[value] || 'bg-slate-100 text-slate-700'}`}>
            {value}
        </span>
    );
};

const cloneValue = (value) => JSON.parse(JSON.stringify(value || {}));

const updateNestedValue = (source, path, value) => {
    const next = cloneValue(source);
    let cursor = next;
    for (let index = 0; index < path.length - 1; index += 1) {
        const key = path[index];
        if (cursor[key] === undefined || cursor[key] === null || typeof cursor[key] !== 'object') {
            cursor[key] = typeof path[index + 1] === 'number' ? [] : {};
        }
        cursor = cursor[key];
    }
    cursor[path[path.length - 1]] = value;
    return next;
};

const EmailAutomationPage = () => {
    const { addToast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();

    const [health, setHealth] = useState(null);
    const [checking, setChecking] = useState(false);
    const [queueLoading, setQueueLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [mailLoading, setMailLoading] = useState(false);
    const [processingSelected, setProcessingSelected] = useState(false);

    const [queue, setQueue] = useState([]);
    const [history, setHistory] = useState([]);
    const [mailboxMessages, setMailboxMessages] = useState([]);
    const [selectedMessageIds, setSelectedMessageIds] = useState([]);

    const [top, setTop] = useState(100);
    const [maxPages, setMaxPages] = useState(60);
    const [forceReview, setForceReview] = useState(false);
    const [pullAll, setPullAll] = useState(true);
    const [period, setPeriod] = useState('all');
    const [folder, setFolder] = useState('inbox');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [mailDetail, setMailDetail] = useState(null);
    const [mailDetailLoading, setMailDetailLoading] = useState(false);
    const [activeSource, setActiveSource] = useState(location.state?.activeSource || 'email');
    const [reviewModalItem, setReviewModalItem] = useState(null);
    const [reviewDraft, setReviewDraft] = useState(null);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);

    const [calendarLoading, setCalendarLoading] = useState(false);
    const [calendarEvents, setCalendarEvents] = useState([]);
    const [calendarPeriod, setCalendarPeriod] = useState('month');
    const [calendarAnchorDate, setCalendarAnchorDate] = useState('');
    const [calendarFromDate, setCalendarFromDate] = useState('');
    const [calendarToDate, setCalendarToDate] = useState('');
    const [calendarDetail, setCalendarDetail] = useState(null);
    const [calendarDetailLoading, setCalendarDetailLoading] = useState(false);

    const [teamsLoading, setTeamsLoading] = useState(false);
    const [teams, setTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState('');
    const [channelsLoading, setChannelsLoading] = useState(false);
    const [channels, setChannels] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState('');
    const [teamMessagesLoading, setTeamMessagesLoading] = useState(false);
    const [teamMessages, setTeamMessages] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [chatList, setChatList] = useState([]);
    const [selectedChat, setSelectedChat] = useState('');
    const [chatMessagesLoading, setChatMessagesLoading] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatError, setChatError] = useState('');

    const [teamsError, setTeamsError] = useState('');
    const didInitFolderFetch = useRef(false);
    const liveRefreshIntervalRef = useRef(null);

    const queueCount = useMemo(() => queue.length, [queue]);

    const fetchHealth = async (options = {}) => {
        if (!options.silent) setChecking(true);
        try {
            const [h, t] = await Promise.all([
                axios.get(`${API_BASE}${API_ENDPOINTS.emailAutomation.health}`, { headers: authHeaders() }),
                axios.get(`${API_BASE}${API_ENDPOINTS.emailAutomation.tokenCheck}`, { headers: authHeaders() })
            ]);
            setHealth({
                ...h.data,
                tokenOk: Boolean(t.data?.ok)
            });
        } catch (error) {
            if (!options.silent) {
                addToast(error?.response?.data?.message || 'Failed to check automation health', 'error');
            }
        } finally {
            if (!options.silent) setChecking(false);
        }
    };

    const fetchQueue = async (options = {}) => {
        if (!options.silent) setQueueLoading(true);
        try {
            const res = await axios.get(`${API_BASE}${API_ENDPOINTS.emailAutomation.queue}?status=needs_review&limit=200`, {
                headers: authHeaders()
            });
            setQueue(res.data || []);
        } catch (error) {
            if (!options.silent) {
                addToast(error?.response?.data?.message || 'Failed to load review queue', 'error');
            }
        } finally {
            if (!options.silent) setQueueLoading(false);
        }
    };

    const fetchHistory = async (options = {}) => {
        if (!options.silent) setHistoryLoading(true);
        try {
            const res = await axios.get(`${API_BASE}${API_ENDPOINTS.emailAutomation.history}?limit=300`, {
                headers: authHeaders()
            });
            setHistory(res.data || []);
        } catch (error) {
            if (!options.silent) {
                addToast(error?.response?.data?.message || 'Failed to load automation history', 'error');
            }
        } finally {
            if (!options.silent) setHistoryLoading(false);
        }
    };

    const buildFilterParams = () => {
        const params = new URLSearchParams();
        params.set('top', String(Math.max(1, Number(top) || 100)));
        params.set('all', pullAll ? 'true' : 'false');
        params.set('maxPages', String(Math.max(1, Number(maxPages) || 60)));
        params.set('folder', folder);

        if (period === 'custom') {
            if (fromDate) params.set('fromDate', new Date(fromDate).toISOString());
            if (toDate) params.set('toDate', new Date(toDate).toISOString());
        } else {
            params.set('period', period);
        }

        return params.toString();
    };

    const fetchMailboxMessages = async (options = {}) => {
        if (!options.silent) setMailLoading(true);
        try {
            const query = buildFilterParams();
            const res = await axios.get(`${API_BASE}${API_ENDPOINTS.emailAutomation.mailboxMessages}?${query}`, {
                headers: authHeaders()
            });
            const nextMessages = res.data?.messages || [];
            setMailboxMessages(nextMessages);
            setSelectedMessageIds((current) => {
                if (!options.silent) return [];
                const nextIds = new Set(nextMessages.map((message) => message.graphMessageId).filter(Boolean));
                return current.filter((id) => nextIds.has(id));
            });
            if (!options.silent) {
                addToast(`Loaded ${res.data?.count || 0} mailbox emails`, 'success');
            }
        } catch (error) {
            if (!options.silent) {
                addToast(error?.response?.data?.message || 'Failed to load mailbox emails', 'error');
            }
        } finally {
            if (!options.silent) setMailLoading(false);
        }
    };

    const toggleMessageSelection = (messageId) => {
        if (!messageId) return;
        setSelectedMessageIds((current) => (
            current.includes(messageId)
                ? current.filter((id) => id !== messageId)
                : [...current, messageId]
        ));
    };

    const toggleSelectAllMessages = () => {
        const visibleIds = mailboxMessages
            .map((message) => message.graphMessageId)
            .filter(Boolean);

        if (!visibleIds.length) return;

        setSelectedMessageIds((current) => (
            current.length === visibleIds.length ? [] : visibleIds
        ));
    };

    const processSelectedEmails = async () => {
        if (!selectedMessageIds.length) {
            addToast('Select at least one email to process', 'info');
            return;
        }

        setProcessingSelected(true);
        try {
            const res = await axios.post(`${API_BASE}${API_ENDPOINTS.emailAutomation.ingestSelected}`, {
                messageIds: selectedMessageIds,
                forceReview
            }, {
                headers: authHeaders()
            });

            addToast(`Processed ${res.data?.processed || 0} selected emails`, 'success');
            setSelectedMessageIds([]);
            await Promise.all([fetchQueue(), fetchHistory(), fetchMailboxMessages()]);
        } catch (error) {
            addToast(error?.response?.data?.message || 'Failed to process selected emails', 'error');
        } finally {
            setProcessingSelected(false);
        }
    };

    const allVisibleSelected = mailboxMessages.length > 0
        && mailboxMessages.every((message) => message.graphMessageId && selectedMessageIds.includes(message.graphMessageId));

    const openMailDetail = async (messageId) => {
        if (!messageId) return;
        setMailDetailLoading(true);
        try {
            const res = await axios.get(`${API_BASE}${API_ENDPOINTS.emailAutomation.mailboxMessageById(messageId)}`, {
                headers: authHeaders()
            });
            setMailDetail(res.data);
        } catch (error) {
            addToast(error?.response?.data?.message || 'Failed to load email detail', 'error');
        } finally {
            setMailDetailLoading(false);
        }
    };

    const fetchCalendar = async (options = {}) => {
        if (!options.silent) setCalendarLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('top', '300');
            if (calendarPeriod === 'custom') {
                if (calendarFromDate) params.set('fromDate', calendarFromDate);
                if (calendarToDate) params.set('toDate', calendarToDate);
            } else {
                params.set('period', calendarPeriod);
                if (calendarAnchorDate) params.set('anchorDate', calendarAnchorDate);
            }
            const res = await axios.get(`${API_BASE}${API_ENDPOINTS.emailAutomation.calendarEvents}?${params.toString()}`, {
                headers: authHeaders()
            });
            setCalendarEvents(res.data?.events || []);
            if (!options.silent) {
                addToast(`Loaded ${res.data?.count || 0} calendar events`, 'success');
            }
        } catch (error) {
            if (!options.silent) {
                addToast(error?.response?.data?.message || 'Failed to load calendar events', 'error');
            }
        } finally {
            if (!options.silent) setCalendarLoading(false);
        }
    };

    const openCalendarDetail = async (eventId) => {
        if (!eventId) return;
        setCalendarDetailLoading(true);
        try {
            const res = await axios.get(`${API_BASE}${API_ENDPOINTS.emailAutomation.calendarEventById(eventId)}`, {
                headers: authHeaders()
            });
            setCalendarDetail(res.data);
        } catch (error) {
            addToast(error?.response?.data?.message || 'Failed to load event detail', 'error');
        } finally {
            setCalendarDetailLoading(false);
        }
    };

    const fetchTeams = async (options = {}) => {
        if (!options.silent) {
            setTeamsLoading(true);
            setTeamsError('');
        }
        try {
            const res = await axios.get(`${API_BASE}${API_ENDPOINTS.emailAutomation.teams}`, {
                headers: authHeaders()
            });
            const list = res.data?.teams || [];
            setTeams(list);
            setSelectedTeam((current) => {
                if (!list.length) return '';
                if (options.silent && current && list.some((team) => team.id === current)) {
                    return current;
                }
                return current || list[0].id;
            });
            if (!options.silent) {
                addToast(`Loaded ${res.data?.count || 0} teams`, 'success');
            }
        } catch (error) {
            const message = error?.response?.data?.message || 'Failed to load teams';
            if (!options.silent) {
                setTeamsError(message);
                addToast(message, 'error');
            }
        } finally {
            if (!options.silent) setTeamsLoading(false);
        }
    };

    const fetchChannels = async (teamId, options = {}) => {
        if (!teamId) return;
        if (!options.silent) setChannelsLoading(true);
        try {
            const res = await axios.get(`${API_BASE}${API_ENDPOINTS.emailAutomation.teamChannels(teamId)}`, {
                headers: authHeaders()
            });
            const list = res.data?.channels || [];
            setChannels(list);
            setSelectedChannel((current) => {
                if (!list.length) return '';
                if (options.silent && current && list.some((channel) => channel.id === current)) {
                    return current;
                }
                return current || list[0]?.id || '';
            });
        } catch (error) {
            if (!options.silent) {
                addToast(error?.response?.data?.message || 'Failed to load channels', 'error');
                setChannels([]);
                setSelectedChannel('');
            }
        } finally {
            if (!options.silent) setChannelsLoading(false);
        }
    };

    const fetchTeamMessages = async (options = {}) => {
        if (!selectedTeam || !selectedChannel) return;
        if (!options.silent) setTeamMessagesLoading(true);
        try {
            const res = await axios.get(`${API_BASE}${API_ENDPOINTS.emailAutomation.channelMessages(selectedTeam, selectedChannel)}?top=200`, {
                headers: authHeaders()
            });
            setTeamMessages(res.data?.messages || []);
            if (!options.silent) {
                addToast(`Loaded ${res.data?.count || 0} channel messages`, 'success');
            }
        } catch (error) {
            if (!options.silent) {
                addToast(error?.response?.data?.message || 'Failed to load team messages', 'error');
            }
        } finally {
            if (!options.silent) setTeamMessagesLoading(false);
        }
    };

    const connectChats = async () => {
        try {
            const res = await axios.get(`${API_BASE}${API_ENDPOINTS.emailAutomation.chatsAuthUrl}`, {
                headers: authHeaders()
            });
            if (res.data?.url) {
                window.open(res.data.url, '_blank', 'noopener,noreferrer');
            }
        } catch (error) {
            addToast(error?.response?.data?.message || 'Failed to start chat auth', 'error');
        }
    };

    const fetchChats = async (options = {}) => {
        if (!options.silent) {
            setChatLoading(true);
            setChatError('');
        }
        try {
            const res = await axios.get(`${API_BASE}${API_ENDPOINTS.emailAutomation.chats}?top=100`, {
                headers: authHeaders()
            });
            const list = res.data?.chats || [];
            setChatList(list);
            setSelectedChat((current) => {
                if (!list.length) return '';
                if (options.silent && current && list.some((chat) => chat.id === current)) {
                    return current;
                }
                return current || list[0]?.id || '';
            });
            if (!options.silent) {
                addToast(`Loaded ${list.length || 0} chats`, 'success');
            }
        } catch (error) {
            const message = error?.response?.data?.message || 'Failed to load chats';
            if (!options.silent) {
                setChatError(message);
                addToast(message, 'error');
            }
        } finally {
            if (!options.silent) setChatLoading(false);
        }
    };

    const fetchChatMessages = async (options = {}) => {
        if (!selectedChat) return;
        if (!options.silent) setChatMessagesLoading(true);
        try {
            const res = await axios.get(`${API_BASE}${API_ENDPOINTS.emailAutomation.chatMessages(selectedChat)}?top=100`, {
                headers: authHeaders()
            });
            setChatMessages(res.data?.messages || []);
            if (!options.silent) {
                addToast(`Loaded ${res.data?.count || 0} chat messages`, 'success');
            }
        } catch (error) {
            if (!options.silent) {
                addToast(error?.response?.data?.message || 'Failed to load chat messages', 'error');
            }
        } finally {
            if (!options.silent) setChatMessagesLoading(false);
        }
    };

    const refreshAll = async () => {
        await Promise.all([
            fetchHealth(),
            fetchQueue(),
            fetchHistory(),
            fetchMailboxMessages(),
            fetchCalendar(),
            fetchTeams(),
            fetchChats()
        ]);
    };

    const openReviewModal = (item) => {
        setReviewModalItem(item);
        setReviewDraft(cloneValue(item?.extraction || {}));
    };

    const closeReviewModal = () => {
        setReviewModalItem(null);
        setReviewDraft(null);
        setReviewSubmitting(false);
    };

    const updateReviewDraftField = (path, value) => {
        setReviewDraft((current) => updateNestedValue(current, path, value));
    };

    const reviewItem = async (id, action, draftExtraction = null) => {
        setReviewSubmitting(true);
        try {
            await axios.post(`${API_BASE}${API_ENDPOINTS.emailAutomation.queueReview(id)}`, {
                action,
                notes: action === 'approve' ? 'Approved from UI review queue' : 'Rejected from UI review queue',
                draftExtraction: action === 'approve' ? draftExtraction : null
            }, {
                headers: authHeaders()
            });
            addToast(`Item ${action}d`, action === 'approve' ? 'success' : 'info');
            await Promise.all([fetchQueue(), fetchHistory()]);
            if (action === 'approve' || action === 'reject') {
                closeReviewModal();
            }
        } catch (error) {
            addToast(error?.response?.data?.message || `Failed to ${action} item`, 'error');
        } finally {
            setReviewSubmitting(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        fetchQueue();
        fetchHistory();
        fetchMailboxMessages({ silent: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!didInitFolderFetch.current) {
            didInitFolderFetch.current = true;
            return;
        }
        fetchMailboxMessages({ silent: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [folder]);

    useEffect(() => {
        if (selectedTeam) fetchChannels(selectedTeam);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTeam]);

    useEffect(() => {
        if (liveRefreshIntervalRef.current) {
            clearInterval(liveRefreshIntervalRef.current);
            liveRefreshIntervalRef.current = null;
        }

        const runLiveRefresh = async () => {
            if (activeSource === 'email') {
                await Promise.all([
                    fetchMailboxMessages({ silent: true }),
                    fetchQueue({ silent: true }),
                    fetchHistory({ silent: true }),
                    fetchHealth({ silent: true })
                ]);
                return;
            }

            if (activeSource === 'teams') {
                await fetchTeams({ silent: true });
                if (selectedTeam) {
                    await fetchChannels(selectedTeam, { silent: true });
                }
                if (selectedTeam && selectedChannel) {
                    await fetchTeamMessages({ silent: true });
                }
                return;
            }

            if (activeSource === 'chats') {
                await fetchChats({ silent: true });
                if (selectedChat) {
                    await fetchChatMessages({ silent: true });
                }
                return;
            }

            if (activeSource === 'calendar') {
                await fetchCalendar({ silent: true });
            }
        };

        runLiveRefresh();
        liveRefreshIntervalRef.current = setInterval(runLiveRefresh, 1000);

        return () => {
            if (liveRefreshIntervalRef.current) {
                clearInterval(liveRefreshIntervalRef.current);
                liveRefreshIntervalRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSource, selectedTeam, selectedChannel, selectedChat, folder, period, fromDate, toDate, calendarPeriod, calendarAnchorDate, calendarFromDate, calendarToDate]);

    return (
        <div className="p-5 space-y-5">
            <div className="bg-white border rounded-xl p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setActiveSource('email')} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${activeSource === 'email' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-700'}`}>Email</button>
                        <button onClick={() => setActiveSource('teams')} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${activeSource === 'teams' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-700'}`}>Teams Channels</button>
                        <button onClick={() => setActiveSource('chats')} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${activeSource === 'chats' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-700'}`}>Teams Chats</button>
                        <button onClick={() => setActiveSource('calendar')} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${activeSource === 'calendar' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-700'}`}>Calendar</button>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-3 min-w-0">
                        {activeSource === 'email' ? (
                            <div className="flex items-center gap-5 text-sm min-w-0">
                                <div className="flex items-center gap-1.5 font-semibold text-slate-700 shrink-0"><ShieldCheck size={13} /> Health</div>
                                <div className="flex items-center gap-4 min-w-0 text-[12px]">
                                    <span className="text-gray-500 whitespace-nowrap">Config <span className={`font-semibold ${health?.ok ? 'text-green-600' : 'text-red-600'}`}>{health?.ok ? 'OK' : 'Missing'}</span></span>
                                    <span className="text-gray-500 whitespace-nowrap">Token <span className={`font-semibold ${health?.tokenOk ? 'text-green-600' : 'text-red-600'}`}>{health?.tokenOk ? 'OK' : 'Failed'}</span></span>
                                    <span className="text-gray-500 truncate">Mailbox <span className="font-semibold text-slate-800">{health?.mailbox || '-'}</span></span>
                                    {checking ? <span className="text-[10px] text-gray-500 whitespace-nowrap">Checking...</span> : null}
                                </div>
                            </div>
                        ) : null}
                        <button
                            onClick={refreshAll}
                            className="px-3 py-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-sm font-medium flex items-center gap-2"
                        >
                            <RefreshCw size={16} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {activeSource === 'email' && (
                <>
            <div className="bg-white border rounded-xl px-4 py-3">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 items-end">
                    <div className="xl:col-span-1">
                        <label className="text-sm font-bold text-slate-900">Folder</label>
                        <select value={folder} onChange={(e) => setFolder(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-900">
                            <option value="inbox">Inbox</option>
                            <option value="sentitems">Sent Items</option>
                            <option value="drafts">Drafts</option>
                            <option value="deleteditems">Deleted Items</option>
                            <option value="junkemail">Junk Email</option>
                            <option value="archive">Archive</option>
                        </select>
                    </div>
                    <div className="xl:col-span-1">
                        <label className="text-sm font-bold text-slate-900">Period</label>
                        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-900">
                            <option value="all">All</option>
                            <option value="custom">Custom</option>
                            <option value="day">Day</option>
                            <option value="week">Week</option>
                            <option value="month">Month</option>
                            <option value="year">Year</option>
                        </select>
                    </div>
                    <div className="xl:col-span-1">
                        <label className="text-sm font-bold text-slate-900">Top (per page)</label>
                        <input
                            type="number"
                            min="1"
                            max="500"
                            value={top}
                            onChange={(e) => setTop(e.target.value)}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-900"
                        />
                    </div>
                    <div className="xl:col-span-1">
                        <label className="text-sm font-bold text-slate-900">Max Pages</label>
                        <input
                            type="number"
                            min="1"
                            max="200"
                            value={maxPages}
                            onChange={(e) => setMaxPages(e.target.value)}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-900"
                        />
                    </div>
                    <div className="xl:col-span-1">
                        <label className="text-sm font-bold text-slate-900">From Date</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            onMouseDown={openNativeDatePickerOnMouseDown}
                            onClick={openNativeDatePicker}
                            disabled={period !== 'custom'}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 disabled:bg-gray-100"
                        />
                    </div>
                    <div className="xl:col-span-1">
                        <label className="text-sm font-bold text-slate-900">To Date</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            onMouseDown={openNativeDatePickerOnMouseDown}
                            onClick={openNativeDatePicker}
                            disabled={period !== 'custom'}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 disabled:bg-gray-100"
                        />
                    </div>
                </div>

            </div>

            <div className="bg-white border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b bg-blue-50 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="font-semibold text-blue-900">
                        Mailbox Emails ({folder})
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={fetchMailboxMessages}
                            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 text-sm font-medium"
                            disabled={mailLoading}
                        >
                            {mailLoading ? 'Loading...' : 'Load Mailbox'}
                        </button>
                        <button
                            onClick={processSelectedEmails}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium disabled:bg-blue-300 disabled:cursor-not-allowed"
                            disabled={processingSelected || selectedMessageIds.length === 0}
                        >
                            {processingSelected ? 'Processing...' : `Process Selected${selectedMessageIds.length ? ` (${selectedMessageIds.length})` : ''}`}
                        </button>
                    </div>
                </div>
                {mailLoading ? (
                    <div className="p-4 text-sm text-gray-500">Loading mailbox...</div>
                ) : mailboxMessages.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">No emails found in selected folder/date filter.</div>
                ) : (
                <div className="overflow-x-auto max-h-[420px]">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="text-left px-4 py-2">Received</th>
                                            <th className="text-left px-4 py-2">From</th>
                                            <th className="text-left px-4 py-2">Subject</th>
                                            <th className="text-left px-4 py-2">Read</th>
                                            <th className="text-left px-4 py-2">View</th>
                                            <th className="text-left px-4 py-2">
                                                <label className="inline-flex items-center gap-2 text-xs font-medium">
                                                    <input
                                                        type="checkbox"
                                                        checked={allVisibleSelected}
                                                        onChange={toggleSelectAllMessages}
                                                    />
                                                    Select
                                                </label>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                {mailboxMessages.map((m) => (
                                    <tr key={m.graphMessageId || m.internetMessageId}>
                                        <td className="px-4 py-2 whitespace-nowrap">{m.receivedAt ? new Date(m.receivedAt).toLocaleString() : '-'}</td>
                                        <td className="px-4 py-2">{m.fromEmail || '-'}</td>
                                        <td className="px-4 py-2">{m.subject || '(No Subject)'}</td>
                                        <td className="px-4 py-2">{m.isRead ? 'Yes' : 'No'}</td>
                                        <td className="px-4 py-2">
                                            <button
                                                onClick={() => openMailDetail(m.graphMessageId)}
                                                className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                                            >
                                                View
                                            </button>
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedMessageIds.includes(m.graphMessageId)}
                                                onChange={() => toggleMessageSelection(m.graphMessageId)}
                                                disabled={!m.graphMessageId}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-white border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b bg-amber-50 font-semibold text-amber-900">Needs Review</div>
                {queueLoading ? (
                    <div className="p-4 text-sm text-gray-500">Loading queue...</div>
                ) : queue.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">No pending review items.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left px-4 py-2">Subject</th>
                                    <th className="text-left px-4 py-2">From</th>
                                    <th className="text-left px-4 py-2">Intent</th>
                                    <th className="text-left px-4 py-2">Confidence</th>
                                    <th className="text-left px-4 py-2">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {queue.map((item) => (
                                    <tr key={item._id}>
                                        <td className="px-4 py-2">{item.subject || '-'}</td>
                                        <td className="px-4 py-2">{item.fromEmail || '-'}</td>
                                        <td className="px-4 py-2">{item.classification?.intent || '-'}</td>
                                        <td className="px-4 py-2">{Number(item.confidence || 0).toFixed(2)}</td>
                                        <td className="px-4 py-2">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => openReviewModal(item)} className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-xs flex items-center gap-1">
                                                    <ShieldCheck size={14} />
                                                    Review
                                                </button>
                                                <button onClick={() => reviewItem(item._id, 'reject')} className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-xs flex items-center gap-1">
                                                    <XCircle size={14} />
                                                    Reject
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-white border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b bg-slate-50 font-semibold text-slate-900">Automation History</div>
                {historyLoading ? (
                    <div className="p-4 text-sm text-gray-500">Loading history...</div>
                ) : history.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">No history yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left px-4 py-2">Status</th>
                                    <th className="text-left px-4 py-2">Subject</th>
                                    <th className="text-left px-4 py-2">Intent</th>
                                    <th className="text-left px-4 py-2">Confidence</th>
                                    <th className="text-left px-4 py-2">Linked</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {history.map((item) => (
                                    <tr key={item._id}>
                                        <td className="px-4 py-2"><StatusBadge value={item.status} /></td>
                                        <td className="px-4 py-2">{item.subject || '-'}</td>
                                        <td className="px-4 py-2">{item.classification?.intent || '-'}</td>
                                        <td className="px-4 py-2">{Number(item.confidence || 0).toFixed(2)}</td>
                                        <td className="px-4 py-2">
                                            <div className="flex flex-wrap gap-2">
                                                {item?.linkedEntities?.clientId?._id && (
                                                    <button
                                                        onClick={() => navigate('/clients')}
                                                        className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 border border-blue-200"
                                                    >
                                                        Client: {item.linkedEntities.clientId.companyName || 'Open'}
                                                    </button>
                                                )}
                                                {item?.linkedEntities?.opportunityId?._id && (
                                                    <button
                                                        onClick={() => navigate(`/opportunities/${item.linkedEntities.opportunityId._id}`)}
                                                        className="px-2 py-1 text-xs rounded bg-indigo-50 text-indigo-700 border border-indigo-200"
                                                    >
                                                        Opp: {item.linkedEntities.opportunityId.opportunityNumber || 'Open'}
                                                    </button>
                                                )}
                                                {item?.linkedEntities?.calendarEventWebLink && (
                                                    <a
                                                        href={item.linkedEntities.calendarEventWebLink}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="px-2 py-1 text-xs rounded bg-violet-50 text-violet-700 border border-violet-200"
                                                    >
                                                        Event: {item.linkedEntities.calendarEventSubject || 'Open'}
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

                </>
            )}

            {activeSource === 'teams' && (
                <div className="space-y-4">
                    <div className="bg-transparent rounded-xl px-3 py-1.5 min-h-[46px] flex items-center">
                        {teamsError ? <div className="mb-3 text-xs text-red-600">{teamsError}</div> : null}
                        <div className="flex flex-wrap xl:flex-nowrap items-center gap-3 w-full">
                            <div className="flex items-center gap-1.5 text-slate-700 font-semibold whitespace-nowrap min-w-[110px]"><Users size={14} /> Teams</div>
                            <div className="flex-1 min-w-[260px]">
                                <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="w-full border rounded-lg px-3 py-1.5 text-sm font-medium text-slate-900">
                                    <option value="">Select team</option>
                                    {teams.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
                                </select>
                            </div>
                            <div className="flex-1 min-w-[260px]">
                                <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} className="w-full border rounded-lg px-3 py-1.5 text-sm font-medium text-slate-900">
                                    <option value="">Select channel</option>
                                    {channels.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="px-4 py-3 border-b bg-blue-50 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="font-semibold text-blue-900">Channel Messages</div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button onClick={fetchTeams} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium">
                                    {teamsLoading ? 'Loading...' : 'Load Teams'}
                                </button>
                                <button onClick={fetchTeamMessages} className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-800 text-sm font-medium disabled:bg-slate-300 disabled:cursor-not-allowed" disabled={channelsLoading || !selectedChannel}>
                                    {teamMessagesLoading ? 'Loading...' : 'Load Messages'}
                                </button>
                            </div>
                        </div>
                        {teamMessagesLoading ? <div className="p-4 text-sm text-gray-500">Loading team messages...</div> : teamMessages.length === 0 ? <div className="p-4 text-sm text-gray-500">No messages loaded.</div> : (
                            <div className="overflow-x-auto max-h-[500px]">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="text-left px-4 py-2">Time</th>
                                            <th className="text-left px-4 py-2">From</th>
                                            <th className="text-left px-4 py-2">Message</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {teamMessages.map((m) => (
                                            <tr key={m.id}>
                                                <td className="px-4 py-2 whitespace-nowrap">{m.createdAt ? new Date(m.createdAt).toLocaleString() : '-'}</td>
                                                <td className="px-4 py-2">{m.from || '-'}</td>
                                                <td className="px-4 py-2">{m.summary || m.subject || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeSource === 'chats' && (
                <div className="space-y-4">
                    <div className="bg-transparent rounded-xl px-3 py-1.5 min-h-[46px] flex items-center">
                        {chatError ? <div className="mb-3 text-xs text-red-600">{chatError}</div> : null}
                        <div className="flex flex-wrap xl:flex-nowrap items-center gap-3 w-full">
                            <div className="flex items-center gap-1.5 text-slate-700 font-semibold whitespace-nowrap min-w-[120px]"><MessageSquare size={14} /> Teams Chats</div>
                            <div className="flex-1 min-w-[260px]">
                                <select value={selectedChat} onChange={(e) => setSelectedChat(e.target.value)} className="w-full border rounded-lg px-3 py-1.5 text-sm font-medium text-slate-900">
                                    <option value="">Select chat</option>
                                    {chatList.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.topic || c.chatType || 'Chat'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="px-4 py-3 border-b bg-blue-50 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="font-semibold text-blue-900">Chat Messages</div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button onClick={connectChats} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium">Connect Chats</button>
                                <button onClick={fetchChats} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium">
                                    {chatLoading ? 'Loading...' : 'Load Chats'}
                                </button>
                                <button onClick={fetchChatMessages} className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-800 text-sm font-medium disabled:bg-slate-300 disabled:cursor-not-allowed" disabled={!selectedChat}>
                                    {chatMessagesLoading ? 'Loading...' : 'Load Messages'}
                                </button>
                            </div>
                        </div>
                        {chatMessagesLoading ? <div className="p-4 text-sm text-gray-500">Loading chat messages...</div> : chatMessages.length === 0 ? <div className="p-4 text-sm text-gray-500">No chat messages loaded.</div> : (
                            <div className="overflow-x-auto max-h-[500px]">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="text-left px-4 py-2">Time</th>
                                            <th className="text-left px-4 py-2">From</th>
                                            <th className="text-left px-4 py-2">Message</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {chatMessages.map((m) => (
                                            <tr key={m.id}>
                                                <td className="px-4 py-2 whitespace-nowrap">{m.createdAt ? new Date(m.createdAt).toLocaleString() : '-'}</td>
                                                <td className="px-4 py-2">{m.from || '-'}</td>
                                                <td className="px-4 py-2">{m.body || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeSource === 'calendar' && (
                <div className="space-y-4">
                    <div className="bg-transparent rounded-xl px-3 py-1.5 min-h-[46px] flex items-center">
                        <div className="flex flex-wrap xl:flex-nowrap items-center gap-3 w-full">
                            <div className="flex items-center gap-1.5 text-slate-700 font-semibold whitespace-nowrap min-w-[110px]"><CalendarDays size={14} /> Calendar</div>
                            <div className="min-w-[140px]">
                                <select value={calendarPeriod} onChange={(e) => setCalendarPeriod(e.target.value)} className="w-full border rounded-lg px-3 py-1.5 text-sm font-medium text-slate-900">
                                    <option value="all">All</option>
                                    <option value="custom">Custom</option>
                                    <option value="day">Day</option>
                                    <option value="week">Week</option>
                                    <option value="month">Month</option>
                                    <option value="year">Year</option>
                                </select>
                            </div>
                            {calendarPeriod !== 'all' && calendarPeriod !== 'custom' ? (
                                <div className="min-w-[170px]">
                                    <input
                                        type="date"
                                        value={calendarAnchorDate}
                                        onChange={(e) => setCalendarAnchorDate(e.target.value)}
                                        onMouseDown={openNativeDatePickerOnMouseDown}
                                        onClick={openNativeDatePicker}
                                        className="w-full border rounded-lg px-3 py-1.5 text-sm font-medium text-slate-900"
                                    />
                                </div>
                            ) : null}
                            {calendarPeriod === 'custom' ? (
                                <>
                                    <div className="min-w-[170px]">
                                        <input
                                            type="date"
                                            value={calendarFromDate}
                                            onChange={(e) => setCalendarFromDate(e.target.value)}
                                            onMouseDown={openNativeDatePickerOnMouseDown}
                                            onClick={openNativeDatePicker}
                                            className="w-full border rounded-lg px-3 py-1.5 text-sm font-medium text-slate-900"
                                        />
                                    </div>
                                    <div className="min-w-[170px]">
                                        <input
                                            type="date"
                                            value={calendarToDate}
                                            onChange={(e) => setCalendarToDate(e.target.value)}
                                            onMouseDown={openNativeDatePickerOnMouseDown}
                                            onClick={openNativeDatePicker}
                                            className="w-full border rounded-lg px-3 py-1.5 text-sm font-medium text-slate-900"
                                        />
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                    <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="px-4 py-3 border-b bg-blue-50 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="font-semibold text-blue-900">Calendar Events</div>
                            <button onClick={fetchCalendar} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium">
                                {calendarLoading ? 'Loading...' : 'Load Events'}
                            </button>
                        </div>
                        {calendarLoading ? <div className="p-4 text-sm text-gray-500">Loading events...</div> : calendarEvents.length === 0 ? <div className="p-4 text-sm text-gray-500">No events found.</div> : (
                            <div className="overflow-x-auto max-h-[500px]">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="text-left px-4 py-2">Subject</th>
                                            <th className="text-left px-4 py-2">Start</th>
                                            <th className="text-left px-4 py-2">End</th>
                                            <th className="text-left px-4 py-2">Organizer</th>
                                            <th className="text-left px-4 py-2">View</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {calendarEvents.map((e) => (
                                            <tr key={e.id}>
                                                <td className="px-4 py-2">{e.subject}</td>
                                                <td className="px-4 py-2 whitespace-nowrap">{e.start ? new Date(e.start).toLocaleString() : '-'}</td>
                                                <td className="px-4 py-2 whitespace-nowrap">{e.end ? new Date(e.end).toLocaleString() : '-'}</td>
                                                <td className="px-4 py-2">{e.organizer || '-'}</td>
                                                <td className="px-4 py-2">
                                                    <button
                                                        onClick={() => openCalendarDetail(e.id)}
                                                        className="text-blue-600 hover:underline text-sm"
                                                    >
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {reviewModalItem && reviewDraft && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[88vh] overflow-hidden">
                        <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-slate-900">AI Review Confirmation</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Review the extracted details, edit anything missing, then confirm the final create/update action.
                                </p>
                            </div>
                            <button onClick={closeReviewModal} className="px-2 py-1 text-sm rounded border hover:bg-slate-100">
                                Close
                            </button>
                        </div>

                        <div className="p-4 overflow-auto max-h-[74vh] space-y-5">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="lg:col-span-2 bg-white border rounded-lg p-4 space-y-4">
                                    <div>
                                        <div className="text-xs text-slate-500 mb-1">Source email</div>
                                        <div className="text-sm font-semibold text-slate-900">{reviewModalItem.subject || '(No subject)'}</div>
                                        <div className="text-sm text-slate-600 mt-1">{reviewModalItem.fromName || reviewModalItem.fromEmail || '-'}</div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Intent</label>
                                            <input
                                                value={reviewDraft.intent || ''}
                                                onChange={(e) => updateReviewDraftField(['intent'], e.target.value)}
                                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Confidence</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="1"
                                                step="0.01"
                                                value={reviewDraft.confidence ?? 0}
                                                onChange={(e) => updateReviewDraftField(['confidence'], Number(e.target.value))}
                                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">AI Reason</label>
                                        <textarea
                                            rows={3}
                                            value={reviewDraft.reason || ''}
                                            onChange={(e) => updateReviewDraftField(['reason'], e.target.value)}
                                            className="w-full border rounded-lg px-3 py-2 text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-2">
                                    <div className="text-sm font-semibold text-blue-900">Prepared actions</div>
                                    <div className="text-xs text-slate-600">
                                        The approval below will use the edited draft in this screen.
                                    </div>
                                    <ul className="text-sm text-slate-700 space-y-1 list-disc pl-4">
                                        <li>{reviewDraft?.client?.companyName ? 'Client create/update ready' : 'No client name extracted yet'}</li>
                                        <li>{reviewDraft?.opportunity?.requirementSummary ? 'Opportunity data present' : 'Opportunity data is limited'}</li>
                                        <li>{reviewDraft?.meeting?.shouldCreateEvent ? 'Calendar event will be created on approval' : 'No calendar event will be created'}</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-white border rounded-lg p-4 space-y-4">
                                    <div className="text-sm font-semibold text-slate-900">Client Draft</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Company Name</label>
                                            <input
                                                value={reviewDraft?.client?.companyName || ''}
                                                onChange={(e) => updateReviewDraftField(['client', 'companyName'], e.target.value)}
                                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Sector</label>
                                            <input
                                                value={reviewDraft?.client?.sector || ''}
                                                onChange={(e) => updateReviewDraftField(['client', 'sector'], e.target.value)}
                                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Primary Contact Name</label>
                                            <input
                                                value={reviewDraft?.client?.contactPersons?.[0]?.name || ''}
                                                onChange={(e) => updateReviewDraftField(['client', 'contactPersons', 0, 'name'], e.target.value)}
                                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Designation</label>
                                            <input
                                                value={reviewDraft?.client?.contactPersons?.[0]?.designation || ''}
                                                onChange={(e) => updateReviewDraftField(['client', 'contactPersons', 0, 'designation'], e.target.value)}
                                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
                                            <input
                                                value={reviewDraft?.client?.contactPersons?.[0]?.department || ''}
                                                onChange={(e) => updateReviewDraftField(['client', 'contactPersons', 0, 'department'], e.target.value)}
                                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Contact Number</label>
                                            <input
                                                value={reviewDraft?.client?.contactPersons?.[0]?.contactNumber || ''}
                                                onChange={(e) => updateReviewDraftField(['client', 'contactPersons', 0, 'contactNumber'], e.target.value)}
                                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                                placeholder="+91 XXXXX XXXXX"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                                            <input
                                                value={reviewDraft?.client?.contactPersons?.[0]?.email || ''}
                                                onChange={(e) => updateReviewDraftField(['client', 'contactPersons', 0, 'email'], e.target.value)}
                                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Location</label>
                                            <input
                                                value={reviewDraft?.client?.contactPersons?.[0]?.location || ''}
                                                onChange={(e) => updateReviewDraftField(['client', 'contactPersons', 0, 'location'], e.target.value)}
                                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">LinkedIn</label>
                                            <input
                                                value={reviewDraft?.client?.contactPersons?.[0]?.linkedIn || ''}
                                                onChange={(e) => updateReviewDraftField(['client', 'contactPersons', 0, 'linkedIn'], e.target.value)}
                                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white border rounded-lg p-4 space-y-4">
                                    <div className="text-sm font-semibold text-slate-900">Opportunity Draft</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                                            <select
                                                value={reviewDraft?.opportunity?.type || 'Training'}
                                                onChange={(e) => updateReviewDraftField(['opportunity', 'type'], e.target.value)}
                                                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                                            >
                                                <option value="Training">Training</option>
                                                <option value="Product Support">Product Support</option>
                                                <option value="Resource Support">Resource Support</option>
                                                <option value="Vouchers">Vouchers</option>
                                                <option value="Content Development">Content Development</option>
                                                <option value="Lab Support">Lab Support</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Requirement Summary</label>
                                            <textarea
                                                rows={2}
                                                value={reviewDraft?.opportunity?.requirementSummary || ''}
                                                onChange={(e) => updateReviewDraftField(['opportunity', 'requirementSummary'], e.target.value)}
                                                className="w-full border rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                        
                                        {(reviewDraft?.opportunity?.type === 'Training' || !reviewDraft?.opportunity?.type) && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Technology</label>
                                                    <input value={reviewDraft?.opportunity?.technology || ''} onChange={(e) => updateReviewDraftField(['opportunity', 'technology'], e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Training Name</label>
                                                    <input value={reviewDraft?.opportunity?.trainingName || ''} onChange={(e) => updateReviewDraftField(['opportunity', 'trainingName'], e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Mode of Training</label>
                                                    <input value={reviewDraft?.opportunity?.modeOfTraining || ''} onChange={(e) => updateReviewDraftField(['opportunity', 'modeOfTraining'], e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Training Location</label>
                                                    <input value={reviewDraft?.opportunity?.trainingLocation || ''} onChange={(e) => updateReviewDraftField(['opportunity', 'trainingLocation'], e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Participants</label>
                                                    <input type="number" min="0" value={reviewDraft?.opportunity?.participants || 0} onChange={(e) => updateReviewDraftField(['opportunity', 'participants'], Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Days</label>
                                                    <input type="number" min="0" value={reviewDraft?.opportunity?.days || 0} onChange={(e) => updateReviewDraftField(['opportunity', 'days'], Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                            </>
                                        )}

                                        {reviewDraft?.opportunity?.type === 'Vouchers' && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Technology</label>
                                                    <input value={reviewDraft?.opportunity?.technology || ''} onChange={(e) => updateReviewDraftField(['opportunity', 'technology'], e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Exam Details</label>
                                                    <input value={reviewDraft?.opportunity?.examDetails || ''} onChange={(e) => updateReviewDraftField(['opportunity', 'examDetails'], e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">No of Vouchers</label>
                                                    <input type="number" min="0" value={reviewDraft?.opportunity?.noOfVouchers || 0} onChange={(e) => updateReviewDraftField(['opportunity', 'noOfVouchers'], Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Exam Location</label>
                                                    <input value={reviewDraft?.opportunity?.region || ''} onChange={(e) => updateReviewDraftField(['opportunity', 'region'], e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                            </>
                                        )}

                                        {reviewDraft?.opportunity?.type === 'Lab Support' && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Technology</label>
                                                    <input value={reviewDraft?.opportunity?.technology || ''} onChange={(e) => updateReviewDraftField(['opportunity', 'technology'], e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">No of IDs</label>
                                                    <input type="number" min="0" value={reviewDraft?.opportunity?.noOfIDs || 0} onChange={(e) => updateReviewDraftField(['opportunity', 'noOfIDs'], Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Duration</label>
                                                    <input value={reviewDraft?.opportunity?.duration || ''} onChange={(e) => updateReviewDraftField(['opportunity', 'duration'], e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Region</label>
                                                    <input value={reviewDraft?.opportunity?.region || ''} onChange={(e) => updateReviewDraftField(['opportunity', 'region'], e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                            </>
                                        )}

                                        {reviewDraft?.opportunity?.type === 'Resource Support' && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Resource Type</label>
                                                    <input value={reviewDraft?.opportunity?.resourceType || ''} onChange={(e) => updateReviewDraftField(['opportunity', 'resourceType'], e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Resource Count</label>
                                                    <input type="number" min="0" value={reviewDraft?.opportunity?.resourceCount || 0} onChange={(e) => updateReviewDraftField(['opportunity', 'resourceCount'], Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                            </>
                                        )}

                                        {reviewDraft?.opportunity?.type === 'Content Development' && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Content Type</label>
                                                    <input value={reviewDraft?.opportunity?.contentType || ''} onChange={(e) => updateReviewDraftField(['opportunity', 'contentType'], e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Delivery Format</label>
                                                    <input value={reviewDraft?.opportunity?.deliveryFormat || ''} onChange={(e) => updateReviewDraftField(['opportunity', 'deliveryFormat'], e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                            </>
                                        )}

                                        {reviewDraft?.opportunity?.type === 'Product Support' && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Project Scope</label>
                                                    <input value={reviewDraft?.opportunity?.projectScope || ''} onChange={(e) => updateReviewDraftField(['opportunity', 'projectScope'], e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Team Size</label>
                                                    <input type="number" min="0" value={reviewDraft?.opportunity?.teamSize || 0} onChange={(e) => updateReviewDraftField(['opportunity', 'teamSize'], Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border rounded-lg p-4 space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">Meeting / Calendar Event Draft</div>
                                        <div className="text-xs text-slate-500 mt-1">If enabled, approving this item will also create an Outlook calendar event.</div>
                                    </div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(reviewDraft?.meeting?.shouldCreateEvent)}
                                            onChange={(e) => updateReviewDraftField(['meeting', 'shouldCreateEvent'], e.target.checked)}
                                        />
                                        Create calendar event
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Event Subject</label>
                                        <input
                                            value={reviewDraft?.meeting?.subject || ''}
                                            onChange={(e) => updateReviewDraftField(['meeting', 'subject'], e.target.value)}
                                            className="w-full border rounded-lg px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Time Zone</label>
                                        <input
                                            value={reviewDraft?.meeting?.timeZone || ''}
                                            onChange={(e) => updateReviewDraftField(['meeting', 'timeZone'], e.target.value)}
                                            className="w-full border rounded-lg px-3 py-2 text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Start</label>
                                        <input
                                            type="datetime-local"
                                            value={reviewDraft?.meeting?.start ? String(reviewDraft.meeting.start).slice(0, 16) : ''}
                                            onChange={(e) => updateReviewDraftField(['meeting', 'start'], e.target.value)}
                                            className="w-full border rounded-lg px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">End</label>
                                        <input
                                            type="datetime-local"
                                            value={reviewDraft?.meeting?.end ? String(reviewDraft.meeting.end).slice(0, 16) : ''}
                                            onChange={(e) => updateReviewDraftField(['meeting', 'end'], e.target.value)}
                                            className="w-full border rounded-lg px-3 py-2 text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Location</label>
                                        <input
                                            value={reviewDraft?.meeting?.location || ''}
                                            onChange={(e) => updateReviewDraftField(['meeting', 'location'], e.target.value)}
                                            className="w-full border rounded-lg px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Meeting Link</label>
                                        <input
                                            value={reviewDraft?.meeting?.meetingLink || ''}
                                            onChange={(e) => updateReviewDraftField(['meeting', 'meetingLink'], e.target.value)}
                                            className="w-full border rounded-lg px-3 py-2 text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                                    <textarea
                                        rows={3}
                                        value={reviewDraft?.meeting?.description || ''}
                                        onChange={(e) => updateReviewDraftField(['meeting', 'description'], e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="px-4 py-3 border-t bg-slate-50 flex flex-wrap items-center justify-end gap-2">
                            <button
                                onClick={closeReviewModal}
                                className="px-4 py-2 rounded-lg border text-sm hover:bg-white"
                                disabled={reviewSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => reviewItem(reviewModalItem._id, 'reject')}
                                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
                                disabled={reviewSubmitting}
                            >
                                {reviewSubmitting ? 'Saving...' : 'Reject'}
                            </button>
                            <button
                                onClick={() => reviewItem(reviewModalItem._id, 'approve', reviewDraft)}
                                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 flex items-center gap-2"
                                disabled={reviewSubmitting}
                            >
                                <CheckCircle2 size={14} />
                                {reviewSubmitting ? 'Approving...' : 'Confirm & Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {calendarDetail && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
                        <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-slate-900">Calendar Event</h3>
                            <button onClick={() => setCalendarDetail(null)} className="px-2 py-1 text-sm rounded border hover:bg-slate-100">
                                Close
                            </button>
                        </div>
                        {calendarDetailLoading ? (
                            <div className="p-4 text-sm text-gray-500">Loading event...</div>
                        ) : (
                            <div className="p-4 space-y-3 overflow-auto max-h-[75vh]">
                                <div><span className="text-xs text-gray-500">Subject:</span> <div className="font-semibold">{calendarDetail.subject || '(No Subject)'}</div></div>
                                <div className="text-sm"><span className="text-gray-500">Organizer:</span> {calendarDetail.organizer || '-'}</div>
                                <div className="text-sm"><span className="text-gray-500">Location:</span> {calendarDetail.location || '-'}</div>
                                <div className="text-sm"><span className="text-gray-500">Start:</span> {calendarDetail.start ? new Date(calendarDetail.start).toLocaleString() : '-'}</div>
                                <div className="text-sm"><span className="text-gray-500">End:</span> {calendarDetail.end ? new Date(calendarDetail.end).toLocaleString() : '-'}</div>

                                <div className="border rounded p-3 bg-white">
                                    <div className="text-xs text-gray-500 mb-2">Event details</div>
                                    {calendarDetail.bodyHtml ? (
                                        <iframe title="event-body" className="w-full h-[320px] border rounded" srcDoc={calendarDetail.bodyHtml} />
                                    ) : (
                                        <pre className="text-sm whitespace-pre-wrap">{calendarDetail.bodyText || ''}</pre>
                                    )}
                                </div>

                                {calendarDetail.webLink ? (
                                    <a href={calendarDetail.webLink} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                                        Open in Outlook
                                    </a>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            )}


            {mailDetail && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
                        <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-slate-900">Email Detail</h3>
                            <button onClick={() => setMailDetail(null)} className="px-2 py-1 text-sm rounded border hover:bg-slate-100">
                                Close
                            </button>
                        </div>
                        {mailDetailLoading ? (
                            <div className="p-4 text-sm text-gray-500">Loading mail...</div>
                        ) : (
                            <div className="p-4 space-y-3 overflow-auto max-h-[75vh]">
                                <div><span className="text-xs text-gray-500">Subject:</span> <div className="font-semibold">{mailDetail.subject || '(No Subject)'}</div></div>
                                <div className="text-sm"><span className="text-gray-500">From:</span> {mailDetail.fromName || '-'} &lt;{mailDetail.fromEmail || '-'}&gt;</div>
                                <div className="text-sm"><span className="text-gray-500">To:</span> {(mailDetail.to || []).join(', ') || '-'}</div>
                                <div className="text-sm"><span className="text-gray-500">CC:</span> {(mailDetail.cc || []).join(', ') || '-'}</div>
                                <div className="text-sm"><span className="text-gray-500">Received:</span> {mailDetail.receivedAt ? new Date(mailDetail.receivedAt).toLocaleString() : '-'}</div>

                                <div className="border rounded p-3 bg-white">
                                    <div className="text-xs text-gray-500 mb-2">Exact mail body</div>
                                    {mailDetail.bodyHtml ? (
                                        <iframe title="mail-body" className="w-full h-[420px] border rounded" srcDoc={mailDetail.bodyHtml} />
                                    ) : (
                                        <pre className="text-sm whitespace-pre-wrap">{mailDetail.bodyText || ''}</pre>
                                    )}
                                </div>

                                {mailDetail.webLink ? (
                                    <a href={mailDetail.webLink} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                                        Open in Outlook
                                    </a>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailAutomationPage;
