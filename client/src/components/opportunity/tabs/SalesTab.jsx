import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import { CheckCircle, FileText, MoreHorizontal } from 'lucide-react';
import Card from '../../ui/Card';
import { useToast } from '../../../context/ToastContext';
import SearchableSelect from '../../ui/SearchableSelect';
import DeliveryDocuments from '../sections/DeliveryDocuments';
import { getTechnologyOptions } from '../../../utils/TechnologyConstants';
import { API_BASE } from '../../../config/api';
const SalesTab = forwardRef(({
  opportunity,
  isEditing,
  refreshData,
  user
}, ref) => {
  const {
    addToast
  } = useToast();
  const [, setUploading] = useState(false);
  const [formData, setFormData] = useState({});

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
        }
      });
    }
  }, [opportunity]);

  // Expose handleSave to parent
  useImperativeHandle(ref, () => ({
    handleSave: async () => {
      try {
        // Mandatory SOW Check Removed

        const token = localStorage.getItem('token');

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
        const payload = {
          commonDetails: sanitizedCommonDetails,
          expenses: sanitizedExpenses,
          typeSpecificDetails: sanitizedTypeSpecificDetails,
          participants: formData.participants,
          days: formData.days,
          requirementSummary: formData.requirementSummary
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
          } else if (gp < 10) {
            addToast('Low GP (<10%). Requires Director Approval.', 'warning');
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
        }
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
      if (section === 'commonDetails' && (field === 'tovRate' || field === 'tovUnit')) {
        const rate = field === 'tovRate' ? parseFloat(value) || 0 : newState.commonDetails.tovRate || 0;
        const unit = field === 'tovUnit' ? value : newState.commonDetails.tovUnit || 'Fixed';
        let calculatedTov = rate;
        if (unit === 'Per Day') calculatedTov = rate * (newState.days || 1);else if (unit === 'Per Participant') calculatedTov = rate * (newState.participants || 1);
        newState.commonDetails.tov = calculatedTov;
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

          // Only auto-update if user hasn't manually set end date
          // (We check if end date is empty or matches previous auto-calculation)
          if (!newState.commonDetails) {
            newState.commonDetails = {};
          }
          newState.commonDetails.endDate = end.toISOString().split('T')[0];
        }
      }
      return newState;
    });
  };

  // handleFileUpload removed
  async e => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const uploadFormData = new FormData();
      uploadFormData.append('sow', file);
      await axios.post(`${API_BASE}/api/opportunities/${opportunity._id}/upload-sow`, uploadFormData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      addToast('SOW uploaded successfully', 'success');
      refreshData();
    } catch (error) {
      console.error('Upload failed', error);
      addToast('Failed to upload SOW', 'error');
    } finally {
      setUploading(false);
    }
  };
  const inputClass = `w-full border p-2 rounded-lg text-sm ${!isEditing ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50 border-gray-200 focus:ring-2 focus:ring-primary-blue'}`;
  const selectClass = `w-full border p-2 rounded-lg text-sm ${!isEditing ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50 border-gray-200 focus:ring-2 focus:ring-primary-blue'}`;
  return <div className="space-y-6">
            {/* Basic Details Section - Dynamic based on Opportunity Type */}
            <Card className="!bg-white">
                <h3 className="text-lg font-bold text-primary-blue mb-4">Basic Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Common Fields for All Types */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                        <input type="text" value={opportunity.client?.companyName || 'N/A'} disabled className="w-full border p-2 rounded-lg text-sm bg-gray-100 text-gray-700 cursor-not-allowed" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Opportunity Type</label>
                        <input type="text" value={opportunity.type || 'N/A'} disabled className="w-full border p-2 rounded-lg text-sm bg-gray-100 text-gray-700 cursor-not-allowed" />
                    </div>

                    {/* Training-Specific Fields */}
                    {opportunity.type === 'Training' && <>
                            <div className={formData.typeSpecificDetails?.technology?.startsWith('Emerging technologies') || formData.typeSpecificDetails?.technology?.startsWith('Other technologies') ? "col-span-1 grid grid-cols-2 gap-2" : ""}>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Technology *</label>
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
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                {formData.typeSpecificDetails?.technology?.startsWith('Emerging') ? 'Specific Emerging' : 'Specific Technology'}
                                            </label>
                                            <input type="text" value={formData.typeSpecificDetails?.technology?.split(' - ')[1] || ''} onChange={e => {
                const category = formData.typeSpecificDetails?.technology?.split(' - ')[0];
                handleChange('typeSpecificDetails', 'technology', `${category} - ${e.target.value}`);
              }} disabled={!isEditing} className={inputClass} placeholder="Specify..." />
                                        </div>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Training Name/Requirement *</label>
                                <input type="text" value={formData.typeSpecificDetails?.trainingName || ''} onChange={e => handleChange('typeSpecificDetails', 'trainingName', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter Training Name/Requirement" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mode of Training *</label>
                                <select value={formData.typeSpecificDetails?.modeOfTraining || ''} onChange={e => handleChange('typeSpecificDetails', 'modeOfTraining', e.target.value)} disabled={!isEditing} className={selectClass}>
                                    <option value="">-- Select Mode --</option>
                                    <option value="Virtual">Virtual</option>
                                    <option value="Classroom">Classroom</option>
                                    <option value="Hybrid">Hybrid</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Participants *</label>
                                <input type="number" value={formData.participants || ''} onChange={e => handleChange('root', 'participants', parseInt(e.target.value) || 0)} onWheel={e => e.target.blur()} disabled={!isEditing} className={`${inputClass} no-arrows`} placeholder="0" />
                            </div>
                            {(formData.typeSpecificDetails?.modeOfTraining === 'Classroom' || formData.typeSpecificDetails?.modeOfTraining === 'Hybrid') && <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Training Location *</label>
                                    <input type="text" value={formData.typeSpecificDetails?.trainingLocation || ''} onChange={e => handleChange('typeSpecificDetails', 'trainingLocation', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter Location" />
                                </div>}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Requirement Summary *</label>
                                <input type="text" value={formData.requirementSummary || ''} onChange={e => handleChange('root', 'requirementSummary', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter requirement summary" />
                            </div>
                        </>}

                    {/* Vouchers-Specific Fields */}
                    {opportunity.type === 'Vouchers' && <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Technology *</label>
                                <SearchableSelect value={formData.typeSpecificDetails?.technology || ''} onChange={e => handleChange('typeSpecificDetails', 'technology', e.target.value)} options={getTechnologyOptions()} placeholder="Select or type technology" disabled={!isEditing} className={selectClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Exam Details *</label>
                                <input type="text" value={formData.typeSpecificDetails?.examDetails || ''} onChange={e => handleChange('typeSpecificDetails', 'examDetails', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter Exam Details" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">No of Vouchers *</label>
                                <input type="number" value={formData.typeSpecificDetails?.numberOfVouchers || ''} onChange={e => handleChange('typeSpecificDetails', 'numberOfVouchers', parseInt(e.target.value) || 0)} disabled={!isEditing} className={inputClass} placeholder="0" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Exam Location *</label>
                                <input type="text" value={formData.typeSpecificDetails?.examLocation || ''} onChange={e => handleChange('typeSpecificDetails', 'examLocation', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter Exam Location" />
                            </div>
                        </>}

                    {/* Lab Support-Specific Fields */}
                    {opportunity.type === 'Lab Support' && <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Technology *</label>
                                <SearchableSelect value={formData.typeSpecificDetails?.technology || ''} onChange={e => handleChange('typeSpecificDetails', 'technology', e.target.value)} options={getTechnologyOptions()} placeholder="Select or type technology" disabled={!isEditing} className={selectClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Requirement *</label>
                                <input type="text" value={formData.typeSpecificDetails?.labRequirement || ''} onChange={e => handleChange('typeSpecificDetails', 'labRequirement', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter Requirement" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">No of IDs *</label>
                                <input type="number" value={formData.typeSpecificDetails?.numberOfIDs || ''} onChange={e => handleChange('typeSpecificDetails', 'numberOfIDs', parseInt(e.target.value) || 0)} disabled={!isEditing} className={inputClass} placeholder="0" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duration *</label>
                                <input type="text" value={formData.typeSpecificDetails?.duration || ''} onChange={e => handleChange('typeSpecificDetails', 'duration', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="e.g., 30 days, 6 months" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Region *</label>
                                <input type="text" value={formData.typeSpecificDetails?.region || ''} onChange={e => handleChange('typeSpecificDetails', 'region', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter Region" />
                            </div>
                        </>}

                    {/* Resource Support-Specific Fields */}
                    {opportunity.type === 'Resource Support' && <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Resource Type *</label>
                                <input type="text" value={formData.typeSpecificDetails?.resourceType || ''} onChange={e => handleChange('typeSpecificDetails', 'resourceType', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="e.g., Trainer, Consultant" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Resource Count *</label>
                                <input type="number" value={formData.typeSpecificDetails?.resourceCount || ''} onChange={e => handleChange('typeSpecificDetails', 'resourceCount', parseInt(e.target.value) || 0)} disabled={!isEditing} className={inputClass} placeholder="0" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Requirement Summary *</label>
                                <input type="text" value={formData.requirementSummary || ''} onChange={e => handleChange('root', 'requirementSummary', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter requirement summary" />
                            </div>
                        </>}

                    {/* Content Development-Specific Fields */}
                    {opportunity.type === 'Content Development' && <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Content Type *</label>
                                <input type="text" value={formData.typeSpecificDetails?.contentType || ''} onChange={e => handleChange('typeSpecificDetails', 'contentType', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="e.g., Course Material" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Format *</label>
                                <input type="text" value={formData.typeSpecificDetails?.deliveryFormat || ''} onChange={e => handleChange('typeSpecificDetails', 'deliveryFormat', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="e.g., PDF, Video" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Requirement Summary *</label>
                                <input type="text" value={formData.requirementSummary || ''} onChange={e => handleChange('root', 'requirementSummary', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter requirement summary" />
                            </div>
                        </>}

                    {/* Product Support-Specific Fields */}
                    {opportunity.type === 'Product Support' && <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project Scope *</label>
                                <input type="text" value={formData.typeSpecificDetails?.projectScope || ''} onChange={e => handleChange('typeSpecificDetails', 'projectScope', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="e.g., Full Stack Development" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Team Size *</label>
                                <input type="number" value={formData.typeSpecificDetails?.teamSize || ''} onChange={e => handleChange('typeSpecificDetails', 'teamSize', parseInt(e.target.value) || 0)} disabled={!isEditing} className={inputClass} placeholder="0" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Requirement Summary *</label>
                                <input type="text" value={formData.requirementSummary || ''} onChange={e => handleChange('root', 'requirementSummary', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter requirement summary" />
                            </div>
                        </>}

                    {/* Requirement/Job Description Document - Common for All */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Requirement Document</label>
                        {opportunity.requirementDocument ? <a href={`${API_BASE}/${opportunity.requirementDocument.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-blue-600 hover:text-blue-800 hover:border-blue-300 transition-colors" title="View Requirement Document">
                                <FileText size={14} /> View Document
                            </a> : <span className="text-sm text-gray-400 italic p-2 block">Not Uploaded</span>}
                    </div>
                </div>
            </Card>

            {/* Trainer Details Section */}
            <Card className="!bg-white">
                <h3 className="text-lg font-bold text-primary-blue mb-4">Training Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Trainer Support</label>
                        <select value={formData.commonDetails?.trainingSupporter || 'GKT'} onChange={e => handleChange('commonDetails', 'trainingSupporter', e.target.value)} disabled={!isEditing} className={selectClass}>
                            <option value="GKT">GKT</option>
                            <option value="GKCS">GKCS</option>
                            <option value="MCT">MCT</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Course Code</label>
                        <input type="text" value={formData.commonDetails?.courseCode || ''} onChange={e => handleChange('commonDetails', 'courseCode', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter Code" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
                        <input type="text" value={formData.commonDetails?.courseName || ''} onChange={e => handleChange('commonDetails', 'courseName', e.target.value)} disabled={!isEditing} className={inputClass} placeholder="Enter Name" />
                    </div>

                    {/* Month/Year Selection */}
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

                    {/* No. of Days - Smaller visual width (w-1/2) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">No. of Days</label>
                        <input type="number" value={formData.days || ''} onChange={e => handleChange('root', 'days', parseInt(e.target.value) || 0)} disabled={!isEditing} className={`${inputClass} w-2/3`} placeholder="0" />
                    </div>

                    {/* Start and End Date Side-by-Side */}
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
                    {/* SME Details Merged into Trainer Details */}
                    {(formData.selectedSME || formData.commonDetails?.trainingSupporter) && <React.Fragment>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned SME</label>
                                <div className="p-2 bg-gray-50 rounded border border-gray-200 text-sm font-medium text-gray-800">
                                    {typeof opportunity.selectedSME === 'object' ? opportunity.selectedSME.name : 'Not Assigned'}
                                </div>
                            </div>

                            {/* Profile Document (from SME Details) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">SME Profile</label>
                                {typeof opportunity.selectedSME === 'object' && (opportunity.selectedSME.sme_profile || opportunity.selectedSME.contentUpload) ? <a href={`${API_BASE}/${(opportunity.selectedSME.sme_profile || opportunity.selectedSME.contentUpload).replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-purple-600 hover:text-purple-800 hover:border-purple-300 transition-colors" title="View SME Profile">
                                        <CheckCircle size={14} /> View Profile
                                    </a> : <span className="text-sm text-gray-400 italic p-2 block">Not Available</span>}
                            </div>
                        </React.Fragment>}
                </div>
            </Card>

            {/* Delivery Documents (Read Only for Sales) */}
            <DeliveryDocuments opportunity={opportunity} canEdit={false} handleUpload={() => {}} uploading={false} isSalesView={true} />

        </div>;
});
export default SalesTab;
