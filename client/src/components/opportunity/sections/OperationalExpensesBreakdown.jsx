import { useState, useEffect } from 'react';
import { CheckCircle, GraduationCap, Package, FlaskConical, BadgePercent, Hotel, UtensilsCrossed, Building2, Plane, Ticket, Car, Wallet } from 'lucide-react';
import { useCurrency } from '../../../context/CurrencyContext';
import { API_BASE } from '../../../config/api';
import UploadButton from '../../ui/UploadButton';
const OperationalExpensesBreakdown = ({
  activeData,
  handleChange,
  handleProposalUpload,
  uploading,
  canEdit,
  opportunity,
  pendingDocs = {}
}) => {
  const {
    currency
  } = useCurrency();
  const CONVERSION_RATE = currency === 'USD' ? 84 : 1;
  const CURRENCY_SYMBOL = currency === 'USD' ? '$' : '₹';

  // Helper accessors for days and pax from activeData or opportunity
  const days = activeData.days || activeData.commonDetails?.duration || activeData.commonDetails?.trainingDays || opportunity.days || opportunity.commonDetails?.duration || opportunity.commonDetails?.trainingDays || 0;
  const pax = activeData.participants || activeData.commonDetails?.attendanceParticipants || activeData.commonDetails?.totalParticipants || opportunity.participants || opportunity.commonDetails?.attendanceParticipants || opportunity.commonDetails?.totalParticipants || 0;
  const [localBreakdown, setLocalBreakdown] = useState({});

  // Configuration for expenses order and options
  const expenseConfig = [{
    key: 'trainerCost',
    label: 'Trainer Cost',
    icon: GraduationCap,
    options: [{
      value: 'costPerDay',
      label: 'Cost / Day'
    }, {
      value: 'costPerHour',
      label: 'Cost / Hour'
    }, {
      value: 'totalCost',
      label: 'Total Training Cost'
    }]
  }, {
    key: 'material',
    label: 'Material Cost',
    icon: Package,
    options: [{
      value: 'costPerPax',
      label: 'Cost / Pax'
    }, {
      value: 'overallCost',
      label: 'Overall Cost'
    }]
  }, {
    key: 'labs',
    label: 'Lab Cost',
    icon: FlaskConical,
    options: [{
      value: 'costPerPaxDay',
      label: 'Cost / Pax / Day'
    }, {
      value: 'costPerPaxAllDays',
      label: 'Cost / Pax (All Days)'
    }, {
      value: 'totalCost',
      label: 'Total Cost'
    }]
  }, {
    key: 'gkRoyalty',
    label: 'GK Royalty',
    icon: BadgePercent,
    fixedLabel: 'Fixed: Cost / Pax / Day'
  }, {
    key: 'accommodation',
    label: 'Accommodation',
    icon: Hotel,
    fixedLabel: 'Fixed: Cost / Day'
  }, {
    key: 'perDiem',
    label: 'Per Diem',
    icon: UtensilsCrossed,
    fixedLabel: 'Fixed: Cost / Day'
  }, {
    key: 'venue',
    label: 'Venue Cost',
    icon: Building2,
    options: [{
      value: 'costPerDay',
      label: 'Cost / Day'
    }, {
      value: 'totalCost',
      label: 'Total Cost'
    }]
  }, {
    key: 'travel',
    label: 'Travel Cost',
    icon: Plane,
    options: [{
      value: 'costPerDay',
      label: 'Cost / Day'
    }, {
      value: 'totalCost',
      label: 'Total Cost'
    }]
  }, {
    key: 'vouchersCost',
    label: 'Vouchers',
    icon: Ticket,
    fixedLabel: 'Total amount'
  }, {
    key: 'localConveyance',
    label: 'Local Conveyance',
    icon: Car,
    fixedLabel: 'Total amount'
  }];

  // Sync local state on prop change
  useEffect(() => {
    if (activeData.expenses?.breakdown) {
      setLocalBreakdown(activeData.expenses.breakdown);
    }
  }, [activeData.expenses]);

  // Auto-recalculate totals when Global dependencies (days, pax) change
  useEffect(() => {
    if (!localBreakdown || Object.keys(localBreakdown).length === 0) return;
    if (!canEdit) return;
    const expCategories = expenseConfig.map(e => e.key);
    expCategories.forEach(category => {
      const data = localBreakdown[category];
      // Check if we should recalculate. 
      if (data) {
        const newTotal = calculateTotal(category, data);
        if (newTotal !== null && activeData.expenses?.[category] !== newTotal * CONVERSION_RATE) {
          handleChange('expenses', category, newTotal * CONVERSION_RATE);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, pax]);
  const updateBreakdown = (category, fieldOrUpdates, value) => {
    if (!canEdit) return;
    let updates = {};
    if (typeof fieldOrUpdates === 'string') {
      updates = {
        [fieldOrUpdates]: value
      };
    } else {
      updates = fieldOrUpdates;
    }
    const currentCat = localBreakdown[category] || {};
    const updatedCategory = {
      ...currentCat,
      ...updates
    };
    const newBreakdown = {
      ...localBreakdown,
      [category]: updatedCategory
    };
    setLocalBreakdown(newBreakdown);
    const newTotal = calculateTotal(category, updatedCategory);
    handleChange('expenses', 'breakdown', newBreakdown);
    if (newTotal !== null) {
      handleChange('expenses', category, newTotal * CONVERSION_RATE);
    }
  };
  const calculateTotal = (category, data) => {
    if (!data) return 0;
    const type = data.type;
    const rate = parseFloat(data.rate) || 0;
    const hours = parseFloat(data.hours) || 0;
    const subPax = parseFloat(data.pax) || pax; // Default to global pax if row-level pax not set

    switch (category) {
      case 'trainerCost':
        if (type === 'costPerDay') return rate * days;
        if (type === 'costPerHour') return rate * hours * days;
        if (type === 'totalCost') return rate;
        return 0;
      case 'material':
        if (type === 'costPerPax') return rate * subPax;
        if (type === 'overallCost') return rate;
        return 0;
      case 'labs':
        if (type === 'costPerPaxDay') return rate * subPax * days;
        if (type === 'costPerPaxAllDays') return rate * subPax;
        if (type === 'totalCost') return rate;
        return 0;
      case 'gkRoyalty':
        return rate * pax * days;
      case 'accommodation':
      case 'perDiem':
        return rate * days;
      case 'venue':
      case 'travel':
        if (type === 'costPerDay') return rate * days;
        if (type === 'totalCost') return rate;
        return rate;
      default:
        return rate;
    }
  };

  // --- VIEW MODE RENDERER (CARD STYLE) ---
  const renderViewCard = config => {
    const {
      key: category,
      label,
      options,
      fixedLabel
    } = config;
    const data = localBreakdown[category] || {};
    const Icon = config.icon || Wallet;
    const currentTotal = activeData.expenses?.[category] || 0;
    const typeLabel = options ? options.find(o => o.value === data.type)?.label || data.type : fixedLabel ? fixedLabel.replace('Fixed: ', '') : 'Fixed';
    return <div key={category} className="bg-white/80 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-center h-full shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex justify-between items-center mb-2">
        <div className="inline-flex items-center gap-2 min-w-0">
          <Icon size={16} className="text-slate-700" />
          <span className="font-semibold text-slate-800 text-base">{label}</span>
          {opportunity.expenseDocuments?.[category]?.length > 0 && <a href={`${API_BASE}/${opportunity.expenseDocuments[category][0].replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-blue-600 hover:underline text-sm font-medium" title="View Document">
            <CheckCircle size={14} className="mr-1" /> View
          </a>}
        </div>
        <span className="font-bold text-slate-900 text-base">
          {CURRENCY_SYMBOL} {(currentTotal / CONVERSION_RATE).toLocaleString(undefined, {
            maximumFractionDigits: 0
          })}
        </span>
      </div>

      <div className="flex justify-between items-center text-base text-slate-700 leading-relaxed">
        <span className="text-slate-800 font-medium">{typeLabel}</span>
        <span className="font-semibold text-slate-900 text-base">
          {CURRENCY_SYMBOL} {Number(data.rate || 0).toLocaleString()}
        </span>
      </div>

      {data.hours > 0 && data.type === 'costPerHour' && <div className="text-sm text-slate-700 mt-1">Hours: {data.hours}</div>}
    </div>;
  };
  return <div className="h-full flex flex-col rounded-3xl border border-slate-200/80 bg-white p-3 sm:p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm">
    {/* Header Section */}
    <div className="flex flex-row items-center justify-between gap-3 mb-5 pb-2">
      <h3 className="text-xl font-bold text-primary-blue mb-4">Operational Expenses Breakdown</h3>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50/50 border border-blue-100 rounded-lg text-sm font-medium text-blue-900">
          <span className="text-blue-900">Pax:</span>
          <span className="font-bold">{pax}</span>
          <span className="w-px h-3 bg-blue-200 mx-1"></span>
          <span className="text-blue-900">Days:</span>
          <span className="font-bold">{days}</span>
        </div>
      </div>
    </div>

    {/* Content Section */}
    <div className="flex-grow overflow-y-auto pr-1">
      {!canEdit ?
        // VIEW MODE: Grid Cards
        <div className="grid h-full gap-4 grid-cols-1 md:grid-cols-2">
          {expenseConfig.map(config => renderViewCard(config))}
        </div> :
        // EDIT MODE: Table Layout
        <div className="w-full border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
          {/* Table Header */}
          <div className="min-w-[980px] grid grid-cols-[1.45fr_1.4fr_1fr_0.95fr_0.65fr_0.9fr] gap-4 py-3.5 px-4 bg-blue-900 text-white text-sm font-semibold uppercase tracking-wider">
            <div>Expenses</div>
            <div>Type</div>
            <div>Rate</div>
            <div className="text-center">Proposal</div>
            <div className="text-center">View</div>
            <div className="text-right">Total Amount</div>
          </div>

          {/* Table Rows */}
          <div className="min-w-[980px] bg-white divide-y divide-slate-100">
            {expenseConfig.map(config => <EditRow key={config.key} config={config} data={localBreakdown[config.key] || {}} onUpdate={(field, val) => updateBreakdown(config.key, field, val)} onUpload={e => handleProposalUpload(e, config.key)} uploading={uploading} opportunity={opportunity} pendingDocs={pendingDocs} currentAmount={activeData.expenses?.[config.key] || 0} CURRENCY_SYMBOL={CURRENCY_SYMBOL} CONVERSION_RATE={CONVERSION_RATE} />)}
          </div>
        </div>}
    </div>

    {/* Footer / Total Section */}
    <div className="mt-4 pt-3 border-t border-slate-200/70 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
      <span className="text-base font-bold text-blue-900">Total Expenses</span>
      <span className="text-2xl sm:text-[2rem] font-bold text-blue-900">
        {CURRENCY_SYMBOL} {(Object.keys(activeData.expenses || {}).reduce((sum, key) => {
          if (key === 'breakdown' || key === 'marketingPercent' || key === 'contingencyPercent' || key === 'targetGpPercent' || key === 'marketing' || key === 'contingency') return sum;
          return sum + (parseFloat(activeData.expenses[key]) || 0);
        }, 0) / CONVERSION_RATE).toLocaleString(undefined, {
          maximumFractionDigits: 0
        })}
      </span>
    </div>
  </div>;
};

// Extracted Edit Row Component to solve React Hook Violation
const EditRow = ({
  config,
  data,
  onUpdate,
  onUpload,
  uploading,
  opportunity,
  pendingDocs = {},
  currentAmount,
  CURRENCY_SYMBOL,
  CONVERSION_RATE
}) => {
  const {
    key: category,
    label,
    options,
    fixedLabel,
    icon: Icon
  } = config;

  // Initialize default type if missing
  useEffect(() => {
    if (!data.type && options) {
      // Default to first option
      onUpdate('type', options[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const selectedType = data.type || (options ? options[0].value : '');

  // Helper to pass updates correctly
  const handleUpdate = (field, val) => {
    onUpdate(field, val);
  };
  const handleTypeChange = e => {
    onUpdate('type', e.target.value);
  };

  // --- Rate Input Logic ---
  let rateInput = null;
  if (category === 'trainerCost') {
    if (selectedType === 'costPerHour') {
      rateInput = <div className="grid grid-cols-2 gap-2">
        <TableInput value={data.hours} onChange={v => handleUpdate('hours', v)} placeholder="Hrs" className="w-full" />
        <TableInput value={data.rate} onChange={v => handleUpdate('rate', v)} prefix={CURRENCY_SYMBOL} placeholder="Rate" className="w-full" />
      </div>;
    } else {
      // costPerDay or totalCost
      rateInput = <TableInput value={data.rate} onChange={v => handleUpdate('rate', v)} prefix={CURRENCY_SYMBOL} />;
    }
  } else {
    // For all others (Material, Labs, etc.), per USER REQUEST, DO NOT SHOW PAX INPUT.
    // Just show the rate input. Calculation will use global Pax if needed.
    rateInput = <TableInput value={data.rate} onChange={v => handleUpdate('rate', v)} prefix={CURRENCY_SYMBOL} />;
  }
  const hasPending = Boolean(pendingDocs?.[category]);
  const hasUploaded = Boolean(opportunity.expenseDocuments?.[category]?.length > 0);
  return <div key={category} className="grid grid-cols-[1.45fr_1.4fr_1fr_0.95fr_0.65fr_0.9fr] gap-4 items-center py-2.5 px-4 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
    {/* Expense Name */}
    <div className="flex items-center gap-3">
      <div className="p-1.5 bg-blue-50 text-blue-900 rounded-lg">
        <Icon size={16} />
      </div>
      <span className="font-semibold text-slate-700 text-base">{label}</span>
    </div>

    {/* Type Dropdown */}
    <div className="pr-2">
      {options ? <div className="relative">
        <select value={selectedType} onChange={handleTypeChange} className="w-full appearance-none bg-slate-50 border border-gray-500 text-black text-sm font-medium rounded-lg py-2.5 px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
          {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
        </div>
      </div> : <span className="text-sm text-black-400 font-medium px-3 py-2.5 bg-slate-50 rounded border border-gray-500 block w-full text-left truncate" title={fixedLabel}>
        {fixedLabel ? fixedLabel.replace('Fixed: ', '') : 'Fixed'}
      </span>}
    </div>

    {/* Rate Input */}
    <div>
      {rateInput}
    </div>

    {/* Upload Action */}
    <div className="flex justify-center">
      <div className="flex items-center gap-2">
      {hasPending && <span className="inline-flex items-center text-blue-600 text-sm font-semibold">
          <CheckCircle size={14} className="mr-1" /> Uploaded
      </span>}
      <input type="file" id={`upload-${category}`} className="hidden" onChange={e => onUpload(e)} disabled={uploading === category} />
      <UploadButton onClick={() => document.getElementById(`upload-${category}`).click()} disabled={uploading === category}>
        {hasUploaded || hasPending ? 'Replace' : 'Upload'}
      </UploadButton>
      </div>
    </div>

    {/* View */}
    <div className="flex justify-center">
      {!hasPending && hasUploaded ? <a href={`${API_BASE}/${opportunity.expenseDocuments[category][0].replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-blue-600 hover:underline text-sm font-medium"><CheckCircle size={14} className="mr-1" />View</a> : <span className="text-slate-300 text-sm">-</span>}
    </div>

    {/* Total Amount */}
    <div className="text-right font-bold text-slate-700 text-base">
      {CURRENCY_SYMBOL} {(currentAmount / CONVERSION_RATE).toLocaleString()}
    </div>
  </div>;
};

// Simplified Input for Table
const TableInput = ({
  value,
  onChange,
  placeholder,
  prefix,
  className = ''
}) => {
  return <div className={`relative flex items-center ${className}`}>
    {prefix && <span className="absolute left-3 text-slate-400 text-sm font-medium pointer-events-none">{prefix}</span>}
    <input type="number" value={value || ''} onChange={e => onChange(e.target.value)} onWheel={e => e.target.blur()} placeholder={placeholder || '0'} className={`w-full bg-slate-50 border border-gray-500 rounded-lg py-2.5 ${prefix ? 'pl-8' : 'pl-3'} pr-3 text-base font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-right`} />
  </div>;
};
export default OperationalExpensesBreakdown;
