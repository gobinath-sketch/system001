import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Users, Briefcase, CheckCircle, ChevronRight, X, ChevronDown } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import RevenueAnalyticsRow from './RevenueAnalyticsRow';
import { useCurrency } from '../../context/CurrencyContext';
import { useSocket } from '../../context/SocketContext';
import SafeResponsiveContainer from '../../components/charts/SafeResponsiveContainer';
import { API_BASE } from '../../config/api';
const OPPORTUNITY_TYPES = ['Training', 'Product Support', 'Resource Support', 'Vouchers', 'Content Development', 'Lab Support'];
const SalesExecutiveDashboard = ({
  user,
  customUserId,
  viewMode = 'self',
  setViewMode,
  showViewFilter = false,
  teamMembers = [],
  salesManagers = [],
  salesExecutives = [],
  isBusinessHead = false
}) => {
  const navigate = useNavigate();
  const {
    socket
  } = useSocket();
  const [clientHealth, setClientHealth] = useState({
    active: 0,
    mid: 0,
    inactive: 0
  });
  const [performance, setPerformance] = useState(null);
  const [allOpps, setAllOpps] = useState([]); // For Document Status Modal
  const [loading, setLoading] = useState(true);
  const {
    currency
  } = useCurrency();
  const [showDocModal, setShowDocModal] = useState(false);

  // Progress Modal State
  const [progressModal, setProgressModal] = useState({
    isOpen: false,
    stage: '',
    data: []
  });
  const [segmentTooltip, setSegmentTooltip] = useState({
    visible: false,
    text: '',
    color: '#1d4ed8',
    x: 0,
    y: 0
  });
  const openProgressModal = (stage, data) => {
    setProgressModal({
      isOpen: true,
      stage,
      data
    });
  };
  const EXCHANGE_RATE = 85; // Fixed rate for now
  const showSegmentTooltip = (event, text, color) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setSegmentTooltip({
      visible: true,
      text,
      color,
      x: rect.left + rect.width / 2,
      y: rect.top - 8
    });
  };
  const hideSegmentTooltip = () => {
    setSegmentTooltip(prev => ({
      ...prev,
      visible: false
    }));
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token} `
      };
      const params = customUserId ? {
        userId: customUserId
      } : {};
      const perfRes = await axios.get(`${API_BASE}/api/dashboard/performance/${customUserId || user.id}`, {
        headers
      });
      setPerformance(perfRes.data);

      // Fetch all opps for document status card and top 5 clients
      const docsRes = await axios.get(`${API_BASE}/api/dashboard/all-opportunities`, {
        headers,
        params
      });
      setAllOpps(docsRes.data);

      // Fetch client health metrics
      const healthRes = await axios.get(`${API_BASE}/api/dashboard/client-health`, {
        headers,
        params
      });
      setClientHealth(healthRes.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setLoading(false);
    }
  }, [customUserId, user.id]);
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);
  useEffect(() => {
    if (!socket) return;
    const handleEntityUpdated = event => {
      if (['opportunity', 'client', 'user', 'approval'].includes(event?.entity)) {
        fetchDashboardData();
      }
    };
    socket.on('entity_updated', handleEntityUpdated);
    return () => socket.off('entity_updated', handleEntityUpdated);
  }, [socket, fetchDashboardData]);

  // Helper to format money based on selected currency
  const formatMoney = amountInINR => {
    if (amountInINR === undefined || amountInINR === null) return '0';
    if (currency === 'INR') {
      return `₹${amountInINR.toLocaleString('en-IN')}`;
    } else {
      const amountInUSD = amountInINR / EXCHANGE_RATE;
      return `$${amountInUSD.toLocaleString('en-US', {
        maximumFractionDigits: 0
      })}`;
    }
  };

  // --- Global Time Filter State (Financial Year) ---
  const getFinancialYearStart = date => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = date.getMonth();
    return m >= 3 ? y : y - 1; // FY starts in April
  };
  const toFinancialYearLabel = fyStart => `${fyStart}-${fyStart + 1}`;
  const getCurrentFinancialYearLabel = () => {
    const now = new Date();
    const fyStart = getFinancialYearStart(now);
    return toFinancialYearLabel(fyStart);
  };
  const [selectedYear, setSelectedYear] = useState(getCurrentFinancialYearLabel());
  const [timeFilter, setTimeFilter] = useState('Yearly');

  const getOpportunityDate = opp => {
    if (opp.commonDetails?.startDate) {
      const startDate = new Date(opp.commonDetails.startDate);
      if (!Number.isNaN(startDate.getTime())) return startDate;
    }

    const monthField = opp.commonDetails?.monthOfTraining;
    let monthIdxFromField = -1;
    if (typeof monthField === 'number') {
      monthIdxFromField = monthField - 1;
    } else if (monthField && /^\d+$/.test(monthField.toString().trim())) {
      monthIdxFromField = Number(monthField) - 1;
    } else if (monthField) {
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      monthIdxFromField = months.indexOf(monthField.toString().toLowerCase().substring(0, 3));
    }
    const yearFromField = Number(opp.commonDetails?.year);
    if (!Number.isNaN(yearFromField) && yearFromField > 1900 && monthIdxFromField >= 0) {
      return new Date(yearFromField, monthIdxFromField, 1);
    }

    if (opp.createdAt) {
      const createdDate = new Date(opp.createdAt);
      if (!Number.isNaN(createdDate.getTime())) return createdDate;
    }

    return null;
  };

  // Helper: Get available financial years from opportunity dates
  const availableYears = React.useMemo(() => {
    const fyStarts = allOpps.map(opp => {
      const oppDate = getOpportunityDate(opp);
      return oppDate ? getFinancialYearStart(oppDate) : null;
    });
    const currentFyStart = getFinancialYearStart(new Date());
    return [...new Set([...fyStarts, currentFyStart])].filter(fy => fy !== null && fy > 1900).sort((a, b) => b - a).map(toFinancialYearLabel);
  }, [allOpps]);

  // Initialize Year once data is loaded
  // Initialize Year removed (defaulted to current year above)

  // --- Filter Logic ---
  const filteredOpps = React.useMemo(() => {
    if (!selectedYear) return allOpps;
    return allOpps.filter(opp => {
      const oppDate = getOpportunityDate(opp);
      if (!oppDate) return false;
      const oppFyStart = getFinancialYearStart(oppDate);
      if (toFinancialYearLabel(oppFyStart) !== selectedYear) return false;
      if (timeFilter === 'Yearly') return true;
      const monthIdx = oppDate.getMonth();

      // Financial Year month mapping
      // H1: Apr-Sep, H2: Oct-Mar, Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar
      if (timeFilter === 'H1') return monthIdx >= 3 && monthIdx <= 8;
      if (timeFilter === 'H2') return monthIdx >= 9 || monthIdx <= 2;
      if (timeFilter === 'Q1') return monthIdx >= 3 && monthIdx <= 5;
      if (timeFilter === 'Q2') return monthIdx >= 6 && monthIdx <= 8;
      if (timeFilter === 'Q3') return monthIdx >= 9 && monthIdx <= 11;
      if (timeFilter === 'Q4') return monthIdx >= 0 && monthIdx <= 2;
      return true;
    });
  }, [allOpps, selectedYear, timeFilter]);

  // --- Recalculate KPI Stats based on Filtered Data ---
  const filteredStats = React.useMemo(() => {
    return {
      totalOpportunities: filteredOpps.length,
      progress30: filteredOpps.filter(o => o.progressPercentage < 50).length,
      progress50: filteredOpps.filter(o => o.progressPercentage >= 50 && o.progressPercentage < 80).length,
      progress80: filteredOpps.filter(o => o.progressPercentage >= 80 && o.progressPercentage < 100).length,
      progress100: filteredOpps.filter(o => o.progressPercentage === 100).length
    };
  }, [filteredOpps]);

  // --- Recalculate Type Distribution for Chart ---
  const filteredTypeDist = React.useMemo(() => {
    const dist = OPPORTUNITY_TYPES.map(type => {
      const typeOpps = filteredOpps.filter(o => o.type === type);
      const count = typeOpps.length;
      const completedCount = typeOpps.filter(o => {
        const status = (o?.commonDetails?.status || o?.statusLabel || '').toString().toLowerCase();
        return o?.progressPercentage >= 100 || status === 'completed';
      }).length;
      const ongoingCount = Math.max(0, count - completedCount);
      const revenue = typeOpps.reduce((sum, o) => sum + (o.poValue || 0), 0);
      return {
        type,
        count,
        ongoingCount,
        completedCount,
        revenue
      };
    });
    return dist;
  }, [filteredOpps]);
  const opportunityChartData = React.useMemo(() => {
    return [...filteredTypeDist].sort((a, b) => b.count - a.count).map(item => ({
      ...item
    }));
  }, [filteredTypeDist]);
  const glassCardStyle = {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0))',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 0 30px rgba(255, 255, 255, 0.3), inset 0 0 10px rgba(255, 255, 255, 0.5)',
    borderTop: '1px solid rgba(255, 255, 255, 0.8)',
    borderLeft: '1px solid rgba(255, 255, 255, 0.8)',
    overflow: 'hidden',
    position: 'relative'
  };

  // Updated StatCard - Compact
  ({
    title,
    value,
    icon: Icon,
    bgColor,
    iconColor,
    subtext,
    onClick
  }) => <div onClick={onClick} style={glassCardStyle} className={`p-4 flex items-center space-x-3 ${onClick ? 'cursor-pointer hover:shadow-[0_8px_32px_0_rgba(255,255,255,0.3)] transition-all' : ''}`}>
            <div className={`p-2 rounded-full ${bgColor} flex items-center justify-center`}>
                {Icon && <Icon size={20} className={iconColor} />}
            </div>
            <div>
                <p className="text-xs text-black font-bold">{title}</p>
                <p className="text-lg font-bold text-black">{value}</p>
                {subtext && <p className="text-[10px] text-black font-bold">{subtext}</p>}
            </div>
        </div>;
  const CustomViewDropdown = ({
    viewMode,
    setViewMode,
    isBusinessHead,
    salesManagers,
    salesExecutives,
    teamMembers
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    useEffect(() => {
      const handleClickOutside = event => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const managerOptions = salesManagers && salesManagers.length > 0 ? salesManagers : (teamMembers || []).filter(m => m?.role === 'Sales Manager');
    const executiveOptions = salesExecutives && salesExecutives.length > 0 ? salesExecutives : (teamMembers || []).filter(m => m?.role === 'Sales Executive');
    const getName = id => {
      if (id === 'self') return 'My Dashboard';
      if (id === 'team') return 'Team Overview';
      const allUsers = [...managerOptions, ...executiveOptions, ...(teamMembers || [])];
      const found = allUsers.find(u => u._id === id);
      return found ? found.name : 'Unknown';
    };
    const handleSelect = value => {
      setViewMode(value);
      setIsOpen(false);
    };
    return <div className="relative" ref={dropdownRef}>
                <button type="button" onClick={() => setIsOpen(prev => !prev)} className="h-8 pl-3 pr-8 border border-gray-300 rounded-md text-sm font-medium bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 flex items-center w-full sm:min-w-[160px] justify-between relative">
                    <span className="truncate">{getName(viewMode)}</span>
                    <ChevronDown size={14} className="absolute right-2 text-gray-500" />
                </button>

                {isOpen && <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-[300] py-1 text-sm">
                        {isBusinessHead ? <>
                                <button type="button" className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${viewMode === 'self' ? 'font-bold text-blue-600' : 'text-gray-700'}`} onClick={() => handleSelect('self')}>
                                    My Dashboard
                                </button>

                                <div className="border-t border-gray-100 my-1"></div>

                                {managerOptions?.length > 0 && <div className="relative group">
                                        <div className="px-4 py-2 text-gray-700 hover:bg-gray-50 cursor-pointer flex justify-between items-center bg-gray-50/50">
                                            <span>Sales Managers</span>
                                            <ChevronRight size={14} className="text-gray-400" />
                                        </div>
                                        <div className="absolute left-full top-0 w-48 bg-white border border-gray-200 rounded-md shadow-lg hidden group-hover:block ml-1 py-1">
                                            {managerOptions.map(manager => <div key={manager._id} className={`px-4 py-2 hover:bg-gray-50 cursor-pointer ${viewMode === manager._id ? 'font-bold text-blue-600' : 'text-gray-700'}`} onClick={() => handleSelect(manager._id)}>
                                                    {manager.name}
                                                </div>)}
                                        </div>
                                    </div>}

                                {executiveOptions?.length > 0 && <div className="relative group">
                                        <div className="px-4 py-2 text-gray-700 hover:bg-gray-50 cursor-pointer flex justify-between items-center bg-gray-50/50">
                                            <span>Sales Executives</span>
                                            <ChevronRight size={14} className="text-gray-400" />
                                        </div>
                                        <div className="absolute left-full top-0 w-48 bg-white border border-gray-200 rounded-md shadow-lg hidden group-hover:block ml-1 py-1 max-h-[300px] overflow-y-auto">
                                            {executiveOptions.map(exec => <div key={exec._id} className={`px-4 py-2 hover:bg-gray-50 cursor-pointer ${viewMode === exec._id ? 'font-bold text-blue-600' : 'text-gray-700'}`} onClick={() => handleSelect(exec._id)}>
                                                    {exec.name}
                                                </div>)}
                                        </div>
                                    </div>}

                                {managerOptions.length === 0 && executiveOptions.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">No team members found</div>}
                            </> : <>
                                <button type="button" className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${viewMode === 'self' ? 'font-bold text-blue-600' : 'text-gray-700'}`} onClick={() => handleSelect('self')}>
                                    My Dashboard
                                </button>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button type="button" className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${viewMode === 'team' ? 'font-bold text-blue-600' : 'text-gray-700'}`} onClick={() => handleSelect('team')}>
                                    Team Overview
                                </button>
                                <div className="border-t border-gray-100 my-1"></div>
                                <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Team Members</div>
                                {(teamMembers || []).map(member => <div key={member._id} className={`px-4 py-2 hover:bg-gray-50 cursor-pointer ${viewMode === member._id ? 'font-bold text-blue-600' : 'text-gray-700'}`} onClick={() => handleSelect(member._id)}>
                                        {member.name}
                                    </div>)}
                            </>}
                    </div>}
            </div>;
  };
  const FilterControls = () => {
    const portalRoot = document.getElementById('header-filter-portal');
    if (!portalRoot) return null;
    return createPortal(<div className="flex items-center space-x-2">
                {/* View Filter - Only for Sales Managers */}
                {showViewFilter && <div className="relative" style={{
        zIndex: 100
      }}>
                        <div className="flex items-center space-x-2">
                            <label className="text-sm font-medium text-gray-700">View:</label>
                            <CustomViewDropdown viewMode={viewMode} setViewMode={setViewMode} isBusinessHead={isBusinessHead} salesManagers={salesManagers} salesExecutives={salesExecutives} teamMembers={teamMembers} />
                        </div>
                    </div>}

                {/* Year Filter */}
                <select value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)} className="h-8 pl-2 pr-6 border border-gray-300 rounded-md text-sm font-medium bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                    {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                </select>

                {/* Period Filter */}
                <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)} className="h-8 pl-2 pr-6 border border-gray-300 rounded-md text-sm font-medium bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="Yearly">Yearly</option>
                    <option value="H1">H1</option>
                    <option value="H2">H2</option>
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                </select>
            </div>, portalRoot);
  };
  if (loading) return <div className="p-8 text-center text-black font-bold">Loading Dashboard...</div>;

  // Chart Theme Colors - Brand Colors
  const chartColors = ['#0F3D75', '#1556A8', '#1D6FD1', '#2F86DE', '#55A2E8', '#80BBEE'];
  return <div className="p-3 sm:p-4 pb-0 space-y-4 bg-bg-page h-full">
            {/* Render Filters via Portal */}
            <FilterControls />
            <style>
                {`
                    @keyframes techChevronFlow {
                        0%, 100% { transform: translateX(0); opacity: 0.5; filter: drop-shadow(0 0 0 currentColor); }
                        50% { transform: translateX(3px); opacity: 1; filter: drop-shadow(0 0 4px currentColor); }
                    }
                    .tech-chevron {
                        animation: techChevronFlow 1.15s ease-in-out infinite;
                    }
                    .progress-stage-group {
                        position: relative;
                    }
                    .progress-stage-tip {
                        position: absolute;
                        top: 6px;
                        left: 50%;
                        transform: translate(-50%, -4px);
                        opacity: 0;
                        pointer-events: none;
                        background: #1d4ed8;
                        color: #fff;
                        font-size: 11px;
                        font-weight: 600;
                        line-height: 1;
                        padding: 7px 10px;
                        border-radius: 8px;
                        box-shadow: 0 10px 22px rgba(29, 78, 216, 0.35);
                        white-space: nowrap;
                        transition: opacity 0.18s ease, transform 0.18s ease;
                        z-index: 20;
                    }
                    .progress-stage-tip::after {
                        content: '';
                        position: absolute;
                        left: 50%;
                        bottom: -5px;
                        transform: translateX(-50%);
                        width: 0;
                        height: 0;
                        border-left: 5px solid transparent;
                        border-right: 5px solid transparent;
                        border-top: 5px solid #1d4ed8;
                    }
                    .progress-stage-group:hover .progress-stage-tip {
                        opacity: 1;
                        transform: translate(-50%, -10px);
                    }
                `}
            </style>
            {segmentTooltip.visible && <div className="fixed z-[120] pointer-events-none" style={{
      left: `${segmentTooltip.x}px`,
      top: `${segmentTooltip.y}px`,
      transform: 'translate(-50%, -100%)'
    }}>
                    <div className="relative px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white shadow-lg" style={{
          backgroundColor: segmentTooltip.color
        }}>
                        {segmentTooltip.text}
                        <span className="absolute left-1/2 -bottom-[5px] -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent" style={{
            borderTopColor: segmentTooltip.color
          }} />
                    </div>
                </div>}

            {/* 1. KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Client Health Segmentation (Global, not filtered by time usually) */}
                <div style={glassCardStyle} className="p-4 flex flex-col justify-center">
                    <div className="flex items-center space-x-2 mb-3">
                        <div className="p-1.5 rounded-full bg-blue-100">
                            <Users size={16} className="text-blue-600" />
                        </div>
                        <span className="text-base text-black font-bold">Clients (Total: {clientHealth.active + clientHealth.mid + clientHealth.inactive})</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center">
                        <div>
                            <p className="text-3xl font-bold text-emerald-600">{clientHealth.active}</p>
                            <p className="text-base text-black font-bold">Active</p>
                        </div>
                        <div className="border-l border-r border-gray-100">
                            <p className="text-3xl font-bold text-yellow-500">{clientHealth.mid}</p>
                            <p className="text-base text-black font-bold">Mild</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-red-600">{clientHealth.inactive}</p>
                            <p className="text-base text-black font-bold">Inactive</p>
                        </div>
                    </div>
                </div>

                {/* Total Opportunities - Filtered */}
                <div style={glassCardStyle} className="p-4 flex flex-col justify-center">
                    <div className="flex items-center space-x-2 mb-3">
                        <div className="p-1.5 rounded-full bg-purple-100">
                            <Briefcase size={16} className="text-purple-600" />
                        </div>
                        <span className="text-base text-black font-bold">Opportunities (Total: {filteredStats.totalOpportunities})</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center">
                        <div onClick={() => openProgressModal('30%', filteredOpps.filter(o => o.progressPercentage < 50))} className="progress-stage-group group flex flex-col items-center cursor-pointer hover:bg-white/10 rounded transition-colors">
                            <span className="progress-stage-tip">Opportunity created</span>
                            <p className="text-3xl font-bold text-red-600">{filteredStats.progress30}</p>
                            <p className="inline-flex items-center gap-1 text-base text-black font-bold">
                                30%
                                <span className="inline-flex items-center leading-none text-red-700 transition-transform group-hover:translate-x-0.5">
                                    <ChevronRight size={12} className="tech-chevron" />
                                    <ChevronRight size={12} className="tech-chevron" style={{
                  animationDelay: '0.12s'
                }} />
                                    <ChevronRight size={12} className="tech-chevron" style={{
                  animationDelay: '0.24s'
                }} />
                                </span>
                            </p>
                        </div>
                        <div onClick={() => openProgressModal('50%', filteredOpps.filter(o => o.progressPercentage >= 50 && o.progressPercentage < 80))} className="progress-stage-group group flex flex-col items-center border-l border-gray-100 cursor-pointer hover:bg-white/10 rounded transition-colors">
                            <span className="progress-stage-tip">Expenses filled</span>
                            <p className="text-3xl font-bold text-yellow-500">{filteredStats.progress50}</p>
                            <p className="inline-flex items-center gap-1 text-base text-black font-bold">
                                50%
                                <span className="inline-flex items-center leading-none text-yellow-700 transition-transform group-hover:translate-x-0.5">
                                    <ChevronRight size={12} className="tech-chevron" />
                                    <ChevronRight size={12} className="tech-chevron" style={{
                  animationDelay: '0.12s'
                }} />
                                    <ChevronRight size={12} className="tech-chevron" style={{
                  animationDelay: '0.24s'
                }} />
                                </span>
                            </p>
                        </div>
                        <div onClick={() => openProgressModal('80%', filteredOpps.filter(o => o.progressPercentage >= 80 && o.progressPercentage < 100))} className="progress-stage-group group flex flex-col items-center border-l border-gray-100 cursor-pointer hover:bg-white/10 rounded transition-colors">
                            <span className="progress-stage-tip">Client Proposal uploaded</span>
                            <p className="text-3xl font-bold text-indigo-600">{filteredStats.progress80}</p>
                            <p className="inline-flex items-center gap-1 text-base text-black font-bold">
                                80%
                                <span className="inline-flex items-center leading-none text-indigo-700 transition-transform group-hover:translate-x-0.5">
                                    <ChevronRight size={12} className="tech-chevron" />
                                    <ChevronRight size={12} className="tech-chevron" style={{
                  animationDelay: '0.12s'
                }} />
                                    <ChevronRight size={12} className="tech-chevron" style={{
                  animationDelay: '0.24s'
                }} />
                                </span>
                            </p>
                        </div>
                        <div onClick={() => openProgressModal('100%', filteredOpps.filter(o => o.progressPercentage === 100))} className="progress-stage-group group flex flex-col items-center border-l border-gray-100 cursor-pointer hover:bg-white/10 rounded transition-colors">
                            <span className="progress-stage-tip">Completed</span>
                            <p className="text-3xl font-bold text-emerald-600">{filteredStats.progress100}</p>
                            <p className="inline-flex items-center gap-1 text-base text-black font-bold">
                                100%
                                <span className="inline-flex items-center leading-none text-emerald-700 transition-transform group-hover:translate-x-0.5">
                                    <ChevronRight size={12} className="tech-chevron" />
                                    <ChevronRight size={12} className="tech-chevron" style={{
                  animationDelay: '0.12s'
                }} />
                                    <ChevronRight size={12} className="tech-chevron" style={{
                  animationDelay: '0.24s'
                }} />
                                </span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Document Status - Filtered */}
                <div style={glassCardStyle} className="p-4 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                            <div className="p-1.5 rounded-full bg-indigo-100">
                                <CheckCircle size={16} className="text-indigo-600" />
                            </div>
                            <span className="text-base text-black font-bold">Billing</span>
                        </div>
                        <button onClick={() => setShowDocModal(true)} className="px-3 py-1 bg-blue-600 rounded-md text-xs font-bold text-white border border-blue-600 hover:bg-blue-700 transition-colors">
                            <div className="flex items-center gap-1">
                                <span>View</span>
                                <ChevronRight size={14} />
                            </div>
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <p className="text-3xl font-bold text-gray">
                                {filteredOpps.length}
                            </p>
                            <p className="text-base text-black font-bold">Total</p>
                        </div>
                        <div className="border-l border-gray-100">
                            <p className="text-3xl font-bold text-blue-600">
                                {filteredOpps.filter(opp => opp.poDocument).length}
                            </p>
                            <p className="text-base text-black font-bold">POs</p>
                        </div>
                        <div className="border-l border-gray-100">
                            <p className="text-3xl font-bold text-slate-600">
                                {filteredOpps.filter(opp => opp.invoiceDocument).length}
                            </p>
                            <p className="text-base text-black font-bold">Invoices</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Revenue & Analytics Row - Filtered */}
            <RevenueAnalyticsRow loading={loading} allOpps={filteredOpps} filter={timeFilter} yearlyTarget={performance?.target || 0} currency={currency} formatMoney={formatMoney} EXCHANGE_RATE={EXCHANGE_RATE} showSetTargetButton={isBusinessHead ? viewMode === 'self' : showViewFilter && viewMode === 'team'} teamMembers={teamMembers} onRefreshData={fetchDashboardData} />

            {/* 3. Second Analytics Row */}
            <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                    {/* Left: Total Opportunities Ongoing / Completed (Count) - Filtered */}
                    <div style={glassCardStyle} className="p-4 md:p-5 flex flex-col min-h-[280px] md:min-h-[300px]">
                        <h3 className="text-base font-bold text-black mb-3 md:mb-4">Total Opportunities Ongoing / Completed</h3>
                        <div className="flex-1 w-full min-h-[205px]">
                            {opportunityChartData.length === 0 ? <div className="h-full flex items-center justify-center text-sm font-bold text-black">
                                    No opportunity data available
                                </div> : (() => {
              const totalCount = opportunityChartData.reduce((sum, d) => sum + d.count, 0);
              const radarData = opportunityChartData.map((item, index) => ({
                ...item,
                fill: chartColors[index % chartColors.length],
                share: totalCount > 0 ? Math.round(item.count / totalCount * 100) : 0,
                // Keep zero categories unplotted on radar (no fake tiny segment).
                radarValue: item.count > 0 ? Math.sqrt(item.count) : null
              }));
              const maxRadarValue = Math.max(...radarData.map(d => d.radarValue), 1);
              // Force 3 polygon rings and ensure the outer ring is exactly the max value,
              // so radial lines terminate at the hexagon edge without protruding.
              const radarTicks = [maxRadarValue / 3, maxRadarValue * 2 / 3, maxRadarValue];
              const typeColorMap = Object.fromEntries(radarData.map(d => [d.type, d.fill]));
              return <div className="h-full grid grid-cols-1 md:grid-cols-[47%_53%] gap-2 md:gap-3 items-center">
                                            <div className="h-full min-h-[195px] pr-1">
                                                <SafeResponsiveContainer minHeight={195}>
                                                    <RadarChart accessibilityLayer={false} data={radarData} cx="57%" cy="50%" outerRadius="60%" margin={{
                      top: 12,
                      right: 12,
                      left: 30,
                      bottom: 12
                    }}>
                                                        <PolarGrid stroke="#000000" strokeOpacity={0.75} />
                                                        <PolarAngleAxis dataKey="type" tick={({
                        payload,
                        x,
                        y,
                        textAnchor
                      }) => <text x={x} y={y} textAnchor={textAnchor} fill={typeColorMap[payload?.value] || '#374151'} fontSize={10} fontWeight={700}>
                                                                    {payload?.value}
                                                                </text>} axisLine={false} tickLine={false} />
                                                        <PolarRadiusAxis domain={[0, maxRadarValue]} ticks={radarTicks} tick={false} axisLine={false} />
                                                        <Radar name="Opportunities" dataKey="radarValue" stroke="#003D7A" fill="#1D6FD1" fillOpacity={0.35} strokeWidth={2.4} dot={false} activeDot={false} />
                                                    </RadarChart>
                                                </SafeResponsiveContainer>
                                            </div>
                                            <div className="h-full flex flex-col justify-center gap-2">
                                                {radarData.map(item => <div key={item.type} className="grid grid-cols-[10px_minmax(0,1fr)] items-center gap-2">
                                                        <span className="h-2.5 w-2.5 rounded-full" style={{
                      backgroundColor: item.fill
                    }} />
                                                        <div className="min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="min-w-0 flex items-center gap-2">
                                                                    <span className="text-[12px] md:text-[13px] font-semibold text-gray-800 truncate" title={item.type}>{item.type}</span>
                                                                    <span className="shrink-0 inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-blue-100 text-[11px] md:text-[12px] font-bold text-primary-blue">
                                                                        {item.count}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[11px] md:text-[12px] font-medium text-gray-500">{item.share}%</span>
                                                            </div>
                                                            <div className="mt-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                                                <div className="h-full rounded-full overflow-hidden flex" style={{
                          width: item.share > 0 ? `${Math.max(6, item.share)}%` : '0%'
                        }}>
                                                                    <div className="h-full" style={{
                            width: item.count > 0 ? `${item.ongoingCount / item.count * 100}%` : '0%',
                            backgroundColor: item.fill
                          }} onMouseEnter={e => showSegmentTooltip(e, `Ongoing: ${item.ongoingCount}`, item.fill)} onMouseLeave={hideSegmentTooltip}>
                                                                    </div>
                                                                    <div className="h-full bg-green-500" style={{
                            width: item.count > 0 ? `${item.completedCount / item.count * 100}%` : '0%'
                          }} onMouseEnter={e => showSegmentTooltip(e, `Completed: ${item.completedCount}`, '#22c55e')} onMouseLeave={hideSegmentTooltip}>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>)}
                                            </div>
                                        </div>;
            })()}
                        </div>
                    </div>

                    {/* Right: Top 5 Clients by Revenue - Filtered */}
                    <div style={glassCardStyle} className="p-4 md:p-5 flex flex-col min-h-[280px] md:min-h-[300px]">
                        <h3 className="text-sm font-bold text-black mb-3 md:mb-4">Top 5 Clients by Revenue</h3>
                        <div className="flex-1 overflow-hidden">
                            {(() => {
              // Calculate top 5 clients using PO Amount (poValue) from FILTERED OPPS
              const clientMap = {};
              filteredOpps.forEach(opp => {
                const cName = opp.clientName || 'Unknown';
                const revenue = opp.poValue || 0;
                clientMap[cName] = (clientMap[cName] || 0) + revenue;
              });
              const topClients = Object.entries(clientMap).map(([name, revenue]) => ({
                name,
                revenue
              })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
              if (topClients.length === 0) {
                return <div className="flex items-center justify-center h-full text-black font-bold text-sm">
                                            No client data available
                                        </div>;
              }
              const normalizedTopClients = [...topClients];
              while (normalizedTopClients.length < 5) {
                normalizedTopClients.push({
                  name: 'No client',
                  revenue: 0,
                  isPlaceholder: true
                });
              }
              return <div className="h-full grid grid-rows-5 gap-2">
                                        {normalizedTopClients.map((client, index) => <div key={index} className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors min-h-0 ${client.isPlaceholder ? 'bg-gray-50/60' : 'bg-gray-50 hover:bg-gray-100'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm ${client.isPlaceholder ? 'bg-gray-200 text-black' : 'bg-blue-100 text-blue-700'}`}>
                                                        {index + 1}
                                                    </div>
                                                    <span className={`font-bold text-sm ${client.isPlaceholder ? 'text-black font-bold' : 'text-black font-bold'}`}>
                                                        {client.name}
                                                    </span>
                                                </div>
                                                <span className={`font-bold text-sm ${client.isPlaceholder ? 'text-black font-bold' : 'text-green-600'}`}>
                                                    {client.isPlaceholder ? '-' : formatMoney(client.revenue)}
                                                </span>
                                            </div>)}
                                    </div>;
            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Document Status Modal */}
            {showDocModal && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                                <h2 className="text-xl font-bold text-gray-800">Document Status Overview</h2>
                                <button onClick={() => setShowDocModal(false)} className="text-gray-500 hover:text-gray-700">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="overflow-auto p-3 sm:p-6 flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="py-3 px-4 font-semibold text-gray-600">Opportunity ID</th>
                                            <th className="py-3 px-4 font-semibold text-gray-600">Client</th>
                                            <th className="py-3 px-4 font-semibold text-gray-600 text-center">PO Status</th>
                                            <th className="py-3 px-4 font-semibold text-gray-600 text-center">Invoice Status</th>
                                            <th className="py-3 px-4 font-semibold text-gray-600">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredOpps.map(opp => <tr key={opp._id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 font-mono text-primary-blue">{opp.opportunityNumber}</td>
                                                <td className="py-3 px-4 text-gray-800">{opp.clientName}</td>
                                                <td className="py-3 px-4 text-center">
                                                    {opp.poDocument ? <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                                            <CheckCircle size={12} className="mr-1" /> Uploaded
                                                        </span> : <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                                            Pending
                                                        </span>}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {opp.invoiceDocument ? <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                                            <CheckCircle size={12} className="mr-1" /> Uploaded
                                                        </span> : <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                                            Pending
                                                        </span>}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <button onClick={() => navigate(`/opportunities/${opp._id}`)} className="text-primary-blue hover:underline text-sm">
                                                        View
                                                    </button>
                                                </td>
                                            </tr>)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>}

            {/* NEW: Progress Breakdown Modal */}
            {progressModal.isOpen && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h2 className="text-xl font-bold text-gray-800">
                                {progressModal.stage} Opportunities ({progressModal.data.length})
                            </h2>
                            <button onClick={() => setProgressModal({
            ...progressModal,
            isOpen: false
          })} className="text-gray-500 hover:text-gray-700">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="overflow-auto p-3 sm:p-6 flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="py-3 px-4 font-semibold text-gray-600">Opportunity ID</th>
                                        <th className="py-3 px-4 font-semibold text-gray-600 w-1/3">Progress</th>
                                        <th className="py-3 px-4 font-semibold text-gray-600">Next Action Required</th>
                                        <th className="py-3 px-4 font-semibold text-gray-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {progressModal.data.length > 0 ? progressModal.data.map(opp => <tr key={opp._id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 font-mono text-primary-blue font-bold">
                                                    {opp.opportunityNumber}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-600 rounded-full" style={{
                        width: `${opp.progressPercentage || 0}%`
                      }}></div>
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-700 w-8">{opp.progressPercentage || 0}%</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm font-medium text-amber-600">
                                                    {opp.nextAction || 'Review Details'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <button onClick={() => navigate(`/opportunities/${opp._id}`)} className="text-primary-blue hover:underline text-sm font-bold">
                                                        OPEN
                                                    </button>
                                                </td>
                                            </tr>) : <tr>
                                            <td colSpan="4" className="py-8 text-center text-gray-500 italic">
                                                No opportunities found in this stage.
                                            </td>
                                        </tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>}
        </div>;
};
export default SalesExecutiveDashboard;
