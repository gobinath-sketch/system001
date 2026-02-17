import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Edit, Search, Filter, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { validateMobile, validateEmail } from '../utils/validation';

const ClientPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { addToast } = useToast();
    const [clients, setClients] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list', 'details'
    const [showFormModal, setShowFormModal] = useState(false);

    useEffect(() => {
        if (location.state?.mode === 'create') {
            resetForm();
            setShowFormModal(true);
            setViewMode('list');
        } else {
            // Reset to list view if no specific state provided (e.g. sidebar navigation)
            setViewMode('list');
            setSelectedClient(null);
            setShowFormModal(false);
        }
    }, [location]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [selectedContact, setSelectedContact] = useState(null); // For contact detail modal
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCreator, setFilterCreator] = useState('');
    const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
    const [duplicateClientData, setDuplicateClientData] = useState(null);

    const checkDuplicate = async (name) => {
        // Skip check if empty or if we are editing the same client and name hasn't changed (case insensitive)
        if (!name) return;
        if (selectedClient && selectedClient.companyName.toLowerCase() === name.toLowerCase()) return;

        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`http://localhost:5000/api/clients/check-duplicate?name=${encodeURIComponent(name)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.exists) {
                setDuplicateClientData(res.data.client);
                setShowDuplicateWarning(true);
            }
        } catch (err) {
            console.error('Error checking duplicate:', err);
        }
    };


    const [formData, setFormData] = useState({
        companyName: '',
        sector: 'Enterprise', // Changed from Corporate
        contactPersons: [{
            name: '',
            designation: '',
            department: '', // New Field
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
    });

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/clients', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setClients(res.data);
        } catch (err) {
            console.error('Error fetching clients:', err);
            addToast('Failed to load clients. Please try again.', 'error');
        }
    };

    // --- Form Handlers ---
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleContactChange = (index, field, value) => {
        if (field === 'contactNumber') {
            if (!/^\d*$/.test(value)) return;
            if (value.length > 10) return;
        }
        const newContacts = [...formData.contactPersons];
        newContacts[index][field] = value;
        setFormData({ ...formData, contactPersons: newContacts });
    };

    const handleReportingManagerChange = (index, field, value) => {
        if (field === 'contactNumber') {
            if (!/^\d*$/.test(value)) return;
            if (value.length > 10) return;
        }
        const newContacts = [...formData.contactPersons];
        newContacts[index].reportingManager[field] = value;
        setFormData({ ...formData, contactPersons: newContacts });
    };

    const addContactPerson = () => {
        setFormData({
            ...formData,
            contactPersons: [...formData.contactPersons, {
                name: '',
                designation: '',
                department: '', // New Field
                contactNumber: '',
                email: '',
                location: '',
                linkedIn: '',
                isPrimary: false,
                reportingManager: { name: '', designation: '', contactNumber: '', email: '' }
            }]
        });
    };

    const removeContactPerson = (index) => {
        if (formData.contactPersons.length > 1) {
            const newContacts = formData.contactPersons.filter((_, i) => i !== index);
            setFormData({ ...formData, contactPersons: newContacts });
        }
    };



    // ...

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate all contact persons
        for (let i = 0; i < formData.contactPersons.length; i++) {
            const contact = formData.contactPersons[i];

            // Validate mobile
            const mobileValidation = validateMobile(contact.contactNumber);
            if (!mobileValidation.valid) {
                addToast(`Contact ${i + 1}: ${mobileValidation.message}`, 'error');
                return;
            }

            // Validate email
            const emailValidation = validateEmail(contact.email);
            if (!emailValidation.valid) {
                addToast(`Contact ${i + 1}: ${emailValidation.message}`, 'error');
                return;
            }

            // Validate reporting manager if exists
            if (contact.reportingManager?.contactNumber) {
                const rmMobileValidation = validateMobile(contact.reportingManager.contactNumber);
                if (!rmMobileValidation.valid) {
                    addToast(`Contact ${i + 1} Reporting Manager: ${rmMobileValidation.message}`, 'error');
                    return;
                }
            }

            if (contact.reportingManager?.email) {
                const rmEmailValidation = validateEmail(contact.reportingManager.email);
                if (!rmEmailValidation.valid) {
                    addToast(`Contact ${i + 1} Reporting Manager: ${rmEmailValidation.message}`, 'error');
                    return;
                }
            }
        }

        try {
            const token = localStorage.getItem('token');
            let res;

            if (selectedClient && selectedClient._id) {
                // Update existing client
                res = await axios.put(`http://localhost:5000/api/clients/${selectedClient._id}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                addToast('Client updated successfully', 'success');
            } else {
                // Create new client
                res = await axios.post('http://localhost:5000/api/clients', formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                addToast('Client created successfully', 'success');
            }

            setShowFormModal(false);
            if (viewMode === 'list') {
                resetForm();
            }
            fetchClients();
            // If editing, we might want to refresh the selectedClient details too if in details view
            if (viewMode === 'details' && selectedClient) {
                // To update details view, we update the selectedClient with the response data
                setSelectedClient(res.data);
            }

        } catch (err) {
            console.error('Error saving client:', err.message); // Clean error log
            const errorMessage = err.response?.data?.message || err.message;
            addToast(`Error saving client: ${errorMessage}`, 'error');
        }
    };

    // ...

    // Content Switcher

    const resetForm = () => {
        setFormData({
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
                reportingManager: { name: '', designation: '', contactNumber: '', email: '' }
            }]
        });
        // Don't null selectedClient here if we want to edit
        // setSelectedClient(null); 
    };

    // --- Navigation Handlers ---
    const startCreate = () => {
        resetForm();
        setSelectedClient(null); // Explicitly clear selected client
        setShowFormModal(true);
        if (viewMode !== 'list' && viewMode !== 'details') {
            setViewMode('list');
        }
    };

    const openDetails = (client) => {
        setSelectedClient(client);
        setViewMode('details');
    };

    const startEdit = () => {
        if (selectedClient) {
            setFormData({
                companyName: selectedClient.companyName,
                sector: selectedClient.sector || selectedClient.base || 'Enterprise',
                contactPersons: selectedClient.contactPersons.map(cp => ({
                    ...cp,
                    department: cp.department || '',
                    reportingManager: cp.reportingManager || { name: '', designation: '', contactNumber: '', email: '' },
                    linkedIn: cp.linkedIn || '' // Ensure default
                }))
            });
            setShowFormModal(true);
            // viewMode remains 'details' so when we close modal we are back to details
        }
    };

    const goBack = () => {
        if (viewMode === 'details') {
            setViewMode('list');
            resetForm();
            setSelectedClient(null);
        }
        // If in modal, the modal has its own close button which just toggles the state
    };

    // --- Filters ---
    const uniqueCreators = [...new Set(clients.map(c => c.createdBy?.name).filter(Boolean))];

    const filteredClients = clients.filter(client => {
        const matchesName = client.companyName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCreator = filterCreator ? client.createdBy?.name === filterCreator : true;
        return matchesName && matchesCreator;
    });


    // --- Render Views ---

    // --- Render Views ---

    const renderForm = (title) => (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8 relative flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-lg z-10">
                    <h2 className="text-xl font-semibold text-brand-blue">{title}</h2>
                    <button onClick={() => setShowFormModal(false)} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Company Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    name="companyName"
                                    value={formData.companyName}
                                    onChange={handleChange}
                                    onBlur={(e) => checkDuplicate(e.target.value)}
                                    className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                                    placeholder="Enter company name"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Sector <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="sector"
                                    value={formData.sector}
                                    onChange={handleChange}
                                    className="w-full border p-2 rounded"
                                    required
                                >
                                    <option value="Enterprise">Enterprise</option>
                                    <option value="Academics">Academics</option>
                                    <option value="University">University</option>
                                    <option value="College">College</option>
                                    <option value="School">School</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">Contact Persons</h3>
                                <button type="button" onClick={addContactPerson} className="text-brand-blue text-sm font-medium hover:underline">
                                    + Add Another Contact
                                </button>
                            </div>

                            {formData.contactPersons.map((contact, index) => (
                                <div key={index} className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-medium text-gray-900">
                                            Contact Person {index + 1}
                                            {contact.isPrimary && <span className="ml-2 text-xs bg-brand-gold text-white px-2 py-1 rounded">Primary</span>}
                                        </h4>
                                        {formData.contactPersons.length > 1 && (
                                            <button type="button" onClick={() => removeContactPerson(index)} className="text-red-500 hover:text-red-700">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
                                            <input value={contact.name} onChange={(e) => handleContactChange(index, 'name', e.target.value)} className="w-full bg-white border border-gray-200 p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-blue" required />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Designation</label>
                                            <input value={contact.designation} onChange={(e) => handleContactChange(index, 'designation', e.target.value)} className="w-full bg-white border border-gray-200 p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-blue" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Department (Optional)</label>
                                            <input value={contact.department} onChange={(e) => handleContactChange(index, 'department', e.target.value)} className="w-full bg-white border border-gray-200 p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="e.g. HR, IT, L&D" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Contact Number <span className="text-red-500">*</span></label>
                                            <input
                                                value={contact.contactNumber}
                                                onChange={(e) => handleContactChange(index, 'contactNumber', e.target.value)}
                                                className={`w-full bg-white border p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-blue ${contact.contactNumber && contact.contactNumber.length !== 10 ? 'border-red-300 focus:ring-red-200' : 'border-gray-200'
                                                    }`}
                                                placeholder="10-digit Mobile Number"
                                                pattern="^[0-9]{10}$"
                                                title="Enter a valid phone number (Exactly 10 digits)"
                                                required
                                            />
                                            {contact.contactNumber && contact.contactNumber.length !== 10 && (
                                                <p className="text-xs text-red-500 mt-1">Must be exactly 10 digits ({contact.contactNumber.length}/10)</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
                                            <input type="email" value={contact.email} onChange={(e) => handleContactChange(index, 'email', e.target.value)} className="w-full bg-white border border-gray-200 p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="email@company.com" required />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Location <span className="text-red-500">*</span></label>
                                            <input value={contact.location} onChange={(e) => handleContactChange(index, 'location', e.target.value)} className="w-full bg-white border border-gray-200 p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="City, State" required />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">LinkedIn (Optional)</label>
                                            <input value={contact.linkedIn} onChange={(e) => handleContactChange(index, 'linkedIn', e.target.value)} placeholder="https://linkedin.com/in/..." className="w-full bg-white border border-gray-200 p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-blue" />
                                        </div>
                                    </div>

                                    <details className="mt-3">
                                        <summary className="text-xs text-gray-600 cursor-pointer hover:text-brand-blue">+ Add Reporting Manager (Optional)</summary>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pl-4 border-l-2 border-gray-200">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Manager Name</label>
                                                <input value={contact.reportingManager.name} onChange={(e) => handleReportingManagerChange(index, 'name', e.target.value)} className="w-full border p-2 rounded text-sm bg-white" />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Designation</label>
                                                <input value={contact.reportingManager.designation} onChange={(e) => handleReportingManagerChange(index, 'designation', e.target.value)} className="w-full border p-2 rounded text-sm bg-white" />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Contact</label>
                                                <input
                                                    value={contact.reportingManager.contactNumber}
                                                    onChange={(e) => handleReportingManagerChange(index, 'contactNumber', e.target.value)}
                                                    className="w-full border p-2 rounded text-sm bg-white"
                                                    pattern="^[0-9]{10}$"
                                                    title="Enter a valid phone number (Exactly 10 digits)"
                                                    placeholder="10-digit Mobile Number"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Email</label>
                                                <input value={contact.reportingManager.email} onChange={(e) => handleReportingManagerChange(index, 'email', e.target.value)} className="w-full border p-2 rounded text-sm bg-white" />
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            ))}
                        </div>

                        <div className="flex space-x-4 pt-4 border-t sticky bottom-0 bg-white">
                            <button type="submit" className="bg-brand-blue text-white px-6 py-2 rounded-lg hover:bg-opacity-90 flex-1 md:flex-none">
                                {selectedClient ? 'Update Client' : 'Create Client'}
                            </button>
                            <button type="button" onClick={() => setShowFormModal(false)} className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 flex-1 md:flex-none">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );

    const renderDetails = () => (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between mb-6 pb-4 border-b">
                <div className="flex items-center space-x-4">
                    <button onClick={goBack} className="text-gray-600 hover:text-gray-900">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{selectedClient.companyName}</h2>
                        <p className="text-gray-500">Sector: {selectedClient.sector}</p>
                    </div>
                </div>
                {(() => {
                    // Start with base check: Super Admin can always edit
                    let canEdit = user.role === 'Super Admin';

                    // For Sales roles (Exec, Manager, Business Head), only allow if they are the creator
                    if (['Sales Executive', 'Sales Manager', 'Business Head'].includes(user.role)) {
                        canEdit = (selectedClient.createdBy?._id === user.id || selectedClient.createdBy === user.id);
                    }

                    if (!canEdit) return null;

                    return (
                        <button
                            onClick={startEdit}
                            className="bg-primary-blue text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-primary-blue-dark"
                        >
                            <Edit size={16} />
                            <span>Edit</span>
                        </button>
                    );
                })()}
            </div>

            <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Contact Persons</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 font-semibold text-gray-900">Name</th>
                                <th className="px-6 py-3 font-semibold text-gray-900">Designation</th>
                                <th className="px-6 py-3 font-semibold text-gray-900">Department</th>
                                <th className="px-6 py-3 font-semibold text-gray-900">Email</th>
                                <th className="px-6 py-3 font-semibold text-gray-900">Phone</th>
                                <th className="px-6 py-3 font-semibold text-gray-900">Location</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {selectedClient.contactPersons.map((contact, idx) => (
                                <tr
                                    key={idx}
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => setSelectedContact(contact)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2">
                                            <span className="font-medium text-gray-900">{contact.name}</span>
                                            {contact.isPrimary && <span className="text-xs bg-brand-gold text-white px-2 py-1 rounded">Primary</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-700">{contact.designation || 'N/A'}</td>
                                    <td className="px-6 py-4 text-gray-700">{contact.department || 'N/A'}</td>
                                    <td className="px-6 py-4 text-gray-700">{contact.email}</td>
                                    <td className="px-6 py-4 text-gray-700">{contact.contactNumber}</td>
                                    <td className="px-6 py-4 text-primary-blue">{contact.location}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-5 relative">
            {/* Contact Detail Modal */}
            {selectedContact && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setSelectedContact(null)}>
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{selectedContact.name}</h2>
                                <p className="text-gray-600">{selectedContact.designation}</p>
                            </div>
                            <button onClick={() => setSelectedContact(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-gray-500">Department</p>
                                    <p className="text-gray-900">{selectedContact.department || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-500">Location</p>
                                    <p className="text-primary-blue">{selectedContact.location}</p>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <p className="text-sm font-semibold text-gray-500 mb-2">Contact Information</p>
                                <div className="space-y-2">
                                    <div>
                                        <p className="text-xs text-gray-500">Email</p>
                                        <p className="text-gray-900">{selectedContact.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Phone</p>
                                        <p className="text-gray-900">{selectedContact.contactNumber}</p>
                                    </div>
                                </div>
                            </div>

                            {selectedContact.linkedIn && (
                                <div className="border-t pt-4">
                                    <p className="text-sm font-semibold text-gray-500 mb-2">LinkedIn</p>
                                    <a href={selectedContact.linkedIn} target="_blank" rel="noopener noreferrer" className="text-primary-blue hover:underline">
                                        {selectedContact.linkedIn}
                                    </a>
                                </div>
                            )}

                            {selectedContact.reportingManager?.name && (
                                <div className="border-t pt-4">
                                    <p className="text-sm font-semibold text-gray-500 mb-2">Reporting Manager</p>
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                        <p className="font-medium text-gray-900">{selectedContact.reportingManager.name}</p>
                                        <p className="text-sm text-gray-600">{selectedContact.reportingManager.designation}</p>
                                        <div className="mt-2 text-sm space-y-1">
                                            <p className="text-gray-700">{selectedContact.reportingManager.email}</p>
                                            <p className="text-gray-700">{selectedContact.reportingManager.contactNumber}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedContact.isPrimary && (
                                <div className="mt-4">
                                    <span className="inline-block bg-brand-gold text-white px-3 py-1 rounded-full text-sm font-medium">
                                        Primary Contact
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => {
                            if (viewMode === 'details') {
                                setViewMode('list');
                                return;
                            }
                            if (user?.role === 'Sales Manager') {
                                navigate('/dashboard/manager');
                            } else if (user?.role === 'Director') {
                                navigate('/dashboard/businesshead');
                            } else {
                                navigate('/dashboard/executive');
                            }
                        }}
                        className="text-gray-600 hover:text-gray-900 bg-white p-2 rounded-full shadow-sm border border-gray-100 transition-all hover:bg-gray-50"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-primary-blue">Clients</h1>
                        </div>
                    </div>
                </div>
                {viewMode === 'list' && user?.role !== 'Director' && (
                    <button
                        onClick={startCreate}
                        className="bg-primary-blue text-white px-6 py-3 rounded-lg flex items-center space-x-2 hover:bg-primary-blue-dark shadow-md font-semibold transition-colors"
                    >
                        <Plus size={18} />
                        <span>Add Client</span>
                    </button>
                )}
            </div>

            {/* Content Switcher */}
            {/* Duplicate Warning Modal */}
            {showDuplicateWarning && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Duplicate Client Detected</h3>
                            <p className="text-gray-600 mb-6 font-medium">
                                The client already exists. Do you want to proceed further or just create another contact person under the same client?
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        setShowDuplicateWarning(false);
                                        // Proceed with new client
                                    }}
                                    className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                                >
                                    Proceed with new client
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDuplicateWarning(false);
                                        setShowFormModal(false);
                                        // Redirect to existing client details
                                        if (duplicateClientData) {
                                            openDetails(duplicateClientData);
                                        }
                                    }}
                                    className="w-full py-2 px-4 bg-primary-blue text-white rounded-lg font-medium hover:bg-primary-blue-dark transition-colors"
                                >
                                    Add as contact person
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Create/Edit */}
            {showFormModal && renderForm(selectedClient ? 'Update Client' : 'Add New Client')}

            {/* Details View */}
            {viewMode === 'details' && selectedClient && renderDetails()}

            {/* List View - Always show unless in details mode */}
            {viewMode === 'list' && (
                <>
                    {/* Client List Container */}
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-gray-900">All Clients ({filteredClients.length})</h2>
                            <div className="flex space-x-4">
                                <div className="relative w-80">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search clients..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                                    />
                                </div>
                                {['Sales Manager', 'Business Head'].includes(user?.role) && (
                                    <div className="relative w-48">
                                        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                        <select
                                            value={filterCreator}
                                            onChange={(e) => setFilterCreator(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue appearance-none"
                                        >
                                            <option value="">All Creators</option>
                                            {uniqueCreators.map((creator, idx) => (
                                                <option key={idx} value={creator}>{creator}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Client Table */}
                        <div className="overflow-auto h-[calc(100vh-240px)]">
                            <table className="min-w-full text-left text-sm relative">
                                <thead className="border-b border-gray-200 sticky top-0 bg-white z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold text-gray-900">Company Name</th>
                                        <th className="px-6 py-3 font-semibold text-gray-900">Contact Person</th>
                                        <th className="px-6 py-3 font-semibold text-gray-900">Designation</th>
                                        <th className="px-6 py-3 font-semibold text-gray-900">Location</th>
                                        <th className="px-6 py-3 font-semibold text-gray-900">Contact Info</th>
                                        {['Sales Manager', 'Business Head'].includes(user?.role) && (
                                            <th className="px-6 py-3 font-semibold text-gray-900">Created By</th>
                                        )}
                                        <th className="px-6 py-3 font-semibold text-gray-900">Add Opportunity</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredClients.length > 0 ? (
                                        filteredClients.map((client) => {
                                            const primaryContact = client.contactPersons?.find(c => c.isPrimary) || client.contactPersons?.[0];
                                            return (
                                                <tr
                                                    key={client._id}
                                                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                                                    onClick={() => openDetails(client)}
                                                >
                                                    <td className="px-6 py-4 font-bold text-gray-900">{client.companyName}</td>
                                                    <td className="px-6 py-4 text-gray-700">
                                                        {primaryContact?.name || <span className="text-gray-400 italic">No contact</span>}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-700">
                                                        {primaryContact?.designation || 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4 text-primary-blue">
                                                        {primaryContact?.location || 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {primaryContact ? (
                                                            <div className="space-y-1">
                                                                <div className="text-gray-700">{primaryContact.email}</div>
                                                                <div className="text-gray-500 text-xs">{primaryContact.contactNumber}</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 italic">No contact info</span>
                                                        )}
                                                    </td>
                                                    {['Sales Manager', 'Business Head'].includes(user?.role) && (
                                                        <td className="px-6 py-4 text-gray-500">
                                                            {client.createdBy?.name || 'N/A'}
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate('/opportunities', { state: { createOpportunity: true, clientId: client._id } });
                                                            }}
                                                            className="text-white bg-blue-900 p-2 rounded-md transition-colors"
                                                            title="Create Opportunity"
                                                        >
                                                            <Plus size={20} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                                No clients found matching your search.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ClientPage;
