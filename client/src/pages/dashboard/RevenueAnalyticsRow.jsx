import React, { useState, useEffect } from 'react';
import { MoreHorizontal, ChevronRight, ChevronLeft, X, Check } from 'lucide-react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const shiftColor = (hex, amount) => {
    const safeHex = hex.replace('#', '');
    const fullHex = safeHex.length === 3
        ? safeHex.split('').map((c) => c + c).join('')
        : safeHex;

    const num = parseInt(fullHex, 16);
    const clamp = (v) => Math.max(0, Math.min(255, v));

    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 0x00ff) + amount);
    const b = clamp((num & 0x0000ff) + amount);

    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
};

const ThreeDBar = (props) => {
    const { x, y, width, height, fill, payload } = props;

    if (height <= 0 || width <= 0) return null;

    const depth = Math.min(10, Math.max(5, width * 0.15));
    const topLift = Math.min(8, Math.max(4, depth * 0.7));
    const front = payload.color || fill || '#2563eb';
    // Use the same color for top/side if user wants "same color front to back", 
    // but usually 3D needs shading. 
    // "give it as same color which is in front to the back" -> imply no shading or same base color.
    // Let's use slight shading but based on the correct color.
    const topFace = front;
    const sideFace = front;
    const baseShadow = 'rgba(0,0,0,0.12)';

    return (
        <g>
            <ellipse
                cx={x + width / 2 + depth * 0.4}
                cy={y + height + 3}
                rx={width * 0.52}
                ry={4}
                fill={baseShadow}
            />

            <polygon
                points={`
                    ${x},${y}
                    ${x + depth},${y - topLift}
                    ${x + width + depth},${y - topLift}
                    ${x + width},${y}
                `}
                fill={topFace}
            />

            <polygon
                points={`
                    ${x + width},${y}
                    ${x + width + depth},${y - topLift}
                    ${x + width + depth},${y + height - topLift}
                    ${x + width},${y + height}
                `}
                fill={sideFace}
            />

            <rect x={x} y={y} width={width} height={height} rx={4} fill={fill} />

            <rect
                x={x + 2}
                y={y + 3}
                width={Math.max(0, width * 0.18)}
                height={Math.max(0, height - 6)}
                rx={2}
                fill="rgba(255,255,255,0.20)"
            />
        </g>
    );
};

const CustomTooltip = ({ active, payload, formatMoney }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg text-sm">
                <p className="font-bold text-black mb-1">{data.name}</p>
                <p className="text-black font-bold mb-0.5">
                    Revenue: <span className="font-semibold text-primary-blue">{formatMoney(data.value)}</span>
                </p>
                <p className="text-black font-bold text-xs">
                    Count: <span className="font-medium text-black font-bold">{data.count}</span> Opportunities
                </p>
            </div>
        );
    }
    return null;
};

import { TECHNOLOGIES, LOGO_MAP } from '../../utils/TechnologyConstants';

const RevenueAnalyticsRow = ({ allOpps, filter = 'Yearly', yearlyTarget, currency, formatMoney, EXCHANGE_RATE, showSetTargetButton, teamMembers, onRefreshData }) => {
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

    const [filteredData, setFilteredData] = useState({
        achievedRevenue: 0,
        adjustedTarget: 0,
        techData: [],
        typeData: [],
        emergingBreakdown: {}
    });

    // State for toggling breakdown view
    const [selectedTechCategory, setSelectedTechCategory] = useState(null);

    // State for Set Team Target modal
    const [showTargetModal, setShowTargetModal] = useState(false);
    const [targetPeriod, setTargetPeriod] = useState('Yearly');
    const [editingTargets, setEditingTargets] = useState({});
    const [savingTarget, setSavingTarget] = useState(null);

    const TYPE_COLORS = {
        'Training': '#0f172a',
        'Lab Support': '#1e40af',
        'Vouchers': '#2563eb',
        'Product Support': '#3b82f6',
        'Resource Support': '#60a5fa',
        'Content Development': '#93c5fd'
    };

    const FALLBACK_COLORS = ['#cbd5e1', '#94a3b8', '#64748b'];

    // Process data when allOpps (filtered from parent) or filter changes
    useEffect(() => {
        let targetFactor = 1;

        // Use filteredOpps directly from props
        const filteredOpps = allOpps;

        if (filter === 'H1') targetFactor = 0.5;
        if (filter === 'H2') targetFactor = 0.5;
        if (filter === 'Q1') targetFactor = 0.25;
        if (filter === 'Q2') targetFactor = 0.25;
        if (filter === 'Q3') targetFactor = 0.25;
        if (filter === 'Q4') targetFactor = 0.25;

        // --- 1. Achieved Revenue ---
        const achievedRev = filteredOpps.reduce((sum, opp) => sum + (opp.poValue || 0), 0);

        // Technology Distribution (List format with grouping)
        const techMap = {};
        const emergingBreakdown = {};
        const otherBreakdown = {};

        // Initialize all technologies with 0
        TECHNOLOGIES.forEach(tech => {
            techMap[tech] = 0;
        });

        filteredOpps.forEach(opp => {
            let tech = opp.typeSpecificDetails?.technology || '';
            const value = opp.poValue || 0;

            if (value > 0 && tech) {
                // Check for composite names "Category - Specific"
                if (tech.startsWith('Emerging technologies - ')) {
                    techMap['Emerging technologies'] = (techMap['Emerging technologies'] || 0) + value;
                    const specificTech = tech.replace('Emerging technologies - ', '');
                    emergingBreakdown[specificTech] = (emergingBreakdown[specificTech] || 0) + value;
                } else if (tech.startsWith('Other technologies - ')) {
                    techMap['Other technologies'] = (techMap['Other technologies'] || 0) + value;
                    const specificTech = tech.replace('Other technologies - ', '');
                    otherBreakdown[specificTech] = (otherBreakdown[specificTech] || 0) + value;
                }
                // Handle standard technologies and plain categories
                else if (TECHNOLOGIES.includes(tech)) {
                    techMap[tech] = (techMap[tech] || 0) + value;
                    // If it's the category name itself without detail, track as unspecified
                    if (tech === 'Emerging technologies') {
                        emergingBreakdown['Unspecified'] = (emergingBreakdown['Unspecified'] || 0) + value;
                    } else if (tech === 'Other technologies') {
                        otherBreakdown['Unspecified'] = (otherBreakdown['Unspecified'] || 0) + value;
                    }
                }
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

        // Defined sort order
        const ORDERED_TYPES = [
            'Training',
            'Lab Support',
            'Vouchers',
            'Product Support',
            'Resource Support',
            'Content Development'
        ];

        const typeData = Object.keys(typeMap)
            .map(key => ({
                name: key,
                value: typeMap[key].revenue,
                count: typeMap[key].count
            }))
            .filter(i => i.value > 0)
            .sort((a, b) => {
                const indexA = ORDERED_TYPES.indexOf(a.name);
                const indexB = ORDERED_TYPES.indexOf(b.name);
                // If both found, sort by index
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                // If only A found, A comes first
                if (indexA !== -1) return -1;
                // If only B found, B comes first
                if (indexB !== -1) return 1;
                // If neither found, sort alphabetically
                return a.name.localeCompare(b.name);
            });

        // Update target factor
        // NOTE: targetFactor was already set at top of effect

        setFilteredData({
            achievedRevenue: achievedRev,
            adjustedTarget: yearlyTarget * targetFactor,

            techData,
            typeData,
            emergingBreakdown,
            otherBreakdown
        });

    }, [allOpps, filter, yearlyTarget]);

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
                    <h3 className="text-sm font-bold text-black">Revenue Summary</h3>
                    {showSetTargetButton && (
                        <button
                            onClick={() => setShowTargetModal(true)}
                            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                        >
                            Set Team Target
                        </button>
                    )}
                </div>

                <div className="flex-1 w-full min-h-[220px] border-b border-gray-100 pb-1 mb-1">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
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
                                    name: 'Difference',
                                    value: currency === 'INR'
                                        ? Math.abs(filteredData.achievedRevenue - filteredData.adjustedTarget)
                                        : Math.abs(filteredData.achievedRevenue - filteredData.adjustedTarget) / EXCHANGE_RATE,
                                    fill: (filteredData.achievedRevenue - filteredData.adjustedTarget) >= 0 ? '#16a34a' : '#ef4444'
                                }
                            ]}
                            margin={{ top: 30, right: 36, left: 6, bottom: 5 }}
                        >
                            <defs>
                                <linearGradient id="achievedGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#d946ef" />
                                    <stop offset="100%" stopColor="#8b5cf6" />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d1d5db" />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 12, fill: '#000000', fontWeight: 'bold' }}
                                axisLine={{ stroke: '#000000' }}
                                tickLine={{ stroke: '#000000' }}
                            />
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
                                tick={{ fontSize: 10, fill: '#000000', fontWeight: 'bold' }}
                                axisLine={{ stroke: '#000000' }}
                                tickLine={{ stroke: '#000000' }}
                            />
                            <Tooltip
                                cursor={false}
                                formatter={(value) => {
                                    if (currency === 'INR') {
                                        return `₹${value.toLocaleString('en-IN')}`; // Already INR
                                    }
                                    return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`; // Already USD
                                }}
                            />
                            <Bar dataKey="value" barSize={48} shape={<ThreeDBar />}>
                                {
                                    [
                                        { name: 'Target', fill: '#2563eb' },
                                        { name: 'Achieved', fill: 'url(#achievedGradient)', color: '#d946ef' },
                                        {
                                            name: 'Difference',
                                            fill: (filteredData.achievedRevenue - filteredData.adjustedTarget) >= 0 ? '#16a34a' : '#ef4444'
                                        }
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
                        <p className="text-black font-bold text-xs font-semibold">Target</p>
                        <p className="font-bold text-blue-600 truncate text-lg" title={formatMoney(filteredData.adjustedTarget)}>
                            {formatMoney(filteredData.adjustedTarget)} <span className="text-xs text-gray-500">(100%)</span>
                        </p>
                    </div>
                    <div>
                        <p className="text-black font-bold text-xs font-semibold">Achieved</p>
                        <p className="font-bold truncate text-lg" style={{ color: '#d946ef' }} title={formatMoney(filteredData.achievedRevenue)}>
                            {formatMoney(filteredData.achievedRevenue)} <span className="text-xs text-gray-500">
                                ({filteredData.adjustedTarget > 0 ? ((filteredData.achievedRevenue / filteredData.adjustedTarget) * 100).toFixed(0) : 0}%)
                            </span>
                        </p>
                    </div>
                    <div>
                        <p className="text-black font-bold text-xs font-semibold">Difference</p>
                        <p className={`font-bold truncate text-lg ${filteredData.achievedRevenue >= filteredData.adjustedTarget ? 'text-green-600' : 'text-red-500'}`}
                            title={formatMoney(Math.abs(filteredData.achievedRevenue - filteredData.adjustedTarget))}>
                            {formatMoney(Math.abs(filteredData.achievedRevenue - filteredData.adjustedTarget))} <span className="text-xs text-gray-500">
                                ({filteredData.adjustedTarget > 0 ? ((Math.abs(filteredData.achievedRevenue - filteredData.adjustedTarget) / filteredData.adjustedTarget) * 100).toFixed(0) : 0}%)
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            {/* 2. Revenue by Technology (LIST FORMAT) */}
            <div style={glassCardStyle} className="p-4 flex flex-col h-[350px]">
                <h3 className="text-sm font-bold text-black mb-3">Revenue by Technology</h3>

                {selectedTechCategory ? (
                    // Breakdown View
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex items-center mb-2">
                            <button
                                onClick={() => setSelectedTechCategory(null)}
                                aria-label="Back to technology list"
                                title="Back"
                                className="mr-2 h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-100 shadow-sm transition-colors"
                            >
                                <ChevronLeft size={15} className="text-gray-700" />
                            </button>
                            <span className="font-bold text-sm text-primary-blue">{selectedTechCategory}</span>
                        </div>
                        <div className="flex-1">
                            <div className="space-y-1">
                                {Object.entries(
                                    selectedTechCategory === 'Emerging technologies'
                                        ? filteredData.emergingBreakdown
                                        : filteredData.otherBreakdown
                                ).map(([subTech, val]) => (
                                    <div key={subTech} className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
                                        <span className="text-black text-[13px] font-medium">{subTech}</span>
                                        <span className="font-bold text-black text-[13px]">
                                            {formatMoney(val)} <span className="text-gray-500 text-xs text-[11px] font-normal">
                                                ({filteredData.achievedRevenue > 0 ? ((val / filteredData.achievedRevenue) * 100).toFixed(0) : 0}%)
                                            </span>
                                        </span>
                                    </div>
                                ))}
                                {Object.keys(
                                    selectedTechCategory === 'Emerging technologies'
                                        ? filteredData.emergingBreakdown
                                        : filteredData.otherBreakdown
                                ).length === 0 && (
                                        <p className="text-xs text-gray-500 text-center py-4">No specific data available.</p>
                                    )}
                            </div>
                        </div>
                    </div>
                ) : (
                    // Main List View
                    <div className="flex-1 min-h-0">
                        <div className="space-y-1">
                            {[...filteredData.techData]
                                .sort((a, b) => (b.value || 0) - (a.value || 0))
                                .map((tech, index) => (
                                    <div
                                        key={index}
                                        onClick={() => {
                                            if (tech.name === 'Emerging technologies' || tech.name === 'Other technologies') {
                                                setSelectedTechCategory(tech.name);
                                            }
                                        }}
                                        className={`group relative flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors ${(tech.name === 'Emerging technologies' || tech.name === 'Other technologies') ? 'cursor-pointer' : ''
                                            }`}
                                    >
                                        <div className="flex items-center">
                                            {LOGO_MAP[tech.name] ? (
                                                <img
                                                    src={LOGO_MAP[tech.name]}
                                                    alt={`${tech.name} logo`}
                                                    className="w-4 h-4 object-contain mr-2.5"
                                                />
                                            ) : tech.name === 'Other technologies' ? (
                                                <MoreHorizontal size={16} className="text-gray-500 mr-2.5" />
                                            ) : null}
                                            <span className="font-semibold text-black text-[13px] leading-tight">
                                                {tech.name}
                                            </span>

                                            {/* Indicators for clickable items */}
                                            {(tech.name === 'Emerging technologies' || tech.name === 'Other technologies') && (
                                                <div className="flex items-center ml-2 space-x-[-4px]">
                                                    <ChevronRight size={15} strokeWidth={2.75} className="text-blue-900 animate-[pulse_1s_ease-in-out_infinite]" style={{ animationDelay: '0ms' }} />
                                                    <ChevronRight size={15} strokeWidth={2.75} className="text-blue-900 animate-[pulse_1s_ease-in-out_infinite]" style={{ animationDelay: '150ms' }} />
                                                    <ChevronRight size={15} strokeWidth={2.75} className="text-blue-900 animate-[pulse_1s_ease-in-out_infinite]" style={{ animationDelay: '300ms' }} />
                                                </div>
                                            )}
                                        </div>
                                        <span className={`font-bold text-[13px] leading-tight ${tech.value > 0 ? 'text-green-600' : 'text-black font-bold'}`}>
                                            {formatMoney(tech.value)} <span className="text-gray-500 text-[11px] font-normal">
                                                ({filteredData.achievedRevenue > 0 ? ((tech.value / filteredData.achievedRevenue) * 100).toFixed(0) : 0}%)
                                            </span>
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Revenue by Opportunity Closure (PIE CHART) */}
            < div style={glassCardStyle} className="p-4 flex flex-col h-[350px]" >
                <h3 className="text-sm font-bold text-black mb-2">Revenue by Opportunity Closure</h3>
                <div className="flex-1 min-h-[240px]">
                    {allOpps.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-black font-bold">
                            <p>Loading revenue data...</p>
                        </div>
                    ) : filteredData.typeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                            <PieChart>
                                <defs>
                                    <filter id="donutShadow" x="-30%" y="-30%" width="160%" height="180%">
                                        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.2" />
                                    </filter>
                                    {filteredData.typeData.map((entry, index) => {
                                        const baseColor = TYPE_COLORS[entry.name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                                        return (
                                            <linearGradient key={`type-grad-${index}`} id={`typeGrad-${index}`} x1="0" y1="0" x2="1" y2="1">
                                                <stop offset="0%" stopColor={shiftColor(baseColor, 22)} />
                                                <stop offset="55%" stopColor={baseColor} />
                                                <stop offset="100%" stopColor={shiftColor(baseColor, -22)} />
                                            </linearGradient>
                                        );
                                    })}
                                </defs>

                                <Pie
                                    data={filteredData.typeData}
                                    cx="50%"
                                    cy="52%"
                                    innerRadius={60}
                                    outerRadius={92}
                                    paddingAngle={0}
                                    dataKey="value"
                                    stroke="none"
                                    legendType="none"
                                >
                                    {filteredData.typeData.map((entry, index) => {
                                        const baseColor = TYPE_COLORS[entry.name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                                        return (
                                            <Cell key={`depth-${index}`} fill={shiftColor(baseColor, -35)} />
                                        );
                                    })}
                                </Pie>

                                <Pie
                                    data={filteredData.typeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={92}
                                    paddingAngle={0}
                                    dataKey="value"
                                    stroke="none"
                                    style={{ filter: 'url(#donutShadow)' }}
                                >
                                    {filteredData.typeData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={`url(#typeGrad-${index})`}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip cursor={false} content={<CustomTooltip formatMoney={formatMoney} />} />
                                <Legend
                                    layout="horizontal"
                                    verticalAlign="bottom"
                                    align="center"
                                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                                    formatter={(value, entry) => {
                                        const { payload } = entry;
                                        const percentage = filteredData.achievedRevenue > 0
                                            ? ((payload.value / filteredData.achievedRevenue) * 100).toFixed(0)
                                            : 0;
                                        return <span className="text-black font-semibold">{value} <span className="text-black font-normal">({percentage}%)</span></span>;
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-black font-bold">
                            <p>No revenue data available</p>
                        </div>
                    )}
                </div>
            </div >

            {/* Set Team Target Modal */}
            {showTargetModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h2 className="text-xl font-bold text-gray-800">Set Team Targets</h2>
                            <button
                                onClick={() => setShowTargetModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-4">
                                <label className="text-sm font-medium text-gray-700">Target Period:</label>
                                <select
                                    value={targetPeriod}
                                    onChange={(e) => setTargetPeriod(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="Yearly">Yearly</option>
                                    <option value="Half-Yearly">Half-Yearly</option>
                                    <option value="Quarterly">Quarterly</option>
                                </select>
                            </div>

                            <div className="overflow-auto max-h-[400px]">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr className="border-b border-gray-200">
                                            <th className="py-3 px-4 font-semibold text-gray-700">Team Member</th>
                                            <th className="py-3 px-4 font-semibold text-gray-700">Role</th>
                                            <th className="py-3 px-4 font-semibold text-gray-700">Current Target</th>
                                            <th className="py-3 px-4 font-semibold text-gray-700">New Target ({currency})</th>
                                            <th className="py-3 px-4 font-semibold text-gray-700 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teamMembers?.map(member => {
                                            const currentTarget = member.targets?.find(
                                                t => t.year === new Date().getFullYear() && t.period === targetPeriod
                                            )?.amount || 0;
                                            const displayTarget = currency === 'INR' ? currentTarget : currentTarget / EXCHANGE_RATE;

                                            return (
                                                <tr key={member._id} className="border-b border-gray-100 hover:bg-gray-50">
                                                    <td className="py-3 px-4 font-medium text-gray-800">{member.name}</td>
                                                    <td className="py-3 px-4 text-gray-600 text-xs">{member.role}</td>
                                                    <td className="py-3 px-4 text-gray-600">
                                                        {formatMoney(currentTarget)}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <input
                                                            type="number"
                                                            value={editingTargets[member._id] ?? Math.round(displayTarget)}
                                                            onChange={(e) => setEditingTargets({
                                                                ...editingTargets,
                                                                [member._id]: e.target.value
                                                            })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            placeholder="Enter target"
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <button
                                                            onClick={async () => {
                                                                const targetValue = editingTargets[member._id];
                                                                if (!targetValue || targetValue <= 0) {
                                                                    alert('Please enter a valid target amount');
                                                                    return;
                                                                }

                                                                setSavingTarget(member._id);
                                                                try {
                                                                    const token = localStorage.getItem('token');
                                                                    const amountInInr = currency === 'INR'
                                                                        ? parseFloat(targetValue)
                                                                        : parseFloat(targetValue) * EXCHANGE_RATE;

                                                                    await axios.put(
                                                                        `http://localhost:5000/api/dashboard/manager/set-target/${member._id}`,
                                                                        {
                                                                            period: targetPeriod,
                                                                            year: new Date().getFullYear(),
                                                                            amount: amountInInr
                                                                        },
                                                                        { headers: { Authorization: `Bearer ${token}` } }
                                                                    );

                                                                    // Refresh data if callback provided
                                                                    if (onRefreshData) {
                                                                        await onRefreshData();
                                                                    }

                                                                    // Clear the editing state for this member
                                                                    const newTargets = { ...editingTargets };
                                                                    delete newTargets[member._id];
                                                                    setEditingTargets(newTargets);

                                                                    alert(`Target updated successfully for ${member.name}`);
                                                                } catch (err) {
                                                                    alert(err.response?.data?.message || 'Failed to update target');
                                                                } finally {
                                                                    setSavingTarget(null);
                                                                }
                                                            }}
                                                            disabled={savingTarget === member._id}
                                                            className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium inline-flex items-center gap-1"
                                                        >
                                                            {savingTarget === member._id ? (
                                                                'Saving...'
                                                            ) : (
                                                                <>
                                                                    <Check size={14} />
                                                                    Save
                                                                </>
                                                            )}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
                            <button
                                onClick={() => setShowTargetModal(false)}
                                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default RevenueAnalyticsRow;
