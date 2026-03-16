import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Briefcase, ChevronRight, BarChart2, DollarSign, Activity, FileText, X, Users, AlertTriangle, ArrowUpRight, ArrowDownRight, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useSocket } from '../context/SocketContext';
import AnimatedNumber from '../components/common/AnimatedNumber';
import { API_BASE, API_ENDPOINTS } from '../config/api';

const DeliveryDashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const { currency } = useCurrency();
  const EXCHANGE_RATE = 85;

  // --- Global Time Filter State (Financial Year) ---
  const getFinancialYearStart = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = date.getMonth();
    return m >= 3 ? y : y - 1; // FY starts in April
  };

  const toFinancialYearLabel = (fyStart) => `${fyStart}-${fyStart + 1}`;

  const getCurrentFinancialYearLabel = () => {
    const now = new Date();
    const fyStart = getFinancialYearStart(now);
    return toFinancialYearLabel(fyStart);
  };

  // State Variables for Filters
  const [selectedYear, setSelectedYear] = useState(getCurrentFinancialYearLabel());
  const [timeFilter, setTimeFilter] = useState('Yearly');
  const [selectedMonth, setSelectedMonth] = useState('All');

  // Default 3 years back + 1 forward for dropdown options
  const availableYears = useMemo(() => {
    const currentYear = getFinancialYearStart(new Date());
    return [
      toFinancialYearLabel(currentYear + 1),
      toFinancialYearLabel(currentYear),
      toFinancialYearLabel(currentYear - 1),
      toFinancialYearLabel(currentYear - 2),
    ];
  }, []);

  const monthOptions = ['All', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const roleControls = {
    isHead: user?.role === 'Delivery Head' || user?.role === 'Business Head' || user?.role === 'Super Admin' || user?.role === 'Director',
    isExecutive: user?.role === 'Delivery Executive'
  };

  // --- Data States ---
  const [kpis, setKpis] = useState({ opportunities: { ongoing: 0, completed: 0, upcoming: 0, total: 0 }, financials: { revenue: 0, expense: 0, grossProfit: 0, gpPercent: 0 } });
  const [overviewData, setOverviewData] = useState([]);
  const [teamPerformanceData, setTeamPerformanceData] = useState([]);
  const [revenueTrendData, setRevenueTrendData] = useState([]);
  const [topVendorsData, setTopVendorsData] = useState([]);

  // Modals
  const [overviewModal, setOverviewModal] = useState({ isOpen: false, type: '', data: [] });

  // Sorting & Filtering State
  const [overviewSortConfig, setOverviewSortConfig] = useState({ key: null, direction: 'asc' });
  const [overviewFilters, setOverviewFilters] = useState({ salesPerson: '', type: '', deliveryExec: '' });

  const uniqueSalesPersons = useMemo(() => {
    const set = new Set(overviewData.map(d => d.salesPerson));
    return Array.from(set).filter(Boolean).sort();
  }, [overviewData]);

  const uniqueTypes = useMemo(() => {
    const set = new Set(overviewData.map(d => d.type));
    return Array.from(set).filter(Boolean).sort();
  }, [overviewData]);

  const uniqueTeamMembers = useMemo(() => {
    const set = new Set(overviewData.map(d => d.teamMember));
    return Array.from(set).filter(Boolean).sort();
  }, [overviewData]);

  const sortedAndFilteredOverviewData = useMemo(() => {
    let data = [...overviewData];

    if (overviewFilters.salesPerson) {
      data = data.filter(d => d.salesPerson === overviewFilters.salesPerson);
    }
    if (overviewFilters.type) {
      data = data.filter(d => d.type === overviewFilters.type);
    }
    if (overviewFilters.deliveryExec) {
      if (overviewFilters.deliveryExec === '__self__') {
        data = data.filter(d => d.teamMember === user?.name);
      } else {
        data = data.filter(d => d.teamMember === overviewFilters.deliveryExec);
      }
    }

    if (overviewSortConfig.key) {
      data.sort((a, b) => {
        let aValue = a[overviewSortConfig.key];
        let bValue = b[overviewSortConfig.key];

        if (aValue < bValue) return overviewSortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return overviewSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [overviewData, overviewSortConfig, overviewFilters, user]);

  const handleOverviewSort = (key) => {
    let direction = 'asc';
    if (overviewSortConfig.key === key && overviewSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setOverviewSortConfig({ key, direction });
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedYear, timeFilter, selectedMonth]);

  useEffect(() => {
    if (!socket) return;
    const handleEntityUpdated = (event) => {
      if (['opportunity'].includes(event?.entity)) {
        fetchDashboardData();
      }
    };
    socket.on('entity_updated', handleEntityUpdated);
    return () => socket.off('entity_updated', handleEntityUpdated);
  }, [socket, selectedYear, timeFilter, selectedMonth]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Build Query Params string
      const params = new URLSearchParams();
      if (selectedYear) params.append('year', selectedYear);

      let filterVal = timeFilter;
      if (selectedMonth !== 'All') {
        filterVal = selectedMonth;
      }
      if (filterVal) params.append('filter', filterVal);

      const queryString = `?${params.toString()}`;

      // API Calls
      const kpiRes = axios.get(`${API_BASE}${API_ENDPOINTS.dashboard.delivery.kpis}${queryString}`, { headers });
      const overviewRes = axios.get(`${API_BASE}${API_ENDPOINTS.dashboard.delivery.overview}${queryString}`, { headers });
      const trendRes = axios.get(`${API_BASE}${API_ENDPOINTS.dashboard.delivery.revenueTrend}${queryString}`, { headers });
      const vendorRes = axios.get(`${API_BASE}${API_ENDPOINTS.dashboard.delivery.topVendors}${queryString}`, { headers });

      const requests = [kpiRes, overviewRes, trendRes, vendorRes];

      // Conditionally add Team Performance for Heads
      let teamPerfIndex = -1;
      if (roleControls.isHead) {
        teamPerfIndex = requests.length;
        requests.push(axios.get(`${API_BASE}${API_ENDPOINTS.dashboard.delivery.teamPerformance}${queryString}`, { headers }));
      }

      const responses = await Promise.all(requests);

      setKpis(responses[0].data);
      setOverviewData(responses[1].data);
      setRevenueTrendData(responses[2].data);
      setTopVendorsData(responses[3].data);

      if (teamPerfIndex > -1) {
        setTeamPerformanceData(responses[teamPerfIndex].data);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setLoading(false);
    }
  };

  // Helper to format money
  const formatMoney = (amountInINR) => {
    if (amountInINR === undefined || amountInINR === null) return '0';
    if (currency === 'INR') {
      return `₹${amountInINR.toLocaleString('en-IN')}`;
    } else {
      const amountInUSD = amountInINR / EXCHANGE_RATE;
      return `$${amountInUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
  };

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

  const FilterControls = () => {
    const portalRoot = document.getElementById('header-filter-portal');
    if (!portalRoot) return null;
    return createPortal(
      <div className="flex items-center gap-2">
        {/* Year Filter */}
        <select value={selectedYear || ''} onChange={e => { setSelectedYear(e.target.value); }} className="h-9 pl-3 pr-8 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-1 focus:ring-primary-blue hover:bg-gray-50 cursor-pointer shadow-sm">
          {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
        </select>

        {/* Period Filter */}
        <select value={timeFilter} onChange={e => { setTimeFilter(e.target.value); setSelectedMonth('All'); }} className="h-9 pl-3 pr-8 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-1 focus:ring-primary-blue hover:bg-gray-50 cursor-pointer shadow-sm">
          <option value="Yearly">Yearly</option>
          <option value="H1">H1</option>
          <option value="H2">H2</option>
          <option value="Q1">Q1</option>
          <option value="Q2">Q2</option>
          <option value="Q3">Q3</option>
          <option value="Q4">Q4</option>
          {/* Month Selection triggers standard "All" mapping or enables specific drop down next */}
        </select>

        {/* Specific Month Filter if "Yearly" is bypassed for precise months */}
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="h-9 pl-3 pr-8 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-1 focus:ring-primary-blue hover:bg-gray-50 cursor-pointer shadow-sm" style={{ display: timeFilter === 'Yearly' ? 'block' : 'none' }}>
          {monthOptions.map(month => <option key={month} value={month}>{month}</option>)}
        </select>
      </div>,
      portalRoot
    );
  };

  if (loading) return <div className="p-8 flex items-center justify-center font-bold text-gray-500">Loading Delivery Dashboard...</div>;

  const isNegativeGp = kpis.financials.gpPercent < 0;

  return (
    <div className="p-3 sm:p-4 pb-0 space-y-4 bg-bg-page flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <FilterControls />
      <style>
        {`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

                @keyframes slideRight {
                    0%, 100% { transform: translateX(0); opacity: 0.4; }
                    50% { transform: translateX(5px); opacity: 1; }
                }
                .slide-arrow {
                    animation: slideRight 1.2s ease-in-out infinite;
                }
                .slide-arrow:nth-child(2) { animation-delay: 0.15s; }
                .slide-arrow:nth-child(3) { animation-delay: 0.3s; }
                `}
      </style>

      {/* --- TOP ROW: KPI CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 min-h-[140px]">
        {/* Card 1: Opportunities (Unaffected by Filter logic) */}
        <div style={glassCardStyle} className="p-4 flex flex-col justify-center cursor-pointer relative" onClick={() => setOverviewModal({ isOpen: true })}>
          {/* Sliding arrow at top right */}
          <div className="absolute top-3 right-3 flex items-center text-gray-900">
            <ChevronRight size={14} className="slide-arrow" />
            <ChevronRight size={14} className="slide-arrow" />
            <ChevronRight size={14} className="slide-arrow" />
          </div>
          <div className="flex items-center space-x-2 mb-3">
            <div className="p-1.5 rounded-full bg-purple-100">
              <Briefcase size={16} className="text-purple-600" />
            </div>
            <span className="text-xl text-black font-bold">Opportunities&nbsp;<span className="text-lg font-bold">(Total: <AnimatedNumber value={kpis.opportunities.total} />)</span></span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center">

            <div className="group flex flex-col items-center cursor-pointer hover:bg-white/10 rounded transition-colors" onClick={(e) => { e.stopPropagation(); setOverviewModal({ isOpen: true }); }}>
              <p className="text-3xl font-bold text-amber-500"><AnimatedNumber value={kpis.opportunities.ongoing} /></p>
              <p className="text-base text-black font-bold mt-1">Ongoing</p>
            </div>

            <div className="group flex flex-col items-center cursor-pointer hover:bg-white/10 rounded transition-colors" onClick={(e) => { e.stopPropagation(); setOverviewModal({ isOpen: true }); }}>
              <p className="text-3xl font-bold text-blue-600"><AnimatedNumber value={kpis.opportunities.upcoming} /></p>
              <p className="text-base text-black font-bold mt-1">Upcoming</p>
            </div>

            <div className="group flex flex-col items-center cursor-pointer hover:bg-white/10 rounded transition-colors" onClick={(e) => { e.stopPropagation(); setOverviewModal({ isOpen: true }); }}>
              <p className="text-3xl font-bold text-emerald-600"><AnimatedNumber value={kpis.opportunities.completed} /></p>
              <p className="text-base text-black font-bold mt-1">Completed</p>
            </div>

          </div>
        </div>

        {/* Card 2: Revenue (Affected by Filter) */}
        <div style={glassCardStyle} className="p-4 flex flex-col justify-center">
          <div className="flex items-center space-x-2 mb-3">
            <div className="p-1.5 rounded-full bg-blue-100">
              <DollarSign size={18} className="text-primary-blue" />
            </div>
            <span className="text-lg text-black font-bold">Earned Revenue</span>
          </div>
          <p className="text-4xl font-bold text-primary-blue ml-1">
            <AnimatedNumber value={kpis.financials.revenue} formatValue={(v) => formatMoney(Math.round(v))} />
          </p>
        </div>

        {/* Card 3: Gross Profit (Affected by Filter) */}
        <div style={glassCardStyle} className={`p-4 flex flex-col justify-center ${isNegativeGp ? 'border-red-200' : 'border-emerald-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className={`p-1.5 rounded-full ${isNegativeGp ? 'bg-red-100' : 'bg-emerald-100'}`}>
                <Activity size={18} className={isNegativeGp ? 'text-red-600' : 'text-emerald-600'} />
              </div>
              <span className="text-lg text-black font-bold">Gross Profit</span>
            </div>
            <div className={`flex items-center gap-0.5 font-bold px-3 py-1 rounded-full text-sm ${isNegativeGp ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {isNegativeGp ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
              <AnimatedNumber value={kpis.financials.gpPercent} formatValue={(v) => `${v.toFixed(1)}%`} />
            </div>
          </div>
          <p className={`text-4xl font-bold ml-1 ${isNegativeGp ? 'text-red-600' : 'text-emerald-600'}`}>
            <AnimatedNumber value={kpis.financials.grossProfit} formatValue={(v) => formatMoney(Math.round(v))} />
          </p>
        </div>
      </div>

      {/* MAIN TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 flex-1 min-h-[500px] lg:min-h-0">

        {/* --- LEFT COLUMN: MAIN OVERVIEW TABLE --- */}
        <div style={glassCardStyle} className="lg:col-span-2 flex flex-col p-4 rounded-xl min-h-[400px] lg:h-full">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h3 className="text-xl font-bold text-gray-800">Delivery Overview</h3>
            {/* Delivery Exec Filter - only for Head roles */}
            {roleControls.isHead && (
              <div className="relative flex items-center group">
                <select
                  value={overviewFilters.deliveryExec}
                  onChange={(e) => setOverviewFilters(prev => ({ ...prev, deliveryExec: e.target.value }))}
                  className="text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg px-3 py-1.5 pr-8 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer hover:border-gray-400 shadow-sm"
                >
                  <option value="">All Delivery Persons</option>
                  <option value="__self__">Self</option>
                  {uniqueTeamMembers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <ChevronDown size={14} strokeWidth={3} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar border border-gray-200 rounded-lg relative bg-white">
            <table className="w-full text-left table-fixed">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 shadow-sm z-10 w-full">
                <tr>
                  <th className="py-4 px-4 align-middle w-[20%]">
                    <div className="flex items-center text-sm font-bold text-gray-500 uppercase">Opp ID</div>
                  </th>
                  <th className="py-4 px-4 align-middle w-[15%]">
                    <div className="relative flex items-center group w-full">
                      <select value={overviewFilters.type} onChange={(e) => setOverviewFilters(prev => ({ ...prev, type: e.target.value }))} className="text-sm font-bold text-gray-500 uppercase bg-transparent border-none appearance-none pr-6 py-0 focus:ring-0 cursor-pointer outline-none hover:text-gray-800 focus:outline-none focus:bg-transparent -ml-1">
                        <option value="" className="text-gray-800">TYPE</option>
                        {uniqueTypes.map(t => <option key={t} value={t} className="text-gray-800 uppercase">{t}</option>)}
                      </select>
                      <ChevronDown size={16} strokeWidth={3} className="ml-1 text-gray-500 group-hover:text-gray-800 pointer-events-none" />
                    </div>
                  </th>
                  <th className="py-4 px-4 align-middle w-[15%]">
                    <div className="relative flex items-center group w-full">
                      <select value={overviewFilters.salesPerson} onChange={(e) => setOverviewFilters(prev => ({ ...prev, salesPerson: e.target.value }))} className="text-sm font-bold text-gray-500 uppercase bg-transparent border-none appearance-none pr-6 py-0 focus:ring-0 cursor-pointer outline-none hover:text-gray-800 focus:outline-none focus:bg-transparent -ml-1">
                        <option value="" className="text-gray-800">SALES REP</option>
                        {uniqueSalesPersons.map(s => <option key={s} value={s} className="text-gray-800 uppercase">{s}</option>)}
                      </select>
                      <ChevronDown size={16} strokeWidth={3} className="ml-1 text-gray-500 group-hover:text-gray-800 pointer-events-none" />
                    </div>
                  </th>
                  <th className="py-4 px-4 text-left align-middle cursor-pointer hover:bg-gray-100 transition-colors w-[12%]" onClick={() => handleOverviewSort('revenue')}>
                    <div className="flex items-center text-sm font-bold text-gray-500 uppercase gap-2">Revenue <span>{overviewSortConfig.key === 'revenue' && (overviewSortConfig.direction === 'asc' ? '↑' : '↓')}</span></div>
                  </th>
                  <th className="py-4 px-4 text-left align-middle cursor-pointer hover:bg-gray-100 transition-colors w-[13%]" onClick={() => handleOverviewSort('expense')}>
                    <div className="flex items-center text-sm font-bold text-gray-500 uppercase gap-2">Expense <span>{overviewSortConfig.key === 'expense' && (overviewSortConfig.direction === 'asc' ? '↑' : '↓')}</span></div>
                  </th>
                  <th className="py-4 px-4 text-left align-middle cursor-pointer hover:bg-gray-100 transition-colors w-[13%]" onClick={() => handleOverviewSort('gp')}>
                    <div className="flex items-center text-sm font-bold text-gray-500 uppercase gap-2">Profit <span>{overviewSortConfig.key === 'gp' && (overviewSortConfig.direction === 'asc' ? '↑' : '↓')}</span></div>
                  </th>
                  <th className="py-4 px-4 text-left align-middle cursor-pointer hover:bg-gray-100 transition-colors w-[12%]" onClick={() => handleOverviewSort('gpPercent')}>
                    <div className="flex items-center text-sm font-bold text-gray-500 uppercase gap-2">GP % <span>{overviewSortConfig.key === 'gpPercent' && (overviewSortConfig.direction === 'asc' ? '↑' : '↓')}</span></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedAndFilteredOverviewData.length > 0 ? sortedAndFilteredOverviewData.map((row) => (
                  <tr key={row._id} onClick={() => navigate(`/opportunities/${row._id}`)} className="cursor-pointer hover:bg-blue-50/40 transition-colors">
                    <td className="py-4 px-4 font-mono font-bold text-primary-blue text-lg truncate" title={row.opportunityNumber}>{row.opportunityNumber}</td>
                    <td className="py-4 px-4 text-lg font-semibold text-gray-600 truncate" title={row.type}>{row.type}</td>
                    <td className="py-4 px-4 text-lg text-gray-600 truncate" title={row.salesPerson}>{row.salesPerson}</td>
                    <td className="py-4 px-4 text-lg text-left font-semibold text-gray-700">{formatMoney(row.revenue)}</td>
                    <td className="py-4 px-4 text-lg text-left font-semibold text-gray-700">{formatMoney(row.expense)}</td>
                    <td className={`py-4 px-4 text-lg text-left font-bold ${row.gp < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatMoney(row.gp)}
                    </td>
                    <td className="py-4 px-4 text-left">
                      <div className={`inline-flex items-center px-3 py-1.5 rounded-md text-base font-black ${row.gpPercent < 5 ? 'bg-white text-red-600' : 'bg-white text-gray-600'}`}>
                        {row.gpPercent.toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-gray-400 font-medium">No opportunities match the selected criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- RIGHT COLUMN: CHARTS & CARDS --- */}
        <div className="lg:col-span-1 flex flex-col gap-4 lg:h-full min-w-0">

          {/* Dynamic Chart Slot (Trend OR Team Performance) */}
          {roleControls.isHead ? (
            // Delivery Head sees Team Performance
            <div style={glassCardStyle} className="p-4 flex flex-col flex-1 min-h-[250px] rounded-xl shrink-0 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-indigo-600" />
                  <h3 className="text-lg font-bold text-gray-800">Team Performance</h3>
                </div>
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar pr-2 relative">
                {teamPerformanceData.length > 0 ? (
                  <table className="w-full text-left text-base">
                    <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-gray-200 shadow-sm text-sm">
                      <tr>
                        <th className="py-3 px-3 font-bold text-gray-600 uppercase tracking-wide">Rank</th>
                        <th className="py-3 px-3 font-bold text-gray-600 uppercase tracking-wide">Executive</th>
                        <th className="py-3 px-3 font-bold text-gray-600 uppercase tracking-wide text-center">Assigned</th>
                        <th className="py-3 px-3 font-bold text-gray-600 uppercase tracking-wide text-center">Completed</th>
                        <th className="py-3 px-3 font-bold text-gray-600 uppercase tracking-wide text-right">Revenue</th>
                        <th className="py-3 px-3 font-bold text-gray-600 uppercase tracking-wide text-right">Avg GP%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {teamPerformanceData.map((data, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="py-4 px-3 font-black text-gray-400">{idx + 1}</td>
                          <td className="py-4 px-3 font-bold text-gray-800">{data.name}</td>
                          <td className="py-4 px-3 text-center font-bold text-purple-600">{data.assigned}</td>
                          <td className="py-4 px-3 text-center font-bold text-indigo-600">{data.completed}</td>
                          <td className="py-4 px-3 text-right font-semibold text-emerald-600">{formatMoney(data.revenue)}</td>
                          <td className="py-4 px-3 text-right">
                            <span className={`font-bold px-3 py-1 rounded-md text-sm ${data.avgGpPercent < 15 ? 'text-red-700 bg-red-50' : data.avgGpPercent >= 30 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                              {data.avgGpPercent}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 font-medium">No team data found.</div>
                )}
              </div>
            </div>
          ) : (
            // Delivery Executive sees Revenue vs Expense Trend
            <div style={glassCardStyle} className="p-4 flex flex-col flex-1 min-h-[250px] rounded-xl shrink-0 bg-gradient-to-br from-blue-50/40 to-white/90">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={20} className="text-primary-blue" />
                <h3 className="text-lg font-bold text-gray-800">Revenue vs Expense</h3>
              </div>
              <div className="flex-1 w-full min-h-0">
                {revenueTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#003D7A" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#003D7A" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={5} />
                      <YAxis
                        axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }}
                        tickFormatter={(val) => {
                          const absNum = Math.abs(val);
                          if (absNum >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
                          if (absNum >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
                          if (absNum >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
                          return formatMoney(val);
                        }}
                      />
                      <Tooltip formatter={(value) => [formatMoney(value), '']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#003D7A" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                      <Area type="monotone" dataKey="expense" name="Expense" stroke="#DC2626" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-400 font-medium">No trend data found.</div>
                )}
              </div>
            </div>
          )}

          {/* Top 5 Vendors Horizontal Chart */}
          <div style={glassCardStyle} className="p-4 flex flex-col flex-1 min-h-[250px] rounded-xl shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-red-500" />
                <h3 className="text-lg font-bold text-gray-800">Top 5 Vendors by Expense</h3>
              </div>
            </div>
            <div className="flex-1 w-full min-h-0">
              {topVendorsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={topVendorsData} margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#4B5563', fontWeight: 600 }} />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      formatter={(value) => [formatMoney(value), 'Total Paid']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="expense" radius={[0, 4, 4, 0]} barSize={24}>
                      {topVendorsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(348, 83%, ${50 + (index * 8)}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 font-medium">No vendor expense records.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Opportunities Type Summary Modal */}
      {overviewModal.isOpen && (() => {
        const opportunityTypes = [
          'Training',
          'Vouchers',
          'Lab Support',
          'Product Support',
          'Resource Support',
          'Content Development',
        ];
        // Build summary per type
        const typeRows = opportunityTypes.map(typeName => {
          const forType = overviewData.filter(o => (o.type || '').trim().toLowerCase() === typeName.toLowerCase());
          const ongoing = forType.filter(o => o.progressPercentage < 100 && o.status !== 'Completed' && o.status !== 'Canceled').length;
          const completed = forType.filter(o => o.progressPercentage === 100 || o.status === 'Completed').length;
          const upcoming = forType.filter(o => o.status === 'Upcoming').length;
          const total = forType.length;
          return { typeName, ongoing, completed, upcoming, total };
        });
        // Also add an "Other" row for types not in the list
        const knownTypes = opportunityTypes.map(t => t.toLowerCase());
        const otherOpps = overviewData.filter(o => !knownTypes.includes((o.type || '').trim().toLowerCase()));
        if (otherOpps.length > 0) {
          typeRows.push({
            typeName: 'Other',
            ongoing: otherOpps.filter(o => o.progressPercentage < 100 && o.status !== 'Completed' && o.status !== 'Canceled').length,
            completed: otherOpps.filter(o => o.progressPercentage === 100 || o.status === 'Completed').length,
            upcoming: otherOpps.filter(o => o.status === 'Upcoming').length,
            total: otherOpps.length,
          });
        }
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setOverviewModal({ isOpen: false })}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Opportunities by Type</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Showing {overviewData.length} opportunities for selected period</p>
                </div>
                <button onClick={() => setOverviewModal({ isOpen: false })} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>
              <div className="overflow-auto p-3 sm:p-6 flex-1">
                <table className="w-full text-left border-collapse text-base">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-4 px-5 font-semibold text-gray-600 text-base">Opportunity Type</th>
                      <th className="py-4 px-5 font-semibold text-amber-600 text-base text-center">Ongoing</th>
                      <th className="py-4 px-5 font-semibold text-blue-600 text-base text-center">Upcoming</th>
                      <th className="py-4 px-5 font-semibold text-emerald-600 text-base text-center">Completed</th>
                      <th className="py-4 px-5 font-semibold text-gray-600 text-base text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeRows.map(row => (
                      <tr key={row.typeName} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-5 font-medium text-gray-800 text-base">{row.typeName}</td>
                        <td className="py-4 px-5 text-center font-bold text-amber-500 text-lg">{row.ongoing}</td>
                        <td className="py-4 px-5 text-center font-bold text-blue-600 text-lg">{row.upcoming}</td>
                        <td className="py-4 px-5 text-center font-bold text-emerald-600 text-lg">{row.completed}</td>
                        <td className="py-4 px-5 text-center font-bold text-gray-700 text-lg">{row.total}</td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td className="py-3 px-4 font-black text-gray-900">TOTAL</td>
                      <td className="py-3 px-4 text-center font-black text-amber-600">{typeRows.reduce((s, r) => s + r.ongoing, 0)}</td>
                      <td className="py-3 px-4 text-center font-black text-blue-700">{typeRows.reduce((s, r) => s + r.upcoming, 0)}</td>
                      <td className="py-3 px-4 text-center font-black text-emerald-700">{typeRows.reduce((s, r) => s + r.completed, 0)}</td>
                      <td className="py-3 px-4 text-center font-black text-gray-900">{overviewData.length}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default DeliveryDashboard;
