import React, { useState, useEffect, useRef } from 'react';
import { Upload, Eye } from 'lucide-react';
import Card from '../../ui/Card';
import { useCurrency } from '../../../context/CurrencyContext';
import { useAuth } from '../../../context/AuthContext';

const OperationalExpensesBreakdown = ({
    activeData,
    handleChange,
    handleProposalUpload,
    uploading,
    isEditing,
    canEdit,
    opportunity
}) => {
    const { currency } = useCurrency();
    const { user } = useAuth();
    const CONVERSION_RATE = currency === 'USD' ? 84 : 1;
    const CURRENCY_SYMBOL = currency === 'USD' ? '$' : '₹';

    // Helper to access breakdown (with fallback)
    const getBreakdown = () => activeData.expenses?.breakdown || {};

    // Helper accessors for days and pax from activeData (for immediate reactivity) or opportunity
    const days = activeData.days || activeData.commonDetails?.duration || activeData.commonDetails?.trainingDays || opportunity.days || opportunity.commonDetails?.duration || opportunity.commonDetails?.trainingDays || 0;
    const pax = activeData.participants || activeData.commonDetails?.attendanceParticipants || activeData.commonDetails?.totalParticipants || opportunity.participants || opportunity.commonDetails?.attendanceParticipants || opportunity.commonDetails?.totalParticipants || 0;

    const [localBreakdown, setLocalBreakdown] = useState({});
    const initializedTypes = useRef(new Set());

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

        console.log('DEBUG: Recalculating expenses due to days/pax change. Days:', days, 'Pax:', pax);

        const expCategories = [
            'trainerCost', 'material', 'labs', 'gkRoyalty', 'accommodation', 'perDiem',
            'venue', 'travel'
        ];

        expCategories.forEach(category => {
            const data = localBreakdown[category];
            if (data && data.type) {
                // Determine if this category relies on days or pax
                // This mimics calculateTotal logic but we just run it safely for all relevant ones
                const newTotal = calculateTotal(category, data);
                // Only update if value implies a change (check against activeData to avoid loops? No, handleChange is safe)
                if (newTotal !== null && activeData.expenses?.[category] !== newTotal * CONVERSION_RATE) {
                    handleChange('expenses', category, newTotal * CONVERSION_RATE);
                }
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [days, pax]); // Only run when global factors change

    const updateBreakdown = (category, fieldOrUpdates, value) => {
        if (!canEdit) return;

        // Normalize updates to an object -> BATCH UPDATE SUPPORT
        let updates = {};
        if (typeof fieldOrUpdates === 'string') {
            updates = { [fieldOrUpdates]: value };
        } else {
            updates = fieldOrUpdates;
        }

        const currentCat = localBreakdown[category] || {};
        const updatedCategory = { ...currentCat, ...updates };

        const newBreakdown = { ...localBreakdown, [category]: updatedCategory };
        setLocalBreakdown(newBreakdown);

        // Update parent with new breakdown AND calculated total (Converted to Base Currency)
        const newTotal = calculateTotal(category, updatedCategory);
        handleChange('expenses', 'breakdown', newBreakdown); // Save breakdown
        if (newTotal !== null) {
            handleChange('expenses', category, newTotal * CONVERSION_RATE); // Save calculated total in Base Currency -> CURRENCY FIX
        }
    };

    const calculateTotal = (category, data) => {
        const type = data.type;
        const rate = parseFloat(data.rate) || 0;
        const hours = parseFloat(data.hours) || 0;
        const subPax = parseFloat(data.pax) || pax;

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
                // For other categories, default to direct rate/amount if logic undefined
                return rate;
        }
    };

    const renderInputGroup = (category, label, typeOptions = null, fixedTypeLabel = null) => {
        const data = localBreakdown[category] || {};
        const selectedType = data.type || (typeOptions ? typeOptions[0].value : '');
        const currentTotal = activeData.expenses?.[category] || 0;

        const typeLabel = typeOptions
            ? (typeOptions.find(o => o.value === data.type)?.label || data.type)
            : (fixedTypeLabel ? fixedTypeLabel.replace('Fixed: ', '') : 'Fixed');

        // Initialize type if missing (only once per category)
        if (!data.type && typeOptions && canEdit && !initializedTypes.current.has(category)) {
            initializedTypes.current.add(category);
            // We don't need the timeout hack anymore as handleUpdate will catch it, 
            // but keeping it doesn't hurt. 
        }

        // Helper to ensure type is saved when value changes
        const handleUpdate = (field, val) => {
            // explicitly include selectedType (which defaults to first option) to ensure calculation works
            updateBreakdown(category, { [field]: val, type: selectedType });
        };

        return (
            <div className={`bg-gray-50 border border-gray-200 rounded-lg ${!canEdit ? 'p-2' : 'p-3'} mb-4 last:mb-0 h-full`}>
                <div className={`flex justify-between items-center ${!canEdit ? 'mb-1' : 'mb-2'}`}>
                    <span className={`font-bold text-gray-800 ${!canEdit ? 'text-xs' : 'text-sm'}`}>{label}</span>
                    <span className={`font-bold text-primary-blue ${!canEdit ? 'text-xs' : 'text-sm'}`}>
                        {CURRENCY_SYMBOL} {(currentTotal / CONVERSION_RATE).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                </div>

                {canEdit && (
                    <div className="mb-2">
                        {typeOptions ? (
                            <select
                                value={selectedType}
                                onChange={(e) => updateBreakdown(category, 'type', e.target.value)}
                                className="w-full text-xs p-1.5 border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:border-blue-500"
                            >
                                {typeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        ) : (
                            <div className="text-xs text-gray-500 italic border-b border-gray-200 pb-1 mb-1">{fixedTypeLabel}</div>
                        )}
                    </div>
                )}

                {canEdit ? (
                    <div className="grid grid-cols-2 gap-2">
                        {category === 'trainerCost' && (
                            <>
                                {selectedType === 'costPerDay' && (
                                    <div className="col-span-2"><Input label="Rate / Day" value={data.rate} onChange={v => handleUpdate('rate', v)} /></div>
                                )}
                                {selectedType === 'costPerHour' && <><Input label="Hours" value={data.hours} onChange={v => handleUpdate('hours', v)} /><Input label="Rate/Hour" value={data.rate} onChange={v => handleUpdate('rate', v)} /></>}
                                {selectedType === 'totalCost' && (
                                    <div className="col-span-2"><Input label="Total Cost" value={data.rate} onChange={v => handleUpdate('rate', v)} /></div>
                                )}
                            </>
                        )}
                        {category === 'material' && (
                            <>
                                {selectedType === 'costPerPax' && <><Input label="Pax" value={data.pax || pax} onChange={v => handleUpdate('pax', v)} /><Input label="Rate / Pax" value={data.rate} onChange={v => handleUpdate('rate', v)} /></>}
                                {selectedType === 'overallCost' && (
                                    <div className="col-span-2"><Input label="Total Cost" value={data.rate} onChange={v => handleUpdate('rate', v)} /></div>
                                )}
                            </>
                        )}
                        {category === 'labs' && (
                            <>
                                {(selectedType === 'costPerPaxDay' || selectedType === 'costPerPaxAllDays') && <><Input label="Pax" value={data.pax || pax} onChange={v => handleUpdate('pax', v)} /><Input label={`Rate / Pax${selectedType === 'costPerPaxDay' ? ' / Day' : ''}`} value={data.rate} onChange={v => handleUpdate('rate', v)} /></>}
                                {selectedType === 'totalCost' && (
                                    <div className="col-span-2"><Input label="Total Cost" value={data.rate} onChange={v => handleUpdate('rate', v)} /></div>
                                )}
                            </>
                        )}
                        {(category === 'gkRoyalty' || category === 'accommodation' || category === 'perDiem') && (
                            <>
                                {category === 'gkRoyalty' && <div className="col-span-2 text-xs text-gray-400 mb-1">Pax: {pax}, Days: {days}</div>}
                                {(category === 'accommodation' || category === 'perDiem') && <div className="col-span-2 text-xs text-gray-400 mb-1">Days: {days}</div>}
                                <div className="col-span-2"><Input label={category === 'gkRoyalty' ? 'Rate / Pax / Day' : 'Rate / Day'} value={data.rate} onChange={v => handleUpdate('rate', v)} /></div>
                            </>
                        )}
                        {(category === 'venue' || category === 'travel') && (
                            <>
                                {selectedType === 'costPerDay' && <div className="col-span-2"><Input label="Cost / Day" value={data.rate} onChange={v => handleUpdate('rate', v)} /></div>}
                                {selectedType === 'totalCost' && <div className="col-span-2"><Input label="Total Cost" value={data.rate} onChange={v => handleUpdate('rate', v)} /></div>}
                            </>
                        )}
                    </div>
                ) : (
                    <div className="flex justify-between items-center text-[11px] text-gray-600">
                        <span className="text-gray-500">{typeLabel}</span>
                        <span className="font-medium text-gray-800">
                            {CURRENCY_SYMBOL} {Number(data.rate || 0).toLocaleString()}
                        </span>
                    </div>
                )}

                {(canEdit || opportunity.expenseDocuments?.[category]?.length > 0) && (
                    <div className={`flex justify-end ${!canEdit ? 'mt-1 pt-1' : 'mt-1 pt-1'} border-t border-gray-100`}>
                        <div className="flex items-center space-x-2">
                            {opportunity.expenseDocuments?.[category]?.length > 0 && (
                                <a
                                    href={`http://localhost:5000/${opportunity.expenseDocuments[category][0].replace(/\\/g, '/')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-400 hover:text-primary-blue"
                                    title="View Document"
                                >
                                    <Eye size={14} />
                                </a>
                            )}
                            {isEditing && canEdit && (
                                <>
                                    <input
                                        type="file"
                                        id={`upload-${category}`}
                                        className="hidden"
                                        onChange={(e) => handleProposalUpload(e, category)}
                                        disabled={uploading === category}
                                    />
                                    <button
                                        onClick={() => document.getElementById(`upload-${category}`).click()}
                                        disabled={uploading === category}
                                        className="transition-colors text-gray-400 hover:text-primary-blue"
                                        title="Upload Document"
                                    >
                                        <Upload size={14} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Helper to render "Other Expenses" (Venue, Travel, etc.)
    const renderOtherExpense = (key) => {
        return (
            <div key={key} className={`bg-white border border-gray-200 rounded-lg ${!canEdit ? 'p-2' : 'p-3'} h-full`}>
                <div className={`flex justify-between items-center ${!canEdit ? 'mb-1' : 'mb-2'}`}>
                    <span className={`font-bold text-gray-600 ${!canEdit ? 'text-xs' : 'text-sm'} capitalize`}>
                        {key.replace('Cost', '').replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className={`font-bold text-gray-800 ${!canEdit ? 'text-xs' : 'text-sm'}`}>
                        {CURRENCY_SYMBOL} {((activeData.expenses?.[key] || 0) / CONVERSION_RATE).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                </div>

                {/* Edit Input (Delivery Only) */}
                {canEdit && (
                    <Input
                        label="Amount"
                        value={localBreakdown[key]?.rate !== undefined ? localBreakdown[key].rate : ((activeData.expenses?.[key] || 0) / CONVERSION_RATE)}
                        onChange={v => {
                            // Use batch update to prevent state clobbering and ensure correct updates
                            updateBreakdown(key, { rate: v, type: 'manual' });
                        }}
                    />
                )}



                {/* Document Upload / View */}
                {(canEdit || opportunity.expenseDocuments?.[key]?.length > 0) && (
                    <div className={`flex justify-end ${!canEdit ? 'mt-1 pt-1' : 'mt-2 pt-2'} border-t border-gray-100`}>
                        <div className="flex items-center space-x-2">
                            {opportunity.expenseDocuments?.[key]?.length > 0 && (
                                <a
                                    href={`http://localhost:5000/${opportunity.expenseDocuments[key][0].replace(/\\/g, '/')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-400 hover:text-primary-blue"
                                    title="View Document"
                                >
                                    <Eye size={14} />
                                </a>
                            )}
                            {isEditing && canEdit && (
                                <>
                                    <input
                                        type="file"
                                        id={`upload-${key}`}
                                        className="hidden"
                                        onChange={(e) => handleProposalUpload(e, key)}
                                        disabled={uploading === key}
                                    />
                                    <button
                                        onClick={() => document.getElementById(`upload-${key}`).click()}
                                        disabled={uploading === key}
                                        className="transition-colors text-gray-400 hover:text-primary-blue"
                                        title="Upload Document"
                                    >
                                        <Upload size={14} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Card className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                <h3 className="text-lg font-bold text-primary-blue">Operational Expenses Breakdown</h3>
                <div className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">
                    Pax: <span className="text-gray-800 font-bold">{pax}</span> &bull; Days: <span className="text-gray-800 font-bold">{days}</span>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto pr-1">
                {!canEdit ? (
                    <div className="grid gap-4 grid-flow-col grid-rows-5 auto-cols-fr">
                        {renderInputGroup('trainerCost', 'Trainer Cost', [{ value: 'costPerDay', label: 'Cost / Day' }, { value: 'costPerHour', label: 'Cost / Hour' }, { value: 'totalCost', label: 'Total Training Cost' }])}
                        {renderInputGroup('material', 'Material Cost', [{ value: 'costPerPax', label: 'Cost / Pax' }, { value: 'overallCost', label: 'Overall Cost' }])}
                        {renderInputGroup('labs', 'Lab Cost', [{ value: 'costPerPaxDay', label: 'Cost / Pax / Day' }, { value: 'costPerPaxAllDays', label: 'Cost / Pax (All Days)' }, { value: 'totalCost', label: 'Total Cost' }])}
                        {renderInputGroup('gkRoyalty', 'GK Royalty', null, 'Fixed: Cost / Pax / Day')}
                        {renderInputGroup('accommodation', 'Accommodation', null, 'Fixed: Cost / Day')}
                        {renderInputGroup('perDiem', 'Per Diem', null, 'Fixed: Cost / Day')}
                        {renderInputGroup('venue', 'Venue Cost', [{ value: 'costPerDay', label: 'Cost / Day' }, { value: 'totalCost', label: 'Total Cost' }])}
                        {renderInputGroup('travel', 'Travel Cost', [{ value: 'costPerDay', label: 'Cost / Day' }, { value: 'totalCost', label: 'Total Cost' }])}
                        {['vouchersCost', 'localConveyance'].map(key => renderOtherExpense(key))}
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            {renderInputGroup('trainerCost', 'Trainer Cost', [{ value: 'costPerDay', label: 'Cost / Day' }, { value: 'costPerHour', label: 'Cost / Hour' }, { value: 'totalCost', label: 'Total Training Cost' }])}
                            {renderInputGroup('material', 'Material Cost', [{ value: 'costPerPax', label: 'Cost / Pax' }, { value: 'overallCost', label: 'Overall Cost' }])}
                            {renderInputGroup('labs', 'Lab Cost', [{ value: 'costPerPaxDay', label: 'Cost / Pax / Day' }, { value: 'costPerPaxAllDays', label: 'Cost / Pax (All Days)' }, { value: 'totalCost', label: 'Total Cost' }])}
                            {renderInputGroup('gkRoyalty', 'GK Royalty', null, 'Fixed: Cost / Pax / Day')}
                            {renderInputGroup('accommodation', 'Accommodation', null, 'Fixed: Cost / Day')}
                            {renderInputGroup('perDiem', 'Per Diem', null, 'Fixed: Cost / Day')}
                            {renderInputGroup('venue', 'Venue Cost', [{ value: 'costPerDay', label: 'Cost / Day' }, { value: 'totalCost', label: 'Total Cost' }])}
                            {renderInputGroup('travel', 'Travel Cost', [{ value: 'costPerDay', label: 'Cost / Day' }, { value: 'totalCost', label: 'Total Cost' }])}
                        </div>
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mt-4">
                            {['vouchersCost', 'localConveyance'].map(key => renderOtherExpense(key))}
                        </div>
                    </>
                )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                <span className="text-sm font-bold text-gray-700">Total Expenses</span>
                <span className="text-xl font-bold text-primary-blue">
                    {CURRENCY_SYMBOL} {((Object.keys(activeData.expenses || {}).reduce((sum, key) => {
                        if (key === 'breakdown' || key === 'marketingPercent' || key === 'contingencyPercent' || key === 'targetGpPercent' || key === 'marketing' || key === 'contingency') return sum;
                        return sum + (parseFloat(activeData.expenses[key]) || 0);
                    }, 0)) / CONVERSION_RATE).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
            </div>
        </Card>
    );
};

const Input = ({ label, value, onChange }) => {
    const { currency } = useCurrency();
    const CURRENCY_SYMBOL = currency === 'USD' ? '$' : '₹';
    const isNonCurrencyField = (label.toLowerCase() === 'pax' || label.toLowerCase() === 'hours' || label.toLowerCase() === 'hours/day');

    return (
        <div>
            {label && <label className="block text-[10px] uppercase font-bold text-gray-500 mb-0.5">{label}</label>}
            <div className="relative">
                {!isNonCurrencyField && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs font-semibold">{CURRENCY_SYMBOL}</span>}
                <input
                    type="number"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    onWheel={(e) => e.target.blur()}
                    className={`w-full text-right ${!isNonCurrencyField ? 'pl-6' : 'pl-2'} pr-2 py-1.5 bg-white border-2 border-blue-300 rounded text-sm font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                    placeholder="0"
                />
            </div>
        </div>
    );
};

export default OperationalExpensesBreakdown;
