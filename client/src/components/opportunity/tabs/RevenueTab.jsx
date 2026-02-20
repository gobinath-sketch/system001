import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle } from 'lucide-react';
import Card from '../../ui/Card';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useCurrency } from '../../../context/CurrencyContext';
import UploadButton from '../../ui/UploadButton';
import FinancialSummary from '../sections/FinancialSummary';
import { API_BASE } from '../../../config/api';
const RevenueTab = forwardRef(({
    opportunity,
    canEdit,
    refreshData,
    isEditing
}, ref) => {
    const {
        addToast
    } = useToast();
    const {
        user
    } = useAuth();
    const {
        currency
    } = useCurrency();
    const [uploading, setUploading] = useState(false);
    const [pendingUploads, setPendingUploads] = useState({
        po: null,
        invoice: null,
        proposal: null
    });

    // Check if user is Sales (Invoice fields should be read-only for Sales)
    const isSales = user?.role === 'Sales Executive' || user?.role === 'Sales Manager' || user?.role === 'Business Head';

    // Editable State
    const [formData, setFormData] = useState({
        poValue: 0,
        invoiceValue: 0,
        poNumber: '',
        poDate: ''
    });
    const normalizeDate = value => {
        if (!value) return null;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        d.setHours(0, 0, 0, 0);
        return d;
    };
    const startDate = normalizeDate(opportunity?.commonDetails?.startDate);
    const endDate = normalizeDate(opportunity?.commonDetails?.endDate);

    // Helper to recalculate derived TOV from expense model.
    const recalculateTotals = data => {
        const exp = { ...(data.expenses || {}) };
        const common = { ...(data.commonDetails || {}) };

        const parseCurrency = val => {
            if (val === null || val === undefined || val === '') return 0;
            const cleaned = String(val).replace(/,/g, '');
            return parseFloat(cleaned) || 0;
        };

        const expenseTypesList = ['trainerCost', 'vouchersCost', 'gkRoyalty', 'material', 'labs', 'venue', 'travel', 'accommodation', 'perDiem', 'localConveyance'];
        const opEx = expenseTypesList.reduce((sum, key) => sum + parseCurrency(exp[key]), 0);
        const contingencyPercent = exp.contingencyPercent ?? 15;
        const contingencyAmount = opEx * contingencyPercent / 100;
        const marketingPercent = exp.marketingPercent ?? 0;
        const marketingAmount = opEx * marketingPercent / 100;
        const totalExpenses = opEx + contingencyAmount + marketingAmount;
        const profitPercent = exp.targetGpPercent ?? 30;
        const profitAmount = totalExpenses * profitPercent / 100;
        const finalTov = totalExpenses + profitAmount;

        common.tov = Math.round(finalTov);
        return { ...data, commonDetails: common };
    };
    useEffect(() => {
        if (opportunity) {
            // Apply recalculation to ensure TOV is consistent with expenses
            // even if DB has stale 'tov' value.
            const calculatedOpp = recalculateTotals(opportunity);
            setFormData({
                // Store the calculated TOV in commonDetails within formData if needed, 
                // but we primarily use it for creating the 'activeData' passed to FinancialSummary
                ...calculatedOpp,
                poValue: opportunity.poValue || 0,
                invoiceValue: opportunity.invoiceValue || 0,
                poNumber: opportunity.commonDetails?.clientPONumber || '',
                poDate: opportunity.commonDetails?.clientPODate ? new Date(opportunity.commonDetails.clientPODate).toISOString().split('T')[0] : ''
            });
        }
    }, [opportunity]);
    const USD_TO_INR = 83; // Conversion rate

    const uploadFileByType = async (file, type, token) => {
        let endpoint = '';
        const specificTypFormData = new FormData();
        if (type === 'po') {
            endpoint = `${API_BASE}/api/opportunities/${opportunity._id}/upload-po`;
            specificTypFormData.append('po', file);
            const poVal = formData.poValue !== undefined && formData.poValue !== '' ? formData.poValue : opportunity.poValue || 0;
            const poDt = formData.poDate || opportunity.poDate || opportunity.commonDetails?.clientPODate || '';
            specificTypFormData.append('poValue', poVal);
            specificTypFormData.append('poDate', poDt);
        } else if (type === 'proposal') {
            endpoint = `${API_BASE}/api/opportunities/${opportunity._id}/upload-proposal`;
            specificTypFormData.append('proposal', file);
        } else {
            endpoint = `${API_BASE}/api/opportunities/${opportunity._id}/upload-invoice`;
            specificTypFormData.append('invoice', file);
        }
        await axios.post(endpoint, specificTypFormData, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        });
    };

    // Expose handleSave to parent
    useImperativeHandle(ref, () => ({
        handleSave: async () => {
            try {
                const token = localStorage.getItem('token');
                const poDateToCheck = normalizeDate(formData.poDate);
                const invoiceDateToCheck = normalizeDate(opportunity?.commonDetails?.clientInvoiceDate);

                if ((poDateToCheck || invoiceDateToCheck) && (!startDate || !endDate)) {
                    addToast('Please fill Start Date and End Date first.', 'warning');
                    return false;
                }
                if (poDateToCheck && startDate && poDateToCheck >= startDate) {
                    addToast('PO Date must be less than Start Date.', 'warning');
                    return false;
                }
                if (invoiceDateToCheck && endDate && invoiceDateToCheck <= endDate) {
                    addToast('Invoice Date must be greater than End Date.', 'warning');
                    return false;
                }

                // 1. Update Opportunity Core Fields (poValue, invoiceValue)
                await axios.put(`${API_BASE}/api/opportunities/${opportunity._id}`, {
                    poValue: parseFloat(formData.poValue) || 0,
                    invoiceValue: parseFloat(formData.invoiceValue) || 0,
                    // Also update financial details to ensure sync
                    'financeDetails.clientReceivables.invoiceAmount': parseFloat(formData.invoiceValue) || 0,
                    // Update PO Details (Sales can edit)
                    'commonDetails.clientPONumber': formData.poNumber,
                    'commonDetails.clientPODate': formData.poDate
                }, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                const uploadEntries = Object.entries(pendingUploads).filter(([, file]) => !!file);
                if (uploadEntries.length > 0) {
                    setUploading(true);
                    for (const [type, file] of uploadEntries) {
                        await uploadFileByType(file, type, token);
                    }
                    setPendingUploads({
                        po: null,
                        invoice: null,
                        proposal: null
                    });
                }
                addToast('Changes saved successfully', 'success');
                refreshData();
                return true;
            } catch (error) {
                console.error('Error saving revenue details:', error);
                addToast(`Failed to save details: ${error.response?.data?.message || error.message}`, 'error');
                return false;
            } finally {
                setUploading(false);
            }
        },
        handleCancel: () => {
            setFormData({
                poValue: opportunity.poValue || 0,
                invoiceValue: opportunity.invoiceValue || 0
            });
            setPendingUploads({
                po: null,
                invoice: null,
                proposal: null
            });
        }
    }));
    const handleChange = e => {
        if (e.target.name === 'poDate') {
            if (!startDate || !endDate) {
                addToast('Please fill Start Date and End Date first.', 'warning');
                return;
            }
            const poDate = normalizeDate(e.target.value);
            if (poDate && poDate >= startDate) {
                addToast('PO Date must be less than Start Date.', 'warning');
                return;
            }
        }
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };
    const handleFileUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;
        if (isEditing) {
            setPendingUploads(prev => ({
                ...prev,
                [type]: file
            }));
            return;
        }
        setUploading(true);
        try {
            const token = localStorage.getItem('token');
            await uploadFileByType(file, type, token);
            addToast(`${type.toUpperCase()} uploaded successfully`, 'success');
            refreshData();
        } catch (error) {
            console.error('Upload failed', error);
            addToast(`Failed to upload ${type}`, 'error');
        } finally {
            setUploading(false);
        }
    };

    // GP Calculation Logic (same as Finance GP Analysis)
    const financeDetails = opportunity.financeDetails || {};
    const clientReceivables = financeDetails.clientReceivables || {};
    const vendorPayables = financeDetails.vendorPayables || {};

    // TOV: Client Invoice Amount (Synced with invoiceValue)
    const tov = formData.invoiceValue || clientReceivables.invoiceAmount || 0;

    // Total Expenses: Sum of Detailed Categories (Invoice Value Excl Tax) + Per Diem + Other
    let totalExpenses = 0;

    // Sum Detailed
    if (vendorPayables.detailed) {
        Object.values(vendorPayables.detailed).forEach(cat => {
            totalExpenses += parseFloat(cat.invoiceValue) || 0;
        });
    }

    // Sum Simple
    totalExpenses += parseFloat(vendorPayables.perDiem?.amount) || 0;
    totalExpenses += parseFloat(vendorPayables.other?.amount) || 0;
    const gktProfit = tov - totalExpenses;
    const gpPercent = tov > 0 ? gktProfit / tov * 100 : 0;

    // Currency formatting helper
    const formatCurrency = value => {
        const displayValue = currency === 'USD' ? value / USD_TO_INR : value;
        const symbol = currency === 'USD' ? '$' : '₹';
        return `${symbol} ${displayValue.toLocaleString(undefined, {
            minimumFractionDigits: currency === 'USD' ? 0 : 0,
            maximumFractionDigits: currency === 'USD' ? 0 : 0
        })}`;
    };

    // Styles
    const cardClass = "bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center h-full";
    const labelClass = "text-sm text-gray-500 font-medium uppercase tracking-wider mb-2";
    const valueClass = "text-2xl font-bold text-gray-800";
    const inputClass = "w-full border p-2 rounded-lg text-base bg-gray-50 border-gray-500 focus:ring-2 focus:ring-primary-blue";
    return <div className="space-y-8 animate-fadeIn">


        {/* PO and Invoice Details Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PO Details */}
            <Card className="!bg-white">
                <h3 className="text-base font-bold text-gray-900 mb-3 border-b border-gray-500 pb-2">PO Details</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-base font-semibold text-gray-800 mb-1">PO Number</label>
                            {isEditing ? <input type="text" name="poNumber" value={formData.poNumber} onChange={handleChange} className="w-full border p-2 rounded-lg text-base bg-gray-50 border-gray-500 focus:ring-2 focus:ring-primary-blue" placeholder="Enter PO Number" /> : <div className="text-base font-medium text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-500 min-h-[42px] flex items-center">
                                {opportunity.commonDetails?.clientPONumber || 'N/A'}
                            </div>}
                        </div>
                        <div>
                            <label className="block text-base font-semibold text-gray-800 mb-1">PO Date</label>
                            {isEditing ? <input type="date" name="poDate" value={formData.poDate} onChange={handleChange} className="w-full border p-2 rounded-lg text-base bg-gray-50 border-gray-500 focus:ring-2 focus:ring-primary-blue" /> : <div className="text-base font-medium text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-500 min-h-[42px] flex items-center">
                                {opportunity.commonDetails?.clientPODate ? new Date(opportunity.commonDetails.clientPODate).toLocaleDateString() : 'N/A'}
                            </div>}
                        </div>
                    </div>
                    {/* Row 2: PO Amount and Document */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-base font-semibold text-gray-800 mb-1">PO Amount</label>
                            {isEditing ? <input type="number" name="poValue" value={formData.poValue === 0 ? '' : formData.poValue} onChange={handleChange} onWheel={e => e.target.blur()} className={`${inputClass} no-arrows`} placeholder="Enter Amount" /> : <div className="text-base font-medium text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-500 min-h-[42px] flex items-center">
                                {formatCurrency(formData.poValue)}
                            </div>}
                        </div>

                        <div>
                            <label className="block text-base font-semibold text-gray-800 mb-1">PO Document</label>
                            <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-500 min-h-[42px]">
                                {opportunity.poDocument ? <a href={`${API_BASE}/${opportunity.poDocument.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex items-center font-medium truncate max-w-[120px]" title="View Document">
                                    <CheckCircle size={14} className="mr-1 flex-shrink-0" /> View
                                </a> : <span className="text-xs text-gray-400 italic">No Doc</span>}

                                {canEdit && isEditing && <div>
                                    <input type="file" id="po-upload" className="hidden" onChange={e => handleFileUpload(e, 'po')} accept=".pdf,.doc,.docx,.jpg,.png" disabled={uploading} />
                                    <UploadButton onClick={() => document.getElementById('po-upload').click()} disabled={uploading}>
                                        {opportunity.poDocument ? 'Replace' : 'Upload'}
                                    </UploadButton>
                                </div>}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Invoice Details */}
            <Card className="!bg-white">
                <h3 className="text-base font-bold text-gray-900 mb-3 border-b border-gray-500 pb-2">Invoice Details</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-base font-semibold text-gray-800 mb-1">Invoice Number</label>
                            <div className="text-base font-medium text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-500 min-h-[42px] flex items-center">
                                {opportunity.commonDetails?.clientInvoiceNumber || 'Pending'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-base font-semibold text-gray-800 mb-1">Invoice Date</label>
                            <div className="text-base font-medium text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-500 min-h-[42px] flex items-center">
                                {opportunity.commonDetails?.clientInvoiceDate ? new Date(opportunity.commonDetails.clientInvoiceDate).toLocaleDateString() : 'N/A'}
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Invoice Amount and Document */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-base font-semibold text-gray-800 mb-1">Invoice Amount</label>
                            {isEditing && !isSales ? <input type="number" name="invoiceValue" value={formData.invoiceValue} onChange={handleChange} className={inputClass} placeholder="Enter Amount" /> : <div className={`text-base font-medium p-2 rounded-lg border border-gray-500 min-h-[42px] flex items-center ${isSales ? 'bg-gray-200 text-gray-600 cursor-not-allowed' : 'bg-gray-50 text-gray-800'}`}>
                                {formatCurrency(formData.invoiceValue)}
                            </div>}
                        </div>

                        <div>
                            <label className="block text-base font-semibold text-gray-800 mb-1">Invoice Doc</label>
                            <div className="bg-gray-50 p-2 rounded-lg border border-gray-500 flex items-center justify-between min-h-[42px]">
                                {opportunity.invoiceDocument ? <a href={`${API_BASE}/${opportunity.invoiceDocument.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex items-center font-bold truncate max-w-[120px]" title="View Document">
                                    <CheckCircle size={14} className="mr-1 flex-shrink-0" /> View
                                </a> : <span className="text-xs text-gray-400 italic">No Doc</span>}

                                {canEdit && isEditing && !isSales && <div>
                                    <input type="file" id="invoice-upload" className="hidden" onChange={e => handleFileUpload(e, 'invoice')} accept=".pdf,.doc,.docx,.jpg,.png" disabled={uploading} />
                                    <UploadButton onClick={() => document.getElementById('invoice-upload').click()} disabled={uploading}>
                                        {opportunity.invoiceDocument ? 'Replace' : 'Upload'}
                                    </UploadButton>
                                </div>}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>

        {isSales && <div className="max-w-5xl mx-auto">
            <Card className="!bg-white">
                {/* Use calculated data (activeData) to ensure TOV is dynamic even if DB is stale */}
                <FinancialSummary opportunity={{
                    ...opportunity,
                    ...formData,
                    // Includes recalculated commonDetails.tov
                    expenses: {
                        ...opportunity.expenses,
                        ...formData.expenses
                    },
                    // Ensure expenses are merged if present
                    commonDetails: {
                        ...opportunity.commonDetails,
                        ...formData.commonDetails
                    },
                    // Ensure TOV override
                    poValue: parseFloat(formData.poValue) || 0
                }} poValue={parseFloat(formData.poValue) || 0} />
            </Card>
        </div>}

        {!isSales && <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">Gross Profit (GP) Analysis</h2>
                {/* Currency Toggle moved to global header */}
            </div>

            {/* Info Header */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8 grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                    <span className="block text-xs text-gray-500 uppercase font-semibold">Adhoc ID</span>
                    <span className="block text-lg font-bold text-gray-900">{opportunity.opportunityNumber}</span>
                </div>
                <div>
                    <span className="block text-xs text-gray-500 uppercase font-semibold">Client Name</span>
                    <span className="block text-lg font-bold text-gray-900">{opportunity.client?.companyName || 'N/A'}</span>
                </div>
                <div>
                    <span className="block text-xs text-gray-500 uppercase font-semibold">Sales Name</span>
                    <span className="block text-lg font-bold text-gray-900">{opportunity.commonDetails?.sales?.name || 'N/A'}</span>
                </div>
                <div>
                    <span className="block text-xs text-gray-500 uppercase font-semibold">Month and Year</span>
                    <span className="block text-lg font-bold text-gray-900">
                        {opportunity.commonDetails?.monthOfTraining || '-'} {opportunity.commonDetails?.year || ''}
                    </span>
                </div>
            </div>

            {/* Financials Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* TOV */}
                <div className={cardClass}>
                    <span className={labelClass}>Total Order Value (TOV)</span>
                    <span className={`${valueClass} text-blue-600`}>{formatCurrency(tov)}</span>
                </div>

                {/* Total Expenses */}
                <div className={cardClass}>
                    <span className={labelClass}>Total Expenses</span>
                    <span className={`${valueClass} text-red-500`}>{formatCurrency(totalExpenses)}</span>
                </div>

                {/* GKT Profit */}
                <div className={cardClass}>
                    <span className={labelClass}>GKT Profit</span>
                    <span className={`${valueClass} ${gktProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(gktProfit)}
                    </span>
                </div>

                {/* GP % */}
                <div className={`${cardClass} ${gpPercent < 15 ? 'border-yellow-200 bg-yellow-50' : 'border-green-100 bg-green-50'}`}>
                    <span className={labelClass}>GP Margin (%)</span>
                    <span className={`text-3xl font-extrabold ${gpPercent < 15 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {gpPercent.toFixed(2)}%
                    </span>
                </div>
            </div>
        </div>}
    </div>;
});
export default RevenueTab;
