import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import { CheckCircle, MoreHorizontal } from 'lucide-react';
import Card from '../../ui/Card';
import { useToast } from '../../../context/ToastContext';
import SearchableSelect from '../../ui/SearchableSelect';
import DeliveryDocuments from '../sections/DeliveryDocuments';
import UploadButton from '../../ui/UploadButton';
import { getTechnologyOptions } from '../../../utils/TechnologyConstants';
import { API_BASE } from '../../../config/api';
import CountrySelectField from '../../form/CountrySelectField';
import CourseAutocomplete from '../../ui/CourseAutocomplete';
import DurationField from '../../ui/DurationField';
const SalesTab = forwardRef(({
  opportunity,
  isEditing,
  refreshData,
  user
}, ref) => {
  const {
    addToast
  } = useToast();
  const toPublicPath = p => {
    const normalized = String(p || '').replace(/\\/g, '/');
    const uploadsIndex = normalized.toLowerCase().indexOf('/uploads/');
    if (uploadsIndex >= 0) {
      return normalized.slice(uploadsIndex + 1);
    }
    return normalized.replace(/^\/+/, '');
  };
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({});
  const [deliveryUsers, setDeliveryUsers] = useState([]);
  const [recommendedSMEs, setRecommendedSMEs] = useState([]);
  const [loadingSMEs, setLoadingSMEs] = useState(false);

  // Fetch recommendations when SME is required
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!isEditing || formData.commonDetails?.smeRequired !== 'Yes') return;
      
      setLoadingSMEs(true);
      try {
        const token = sessionStorage.getItem('token');
        const tech = formData.typeSpecificDetails?.technology || '';
        const loc = formData.typeSpecificDetails?.trainingLocation || formData.commonDetails?.location || '';
        const start = formData.commonDetails?.startDate || '';
        const end = formData.commonDetails?.endDate || '';
        
        if (tech) {
          const res = await axios.get(`${API_BASE}/api/smes/recommend`, {
            params: { technology: tech, location: loc, startDate: start, endDate: end },
            headers: { Authorization: `Bearer ${token}` }
          });
          setRecommendedSMEs(res.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch SME recommendations:', err);
      } finally {
        setLoadingSMEs(false);
      }
    };

    fetchRecommendations();
  }, [
    isEditing, 
    formData.commonDetails?.smeRequired, 
    formData.typeSpecificDetails?.technology, 
    formData.commonDetails?.startDate, 
    formData.commonDetails?.endDate, 
    formData.typeSpecificDetails?.trainingLocation,
    formData.commonDetails?.location
  ]);

  // Fetch delivery users for the assignment dropdown
  useEffect(() => {
    const fetchDeliveryUsers = async () => {
      try {
        const token = sessionStorage.getItem('token');
        const res = await axios.get(`${API_BASE}/api/opportunities/delivery-users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDeliveryUsers(res.data || []);
      } catch (err) {
        console.error('Failed to fetch delivery users:', err);
      }
    };
    fetchDeliveryUsers();
  }, []);

  // Initialize formData
  useEffect(() => {
    if (opportunity) {
      setFormData({
        ...opportunity,
        commonDetails: {
          ...opportunity.commonDetails,
          year: opportunity.commonDetails?.year || new Date().getFullYear()
        },
        expenses: {
          ...opportunity.expenses
        },
        typeSpecificDetails: {
          ...opportunity.typeSpecificDetails
        },
        // Flatten assignedTo if populated object
        assignedTo: typeof opportunity.assignedTo === 'object' && opportunity.assignedTo !== null
          ? opportunity.assignedTo._id
          : opportunity.assignedTo || ''
      });
    }
  }, [opportunity]);

  // Expose handleSave to parent
  useImperativeHandle(ref, () => ({
    handleSave: async () => {
      try {
        // Mandatory SOW Check Removed

        const token = sessionStorage.getItem('token');

        // Sanitize commonDetails
        const sanitizedCommonDetails = {
          ...formData.commonDetails
        };
        delete sanitizedCommonDetails._id;
        delete sanitizedCommonDetails.__v;
        // Flatten sales object to ID if populated
        if (sanitizedCommonDetails.sales && typeof sanitizedCommonDetails.sales === 'object') {
          sanitizedCommonDetails.sales = sanitizedCommonDetails.sales._id;
        }

        // Sanitize expenses
        const sanitizedExpenses = {
          ...formData.expenses
        };
        delete sanitizedExpenses._id;
        delete sanitizedExpenses.__v;

        // Sanitize typeSpecificDetails
        const sanitizedTypeSpecificDetails = {
          ...formData.typeSpecificDetails
        };
        delete sanitizedTypeSpecificDetails._id;
        delete sanitizedTypeSpecificDetails.__v;
        
        const selectedSMEId = typeof formData.selectedSME === 'object' && formData.selectedSME !== null ? formData.selectedSME._id : formData.selectedSME;

        const payload = {
          commonDetails: sanitizedCommonDetails,
          expenses: sanitizedExpenses,
          typeSpecificDetails: sanitizedTypeSpecificDetails,
          participants: formData.participants,
          days: formData.days, // legacy fallback if needed
          requirementSummary: formData.requirementSummary,
          assignedTo: formData.assignedTo || null,
          selectedSME: selectedSMEId || null
        };
        const res = await axios.put(`${API_BASE}/api/opportunities/${opportunity._id}`, payload, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        addToast('Changes saved successfully', 'success');
        await refreshData();

        // ... GP Logic ...
        const updatedOpp = res.data;
        const gp = updatedOpp.financials?.grossProfitPercent || 0;
        const role = user?.role || 'Sales Executive';
        if (role === 'Sales Executive') {
          if (gp >= 10 && gp < 15) {
            addToast('GP between 10-15% ,need manager approval', 'info');
          }
        }
        return true;
      } catch (error) {
        console.error('Save failed', error);
        const serverMsg = error.response?.data?.message || 'Failed to save changes';
        addToast(`Error: ${serverMsg}`, 'error');
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
        typeSpecificDetails: {
          ...opportunity.typeSpecificDetails
        },
        assignedTo: typeof opportunity.assignedTo === 'object' && opportunity.assignedTo !== null
          ? opportunity.assignedTo._id
          : opportunity.assignedTo || ''
      });
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

      // Dynamic TOV calculation
      if (section === 'commonDetails' && (field === 'tovRate' || field === 'tovUnit' || field === 'durationHours') || section === 'root' && field === 'participants') {
        const rate = (section === 'commonDetails' && field === 'tovRate') ? (parseFloat(value) || 0) : (newState.commonDetails.tovRate || 0);
        const unit = (section === 'commonDetails' && field === 'tovUnit') ? value : (newState.commonDetails.tovUnit || 'Fixed');
        const durationH = (section === 'commonDetails' && field === 'durationHours') ? value : (newState.commonDetails.durationHours || 0);
        const participants = (section === 'root' && field === 'participants') ? value : (newState.participants || 1);
        
        let calculatedTov = rate;
        const calcDays = durationH / 8;
        
        if (unit === 'Per Day') calculatedTov = rate * (calcDays || 1); 
        else if (unit === 'Per Hour') calculatedTov = rate * (durationH || 1);
        else if (unit === 'Per Participant') calculatedTov = rate * (participants || 1);
        
        newState.commonDetails.tov = calculatedTov;
      }

      // Auto-calculate end date when start date or duration changes
      if (section === 'commonDetails' && (field === 'startDate' || field === 'durationHours')) {
        const startDate = (section === 'commonDetails' && field === 'startDate') ? value : newState.commonDetails?.startDate;
        const durationH = (section === 'commonDetails' && field === 'durationHours') ? value : newState.commonDetails?.durationHours;
        const daysRounded = Math.ceil((durationH || 8) / 8);

        if (startDate && daysRounded > 0) {
          const start = new Date(startDate);
          const end = new Date(start);
          // Add days - 1 (since start date is day 1)
          end.setDate(start.getDate() + daysRounded - 1);

          // Only auto-update if user hasn't manually set end date
          if (!newState.commonDetails) {
            newState.commonDetails = {};
          }
          newState.commonDetails.endDate = end.toISOString().split('T')[0];
        }
      }
      return newState;
    });
  };

  const handleRequirementDocumentUpload = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = sessionStorage.getItem('token');
      const uploadFormData = new FormData();
      uploadFormData.append('requirementDocument', file);
      const res = await axios.post(`${API_BASE}/api/opportunities/${opportunity._id}/upload-requirement-document`, uploadFormData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      const uploadedPath = res.data?.requirementDocument;
      if (uploadedPath) {
        setFormData(prev => ({
          ...prev,
          requirementDocument: uploadedPath
        }));
      }
      addToast('Requirement document uploaded successfully', 'success');
      refreshData();
    } catch (error) {
      console.error('Upload failed', error);
      addToast('Failed to upload requirement document', 'error');
    } finally {
      setUploading(false);
    }
  };
  const inputClass = `w-full border p-2 rounded-lg text-base border-gray-500 ${!isEditing ? 'bg-gray-100 text-gray-800 cursor-not-allowed' : 'bg-gray-50 text-gray-900 focus:ring-2 focus:ring-primary-blue'}`;
  const selectClass = `w-full border p-2 rounded-lg text-base border-gray-500 ${!isEditing ? 'bg-gray-100 text-gray-800 cursor-not-allowed' : 'bg-gray-50 text-gray-900 focus:ring-2 focus:ring-primary-blue'}`;
  const isResourceSupport = opportunity.type === 'Resource Support';
  const isContentDevelopment = opportunity.type === 'Content Development';
  const isLabSupport = opportunity.type === 'Lab Support';
  const isProductSupport = opportunity.type === 'Product Support';
  const showLabSummary = !isLabSupport;
  return <div className="space-y-6">
    {/* Basic Details Section - Dynamic based on Opportunity Type */}
    <Card className="!bg-white">
      <h3 className="text-xl font-bold text-primary-blue mb-4">Basic Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Common Fields for All Types */}
        <div>
          <label className="block text-base font-semibold text-gray-800 mb-1">Client Name</label>
          <input type="text" value={opportunity.client?.companyName || 'N/A'} disabled className="w-full border p-2 rounded-lg text-base border-gray-500 bg-gray-100 text-gray-800 cursor-not-allowed" />
        </div>
        <div>
          <label className="block text-base font-semibold text-gray-800 mb-1">Opportunity Type</label>
          <input type="text" value={opportunity.type || 'N/A'} disabled className="w-full border p-2 rounded-lg text-base border-gray-500 bg-gray-100 text-gray-800 cursor-not-allowed" />
        </div>

        {/* Assign Delivery Person — editable in edit mode, read-only display in view mode */}
        <div>
          <label className="block text-base font-semibold text-gray-800 mb-1">Assign Delivery Person</label>
          {isEditing ? (
            <select
              value={formData.assignedTo || ''}
              onChange={e => handleChange('root', 'assignedTo', e.target.value || null)}
              className={selectClass}
            >
              <option value="">-- Not Assigned --</option>
              {deliveryUsers.map(du => (
                <option key={du._id} value={du._id}>
                  {du.name} ({du.role === 'Delivery Head' ? 'Head' : 'Executive'})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={
                (() => {
                  const assigned = opportunity.assignedTo;
                  if (!assigned) return 'Not Assigned';
                  if (typeof assigned === 'object') return `${assigned.name} (${assigned.role === 'Delivery Head' ? 'Head' : 'Executive'})`;
                  const found = deliveryUsers.find(u => u._id === assigned);
                  return found ? `${found.name} (${found.role === 'Delivery Head' ? 'Head' : 'Executive'})` : 'Assigned';
                })()
              }
              disabled
              className="w-full border p-2 rounded-lg text-base border-gray-500 bg-gray-100 text-gray-800 cursor-not-allowed"
            />
          )}
        </div>

        {/* Training-Specific Fields */}
        {opportunity.type === 'Training' && <>
          <div className={formData.typeSpecificDetails?.technology?.startsWith('Emerging technologies') || formData.typeSpecificDetails?.technology?.startsWith('Other technologies') ? "col-span-1 grid grid-cols-2 gap-2" : ""}>
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1">Technology *</label>
              <SearchableSelect value={formData.typeSpecificDetails?.technology?.includes('Emerging technologies') ? 'Emerging technologies' : formData.typeSpecificDetails?.technology?.includes('Other technologies') ? 'Other technologies' : formData.typeSpecificDetails?.technology || ''} onChange={e => {
                const selected = e.target.value;
                if (selected === 'Emerging technologies' || selected === 'Other technologies') {
                  handleChange('typeSpecificDetails', 'technology', `${selected} - `);
                } else {
                  handleChange('typeSpecificDetails', 'technology', selected);
                }
              }} options={getTechnologyOptions().map(opt => ({
                ...opt,
                icon: opt.value === 'Other technologies' ? <MoreHorizontal size={18} className="text-gray-500" /> : opt.icon
              }))} placeholder="Select technology" disabled={!isEditing} className={selectClass} />
            </div>

            {(formData.typeSpecificDetails?.technology?.startsWith('Emerging technologies') || formData.typeSpecificDetails?.technology?.startsWith('Other technologies')) && <div>
              <label className="block text-base font-semibold text-gray-800 mb-1">
                {formData.typeSpecificDetails?.technology?.startsWith('Emerging') ? 'Specific Emerging' : 'Specific Technology'}
              </label>
              <input type="text" value={formData.typeSpecificDetails?.technology?.split(' - ')[1] || ''} onChange={e => {
                const category = formData.typeSpecificDetails?.technology?.split(' - ')[0];
                handleChange('typeSpecificDetails', 'technology', `${category} - ${e.target.value}`);
              }} disabled={!isEditing} className={inputClass} placeholder="Specify..." />
            </div>}
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Training Name/Requirement *</label>
            <input type="text" value={formData.typeSpecificDetails?.trainingName || ''} onChange={e => handleChange('typeSpecificDetails', 'trainingName', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter Training Name/Requirement" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Mode of Training *</label>
            <select value={formData.typeSpecificDetails?.modeOfTraining || ''} onChange={e => handleChange('typeSpecificDetails', 'modeOfTraining', e.target.value)} disabled={!isEditing} className={selectClass}>
              <option value="">-- Select Mode --</option>
              <option value="Virtual">Virtual</option>
              <option value="Classroom">Classroom</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Number of Participants *</label>
            <input type="number" value={formData.participants || ''} onChange={e => handleChange('root', 'participants', parseInt(e.target.value) || 0)} onWheel={e => e.target.blur()} disabled={!isEditing} className={`${inputClass} no-arrows`} placeholder="0" />
          </div>
          {(formData.typeSpecificDetails?.modeOfTraining === 'Classroom' || formData.typeSpecificDetails?.modeOfTraining === 'Hybrid') && <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Training Location *</label>
            <CountrySelectField
              value={formData.typeSpecificDetails?.trainingLocation || ''}
              onChange={e => handleChange('typeSpecificDetails', 'trainingLocation', e.target.value)}
              disabled={!isEditing}
              className="w-full"
              required
            />
          </div>}
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Requirement Summary *</label>
            <input type="text" value={formData.requirementSummary || ''} onChange={e => handleChange('root', 'requirementSummary', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter requirement summary" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Requirement Document</label>
            <div className={`w-full border p-2 rounded-lg text-base border-gray-500 flex items-center justify-between gap-2 ${!isEditing ? 'bg-gray-100 text-gray-800 cursor-not-allowed' : 'bg-gray-50 text-gray-900 focus-within:ring-2 focus-within:ring-primary-blue'}`}>
              <div className="min-w-0">
                {formData.requirementDocument ? <a href={`${API_BASE}/${String(formData.requirementDocument).replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline" title="View Requirement Document">
                  <CheckCircle size={14} /> View
                </a> : <span className="text-sm text-gray-400 italic">Not Uploaded</span>}
              </div>
              {isEditing && <div className="shrink-0">
                <input type="file" id="requirement-document-upload" className="hidden" onChange={handleRequirementDocumentUpload} accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" disabled={uploading} />
                <UploadButton onClick={() => document.getElementById('requirement-document-upload').click()} disabled={uploading}>
                  {formData.requirementDocument ? 'Replace' : 'Upload'}
                </UploadButton>
              </div>}
            </div>
          </div>
        </>}

        {/* Vouchers-Specific Fields */}
        {opportunity.type === 'Vouchers' && <>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Technology *</label>
            <SearchableSelect value={formData.typeSpecificDetails?.technology || ''} onChange={e => handleChange('typeSpecificDetails', 'technology', e.target.value)} options={getTechnologyOptions()} placeholder="Select or type technology" disabled={!isEditing} className={selectClass} />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Exam Details *</label>
            <input type="text" value={formData.typeSpecificDetails?.examDetails || ''} onChange={e => handleChange('typeSpecificDetails', 'examDetails', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter Exam Details" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">No of Vouchers *</label>
            <input type="number" value={formData.typeSpecificDetails?.numberOfVouchers || ''} onChange={e => handleChange('typeSpecificDetails', 'numberOfVouchers', parseInt(e.target.value) || 0)} disabled={!isEditing} className={inputClass} placeholder="0" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Exam Location *</label>
            <CountrySelectField
              value={formData.typeSpecificDetails?.examLocation || ''}
              onChange={e => handleChange('typeSpecificDetails', 'examLocation', e.target.value)}
              disabled={!isEditing}
              className="w-full"
              required
            />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Requirement Summary *</label>
            <input type="text" value={formData.requirementSummary || ''} onChange={e => handleChange('root', 'requirementSummary', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter requirement summary" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Requirement Document</label>
            <div className={`w-full border p-2 rounded-lg text-base border-gray-500 flex items-center justify-between gap-2 ${!isEditing ? 'bg-gray-100 text-gray-800 cursor-not-allowed' : 'bg-gray-50 text-gray-900 focus-within:ring-2 focus-within:ring-primary-blue'}`}>
              <div className="min-w-0">
                {formData.requirementDocument ? <a href={`${API_BASE}/${String(formData.requirementDocument).replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline" title="View Requirement Document">
                  <CheckCircle size={14} /> View
                </a> : <span className="text-sm text-gray-400 italic">Not Uploaded</span>}
              </div>
              {isEditing && <div className="shrink-0">
                <input type="file" id="requirement-document-upload" className="hidden" onChange={handleRequirementDocumentUpload} accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" disabled={uploading} />
                <UploadButton onClick={() => document.getElementById('requirement-document-upload').click()} disabled={uploading}>
                  {formData.requirementDocument ? 'Replace' : 'Upload'}
                </UploadButton>
              </div>}
            </div>
          </div>
        </>}

        {/* Lab Support-Specific Fields */}
        {opportunity.type === 'Lab Support' && <>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Technology *</label>
            <SearchableSelect value={formData.typeSpecificDetails?.technology || ''} onChange={e => handleChange('typeSpecificDetails', 'technology', e.target.value)} options={getTechnologyOptions()} placeholder="Select or type technology" disabled={!isEditing} className={selectClass} />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Requirement *</label>
            <input type="text" value={formData.typeSpecificDetails?.labRequirement || ''} onChange={e => handleChange('typeSpecificDetails', 'labRequirement', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter Requirement" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">No of IDs *</label>
            <input type="number" value={formData.typeSpecificDetails?.numberOfIDs || ''} onChange={e => handleChange('typeSpecificDetails', 'numberOfIDs', parseInt(e.target.value) || 0)} disabled={!isEditing} className={inputClass} placeholder="0" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Duration *</label>
            <input type="text" value={formData.typeSpecificDetails?.duration || ''} onChange={e => handleChange('typeSpecificDetails', 'duration', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="e.g., 30 days, 6 months" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Region *</label>
            <CountrySelectField
              value={formData.typeSpecificDetails?.region || ''}
              onChange={e => handleChange('typeSpecificDetails', 'region', e.target.value)}
              disabled={!isEditing}
              className="w-full"
              required
            />
          </div>
          {showLabSummary && <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Requirement Summary *</label>
            <input type="text" value={formData.requirementSummary || ''} onChange={e => handleChange('root', 'requirementSummary', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter requirement summary" />
          </div>}
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Requirement Document</label>
            <div className={`w-full border p-2 rounded-lg text-base border-gray-500 flex items-center justify-between gap-2 ${!isEditing ? 'bg-gray-100 text-gray-800 cursor-not-allowed' : 'bg-gray-50 text-gray-900 focus-within:ring-2 focus-within:ring-primary-blue'}`}>
              <div className="min-w-0">
                {formData.requirementDocument ? <a href={`${API_BASE}/${String(formData.requirementDocument).replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline" title="View Requirement Document">
                  <CheckCircle size={14} /> View
                </a> : <span className="text-sm text-gray-400 italic">Not Uploaded</span>}
              </div>
              {isEditing && <div className="shrink-0">
                <input type="file" id="requirement-document-upload" className="hidden" onChange={handleRequirementDocumentUpload} accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" disabled={uploading} />
                <UploadButton onClick={() => document.getElementById('requirement-document-upload').click()} disabled={uploading}>
                  {formData.requirementDocument ? 'Replace' : 'Upload'}
                </UploadButton>
              </div>}
            </div>
          </div>
        </>}

        {/* Resource Support-Specific Fields */}
        {opportunity.type === 'Resource Support' && <>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Resource Type *</label>
            <input type="text" value={formData.typeSpecificDetails?.resourceType || ''} onChange={e => handleChange('typeSpecificDetails', 'resourceType', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="e.g., Trainer, Consultant" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Resource Count *</label>
            <input type="number" value={formData.typeSpecificDetails?.resourceCount || ''} onChange={e => handleChange('typeSpecificDetails', 'resourceCount', parseInt(e.target.value) || 0)} disabled={!isEditing} className={inputClass} placeholder="0" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Requirement Summary *</label>
            <input type="text" value={formData.requirementSummary || ''} onChange={e => handleChange('root', 'requirementSummary', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter requirement summary" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Requirement Document</label>
            <div className={`w-full border p-2 rounded-lg text-base border-gray-500 flex items-center justify-between gap-2 ${!isEditing ? 'bg-gray-100 text-gray-800 cursor-not-allowed' : 'bg-gray-50 text-gray-900 focus-within:ring-2 focus-within:ring-primary-blue'}`}>
              <div className="min-w-0">
                {formData.requirementDocument ? <a href={`${API_BASE}/${String(formData.requirementDocument).replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline" title="View Requirement Document">
                  <CheckCircle size={14} /> View
                </a> : <span className="text-sm text-gray-400 italic">Not Uploaded</span>}
              </div>
              {isEditing && <div className="shrink-0">
                <input type="file" id="requirement-document-upload" className="hidden" onChange={handleRequirementDocumentUpload} accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" disabled={uploading} />
                <UploadButton onClick={() => document.getElementById('requirement-document-upload').click()} disabled={uploading}>
                  {formData.requirementDocument ? 'Replace' : 'Upload'}
                </UploadButton>
              </div>}
            </div>
          </div>
        </>}

        {/* Content Development-Specific Fields */}
        {opportunity.type === 'Content Development' && <>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Content Type *</label>
            <input type="text" value={formData.typeSpecificDetails?.contentType || ''} onChange={e => handleChange('typeSpecificDetails', 'contentType', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="e.g., Course Material" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Delivery Format *</label>
            <input type="text" value={formData.typeSpecificDetails?.deliveryFormat || ''} onChange={e => handleChange('typeSpecificDetails', 'deliveryFormat', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="e.g., PDF, Video" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Requirement Summary *</label>
            <input type="text" value={formData.requirementSummary || ''} onChange={e => handleChange('root', 'requirementSummary', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter requirement summary" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Requirement Document</label>
            <div className={`w-full border p-2 rounded-lg text-base border-gray-500 flex items-center justify-between gap-2 ${!isEditing ? 'bg-gray-100 text-gray-800 cursor-not-allowed' : 'bg-gray-50 text-gray-900 focus-within:ring-2 focus-within:ring-primary-blue'}`}>
              <div className="min-w-0">
                {formData.requirementDocument ? <a href={`${API_BASE}/${String(formData.requirementDocument).replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline" title="View Requirement Document">
                  <CheckCircle size={14} /> View
                </a> : <span className="text-sm text-gray-400 italic">Not Uploaded</span>}
              </div>
              {isEditing && <div className="shrink-0">
                <input type="file" id="requirement-document-upload" className="hidden" onChange={handleRequirementDocumentUpload} accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" disabled={uploading} />
                <UploadButton onClick={() => document.getElementById('requirement-document-upload').click()} disabled={uploading}>
                  {formData.requirementDocument ? 'Replace' : 'Upload'}
                </UploadButton>
              </div>}
            </div>
          </div>
        </>}

        {/* Product Support-Specific Fields */}
        {opportunity.type === 'Product Support' && <>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Project Scope *</label>
            <input type="text" value={formData.typeSpecificDetails?.projectScope || ''} onChange={e => handleChange('typeSpecificDetails', 'projectScope', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="e.g., Full Stack Development" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Team Size *</label>
            <input type="number" value={formData.typeSpecificDetails?.teamSize || ''} onChange={e => handleChange('typeSpecificDetails', 'teamSize', parseInt(e.target.value) || 0)} disabled={!isEditing} className={inputClass} placeholder="0" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Requirement Summary *</label>
            <input type="text" value={formData.requirementSummary || ''} onChange={e => handleChange('root', 'requirementSummary', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter requirement summary" />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Requirement Document</label>
            <div className={`w-full border p-2 rounded-lg text-base border-gray-500 flex items-center justify-between gap-2 ${!isEditing ? 'bg-gray-100 text-gray-800 cursor-not-allowed' : 'bg-gray-50 text-gray-900 focus-within:ring-2 focus-within:ring-primary-blue'}`}>
              <div className="min-w-0">
                {formData.requirementDocument ? <a href={`${API_BASE}/${String(formData.requirementDocument).replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline" title="View Requirement Document">
                  <CheckCircle size={14} /> View
                </a> : <span className="text-sm text-gray-400 italic">Not Uploaded</span>}
              </div>
              {isEditing && <div className="shrink-0">
                <input type="file" id="requirement-document-upload" className="hidden" onChange={handleRequirementDocumentUpload} accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" disabled={uploading} />
                <UploadButton onClick={() => document.getElementById('requirement-document-upload').click()} disabled={uploading}>
                  {formData.requirementDocument ? 'Replace' : 'Upload'}
                </UploadButton>
              </div>}
            </div>
          </div>
        </>}


      </div>
    </Card>

    {/* Trainer Details Section */}
    <Card className="!bg-white">
      <h3 className="text-xl font-bold text-primary-blue mb-4">
        {{
          'Training': 'Training Details',
          'Lab Support': 'Lab Details',
          'Vouchers': 'Voucher Details',
          'Product Support': 'Product Support Details',
          'Resource Support': 'Resource Support Details',
          'Content Development': 'Content Development Details'
        }[opportunity.type] || 'Training Details'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-base font-semibold text-gray-800 mb-1">Trainer Support</label>
          <select value={formData.commonDetails?.trainingSupporter || 'GKT'} onChange={e => handleChange('commonDetails', 'trainingSupporter', e.target.value)} disabled={!isEditing} className={selectClass}>
            <option value="GKT">GKT</option>
            <option value="GKCS">GKCS</option>
            <option value="MCT">MCT</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-base font-semibold text-gray-800 mb-1">Course</label>
          <CourseAutocomplete
              technology={formData.typeSpecificDetails?.technology || opportunity.typeSpecificDetails?.technology}
              trainingRequirement={formData.typeSpecificDetails?.trainingName || formData.requirementSummary}
              value={
                  formData.commonDetails?.courseCode && formData.commonDetails?.courseName
                  ? `${formData.commonDetails.courseCode} - ${formData.commonDetails.courseName}`
                  : formData.commonDetails?.courseName || formData.commonDetails?.courseCode || ''
              }
              onChange={(code, name, durationHours) => {
                  handleChange('commonDetails', 'courseCode', code);
                  handleChange('commonDetails', 'courseName', name);
                  if (durationHours !== null) {
                      handleChange('commonDetails', 'durationHours', durationHours);
                  }
              }}
              disabled={!isEditing}
              className={inputClass}
          />
        </div>

        {/* Month/Year Selection */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Year</label>
            <select value={formData.commonDetails?.year || new Date().getFullYear()} onChange={e => handleChange('commonDetails', 'year', parseInt(e.target.value))} disabled={!isEditing} className={selectClass}>
              <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
              <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
            </select>
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Month</label>
            <select value={formData.commonDetails?.monthOfTraining || ''} onChange={e => handleChange('commonDetails', 'monthOfTraining', e.target.value)} disabled={!isEditing} className={selectClass}>
              <option value="">Month</option>
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-base font-semibold text-gray-800 mb-1">Duration</label>
          <DurationField 
              durationHours={formData.commonDetails?.durationHours}
              onChange={val => handleChange('commonDetails', 'durationHours', val)}
              disabled={!isEditing}
              className={`${inputClass} !w-auto`}
          />
        </div>

        {/* Start and End Date Side-by-Side */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Start Date</label>
            <input type="date" value={formData.commonDetails?.startDate ? formData.commonDetails.startDate.split('T')[0] : ''} onChange={e => handleChange('commonDetails', 'startDate', e.target.value)} disabled={!isEditing} className={inputClass} />
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">End Date</label>
            <input type="date" value={formData.commonDetails?.endDate ? formData.commonDetails.endDate.split('T')[0] : ''} onChange={e => handleChange('commonDetails', 'endDate', e.target.value)} disabled={!isEditing} className={inputClass} />
          </div>
        </div>
        {/* SME Required — placed after End Date, before SME fields */}
        <div>
          <label className="block text-base font-semibold text-gray-800 mb-1">SME Required</label>
          <select value={formData.commonDetails?.smeRequired || 'No'} onChange={e => handleChange('commonDetails', 'smeRequired', e.target.value)} disabled={!isEditing} className={selectClass}>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
        {/* SME Details — shown only when SME is required */}
        {(formData.commonDetails?.smeRequired === 'Yes' || opportunity.commonDetails?.smeRequired === 'Yes') && <React.Fragment>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Assigned SME</label>
            {isEditing ? (
              <select 
                value={typeof formData.selectedSME === 'object' ? (formData.selectedSME?._id || '') : (formData.selectedSME || '')} 
                onChange={e => setFormData({ ...formData, selectedSME: e.target.value })} 
                className={selectClass}
              >
                <option value="">-- Select Recommended SME --</option>
                {loadingSMEs ? <option disabled>Loading recommendations...</option> : 
                  recommendedSMEs.map(sme => (
                    <option key={sme._id} value={sme._id}>
                      {sme.name} ({sme.classification === 'Internal' ? 'Internal' : sme.smeType})
                    </option>
                  ))
                }
                {/* Fallback to show currently assigned SME even if not in recommendations */}
                {formData.selectedSME && typeof formData.selectedSME === 'object' && formData.selectedSME.name && !recommendedSMEs.some(s => s._id === formData.selectedSME._id) && (
                  <option value={formData.selectedSME._id}>
                    {formData.selectedSME.name} (Currently Assigned)
                  </option>
                )}
              </select>
            ) : (
              <div className="p-2 bg-gray-50 rounded border border-gray-200 text-base font-semibold text-gray-800">
                {typeof opportunity.selectedSME === 'object' && opportunity.selectedSME !== null && opportunity.selectedSME?.name ? opportunity.selectedSME.name : 'Not Assigned'}
              </div>
            )}
          </div>

          {/* SME Profile Document */}
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">SME Profile</label>
            <div className={`w-full border p-2 rounded-lg text-base border-gray-500 flex items-center justify-between gap-2 ${!isEditing ? 'bg-gray-100 text-gray-800 cursor-not-allowed' : 'bg-gray-50 text-gray-900 focus-within:ring-2 focus-within:ring-primary-blue'}`}>
              {typeof opportunity.selectedSME === 'object' && opportunity.selectedSME !== null && (opportunity.selectedSME.sme_profile || opportunity.selectedSME.contentUpload) ? <a href={`${API_BASE}/${toPublicPath(opportunity.selectedSME.sme_profile || opportunity.selectedSME.contentUpload)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline font-medium" title="View SME Profile">
                <CheckCircle size={14} /> View
              </a> : <span className="text-sm text-gray-400 italic">Not Available</span>}
            </div>
          </div>

          {/* Content Document */}
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-1">Content Document</label>
            <div className={`w-full border p-2 rounded-lg text-base border-gray-500 flex items-center justify-between gap-2 ${!isEditing ? 'bg-gray-100 text-gray-800 cursor-not-allowed' : 'bg-gray-50 text-gray-900 focus-within:ring-2 focus-within:ring-primary-blue'}`}>
              {opportunity.deliveryDocuments?.contentDocument ? <a href={`${API_BASE}/${toPublicPath(opportunity.deliveryDocuments.contentDocument)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline font-medium" title="View Content Document">
                <CheckCircle size={14} /> View
              </a> : <span className="text-sm text-gray-400 italic">Not Uploaded</span>}
            </div>
          </div>
        </React.Fragment>}
      </div>
    </Card>

    {/* Delivery Documents (Read Only for Sales) */}
    <DeliveryDocuments opportunity={opportunity} canEdit={false} handleUpload={() => { }} uploading={false} isSalesView={true} />

  </div>;
});
export default SalesTab;
