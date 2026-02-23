import { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, X } from 'lucide-react';
import UploadButton from '../ui/UploadButton';
import { useToast } from '../../context/ToastContext';
import { validateMobile, validateEmail, validatePAN, validateGST, validateBankAccount, validateIFSC } from '../../utils/validation';
import { API_BASE } from '../../config/api';
import IntlPhoneField from '../form/IntlPhoneField';
const AddSMEModal = ({
  isOpen,
  onClose,
  onSuccess,
  smeToEdit = null
}) => {
  const {
    addToast
  } = useToast();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState({
    sowDocument: null,
    ndaDocument: null,
    sme_profile: null,
    idProof: null,
    panDocument: null,
    gstDocument: null
  });
  const initialFormState = {
    smeType: 'Company',
    companyName: '',
    companyContactNumber: '',
    companyContactPerson: '',
    companyLocation: '',
    companyAddress: '',
    name: '',
    email: '',
    contactNumber: '',
    location: '',
    technology: '',
    yearsExperience: '',
    address: '',
    bankDetails: {
      bankName: '',
      branchName: '',
      accountNumber: '',
      accountHolderName: '',
      ifscCode: ''
    },
    gstNo: '',
    panNo: ''
  };
  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const toPublicPath = p => {
    const normalized = String(p || '').replace(/\\/g, '/');
    const uploadsIndex = normalized.toLowerCase().indexOf('/uploads/');
    if (uploadsIndex >= 0) {
      return normalized.slice(uploadsIndex + 1);
    }
    return normalized.replace(/^\/+/, '');
  };
  const getExistingDocPath = docName => {
    if (!smeToEdit) return '';
    if (docName === 'sme_profile') return smeToEdit?.sme_profile || smeToEdit?.contentUpload || '';
    return smeToEdit?.[docName] || '';
  };
  useEffect(() => {
    if (isOpen) {
      if (smeToEdit) {
        setFormData({
          smeType: smeToEdit.smeType || (smeToEdit.companyVendor ? 'Company' : 'Freelancer'),
          companyName: smeToEdit.companyName || '',
          companyContactNumber: smeToEdit.companyContactNumber || '',
          companyContactPerson: smeToEdit.companyContactPerson || '',
          companyLocation: smeToEdit.companyLocation || '',
          companyAddress: smeToEdit.companyAddress || '',
          name: smeToEdit.name || '',
          email: smeToEdit.email || '',
          contactNumber: smeToEdit.contactNumber || '',
          location: smeToEdit.location || '',
          technology: smeToEdit.technology || '',
          yearsExperience: smeToEdit.yearsExperience || '',
          address: smeToEdit.address || '',
          bankDetails: smeToEdit.bankDetails || initialFormState.bankDetails,
          gstNo: smeToEdit.gstNo && smeToEdit.gstNo !== 'Pending' ? smeToEdit.gstNo : '',
          panNo: smeToEdit.panNo && smeToEdit.panNo !== 'Pending' ? smeToEdit.panNo : ''
        });
      } else {
        setFormData(initialFormState);
      }
      setErrors({});
      setFiles({
        sowDocument: null,
        ndaDocument: null,
        sme_profile: null,
        idProof: null,
        panDocument: null,
        gstDocument: null
      });
    }
  }, [isOpen, smeToEdit]);
  const handleInputChange = e => {
    const {
      name,
      value
    } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
      let error = '';
      if (name === 'bankDetails.accountNumber') {
        const {
          valid,
          message
        } = validateBankAccount(value);
        if (!valid && value) error = message;
      } else if (name === 'bankDetails.ifscCode') {
        const {
          valid,
          message
        } = validateIFSC(value);
        if (!valid && value) error = message;
      }
      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
      let error = '';
      if (name === 'contactNumber' || name === 'companyContactNumber') {
        const {
          valid,
          message
        } = validateMobile(value);
        if (!valid && value.length > 0) error = message;
      } else if (name === 'email') {
        const {
          valid,
          message
        } = validateEmail(value);
        if (!valid && value) error = message;
      } else if (name === 'gstNo') {
        const {
          valid,
          message
        } = validateGST(value);
        if (!valid && value) error = message;
      } else if (name === 'panNo') {
        const {
          valid,
          message
        } = validatePAN(value);
        if (!valid && value) error = message;
      }
      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  };
  const handleFileChange = e => {
    setFiles(prev => ({
      ...prev,
      [e.target.name]: e.target.files[0]
    }));
  };
  const handleSubmit = async e => {
    e.preventDefault();

    // Validations
    if (formData.smeType === 'Freelancer') {
      if (!formData.contactNumber) return addToast('SME Contact Number is required for Freelancers', 'error');
      if (!formData.email) return addToast('Email is required for Freelancers', 'error');
    }
    if (formData.contactNumber) {
      const {
        valid,
        message
      } = validateMobile(formData.contactNumber);
      if (!valid) return addToast(`SME Contact: ${message}`, 'error');
    }
    if (formData.smeType === 'Company') {
      const {
        valid,
        message
      } = validateMobile(formData.companyContactNumber);
      if (!valid) return addToast(`Company Contact: ${message}`, 'error');
    }
    if (formData.email) {
      const {
        valid,
        message
      } = validateEmail(formData.email);
      if (!valid) return addToast(message, 'error');
    }

    // Bank Validation
    if (formData.bankDetails.accountNumber) {
      const {
        valid,
        message
      } = validateBankAccount(formData.bankDetails.accountNumber);
      if (!valid) return addToast(message, 'error');
    }
    if (formData.bankDetails.ifscCode) {
      const {
        valid,
        message
      } = validateIFSC(formData.bankDetails.ifscCode);
      if (!valid) return addToast(message, 'error');
    }

    // Tax Validation
    if (formData.panNo) {
      const {
        valid,
        message
      } = validatePAN(formData.panNo);
      if (!valid) return addToast(message, 'error');
    }
    if (formData.gstNo) {
      const {
        valid,
        message
      } = validateGST(formData.gstNo);
      if (!valid) return addToast(message, 'error');
    }
    setLoading(true);
    const data = new FormData();
    Object.keys(formData).forEach(key => {
      if (key === 'bankDetails') {
        data.append('bankDetails', JSON.stringify(formData.bankDetails));
      } else if (key === 'yearsExperience') {
        data.append('yearsExperience', Number(formData.yearsExperience || 0));
      } else {
        data.append(key, formData[key]);
      }
    });
    Object.keys(files).forEach(key => {
      if (files[key]) {
        data.append(key, files[key]);
      }
    });

    // Backward compatibility: older SME docs may still have `contentUpload`
    // in DB instead of `sme_profile`. Preserve it during edit when no new file is selected.
    if (
      smeToEdit &&
      !files.sme_profile &&
      !smeToEdit?.sme_profile &&
      smeToEdit?.contentUpload
    ) {
      data.append('sme_profile', smeToEdit.contentUpload);
    }
    try {
      const token = sessionStorage.getItem('token');
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      };
      let res;
      if (smeToEdit) {
        res = await axios.put(`${API_BASE}/api/smes/${smeToEdit._id}`, data, config);
        addToast('SME updated successfully!', 'success');
      } else {
        res = await axios.post(`${API_BASE}/api/smes`, data, config);
        addToast('SME created successfully!', 'success');
      }
      onSuccess(res.data);
      onClose();
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.message || 'Error saving SME', 'error');
    } finally {
      setLoading(false);
    }
  };
  if (!isOpen) return null;
  return <div className="fixed inset-0 bg-gray-500/20 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-100">
                <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-gray-900">{smeToEdit ? 'Edit SME' : 'Add New SME'}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6">
                    <form onSubmit={handleSubmit}>
                        {/* Type Selection */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">SME Type</label>
                            <div className="flex gap-4">
                                <label className={`flex items-center space-x-2 cursor-pointer border p-3 rounded-lg w-32 justify-center transition-colors ${formData.smeType === 'Company' ? 'bg-blue-50 border-brand-blue text-brand-blue' : 'hover:bg-gray-50'}`}>
                                    <input type="radio" name="smeType" value="Company" checked={formData.smeType === 'Company'} onChange={handleInputChange} disabled={!!smeToEdit} className="text-brand-blue focus:ring-brand-blue" />
                                    <span className="font-medium">Company</span>
                                </label>
                                <label className={`flex items-center space-x-2 cursor-pointer border p-3 rounded-lg w-32 justify-center transition-colors ${formData.smeType === 'Freelancer' ? 'bg-blue-50 border-brand-blue text-brand-blue' : 'hover:bg-gray-50'}`}>
                                    <input type="radio" name="smeType" value="Freelancer" checked={formData.smeType === 'Freelancer'} onChange={handleInputChange} disabled={!!smeToEdit} className="text-brand-blue focus:ring-brand-blue" />
                                    <span className="font-medium">Freelancer</span>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* Company Specific Section */}
                            {formData.smeType === 'Company' && <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                    <h3 className="font-semibold text-blue-900 mb-4">Company Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <input name="companyName" value={formData.companyName} onChange={handleInputChange} placeholder="Company Name *" className="border p-2 rounded text-sm w-full" required />
                                        <div className="relative">
                                            <IntlPhoneField
                                              value={formData.companyContactNumber}
                                              onChange={value => handleInputChange({
                                                target: {
                                                  name: 'companyContactNumber',
                                                  value
                                                }
                                              })}
                                              required
                                              containerClass="w-full"
                                              inputClass={`!w-full !pl-14 focus:!ring-2 focus:!ring-primary-blue ${errors.companyContactNumber ? '!ring-1 !ring-red-500' : ''}`}
                                            />
                                            {errors.companyContactNumber && <div className="absolute top-full left-0 mt-1 z-10 bg-red-100 text-red-600 text-xs px-2 py-1 rounded shadow-md border border-red-200">{errors.companyContactNumber}</div>}
                                        </div>
                                        <input name="companyContactPerson" value={formData.companyContactPerson} onChange={handleInputChange} placeholder="Contact Person Name *" className="border p-2 rounded text-sm w-full" required />
                                        <input name="companyLocation" value={formData.companyLocation} onChange={handleInputChange} placeholder="Company Location *" className="border p-2 rounded text-sm w-full" required />
                                        <textarea name="companyAddress" value={formData.companyAddress} onChange={handleInputChange} placeholder="Company Address *" className="border p-2 rounded text-sm w-full md:col-span-2" rows="2" required />
                                    </div>
                                </div>}

                            {/* Section A: Basic Details */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">A. Basic Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <input name="name" value={formData.name} onChange={handleInputChange} placeholder="SME Name *" className="border p-2 rounded text-sm w-full" required />
                                    <div className="relative">
                                        <input name="email" value={formData.email} onChange={handleInputChange} placeholder={formData.smeType === 'Freelancer' ? "Email *" : "Email"} type="email" className={`border p-2 rounded text-sm w-full ${errors.email ? 'border-red-500' : ''}`} />
                                        {errors.email && <div className="absolute top-full left-0 mt-1 z-10 bg-red-100 text-red-600 text-xs px-2 py-1 rounded shadow-md border border-red-200">{errors.email}</div>}
                                    </div>
                                    <div className="relative">
                                        <IntlPhoneField
                                          value={formData.contactNumber}
                                          onChange={value => handleInputChange({
                                            target: {
                                              name: 'contactNumber',
                                              value
                                            }
                                          })}
                                          required={formData.smeType === 'Freelancer'}
                                          containerClass="w-full"
                                          inputClass={`!w-full !pl-14 focus:!ring-2 focus:!ring-primary-blue ${errors.contactNumber ? '!ring-1 !ring-red-500' : ''}`}
                                        />
                                        {errors.contactNumber && <div className="absolute top-full left-0 mt-1 z-10 bg-red-100 text-red-600 text-xs px-2 py-1 rounded shadow-md border border-red-200">{errors.contactNumber}</div>}
                                    </div>
                                    <input name="technology" value={formData.technology} onChange={handleInputChange} placeholder="Technology *" className="border p-2 rounded text-sm w-full" required />
                                    <div className="relative">
                                        <input name="yearsExperience" value={formData.yearsExperience} onChange={handleInputChange} onWheel={e => e.target.blur()} placeholder="Years Experience *" type="number" className="border p-2 rounded text-sm w-full no-arrows" required />
                                    </div>
                                    <input name="location" value={formData.location} onChange={handleInputChange} placeholder="Location *" className="border p-2 rounded text-sm w-full" required />
                                    {formData.smeType === 'Freelancer' && <textarea name="address" value={formData.address} onChange={handleInputChange} placeholder="Address *" className="border p-2 rounded text-sm w-full md:col-span-3" rows="2" required />}
                                </div>
                            </div>

                            {/* Section B: Bank Details */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">B. Bank Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <input name="bankDetails.bankName" value={formData.bankDetails.bankName} onChange={handleInputChange} placeholder="Bank Name *" className="border p-2 rounded text-sm w-full" required />
                                    <input name="bankDetails.branchName" value={formData.bankDetails.branchName} onChange={handleInputChange} placeholder="Branch Name *" className="border p-2 rounded text-sm w-full" required />
                                    <div className="relative">
                                        <input name="bankDetails.accountNumber" value={formData.bankDetails.accountNumber} onChange={handleInputChange} placeholder="Account Number *" className={`border p-2 rounded text-sm w-full ${errors['bankDetails.accountNumber'] ? 'border-red-500' : ''}`} required />
                                        {errors['bankDetails.accountNumber'] && <div className="absolute top-full left-0 mt-1 z-10 bg-red-100 text-red-600 text-xs px-2 py-1 rounded shadow-md border border-red-200">{errors['bankDetails.accountNumber']}</div>}
                                    </div>
                                    <input name="bankDetails.accountHolderName" value={formData.bankDetails.accountHolderName} onChange={handleInputChange} placeholder="Account Holder Name *" className="border p-2 rounded text-sm w-full" required />
                                    <div className="relative">
                                        <input name="bankDetails.ifscCode" value={formData.bankDetails.ifscCode} onChange={handleInputChange} placeholder="IFSC Code *" className={`border p-2 rounded text-sm w-full ${errors['bankDetails.ifscCode'] ? 'border-red-500' : ''}`} required />
                                        {errors['bankDetails.ifscCode'] && <div className="absolute top-full left-0 mt-1 z-10 bg-red-100 text-red-600 text-xs px-2 py-1 rounded shadow-md border border-red-200">{errors['bankDetails.ifscCode']}</div>}
                                    </div>
                                </div>
                            </div>

                            {/* Section C: Tax Details */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">C. Tax Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="relative">
                                            <input name="gstNo" value={formData.gstNo} onChange={handleInputChange} placeholder="GST Number *" className={`border p-2 rounded text-sm w-full mb-2 ${errors.gstNo ? 'border-red-500' : ''}`} required />
                                            {errors.gstNo && <div className="absolute top-full left-0 mt-1 z-10 bg-red-100 text-red-600 text-xs px-2 py-1 rounded shadow-md border border-red-200">{errors.gstNo}</div>}
                                            <label className="block text-xs text-gray-500 mb-1">GST Document *</label>
                                            <div className="flex flex-col gap-2">
                                                <input type="file" id="upload-gst" name="gstDocument" onChange={handleFileChange} className="hidden" accept=".pdf,.jpg,.png" />
                                                <div className="flex items-center gap-2">
                                                    <UploadButton onClick={() => document.getElementById('upload-gst').click()} type="button" size="sm">
                                                        {files.gstDocument ? 'Selected' : smeToEdit?.gstDocument ? 'Replace' : 'Upload'}
                                                    </UploadButton>
                                                    {!!smeToEdit?.gstDocument && <a href={`${API_BASE}/${toPublicPath(smeToEdit.gstDocument)}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 transition-transform hover:scale-110" title="View GST Document">
                                                        <Eye size={16} />
                                                    </a>}
                                                    {files.gstDocument && <span className="text-xs text-green-600 truncate max-w-[150px]">{files.gstDocument.name}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="relative">
                                            <input name="panNo" value={formData.panNo} onChange={handleInputChange} placeholder="PAN Number *" className={`border p-2 rounded text-sm w-full mb-2 ${errors.panNo ? 'border-red-500' : ''}`} required />
                                            {errors.panNo && <div className="absolute top-full left-0 mt-1 z-10 bg-red-100 text-red-600 text-xs px-2 py-1 rounded shadow-md border border-red-200">{errors.panNo}</div>}
                                            <label className="block text-xs text-gray-500 mb-1">PAN Card *</label>
                                            <div className="flex flex-col gap-2">
                                                <input type="file" id="upload-pan" name="panDocument" onChange={handleFileChange} className="hidden" accept=".pdf,.jpg,.png" />
                                                <div className="flex items-center gap-2">
                                                    <UploadButton onClick={() => document.getElementById('upload-pan').click()} type="button" size="sm">
                                                        {files.panDocument ? 'Selected' : smeToEdit?.panDocument ? 'Replace' : 'Upload'}
                                                    </UploadButton>
                                                    {!!smeToEdit?.panDocument && <a href={`${API_BASE}/${toPublicPath(smeToEdit.panDocument)}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 transition-transform hover:scale-110" title="View PAN Document">
                                                        <Eye size={16} />
                                                    </a>}
                                                    {files.panDocument && <span className="text-xs text-green-600 truncate max-w-[150px]">{files.panDocument.name}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section D: Documents */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">D. Documents</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    {[{
                  id: 'upload-sow',
                  name: 'sowDocument',
                  label: 'SOW Document *',
                  accept: '.pdf,.doc,.docx'
                }, {
                  id: 'upload-nda',
                  name: 'ndaDocument',
                  label: 'NDA Document *',
                  accept: '.pdf,.doc,.docx'
                }, {
                  id: 'upload-profile',
                  name: 'sme_profile',
                  label: 'SME Profile *',
                  accept: '.pdf,.doc,.docx'
                }, {
                  id: 'upload-idproof',
                  name: 'idProof',
                  label: 'ID Proof (Optional)',
                  accept: '.pdf,.jpg,.png'
                }].map(doc => <div key={doc.id} className="border p-3 rounded bg-gray-50">
                                            <label className="block text-sm font-medium mb-1">{doc.label}</label>
                                            <div className="flex flex-col gap-2">
                                                <input type="file" id={doc.id} name={doc.name} onChange={handleFileChange} className="hidden" accept={doc.accept} />
                                                <div className="flex items-center gap-2">
                                                    <UploadButton onClick={() => document.getElementById(doc.id).click()} type="button" size="sm">
                                                        {files[doc.name]
                  ? 'Selected'
                  : smeToEdit?.[doc.name] || (doc.name === 'sme_profile' && smeToEdit?.contentUpload)
                    ? 'Replace'
                    : 'Upload'}
                                                    </UploadButton>
                                                    {!!getExistingDocPath(doc.name) && <a href={`${API_BASE}/${toPublicPath(getExistingDocPath(doc.name))}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 transition-transform hover:scale-110" title={`View ${doc.label}`}>
                                                        <Eye size={16} />
                                                    </a>}
                                                    {files[doc.name] && <span className="text-xs text-green-600 truncate max-w-[100px]">{files[doc.name].name}</span>}
                                                </div>
                                            </div>
                                        </div>)}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="sticky bottom-0 bg-white pt-4 pb-0 mt-8 border-t border-gray-200 flex justify-end gap-3 z-10">
                            <button type="button" onClick={onClose} className="px-5 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors">Cancel</button>
                            <button type="submit" disabled={loading} className="px-5 py-2 bg-brand-blue text-white rounded hover:bg-opacity-90 font-medium transition-colors disabled:opacity-50">
                                {loading ? 'Saving...' : smeToEdit ? 'Update SME' : 'Create SME'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>;
};
export default AddSMEModal;
