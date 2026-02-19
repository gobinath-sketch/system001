import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import { Upload, FileText } from 'lucide-react';
import Card from '../../ui/Card';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useCurrency } from '../../../context/CurrencyContext';
import AlertModal from '../../ui/AlertModal';
import BillingDetails from '../sections/BillingDetails';
import OperationalExpensesBreakdown from '../sections/OperationalExpensesBreakdown';
import FinancialSummary from '../sections/FinancialSummary';
const BillingTab = forwardRef(({
  opportunity,
  isEditing,
  refreshData
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
  const [uploading, setUploading] = useState(null);
  const [pendingProposalFile, setPendingProposalFile] = useState(null);
  const [pendingExpenseDocs, setPendingExpenseDocs] = useState({});
  const [escalating, setEscalating] = useState(false);
  const [formData, setFormData] = useState({});

  // Modal State
  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    onConfirm: null
  });

  // Currency Constants
  const CONVERSION_RATE = currency === 'USD' ? 84 : 1;
  const CURRENCY_SYMBOL = currency === 'USD' ? '$' : '₹';

  // Helper to Recalculate Totals based on current state
  const recalculateTotals = data => {
    // CRITICAL FOR REACTIVITY: Always clone expenses to ensure new reference
    const exp = {
      ...(data.expenses || {})
    };
    // ALSO CRITICAL: Clone commonDetails because we mutate common.tov below
    const common = {
      ...(data.commonDetails || {})
    };

    // Helper to parse currency strings (remove commas)
    const parseCurrency = val => {
      if (!val) return 0;
      const strVal = String(val).replace(/,/g, '');
      return parseFloat(strVal) || 0;
    };

    // 1. Calculate OpEx (Sum of manual fields)
    const expenseTypesList = ['trainerCost', 'vouchersCost', 'gkRoyalty', 'material', 'labs', 'venue', 'travel', 'accommodation', 'perDiem', 'localConveyance'];
    const opEx = expenseTypesList.reduce((sum, key) => sum + parseCurrency(exp[key]), 0);

    // 2. Contingency Amount (OpEx * %) - Default updated to 15%
    const contingencyPercent = exp.contingencyPercent ?? 15;
    const contingencyAmount = opEx * contingencyPercent / 100;
    exp.contingency = contingencyAmount;

    // 3. Marketing Amount (OpEx * %) - Changed to be based on OpEx
    const marketingPercent = exp.marketingPercent ?? 0;
    const marketingAmount = opEx * marketingPercent / 100;
    exp.marketing = marketingAmount;

    // 4. Total Expenses (OpEx + Contingency + Marketing)
    const totalExpenses = opEx + contingencyAmount + marketingAmount;

    // 5. Profit Amount (Markup Logic: Profit = Total Expenses * Profit%)
    const profitPercent = exp.targetGpPercent ?? 30;
    const profitAmount = totalExpenses * profitPercent / 100;

    // 6. Final Proposal Value (TOV) = Total Expenses + Profit
    const finalTov = totalExpenses + profitAmount;
    common.tov = Math.round(finalTov);

    // Update TOV Rate based on Unit
    const days = data.days || common.trainingDays || 1;
    const participants = data.participants || common.totalParticipants || 1;
    if (common.tovUnit === 'Per Day' && days > 0) {
      common.tovRate = (finalTov / days).toFixed(2);
    } else if (common.tovUnit === 'Per Participant' && participants > 0) {
      common.tovRate = (finalTov / participants).toFixed(2);
    } else {
      common.tovRate = Math.round(finalTov);
    }
    return {
      ...data,
      expenses: exp,
      commonDetails: common
    };
  };

  // Handle Escalation (Push to Manager)
  const handleEscalate = async (triggerType = 'gp', overrides = {}) => {
    setEscalating(true);
    try {
      const token = localStorage.getItem('token');
      const data = isEditing ? formData : opportunity;
      const expenseTypes = [{
        key: 'trainerCost'
      }, {
        key: 'vouchersCost'
      }, {
        key: 'marketing'
      }, {
        key: 'contingency'
      }, {
        key: 'gkRoyalty'
      }, {
        key: 'material'
      }, {
        key: 'labs'
      }, {
        key: 'venue'
      }, {
        key: 'travel'
      }, {
        key: 'accommodation'
      }, {
        key: 'perDiem'
      }, {
        key: 'localConveyance'
      }];
      const currentTov = data.commonDetails?.tov || 0;
      const currentTotalExpenses = expenseTypes.reduce((sum, type) => sum + (Number(data.expenses?.[type.key]) || 0), 0);
      const currentGpPercent = currentTov > 0 ? (currentTov - currentTotalExpenses) / currentTov * 100 : 0;

      // Allow overrides for values that act as triggers (ensure we send the Triggered Value)
      const params = {
        gpPercent: overrides.gpPercent ?? overrides.targetGpPercent ?? currentGpPercent,
        contingencyPercent: overrides.contingencyPercent ?? (data.expenses?.contingencyPercent || 20),
        tov: currentTov,
        totalExpense: currentTotalExpenses,
        triggerReason: triggerType
      };

      // API 1: Save Opportunity Changes
      await axios.put(`http://localhost:5000/api/opportunities/${opportunity._id}`, {
        expenses: {
          ...data.expenses,
          ...overrides
        },
        commonDetails: data.commonDetails
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // API 2: Trigger Escalation
      await axios.post(`http://localhost:5000/api/approvals/escalate`, {
        opportunityId: opportunity._id,
        ...params
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Determine message
      let msg = 'Approval request sent to Manager!';
      if (triggerType === 'gp' && params.gpPercent < 10) msg = 'Approval request sent to Director!';
      addToast(msg, 'success');
      await refreshData();
    } catch (error) {
      console.error('Escalation failed', error);
      addToast(error.response?.data?.message || 'Failed to send approval request', 'error');
    } finally {
      setEscalating(false);
      setAlertConfig(prev => ({
        ...prev,
        isOpen: false
      }));
    }
  };
  (title, message, onConfirm, onCancel, type = 'info') => {
    setAlertConfig({
      isOpen: true,
      title,
      message,
      onConfirm,
      onCancel,
      // Store the cancel handler
      type
    });
  };
  const handleGpChange = value => {
    // Immediate State Update for UI responsiveness
    handleChange('expenses', 'targetGpPercent', value);

    // Keep changes local until user clicks Save Changes.
    if (value >= 10 && value < 15) {
      // Approval flow handled on save.
    } else if (value < 10) {
      // Approval flow handled on save.
    }
  };
  const handleContingencyChange = value => {
    // Immediate Update
    handleChange('expenses', 'contingencyPercent', value);

    // Keep changes local until user clicks Save Changes.
    if (value < 10) {
      // Approval flow handled on save.
    }
  };

  // Permissions Logic
  const isSales = user?.role === 'Sales Executive' || user?.role === 'Sales Manager';
  const isDelivery = ['Delivery Team', 'Delivery Head', 'Delivery Manager'].includes(user?.role);
  const isAdmin = ['Super Admin', 'Director'].includes(user?.role);

  // Execution Details (TOV, Marketing, Contingency): Editable by Sales, Admin (NOT Delivery)
  const canEditExecution = isEditing && (isSales || isAdmin);

  // Operational Expenses Breakdown: Editable by Delivery, Admin (NOT Sales)
  const canEditOpExpenses = isEditing && (isDelivery || isAdmin);

  // Initialize formData
  useEffect(() => {
    if (opportunity) {
      const initialData = JSON.parse(JSON.stringify(opportunity));
      const exp = initialData.expenses || {};

      // DEFAULT VALUES Logic
      // If marketingPercent is undefined/null, default to 0
      if (exp.marketingPercent === undefined || exp.marketingPercent === null) {
        exp.marketingPercent = 0;
      }
      // If contingencyPercent is undefined/null, default to 15
      if (exp.contingencyPercent === undefined || exp.contingencyPercent === null) {
        exp.contingencyPercent = 15;
      }
      // Clamp to 15 if legacy value is higher (fixes dropdown default to 1% issue)
      if (exp.contingencyPercent > 15) {
        exp.contingencyPercent = 15;
      }

      // Auto-calculate Marketing & Contingency if values are missing
      const tov = initialData.commonDetails?.tov || 0;
      if ((!exp.marketing || exp.marketing === 0) && exp.marketingPercent >= 0) {
        exp.marketing = tov * exp.marketingPercent / 100;
      }
      if ((!exp.contingency || exp.contingency === 0) && exp.contingencyPercent >= 0) {
        exp.contingency = tov * exp.contingencyPercent / 100;
      }

      // Ensure commonDetails is initialized for TOV editing
      if (!initialData.commonDetails) initialData.commonDetails = {};
      initialData.expenses = exp;

      // Perform Initial Calculation
      const calculatedData = recalculateTotals(initialData);
      setFormData(calculatedData);
    }
  }, [opportunity]);

  // Expose handleSave and handleCancel to parent
  useImperativeHandle(ref, () => ({
    handleSave: async () => {
      try {
        const token = localStorage.getItem('token');

        // Sanitize commonDetails (only need specific fields but sending whole obj is fine if carefully handled)
        const sanitizedCommonDetails = {
          ...formData.commonDetails
        };

        // --- AUTO-FILL VENDOR PAYABLES FROM EXPENSES ---
        const expenses = formData.expenses || {};

        // Helper to get currency value (parse if string)
        const getVal = key => {
          const val = expenses[key];
          if (typeof val === 'string') return parseFloat(val.replace(/,/g, '')) || 0;
          return parseFloat(val) || 0;
        };

        // Clone existing financeDetails to preserve other data (like clientReceivables)
        const existingFinance = opportunity.financeDetails || {};
        const financeDetails = JSON.parse(JSON.stringify(existingFinance));
        if (!financeDetails.vendorPayables) financeDetails.vendorPayables = {};
        if (!financeDetails.vendorPayables.detailed) financeDetails.vendorPayables.detailed = {};
        const vp = financeDetails.vendorPayables;
        const detailed = vp.detailed;

        // Helper for Tax Calculation
        const updateCategory = (catKey, expenseVal) => {
          if (!detailed[catKey]) detailed[catKey] = {};
          const cat = detailed[catKey];
          cat.invoiceValue = expenseVal; // Auto-fill Invoice Value (Without Tax)

          // Recalculate based on existing Tax/TDS settings
          const gstType = cat.gstType || '';
          let gstRate = 0;
          if (gstType.includes('18%')) gstRate = 18;else if (gstType.includes('9%')) gstRate = 9; // Simple check for calc

          const gstAmount = expenseVal * gstRate / 100;
          const invoiceValueWithTax = expenseVal + gstAmount;
          const tdsPercent = parseFloat(cat.tdsPercent) || 0;
          const tdsAmount = expenseVal * tdsPercent / 100; // TDS on Base Value

          cat.gstAmount = gstAmount;
          cat.invoiceValueWithTax = invoiceValueWithTax;
          cat.tdsAmount = tdsAmount;
          cat.finalPayable = invoiceValueWithTax - tdsAmount;
        };

        // Perform Mappings
        updateCategory('trainer', getVal('trainerCost'));
        updateCategory('royalty', getVal('gkRoyalty'));
        updateCategory('courseMaterials', getVal('material'));
        updateCategory('lab', getVal('labs'));
        updateCategory('venue', getVal('venue'));
        updateCategory('travel', getVal('travel'));
        updateCategory('accommodation', getVal('accommodation'));

        // Marketing: Use calculated amount from Expense Breakdown
        updateCategory('marketing', getVal('marketing'));

        // Simple Fields
        if (!vp.perDiem) vp.perDiem = {};
        vp.perDiem.amount = getVal('perDiem');
        if (!vp.other) vp.other = {};
        vp.other.amount = getVal('localConveyance'); // Local Conveyance -> Other Expenses

        // Payload includes expenses, commonDetails AND financeDetails
        const payload = {
          expenses: formData.expenses,
          commonDetails: sanitizedCommonDetails,
          financeDetails: financeDetails
        };
        await axios.put(`http://localhost:5000/api/opportunities/${opportunity._id}`, payload, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (pendingProposalFile) {
          const proposalData = new FormData();
          proposalData.append('proposal', pendingProposalFile);
          await axios.post(`http://localhost:5000/api/opportunities/${opportunity._id}/upload-proposal`, proposalData, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          });
        }
        for (const [category, file] of Object.entries(pendingExpenseDocs)) {
          if (!file) continue;
          const expenseData = new FormData();
          expenseData.append('document', file);
          expenseData.append('category', category);
          await axios.post(`http://localhost:5000/api/opportunities/${opportunity._id}/upload-expense-doc`, expenseData, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          });
        }
        setPendingProposalFile(null);
        setPendingExpenseDocs({});
        addToast('Expenses saved successfully', 'success');
        refreshData();
        return true;
      } catch (error) {
        console.error('Save failed', error);
        addToast('Failed to save details', 'error');
        return false;
      }
    },
    handleCancel: () => {
      setFormData(JSON.parse(JSON.stringify(opportunity)));
      setPendingProposalFile(null);
      setPendingExpenseDocs({});
    }
  }));
  const handleChange = (section, field, value) => {
    setFormData(prev => {
      const newState = {
        ...prev
      };
      // CRITICAL FIX: Create a copy of the nested object to ensure React detects the change
      // This fixes the issue where FinancialSummary wouldn't update because the 'expenses' reference didn't change
      newState[section] = {
        ...(prev[section] || {})
      };
      newState[section][field] = value;

      // Trigger Recalculation if modifying calculation inputs
      ['marketingPercent', 'contingencyPercent', 'targetGpPercent', 'trainerCost', 'vouchersCost', 'gkRoyalty', 'material', 'labs', 'venue', 'travel', 'accommodation', 'perDiem', 'localConveyance', 'tovUnit']; // Also re-calc rate if unit changes
      // Or if modifying days/participants (which are root or commonDetails?)
      // We can just always recalculate to be safe and simple.
      return recalculateTotals(newState);
    });
  };

  // Generic upload handler that associates a document with a specific expense category
  const handleProposalUpload = async (e, expenseKey) => {
    const file = e.target.files[0];
    if (!file) return;
    if (isEditing) {
      if (expenseKey === 'proposal') {
        setPendingProposalFile(file);
      } else {
        setPendingExpenseDocs(prev => ({
          ...prev,
          [expenseKey]: file
        }));
      }
      return;
    }
    setUploading(expenseKey);
    try {
      const token = localStorage.getItem('token');
      const uploadFormData = new FormData();
      let endpoint = '';

      // Differentiate between generic 'expense' docs and the 'proposal' doc
      if (expenseKey === 'proposal') {
        endpoint = `http://localhost:5000/api/opportunities/${opportunity._id}/upload-proposal`;
        uploadFormData.append('proposal', file); // Use 'proposal' as field name
      } else {
        endpoint = `http://localhost:5000/api/opportunities/${opportunity._id}/upload-expense-doc`;
        // Use 'document' as field name matching backend for expenses
        uploadFormData.append('document', file);
        uploadFormData.append('category', expenseKey);
      }
      await axios.post(endpoint, uploadFormData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      addToast(`${expenseKey === 'proposal' ? 'Proposal' : 'Document'} uploaded successfully`, 'success');
      refreshData();
    } catch (error) {
      console.error('Upload failed', error);
      addToast(`Failed to upload ${expenseKey}`, 'error');
    } finally {
      setUploading(null);
    }
  };
  const expenseTypes = [{
    key: 'trainerCost',
    label: 'Trainer Cost'
  }, {
    key: 'vouchersCost',
    label: 'Vouchers Cost'
  }, {
    key: 'gkRoyalty',
    label: 'GK Royalty'
  }, {
    key: 'material',
    label: 'Material'
  }, {
    key: 'labs',
    label: 'Labs'
  }, {
    key: 'venue',
    label: 'Venue'
  }, {
    key: 'travel',
    label: 'Travel'
  }, {
    key: 'accommodation',
    label: 'Accommodation'
  }, {
    key: 'perDiem',
    label: 'Per Diem'
  }, {
    key: 'localConveyance',
    label: 'Local Conveyance'
  }
  // Marketing and Contingency removed from breakdown as requested
  ];

  // Use formData for calculations if it has expenses, else fallback to opportunity
  // This MERGE strategy ensures that if formData has updates (from handleChange), they are used regardless of isEditing flag quirks
  const activeData = {
    ...opportunity,
    ...formData,
    expenses: {
      ...(opportunity.expenses || {}),
      ...(formData.expenses || {})
    },
    commonDetails: {
      ...(opportunity.commonDetails || {}),
      ...(formData.commonDetails || {})
    }
  };

  // --- FINANCE-BASED CALCULATIONS (Read-Only from Finance Module) ---
  // TOV: From Finance Client Receivables
  const financeDetails = opportunity.financeDetails || {};
  const clientReceivables = financeDetails.clientReceivables || {};
  const vendorPayables = financeDetails.vendorPayables || {};

  // TOV = Client Invoice Amount (from Finance)
  const tov = clientReceivables.invoiceAmount || 0;
  activeData.commonDetails?.tovUnit || 'Fixed'; // Total Expenses: Sum of Vendor Payables (from Finance)
  let totalExpenses = 0;

  // Sum Detailed Categories (Invoice Value Excl Tax)
  if (vendorPayables.detailed) {
    Object.values(vendorPayables.detailed).forEach(cat => {
      totalExpenses += parseFloat(cat.invoiceValue) || 0;
    });
  }

  // Sum Simple Categories
  totalExpenses += parseFloat(vendorPayables.perDiem?.amount) || 0;
  totalExpenses += parseFloat(vendorPayables.other?.amount) || 0;

  // GKT Revenue and GP (from Finance calculations)
  const gktRevenue = tov - totalExpenses;
  tov > 0 ? (gktRevenue / tov * 100).toFixed(1) : 0; // Marketing and Contingency percentages (still from expenses for display)
  activeData.expenses?.marketingPercent || 0;
  activeData.expenses?.contingencyPercent || 15; // User requested "Cost per day/Cost per participant"
  const totalDays = activeData.days || activeData.commonDetails?.duration || activeData.commonDetails?.trainingDays || 0;
  const totalParticipants = activeData.participants || activeData.commonDetails?.attendanceParticipants || activeData.commonDetails?.totalParticipants || 0;
  const proposalValue = formData.commonDetails?.tov || activeData.commonDetails?.tov || 0;
  // Keep as numbers for formatting later
  const costPerDay = totalDays > 0 ? proposalValue / totalDays : 0;
  const costPerParticipant = totalParticipants > 0 ? proposalValue / totalParticipants : 0;

  // --- LOCAL EXPENSE VALUES (For Expense Breakdown Table Editing) ---
  // Calculate sum of visible operational expenses for table footer
  expenseTypes.reduce((sum, item) => sum + (parseFloat(activeData.expenses?.[item.key]) || 0), 0); // Create expense values object (activeData.expenses is flat)
  ({
    ...activeData.expenses
  });
  `w-full text-right bg-transparent border-none focus:ring-0 p-0 text-sm ${!isEditing ? 'cursor-not-allowed text-gray-500' : 'text-gray-900 font-medium'}`;
  return <div className="space-y-6">
            {/* Grid Layout: Sales gets OpEx/Billing (Left 2/3). Execution (Right 1/3). Delivery gets BillingDetails (Full) */}
            <div className={`grid grid-cols-1 ${!isDelivery ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6`}>

                {/* Left/Main Column: Operational Expenses (Sales) OR Billing Details (Delivery) */}
                <div className={`${!isDelivery ? 'lg:col-span-2' : 'lg:col-span-1'}`}>
                    {/* Sales View: Operational Expenses */}
                    {!isDelivery && <OperationalExpensesBreakdown activeData={activeData} handleChange={handleChange} handleProposalUpload={handleProposalUpload} uploading={uploading} isEditing={isEditing} canEdit={canEditOpExpenses} opportunity={opportunity} />}

                    {/* Delivery View: Billing Details (Moved from Requirements) */}
                    {isDelivery && <div className="flex flex-col gap-6">
                            <BillingDetails opportunity={opportunity} formData={formData} handleChange={handleChange} isEditing={isEditing} inputClass="" />
                            <Card>
                                <FinancialSummary opportunity={activeData} poValue={activeData.poValue} />
                            </Card>
                        </div>}
                </div>

                {/* Right Column: Execution Details (Hidden for Delivery) */}
                {!isDelivery && <div className="lg:col-span-1">
                        <div className="flex flex-col rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white/90 to-[#f4fbf8] p-6 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm">
                            <div className="flex justify-between items-center mb-5">
                                <h3 className="text-lg sm:text-xl leading-tight font-semibold tracking-tight text-blue-900">Execution Details</h3>
                            </div>

                            {/* Proposal Value - Restored */}
                            <div className="mb-5 relative rounded-3xl border border-[#c8ddd9] bg-[linear-gradient(135deg,#d8efe9_0%,#d6dcee_52%,#dcf3e8_100%)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] text-center">
                                <label className="block text-[11px] font-bold text-green-700 uppercase tracking-wide mb-1">Proposal Value</label>
                                <div className="text-4xl font-extrabold text-green-700 leading-none">
                                    {CURRENCY_SYMBOL}{((formData.commonDetails?.tov || 0) / CONVERSION_RATE).toLocaleString(undefined, {
                maximumFractionDigits: 0
              })}
                                </div>
                                {/* Proposal Document Action */}
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {opportunity.proposalDocument ? <div className="flex flex-col items-center group relative">
                                            <a href={`http://localhost:5000/${opportunity.proposalDocument.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:text-emerald-900 p-1.5 bg-white/80 rounded-full shadow-sm border border-emerald-200 transition-all hover:scale-110" title="View Proposal">
                                                <FileText size={18} />
                                            </a>
                                            {canEditExecution && <div className="absolute -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <input type="file" id="proposal-upload-mini" className="hidden" onChange={e => handleProposalUpload(e, 'proposal')} accept=".pdf,.doc,.docx,.ppt,.pptx" disabled={uploading} />
                                                    <button onClick={() => document.getElementById('proposal-upload-mini').click()} className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm hover:bg-slate-50 text-slate-600 whitespace-nowrap">
                                                        Replace
                                                    </button>
                                                </div>}
                                        </div> : canEditExecution && <div>
                                                <input type="file" id="proposal-upload-mini" className="hidden" onChange={e => handleProposalUpload(e, 'proposal')} accept=".pdf,.doc,.docx,.ppt,.pptx" disabled={uploading} />
                                                <button onClick={() => document.getElementById('proposal-upload-mini').click()} className="text-emerald-700 hover:text-emerald-900 p-1.5 bg-white/80 rounded-full shadow-sm border border-emerald-200 border-dashed hover:border-solid transition-all hover:scale-110" title="Upload Proposal">
                                                    <Upload size={18} />
                                                </button>
                                            </div>}
                                </div>
                            </div>

                            {/* Approval Status */}
                            <div className="mb-7 pb-5 border-b border-slate-200/70">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[15px] font-medium text-blue-900">Approval Status</span>
                                    {opportunity.approvalStatus === 'Pending' || opportunity.approvalStatus?.includes('Pending') ? <div className="flex items-center space-x-2">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                                {opportunity.approvalStatus === 'Pending Manager' ? 'Pending - Manager' : opportunity.approvalStatus === 'Pending Director' ? 'Pending - Director' : opportunity.approvalStatus}
                                            </span>
                                            {/* Allow Escalation if pending */}
                                            {canEditExecution && <button onClick={() => handleEscalate('manual')} disabled={escalating} className="text-xs text-primary-blue hover:underline font-medium">
                                                    {escalating ? 'Pushing...' : 'Resend'}
                                                </button>}
                                        </div> : <div>
                                            {opportunity.approvalStatus === 'Not Required' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                    No Approval Required
                                                </span>}
                                            {opportunity.approvalStatus === 'Draft' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                    Draft
                                                </span>}
                                            {opportunity.approvalStatus === 'Approved' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                    Approved
                                                </span>}
                                            {opportunity.approvalStatus === 'Rejected' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                                    Rejected
                                                </span>}
                                        </div>}
                                </div>

                                {/* Breakdown */}
                                <div className="space-y-3 pt-3 border-t border-emerald-200/70">
                                    <div className="flex justify-between text-base text-emerald-700 font-medium">
                                        <span>Cost / Day:</span>
                                        <span>{CURRENCY_SYMBOL} {costPerDay ? (Number(costPerDay) / CONVERSION_RATE).toLocaleString(undefined, {
                    maximumFractionDigits: 0
                  }) : '0'}</span>
                                    </div>
                                    <div className="flex justify-between text-base text-emerald-700 font-medium">
                                        <span>Cost / Pax:</span>
                                        <span>{CURRENCY_SYMBOL} {costPerParticipant ? (Number(costPerParticipant) / CONVERSION_RATE).toLocaleString(undefined, {
                    maximumFractionDigits: 0
                  }) : '0'}</span>
                                    </div>
                                    <div className="flex justify-between text-base text-emerald-700 font-bold border-t border-emerald-200/70 pt-3 mt-2">
                                        <span>GP %:</span>
                                        <span>
                                            {(() => {
                    const tov = formData.commonDetails?.tov || 0;
                    const opEx = expenseTypes.reduce((sum, type) => sum + (parseFloat(activeData.expenses?.[type.key]) || 0), 0);
                    const contPerc = activeData.expenses?.contingencyPercent ?? 15;
                    const markPerc = activeData.expenses?.marketingPercent ?? 0;
                    const contAmt = opEx * contPerc / 100;
                    const markAmt = opEx * markPerc / 100;
                    const totalExp = opEx + contAmt + markAmt;
                    const profit = tov - totalExp;
                    return tov > 0 ? (profit / tov * 100).toFixed(2) : '0.00';
                  })()}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col flex-grow min-h-0">
                                {/* Calculation Controls */}
                                <div className="grid grid-cols-1 gap-5">
                                    {/* Profit (%) */}
                                    <div>
                                        <label className="block text-[15px] font-medium text-gray-700 mb-1.5">Sales Profit (%)</label>
                                        <div className="flex space-x-2">
                                            <select value={formData.expenses?.targetGpPercent ?? 30} onChange={e => handleGpChange(parseFloat(e.target.value))} disabled={!canEditExecution} className={`flex-1 border p-2.5 rounded-xl text-[15px] ${!canEditExecution ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-white/90 border-slate-300 focus:ring-2 focus:ring-sky-500'}`}>
                                                {Array.from({
                      length: 30
                    }, (_, i) => i + 1).map(p => <option key={p} value={p}>{p}%</option>)}
                                            </select>
                                            <div className="flex-1 border p-2.5 rounded-xl text-[15px] bg-slate-50 text-slate-700 text-right font-medium flex items-center justify-end border-slate-200">
                                                {CURRENCY_SYMBOL} {(() => {
                      formData.commonDetails?.tov || 0;
                      const opEx = expenseTypes.reduce((sum, type) => sum + (parseFloat(activeData.expenses?.[type.key]) || 0), 0);
                      const contPerc = activeData.expenses?.contingencyPercent ?? 15;
                      const markPerc = activeData.expenses?.marketingPercent ?? 0;
                      const contAmt = opEx * contPerc / 100;
                      const markAmt = opEx * markPerc / 100;
                      const totalExp = opEx + contAmt + markAmt;
                      const gpPerc = formData.expenses?.targetGpPercent ?? 30;
                      const profit = totalExp * gpPerc / 100;
                      return (profit / CONVERSION_RATE).toLocaleString(undefined, {
                        maximumFractionDigits: 0
                      });
                    })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contingency */}
                                    <div>
                                        <label className="block text-[15px] font-medium text-gray-700 mb-1.5">Contingency (%)</label>
                                        <div className="flex space-x-2">
                                            <select value={formData.expenses?.contingencyPercent ?? 15} onChange={e => handleContingencyChange(parseFloat(e.target.value))} disabled={!canEditExecution} className={`flex-1 border p-2.5 rounded-xl text-[15px] ${!canEditExecution ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-white/90 border-slate-300 focus:ring-2 focus:ring-sky-500'}`}>
                                                {Array.from({
                      length: 15
                    }, (_, i) => i + 1).map(p => <option key={p} value={p}>{p}%</option>)}
                                            </select>
                                            <div className="flex-1 border p-2.5 rounded-xl text-[15px] bg-slate-50 text-slate-700 text-right font-medium flex items-center justify-end border-slate-200">
                                                {CURRENCY_SYMBOL} {((formData.expenses?.contingency || 0) / CONVERSION_RATE).toLocaleString(undefined, {
                      maximumFractionDigits: 0
                    })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Marketing */}
                                    <div>
                                        <label className="block text-[15px] font-medium text-gray-700 mb-1.5">Marketing (%)</label>
                                        <div className="flex space-x-2">
                                            <select value={formData.expenses?.marketingPercent ?? 0} onChange={e => handleChange('expenses', 'marketingPercent', parseFloat(e.target.value))} disabled={!canEditExecution} className={`flex-1 border p-2.5 rounded-xl text-[15px] ${!canEditExecution ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-white/90 border-slate-300 focus:ring-2 focus:ring-sky-500'}`}>
                                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(p => <option key={p} value={p}>{p}%</option>)}
                                            </select>
                                            <div className="flex-1 border p-2.5 rounded-xl text-[15px] bg-slate-50 text-slate-700 text-right font-medium flex items-center justify-end border-slate-200">
                                                {CURRENCY_SYMBOL} {((formData.expenses?.marketing || 0) / CONVERSION_RATE).toLocaleString(undefined, {
                      maximumFractionDigits: 0
                    })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Total Expenses - Display Only */}
                                <div className="mt-auto pt-4 border-t border-slate-200/70">
                                    <div className="flex justify-between items-center bg-gradient-to-r from-slate-100 to-slate-50 p-3 rounded-xl border border-slate-200">
                                        <span className="text-sm font-semibold text-slate-700">Overall Expenses</span>
                                        <span className="text-2xl font-bold text-slate-800">
                                            {CURRENCY_SYMBOL} {(() => {
                    const opEx = expenseTypes.reduce((sum, type) => sum + (parseFloat(activeData.expenses?.[type.key]) || 0), 0);
                    const contPerc = activeData.expenses?.contingencyPercent ?? 15;
                    const markPerc = activeData.expenses?.marketingPercent ?? 0;
                    const contAmt = opEx * contPerc / 100;
                    const markAmt = opEx * markPerc / 100;
                    const totalExp = opEx + contAmt + markAmt;
                    return (totalExp / CONVERSION_RATE).toLocaleString(undefined, {
                      maximumFractionDigits: 0
                    });
                  })()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>}
            </div>



            <AlertModal isOpen={alertConfig.isOpen} onClose={() => {
      if (alertConfig.onCancel) alertConfig.onCancel();
      setAlertConfig(prev => ({
        ...prev,
        isOpen: false
      }));
    }} title={alertConfig.title} message={alertConfig.message} onConfirm={alertConfig.onConfirm} type={alertConfig.type} confirmText="Send for Approval" />
        </div>;
});
export default BillingTab;
