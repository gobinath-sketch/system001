import { CheckCircle } from 'lucide-react';
import Card from '../../ui/Card';
import UploadButton from '../../ui/UploadButton';
import { API_BASE } from '../../../config/api';
const BillingDetails = ({
  opportunity,
  formData,
  handleChange,
  isEditing,
  inputClass,
  canUploadInvoice = false,
  onInvoiceUpload = () => {},
  uploadingInvoice = false,
  canEditInvoiceDetails = false,
  pendingInvoiceFile = null,
  onInvoiceDateInvalid = () => {}
}) => {
  const normalizeDateOnly = value => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  };

  const handleInvoiceDateChange = value => {
    handleChange('commonDetails', 'clientInvoiceDate', value);
    const invoiceDate = normalizeDateOnly(value);
    const endDate = normalizeDateOnly(formData.commonDetails?.endDate || opportunity.commonDetails?.endDate);
    if (invoiceDate && endDate && invoiceDate <= endDate) {
      onInvoiceDateInvalid();
    }
  };

  // Unified field style across Billing Details
  const defaultInputClass = `w-full border p-2 rounded-lg text-base border-gray-500 ${!isEditing ? 'bg-gray-100 text-gray-800 cursor-not-allowed' : 'bg-gray-50 text-gray-900 focus:ring-2 focus:ring-primary-blue'}`;
  const safeInputClass = inputClass || defaultInputClass;
  const readOnlyFieldClass = 'w-full border p-2 rounded-lg text-base border-gray-500 bg-gray-100 text-gray-800 cursor-not-allowed';
  const docBoxClass = `${readOnlyFieldClass}`;
  return <Card className="!bg-white">
            <h3 className="text-xl font-bold text-primary-blue mb-4">Billing Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* 1. PO Details */}
                <div>
                    <label className="block text-base font-bold text-gray-900 mb-3 border-b pb-1">PO Details</label>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">PO Number</label>
                            <input type="text" value={opportunity.commonDetails?.clientPONumber || 'N/A'} disabled className={readOnlyFieldClass} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">PO Date</label>
                            <input type="text" value={opportunity.commonDetails?.clientPODate ? new Date(opportunity.commonDetails.clientPODate).toLocaleDateString() : 'N/A'} disabled className={readOnlyFieldClass} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">PO Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-base leading-none">₹</span>
                                <input type="text" value={opportunity.poValue ? opportunity.poValue.toLocaleString() : '0'} disabled className={`${readOnlyFieldClass} pl-8`} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">PO Document</label>
                            <div className={`${docBoxClass} flex items-center`}>
                                {opportunity.poDocument ? <a href={`${API_BASE}/${opportunity.poDocument.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center text-sm font-medium">
                                        <CheckCircle size={14} className="mr-1" /> View
                                    </a> : <span className="text-gray-400 text-sm italic">Not Uploaded</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Invoice Details */}
                <div>
                    <label className="block text-base font-bold text-gray-900 mb-3 border-b pb-1">Invoice Details</label>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Invoice Number</label>
                            <input type="text" value={formData.commonDetails?.clientInvoiceNumber || ''} onChange={e => handleChange('commonDetails', 'clientInvoiceNumber', e.target.value)} disabled={!canEditInvoiceDetails} className={`${safeInputClass} ${!canEditInvoiceDetails ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} placeholder="Enter Invoice Number" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Invoice Date</label>
                            <input type={canEditInvoiceDetails ? "date" : "text"} value={canEditInvoiceDetails ? formData.commonDetails?.clientInvoiceDate ? new Date(formData.commonDetails.clientInvoiceDate).toISOString().split('T')[0] : '' : formData.commonDetails?.clientInvoiceDate ? new Date(formData.commonDetails.clientInvoiceDate).toLocaleDateString() : ''} onChange={e => handleInvoiceDateChange(e.target.value)} disabled={!canEditInvoiceDetails} className={`${safeInputClass} ${!canEditInvoiceDetails ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} placeholder={canEditInvoiceDetails ? "Select Invoice Date" : "N/A"} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Invoice Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-base leading-none">₹</span>
                                <input type="number" value={formData.invoiceValue ?? 0} onChange={e => handleChange('root', 'invoiceValue', e.target.value)} disabled={!canEditInvoiceDetails} className={`${safeInputClass} pl-8 ${!canEditInvoiceDetails ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Invoice Document</label>
                            <div className={`${docBoxClass} flex items-center justify-between gap-2`}>
                                {pendingInvoiceFile ? <span className="text-blue-600 text-sm font-medium flex items-center" title={pendingInvoiceFile.name}>
                                        <CheckCircle size={14} className="mr-1" /> Uploaded
                                    </span> : opportunity.invoiceDocument ? <a href={`${API_BASE}/${opportunity.invoiceDocument.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm font-medium flex items-center hover:underline">
                                        <CheckCircle size={14} className="mr-1" /> View
                                    </a> : <span className="text-xs text-gray-400 italic">No File</span>}
                                {canUploadInvoice && <div className="inline-block">
                                        <input type="file" id="billing-invoice-upload" className="hidden" onChange={onInvoiceUpload} accept=".pdf,.doc,.docx,.jpg,.png" disabled={uploadingInvoice} />
                                        <UploadButton onClick={() => document.getElementById('billing-invoice-upload').click()} disabled={uploadingInvoice}>
                                            {pendingInvoiceFile || opportunity.invoiceDocument ? 'Replace' : 'Upload'}
                                        </UploadButton>
                                    </div>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Client Details */}
                <div>
                    <label className="block text-base font-bold text-gray-900 mb-3 border-b pb-1">Client Details</label>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Billing Client</label>
                            <input type="text" value={formData.commonDetails?.billingClientName || ''} onChange={e => handleChange('commonDetails', 'billingClientName', e.target.value)} disabled={!isEditing} className={safeInputClass} placeholder="Enter Billing Client" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">End Client</label>
                            <input type="text" value={formData.commonDetails?.endClientName || ''} onChange={e => handleChange('commonDetails', 'endClientName', e.target.value)} disabled={!isEditing} className={safeInputClass} placeholder="Enter End Client" />
                        </div>
                    </div>
                </div>

            </div>
        </Card>;
};
export default BillingDetails;
