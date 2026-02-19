import { useEffect, useState } from 'react';
import axios from 'axios';
import { Activity, CheckCircle, Users, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useSocket } from '../context/SocketContext';
const DeliveryDashboard = () => {
  const {
    updateUserRole
  } = useAuth();
  const {
    socket
  } = useSocket();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    active: 0,
    scheduledMonth: 0,
    completed: 0,
    smeDeployed: 0,
    pendingFeedback: 0
  });
  const [charts, setCharts] = useState({
    salesChart: [],
    vendorChart: [],
    avgGpChart: []
  });
  const {
    currency
  } = useCurrency();
  const EXCHANGE_RATE = 85;
  useEffect(() => {
    updateUserRole('Delivery Team');
    fetchDashboardRevamp();
  }, []);
  useEffect(() => {
    if (!socket) return;
    const handleEntityUpdated = event => {
      if (['opportunity', 'sme'].includes(event?.entity)) {
        fetchDashboardRevamp();
      }
    };
    socket.on('entity_updated', handleEntityUpdated);
    return () => socket.off('entity_updated', handleEntityUpdated);
  }, [socket]);
  const fetchDashboardRevamp = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/dashboard/delivery/revamp-stats', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setStats(res.data.stats);
      setCharts(res.data.charts);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setLoading(false);
    }
  };

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

  // Glass Style for Cards
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
  if (loading) return <div className="flex justify-center items-center min-h-screen bg-bg-page">
            <div className="text-primary-blue font-semibold">Loading Analytics...</div>
        </div>;
  const kpiCards = [{
    title: 'Active Opportunities',
    value: stats.active,
    icon: Activity,
    color: 'text-blue-600',
    bg: 'bg-blue-100'
  }, {
    title: 'Trainings Scheduled (This Month)',
    value: stats.scheduledMonth,
    icon: Calendar,
    color: 'text-purple-600',
    bg: 'bg-purple-100'
  }, {
    title: 'Trainings Completed',
    value: stats.completed,
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-100'
  }, {
    title: 'SMEs Deployed',
    value: stats.smeDeployed,
    icon: Users,
    color: 'text-indigo-600',
    bg: 'bg-indigo-100'
  }];

  // Filter/Convert vendor chart data based on currency
  const vendorChartData = charts.vendorChart.map(item => ({
    ...item,
    value: currency === 'INR' ? item.value : item.value / EXCHANGE_RATE
  }));
  const avgGpTrendData = (charts.avgGpChart || []).map(item => ({
    name: item.name || item.month || item.label || '',
    gp: Number(item.gp ?? item.avgGp ?? item.gpPercent ?? item.percentage ?? 0)
  })).filter(item => item.name);
  return <div className="p-3 sm:p-6 bg-bg-page h-full space-y-6 sm:space-y-8">
            {/* Header Removed */}

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {kpiCards.map((card, idx) => <div key={idx} style={glassCardStyle} className="rounded-xl p-4 hover:shadow-[0_8px_32px_0_rgba(255,255,255,0.3)] transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <div className={`p-2 rounded-lg ${card.bg}`}>
                                <card.icon size={20} className={card.color} />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">{card.value}</h3>
                        <p className="text-xs text-gray-500 font-medium mt-1">{card.title}</p>
                        {card.sub && <p className="text-[10px] text-orange-500 mt-1">{card.sub}</p>}
                    </div>)}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[24rem]">

                {/* Sales Executive Wise Count */}
                <div style={glassCardStyle} className="p-6 rounded-xl flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Opportunities by Sales Executive</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.salesChart} margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5
            }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{
                fontSize: 12,
                fill: '#6B7280'
              }} />
                                <YAxis axisLine={false} tickLine={false} tick={{
                fontSize: 12,
                fill: '#6B7280'
              }} allowDecimals={false} />
                                <Tooltip contentStyle={{
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }} cursor={false} />
                                <Bar dataKey="count" fill="#003D7A" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top 5 Vendors */}
                <div style={glassCardStyle} className="p-6 rounded-xl flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Top 5 Vendors (by Spend)</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={vendorChartData} margin={{
              top: 5,
              right: 30,
              left: 40,
              bottom: 5
            }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={100} axisLine={false} tickLine={false} tick={{
                fontSize: 11,
                fill: '#374151'
              }} />
                                <Tooltip cursor={false} formatter={value => [formatMoney(value), 'Spend']} contentStyle={{
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }} />
                                <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Charts Row 2: Monthly GP% Trend */}
            <div style={glassCardStyle} className="h-[320px] sm:h-80 p-4 sm:p-6 rounded-xl flex flex-col">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Average GP % (Monthly)</h3>
                <div className="w-full flex-1 min-h-0">
                    {avgGpTrendData.length > 0 ? <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={avgGpTrendData} margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5
          }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{
              fontSize: 12,
              fill: '#6B7280'
            }} />
                                <YAxis axisLine={false} tickLine={false} tick={{
              fontSize: 12,
              fill: '#6B7280'
            }} domain={[0, 'auto']} />
                                <Tooltip cursor={false} formatter={value => [`${value}%`, 'Avg GP']} contentStyle={{
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }} />
                                <Legend />
                                <Line type="monotone" dataKey="gp" stroke="#F59E0B" strokeWidth={3} dot={{
              r: 4,
              fill: '#F59E0B'
            }} activeDot={{
              r: 6
            }} name="GP %" />
                            </LineChart>
                        </ResponsiveContainer> : <div className="h-full flex items-center justify-center text-sm text-gray-500">
                            No GP trend data available
                        </div>}
                </div>
            </div>

        </div>;
};
export default DeliveryDashboard;