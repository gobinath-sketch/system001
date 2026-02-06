import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';

const DirectorDashboard = () => {
    const { currency } = useCurrency();
    const EXCHANGE_RATE = 84;

    // Mock financial data (Base is USD for this mock as per original code, or INR? Original had $125,000. 
    // Usually Director Dashboards are high level. Let's assume the original values were USD as they had $ sign.
    // If I want to support INR toggle, I should treat them as base USD and convert TO INR if selected, OR treat as base INR.
    // Given the values 125,000, if that is INR it is very small for a company. It is likely USD.
    // So if Currency is INR, multiply by rate.

    // WAIT. All other dashboards treated base as INR and divided by rate to get USD.
    // Example: SalesManagerDashboard: "const val = currency === 'INR' ? amount : amount / EXCHANGE_RATE;" -> Base is INR.
    // But DirectorDashboard had hardcoded `$`.
    // If I assume base is USD, then:
    // INR = val * Rate
    // USD = val

    const baseMetricsUSD = {
        weeklyInvoiceValue: 125000,
        pendingReceivables: 87500,
        upcomingPayables: 45000,
        netCashFlow: 80500
    };

    const convert = (valUSD) => {
        return currency === 'INR' ? valUSD * EXCHANGE_RATE : valUSD;
    };

    const format = (val) => {
        return currency === 'INR'
            ? `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
            : `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    };

    const MetricCard = ({ title, value, icon: Icon, trend, trendValue, color }) => (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-full ${color} bg-opacity-10`}>
                    <Icon size={24} className={color.replace('bg-', 'text-')} />
                </div>
                {trend && (
                    <div className={`flex items-center text-sm ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                        {trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        <span className="ml-1 font-medium">{trendValue}</span>
                    </div>
                )}
            </div>
            <div className="text-sm text-gray-500 mb-1">{title}</div>
            <div className="text-3xl font-bold text-gray-900">{format(convert(value))}</div>
        </div>
    );

    return (
        <div className="p-5">
            {/* Header Removed */}

            {/* Financial Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <MetricCard
                    title="Weekly Invoice Value"
                    value={baseMetricsUSD.weeklyInvoiceValue}
                    icon={DollarSign}
                    trend="up"
                    trendValue="+12%"
                    color="bg-blue-600"
                />
                <MetricCard
                    title="Pending Receivables"
                    value={baseMetricsUSD.pendingReceivables}
                    icon={AlertCircle}
                    trend="down"
                    trendValue="-5%"
                    color="bg-yellow-600"
                />
                <MetricCard
                    title="Upcoming Payables"
                    value={baseMetricsUSD.upcomingPayables}
                    icon={TrendingDown}
                    color="bg-red-600"
                />
                <MetricCard
                    title="Net Cash Flow"
                    value={baseMetricsUSD.netCashFlow}
                    icon={TrendingUp}
                    trend="up"
                    trendValue="+8%"
                    color="bg-green-600"
                />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="text-sm text-gray-500 mb-1">Total Revenue (MTD)</div>
                    <div className="text-2xl font-bold text-gray-900">{format(convert(450000))}</div>
                    <div className="text-xs text-green-600 mt-1">+18% from last month</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="text-sm text-gray-500 mb-1">Total Expenses (MTD)</div>
                    <div className="text-2xl font-bold text-gray-900">{format(convert(280000))}</div>
                    <div className="text-xs text-red-600 mt-1">+8% from last month</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="text-sm text-gray-500 mb-1">Profit Margin</div>
                    <div className="text-2xl font-bold text-green-600">37.8%</div>
                    <div className="text-xs text-gray-500 mt-1">Healthy margin</div>
                </div>
            </div>
        </div>
    );
};

export default DirectorDashboard;

