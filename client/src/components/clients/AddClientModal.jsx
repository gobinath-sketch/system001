import { useState } from 'react';
import axios from 'axios';
import { X, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { validateMobile, validateEmail } from '../../utils/validation';
import { API_BASE } from '../../config/api';
import IntlPhoneField from '../form/IntlPhoneField';
const AddClientModal = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const {
    addToast
  } = useToast();
  const [loading, setLoading] = useState(false);
  const initialFormState = {
    companyName: '',
    sector: 'Enterprise',
    contactPersons: [{
      name: '',
      designation: '',
      department: '',
      contactNumber: '',
      email: '',
      location: '',
      linkedIn: '',
      isPrimary: true,
      reportingManager: {
        name: '',
        designation: '',
        contactNumber: '',
        email: ''
      }
    }]
  };
  const [formData, setFormData] = useState(initialFormState);
  const handleChange = e => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };
  const handleContactChange = (index, field, value) => {
    const newContacts = [...formData.contactPersons];
    newContacts[index][field] = value;
    setFormData({
      ...formData,
      contactPersons: newContacts
    });
  };
  const handleReportingManagerChange = (index, field, value) => {
    const newContacts = [...formData.contactPersons];
    newContacts[index].reportingManager[field] = value;
    setFormData({
      ...formData,
      contactPersons: newContacts
    });
  };
  const addContactPerson = () => {
    setFormData({
      ...formData,
      contactPersons: [...formData.contactPersons, {
        name: '',
        designation: '',
        department: '',
        contactNumber: '',
        email: '',
        location: '',
        linkedIn: '',
        isPrimary: false,
        reportingManager: {
          name: '',
          designation: '',
          contactNumber: '',
          email: ''
        }
      }]
    });
  };
  const removeContactPerson = index => {
    if (formData.contactPersons.length > 1) {
      const newContacts = formData.contactPersons.filter((_, i) => i !== index);
      setFormData({
        ...formData,
        contactPersons: newContacts
      });
    }
  };
  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);

    // Validate all contact persons
    for (let i = 0; i < formData.contactPersons.length; i++) {
      const contact = formData.contactPersons[i];

      // Validate mobile
      const mobileValidation = validateMobile(contact.contactNumber);
      if (!mobileValidation.valid) {
        addToast(`Contact ${i + 1}: ${mobileValidation.message}`, 'error');
        setLoading(false);
        return;
      }

      // Validate email
      const emailValidation = validateEmail(contact.email);
      if (!emailValidation.valid) {
        addToast(`Contact ${i + 1}: ${emailValidation.message}`, 'error');
        setLoading(false);
        return;
      }

      // Validate reporting manager if exists
      if (contact.reportingManager?.contactNumber) {
        const rmMobileValidation = validateMobile(contact.reportingManager.contactNumber);
        if (!rmMobileValidation.valid) {
          addToast(`Contact ${i + 1} Reporting Manager: ${rmMobileValidation.message}`, 'error');
          setLoading(false);
          return;
        }
      }
      if (contact.reportingManager?.email) {
        const rmEmailValidation = validateEmail(contact.reportingManager.email);
        if (!rmEmailValidation.valid) {
          addToast(`Contact ${i + 1} Reporting Manager: ${rmEmailValidation.message}`, 'error');
          setLoading(false);
          return;
        }
      }
    }
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.post(`${API_BASE}/api/clients`, formData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      addToast('Client created successfully', 'success');
      setFormData(initialFormState);
      if (onSuccess) onSuccess(res.data);
      onClose();
    } catch (err) {
      console.error('Error saving client:', err);
      const errorMessage = err.response?.data?.message || err.message;
      addToast(`Error saving client: ${errorMessage}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  if (!isOpen) return null;
  return <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8 relative flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 sm:p-6 border-b sticky top-0 bg-white rounded-t-lg z-10">
                    <h2 className="text-xl font-semibold text-brand-blue">Add New Client</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-3 sm:p-6 overflow-y-auto">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Company Name <span className="text-red-500">*</span>
                                </label>
                                <input name="companyName" value={formData.companyName} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="Enter company name" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Sector <span className="text-red-500">*</span>
                                </label>
                                <select name="sector" value={formData.sector} onChange={handleChange} className="w-full border p-2 rounded" required>
                                    <option value="Enterprise">Enterprise</option>
                                    <optgroup label="Academics">
                                        <option value="Academics - College">College</option>
                                        <option value="Academics - Universities">Universities</option>
                                    </optgroup>
                                    <option value="School">School</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">Contact Persons</h3>
                                <button type="button" onClick={addContactPerson} className="text-brand-blue text-sm font-medium hover:underline flex items-center gap-1">
                                    <Plus size={16} /> Add Another Contact
                                </button>
                            </div>

                            {formData.contactPersons.map((contact, index) => <div key={index} className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100 relative">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-medium text-gray-900">
                                            Contact Person {index + 1}
                                            {contact.isPrimary && <span className="ml-2 text-xs bg-brand-gold text-white px-2 py-1 rounded">Primary</span>}
                                        </h4>
                                        {formData.contactPersons.length > 1 && <button type="button" onClick={() => removeContactPerson(index)} className="text-red-500 hover:text-red-700">
                                                <Trash2 size={16} />
                                            </button>}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
                                            <input value={contact.name} onChange={e => handleContactChange(index, 'name', e.target.value)} className="w-full bg-white border border-gray-200 p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-blue" required />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Designation</label>
                                            <input value={contact.designation} onChange={e => handleContactChange(index, 'designation', e.target.value)} className="w-full bg-white border border-gray-200 p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-blue" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Department</label>
                                            <input value={contact.department} onChange={e => handleContactChange(index, 'department', e.target.value)} className="w-full bg-white border border-gray-200 p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="e.g. HR, IT" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Contact Number <span className="text-red-500">*</span></label>
                                            <IntlPhoneField
                                              value={contact.contactNumber}
                                              onChange={value => handleContactChange(index, 'contactNumber', value)}
                                              required
                                              containerClass="w-full"
                                              inputClass="!w-full !h-[42px] !bg-white !border !border-gray-200 !rounded !pl-14 !text-sm focus:!ring-2 focus:!ring-primary-blue focus:!border-primary-blue"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
                                            <input type="email" value={contact.email} onChange={e => handleContactChange(index, 'email', e.target.value)} className="w-full bg-white border border-gray-200 p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-blue" required />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Location <span className="text-red-500">*</span></label>
                                            <input value={contact.location} onChange={e => handleContactChange(index, 'location', e.target.value)} className="w-full bg-white border border-gray-200 p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="City, State" required />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">LinkedIn</label>
                                            <input value={contact.linkedIn} onChange={e => handleContactChange(index, 'linkedIn', e.target.value)} placeholder="https://linkedin.com/in/..." className="w-full bg-white border border-gray-200 p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-blue" />
                                        </div>
                                    </div>

                                    <details className="mt-3">
                                        <summary className="text-xs text-gray-600 cursor-pointer hover:text-brand-blue">+ Add Reporting Manager (Optional)</summary>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pl-4 border-l-2 border-gray-200">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Manager Name</label>
                                                <input value={contact.reportingManager.name} onChange={e => handleReportingManagerChange(index, 'name', e.target.value)} className="w-full border p-2 rounded text-sm bg-white" />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Designation</label>
                                                <input value={contact.reportingManager.designation} onChange={e => handleReportingManagerChange(index, 'designation', e.target.value)} className="w-full border p-2 rounded text-sm bg-white" />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Contact</label>
                                                <IntlPhoneField
                                                  value={contact.reportingManager.contactNumber}
                                                  onChange={value => handleReportingManagerChange(index, 'contactNumber', value)}
                                                  containerClass="w-full"
                                                  inputClass="!w-full !h-[38px] !bg-white !border !border-gray-200 !rounded !pl-14 !text-sm focus:!ring-2 focus:!ring-primary-blue focus:!border-primary-blue"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Email</label>
                                                <input value={contact.reportingManager.email} onChange={e => handleReportingManagerChange(index, 'email', e.target.value)} className="w-full border p-2 rounded text-sm bg-white" />
                                            </div>
                                        </div>
                                    </details>
                                </div>)}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 sm:space-x-4 pt-4 border-t sticky bottom-0 bg-white">
                            <button type="submit" disabled={loading} className="bg-brand-blue text-white px-6 py-2 rounded-lg hover:bg-opacity-90 flex-1 md:flex-none disabled:bg-gray-400">
                                {loading ? 'Creating...' : 'Create Client'}
                            </button>
                            <button type="button" onClick={onClose} className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 flex-1 md:flex-none">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>;
};
export default AddClientModal;
