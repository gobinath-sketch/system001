import React from 'react';
import { CheckCircle } from 'lucide-react';
import Card from '../../ui/Card';

const BillingDetails = ({ opportunity, formData, handleChange, isEditing, inputClass }) => {
    // Default input class if not provided
    const defaultInputClass = `w-full border p-2 rounded-lg ${!isEditing ? 'bg-gray-100 text-gray-700 cursor-not-allowed text-sm' : 'bg-gray-50 border-gray-200 focus:ring-2 focus:ring-primary-blue text-sm'}`;
    const safeInputClass = inputClass || defaultInputClass;

    return (
        <Card className="!bg-white">
            <h3 className="text-lg font-bold text-primary-blue mb-4">Billing Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* 1. PO Details */}
                <div>
                    <label className="block text-sm font-bold text-gray-900 mb-3 border-b pb-1">PO Details</label>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">PO Number</label>
                            <input
                                type="text"
                                value={opportunity.commonDetails?.clientPONumber || 'N/A'}
                                disabled
                                className="w-full border p-2 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">PO Date</label>
                            <input
                                type="text"
                                value={opportunity.commonDetails?.clientPODate ? new Date(opportunity.commonDetails.clientPODate).toLocaleDateString() : 'N/A'}
                                disabled
                                className="w-full border p-2 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">PO Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-gray-500 text-sm">₹</span>
                                <input
                                    type="text"
                                    value={opportunity.poValue ? opportunity.poValue.toLocaleString() : '0'}
                                    disabled
                                    className="w-full border p-2 pl-6 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">PO Document</label>
                            <div className="flex items-center p-2 border border-gray-100 rounded-lg bg-gray-50 h-[38px]">
                                {opportunity.poDocument ? (
                                    <a
                                        href={`http://localhost:5000/${opportunity.poDocument.replace(/\\/g, '/')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline flex items-center text-sm font-medium"
                                    >
                                        <CheckCircle size={14} className="mr-1" /> View PO
                                    </a>
                                ) : (
                                    <span className="text-gray-400 text-sm italic">Not Uploaded</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Invoice Details */}
                <div>
                    <label className="block text-sm font-bold text-gray-900 mb-3 border-b pb-1">Invoice Details</label>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Number</label>
                            <input
                                type="text"
                                value={formData.commonDetails?.clientInvoiceNumber || ''}
                                disabled
                                className="w-full border p-2 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed text-sm"
                                placeholder="N/A"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Date</label>
                            <input
                                type="text"
                                value={formData.commonDetails?.clientInvoiceDate ? new Date(formData.commonDetails.clientInvoiceDate).toLocaleDateString() : ''}
                                disabled
                                className="w-full border p-2 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed text-sm"
                                placeholder="N/A"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-gray-500 text-sm">₹</span>
                                <input
                                    type="text"
                                    value={opportunity.invoiceValue ? opportunity.invoiceValue.toLocaleString() : '0'}
                                    disabled
                                    className="w-full border p-2 pl-6 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Document</label>
                            <div className="flex items-center space-x-2 h-[38px]">
                                {opportunity.invoiceDocument ? (
                                    <a
                                        href={`http://localhost:5000/${opportunity.invoiceDocument.replace(/\\/g, '/')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-green-600 text-xs font-bold flex items-center hover:underline"
                                    >
                                        <CheckCircle size={14} className="mr-1" /> View Invoice
                                    </a>
                                ) : (
                                    <span className="text-xs text-gray-400 italic">No File</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Client Details */}
                <div>
                    <label className="block text-sm font-bold text-gray-900 mb-3 border-b pb-1">Client Details</label>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Billing Client</label>
                            <input
                                type="text"
                                value={formData.commonDetails?.billingClientName || ''}
                                onChange={(e) => handleChange('commonDetails', 'billingClientName', e.target.value)}
                                disabled={!isEditing}
                                className={safeInputClass}
                                placeholder="Enter Billing Client"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">End Client</label>
                            <input
                                type="text"
                                value={formData.commonDetails?.endClientName || ''}
                                onChange={(e) => handleChange('commonDetails', 'endClientName', e.target.value)}
                                disabled={!isEditing}
                                className={safeInputClass}
                                placeholder="Enter End Client"
                            />
                        </div>
                    </div>
                </div>

            </div>
        </Card>
    );
};

export default BillingDetails;
