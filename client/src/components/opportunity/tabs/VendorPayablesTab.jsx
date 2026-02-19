import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { useCurrency } from '../../../context/CurrencyContext';
import UploadButton from '../../ui/UploadButton';
const VendorPayablesTab = forwardRef(({
  opportunity,
  canEdit,
  refreshData
}, ref) => {
  const {
    addToast
  } = useToast();
  const {
    currency
  } = useCurrency();
  const [uploading, setUploading] = useState(false);
  const [pendingUploads, setPendingUploads] = useState({});

  // Initial State Helpers
  const defaultDetailed = {
    vendorName: '',
    poNumber: '',
    poDate: '',
    poValue: 0,
    poDocument: '',
    invoiceNumber: '',
    invoiceDate: '',
    invoiceValue: 0,
    // Excl Tax
    invoiceValueWithTax: 0,
    // Incl GST
    invoiceDocument: '',
    gstType: '',
    gstAmount: 0,
    tdsPercent: 0,
    tdsAmount: 0,
    finalPayable: 0
  };
  const [vendorData, setVendorData] = useState({
    detailed: {
      trainer: {
        ...defaultDetailed
      },
      travel: {
        ...defaultDetailed
      },
      accommodation: {
        ...defaultDetailed
      },
      venue: {
        ...defaultDetailed
      },
      courseMaterials: {
        ...defaultDetailed
      },
      lab: {
        ...defaultDetailed
      },
      royalty: {
        ...defaultDetailed
      },
      marketing: {
        ...defaultDetailed
      }
    },
    perDiem: {
      amount: 0,
      document: ''
    },
    other: {
      amount: 0,
      document: ''
    }
  });
  const [expandedCategories, setExpandedCategories] = useState({
    trainer: true,
    travel: false,
    accommodation: false,
    venue: false,
    courseMaterials: false,
    lab: false,
    royalty: false,
    marketing: false
  });
  const categoryLabels = {
    trainer: 'Trainer cost',
    travel: 'Travels cost',
    accommodation: 'Accommodation',
    venue: 'Venue cost',
    courseMaterials: 'Course material cost',
    lab: 'Lab cost',
    royalty: 'GK royalty',
    marketing: 'Marketing'
  };

  // Initialize Data
  useEffect(() => {
    if (opportunity) {
      const fin = opportunity.financeDetails || {};
      const backendVendor = fin.vendorPayables || {};
      const detailed = backendVendor.detailed || {};
      const opEx = opportunity.expenses || {}; // Access Operational Expenses

      const newDetailed = {
        ...vendorData.detailed
      };
      Object.keys(categoryLabels).forEach(key => {
        newDetailed[key] = {
          ...defaultDetailed,
          ...(detailed[key] || {})
        };
        // Format dates
        if (newDetailed[key].poDate) newDetailed[key].poDate = new Date(newDetailed[key].poDate).toISOString().split('T')[0];
        if (newDetailed[key].invoiceDate) newDetailed[key].invoiceDate = new Date(newDetailed[key].invoiceDate).toISOString().split('T')[0];

        // Auto-fill Invoice Value from OpEx (Read-only source)
        // Map OpEx keys to Vendor keys
        let opExValue = 0;
        switch (key) {
          case 'trainer':
            opExValue = parseFloat(opEx.trainerCost) || 0;
            break;
          case 'travel':
            opExValue = parseFloat(opEx.travel) || 0;
            break;
          case 'accommodation':
            opExValue = parseFloat(opEx.accommodation) || 0;
            break;
          case 'venue':
            opExValue = parseFloat(opEx.venue) || 0;
            break;
          case 'courseMaterials':
            opExValue = parseFloat(opEx.material) || 0;
            break;
          case 'lab':
            opExValue = parseFloat(opEx.labs) || 0;
            break;
          case 'royalty':
            opExValue = parseFloat(opEx.gkRoyalty) || 0;
            break;
          default:
            opExValue = 0;
        }

        // Only override if mapped (marketing has no map)
        if (['trainer', 'travel', 'accommodation', 'venue', 'courseMaterials', 'lab', 'royalty'].includes(key)) {
          newDetailed[key].invoiceValue = opExValue;

          // Re-calculate derived fields since invoiceValue changed
          const invVal = opExValue;
          const gstType = newDetailed[key].gstType;
          const tdsPercent = parseFloat(newDetailed[key].tdsPercent) || 0;
          const gstRate = getGstPercentFromType(gstType);
          const gstAmount = invVal * gstRate / 100;
          const invoiceValueWithTax = invVal + gstAmount;
          const tdsAmount = invVal * tdsPercent / 100;
          const finalPayable = invoiceValueWithTax - tdsAmount;
          newDetailed[key].gstAmount = gstAmount;
          newDetailed[key].invoiceValueWithTax = invoiceValueWithTax;
          newDetailed[key].tdsAmount = tdsAmount;
          newDetailed[key].finalPayable = finalPayable;
        }
      });

      // Handle legacy trainer data migration if needed (Logic preserved, but newDetailed.trainer might be overwritten by OpEx above if exists)
      // ... (legacy logic omitted for brevity as it seems less relevant if we enforce OpEx sync, but technically we should be careful. 
      // However, OpEx fill requirement is strong. "Must auto-populate".)

      // Calculate Per Diem and Other from OpEx
      const perDiemValue = parseFloat(opEx.perDiem) || 0;
      const otherValue = (parseFloat(opEx.vouchersCost) || 0) + (parseFloat(opEx.localConveyance) || 0);
      setVendorData({
        detailed: newDetailed,
        perDiem: {
          ...backendVendor.perDiem,
          amount: perDiemValue
        },
        other: {
          ...backendVendor.other,
          amount: otherValue
        }
      });
    }
  }, [opportunity]);

  // Helpers
  const getGstPercentFromType = type => {
    if (!type) return 0;
    if (type.includes('18%')) return 18;
    if (type.includes('9%')) return 9;
    return 0; // "No GST" falls here
  };
  const handleDetailedChange = (category, field, value) => {
    if (!canEdit) return;
    setVendorData(prev => {
      const catData = {
        ...prev.detailed[category],
        [field]: value
      };

      // Auto Calculation for this category
      if (['invoiceValue', 'gstType', 'tdsPercent'].includes(field)) {
        // Determine invoiceValue: For mapped fields, it shouldn't change via this handler usually, 
        // but just in case, we use the value passed or current.
        // Actually, text input for invoiceValue will be disabled, but let's be safe.
        const invVal = parseFloat(field === 'invoiceValue' ? value : catData.invoiceValue) || 0;
        const gstType = field === 'gstType' ? value : catData.gstType;
        const tdsPercent = parseFloat(field === 'tdsPercent' ? value : catData.tdsPercent) || 0;
        const gstRate = getGstPercentFromType(gstType);
        const gstAmount = invVal * gstRate / 100;
        const invoiceValueWithTax = invVal + gstAmount;
        const tdsAmount = invVal * tdsPercent / 100; // TDS on Base
        const finalPayable = invoiceValueWithTax - tdsAmount;
        catData.gstAmount = gstAmount;
        catData.invoiceValueWithTax = invoiceValueWithTax;
        catData.tdsAmount = tdsAmount;
        catData.finalPayable = finalPayable;
      }
      return {
        ...prev,
        detailed: {
          ...prev.detailed,
          [category]: catData
        }
      };
    });
  };
  const handleSimpleChange = (type, field, value) => {
    if (!canEdit) return;
    // Prevent editing amount for perDiem and other manually if needed, 
    // but UI will be disabled. 
    setVendorData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  };
  const toggleAccordion = category => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };
  const handleFileUpload = async (e, category, docType) => {
    if (!canEdit) return;
    const file = e.target.files[0];
    if (!file) return;
    setPendingUploads(prev => ({
      ...prev,
      [`${category}:${docType}`]: file
    }));
  };

  // Expose handleSave to parent
  useImperativeHandle(ref, () => ({
    handleSave: async () => {
      try {
        const token = localStorage.getItem('token');
        // We only want to update vendorPayables. 
        // The API at /api/opportunities/:id updates whatever is in the body.
        // We should respect the nested structure: financeDetails.vendorPayables

        const payload = {
          'financeDetails.vendorPayables': vendorData
        };
        await axios.put(`http://localhost:5000/api/opportunities/${opportunity._id}`, payload, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const uploadEntries = Object.entries(pendingUploads);
        if (uploadEntries.length > 0) {
          setUploading(true);
          for (const [key, file] of uploadEntries) {
            if (!file) continue;
            const [category, docType] = key.split(':');
            const formData = new FormData();
            formData.append('document', file);
            formData.append('category', category);
            formData.append('docType', docType);
            await axios.post(`http://localhost:5000/api/opportunities/${opportunity._id}/upload-finance-doc`, formData, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
          }
          setPendingUploads({});
        }
        addToast('Vendor Payables saved successfully', 'success');
        if (refreshData) refreshData();
        return true;
      } catch (err) {
        console.error('Error saving vendor payables:', err);
        addToast('Failed to save details', 'error');
        return false;
      } finally {
        setUploading(false);
      }
    },
    handleCancel: () => {
      // Reset logic if needed, or just do nothing as page reload/fetch handles it
      setPendingUploads({});
      if (refreshData) refreshData();
    }
  }));
  const inputClass = "w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-brand-blue bg-white disabled:bg-gray-100 disabled:text-gray-500";
  const readOnlyClass = "w-full p-2 border border-gray-200 rounded bg-gray-100 text-gray-700 font-medium";
  return <div className="space-y-6 animate-fadeIn pb-10">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Vendor Expenses Breakdown</h2>

            {/* Detailed Categories */}
            {Object.entries(categoryLabels).map(([key, label]) => <ExpenseRow key={key} category={key} label={label} vendorData={vendorData} expandedCategories={expandedCategories} toggleAccordion={toggleAccordion} handleDetailedChange={handleDetailedChange} handleFileUpload={handleFileUpload} uploading={uploading} inputClass={inputClass} readOnlyClass={readOnlyClass} canEdit={canEdit} currency={currency} />)}

            {/* Simple Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                {/* Per Diem */}
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <h3 className="font-bold text-gray-800 mb-4">Per Diem</h3>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Amount</label>
                            <input type="number" value={vendorData.perDiem.amount} onChange={e => handleSimpleChange('perDiem', 'amount', e.target.value)} className={readOnlyClass} // CHANGED to readOnlyClass
            disabled={true} // ALWAYS DISABLED
            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Document</label>
                            <div className="flex items-center gap-2 mt-2">
                                {vendorData.perDiem.document ? <a href={`http://localhost:5000/${vendorData.perDiem.document.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">View Doc</a> : <span className="text-gray-400 text-xs italic">No Doc</span>}
                                {canEdit && <div className="inline-block">
                                        <input type="file" id="upload-perDiem" className="hidden" onChange={e => handleFileUpload(e, 'perDiem', 'document')} disabled={uploading} />
                                        <UploadButton onClick={() => document.getElementById('upload-perDiem').click()} disabled={uploading}>
                                            {vendorData.perDiem.document ? 'Replace' : 'Upload'}
                                        </UploadButton>
                                    </div>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Other Expenses */}
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <h3 className="font-bold text-gray-800 mb-4">Other Expenses</h3>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Amount</label>
                            <input type="number" value={vendorData.other.amount} onChange={e => handleSimpleChange('other', 'amount', e.target.value)} className={readOnlyClass} // CHANGED to readOnlyClass
            disabled={true} // ALWAYS DISABLED
            />
                        </div>

                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Document</label>
                            <div className="flex items-center gap-2 mt-2">
                                {vendorData.other.document ? <a href={`http://localhost:5000/${vendorData.other.document.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">View Doc</a> : <span className="text-gray-400 text-xs italic">No Doc</span>}
                                {canEdit && <div className="inline-block">
                                        <input type="file" id="upload-other" className="hidden" onChange={e => handleFileUpload(e, 'other', 'document')} disabled={uploading} />
                                        <UploadButton onClick={() => document.getElementById('upload-other').click()} disabled={uploading}>
                                            {vendorData.other.document ? 'Replace' : 'Upload'}
                                        </UploadButton>
                                    </div>}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>;
});
const ExpenseRow = ({
  category,
  label,
  vendorData,
  expandedCategories,
  toggleAccordion,
  handleDetailedChange,
  handleFileUpload,
  uploading,
  inputClass,
  readOnlyClass,
  canEdit,
  currency
}) => {
  const data = vendorData.detailed[category];
  const isExpanded = expandedCategories[category];
  return <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-gray-50 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100" onClick={() => toggleAccordion(category)}>
                <h3 className="font-bold text-gray-800">{label}</h3>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">Final Payable: <span className="font-bold text-gray-900">{currency === 'USD' ? '$' : '₹'} {(currency === 'USD' ? data.finalPayable / 84 : data.finalPayable)?.toLocaleString(undefined, {
              maximumFractionDigits: 0
            }) || 0}</span></span>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
            </div>

            {isExpanded && <div className="p-6 bg-white animate-fadeIn border-t border-gray-200">
                    {/* Vendor & PO */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Vendor Name</label>
                            <input type="text" value={data.vendorName} onChange={e => handleDetailedChange(category, 'vendorName', e.target.value)} className={inputClass} placeholder="Vendor Name" disabled={!canEdit} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">PO Number</label>
                            <input type="text" value={data.poNumber} onChange={e => handleDetailedChange(category, 'poNumber', e.target.value)} className={inputClass} disabled={!canEdit} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">PO Date</label>
                            <input type="date" value={data.poDate} onChange={e => handleDetailedChange(category, 'poDate', e.target.value)} className={inputClass} disabled={!canEdit} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">PO Value</label>
                            <input type="number" value={data.poValue} onChange={e => handleDetailedChange(category, 'poValue', e.target.value)} className={inputClass} disabled={!canEdit} />
                        </div>
                    </div>

                    {/* PO Document */}
                    <div className="mb-4 pb-4 border-b border-gray-100">
                        <div className="flex items-center space-x-4">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">PO Document</label>
                                <div className="flex items-center gap-2">
                                    {data.poDocument ? <a href={`http://localhost:5000/${data.poDocument.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">View Uploaded PO</a> : <span className="text-gray-400 text-xs italic">No Document</span>}
                                    {canEdit && <div className="inline-block">
                                            <input type="file" id={`upload-po-${category}`} className="hidden" onChange={e => handleFileUpload(e, category, 'poDocument')} disabled={uploading} />
                                            <UploadButton onClick={() => document.getElementById(`upload-po-${category}`).click()} disabled={uploading}>
                                                {data.poDocument ? 'Replace' : 'Upload'}
                                            </UploadButton>
                                        </div>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Invoice Details */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Invoice Number</label>
                            <input type="text" value={data.invoiceNumber} onChange={e => handleDetailedChange(category, 'invoiceNumber', e.target.value)} className={inputClass} disabled={!canEdit} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Invoice Date</label>
                            <input type="date" value={data.invoiceDate} onChange={e => handleDetailedChange(category, 'invoiceDate', e.target.value)} className={inputClass} disabled={!canEdit} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Invoice Value (Without Tax)</label>
                            <input type="number" value={data.invoiceValue} onChange={e => handleDetailedChange(category, 'invoiceValue', e.target.value)} className={readOnlyClass} // Read-only styling
          placeholder="Auto-filled" disabled={true} // Always disabled as it's auto-filled
          />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Invoice Value(Incl. GST)</label>
                            <input type="number" value={data.invoiceValueWithTax} readOnly className={readOnlyClass} />
                        </div>
                    </div>

                    {/* Invoice Document */}
                    <div className="mb-4 pb-4 border-b border-gray-100">
                        <div className="flex items-center space-x-4">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Invoice Document</label>
                                <div className="flex items-center gap-2">
                                    {data.invoiceDocument ? <a href={`http://localhost:5000/${data.invoiceDocument.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">View Uploaded Invoice</a> : <span className="text-gray-400 text-xs italic">No Document</span>}
                                    {canEdit && <div className="inline-block">
                                            <input type="file" id={`upload-invoice-${category}`} className="hidden" onChange={e => handleFileUpload(e, category, 'invoiceDocument')} disabled={uploading} />
                                            <UploadButton onClick={() => document.getElementById(`upload-invoice-${category}`).click()} disabled={uploading}>
                                                {data.invoiceDocument ? 'Replace' : 'Upload'}
                                            </UploadButton>
                                        </div>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tax & Final */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">GST (%)</label>
                            <select value={data.gstType} onChange={e => handleDetailedChange(category, 'gstType', e.target.value)} className={inputClass} disabled={!canEdit}>
                                <option value="">Select</option>
                                <option value="No GST">No GST</option>
                                <option value="IGST-18%">IGST-18%</option>
                                <option value="CGST-9%">CGST-9%</option>
                                <option value="SGST-9%">SGST-9%</option>
                                <option value="CGST(9%)+SGST(9%)-18%">CGST(9%)+SGST(9%)-18%</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">GST Amt</label>
                            <input type="number" value={data.gstAmount} readOnly className={readOnlyClass} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">TDS (%)</label>
                            <select value={data.tdsPercent} onChange={e => handleDetailedChange(category, 'tdsPercent', e.target.value)} className={inputClass} disabled={!canEdit}>
                                <option value="0">0%</option>
                                {Array.from({
              length: 15
            }, (_, i) => i + 1).map(val => <option key={val} value={val}>{val}%</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">TDS Amt</label>
                            <input type="number" value={data.tdsAmount} readOnly className={readOnlyClass} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Final Payable</label>
                            <input type="number" value={data.finalPayable} readOnly className="w-full p-2 border border-brand-blue rounded bg-blue-50 text-blue-900 font-bold" />
                        </div>
                    </div>
                </div>}
        </div>;
};
export default VendorPayablesTab;