import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import UploadButton from '../../components/ui/UploadButton';
const FinanceDetails = () => {
  const {
    id
  } = useParams();
  const navigate = useNavigate();
  const {
    addToast
  } = useToast();
  const {
    socket
  } = useSocket();
  const [opportunity, setOpportunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('client'); // 'client' or 'vendor'
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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
  const [clientData, setClientData] = useState({
    clientPONumber: '',
    clientPODate: '',
    clientInvoiceNumber: '',
    clientInvoiceDate: '',
    paymentTerms: '',
    paymentDueDate: '',
    invoiceAmount: 0,
    gstType: '',
    gstAmount: 0,
    tdsPercent: 0,
    tds: 0,
    totalInvoiceAmount: 0,
    amountReceivable: 0
  });
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

  // Expanded State for Accordions
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
    trainer: 'Trainer',
    travel: 'Travel',
    accommodation: 'Accommodation',
    venue: 'Venue',
    courseMaterials: 'Course Materials',
    lab: 'Lab',
    royalty: 'Royalty',
    marketing: 'Marketing'
  };
  useEffect(() => {
    fetchOpportunity();
  }, [id]);
  useEffect(() => {
    if (!socket) return;
    const handleEntityUpdated = event => {
      if (event?.entity !== 'opportunity') return;
      if (event?.id && event.id !== id) return;
      fetchOpportunity();
    };
    socket.on('entity_updated', handleEntityUpdated);
    return () => socket.off('entity_updated', handleEntityUpdated);
  }, [socket, id]);
  const fetchOpportunity = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/opportunities/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const op = res.data;
      setOpportunity(op);

      // Populate Form Data
      const fin = op.financeDetails || {};
      const common = op.commonDetails || {};

      // Client Data
      setClientData({
        clientPONumber: common.clientPONumber || '',
        clientPODate: common.clientPODate ? new Date(common.clientPODate).toISOString().split('T')[0] : '',
        clientInvoiceNumber: common.clientInvoiceNumber || '',
        clientInvoiceDate: common.clientInvoiceDate ? new Date(common.clientInvoiceDate).toISOString().split('T')[0] : '',
        paymentTerms: fin.clientReceivables?.paymentTerms || '',
        paymentDueDate: fin.clientReceivables?.paymentDueDate ? new Date(fin.clientReceivables.paymentDueDate).toISOString().split('T')[0] : '',
        invoiceAmount: fin.clientReceivables?.invoiceAmount || 0,
        gstType: fin.clientReceivables?.gstType || '',
        gstAmount: fin.clientReceivables?.gstAmount || 0,
        tdsPercent: fin.clientReceivables?.tdsPercent || 0,
        tds: fin.clientReceivables?.tds || 0,
        totalInvoiceAmount: fin.clientReceivables?.totalInvoiceAmount || 0,
        amountReceivable: fin.clientReceivables?.amountReceivable || 0
      });

      // Vendor Data
      const backendVendor = fin.vendorPayables || {};
      const detailed = backendVendor.detailed || {};
      const newDetailed = {
        ...vendorData.detailed
      };
      Object.keys(defaultDetailed).forEach(() => {
        // Ensure default structure
      });
      Object.keys(categoryLabels).forEach(key => {
        newDetailed[key] = {
          ...defaultDetailed,
          ...(detailed[key] || {})
        };
        // Format dates
        if (newDetailed[key].poDate) newDetailed[key].poDate = new Date(newDetailed[key].poDate).toISOString().split('T')[0];
        if (newDetailed[key].invoiceDate) newDetailed[key].invoiceDate = new Date(newDetailed[key].invoiceDate).toISOString().split('T')[0];
      });

      // Handle legacy trainer data migration if needed (optional, assuming new structure strictly)
      if (!detailed.trainer && backendVendor.trainerVendorName) {
        // Map legacy flat fields to trainer category if it's empty
        newDetailed.trainer = {
          vendorName: backendVendor.trainerVendorName,
          poNumber: backendVendor.trainerPONumber,
          poDate: backendVendor.trainerPODate ? new Date(backendVendor.trainerPODate).toISOString().split('T')[0] : '',
          poValue: backendVendor.trainerPOValue,
          invoiceNumber: backendVendor.trainerInvoiceNumber,
          invoiceDate: backendVendor.trainerInvoiceDate ? new Date(backendVendor.trainerInvoiceDate).toISOString().split('T')[0] : '',
          invoiceValue: backendVendor.trainerInvoiceValue,
          invoiceValueWithTax: backendVendor.trainerInvoiceValueWithTax,
          gstType: backendVendor.gstType,
          gstAmount: backendVendor.gstAmount,
          tdsPercent: backendVendor.tdsPercent,
          tdsAmount: backendVendor.trainerTDS,
          finalPayable: backendVendor.trainerFinalExpenses
        };
      }
      setVendorData({
        detailed: newDetailed,
        perDiem: backendVendor.perDiem || {
          amount: 0,
          document: ''
        },
        other: backendVendor.other || {
          amount: 0,
          document: ''
        }
      });
      setLoading(false);
    } catch (err) {
      console.error('Error fetching opportunity:', err);
      addToast('Failed to load opportunity', 'error');
      setLoading(false);
    }
  };

  // --- CALCULATIONS ---

  const getGstPercentFromType = type => {
    if (!type) return 0;
    if (type.includes('18%')) return 18;
    if (type.includes('9%')) return 9;
    return 0;
  };

  // Client Calculations Effect
  useEffect(() => {
    const inv = parseFloat(clientData.invoiceAmount) || 0;
    const gstRate = getGstPercentFromType(clientData.gstType);
    const gstVal = inv * gstRate / 100;
    const tdsRate = parseFloat(clientData.tdsPercent) || 0;
    const tdsVal = inv * tdsRate / 100; // TDS on Base
    const totalInv = inv + gstVal;
    const receivable = totalInv - tdsVal;
    let dueDate = clientData.paymentDueDate;
    if (clientData.clientInvoiceDate && clientData.paymentTerms) {
      const invoiceDate = new Date(clientData.clientInvoiceDate);
      const days = parseInt(clientData.paymentTerms, 10);
      if (!isNaN(days) && !isNaN(invoiceDate.getTime())) {
        const due = new Date(invoiceDate);
        due.setDate(due.getDate() + days);
        dueDate = due.toISOString().split('T')[0];
      }
    }

    // Only update if values changed to avoid loop (simple comparison)
    if (gstVal !== clientData.gstAmount || tdsVal !== clientData.tds || totalInv !== clientData.totalInvoiceAmount || receivable !== clientData.amountReceivable) {
      setClientData(prev => ({
        ...prev,
        gstAmount: gstVal,
        tds: tdsVal,
        totalInvoiceAmount: totalInv,
        amountReceivable: receivable,
        paymentDueDate: dueDate !== prev.paymentDueDate ? dueDate : prev.paymentDueDate
      }));
    }
  }, [clientData.invoiceAmount, clientData.gstType, clientData.tdsPercent, clientData.clientInvoiceDate, clientData.paymentTerms]);

  // Handlers
  const handleClientChange = e => {
    const {
      name,
      value
    } = e.target;
    setClientData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  const handleDetailedChange = (category, field, value) => {
    setVendorData(prev => {
      const catData = {
        ...prev.detailed[category],
        [field]: value
      };

      // Auto Calculation for this category
      if (['invoiceValue', 'gstType', 'tdsPercent'].includes(field)) {
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
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('document', file);
      formData.append('category', category); // e.g. 'trainer', 'perDiem'
      formData.append('docType', docType); // e.g. 'poDocument', 'document'

      const res = await axios.post(`http://localhost:5000/api/opportunities/${id}/upload-finance-doc`, formData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const updatedVP = res.data.vendorPayables;

      // Update local state with the returned file path
      setVendorData(prev => {
        if (['perDiem', 'other'].includes(category)) {
          return {
            ...prev,
            [category]: {
              ...prev[category],
              document: updatedVP[category].document
            }
          };
        } else {
          return {
            ...prev,
            detailed: {
              ...prev.detailed,
              [category]: {
                ...prev.detailed[category],
                [docType]: updatedVP.detailed[category][docType]
              }
            }
          };
        }
      });
      addToast('Document uploaded successfully', 'success');
    } catch (error) {
      console.error('Upload failed', error);
      addToast('Failed to upload document', 'error');
    } finally {
      setUploading(false);
    }
  };
  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        'commonDetails.clientPONumber': clientData.clientPONumber,
        'commonDetails.clientPODate': clientData.clientPODate,
        'commonDetails.clientInvoiceNumber': clientData.clientInvoiceNumber,
        'commonDetails.clientInvoiceDate': clientData.clientInvoiceDate,
        financeDetails: {
          clientReceivables: clientData,
          vendorPayables: vendorData
        }
      };
      await axios.put(`http://localhost:5000/api/opportunities/${id}`, payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      addToast('Finance details saved successfully', 'success');
      setSaving(false);
    } catch (err) {
      console.error('Error saving finance details:', err);
      addToast('Failed to save details', 'error');
      setSaving(false);
    }
  };
  if (loading) return <div className="p-10 text-center">Loading...</div>;
  if (!opportunity) return <div className="p-10 text-center">Opportunity not found</div>;
  const inputClass = "w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-brand-blue bg-white";
  const readOnlyClass = "w-full p-2 border border-gray-200 rounded bg-gray-100 text-gray-700 font-medium";

  // --- RENDER HELPERS ---
  // (ExpenseRow moved outside to prevent re-renders)

  return <div className="p-3 sm:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <button onClick={() => navigate('/finance')} className="p-2 hover:bg-gray-100 rounded-full">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-primary-class">{opportunity.opportunityNumber}</h1>
                        <p className="text-gray-500 font-medium">{opportunity.type} Opportunity</p>
                    </div>
                </div>
                <button onClick={handleSave} disabled={saving} className="flex items-center justify-center gap-2 bg-primary-blue text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 w-full sm:w-auto">
                    <Save size={18} />
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px] flex flex-col">
                <div className="flex border-b border-gray-200 overflow-x-auto">
                    <button className={`px-5 sm:px-8 py-4 font-semibold text-sm transition-colors relative whitespace-nowrap ${activeTab === 'client' ? 'text-brand-blue' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('client')}>
                        Client Receivables
                        {activeTab === 'client' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-blue"></div>}
                    </button>
                    <button className={`px-5 sm:px-8 py-4 font-semibold text-sm transition-colors relative whitespace-nowrap ${activeTab === 'vendor' ? 'text-brand-blue' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('vendor')}>
                        Vendor Payables
                        {activeTab === 'vendor' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-blue"></div>}
                    </button>
                    <button className={`px-5 sm:px-8 py-4 font-semibold text-sm transition-colors relative whitespace-nowrap ${activeTab === 'gp' ? 'text-brand-blue' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('gp')}>
                        GP Analysis
                        {activeTab === 'gp' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-blue"></div>}
                    </button>
                </div>

                <div className="p-3 sm:p-8 flex-1">
                    {/* TAB II: Vendor Payables */}
                    {activeTab === 'vendor' && <div className="space-y-6 animate-fadeIn">
                            <h2 className="text-xl font-bold text-gray-800 mb-6">Vendor Expenses Breakdown</h2>

                            {/* Detailed Categories */}
                            {Object.entries(categoryLabels).map(([key, label]) => <ExpenseRow key={key} category={key} label={label} vendorData={vendorData} expandedCategories={expandedCategories} toggleAccordion={toggleAccordion} handleDetailedChange={handleDetailedChange} handleFileUpload={handleFileUpload} uploading={uploading} inputClass={inputClass} readOnlyClass={readOnlyClass} />)}

                            {/* Simple Categories */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                                    <h3 className="font-bold text-gray-800 mb-4">Per Diem</h3>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Amount</label>
                                            <input type="number" value={vendorData.perDiem.amount} onChange={e => handleSimpleChange('perDiem', 'amount', e.target.value)} className={inputClass} />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Document</label>
                                            <div className="flex items-center gap-2 mt-2">
                                                {vendorData.perDiem.document ? <a href={`http://localhost:5000/${vendorData.perDiem.document.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">View Doc</a> : <span className="text-gray-400 text-xs italic">No Doc</span>}
                                                <div className="inline-block">
                                                    <input type="file" id="upload-perdiem-doc" className="hidden" onChange={e => handleFileUpload(e, 'perDiem', 'document')} disabled={uploading} />
                                                    <UploadButton onClick={() => document.getElementById('upload-perdiem-doc').click()} disabled={uploading}>
                                                        {vendorData.perDiem.document ? 'Replace' : 'Upload'}
                                                    </UploadButton>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                                    <h3 className="font-bold text-gray-800 mb-4">Other Expenses</h3>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Amount</label>
                                            <input type="number" value={vendorData.other.amount} onChange={e => handleSimpleChange('other', 'amount', e.target.value)} className={inputClass} />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Document</label>
                                            <div className="flex items-center gap-2 mt-2">
                                                {vendorData.other.document ? <a href={`http://localhost:5000/${vendorData.other.document.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">View Doc</a> : <span className="text-gray-400 text-xs italic">No Doc</span>}
                                                <div className="inline-block">
                                                    <input type="file" id="upload-other-doc" className="hidden" onChange={e => handleFileUpload(e, 'other', 'document')} disabled={uploading} />
                                                    <UploadButton onClick={() => document.getElementById('upload-other-doc').click()} disabled={uploading}>
                                                        {vendorData.other.document ? 'Replace' : 'Upload'}
                                                    </UploadButton>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>}

                    {/* TAB I: Client Receivables */}
                    {activeTab === 'client' && <div className="space-y-8 animate-fadeIn">
                            {/* A. Client PO & Invoice Details */}
                            <section>
                                <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">A. Client PO & Invoice Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Client PO Number</label>
                                        <input type="text" name="clientPONumber" value={clientData.clientPONumber} onChange={handleClientChange} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Client PO Date</label>
                                        <input type="date" name="clientPODate" value={clientData.clientPODate} onChange={handleClientChange} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Client Invoice Number</label>
                                        <input type="text" name="clientInvoiceNumber" value={clientData.clientInvoiceNumber} onChange={handleClientChange} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Client Invoice Date</label>
                                        <input type="date" name="clientInvoiceDate" value={clientData.clientInvoiceDate} onChange={handleClientChange} className={inputClass} />
                                    </div>
                                </div>
                            </section>

                            {/* B. Payment Terms */}
                            <section>
                                <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">B. Payment Terms</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms (Days)</label>
                                        <input type="number" name="paymentTerms" value={clientData.paymentTerms} onChange={handleClientChange} className={inputClass} placeholder="e.g. 30" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Due Date</label>
                                        <input type="date" name="paymentDueDate" value={clientData.paymentDueDate} onChange={handleClientChange} className={inputClass} />
                                    </div>
                                </div>
                            </section>

                            {/* C. Invoice & Tax Calculation */}
                            <section>
                                <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">C. Invoice & Tax Calculation</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Amount (Without Tax)</label>
                                        <input type="number" name="invoiceAmount" value={clientData.invoiceAmount} onChange={handleClientChange} className={inputClass} placeholder="0.00" />
                                    </div>

                                    {/* GST Dropdown */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">GST (%)</label>
                                        <select name="gstType" value={clientData.gstType} onChange={handleClientChange} className={inputClass}>
                                            <option value="">Select</option>
                                            <option value="IGST-18%">1. IGST-18%</option>
                                            <option value="CGST-9%">2. CGST-9%</option>
                                            <option value="SGST-9%">3. SGST-9%</option>
                                            <option value="CGST+SGST-18%">4. CGST+SGST- 18%</option>
                                        </select>
                                    </div>

                                    {/* GST Amount (Auto) */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">GST Amount (Auto)</label>
                                        <input type="text" value={clientData.gstAmount.toLocaleString()} disabled className={readOnlyClass} />
                                    </div>

                                    {/* TDS Dropdown */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">TDS (%)</label>
                                        <select name="tdsPercent" value={clientData.tdsPercent} onChange={handleClientChange} className={inputClass}>
                                            <option value="0">Select</option>
                                            {Array.from({
                    length: 15
                  }, (_, i) => i + 1).map(val => <option key={val} value={val}>{val}%</option>)}
                                        </select>
                                    </div>

                                    {/* TDS Amount (Auto) */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">TDS Amount (Auto)</label>
                                        <input type="text" value={clientData.tds.toLocaleString()} disabled className={readOnlyClass} />
                                    </div>
                                </div>
                            </section>

                            {/* D. Final Amount Summary */}
                            <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">D. Final Amount Summary</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="flex flex-col">
                                        <label className="text-sm font-medium text-gray-600 mb-1">Total Invoice Amount (Inc. GST)</label>
                                        <span className="text-xl font-bold text-gray-800">₹ {clientData.totalInvoiceAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-sm font-medium text-gray-600 mb-1">Final Amount Receivable</label>
                                        <span className="text-2xl font-bold text-green-600">₹ {clientData.amountReceivable.toLocaleString()}</span>
                                    </div>
                                </div>
                            </section>
                        </div>}

                    {/* TAB III: GP Analysis */}
                    {activeTab === 'gp' && <div className="space-y-8 animate-fadeIn">
                            {/* GP Calculation Logic */}
                            {(() => {
            // TOV: Client Final Amount Receivable
            const tov = clientData.invoiceAmount || 0;

            // Total Expenses: Sum of Detailed Categories (Invoice Value Excl Tax) + Per Diem + Other
            let totalExpenses = 0;

            // Sum Detailed
            Object.values(vendorData.detailed).forEach(cat => {
              totalExpenses += parseFloat(cat.invoiceValue) || 0;
            });

            // Sum Simple
            totalExpenses += parseFloat(vendorData.perDiem.amount) || 0;
            totalExpenses += parseFloat(vendorData.other.amount) || 0;
            const gktProfit = tov - totalExpenses;
            const gpPercent = tov > 0 ? gktProfit / tov * 100 : 0;

            // Styles
            const cardClass = "bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center h-full";
            const labelClass = "text-sm text-gray-500 font-medium uppercase tracking-wider mb-2";
            const valueClass = "text-2xl font-bold text-gray-800";
            return <div className="max-w-5xl mx-auto">
                                        <h2 className="text-xl font-bold text-gray-800 mb-6">Gross Profit (GP) Analysis</h2>

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
                                                <span className={`${valueClass} text-blue-600`}>₹ {tov.toLocaleString()}</span>
                                            </div>

                                            {/* Total Expenses */}
                                            <div className={cardClass}>
                                                <span className={labelClass}>Total Expenses</span>
                                                <span className={`${valueClass} text-red-500`}>₹ {totalExpenses.toLocaleString()}</span>
                                            </div>

                                            {/* GKT Profit */}
                                            <div className={cardClass}>
                                                <span className={labelClass}>GKT Profit</span>
                                                <span className={`${valueClass} ${gktProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    ₹ {gktProfit.toLocaleString()}
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
                                    </div>;
          })()}
                        </div>}
                </div>
            </div>
        </div>;
};
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
  readOnlyClass
}) => {
  const data = vendorData.detailed[category];
  const isExpanded = expandedCategories[category];
  return <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-gray-50 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100" onClick={() => toggleAccordion(category)}>
                <h3 className="font-bold text-gray-800">{label}</h3>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">Final Payable: <span className="font-bold text-gray-900">₹ {data.finalPayable?.toLocaleString() || 0}</span></span>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
            </div>

            {isExpanded && <div className="p-6 bg-white animate-fadeIn border-t border-gray-200">
                    {/* Vendor & PO */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Vendor Name</label>
                            <input type="text" value={data.vendorName} onChange={e => handleDetailedChange(category, 'vendorName', e.target.value)} className={inputClass} placeholder="Vendor Name" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">PO Number</label>
                            <input type="text" value={data.poNumber} onChange={e => handleDetailedChange(category, 'poNumber', e.target.value)} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">PO Date</label>
                            <input type="date" value={data.poDate} onChange={e => handleDetailedChange(category, 'poDate', e.target.value)} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">PO Value</label>
                            <input type="number" value={data.poValue} onChange={e => handleDetailedChange(category, 'poValue', e.target.value)} className={inputClass} />
                        </div>
                    </div>

                    {/* PO Document */}
                    <div className="mb-4 pb-4 border-b border-gray-100">
                        <div className="flex items-center space-x-4">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">PO Document</label>
                                <div className="flex items-center gap-2">
                                    {data.poDocument ? <a href={`http://localhost:5000/${data.poDocument.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">View Uploaded PO</a> : <span className="text-gray-400 text-xs italic">No Document</span>}
                                    <div className="inline-block">
                                        <input type="file" id={`upload-po-${category}`} className="hidden" onChange={e => handleFileUpload(e, category, 'poDocument')} disabled={uploading} />
                                        <UploadButton onClick={() => document.getElementById(`upload-po-${category}`).click()} disabled={uploading}>
                                            {data.poDocument ? 'Replace' : 'Upload'}
                                        </UploadButton>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Invoice Details */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Invoice Number</label>
                            <input type="text" value={data.invoiceNumber} onChange={e => handleDetailedChange(category, 'invoiceNumber', e.target.value)} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Invoice Date</label>
                            <input type="date" value={data.invoiceDate} onChange={e => handleDetailedChange(category, 'invoiceDate', e.target.value)} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Invoice Value (Without Tax)</label>
                            <input type="number" value={data.invoiceValue} onChange={e => handleDetailedChange(category, 'invoiceValue', e.target.value)} className={inputClass} placeholder="Excl. Tax" />
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
                                    <div className="inline-block">
                                        <input type="file" id={`upload-invoice-${category}`} className="hidden" onChange={e => handleFileUpload(e, category, 'invoiceDocument')} disabled={uploading} />
                                        <UploadButton onClick={() => document.getElementById(`upload-invoice-${category}`).click()} disabled={uploading}>
                                            {data.invoiceDocument ? 'Replace' : 'Upload'}
                                        </UploadButton>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tax & Final */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">GST (%)</label>
                            <select value={data.gstType} onChange={e => handleDetailedChange(category, 'gstType', e.target.value)} className={inputClass}>
                                <option value="">Select</option>
                                <option value="IGST-18%">IGST-18%</option>
                                <option value="CGST-9%">CGST-9%</option>
                                <option value="SGST-9%">SGST-9%</option>
                                <option value="CGST+SGST-18%">CGST+SGST-18%</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">GST Amt</label>
                            <input type="number" value={data.gstAmount} readOnly className={readOnlyClass} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">TDS (%)</label>
                            <select value={data.tdsPercent} onChange={e => handleDetailedChange(category, 'tdsPercent', e.target.value)} className={inputClass}>
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
export default FinanceDetails;