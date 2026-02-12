import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const CustomTooltip = ({ active, payload, formatMoney }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg text-sm">
                <p className="font-bold text-gray-800 mb-1">{data.name}</p>
                <p className="text-gray-600 mb-0.5">
                    Revenue: <span className="font-semibold text-primary-blue">{formatMoney(data.value)}</span>
                </p>
                <p className="text-gray-500 text-xs">
                    Count: <span className="font-medium text-gray-700">{data.count}</span> Opportunities
                </p>
            </div>
        );
    }
    return null;
};

import ibmLogo from '../../assets/logos/ibm.svg';
import redhatLogo from '../../assets/logos/redhat.svg';
import microsoftLogo from '../../assets/logos/microsoft.svg';
import blockchainLogo from '../../assets/logos/blockchain.svg';
import tableauLogo from '../../assets/logos/tableau.svg';
import mulesoftLogo from '../../assets/logos/mulesoft.svg';
import aiAllianceLogo from '../../assets/logos/ai_alliance.svg';
import trendingLogo from '../../assets/logos/trending.svg';

const RevenueAnalyticsRow = ({ allOpps, yearlyTarget, currency, formatMoney, EXCHANGE_RATE }) => {
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

    const [selectedYear, setSelectedYear] = useState(2026); // Default to current year
    const [filter, setFilter] = useState('Yearly');
    const [filteredData, setFilteredData] = useState({
        achievedRevenue: 0,
        adjustedTarget: 0,
        techData: [],
        typeData: []
    });

    // Color Palette
    const COLORS = ['#003D7A', '#10b981', '#D4AF37', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

    // Technology list from dropdown
    const TECHNOLOGIES = ['IBM', 'Red hat', 'Microsoft', 'Blockchain', 'Tableau', 'Mulesoft', 'AI alliance', 'Trending technologies'];

    // Logo Mappings
    const LOGO_MAP = {
        'IBM': ibmLogo,
        'Red hat': redhatLogo,
        'Microsoft': microsoftLogo,
        'Blockchain': blockchainLogo,
        'Tableau': tableauLogo,
        'Mulesoft': mulesoftLogo,
        'AI alliance': aiAllianceLogo,
        'Trending technologies': trendingLogo
    };

    // Get available years from opportunities
    const availableYears = [...new Set(allOpps.map(opp =>
        opp.commonDetails?.year || new Date(opp.createdAt).getFullYear()
    ))].filter(year => !isNaN(year) && year > 0).sort((a, b) => b - a);

    // Update selected year when opportunities load
    useEffect(() => {
        if (allOpps.length > 0 && availableYears.length > 0) {
            const latestYear = availableYears[0];
            if (!isNaN(latestYear) && latestYear !== selectedYear) {
                setSelectedYear(latestYear);
            }
        }
    }, [allOpps.length]); // Only run when allOpps length changes

    // Helper to get month index from name or number
    const getMonthIndex = (month) => {
        if (!month) return -1;
        if (typeof month === 'number') return month - 1;
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const normalized = month.toString().toLowerCase().substring(0, 3);
        return months.indexOf(normalized);
    };

    // Filter Logic
    useEffect(() => {
        let targetFactor = 1;

        // Filter Opportunities by Year and Time Period
        const filteredOpps = allOpps.filter(opp => {
            // Get year from opportunity
            const oppYear = opp.commonDetails?.year || new Date(opp.createdAt).getFullYear();

            // Filter by selected year
            if (oppYear !== selectedYear) return false;

            // If Yearly filter, include all from this year
            if (filter === 'Yearly') {
                return true;
            }

            // For H1/H2/Q1-Q4, also filter by month
            let monthIdx = getMonthIndex(opp.commonDetails?.monthOfTraining);

            if (monthIdx === -1) {
                const createdDate = new Date(opp.createdAt);
                monthIdx = createdDate.getMonth();
            }

            if (filter === 'H1') {
                targetFactor = 0.5;
                return monthIdx >= 0 && monthIdx <= 5;
            }
            if (filter === 'H2') {
                targetFactor = 0.5;
                return monthIdx >= 6 && monthIdx <= 11;
            }
            if (filter === 'Q1') {
                targetFactor = 0.25;
                return monthIdx >= 0 && monthIdx <= 2;
            }
            if (filter === 'Q2') {
                targetFactor = 0.25;
                return monthIdx >= 3 && monthIdx <= 5;
            }
            if (filter === 'Q3') {
                targetFactor = 0.25;
                return monthIdx >= 6 && monthIdx <= 8;
            }
            if (filter === 'Q4') {
                targetFactor = 0.25;
                return monthIdx >= 9 && monthIdx <= 11;
            }
            return false;
        });


        // Calculate Aggregates using ONLY PO Amount (poValue) - Strict PO-only
        const achievedRev = filteredOpps.reduce((sum, opp) => sum + (opp.poValue || 0), 0);


        // Technology Distribution (List format with all technologies)
        const techMap = {};
        // Initialize all technologies with 0
        TECHNOLOGIES.forEach(tech => {
            techMap[tech] = 0;
        });

        filteredOpps.forEach(opp => {
            let tech = opp.typeSpecificDetails?.technology;
            if (tech && TECHNOLOGIES.includes(tech)) {
                techMap[tech] = (techMap[tech] || 0) + (opp.poValue || 0);
            }
        });

        const techData = TECHNOLOGIES.map(tech => ({
            name: tech,
            value: techMap[tech]
        }));



        // Opportunity Type Distribution (Pie Chart)
        const typeMap = {};
        filteredOpps.forEach(opp => {
            const type = opp.type || 'Unknown';
            const revenue = opp.poValue || 0;
            if (revenue > 0) {  // Only include types with PO amount
                if (!typeMap[type]) {
                    typeMap[type] = { revenue: 0, count: 0 };
                }
                typeMap[type].revenue += revenue;
                typeMap[type].count += 1;
            }
        });
        const typeData = Object.keys(typeMap)
            .map(key => ({
                name: key,
                value: typeMap[key].revenue,
                count: typeMap[key].count
            }))
            .filter(i => i.value > 0);



        // Update target factor
        if (filter === 'H1' || filter === 'H2') targetFactor = 0.5;
        if (filter === 'Q1' || filter === 'Q2' || filter === 'Q3' || filter === 'Q4') targetFactor = 0.25;

        setFilteredData({
            achievedRevenue: achievedRev,
            adjustedTarget: yearlyTarget * targetFactor,
            techData,
            typeData
        });

    }, [allOpps, selectedYear, filter, yearlyTarget]);

    const diff = filteredData.adjustedTarget - filteredData.achievedRevenue;
    const isPositive = diff <= 0;
    const percentage = filteredData.adjustedTarget > 0
        ? Math.min((filteredData.achievedRevenue / filteredData.adjustedTarget) * 100, 100)
        : 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* 1. Revenue Summary Box */}
            <div style={glassCardStyle} className="p-4 flex flex-col h-[350px]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-gray-800">Revenue Summary</h3>
                    <div className="flex gap-2">
                        {/* Year Selector */}
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-gray-50 outline-none focus:border-blue-500"
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>

                        {/* Time Period Selector */}
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-gray-50 outline-none focus:border-blue-500"
                        >
                            <option value="Yearly">Yearly</option>
                            <option value="H1">H1 (Jan-Jun)</option>
                            <option value="H2">H2 (Jul-Dec)</option>
                            <option value="Q1">Q1 (Jan-Mar)</option>
                            <option value="Q2">Q2 (Apr-Jun)</option>
                            <option value="Q3">Q3 (Jul-Sep)</option>
                            <option value="Q4">Q4 (Oct-Dec)</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 w-full min-h-0 border-b border-gray-100 pb-1 mb-1">
                    <ResponsiveContainer width="100%" height="90%" minWidth={0} minHeight={0}>
                        <BarChart
                            data={[
                                {
                                    name: 'Target',
                                    value: currency === 'INR' ? filteredData.adjustedTarget : filteredData.adjustedTarget / EXCHANGE_RATE,
                                    fill: '#2563eb'
                                },
                                {
                                    name: 'Achieved',
                                    value: currency === 'INR' ? filteredData.achievedRevenue : filteredData.achievedRevenue / EXCHANGE_RATE,
                                    fill: '#16a34a'
                                },
                                {
                                    name: 'Remaining',
                                    value: currency === 'INR'
                                        ? Math.max(0, filteredData.adjustedTarget - filteredData.achievedRevenue)
                                        : Math.max(0, (filteredData.adjustedTarget - filteredData.achievedRevenue)) / EXCHANGE_RATE,
                                    fill: '#ef4444'
                                }
                            ]}
                            margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis
                                tickFormatter={(value) => {
                                    if (currency === 'INR') {
                                        return `${(value / 100000).toFixed(1)}L`;
                                    }
                                    // USD Formatting
                                    if (value >= 1000000) {
                                        return `$${(value / 1000000).toFixed(1)}M`;
                                    }
                                    if (value >= 1000) {
                                        return `$${(value / 1000).toFixed(0)}k`;
                                    }
                                    return `$${value}`;
                                }}
                                width={45}
                                tick={{ fontSize: 10 }}
                            />
                            <Tooltip
                                formatter={(value) => {
                                    if (currency === 'INR') {
                                        return `₹${value.toLocaleString('en-IN')}`; // Already INR
                                    }
                                    return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`; // Already USD
                                }}
                            />
                            <Bar dataKey="value" barSize={50} radius={[4, 4, 0, 0]}>
                                {
                                    [
                                        { name: 'Target', fill: '#2563eb' },
                                        { name: 'Achieved', fill: '#16a34a' },
                                        { name: 'Remaining', fill: '#ef4444' }
                                    ].map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))
                                }
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Numeric Summary Footer */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                        <p className="text-gray-500 text-xs font-semibold">Target</p>
                        <p className="font-bold text-blue-600 truncate text-lg" title={formatMoney(filteredData.adjustedTarget)}>{formatMoney(filteredData.adjustedTarget)}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 text-xs font-semibold">Achieved</p>
                        <p className="font-bold text-green-600 truncate text-lg" title={formatMoney(filteredData.achievedRevenue)}>{formatMoney(filteredData.achievedRevenue)}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 text-xs font-semibold">Remaining</p>
                        <p className="font-bold text-red-500 truncate text-lg" title={formatMoney(Math.max(0, filteredData.adjustedTarget - filteredData.achievedRevenue))}>
                            {formatMoney(Math.max(0, filteredData.adjustedTarget - filteredData.achievedRevenue))}
                        </p>
                    </div>
                </div>
            </div>

            {/* 2. Revenue by Technology (LIST FORMAT) */}
            <div style={glassCardStyle} className="p-4 flex flex-col h-[350px]">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Revenue by Technology</h3>
                <div className="flex-1 overflow-auto flex flex-col justify-between">
                    <div className="flex-1 flex flex-col justify-between">
                        {filteredData.techData.map((tech, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors mb-1 last:mb-0"
                            >
                                <div className="flex items-center">
                                    {LOGO_MAP[tech.name] && (
                                        <img
                                            src={LOGO_MAP[tech.name]}
                                            alt={`${tech.name} logo`}
                                            className="w-5 h-5 object-contain mr-3"
                                        />
                                    )}
                                    <span className="font-semibold text-gray-800 text-sm">
                                        {tech.name}
                                    </span>
                                </div>
                                <span className={`font-bold text-sm ${tech.value > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                    {formatMoney(tech.value)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. Revenue by Opportunity Type (PIE CHART) */}
            <div style={glassCardStyle} className="p-4 flex flex-col h-[350px]">
                <h3 className="text-sm font-bold text-gray-800 mb-2">Revenue by Opportunity Type</h3>
                <div className="flex-1 min-h-0">
                    {filteredData.typeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <PieChart>
                                <Pie
                                    data={filteredData.typeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={0}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {filteredData.typeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip formatMoney={formatMoney} />} />
                                <Legend
                                    layout="horizontal"
                                    verticalAlign="bottom"
                                    align="center"
                                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <p>No revenue data available</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RevenueAnalyticsRow;
