import React, { useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { CheckCircle, AlertTriangle, Paperclip } from 'lucide-react';
import Card from '../../ui/Card';
import FinancialSummary from '../FinancialSummary';
import { useToast } from '../../../context/ToastContext';

const FinanceTab = ({ opportunity, editMode, canEditField, handleUpdate, user }) => {
    const { addToast } = useToast();
    const isSales = user?.role === 'Sales Executive' || user?.role === 'Sales Manager';
    const isSalesManager = user?.role === 'Sales Manager';
    const isDelivery = user?.role === 'Delivery Team';
    const [loading, setLoading] = useState(false);
    const [dateErrors, setDateErrors] = useState({ poDate: '', invoiceDate: '' });

    // Validation: PO Date < Start Date
    const validatePODate = (poDate) => {
        const startDate = opportunity.commonDetails?.startDate;
        if (poDate && startDate) {
            const po = new Date(poDate);
            const start = new Date(startDate);
            if (po >= start) {
                setDateErrors(prev => ({ ...prev, poDate: 'PO Date must be before Start Date' }));
                addToast('PO Date must be before Start Date', 'error');
                return false;
            }
        }
        setDateErrors(prev => ({ ...prev, poDate: '' }));
        return true;
    };

    // Validation: Invoice Date ≥ End Date
    const validateInvoiceDate = (invoiceDate) => {
        const endDate = opportunity.commonDetails?.endDate;
        if (invoiceDate && endDate) {
            const invoice = new Date(invoiceDate);
            const end = new Date(endDate);
            if (invoice < end) {
                setDateErrors(prev => ({ ...prev, invoiceDate: 'Invoice Date must be on or after End Date' }));
                addToast('Invoice Date must be on or after End Date', 'error');
                return false;
            }
        }
        setDateErrors(prev => ({ ...prev, invoiceDate: '' }));
        return true;
    };

    // Removed PO verification function - no longer needed

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Column: Finance Details (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
                {/* Billing Details */}
                <Card>
                    <h3 className="text-lg font-bold text-primary-blue mb-4">Billing Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Billing Client</label>
                            {canEditField('sales') && editMode ? (
                                <input
                                    type="text"
                                    value={opportunity.commonDetails?.billingClientName || ''}
                                    onChange={(e) => handleUpdate('commonDetails', 'billingClientName', e.target.value)}
                                    className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                                />
                            ) : (
                                <p className="text-text-primary">{opportunity.commonDetails?.billingClientName || 'N/A'}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">End Client</label>
                            {canEditField('sales') && editMode ? (
                                <input
                                    type="text"
                                    value={opportunity.commonDetails?.endClientName || ''}
                                    onChange={(e) => handleUpdate('commonDetails', 'endClientName', e.target.value)}
                                    className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                                />
                            ) : (
                                <p className="text-text-primary">{opportunity.commonDetails?.endClientName || 'N/A'}</p>
                            )}
                        </div>
                    </div>
                </Card>

                {/* PO & Invoice Details */}
                <Card>
                    <h3 className="text-lg font-bold text-primary-blue mb-4">PO & Invoice Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">PO Number</label>
                            {canEditField('sales') && editMode ? (
                                <input
                                    type="text"
                                    value={opportunity.commonDetails?.clientPONumber || ''}
                                    onChange={(e) => handleUpdate('commonDetails', 'clientPONumber', e.target.value)}
                                    className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                                />
                            ) : (
                                <p className="text-text-primary">{opportunity.commonDetails?.clientPONumber || 'N/A'}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">PO Date</label>
                            {canEditField('sales') && editMode ? (
                                <div>
                                    <input
                                        type="date"
                                        value={opportunity.commonDetails?.clientPODate ? opportunity.commonDetails.clientPODate.split('T')[0] : ''}
                                        onChange={(e) => {
                                            const isValid = validatePODate(e.target.value);
                                            if (isValid) {
                                                handleUpdate('commonDetails', 'clientPODate', e.target.value);
                                            }
                                        }}
                                        className={`w-full border p-2 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent ${dateErrors.poDate ? 'border-red-500' : 'border-gray-300'}`}
                                    />
                                    {dateErrors.poDate && (
                                        <p className="text-red-500 text-xs mt-1">{dateErrors.poDate}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-text-primary">
                                    {opportunity.commonDetails?.clientPODate ? new Date(opportunity.commonDetails.clientPODate).toLocaleDateString() : 'N/A'}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Invoice Number</label>
                            {canEditField('delivery') && editMode ? (
                                <input
                                    type="text"
                                    value={opportunity.commonDetails?.clientInvoiceNumber || ''}
                                    onChange={(e) => handleUpdate('commonDetails', 'clientInvoiceNumber', e.target.value)}
                                    className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                                />
                            ) : (
                                <p className="text-text-primary">{opportunity.commonDetails?.clientInvoiceNumber || 'N/A'}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Invoice Date</label>
                            {canEditField('delivery') && editMode ? (
                                <div>
                                    <input
                                        type="date"
                                        value={opportunity.commonDetails?.clientInvoiceDate ? opportunity.commonDetails.clientInvoiceDate.split('T')[0] : ''}
                                        onChange={(e) => {
                                            const isValid = validateInvoiceDate(e.target.value);
                                            if (isValid) {
                                                handleUpdate('commonDetails', 'clientInvoiceDate', e.target.value);
                                            }
                                        }}
                                        className={`w-full border p-2 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent ${dateErrors.invoiceDate ? 'border-red-500' : 'border-gray-300'}`}
                                    />
                                    {dateErrors.invoiceDate && (
                                        <p className="text-red-500 text-xs mt-1">{dateErrors.invoiceDate}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-text-primary">
                                    {opportunity.commonDetails?.clientInvoiceDate ? new Date(opportunity.commonDetails.clientInvoiceDate).toLocaleDateString() : 'N/A'}
                                </p>
                            )}
                        </div>

                        <div className="md:col-span-2 space-y-3">
                            <label className="block text-sm font-medium text-text-secondary">TOV Calculation</label>

                            {canEditField('sales') && editMode ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Rate</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2 text-text-secondary font-bold">₹</span>
                                            <input
                                                type="number"
                                                value={opportunity.commonDetails?.tovRate || ''}
                                                onChange={(e) => {
                                                    const rate = parseFloat(e.target.value) || 0;
                                                    const unit = opportunity.commonDetails?.tovUnit || 'Fixed';
                                                    let calculatedTov = rate;

                                                    if (unit === 'Per Day') calculatedTov = rate * (opportunity.days || 1);
                                                    else if (unit === 'Per Participant') calculatedTov = rate * (opportunity.participants || 1);

                                                    handleUpdate('commonDetails', 'tovRate', rate);
                                                    handleUpdate('commonDetails', 'tov', calculatedTov);
                                                }}
                                                className="w-full border border-gray-300 p-2 pl-6 rounded focus:ring-2 focus:ring-primary-blue"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Unit</label>
                                        <select
                                            value={opportunity.commonDetails?.tovUnit || 'Fixed'}
                                            onChange={(e) => {
                                                const unit = e.target.value;
                                                const rate = opportunity.commonDetails?.tovRate || 0;
                                                let calculatedTov = rate;

                                                if (unit === 'Per Day') calculatedTov = rate * (opportunity.days || 1);
                                                else if (unit === 'Per Participant') calculatedTov = rate * (opportunity.participants || 1);

                                                handleUpdate('commonDetails', 'tovUnit', unit);
                                                handleUpdate('commonDetails', 'tov', calculatedTov);
                                            }}
                                            className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-primary-blue"
                                        >
                                            <option value="Fixed">Fixed Amount</option>
                                            <option value="Per Day">Per Day</option>
                                            <option value="Per Participant">Per Participant</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Total TOV (Auto)</label>
                                        <div className="w-full border border-gray-200 p-2 rounded bg-white text-gray-700 font-bold">
                                            ₹ {opportunity.commonDetails?.tov?.toLocaleString() || '0'}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full border border-gray-300 p-2 rounded-lg bg-gray-100 text-gray-800 font-bold text-lg">
                                    ₹ {opportunity.commonDetails?.tov?.toLocaleString() || '0'}
                                    <span className="text-sm font-normal text-gray-600 ml-2">
                                        ({opportunity.commonDetails?.tovUnit === 'Fixed' ? 'Fixed' :
                                            `@ ₹${opportunity.commonDetails?.tovRate} ${opportunity.commonDetails?.tovUnit}`})
                                    </span>
                                </div>
                            )}

                            {/* Approval Push Button */}
                            {opportunity.financials?.grossProfitPercent >= 10 &&
                                opportunity.financials?.grossProfitPercent < 15 &&
                                !editMode && // Show only in view mode to trigger action? Or edit mode? view mode is safer.
                                isSales && (
                                    <div className="mt-4 bg-orange-50 p-4 rounded-lg border border-orange-200 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-orange-800">Approval Required</p>
                                            <p className="text-xs text-orange-700">GP is between 10-15%. Manager approval needed.</p>
                                        </div>
                                        <button
                                            className="bg-orange-600 text-white px-4 py-2 rounded shadow hover:bg-orange-700 text-sm font-medium"
                                            onClick={() => {
                                                alert("Approval workflow triggered! (Mock functionality)");
                                                // In real app: call API to set status 'Pending Manager' and notify.
                                            }}
                                        >
                                            Push to Manager
                                        </button>
                                    </div>
                                )}
                        </div>
                        <div className="md:col-span-2 mt-4 border-t pt-4">
                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                                <span className="text-sm text-gray-600 mr-2">Total Expenses:</span>
                                <span className="text-lg font-bold text-gray-800">
                                    ₹ {opportunity.financials?.totalExpense?.toLocaleString() || '0'}
                                </span>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* NEW: Proposal Financial Block */}
                <Card>
                    <h3 className="text-lg font-bold text-primary-blue mb-4">Financial Summary (Proposal)</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO Amount</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Expense</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marketing</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GK Revenue (Profit)</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Markup %</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                <tr>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-gray-900">
                                        ₹{(opportunity.poValue || 0).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                        {/* Total Expense derived from PO and Profit logic for display consistency if needed, or raw sum */}
                                        ₹{((opportunity.financeDetails?.vendorPayables?.total || 0) + (opportunity.financeDetails?.vendorPayables?.detailed?.marketing?.invoiceValue || 0)).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                        ₹{(opportunity.expenses?.marketing || 0).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-green-600">
                                        {/* Profit = PO - Total Expense */}
                                        ₹{((opportunity.poValue || 0) - ((opportunity.financeDetails?.vendorPayables?.total || 0) + (opportunity.financeDetails?.vendorPayables?.detailed?.marketing?.invoiceValue || 0))).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-blue-600">
                                        {/* Markup % = Profit / Total Expense */}
                                        {(() => {
                                            const totalExp = (opportunity.financeDetails?.vendorPayables?.total || 0) + (opportunity.financeDetails?.vendorPayables?.detailed?.marketing?.invoiceValue || 0);
                                            const profit = (opportunity.poValue || 0) - totalExp;
                                            return totalExp > 0 ? ((profit / totalExp) * 100).toFixed(2) : '0';
                                        })()}%
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                    </div>
                </Card>

                {/* Expense Breakdown */}
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-primary-blue">Expense Breakdown</h3>
                        <div className="bg-gray-100 px-3 py-1 rounded-lg">
                            <span className="text-sm text-gray-600 mr-2">Total Expenses:</span>
                            <span className="text-lg font-bold text-gray-800">
                                ₹ {(() => {
                                    const fields = [
                                        'trainerCost', 'gkRoyalty', 'material', 'labs',
                                        'venue', 'travel', 'accommodation', 'perDiem',
                                        'localConveyance'
                                    ];
                                    return fields.reduce((sum, key) => {
                                        const val = opportunity.expenses?.[key];
                                        return sum + (Number(val) || 0);
                                    }, 0).toLocaleString();
                                })()}
                            </span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries({
                            trainerCost: 'Trainer Cost',
                            gkRoyalty: 'GK Royalty',
                            material: 'Material',
                            labs: 'Labs',
                            venue: 'Venue',
                            travel: 'Travel',
                            accommodation: 'Accommodation',
                            perDiem: 'Per Diem',
                            localConveyance: 'Local Conveyance',
                            marketingPercent: 'Marketing (%)',
                            contingencyPercent: 'Contingency (%)'
                        }).map(([key, label]) => {
                            const isStrategicExpense = key === 'marketingPercent' || key === 'contingencyPercent';

                            // Delivery cannot edit strategic expenses
                            // Sales can edit strategic expenses
                            // Sales can also edit base expenses (unless we strictly block it, but usually sales has override)
                            // The user said "expenses will be filled by delivery team except marketing and contingency".
                            // Implicitly, Delivery edits base, Sales edits strategic.

                            let canEditThisExpense = false;

                            if (editMode) {
                                if (isDelivery) {
                                    // Delivery can edit everything EXCEPT strategic
                                    canEditThisExpense = !isStrategicExpense && canEditField('delivery');
                                } else if (isSales) {
                                    // Sales can edit strategic
                                    // Usually sales can also edit base if needed, but per request, they focus on TOV/Margins
                                    // We will allow Sales to edit everything for now to avoid locking them out, or restrict if strictly requested.
                                    // "Sales team will enter TOV, marketing percentage and contingency amount"
                                    // I'll leave base expenses editable by Sales too as a fallback, unless specifically requested otherwise.
                                    // Actually, if I strictly follow "expenses filled by delivery", maybe I should block base for sales?
                                    // Let's keep it open for Sales for flexibility unless told otherwise.
                                    canEditThisExpense = canEditField('sales'); // Sales can edit everything in finance tab basically
                                }
                            }

                            let inputControl;

                            if (key === 'marketingPercent') {
                                inputControl = (
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="range"
                                            min="0"
                                            max="15"
                                            step="1"
                                            value={opportunity.expenses?.[key] || 0}
                                            onChange={(e) => handleUpdate('expenses', key, Number(e.target.value))}
                                            disabled={!canEditThisExpense}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-blue"
                                        />
                                        <span className="text-sm font-bold w-12 text-right">{opportunity.expenses?.[key] || 0}%</span>
                                    </div>
                                );
                            } else if (key === 'contingencyPercent') {
                                inputControl = (
                                    <select
                                        value={opportunity.expenses?.[key] || 15}
                                        onChange={(e) => handleUpdate('expenses', key, Number(e.target.value))}
                                        disabled={!canEditThisExpense}
                                        className={`w-full border p-2 rounded-lg ${!canEditThisExpense
                                            ? 'bg-gray-100 text-text-secondary cursor-not-allowed border-gray-300'
                                            : 'border-primary-blue bg-accent-yellow-light/20 focus:ring-2 focus:ring-primary-blue'
                                            }`}
                                    >
                                        {[10, 11, 12, 13, 14, 15].map(val => (
                                            <option key={val} value={val}>{val}%</option>
                                        ))}
                                    </select>
                                );
                            } else {
                                inputControl = (
                                    <input
                                        type="number"
                                        value={opportunity.expenses?.[key] || 0}
                                        onChange={(e) => handleUpdate('expenses', key, Number(e.target.value))}
                                        readOnly={!canEditThisExpense}
                                        disabled={!canEditThisExpense}
                                        className={`w-full border p-2 rounded-lg ${!canEditThisExpense
                                            ? 'bg-gray-100 text-text-secondary cursor-not-allowed border-gray-300'
                                            : 'border-gray-300 bg-white focus:ring-2 focus:ring-primary-blue'
                                            }`}
                                        step="1"
                                    />
                                );
                            }

                            // Document Upload Handler (Mock)
                            const handleFileUpload = (key) => {
                                // In a real app, this would open a file picker, upload to S3/Server, 
                                // and then update the opportunity.expenseDocuments[key] array.
                                const mockUrl = `https://example.com/doc_${key}_${Date.now()}.pdf`;
                                const currentDocs = opportunity.expenseDocuments?.[key] || [];
                                const newDocs = [...currentDocs, mockUrl];

                                // We need to update the top-level 'expenseDocuments' map
                                // Assuming handleUpdate supports 'expenseDocuments' top level or we use a specialized updater
                                // Since handleUpdate implementation in parent handles sections:
                                // if (section) ... [section]: { ...prev[section], [field]: value }
                                // So we can pass 'expenseDocuments' as section, key as field, and newDocs as value?
                                // Wait, handleUpdate implementation for 'expenseDocuments' needs to return a NEW map/object.
                                // Let's check handleUpdate in OpportunityDetailPage. 
                                // It handles sections properly.
                                // But expenseDocuments is a Map in Mongoose, but likely an Object in JSON JSON response.
                                // So passing section='expenseDocuments', field=key, value=newDocs should work.
                                handleUpdate('expenseDocuments', key, newDocs);
                                addToast('Document uploaded successfully (Mock)', 'success');
                            };

                            const docs = opportunity.expenseDocuments?.[key] || [];

                            return (
                                <div key={key} className="mb-2">
                                    <label className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
                                    <div className="flex items-center space-x-2">
                                        <div className="flex-1">
                                            {inputControl}
                                        </div>
                                        {/* Upload Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleFileUpload(key)}
                                            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-600"
                                            title="Upload Supporting Document"
                                            disabled={!canEditThisExpense}
                                        >
                                            <Paperclip size={20} />
                                        </button>
                                    </div>
                                    {/* Uploaded Files List */}
                                    {docs.length > 0 && (
                                        <div className="mt-1 space-y-1">
                                            {docs.map((doc, idx) => (
                                                <div key={idx} className="flex items-center space-x-2 text-xs text-blue-600">
                                                    <a href={doc} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[200px]">
                                                        Document {idx + 1}
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>

            {/* Right Column: Financial Summary (1/3 width) */}
            <div className="lg:col-span-1">
                <FinancialSummary opportunity={opportunity} />
            </div>
        </div>
    );
};

FinanceTab.propTypes = {
    opportunity: PropTypes.object.isRequired,
    editMode: PropTypes.bool.isRequired,
    canEditField: PropTypes.func.isRequired,
    handleUpdate: PropTypes.func.isRequired,
    user: PropTypes.object
};

export default FinanceTab;
