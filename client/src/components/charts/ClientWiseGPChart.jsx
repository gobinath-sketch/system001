import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Filter } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { useSocket } from '../../context/SocketContext';
const ClientWiseGPChart = () => {
  const {
    socket
  } = useSocket();
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedQuarter, setSelectedQuarter] = useState('Q4');
  const [selectedClient, setSelectedClient] = useState('all');
  const [clients, setClients] = useState([]);
  const {
    currency
  } = useCurrency();
  const EXCHANGE_RATE = 84;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const fiscalYearStart = currentMonth >= 3 ? currentYear : currentYear - 1;
  const fiscalYearEnd = fiscalYearStart + 1;

  // ... (months and quarters arrays remain same, no changes)
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
  useEffect(() => {
    fetchChartData();
  }, [filterType, selectedMonth, selectedQuarter]);
  useEffect(() => {
    if (!socket) return;
    const handleEntityUpdated = event => {
      if (['opportunity', 'client'].includes(event?.entity)) {
        fetchChartData();
      }
    };
    socket.on('entity_updated', handleEntityUpdated);
    return () => socket.off('entity_updated', handleEntityUpdated);
  }, [socket, filterType, selectedMonth, selectedQuarter]);
  const fetchChartData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let timeline = '';
      if (filterType === 'month') {
        timeline = `month-${selectedMonth}`;
      } else if (filterType === 'quarter') {
        timeline = `quarter-${selectedQuarter}`;
      } else {
        timeline = 'thisYear';
      }
      const res = await axios.get(`http://localhost:5000/api/reports/gp-analysis?timeline=${timeline}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Transform data for chart
      const data = res.data.clientData || [];
      // Assuming data is in INR base from backend? Usually backend reports are standardized.
      // ClientGPReportSection treated them as base (INR/USD agnostic until conversion).
      setChartData(data);

      // Extract unique clients
      const uniqueClients = data.map(item => ({
        name: item.clientName,
        value: item.clientName
      }));
      setClients(uniqueClients);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching client GP data:', error);
      setLoading(false);
    }
  };

  // Filter and Convert Data
  const processedData = (selectedClient === 'all' ? chartData : chartData.filter(item => item.clientName === selectedClient)).map(item => ({
    ...item,
    totalRevenue: currency === 'INR' ? item.totalRevenue : item.totalRevenue / EXCHANGE_RATE,
    totalExpenses: currency === 'INR' ? item.totalExpenses : item.totalExpenses / EXCHANGE_RATE,
    gp: currency === 'INR' ? item.gp : item.gp / EXCHANGE_RATE
  }));
  const formatCurrency = value => {
    if (currency === 'INR') {
      return `₹${(value / 1000).toFixed(0)}K`;
    }
    return `$${(value / 1000).toFixed(1)}K`; // USD K format
  };
  const CustomTooltip = ({
    active,
    payload
  }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                    <p className="font-bold text-gray-900 mb-2">{d.clientName}</p>
                    <p className="text-sm text-blue-600">Revenue: {currency === 'INR' ? '₹' : '$'}{d.totalRevenue.toLocaleString(undefined, {
            maximumFractionDigits: 0
          })}</p>
                    <p className="text-sm text-red-600">Expenses: {currency === 'INR' ? '₹' : '$'}{d.totalExpenses.toLocaleString(undefined, {
            maximumFractionDigits: 0
          })}</p>
                    <p className="text-sm text-green-600 font-semibold">GP: {currency === 'INR' ? '₹' : '$'}{d.gp.toLocaleString(undefined, {
            maximumFractionDigits: 0
          })}</p>
                    <p className="text-sm text-gray-600">GP%: {d.gpPercent.toFixed(1)}%</p>
                </div>;
    }
    return null;
  };
  return <div className="bg-white rounded-xl p-6 mb-6 shadow-sm border border-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-primary-blue mb-1">Client-wise GP Analysis</h2>
                    <p className="text-gray-500 text-sm">Revenue, Expenses, and Gross Profit by Client</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-6 flex-wrap">
                {/* Filter Type Selector */}
                <div className="flex gap-2">
                    <button onClick={() => setFilterType('month')} className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${filterType === 'month' ? 'bg-primary-blue text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Month</button>
                    <button onClick={() => setFilterType('quarter')} className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${filterType === 'quarter' ? 'bg-primary-blue text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Quarter</button>
                    <button onClick={() => setFilterType('year')} className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${filterType === 'year' ? 'bg-primary-blue text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Year</button>
                </div>

                {/* Month Dropdown */}
                {filterType === 'month' && <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-blue bg-white">
                        {months.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}
                    </select>}

                {/* Quarter Dropdown */}
                {filterType === 'quarter' && <select value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-blue bg-white">
                        {quarters.map(quarter => <option key={quarter.value} value={quarter.value}>{quarter.label}</option>)}
                    </select>}

                {/* Client Filter */}
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-gray-500" />
                    <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-blue">
                        <option value="all">All Clients</option>
                        {clients.map((client, idx) => <option key={idx} value={client.value}>{client.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Chart */}
            {loading ? <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue"></div>
                </div> : processedData.length === 0 ? <div className="text-center py-12 text-gray-500">
                    No data available for the selected period
                </div> : <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={processedData} margin={{
        top: 20,
        right: 30,
        left: 20,
        bottom: 80
      }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="clientName" angle={-45} textAnchor="end" height={100} tick={{
          fontSize: 12
        }} />
                        <YAxis tickFormatter={formatCurrency} tick={{
          fontSize: 12
        }} />
                        <Tooltip cursor={false} content={<CustomTooltip />} />
                        <Legend wrapperStyle={{
          paddingTop: '20px'
        }} iconType="rect" />
                        <Bar dataKey="totalRevenue" fill="#3b82f6" name="Revenue" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="totalExpenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="gp" fill="#10b981" name="Gross Profit" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>}
        </div>;
};
export default ClientWiseGPChart;