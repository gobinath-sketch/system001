import { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, TrendingUp, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useCurrency } from '../../context/CurrencyContext';
import { useSocket } from '../../context/SocketContext';
import { API_BASE } from '../../config/api';
const GPReportSection = () => {
  const {
    socket
  } = useSocket();
  const [filterType, setFilterType] = useState('month'); // 'month', 'quarter', 'year'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11
  const [selectedQuarter, setSelectedQuarter] = useState('Q4'); // Q1, Q2, Q3, Q4
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const {
    currency
  } = useCurrency(); // Global Currency
  const USD_TO_INR = 83; // Conversion rate

  // Month options with year
  const currentYear = new Date().getFullYear();
  const months = [{
    value: 0,
    label: `Jan ${currentYear}`
  }, {
    value: 1,
    label: `Feb ${currentYear}`
  }, {
    value: 2,
    label: `Mar ${currentYear}`
  }, {
    value: 3,
    label: `Apr ${currentYear}`
  }, {
    value: 4,
    label: `May ${currentYear}`
  }, {
    value: 5,
    label: `Jun ${currentYear}`
  }, {
    value: 6,
    label: `Jul ${currentYear}`
  }, {
    value: 7,
    label: `Aug ${currentYear}`
  }, {
    value: 8,
    label: `Sep ${currentYear}`
  }, {
    value: 9,
    label: `Oct ${currentYear}`
  }, {
    value: 10,
    label: `Nov ${currentYear}`
  }, {
    value: 11,
    label: `Dec ${currentYear}`
  }];

  // Quarter options with year
  const currentMonth = new Date().getMonth();
  const fiscalYearStart = currentMonth >= 3 ? currentYear : currentYear - 1;
  const fiscalYearEnd = fiscalYearStart + 1;
  const quarters = [{
    value: 'Q1',
    label: `Q1 (Apr ${fiscalYearStart} - Jun ${fiscalYearStart})`
  }, {
    value: 'Q2',
    label: `Q2 (Jul ${fiscalYearStart} - Sep ${fiscalYearStart})`
  }, {
    value: 'Q3',
    label: `Q3 (Oct ${fiscalYearStart} - Dec ${fiscalYearStart})`
  }, {
    value: 'Q4',
    label: `Q4 (Jan ${fiscalYearEnd} - Mar ${fiscalYearEnd})`
  }];

  // Get current fiscal year display
  const getFiscalYearDisplay = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Fiscal year starts in April (month 3)
    const fiscalYearStart = currentMonth >= 3 ? currentYear : currentYear - 1;
    const fiscalYearEnd = fiscalYearStart + 1;
    return `April ${fiscalYearStart} - March ${fiscalYearEnd}`;
  };
  useEffect(() => {
    fetchReportData();
  }, [filterType, selectedMonth, selectedQuarter]);
  useEffect(() => {
    if (!socket) return;
    const handleEntityUpdated = event => {
      if (['opportunity', 'client'].includes(event?.entity)) {
        fetchReportData();
      }
    };
    socket.on('entity_updated', handleEntityUpdated);
    return () => socket.off('entity_updated', handleEntityUpdated);
  }, [socket, filterType, selectedMonth, selectedQuarter]);
  const fetchReportData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');

      // Build query params
      const params = new URLSearchParams();
      if (filterType === 'month') {
        params.append('type', 'month');
        // Convert 0-11 to "Jan", "Feb", etc.
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        params.append('month', monthNames[selectedMonth]);
        params.append('year', currentYear); // Uses currentYear variable defined in component scope
      } else if (filterType === 'quarter') {
        params.append('type', 'quarter');
        params.append('quarter', selectedQuarter);
        params.append('year', fiscalYearStart); // Context of fiscal year
      } else {
        params.append('type', 'fiscal_year');
        params.append('year', fiscalYearStart);
      }
      const res = await axios.get(`${API_BASE}/api/reports/gp-analysis?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setReportData(res.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching GP report:', error);
    } finally {
      setLoading(false);
    }
  };
  const generateExcelReport = () => {
    if (!reportData || !reportData.clientData) return;

    // Prepare data for Excel
    const excelData = reportData.clientData.map(client => ({
      'S.No': client.sno,
      'Client Name': client.clientName,
      'Total Revenue': client.totalRevenue,
      'Total Expenses': client.totalExpenses,
      'Profit': client.gp,
      'GP %': client.gpPercent.toFixed(2) + '%'
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    ws['!cols'] = [{
      wch: 8
    },
    // S.No
    {
      wch: 30
    },
    // Client Name
    {
      wch: 15
    },
    // Total Revenue
    {
      wch: 15
    },
    // Total Expenses
    {
      wch: 15
    },
    // GP
    {
      wch: 10
    } // GP %
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GP Report');

    // Generate filename with date
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `GP_Report_${filterType}_${dateStr}.xlsx`;

    // Download
    XLSX.writeFile(wb, filename);
  };
  const formatCurrency = value => {
    const displayValue = currency === 'USD' ? value / USD_TO_INR : value;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: currency === 'USD' ? 0 : 0
    }).format(displayValue);
  };
  const formatDateTime = date => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };
  const summary = reportData?.summary || {
    totalRevenue: 0,
    totalExpenses: 0,
    grossProfit: 0,
    gpPercent: 0,
    totalOpportunities: 0
  };
  return <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border border-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-primary-blue mb-1">GP Report</h2>
                    <p className="text-gray-500 text-sm flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Last updated: {formatDateTime(lastUpdated)}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Currency Toggle moved to global header */}
                    <button onClick={generateExcelReport} disabled={!reportData || loading} className="flex items-center gap-2 bg-primary-blue hover:bg-opacity-90 text-white font-semibold px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                        <Download size={18} />
                        Generate Report
                    </button>
                </div>
            </div>

            {/* Filter Section */}
            <div className="mb-6">
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Filter Type Selector */}
                    <div className="flex gap-2">
                        <button onClick={() => setFilterType('month')} className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${filterType === 'month' ? 'bg-primary-blue text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Month
                        </button>
                        <button onClick={() => setFilterType('quarter')} className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${filterType === 'quarter' ? 'bg-primary-blue text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Quarter
                        </button>
                        <button onClick={() => setFilterType('year')} className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${filterType === 'year' ? 'bg-primary-blue text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Year
                        </button>
                    </div>

                    {/* Month Dropdown */}
                    {filterType === 'month' && <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-500" />
                            <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-blue bg-white">
                                {months.map(month => <option key={month.value} value={month.value}>
                                        {month.label}
                                    </option>)}
                            </select>
                        </div>}

                    {/* Quarter Dropdown */}
                    {filterType === 'quarter' && <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-500" />
                            <select value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-blue bg-white">
                                {quarters.map(quarter => <option key={quarter.value} value={quarter.value}>
                                        {quarter.label}
                                    </option>)}
                            </select>
                        </div>}

                    {/* Fiscal Year Display */}
                    {filterType === 'year' && <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                            <Calendar size={16} className="text-primary-blue" />
                            <span className="text-sm font-medium text-primary-blue">
                                {getFiscalYearDisplay()}
                            </span>
                        </div>}
                </div>
            </div>

            {/* Summary Cards */}
            {loading ? <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue"></div>
                </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Revenue */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm text-blue-700 font-medium uppercase tracking-wider">Total Revenue</span>
                        </div>
                        <div className="text-3xl font-bold text-blue-900 mb-1">
                            {formatCurrency(summary.totalRevenue)}
                        </div>
                    </div>

                    {/* Total Cost */}
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="text-sm text-gray-600 font-medium uppercase tracking-wider">Total Expenses</span>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">
                            {formatCurrency(summary.totalExpenses)}
                        </div>
                    </div>

                    {/* Gross Profit */}
                    <div className="bg-gradient-to-br from-primary-blue to-blue-700 border border-blue-800 rounded-xl p-6 shadow-md">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp size={20} className="text-white" />
                            <span className="text-sm text-blue-100 font-medium uppercase tracking-wider">Gross Profit</span>
                        </div>
                        <div className="text-3xl font-bold text-white mb-2">
                            {formatCurrency(summary.grossProfit)}
                        </div>
                        <div className="inline-block bg-yellow-400 text-gray-900 px-3 py-1 rounded-full text-sm font-bold">
                            {summary.gpPercent.toFixed(1)}% GP%
                        </div>
                    </div>

                    {/* Opportunities */}
                    <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm text-green-700 font-medium uppercase tracking-wider">Opportunities</span>
                        </div>
                        <div className="text-3xl font-bold text-green-900 mb-1">
                            {summary.totalOpportunities}
                        </div>
                    </div>
                </div>}
        </div>;
};
export default GPReportSection;