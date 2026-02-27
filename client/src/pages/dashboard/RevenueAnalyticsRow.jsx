import { useState, useEffect } from 'react';
import { MoreHorizontal, ChevronRight, ChevronLeft, X, Check } from 'lucide-react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Sector } from 'recharts';
import { useToast } from '../../context/ToastContext';
import SafeResponsiveContainer from '../../components/charts/SafeResponsiveContainer';
import AnimatedNumber from '../../components/common/AnimatedNumber';
const shiftColor = (hex, amount) => {
  const safeHex = hex.replace('#', '');
  const fullHex = safeHex.length === 3 ? safeHex.split('').map(c => c + c).join('') : safeHex;
  const num = parseInt(fullHex, 16);
  const clamp = v => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amount);
  const g = clamp((num >> 8 & 0x00ff) + amount);
  const b = clamp((num & 0x0000ff) + amount);
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
};
const ThreeDBar = props => {
  const {
    x,
    y,
    width,
    height,
    fill,
    payload
  } = props;
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
  return <g>
            <ellipse cx={x + width / 2 + depth * 0.4} cy={y + height + 3} rx={width * 0.52} ry={4} fill={baseShadow} />

            <polygon points={`
                    ${x},${y}
                    ${x + depth},${y - topLift}
                    ${x + width + depth},${y - topLift}
                    ${x + width},${y}
                `} fill={topFace} />

            <polygon points={`
                    ${x + width},${y}
                    ${x + width + depth},${y - topLift}
                    ${x + width + depth},${y + height - topLift}
                    ${x + width},${y + height}
                `} fill={sideFace} />

            <rect x={x} y={y} width={width} height={height} rx={4} fill={fill} />

            <rect x={x + 2} y={y + 3} width={Math.max(0, width * 0.18)} height={Math.max(0, height - 6)} rx={2} fill="rgba(255,255,255,0.20)" />
        </g>;
};
const CustomTooltip = ({
  active,
  payload,
  formatMoney
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg text-sm">
                <p className="font-bold text-black mb-1">{data.name}</p>
                <p className="text-black font-bold mb-0.5">
                    Revenue: <span className="font-semibold text-primary-blue">{formatMoney(data.value)}</span>
                </p>
                <p className="text-black font-bold text-xs">
                    Count: <span className="font-medium text-black font-bold">{data.count}</span> Opportunities
                </p>
            </div>;
  }
  return null;
};
import { TECHNOLOGIES, LOGO_MAP } from '../../utils/TechnologyConstants';
import { API_BASE } from '../../config/api';
const RevenueAnalyticsRow = ({
  allOpps,
  filter = 'Yearly',
  yearlyTarget,
  currency,
  formatMoney,
  EXCHANGE_RATE,
  showSetTargetButton,
  teamMembers,
  onRefreshData,
  loading
}) => {
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
    sectorData: [],
    emergingBreakdown: {}
  });

  // State for toggling breakdown view
  const [selectedTechCategory, setSelectedTechCategory] = useState(null);

  // State for Set Team Target modal
  const {
    addToast
  } = useToast();
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [targetPeriod, setTargetPeriod] = useState('Yearly');
  const [editingTargets, setEditingTargets] = useState({});
  const [savingTarget, setSavingTarget] = useState(null);
  const [savedSuccessId, setSavedSuccessId] = useState(null);
  const [activeSectorIndex, setActiveSectorIndex] = useState(-1);
  const SECTOR_COLORS = {
    'Enterprise': '#0F3D75',
    'Academics': '#FBBF24',
    'School': '#4ADE80'
  };
  const FALLBACK_COLORS = ['#cbd5e1', '#94a3b8', '#64748b'];
  const renderActiveSectorShape = props => {
    const {
      cx,
      cy,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fill
    } = props;
    return <g style={{
      filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.28))'
    }}>
            <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 10} startAngle={startAngle} endAngle={endAngle} fill={fill} />
        </g>;
  };

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

    // Sector Distribution (Pie Chart) - revenue by PO amount
    const sectorMap = {
      Enterprise: {
        revenue: 0,
        count: 0
      },
      Academics: {
        revenue: 0,
        count: 0
      },
      School: {
        revenue: 0,
        count: 0
      }
    };
    const resolveSector = sector => {
      const normalized = String(sector || '').trim();
      if (!normalized) return null;
      if (normalized === 'Enterprise') return 'Enterprise';
      if (normalized === 'School') return 'School';
      if (normalized === 'Academics' || normalized === 'College' || normalized === 'University' || normalized === 'Universities' || normalized === 'Academics - College' || normalized === 'Academics - Universities') {
        return 'Academics';
      }
      return null;
    };
    filteredOpps.forEach(opp => {
      const revenue = opp.poValue || 0;
      if (revenue > 0) {
        const sector = resolveSector(opp.commonDetails?.trainingSector);
        if (sector && sectorMap[sector]) {
          sectorMap[sector].revenue += revenue;
          sectorMap[sector].count += 1;
        }
      }
    });
    const sectorData = ['Enterprise', 'Academics', 'School'].map(name => ({
      name,
      value: sectorMap[name].revenue,
      count: sectorMap[name].count
    })).filter(i => i.value > 0);

    // Update target factor
    // NOTE: targetFactor was already set at top of effect

    setFilteredData({
      achievedRevenue: achievedRev,
      adjustedTarget: yearlyTarget * targetFactor,
      techData,
      sectorData,
      emergingBreakdown,
      otherBreakdown
    });
  }, [allOpps, filter, yearlyTarget]);
  return <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* 1. Revenue Summary Box */}
            <div style={glassCardStyle} className="p-4 flex flex-col min-h-[300px] sm:min-h-[350px]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-black">Revenue Summary</h3>
                    {showSetTargetButton && <button onClick={() => setIsTargetModalOpen(true)} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium">
                            Set Team Target
                        </button>}
                </div>

                <div className="flex-1 w-full min-h-[170px] sm:min-h-[220px] border-b border-gray-100 pb-1 mb-1">
                    <SafeResponsiveContainer minHeight={170}>
                        <BarChart accessibilityLayer={false} data={[{
            name: 'Target',
            value: currency === 'INR' ? filteredData.adjustedTarget : filteredData.adjustedTarget / EXCHANGE_RATE,
            fill: '#2563eb'
          }, {
            name: 'Achieved',
            value: currency === 'INR' ? filteredData.achievedRevenue : filteredData.achievedRevenue / EXCHANGE_RATE,
            fill: '#16a34a'
          }, {
            name: 'Difference',
            value: currency === 'INR' ? Math.abs(filteredData.achievedRevenue - filteredData.adjustedTarget) : Math.abs(filteredData.achievedRevenue - filteredData.adjustedTarget) / EXCHANGE_RATE,
            fill: filteredData.achievedRevenue - filteredData.adjustedTarget >= 0 ? '#16a34a' : '#ef4444'
          }]} margin={{
            top: 30,
            right: 36,
            left: 6,
            bottom: 5
          }}>
                            <defs>
                                <linearGradient id="achievedGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#d946ef" />
                                    <stop offset="100%" stopColor="#8b5cf6" />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d1d5db" />
                            <XAxis dataKey="name" tick={{
              fontSize: 12,
              fill: '#000000',
              fontWeight: 'bold'
            }} axisLine={{
              stroke: '#000000'
            }} tickLine={{
              stroke: '#000000'
            }} />
                            <YAxis tickFormatter={value => {
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
            }} width={45} tick={{
              fontSize: 10,
              fill: '#000000',
              fontWeight: 'bold'
            }} axisLine={{
              stroke: '#000000'
            }} tickLine={{
              stroke: '#000000'
            }} />
                            <Tooltip cursor={false} formatter={value => {
              if (currency === 'INR') {
                return `₹${value.toLocaleString('en-IN')}`; // Already INR
              }
              return `$${value.toLocaleString('en-US', {
                maximumFractionDigits: 0
              })}`; // Already USD
            }} />
                            <Bar dataKey="value" barSize={34} shape={<ThreeDBar />}>
                                {[{
                name: 'Target',
                fill: '#2563eb'
              }, {
                name: 'Achieved',
                fill: 'url(#achievedGradient)',
                color: '#d946ef'
              }, {
                name: 'Difference',
                fill: filteredData.achievedRevenue - filteredData.adjustedTarget >= 0 ? '#16a34a' : '#ef4444'
              }].map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                            </Bar>
                        </BarChart>
                    </SafeResponsiveContainer>
                </div>

                {/* Numeric Summary Footer */}
                <div className="grid grid-cols-3 gap-1 sm:gap-2 text-center">
                    <div>
                        <p className="text-black font-bold text-xs font-semibold">Target</p>
                        <p className="font-bold text-blue-600 truncate text-sm sm:text-lg" title={formatMoney(filteredData.adjustedTarget)}>
                            <AnimatedNumber value={filteredData.adjustedTarget} formatValue={(v) => formatMoney(v)} /> <span className="text-[10px] sm:text-xs text-gray-500">(100%)</span>
                        </p>
                    </div>
                    <div>
                        <p className="text-black font-bold text-xs font-semibold">Achieved</p>
                        <p className="font-bold truncate text-sm sm:text-lg" style={{
            color: '#d946ef'
          }} title={formatMoney(filteredData.achievedRevenue)}>
                            <AnimatedNumber value={filteredData.achievedRevenue} formatValue={(v) => formatMoney(v)} /> <span className="text-[10px] sm:text-xs text-gray-500">
                                ({filteredData.adjustedTarget > 0 ? (filteredData.achievedRevenue / filteredData.adjustedTarget * 100).toFixed(0) : 0}%)
                            </span>
                        </p>
                    </div>
                    <div>
                        <p className="text-black font-bold text-xs font-semibold">Difference</p>
                        <p className={`font-bold truncate text-sm sm:text-lg ${filteredData.achievedRevenue >= filteredData.adjustedTarget ? 'text-green-600' : 'text-red-500'}`} title={formatMoney(Math.abs(filteredData.achievedRevenue - filteredData.adjustedTarget))}>
                            <AnimatedNumber value={Math.abs(filteredData.achievedRevenue - filteredData.adjustedTarget)} formatValue={(v) => formatMoney(v)} /> <span className="text-[10px] sm:text-xs text-gray-500">
                                ({filteredData.adjustedTarget > 0 ? (Math.abs(filteredData.achievedRevenue - filteredData.adjustedTarget) / filteredData.adjustedTarget * 100).toFixed(0) : 0}%)
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            {/* 2. Revenue by Technology (LIST FORMAT) */}
            <div style={glassCardStyle} className="p-4 flex flex-col min-h-[350px]">
                <h3 className="text-sm font-bold text-black mb-3">Revenue by Technology</h3>

                {selectedTechCategory ?
      // Breakdown View
      <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex items-center mb-2">
                            <button onClick={() => setSelectedTechCategory(null)} aria-label="Back to technology list" title="Back" className="mr-2 h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-100 shadow-sm transition-colors">
                                <ChevronLeft size={15} className="text-gray-700" />
                            </button>
                            <span className="font-bold text-sm text-primary-blue">{selectedTechCategory}</span>
                        </div>
                        <div className="flex-1">
                            <div className="space-y-1">
                                {Object.entries(selectedTechCategory === 'Emerging technologies' ? filteredData.emergingBreakdown : filteredData.otherBreakdown).map(([subTech, val]) => <div key={subTech} className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
                                        <span className="text-black text-[13px] font-medium">{subTech}</span>
                                        <span className="font-bold text-black text-[13px]">
                                            {formatMoney(val)} <span className="text-gray-500 text-xs text-[11px] font-normal">
                                                ({filteredData.achievedRevenue > 0 ? (val / filteredData.achievedRevenue * 100).toFixed(0) : 0}%)
                                            </span>
                                        </span>
                                    </div>)}
                                {Object.keys(selectedTechCategory === 'Emerging technologies' ? filteredData.emergingBreakdown : filteredData.otherBreakdown).length === 0 && <p className="text-xs text-gray-500 text-center py-4">No specific data available.</p>}
                            </div>
                        </div>
                    </div> :
      // Main List View
      <div className="flex-1 min-h-0">
                        <div className="h-full flex flex-col justify-between gap-1">
                            {[...filteredData.techData].sort((a, b) => (b.value || 0) - (a.value || 0)).map((tech, index) => <div key={index} onClick={() => {
            if (tech.name === 'Emerging technologies' || tech.name === 'Other technologies') {
              setSelectedTechCategory(tech.name);
            }
          }} className={`group relative flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors ${tech.name === 'Emerging technologies' || tech.name === 'Other technologies' ? 'cursor-pointer' : ''}`}>
                                        <div className="flex items-center">
                                            {LOGO_MAP[tech.name] ? <img src={LOGO_MAP[tech.name]} alt={`${tech.name} logo`} className="w-4 h-4 object-contain mr-2.5" /> : tech.name === 'Other technologies' ? <MoreHorizontal size={16} className="text-gray-500 mr-2.5" /> : null}
                                            <span className="font-semibold text-black text-[13px] leading-tight">
                                                {tech.name}
                                            </span>

                                            {/* Indicators for clickable items */}
                                            {(tech.name === 'Emerging technologies' || tech.name === 'Other technologies') && <div className="flex items-center ml-2 space-x-[-4px]">
                                                    <ChevronRight size={15} strokeWidth={2.75} className="text-blue-900 animate-[pulse_1s_ease-in-out_infinite]" style={{
                  animationDelay: '0ms'
                }} />
                                                    <ChevronRight size={15} strokeWidth={2.75} className="text-blue-900 animate-[pulse_1s_ease-in-out_infinite]" style={{
                  animationDelay: '150ms'
                }} />
                                                    <ChevronRight size={15} strokeWidth={2.75} className="text-blue-900 animate-[pulse_1s_ease-in-out_infinite]" style={{
                  animationDelay: '300ms'
                }} />
                                                </div>}
                                        </div>
                                        <span className={`font-bold text-[13px] leading-tight ${tech.value > 0 ? 'text-green-600' : 'text-black font-bold'}`}>
                                            {formatMoney(tech.value)} <span className="text-gray-500 text-[11px] font-normal">
                                                ({filteredData.achievedRevenue > 0 ? (tech.value / filteredData.achievedRevenue * 100).toFixed(0) : 0}%)
                                            </span>
                                        </span>
                                    </div>)}
                        </div>
                    </div>}
            </div>

            {/* 3. Revenue by Sector (DETAILS + PIE) */}
            <div style={glassCardStyle} className="p-4 flex flex-col min-h-[350px]">
                <h3 className="text-sm font-bold text-black mb-2">Revenue by Sector</h3>
                <div className="flex-1 min-h-[240px]">
                    {loading ? <div className="h-full flex flex-col items-center justify-center text-black font-bold">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue mb-2"></div>
                            <p>Loading revenue data...</p>
                        </div> : filteredData.sectorData.length > 0 ? (() => {
              const sectorTotal = filteredData.sectorData.reduce((sum, item) => sum + (item.value || 0), 0);
              const sortedSectors = [...filteredData.sectorData].sort((a, b) => (b.value || 0) - (a.value || 0));
              return <div className="h-full grid grid-cols-1 md:grid-cols-[46%_54%] gap-3 items-center">
                                <div className="h-full flex flex-col gap-2 justify-center">
                                    {sortedSectors.map((sector, index) => {
                    const pct = sectorTotal > 0 ? (sector.value / sectorTotal * 100).toFixed(0) : 0;
                    const color = SECTOR_COLORS[sector.name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                    return <div key={sector.name} className="rounded-xl border border-blue-100 bg-gradient-to-r from-white to-blue-50/60 px-3 py-2 shadow-sm">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{
                            backgroundColor: color
                          }} />
                                                        <span className="text-[13px] font-semibold text-gray-800 truncate">{sector.name}</span>
                                                    </div>
                                                    <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">{pct}%</span>
                                                </div>
                                                <p className="text-[15px] font-bold text-gray-900 mt-1">{formatMoney(sector.value)}</p>
                                            </div>;
                  })}
                                    <div className="rounded-xl border border-gray-200 bg-white/80 px-3 py-2 mt-1">
                                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Revenue</p>
                                        <p className="text-[16px] font-bold text-primary-blue">{formatMoney(sectorTotal)}</p>
                                    </div>
                                </div>
                                <div className="h-full min-h-[240px] relative">
                                    <div className="absolute inset-0 pointer-events-none">
                                        <div className="absolute left-1/2 top-1/2 w-40 h-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-200/25 blur-2xl"></div>
                                    </div>
                                    <SafeResponsiveContainer minHeight={240}>
                                        <PieChart accessibilityLayer={false}>
                                            <defs>
                                                <filter id="donutShadow" x="-40%" y="-40%" width="180%" height="220%">
                                                    <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.24" />
                                                </filter>
                                                {sortedSectors.map((entry, index) => {
                        const baseColor = SECTOR_COLORS[entry.name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                        return <linearGradient key={`type-grad-${index}`} id={`typeGrad-${index}`} x1="0" y1="0" x2="1" y2="1">
                                                            <stop offset="0%" stopColor={shiftColor(baseColor, 18)} />
                                                            <stop offset="58%" stopColor={baseColor} />
                                                            <stop offset="100%" stopColor={shiftColor(baseColor, -18)} />
                                                        </linearGradient>;
                      })}
                                            </defs>

                                            <Pie data={sortedSectors} cx="50%" cy="50%" innerRadius={0} outerRadius={102} paddingAngle={2} dataKey="value" stroke="none" style={{
                      filter: 'url(#donutShadow)'
                    }} activeIndex={activeSectorIndex} activeShape={renderActiveSectorShape} onMouseEnter={(_, index) => setActiveSectorIndex(index)} onMouseLeave={() => setActiveSectorIndex(-1)} isAnimationActive animationDuration={900} animationEasing="ease-out">
                                                {sortedSectors.map((entry, index) => <Cell key={`cell-${index}`} fill={`url(#typeGrad-${index})`} />)}
                                            </Pie>
                                            <Tooltip cursor={false} content={<CustomTooltip formatMoney={formatMoney} />} />
                                        </PieChart>
                                    </SafeResponsiveContainer>
                                </div>
                            </div>;
            })() : <div className="h-full flex flex-col items-center justify-center text-black font-bold">
                            <p>No revenue data available</p>
                        </div>}
                </div>
            </div>

            {/* Set Team Target Modal */}
            {isTargetModalOpen && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h2 className="text-xl font-bold text-gray-800">Set Team Targets</h2>
                            <button onClick={() => setIsTargetModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                <label className="text-sm font-medium text-gray-700">Target Period:</label>
                                <select value={targetPeriod} onChange={e => setTargetPeriod(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                  const currentTarget = member.targets?.find(t => t.year === new Date().getFullYear() && t.period === targetPeriod)?.amount || 0;
                  const displayTarget = currency === 'INR' ? currentTarget : currentTarget / EXCHANGE_RATE;
                  return <tr key={member._id} className="border-b border-gray-100 hover:bg-gray-50">
                                                    <td className="py-3 px-4 font-medium text-gray-800">{member.name}</td>
                                                    <td className="py-3 px-4 text-gray-600 text-xs">{member.role}</td>
                                                    <td className="py-3 px-4 text-gray-600">
                                                        {formatMoney(currentTarget)}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <input type="number" value={editingTargets[member._id] ?? Math.round(displayTarget)} onChange={e => setEditingTargets({
                        ...editingTargets,
                        [member._id]: e.target.value
                      })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter target" onFocus={() => {
                        const currentVal = editingTargets[member._id] ?? Math.round(displayTarget);
                        if (currentVal == 0 || currentVal == '0') {
                          setEditingTargets({
                            ...editingTargets,
                            [member._id]: ''
                          });
                        }
                      }} />
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <div className="flex items-center justify-center space-x-2">
                                                            {savedSuccessId === member._id ? <span className="text-green-600 font-medium text-sm flex items-center animate-fade-in-out">
                                                                    <Check size={16} className="mr-1" /> Saved
                                                                </span> : <button disabled={savingTarget === member._id} onClick={async () => {
                          const targetValue = editingTargets[member._id];
                          if (!targetValue || targetValue <= 0) {
                            addToast('Please enter a valid target amount', 'error');
                            return;
                          }
                          setSavingTarget(member._id);
                          try {
                            const token = sessionStorage.getItem('token');
                            const amountInInr = currency === 'INR' ? parseFloat(targetValue) : parseFloat(targetValue) * EXCHANGE_RATE;
                            await axios.put(`${API_BASE}/api/dashboard/manager/set-target/${member._id}`, {
                              period: targetPeriod,
                              year: new Date().getFullYear(),
                              amount: amountInInr
                            }, {
                              headers: {
                                Authorization: `Bearer ${token}`
                              }
                            });

                            // Refresh data if callback provided
                            if (onRefreshData) {
                              await onRefreshData();
                            }

                            // Clear the editing state for this member
                            const newTargets = {
                              ...editingTargets
                            };
                            delete newTargets[member._id];
                            setEditingTargets(newTargets);

                            // Show success indicator
                            setSavedSuccessId(member._id);
                            setTimeout(() => setSavedSuccessId(null), 3000);
                          } catch (err) {
                            console.error('Target update error:', err);
                            addToast(err.response?.data?.message || 'Failed to update target', 'error');
                          } finally {
                            setSavingTarget(null);
                          }
                        }} className={`px-3 py-1 rounded text-sm text-white transition-colors ${savingTarget === member._id ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                                                    {savingTarget === member._id ? 'Saving...' : 'Save'}
                                                                </button>}
                                                        </div>
                                                    </td>
                                                </tr>;
                })}
                                    </tbody>
                                </table>
                            </div>
                        </div>


                    </div>
                </div>}
        </div>;
};
export default RevenueAnalyticsRow;
