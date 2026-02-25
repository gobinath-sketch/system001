import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Briefcase, ChevronRight, BarChart2, DollarSign, Activity, FileText } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useSocket } from '../context/SocketContext';
import AnimatedNumber from '../components/common/AnimatedNumber';
import { API_BASE } from '../config/api';

const DeliveryDashboard = () => {
  const { updateUserRole } = useAuth();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState([]);
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

  const [selectedYear, setSelectedYear] = useState(getCurrentFinancialYearLabel());
  const [timeFilter, setTimeFilter] = useState('Yearly');
  const [selectedMonth, setSelectedMonth] = useState('All');

  const getOpportunityDate = (opp) => {
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

  useEffect(() => {
    updateUserRole('Delivery Team');
    fetchOpportunities();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleEntityUpdated = (event) => {
      if (['opportunity'].includes(event?.entity)) {
        fetchOpportunities();
      }
    };
    socket.on('entity_updated', handleEntityUpdated);
    return () => socket.off('entity_updated', handleEntityUpdated);
  }, [socket]);

  const fetchOpportunities = async () => {
    try {
      const token = sessionStorage.getItem('token');
      // Using the main opportunities endpoint to get all details required for GP
      const res = await axios.get(`${API_BASE}/api/opportunities`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOpportunities(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching opportunities:', err);
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

  // Helper: Get available financial years
  const availableYears = useMemo(() => {
    const fyStarts = opportunities.map((opp) => {
      const oppDate = getOpportunityDate(opp);
      return oppDate ? getFinancialYearStart(oppDate) : null;
    });
    const currentFyStart = getFinancialYearStart(new Date());
    return [...new Set([...fyStarts, currentFyStart])]
      .filter((fy) => fy !== null && fy > 1900)
      .sort((a, b) => b - a)
      .map(toFinancialYearLabel);
  }, [opportunities]);

  const monthOptions = ['All', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // --- Filter Logic ---
  const filteredOpps = useMemo(() => {
    if (!selectedYear) return opportunities;
    return opportunities.filter((opp) => {
      const oppDate = getOpportunityDate(opp);
      if (!oppDate) return false;
      const oppFyStart = getFinancialYearStart(oppDate);
      if (toFinancialYearLabel(oppFyStart) !== selectedYear) return false;

      // Handle Month Dropdown
      if (selectedMonth !== 'All') {
        const oppMonth = opp.commonDetails?.monthOfTraining;
        if (!oppMonth || oppMonth.toString().toLowerCase() !== selectedMonth.toLowerCase()) {
          return false;
        }
      }

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
  }, [opportunities, selectedYear, timeFilter, selectedMonth]);

  // --- KPI Stats (Progress exactly like Sales) ---
  const filteredStats = useMemo(() => {
    return {
      totalOpportunities: filteredOpps.length,
      progress30: filteredOpps.filter((o) => o.progressPercentage < 50).length,
      progress50: filteredOpps.filter((o) => o.progressPercentage >= 50 && o.progressPercentage < 80).length,
      progress80: filteredOpps.filter((o) => o.progressPercentage >= 80 && o.progressPercentage < 100).length,
      progress100: filteredOpps.filter((o) => o.progressPercentage === 100).length
    };
  }, [filteredOpps]);

  const allSalesPersonNames = useMemo(() => {
    const uniqueNames = new Set();
    opportunities.forEach((opp) => {
      const salesName = opp.createdBy?.name || 'Unknown';
      uniqueNames.add(salesName);
    });
    return Array.from(uniqueNames);
  }, [opportunities]);

  // --- Aggregation logic for Graph (FY Month-wise Revenue; Year filter only) ---
  const monthlyRevenueData = useMemo(() => {
    const fyMonths = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const revenueByMonth = fyMonths.map((name) => ({ name, revenue: 0 }));

    opportunities.forEach((opp) => {
      const oppDate = getOpportunityDate(opp);
      if (!oppDate) return;

      const oppFyStart = getFinancialYearStart(oppDate);
      if (selectedYear && toFinancialYearLabel(oppFyStart) !== selectedYear) return;

      const poAmnt = opp.poValue || 0;
      const monthIndex = oppDate.getMonth();
      const fyMonthIndex = (monthIndex + 9) % 12; // Apr->0 ... Mar->11
      revenueByMonth[fyMonthIndex].revenue += poAmnt;
    });

    return revenueByMonth;
  }, [opportunities, selectedYear]);

  // --- Aggregation logic for Sales Person Directory ---
  const salesPersonDirectoryData = useMemo(() => {
    const dataMap = {};

    allSalesPersonNames.forEach((name) => {
      dataMap[name] = { name, count: 0, revenue: 0 };
    });

    filteredOpps.forEach((opp) => {
      const salesName = opp.createdBy?.name || 'Unknown';
      const poAmnt = opp.poValue || 0;

      if (!dataMap[salesName]) {
        dataMap[salesName] = { name: salesName, count: 0, revenue: 0 };
      }
      dataMap[salesName].count += 1;
      dataMap[salesName].revenue += poAmnt;
    });

    return Object.values(dataMap).sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }, [filteredOpps, allSalesPersonNames]);

  // --- Aggregation logic for GP Report ---
  const gpReport = useMemo(() => {
    let totalRevenue = 0;
    let totalExpense = 0;

    filteredOpps.forEach((opp) => {
      totalRevenue += opp.poValue || 0;
      totalExpense += opp.financials?.totalExpense || 0;
    });

    let gpPercent = 0;
    if (totalRevenue > 0) {
      gpPercent = ((totalRevenue - totalExpense) / totalRevenue) * 100;
    }

    return { totalRevenue, totalExpense, gpPercent };
  }, [filteredOpps]);

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
        <select value={selectedYear || ''} onChange={e => setSelectedYear(e.target.value)} className="h-9 pl-3 pr-8 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-1 focus:ring-primary-blue hover:bg-gray-50 cursor-pointer shadow-sm">
          {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
        </select>

        {/* Month Filter */}
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="h-9 pl-3 pr-8 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-1 focus:ring-primary-blue hover:bg-gray-50 cursor-pointer shadow-sm">
          {monthOptions.map(month => <option key={month} value={month}>{month}</option>)}
        </select>

        {/* Period Filter */}
        <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)} className="h-9 pl-3 pr-8 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-1 focus:ring-primary-blue hover:bg-gray-50 cursor-pointer shadow-sm">
          <option value="Yearly">Yearly</option>
          <option value="H1">H1</option>
          <option value="H2">H2</option>
          <option value="Q1">Q1</option>
          <option value="Q2">Q2</option>
          <option value="Q3">Q3</option>
          <option value="Q4">Q4</option>
        </select>
      </div>,
      portalRoot
    );
  };

  if (loading) return <div className="p-8 text-center text-black font-bold">Loading Dashboard...</div>;

  return (
    <div className="p-3 sm:p-4 pb-0 space-y-4 bg-bg-page flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Render Filters via Portal */}
      <FilterControls />
      <style>
        {`
            @keyframes techChevronFlow {
                0%, 100% { transform: translateX(0); opacity: 0.5; filter: drop-shadow(0 0 0 currentColor); }
                50% { transform: translateX(3px); opacity: 1; filter: drop-shadow(0 0 4px currentColor); }
            }
            .tech-chevron { animation: techChevronFlow 1.15s ease-in-out infinite; }
            .progress-stage-group { position: relative; }
            .progress-stage-tip {
                position: absolute; top: 6px; left: 50%; transform: translate(-50%, -4px);
                opacity: 0; pointer-events: none; background: #1d4ed8; color: #fff;
                font-size: 11px; font-weight: 600; line-height: 1; padding: 7px 10px;
                border-radius: 8px; box-shadow: 0 10px 22px rgba(29, 78, 216, 0.35);
                white-space: nowrap; transition: opacity 0.18s ease, transform 0.18s ease; z-index: 20;
            }
            .progress-stage-tip::after {
                content: ''; position: absolute; left: 50%; bottom: -5px; transform: translateX(-50%);
                width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #1d4ed8;
            }
            .progress-stage-group:hover .progress-stage-tip { opacity: 1; transform: translate(-50%, -10px); }
        `}
      </style>

      {/* --- Top Row: KPI Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 min-h-[135px]">

        {/* KPI 1: Opportunity Percentage Wise Count (Entire Opportunities) */}
        <div style={glassCardStyle} className="p-4 flex flex-col justify-center bg-white/50">
          <div className="flex items-center space-x-2 mb-2">
            <div className="p-1.5 rounded-full bg-purple-100">
              <Briefcase size={14} className="text-purple-600" />
            </div>
            <span className="text-sm text-black font-bold">Opportunities (Total: <AnimatedNumber value={filteredStats.totalOpportunities} />)</span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-center">
            <div className="progress-stage-group group flex flex-col items-center hover:bg-white/10 rounded transition-colors">
              <span className="progress-stage-tip">Opportunity created</span>
              <p className="text-2xl font-bold text-red-600"><AnimatedNumber value={filteredStats.progress30} /></p>
              <p className="inline-flex items-center gap-1 text-xs text-black font-bold">
                30%
                <span className="inline-flex items-center leading-none text-red-700 transition-transform group-hover:translate-x-0.5">
                  <ChevronRight size={12} className="tech-chevron" />
                  <ChevronRight size={12} className="tech-chevron" style={{ animationDelay: '0.12s' }} />
                  <ChevronRight size={12} className="tech-chevron" style={{ animationDelay: '0.24s' }} />
                </span>
              </p>
            </div>
            <div className="progress-stage-group group flex flex-col items-center border-l border-gray-100 hover:bg-white/10 rounded transition-colors">
              <span className="progress-stage-tip">Expenses filled</span>
              <p className="text-2xl font-bold text-yellow-500"><AnimatedNumber value={filteredStats.progress50} /></p>
              <p className="inline-flex items-center gap-1 text-xs text-black font-bold">
                50%
                <span className="inline-flex items-center leading-none text-yellow-700 transition-transform group-hover:translate-x-0.5">
                  <ChevronRight size={12} className="tech-chevron" />
                  <ChevronRight size={12} className="tech-chevron" style={{ animationDelay: '0.12s' }} />
                  <ChevronRight size={12} className="tech-chevron" style={{ animationDelay: '0.24s' }} />
                </span>
              </p>
            </div>
            <div className="progress-stage-group group flex flex-col items-center border-l border-gray-100 hover:bg-white/10 rounded transition-colors">
              <span className="progress-stage-tip">Client Proposal uploaded</span>
              <p className="text-2xl font-bold text-indigo-600"><AnimatedNumber value={filteredStats.progress80} /></p>
              <p className="inline-flex items-center gap-1 text-xs text-black font-bold">
                80%
                <span className="inline-flex items-center leading-none text-indigo-700 transition-transform group-hover:translate-x-0.5">
                  <ChevronRight size={12} className="tech-chevron" />
                  <ChevronRight size={12} className="tech-chevron" style={{ animationDelay: '0.12s' }} />
                  <ChevronRight size={12} className="tech-chevron" style={{ animationDelay: '0.24s' }} />
                </span>
              </p>
            </div>
            <div className="progress-stage-group group flex flex-col items-center border-l border-gray-100 hover:bg-white/10 rounded transition-colors">
              <span className="progress-stage-tip">Completed</span>
              <p className="text-2xl font-bold text-emerald-600"><AnimatedNumber value={filteredStats.progress100} /></p>
              <p className="inline-flex items-center gap-1 text-xs text-black font-bold">
                100%
                <span className="inline-flex items-center leading-none text-emerald-700 transition-transform group-hover:translate-x-0.5">
                  <ChevronRight size={12} className="tech-chevron" />
                  <ChevronRight size={12} className="tech-chevron" style={{ animationDelay: '0.12s' }} />
                  <ChevronRight size={12} className="tech-chevron" style={{ animationDelay: '0.24s' }} />
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* KPI 2 & 3: Empty Placeholders */}
        <div style={glassCardStyle} className="p-3 flex flex-col justify-center items-center bg-white/20">
          <span className="text-gray-400 font-semibold italic text-sm">Empty KPI</span>
        </div>
        <div style={glassCardStyle} className="p-3 flex flex-col justify-center items-center bg-white/20">
          <span className="text-gray-400 font-semibold italic text-sm">Empty KPI</span>
        </div>

      </div>


      {/* --- Main Content Section (Split Layout) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 flex-1 min-h-0 pb-3">

        {/* Left Side: Graph (Revenue vs Month - FY) */}
        <div
          style={{
            ...glassCardStyle,
            background: 'linear-gradient(135deg, rgba(219, 234, 254, 0.9) 0%, rgba(239, 246, 255, 0.92) 45%, rgba(255, 255, 255, 0.98) 100%)'
          }}
          className="lg:col-span-7 p-4 flex flex-col rounded-xl h-full min-h-0"
        >
          <div className="flex items-center gap-2 mb-6">
            <BarChart2 className="text-primary-blue" size={20} />
            <h3 className="text-[17px] font-bold text-gray-800">Monthly wise revenue</h3>
          </div>
          <div className="flex-1 w-full min-h-[300px]">
            {monthlyRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyRevenueData} margin={{ top: 10, right: 30, left: 20, bottom: 25 }}>
                  <defs>
                    <linearGradient id="fyRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#003D7A" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#003D7A" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 13, fill: '#4B5563', fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    tickFormatter={(val) => {
                      const absNum = Math.abs(val);
                      if (absNum >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
                      if (absNum >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
                      if (absNum >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
                      return formatMoney(val);
                    }}
                  />
                  <Tooltip
                    formatter={(value) => [formatMoney(value), 'PO Amount']}
                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                    cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#003D7A" strokeWidth={3} fill="url(#fyRevenueFill)" dot={{ r: 3, fill: '#003D7A' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-400 font-medium">
                No revenue data found for the selected year.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Split Vertical (List + GP Report) */}
        <div className="lg:col-span-4 flex flex-col gap-4 h-full min-h-0">

          {/* Top Half: Sales Person List */}
          <div style={glassCardStyle} className="flex-1 bg-white/80 p-4 rounded-xl flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <FileText className="text-primary-blue" size={16} />
              <h3 className="text-[14px] font-bold text-gray-800">Sales Person vs Revenue</h3>
            </div>
            <div className="overflow-y-auto w-full custom-scrollbar pr-2 flex-1 min-h-0 max-h-[320px] relative border border-gray-100 rounded-lg">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10 shadow-sm">
                  <tr>
                    <th className="py-2.5 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider">S.No</th>
                    <th className="py-2.5 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="py-2.5 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center">Opps</th>
                    <th className="py-2.5 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {salesPersonDirectoryData.length > 0 ? (
                    salesPersonDirectoryData.map((data, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-3 px-4 text-base text-gray-500 font-semibold">{idx + 1}</td>
                        <td className="py-3 px-4 text-base text-gray-900 font-bold">{data.name}</td>
                        <td className="py-3 px-4 text-base text-center font-bold text-primary-blue">{data.count}</td>
                        <td className="py-3 px-4 text-base text-right font-semibold text-emerald-600">{formatMoney(data.revenue)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-sm text-gray-400 font-medium">
                        No records available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Half: GP Report Stats */}
          <div style={glassCardStyle} className="flex-1 bg-white/80 p-4 rounded-xl flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-3 shrink-0 border-b border-gray-100 pb-2">
              <Activity className="text-emerald-500" size={16} />
              <h3 className="text-[14px] font-bold text-gray-800">GP Report Summary</h3>
            </div>
            <div className="flex-1 min-h-0 flex flex-col gap-0">
              <div className="flex-1 flex justify-between items-center px-4 py-3 bg-blue-50/50 rounded-t-xl border border-blue-100">
                <span className="text-primary-blue font-extrabold text-sm uppercase tracking-wide">Total Revenue</span>
                <span className="text-xl font-bold text-primary-blue"><AnimatedNumber value={gpReport.totalRevenue} formatValue={(v) => formatMoney(Math.round(v))} /></span>
              </div>
              <div className="flex-1 flex justify-between items-center px-4 py-3 bg-red-50/50 border-x border-red-100">
                <span className="text-red-600 font-extrabold text-sm uppercase tracking-wide">Total Expense</span>
                <span className="text-xl font-bold text-red-600"><AnimatedNumber value={gpReport.totalExpense || 0} formatValue={(v) => formatMoney(Math.round(v))} /></span>
              </div>
              <div className="flex-1 flex justify-between items-center px-4 py-4 bg-emerald-50 rounded-b-xl border border-emerald-200 shadow-sm">
                <span className="text-emerald-800 font-extrabold text-[15px] uppercase tracking-wide">Gross Profit %</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-emerald-600">
                    <AnimatedNumber value={gpReport.gpPercent} formatValue={(v) => `${v.toFixed(1)}%`} />
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DeliveryDashboard;
