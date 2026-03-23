import { useState, useEffect } from 'react';
import { CheckCircle, GraduationCap, Package, FlaskConical, BadgePercent, Hotel, UtensilsCrossed, Building2, Plane, Ticket, Car, Wallet, Upload } from 'lucide-react';
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
  // Duration is stored as total hours in commonDetails.durationHours (1 day = 8 hours)
  const durationHours = activeData.commonDetails?.durationHours || opportunity.commonDetails?.durationHours || 0;
  const days = durationHours > 0 ? Math.ceil(durationHours / 8) : 0;
  const pax = activeData.participants || activeData.commonDetails?.attendanceParticipants || activeData.commonDetails?.totalParticipants || opportunity.participants || opportunity.commonDetails?.attendanceParticipants || opportunity.commonDetails?.totalParticipants || 0;
  const [localBreakdown, setLocalBreakdown] = useState({});

  // ─── Master expense definitions ────────────────────────────────────────────
  const ALL_EXPENSES = {
    trainerCost: {
      key: 'trainerCost', label: 'Trainer Cost', icon: GraduationCap,
      options: [{ value: 'costPerDay', label: 'Cost / Day' }, { value: 'costPerHour', label: 'Cost / Hour' }, { value: 'totalCost', label: 'Total Training Cost' }]
    },
    material: {
      key: 'material', label: 'Material Cost', icon: Package,
      options: [{ value: 'costPerPax', label: 'Cost / Pax' }, { value: 'overallCost', label: 'Overall Cost' }]
    },
    labs: {
      key: 'labs', label: 'Lab Cost', icon: FlaskConical,
      options: [{ value: 'costPerPaxDay', label: 'Cost / Pax / Day' }, { value: 'costPerPaxAllDays', label: 'Cost / Pax (All Days)' }, { value: 'totalCost', label: 'Total Cost' }]
    },
    gkRoyalty:       { key: 'gkRoyalty',       label: 'GK Royalty',        icon: BadgePercent,    fixedLabel: 'Fixed: Cost / Pax / Day' },
    accommodation:   { key: 'accommodation',    label: 'Accommodation',     icon: Hotel,           fixedLabel: 'Fixed: Cost / Day' },
    perDiem:         { key: 'perDiem',          label: 'Per Diem',          icon: UtensilsCrossed, fixedLabel: 'Fixed: Cost / Day' },
    venue: {
      key: 'venue', label: 'Venue Cost', icon: Building2,
      options: [{ value: 'costPerDay', label: 'Cost / Day' }, { value: 'totalCost', label: 'Total Cost' }]
    },
    travel: {
      key: 'travel', label: 'Travel Cost', icon: Plane,
      options: [{ value: 'costPerDay', label: 'Cost / Day' }, { value: 'totalCost', label: 'Total Cost' }]
    },
    vouchersCost:    { key: 'vouchersCost',     label: 'Vouchers',          icon: Ticket,  fixedLabel: 'Total amount' },
    localConveyance: { key: 'localConveyance',  label: 'Local Conveyance',  icon: Car,     fixedLabel: 'Total amount' },
  };

  // ─── Dynamic expense list based on opportunity type & training mode ─────────
  const getExpenseConfig = (type, mode) => {
    const e = ALL_EXPENSES;
    switch (type) {
      case 'Training': {
        const m = (mode || '').toLowerCase();
        if (m.includes('online') || m === 'virtual') {
          // Online / Virtual Training
          return [e.trainerCost, e.material, e.labs, e.gkRoyalty];
        }
        if (m.includes('offline') || m === 'classroom') {
          // Offline / Classroom Training
          return [e.trainerCost, e.material, e.labs, e.venue, e.accommodation, e.perDiem, e.travel, e.localConveyance, e.gkRoyalty];
        }
        if (m.includes('hybrid')) {
          // Hybrid Training
          return [e.trainerCost, e.material, e.labs, e.venue, e.travel, e.localConveyance, e.accommodation, e.perDiem, e.gkRoyalty];
        }
        // No mode selected yet — show all training-related expenses
        return [e.trainerCost, e.material, e.labs, e.venue, e.accommodation, e.perDiem, e.travel, e.localConveyance, e.gkRoyalty];
      }
      case 'Vouchers':
        return [e.vouchersCost, e.gkRoyalty];
      case 'Lab Support':
        return [e.labs, e.material, e.gkRoyalty];
      case 'Content Development':
        return [e.trainerCost, e.material, e.gkRoyalty];
      case 'Product Support':
        return [e.trainerCost, e.travel, e.accommodation, e.perDiem, e.localConveyance, e.gkRoyalty];
      case 'Resource Support':
        return [e.trainerCost, e.travel, e.accommodation, e.perDiem, e.localConveyance, e.gkRoyalty];
      default:
        // Fallback: show everything
        return Object.values(e);
    }
  };

  // Derive current config reactively from opportunity type + mode
  const opportunityType = activeData.type || opportunity.type || '';
  const trainingMode    = activeData.typeSpecificDetails?.modeOfTraining || opportunity.typeSpecificDetails?.modeOfTraining || '';
  const expenseConfig   = getExpenseConfig(opportunityType, trainingMode);


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
    const config = expenseConfig.find(c => c.key === category);

    // Ensure we handle when data is missing completely or fields are undefined
    const safeData = data || {};
    const type = safeData.type || (config?.options ? config.options[0].value : '');
    const rate = parseFloat(safeData.rate) || 0;
    const hours = parseFloat(safeData.hours) || 0;
    const subPax = parseFloat(safeData.pax) || pax; // Default to global pax if row-level pax not set

    switch (category) {
      case 'trainerCost':
        if (type === 'costPerDay') return rate * days;
        if (type === 'costPerHour') return rate * durationHours; // Use total duration hours directly
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

  // ─── VIEW MODE — compact horizontal card ──────────────────────────────────────
  const renderViewCard = config => {
    const { key: category, label, options, fixedLabel } = config;
    const data = localBreakdown[category] || {};
    const Icon = config.icon || Wallet;
    const currentTotal = activeData.expenses?.[category] || 0;
    const typeLabel = options
      ? options.find(o => o.value === data.type)?.label || options[0].label
      : fixedLabel ? fixedLabel.replace('Fixed: ', '') : 'Fixed';

    return (
      <div key={category}
        className="flex items-center gap-4 bg-white rounded-xl border border-slate-100 px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
      >
        {/* Icon badge */}
        <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-sm">
          <Icon size={16} className="text-white" />
        </div>

        {/* Label + billing type */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{label}</p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{typeLabel}</p>
        </div>

        {/* Rate */}
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-400">Rate</p>
          <p className="text-sm font-semibold text-slate-700">{CURRENCY_SYMBOL} {Number(data.rate || 0).toLocaleString()}</p>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-slate-100 shrink-0" />

        {/* Total */}
        <div className="text-right shrink-0 min-w-[80px]">
          <p className="text-xs text-slate-400">Total</p>
          <p className="text-base font-bold text-blue-900">
            {CURRENCY_SYMBOL} {(currentTotal / CONVERSION_RATE).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>

        {/* Doc link */}
        {opportunity.expenseDocuments?.[category]?.length > 0 && (
          <a
            href={`${API_BASE}/${opportunity.expenseDocuments[category][0].replace(/\\/g, '/')}`}
            target="_blank" rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
          >
            <CheckCircle size={13} /> View
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-900 to-blue-700">
        <h3 className="text-xl font-bold text-white">Operational Expenses Breakdown</h3>
        <div className="flex items-center gap-3">
          {/* Common Proposal Upload */}
          {canEdit && (
            <div className="flex items-center gap-2">
              <input type="file" id="upload-common-proposal" className="hidden" onChange={e => handleProposalUpload(e, 'proposal')} accept=".pdf,.doc,.docx,.ppt,.pptx" disabled={uploading} />
              <button
                onClick={() => document.getElementById('upload-common-proposal').click()}
                disabled={uploading}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/30 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-all shadow-sm"
              >
                <Upload size={13} />
                {opportunity.proposalDocument ? 'Replace Proposal' : 'Upload Proposal'}
              </button>
              {opportunity.proposalDocument && (
                <a
                  href={`${API_BASE}/${opportunity.proposalDocument.replace(/\\/g, '/')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-white/90 hover:text-white text-xs font-medium"
                >
                  <CheckCircle size={12} /> View
                </a>
              )}
            </div>
          )}
          {!canEdit && opportunity.proposalDocument && (
            <a
              href={`${API_BASE}/${opportunity.proposalDocument.replace(/\\/g, '/')}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white/15 border border-white/30 text-white text-xs font-semibold rounded-lg px-3 py-1.5"
            >
              <CheckCircle size={13} /> View Proposal
            </a>
          )}
          {/* Pax & Days badge */}
          <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm">
            <span className="font-medium opacity-80">Pax</span>
            <span className="font-bold">{pax}</span>
            <span className="w-px h-3 bg-white/30" />
            <span className="font-medium opacity-80">Days</span>
            <span className="font-bold">{days}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow overflow-y-auto p-4">
        {!canEdit ? (
          // VIEW MODE — single-column stacked cards, always readable
          <div className="flex flex-col gap-2.5">
            {expenseConfig.map(config => renderViewCard(config))}
          </div>
        ) : (
          // EDIT MODE — compact card rows
          <div className="flex flex-col gap-2">
            {expenseConfig.map(config => (
              <EditRow
                key={config.key}
                config={config}
                data={localBreakdown[config.key] || {}}
                onUpdate={(field, val) => updateBreakdown(config.key, field, val)}
                onUpload={e => handleProposalUpload(e, config.key)}
                uploading={uploading}
                opportunity={opportunity}
                pendingDocs={pendingDocs}
                currentAmount={(calculateTotal(config.key, localBreakdown[config.key] || {}) ?? 0)}
                CURRENCY_SYMBOL={CURRENCY_SYMBOL}
                CONVERSION_RATE={CONVERSION_RATE}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-blue-800">Total Expenses</span>
        <span className="text-xl font-extrabold text-blue-900">
          {CURRENCY_SYMBOL} {expenseConfig.reduce((sum, cfg) => {
            const t = calculateTotal(cfg.key, localBreakdown[cfg.key] || {});
            return sum + (t ?? 0);
          }, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
};

// ─── Edit Row ──────────────────────────────────────────────────────────────
// Card-style row: icon | label+type | rate input | total | upload/view
const EditRow = ({
  config, data, onUpdate, onUpload, uploading,
  opportunity, pendingDocs = {}, currentAmount,
  CURRENCY_SYMBOL, CONVERSION_RATE
}) => {
  const { key: category, label, options, fixedLabel, icon: Icon } = config;
  const selectedType = data.type || (options ? options[0].value : '');

  const handleUpdate = (field, val) => {
    if (!data.type && options && field !== 'type') {
      onUpdate({ type: options[0].value, [field]: val });
    } else {
      onUpdate(field, val);
    }
  };

  const hasPending  = Boolean(pendingDocs?.[category]);
  const hasUploaded = Boolean(opportunity.expenseDocuments?.[category]?.length > 0);

  return (
    <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl px-4 py-2.5 hover:border-blue-200 hover:bg-blue-50/30 transition-all shadow-sm">
      {/* Icon */}
      <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-sm">
        <Icon size={14} className="text-white" />
      </div>

      {/* Label + Type selector */}
      <div className="flex flex-col min-w-[140px] flex-shrink-0">
        <span className="font-semibold text-slate-700 text-sm leading-tight">{label}</span>
        {options ? (
          <select
            value={selectedType}
            onChange={e => onUpdate('type', e.target.value)}
            className="mt-1 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
          >
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        ) : (
          <span className="mt-1 text-xs text-slate-400">{fixedLabel ? fixedLabel.replace('Fixed: ', '') : 'Fixed'}</span>
        )}
      </div>

      {/* Rate input */}
      <div className="flex-1 flex gap-2">
        <TableInput value={data.rate} onChange={v => handleUpdate('rate', v)} prefix={CURRENCY_SYMBOL} />
      </div>

      {/* Total */}
      <div className="text-right shrink-0 min-w-[90px]">
        <p className="text-xs text-slate-400">Total</p>
        <p className="text-sm font-bold text-blue-900">{CURRENCY_SYMBOL} {(currentAmount / CONVERSION_RATE).toLocaleString()}</p>
      </div>

      {/* Upload + View — only for cost items that require a proposal document */}
      {['trainerCost', 'material', 'labs', 'vouchersCost'].includes(category) && (
        <div className="shrink-0 flex items-center gap-2">
          <input type="file" id={`upload-${category}`} className="hidden" onChange={e => onUpload(e)} disabled={uploading === category} />
          <UploadButton
            onClick={() => document.getElementById(`upload-${category}`).click()}
            disabled={uploading === category}
          >
            {hasUploaded || hasPending ? 'Replace' : 'Upload'}
          </UploadButton>
          {hasPending && (
            <span className="inline-flex items-center text-blue-600 text-xs font-semibold">
              <CheckCircle size={12} className="mr-0.5" /> Uploaded
            </span>
          )}
          {!hasPending && hasUploaded ? (
            <a
              href={`${API_BASE}/${opportunity.expenseDocuments[category][0].replace(/\\/g, '/')}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center text-blue-600 hover:underline text-xs font-medium"
            >
              <CheckCircle size={12} className="mr-0.5" /> View
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
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
