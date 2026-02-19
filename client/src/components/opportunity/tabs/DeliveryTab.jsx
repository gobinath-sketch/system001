import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import Card from '../../ui/Card';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import BillingDetails from '../sections/BillingDetails';
import OperationalExpensesBreakdown from '../sections/OperationalExpensesBreakdown';
import DeliveryDocuments from '../sections/DeliveryDocuments';
import AddSMEModal from '../../sme/AddSMEModal';
import { API_BASE } from '../../../config/api';
const DeliveryTab = forwardRef(({
  opportunity,
  canEdit,
  isEditing,
  refreshData
}, ref) => {
  const {
    addToast
  } = useToast();
  const {
    user
  } = useAuth();
  // vendors state removed
  const [smes, setSmes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expenseUploading, setExpenseUploading] = useState(null);
  const [pendingInvoiceFile, setPendingInvoiceFile] = useState(null);
  const [pendingExpenseDocs, setPendingExpenseDocs] = useState({});
  const [pendingDeliveryDocs, setPendingDeliveryDocs] = useState({});
  const [isSMEModalOpen, setIsSMEModalOpen] = useState(false);
  const [formData, setFormData] = useState({});

  // Derived state
  const isDeliveryRole = ['Delivery Team', 'Delivery Head', 'Delivery Manager'].includes(user?.role);
  const activeData = isEditing ? formData : opportunity;

  // Fetch Vendors and SMEs
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const [smesRes] = await Promise.all([axios.get(`${API_BASE}/api/smes`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })]);
        // vendorsRes removed
        // Populate companyVendor if needed
        const populatedSMEs = smesRes.data.map(sme => ({
          ...sme,
          companyName: sme.companyName || 'N/A'
        }));
        setSmes(populatedSMEs);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching vendors/smes:', error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Initialize formData when opportunity changes or edit mode starts
  useEffect(() => {
    if (opportunity) {
      // Smart Logic for Days and Pax
      let initialDays = opportunity.days;
      if (opportunity.typeSpecificDetails?.duration) {
        const durationStr = opportunity.typeSpecificDetails.duration.toLowerCase();
        const match = durationStr.match(/(\d+)/);
        if (match) {
          const num = parseInt(match[0]);
          if (durationStr.includes('month')) {
            const calculatedDays = num * 30;
            // If stored days is exactly the number of months (e.g. 3) or 0, assume it was wrongly parsed or init, so fix it.
            if (!initialDays || initialDays === num) {
              initialDays = calculatedDays;
            }
          }
        }
      }
      let initialPax = opportunity.participants;
      if (opportunity.type === 'Lab Support' && opportunity.typeSpecificDetails?.numberOfIDs) {
        initialPax = opportunity.typeSpecificDetails.numberOfIDs;
      }
      setFormData({
        ...opportunity,
        // Ensure nested objects are handled correctly
        commonDetails: {
          ...opportunity.commonDetails,
          year: opportunity.commonDetails?.year || new Date().getFullYear()
        },
        expenses: {
          ...opportunity.expenses
        },
        // Handle populated fields by taking _id if object, else value
        // selectedVendor removed
        selectedSME: typeof opportunity.selectedSME === 'object' ? opportunity.selectedSME?._id : opportunity.selectedSME,
        days: initialDays,
        participants: initialPax
      });
    }
  }, [opportunity]);

  // Expose handleSave to parent
  useImperativeHandle(ref, () => ({
    handleSave: async () => {
      try {
        const token = localStorage.getItem('token');
        const payload = {
          expenses: formData.expenses,
          commonDetails: formData.commonDetails,
          // selectedVendor removed
          selectedSME: formData.selectedSME,
          days: formData.days,
          participants: formData.participants
        };
        await axios.put(`${API_BASE}/api/opportunities/${opportunity._id}`, payload, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (pendingInvoiceFile) {
          const invoiceData = new FormData();
          invoiceData.append('invoice', pendingInvoiceFile);
          await axios.post(`${API_BASE}/api/opportunities/${opportunity._id}/upload-invoice`, invoiceData, {
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
          await axios.post(`${API_BASE}/api/opportunities/${opportunity._id}/upload-expense-doc`, expenseData, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          });
        }
        for (const [type, file] of Object.entries(pendingDeliveryDocs)) {
          if (!file) continue;
          const deliveryData = new FormData();
          deliveryData.append('document', file);
          deliveryData.append('type', type);
          await axios.post(`${API_BASE}/api/opportunities/${opportunity._id}/upload-delivery-doc`, deliveryData, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          });
        }
        setPendingInvoiceFile(null);
        setPendingExpenseDocs({});
        setPendingDeliveryDocs({});
        addToast('Changes saved successfully', 'success');
        refreshData();
        return true;
      } catch (error) {
        console.error('Save failed', error);
        const errorMessage = error.response?.data?.message || error.message || 'Failed to save changes';
        addToast(errorMessage, 'error');
        return false;
      }
    },
    handleCancel: () => {
      setFormData({
        ...opportunity,
        commonDetails: {
          ...opportunity.commonDetails,
          year: opportunity.commonDetails?.year || new Date().getFullYear()
        },
        expenses: {
          ...opportunity.expenses
        },
        // selectedVendor removed
        selectedSME: typeof opportunity.selectedSME === 'object' ? opportunity.selectedSME?._id : opportunity.selectedSME
      });
      setPendingInvoiceFile(null);
      setPendingExpenseDocs({});
      setPendingDeliveryDocs({});
    }
  }));
  const handleChange = (section, field, value) => {
    setFormData(prev => {
      const newState = {
        ...prev
      };
      if (section === 'root') {
        newState[field] = value;
      } else {
        newState[section] = {
          ...prev[section],
          [field]: value
        };
      }

      // Auto-calculate end date when start date or days changes
      if (section === 'commonDetails' && field === 'startDate' || section === 'root' && field === 'days') {
        const startDate = section === 'commonDetails' && field === 'startDate' ? value : newState.commonDetails?.startDate;
        const days = section === 'root' && field === 'days' ? value : newState.days;
        if (startDate && days && parseInt(days) > 0) {
          const start = new Date(startDate);
          const end = new Date(start);
          // Add days - 1 (since start date is day 1)
          end.setDate(start.getDate() + parseInt(days) - 1);
          if (!newState.commonDetails) {
            newState.commonDetails = {};
          }
          newState.commonDetails.endDate = end.toISOString().split('T')[0];
        }
      }
      return newState;
    });
  };
  const handleSMEChange = e => {
    const value = e.target.value;
    if (value === 'ADD_NEW_SME') {
      setIsSMEModalOpen(true);
    } else {
      handleChange('root', 'selectedSME', value);
    }
  };
  const handleSMESuccess = newSme => {
    // Add new SME to list
    const formattedSme = {
      ...newSme,
      companyName: newSme.companyName || 'N/A'
    };
    setSmes(prev => [...prev, formattedSme]);

    // Select the new SME
    handleChange('root', 'selectedSME', newSme._id);
    setIsSMEModalOpen(false);
  };

  // handleVendorChange removed
  async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (isEditing) {
      setPendingInvoiceFile(file);
      return;
    }
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const uploadFormData = new FormData();
      uploadFormData.append('invoice', file);
      await axios.post(`${API_BASE}/api/opportunities/${opportunity._id}/upload-invoice`, uploadFormData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      addToast('Invoice uploaded successfully', 'success');
      refreshData();
    } catch (error) {
      console.error('Upload failed', error);
      const errorMessage = error.response?.data?.message || 'Failed to upload invoice';
      addToast(errorMessage, 'error');
    } finally {
      setUploading(false);
    }
  }; // Generic upload handler for expenses (for Delivery Team view)
  const handleProposalUpload = async (e, expenseKey) => {
    const file = e.target.files[0];
    if (!file) return;
    if (isEditing) {
      setPendingExpenseDocs(prev => ({
        ...prev,
        [expenseKey]: file
      }));
      return;
    }
    setExpenseUploading(expenseKey);
    try {
      const token = localStorage.getItem('token');
      const uploadFormData = new FormData();

      // Use 'document' as field name matching backend
      uploadFormData.append('document', file);
      uploadFormData.append('category', expenseKey);
      await axios.post(`${API_BASE}/api/opportunities/${opportunity._id}/upload-expense-doc`, uploadFormData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      addToast('Document uploaded successfully', 'success');
      refreshData();
    } catch (error) {
      console.error('Upload failed', error);
      addToast('Failed to upload proposal', 'error');
    } finally {
      setExpenseUploading(null);
    }
  };
  const handleDeliveryDocUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (isEditing) {
      setPendingDeliveryDocs(prev => ({
        ...prev,
        [type]: file
      }));
      return;
    }
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const uploadFormData = new FormData();
      uploadFormData.append('document', file);
      uploadFormData.append('type', type);
      await axios.post(`${API_BASE}/api/opportunities/${opportunity._id}/upload-delivery-doc`, uploadFormData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      addToast(`${type} uploaded successfully`, 'success');
      refreshData();
    } catch (error) {
      console.error('Upload failed', error);
      const errorMessage = error.response?.data?.message || `Failed to upload ${type}`;
      addToast(errorMessage, 'error');
    } finally {
      setUploading(false);
    }
  };
  const inputClass = `w-full border p-2 rounded-lg ${!isEditing ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50 border-gray-200 focus:ring-2 focus:ring-primary-blue'}`;
  const selectClass = `w-full border p-2 rounded-lg ${!isEditing ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50 border-gray-200 focus:ring-2 focus:ring-primary-blue'}`;
  if (loading) return <div>Loading data...</div>;

  // Show all SMEs (no vendor filtering for delivery team)
  const filteredSMEs = smes;
  return <div className="space-y-6">

            {/* Trainer Details */}
            <Card className="!bg-white">
                <h3 className="text-lg font-bold text-primary-blue mb-4">Training Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Row 1: Support Type, SME */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Trainer Support</label>
                        <select value={formData.commonDetails?.trainingSupporter || 'GKT'} onChange={e => handleChange('commonDetails', 'trainingSupporter', e.target.value)} disabled={!isEditing} className={selectClass}>
                            <option value="GKT">GKT</option>
                            <option value="GKCS">GKCS</option>
                            <option value="MCT">MCT</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select SME</label>
                        <div className={`flex items-center border rounded-lg overflow-hidden ${!isEditing ? 'bg-gray-100 border-gray-200' : 'bg-gray-50 border-gray-200 focus-within:ring-2 focus-within:ring-primary-blue'}`}>
                            <select value={formData.selectedSME || ''} onChange={handleSMEChange} disabled={!isEditing} className={`flex-1 p-2 border-none bg-transparent focus:ring-0 outline-none ${!isEditing ? 'cursor-not-allowed text-gray-500' : 'text-gray-900'}`}>
                                <option value="">-- Select SME --</option>
                                <option value="ADD_NEW_SME" className="text-brand-blue font-bold">+ Add New SME</option>
                                {filteredSMEs.map((s, index) => <option key={s._id || index} value={s._id}>
                                        {s.smeType === 'Company' ? `${s.name} – ${s.companyName}` : `${s.name} – Freelancer`}
                                    </option>)}
                            </select>

                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Technology</label>
                        <input type="text" value={opportunity.typeSpecificDetails?.technology || 'N/A'} disabled className="w-full border p-2 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed" placeholder="Technology from Opportunity" />
                    </div>

                    {/* Row 2: Course Details, Year/Month */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Course Code</label>
                        <input type="text" value={formData.commonDetails?.courseCode || ''} onChange={e => handleChange('commonDetails', 'courseCode', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter Code" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
                        <input type="text" value={formData.commonDetails?.courseName || ''} onChange={e => handleChange('commonDetails', 'courseName', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter Name" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                            <select value={formData.commonDetails?.year || new Date().getFullYear()} onChange={e => handleChange('commonDetails', 'year', parseInt(e.target.value))} disabled={!isEditing} className={selectClass}>
                                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                                <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                            <select value={formData.commonDetails?.monthOfTraining || ''} onChange={e => handleChange('commonDetails', 'monthOfTraining', e.target.value)} disabled={!isEditing} className={selectClass}>
                                <option value="">Month</option>
                                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Row 3: Schedule & Participants */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">No. of Days</label>
                        <input type="number" value={formData.days || ''} onChange={e => handleChange('root', 'days', e.target.value)} disabled={!isEditing} className={inputClass} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                            <input type="date" value={formData.commonDetails?.startDate ? formData.commonDetails.startDate.split('T')[0] : ''} onChange={e => handleChange('commonDetails', 'startDate', e.target.value)} disabled={!isEditing} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                            <input type="date" value={formData.commonDetails?.endDate ? formData.commonDetails.endDate.split('T')[0] : ''} onChange={e => handleChange('commonDetails', 'endDate', e.target.value)} disabled={!isEditing} className={inputClass} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Total Pax</label>
                            <input type="number" value={formData.participants || ''} onChange={e => handleChange('root', 'participants', e.target.value)} disabled={!isEditing} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Attended</label>
                            <input type="number" value={formData.commonDetails?.attendanceParticipants || ''} onChange={e => handleChange('commonDetails', 'attendanceParticipants', e.target.value)} disabled={!isEditing} className={inputClass} />
                        </div>
                    </div>
                </div>
            </Card>

            {/* Operational Expenses Breakdown (Only for Delivery Team) */}
            {isDeliveryRole && <OperationalExpensesBreakdown activeData={activeData} handleChange={handleChange} handleProposalUpload={handleProposalUpload} uploading={expenseUploading} isEditing={isEditing} canEdit={isEditing} opportunity={opportunity} />}

            {/* 4. Billing Details (Hidden for Delivery Team, Visible for Sales) */}
            {!isDeliveryRole && <BillingDetails opportunity={opportunity} formData={formData} handleChange={handleChange} isEditing={isEditing} inputClass={inputClass} />}

            <DeliveryDocuments opportunity={opportunity} canEdit={canEdit && isEditing} handleUpload={handleDeliveryDocUpload} uploading={uploading} />

            <AddSMEModal isOpen={isSMEModalOpen} onClose={() => setIsSMEModalOpen(false)} onSuccess={handleSMESuccess} />
        </div>;
});
export default DeliveryTab;
