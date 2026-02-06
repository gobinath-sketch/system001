import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Edit, Search, Filter, FileText, Building, ArrowRight } from 'lucide-react';
import UploadButton from '../components/ui/UploadButton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { validateMobile, validateEmail } from '../utils/validation';

const SMEManagement = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addToast } = useToast();
    const [smes, setSmes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [selectedSme, setSelectedSme] = useState(null);
    const [editMode, setEditMode] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        search: '',
        type: '' // 'Company' or 'Freelancer'
    });

    // Form Data
    const initialFormState = {
        smeType: 'Company', // Default

        // Company Fields
        companyName: '',
        companyContactNumber: '',
        companyContactPerson: '',
        companyLocation: '',
        companyAddress: '',

        // Common / Freelancer Fields
        name: '', // SME Name
        email: '',
        contactNumber: '',
        location: '',
        technology: '',
        yearsExperience: '',
        address: '', // Freelancer Address

        // Bank Details
        bankDetails: {
            bankName: '',
            branchName: '',
            accountNumber: '',
            accountHolderName: '',
            ifscCode: ''
        },

        // Tax Details
        gstNo: '',
        panNo: ''
    };

    const [formData, setFormData] = useState(initialFormState);

    const [files, setFiles] = useState({
        sowDocument: null,
        ndaDocument: null,
        contentUpload: null,
        idProof: null,
        panDocument: null,
        gstDocument: null
    });

    useEffect(() => {
        fetchSMEs();
    }, [filters]);

    const fetchSMEs = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const queryParams = new URLSearchParams();
            if (filters.search) queryParams.append('search', filters.search);
            if (filters.type) queryParams.append('type', filters.type);

            const res = await axios.get(`http://localhost:5000/api/smes?${queryParams}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSmes(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching SMEs:', err);
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData({
                ...formData,
                [parent]: {
                    ...formData[parent],
                    [child]: value
                }
            });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleFileChange = (e) => {
        setFiles({ ...files, [e.target.name]: e.target.files[0] });
    };

    const handleEdit = (sme) => {
        setSelectedSme(sme);
        setFormData({
            smeType: sme.smeType || (sme.companyVendor ? 'Company' : 'Freelancer'), // Fallback for legacy
            companyName: sme.companyName || '',
            companyContactNumber: sme.companyContactNumber || '',
            companyContactPerson: sme.companyContactPerson || '',
            companyLocation: sme.companyLocation || '',
            companyAddress: sme.companyAddress || '',
            name: sme.name,
            email: sme.email || '',
            contactNumber: sme.contactNumber || '',
            location: sme.location || '',
            technology: sme.technology,
            yearsExperience: sme.yearsExperience,
            address: sme.address || '',
            bankDetails: sme.bankDetails || initialFormState.bankDetails,
            gstNo: sme.gstNo || '',
            panNo: sme.panNo || ''
        });
        setEditMode(true);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this SME?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:5000/api/smes/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            addToast('SME deleted successfully', 'success');
            fetchSMEs();
            if (selectedSme?._id === id) {
                setSelectedSme(null);
                setShowForm(false);
            }
        } catch (err) {
            addToast('Error deleting SME', 'error');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.smeType === 'Freelancer') {
            if (!formData.contactNumber) {
                addToast('SME Contact Number is required for Freelancers', 'error');
                return;
            }
            if (!formData.email) {
                addToast('Email is required for Freelancers', 'error');
                return;
            }
        }

        // Validation
        if (formData.contactNumber) {
            const mobileValidation = validateMobile(formData.contactNumber);
            if (!mobileValidation.valid) {
                addToast(`SME Contact: ${mobileValidation.message}`, 'error');
                return;
            }
        }

        if (formData.smeType === 'Company') {
            const companyContactValidation = validateMobile(formData.companyContactNumber);
            if (!companyContactValidation.valid) {
                addToast(`Company Contact: ${companyContactValidation.message}`, 'error');
                return;
            }
        }

        if (formData.email) {
            const emailValidation = validateEmail(formData.email);
            if (!emailValidation.valid) {
                addToast(emailValidation.message, 'error');
                return;
            }
        }

        const data = new FormData();
        // Append all text fields
        Object.keys(formData).forEach(key => {
            if (key === 'bankDetails') {
                data.append('bankDetails', JSON.stringify(formData.bankDetails));
            } else {
                data.append(key, formData[key]);
            }
        });

        // Append files
        Object.keys(files).forEach(key => {
            if (files[key]) {
                data.append(key, files[key]);
            }
        });

        try {
            const token = localStorage.getItem('token');
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            };

            if (editMode && selectedSme) {
                await axios.put(`http://localhost:5000/api/smes/${selectedSme._id}`, data, config);
                addToast('SME updated successfully!', 'success');
            } else {
                await axios.post('http://localhost:5000/api/smes', data, config);
                addToast('SME created successfully!', 'success');
            }

            setShowForm(false);
            resetForm();
            fetchSMEs();
        } catch (err) {
            console.error(err);
            addToast(err.response?.data?.message || 'Error saving SME', 'error');
        }
    };

    const resetForm = () => {
        setFormData(initialFormState);
        setFiles({
            sowDocument: null,
            ndaDocument: null,
            contentUpload: null,
            idProof: null,
            panDocument: null,
            gstDocument: null
        });
        setEditMode(false);
        setSelectedSme(null);
    };

    const renderDocumentLink = (path, label) => {
        if (!path) return <span className="text-gray-400 italic text-sm">Not uploaded</span>;
        return (
            <a href={`http://localhost:5000/${path}`} target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline flex items-center gap-1 text-sm">
                <FileText size={14} /> {label}
            </a>
        );
    };

    return (
        <div className="p-5">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate('/dashboard/delivery')}
                        className="text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-3xl font-bold text-primary-blue">SME Management</h1>
                </div>
                {!showForm && !selectedSme && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="bg-brand-blue text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-opacity-90 shadow-md transition-colors"
                    >
                        <Plus size={18} /> Add SME
                    </button>
                )}
            </div>

            {/* List View */}
            {!showForm && !selectedSme && (
                <>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {/* Table Header with Search & Filters */}
                        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
                            <div className="text-gray-600 font-semibold whitespace-nowrap">
                                All SMEs <span className="bg-gray-100 px-2 py-0.5 rounded-full text-xs text-brand-blue ml-1">{smes.length}</span>
                            </div>

                            <div className="flex flex-1 items-center justify-end gap-4 w-full md:w-auto">
                                <div className="relative max-w-md w-64">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        name="search"
                                        value={filters.search}
                                        onChange={handleFilterChange}
                                        placeholder="Search SMEs..."
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue text-sm"
                                    />
                                </div>
                                <div className="relative w-48">
                                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                    <select
                                        name="type"
                                        value={filters.type}
                                        onChange={handleFilterChange}
                                        className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue text-sm cursor-pointer hover:bg-gray-50"
                                    >
                                        <option value="">All Types</option>
                                        <option value="Company">Company</option>
                                        <option value="Freelancer">Freelancer</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-center text-sm">
                                <thead className="border-b border-gray-200 bg-gray-50/50">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold text-gray-900 text-center">Type</th>
                                        <th className="px-6 py-3 font-semibold text-gray-900 text-center">SME Name</th>
                                        <th className="px-6 py-3 font-semibold text-gray-900 text-center">Company Name</th>
                                        <th className="px-6 py-3 font-semibold text-gray-900 text-center">Contact</th>
                                        <th className="px-6 py-3 font-semibold text-gray-900 text-center">Email</th>
                                        <th className="px-6 py-3 font-semibold text-gray-900 text-center">Location</th>
                                        <th className="px-6 py-3 font-semibold text-gray-900 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                                    ) : smes.length === 0 ? (
                                        <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No SMEs found</td></tr>
                                    ) : (
                                        smes.map(sme => (
                                            <tr key={sme._id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelectedSme(sme)}>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${sme.smeType === 'Company' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                                        {sme.smeType || 'Freelancer'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-gray-900 text-center">{sme.name}</td>
                                                <td className="px-6 py-4 text-gray-700 text-center">
                                                    {sme.smeType === 'Company' ? (sme.companyName || 'N/A') : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-gray-700 text-center">{sme.contactNumber}</td>
                                                <td className="px-6 py-4 text-gray-700 text-center">{sme.email}</td>
                                                <td className="px-6 py-4 text-gray-700 text-center">{sme.location}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-3" onClick={(e) => e.stopPropagation()}>
                                                        <button onClick={() => setSelectedSme(sme)} className="text-brand-blue hover:text-blue-900 text-sm font-medium">View</button>
                                                        <button onClick={() => handleEdit(sme)} className="text-indigo-600 hover:text-indigo-900"><Edit size={16} /></button>
                                                        <button onClick={() => handleDelete(sme._id)} className="text-red-600 hover:text-red-900"><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Detail View */}
            {selectedSme && !showForm && (
                <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setSelectedSme(null)} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={20} /></button>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{selectedSme.name}</h2>
                                <p className="text-gray-500">{selectedSme.smeType} • {selectedSme.technology}</p>
                            </div>
                        </div>
                        <button onClick={() => handleEdit(selectedSme)} className="flex items-center gap-2 bg-brand-blue text-white px-4 py-2 rounded-lg">
                            <Edit size={16} /> Edit
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Company Info (if applicable) */}
                        {selectedSme.smeType === 'Company' && (
                            <div className="col-span-full bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2"><Building size={18} /> Company Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div><span className="text-gray-500 block">Company Name</span><span className="font-medium">{selectedSme.companyName}</span></div>
                                    <div><span className="text-gray-500 block">Contact</span><span className="font-medium">{selectedSme.companyContactNumber}</span></div>
                                    <div><span className="text-gray-500 block">Contact Person</span><span className="font-medium">{selectedSme.companyContactPerson || '-'}</span></div>
                                    <div><span className="text-gray-500 block">Location</span><span className="font-medium">{selectedSme.companyLocation || '-'}</span></div>
                                    <div><span className="text-gray-500 block">Address</span><span className="font-medium">{selectedSme.companyAddress}</span></div>
                                </div>
                            </div>
                        )}

                        {/* Basic Info */}
                        <div>
                            <h3 className="text-lg font-semibold border-b pb-2 mb-4">SME Information</h3>
                            <div className="grid grid-cols-2 gap-y-4 text-sm">
                                <div><span className="text-gray-500 block">Email</span><span className="font-medium">{selectedSme.email || '-'}</span></div>
                                <div><span className="text-gray-500 block">Contact</span><span className="font-medium">{selectedSme.contactNumber || '-'}</span></div>
                                <div><span className="text-gray-500 block">Location</span><span className="font-medium">{selectedSme.location}</span></div>
                                <div><span className="text-gray-500 block">Experience</span><span className="font-medium">{selectedSme.yearsExperience} Years</span></div>
                                {selectedSme.smeType === 'Freelancer' && (
                                    <div className="col-span-2"><span className="text-gray-500 block">Address</span><span className="font-medium">{selectedSme.address}</span></div>
                                )}
                            </div>
                        </div>

                        {/* Bank & Tax Info */}
                        <div>
                            <h3 className="text-lg font-semibold border-b pb-2 mb-4">Bank & Tax Details</h3>
                            <div className="grid grid-cols-2 gap-y-4 text-sm">
                                <div><span className="text-gray-500 block">Bank Name</span><span className="font-medium">{selectedSme.bankDetails?.bankName}</span></div>
                                <div><span className="text-gray-500 block">Account No</span><span className="font-medium">{selectedSme.bankDetails?.accountNumber}</span></div>
                                <div><span className="text-gray-500 block">IFSC</span><span className="font-medium">{selectedSme.bankDetails?.ifscCode}</span></div>
                                <div><span className="text-gray-500 block">GST No</span><span className="font-medium">{selectedSme.gstNo}</span></div>
                                <div><span className="text-gray-500 block">PAN No</span><span className="font-medium">{selectedSme.panNo}</span></div>
                            </div>
                        </div>

                        {/* Documents */}
                        <div className="col-span-full">
                            <h3 className="text-lg font-semibold border-b pb-2 mb-4">Documents</h3>
                            <div className="flex flex-wrap gap-4">
                                {renderDocumentLink(selectedSme.sowDocument, 'SOW Document')}
                                {renderDocumentLink(selectedSme.ndaDocument, 'NDA Document')}
                                {renderDocumentLink(selectedSme.contentUpload, 'Profile')}
                                {renderDocumentLink(selectedSme.idProof, 'ID Proof')}
                                {renderDocumentLink(selectedSme.gstDocument, 'GST Certificate')}
                                {renderDocumentLink(selectedSme.panDocument, 'PAN Card')}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Form */}
            {showForm && (
                <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900">{editMode ? 'Edit SME' : 'Add New SME'}</h2>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Type Selection */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">SME Type</label>
                            <div className="flex gap-4">
                                <label className="flex items-center space-x-2 cursor-pointer border p-3 rounded-lg hover:bg-gray-50 w-32 justify-center">
                                    <input
                                        type="radio"
                                        name="smeType"
                                        value="Company"
                                        checked={formData.smeType === 'Company'}
                                        onChange={handleInputChange}
                                        disabled={editMode} // Prevent type change on edit
                                    />
                                    <span className="font-medium">Company</span>
                                </label>
                                <label className="flex items-center space-x-2 cursor-pointer border p-3 rounded-lg hover:bg-gray-50 w-32 justify-center">
                                    <input
                                        type="radio"
                                        name="smeType"
                                        value="Freelancer"
                                        checked={formData.smeType === 'Freelancer'}
                                        onChange={handleInputChange}
                                        disabled={editMode}
                                    />
                                    <span className="font-medium">Freelancer</span>
                                </label>
                            </div>
                        </div>

                        {/* Sections */}
                        <div className="space-y-8">

                            {/* Company Specific Section */}
                            {formData.smeType === 'Company' && (
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                    <h3 className="font-semibold text-blue-900 mb-4">Company Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <input name="companyName" value={formData.companyName} onChange={handleInputChange} placeholder="Company Name *" className="border p-2 rounded" required />
                                        <input name="companyContactNumber" value={formData.companyContactNumber} onChange={handleInputChange} placeholder="Company Contact Number *" className="border p-2 rounded" required />
                                        <input name="companyContactPerson" value={formData.companyContactPerson} onChange={handleInputChange} placeholder="Contact Person Name *" className="border p-2 rounded" required />
                                        <input name="companyLocation" value={formData.companyLocation} onChange={handleInputChange} placeholder="Company Location *" className="border p-2 rounded" required />
                                        <textarea name="companyAddress" value={formData.companyAddress} onChange={handleInputChange} placeholder="Company Address *" className="border p-2 rounded md:col-span-2" rows="2" required />
                                    </div>
                                </div>
                            )}

                            {/* Section A: Basic Details */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">A. Basic Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <input name="name" value={formData.name} onChange={handleInputChange} placeholder="SME Name *" className="border p-2 rounded" required />
                                    <input name="email" value={formData.email} onChange={handleInputChange} placeholder={formData.smeType === 'Freelancer' ? "Email *" : "Email"} type="email" className="border p-2 rounded" />
                                    <input name="contactNumber" value={formData.contactNumber} onChange={handleInputChange} placeholder={formData.smeType === 'Freelancer' ? "SME Contact Number *" : "SME Contact Number"} className="border p-2 rounded" />
                                    <input name="technology" value={formData.technology} onChange={handleInputChange} placeholder="Technology *" className="border p-2 rounded" required />
                                    <input name="yearsExperience" value={formData.yearsExperience} onChange={handleInputChange} placeholder="Years Experience *" type="number" className="border p-2 rounded" required />
                                    <input name="location" value={formData.location} onChange={handleInputChange} placeholder="Location *" className="border p-2 rounded" required />
                                    {formData.smeType === 'Freelancer' && (
                                        <textarea name="address" value={formData.address} onChange={handleInputChange} placeholder="Address *" className="border p-2 rounded md:col-span-3" rows="2" required />
                                    )}
                                </div>
                            </div>

                            {/* Section B: Bank Details */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">B. Bank Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <input name="bankDetails.bankName" value={formData.bankDetails.bankName} onChange={handleInputChange} placeholder="Bank Name *" className="border p-2 rounded" required />
                                    <input name="bankDetails.branchName" value={formData.bankDetails.branchName} onChange={handleInputChange} placeholder="Branch Name *" className="border p-2 rounded" required />
                                    <input name="bankDetails.accountNumber" value={formData.bankDetails.accountNumber} onChange={handleInputChange} placeholder="Account Number *" className="border p-2 rounded" required />
                                    <input name="bankDetails.accountHolderName" value={formData.bankDetails.accountHolderName} onChange={handleInputChange} placeholder="Account Holder Name *" className="border p-2 rounded" required />
                                    <input name="bankDetails.ifscCode" value={formData.bankDetails.ifscCode} onChange={handleInputChange} placeholder="IFSC Code *" className="border p-2 rounded" required />
                                </div>
                            </div>

                            {/* Section C: Tax Details */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">C. Tax Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <input name="gstNo" value={formData.gstNo} onChange={handleInputChange} placeholder="GST Number *" className="border p-2 rounded w-full mb-2" required />
                                        <label className="block text-xs text-gray-500 mb-1">GST Document *</label>
                                        <div className="flex flex-col gap-2">
                                            <input type="file" id="upload-gst" name="gstDocument" onChange={handleFileChange} className="hidden" accept=".pdf,.jpg,.png" />
                                            <div className="flex items-center gap-2">
                                                <UploadButton onClick={() => document.getElementById('upload-gst').click()} type="button">
                                                    {files.gstDocument ? 'Selected' : (editMode && selectedSme?.gstDocument ? 'Replace' : 'Upload')}
                                                </UploadButton>
                                                {files.gstDocument && <span className="text-xs text-green-600 truncate max-w-[100px]">{files.gstDocument.name}</span>}
                                                {editMode && selectedSme?.gstDocument && !files.gstDocument && (
                                                    <a href={`http://localhost:5000/${selectedSme.gstDocument}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-blue hover:underline">View</a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <input name="panNo" value={formData.panNo} onChange={handleInputChange} placeholder="PAN Number *" className="border p-2 rounded w-full mb-2" required />
                                        <label className="block text-xs text-gray-500 mb-1">PAN Card *</label>
                                        <div className="flex flex-col gap-2">
                                            <input type="file" id="upload-pan" name="panDocument" onChange={handleFileChange} className="hidden" accept=".pdf,.jpg,.png" />
                                            <div className="flex items-center gap-2">
                                                <UploadButton onClick={() => document.getElementById('upload-pan').click()} type="button">
                                                    {files.panDocument ? 'Selected' : (editMode && selectedSme?.panDocument ? 'Replace' : 'Upload')}
                                                </UploadButton>
                                                {files.panDocument && <span className="text-xs text-green-600 truncate max-w-[100px]">{files.panDocument.name}</span>}
                                                {editMode && selectedSme?.panDocument && !files.panDocument && (
                                                    <a href={`http://localhost:5000/${selectedSme.panDocument}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-blue hover:underline">View</a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section D: Documents */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">D. Documents</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="border p-3 rounded bg-gray-50">
                                        <label className="block text-sm font-medium mb-1">SOW Document *</label>
                                        <div className="flex flex-col gap-2">
                                            <input type="file" id="upload-sow" name="sowDocument" onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx" />
                                            <div className="flex items-center gap-2">
                                                <UploadButton onClick={() => document.getElementById('upload-sow').click()} type="button">
                                                    {files.sowDocument ? 'Selected' : (editMode && selectedSme?.sowDocument ? 'Replace' : 'Upload')}
                                                </UploadButton>
                                                {files.sowDocument && <span className="text-xs text-green-600 truncate max-w-[100px]">{files.sowDocument.name}</span>}
                                                {editMode && selectedSme?.sowDocument && !files.sowDocument && (
                                                    <a href={`http://localhost:5000/${selectedSme.sowDocument}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-blue hover:underline">View</a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border p-3 rounded bg-gray-50">
                                        <label className="block text-sm font-medium mb-1">NDA Document *</label>
                                        <div className="flex flex-col gap-2">
                                            <input type="file" id="upload-nda" name="ndaDocument" onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx" />
                                            <div className="flex items-center gap-2">
                                                <UploadButton onClick={() => document.getElementById('upload-nda').click()} type="button">
                                                    {files.ndaDocument ? 'Selected' : (editMode && selectedSme?.ndaDocument ? 'Replace' : 'Upload')}
                                                </UploadButton>
                                                {files.ndaDocument && <span className="text-xs text-green-600 truncate max-w-[100px]">{files.ndaDocument.name}</span>}
                                                {editMode && selectedSme?.ndaDocument && !files.ndaDocument && (
                                                    <a href={`http://localhost:5000/${selectedSme.ndaDocument}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-blue hover:underline">View</a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border p-3 rounded bg-gray-50">
                                        <label className="block text-sm font-medium mb-1">Profile Document *</label>
                                        <div className="flex flex-col gap-2">
                                            <input type="file" id="upload-profile" name="contentUpload" onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx" />
                                            <div className="flex items-center gap-2">
                                                <UploadButton onClick={() => document.getElementById('upload-profile').click()} type="button">
                                                    {files.contentUpload ? 'Selected' : (editMode && selectedSme?.contentUpload ? 'Replace' : 'Upload')}
                                                </UploadButton>
                                                {files.contentUpload && <span className="text-xs text-green-600 truncate max-w-[100px]">{files.contentUpload.name}</span>}
                                                {editMode && selectedSme?.contentUpload && !files.contentUpload && (
                                                    <a href={`http://localhost:5000/${selectedSme.contentUpload}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-blue hover:underline">View</a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border p-3 rounded bg-gray-50">
                                        <label className="block text-sm font-medium mb-1">ID Proof (Optional)</label>
                                        <div className="flex flex-col gap-2">
                                            <input type="file" id="upload-idproof" name="idProof" onChange={handleFileChange} className="hidden" accept=".pdf,.jpg,.png" />
                                            <div className="flex items-center gap-2">
                                                <UploadButton onClick={() => document.getElementById('upload-idproof').click()} type="button">
                                                    {files.idProof ? 'Selected' : (editMode && selectedSme?.idProof ? 'Replace' : 'Upload')}
                                                </UploadButton>
                                                {files.idProof && <span className="text-xs text-green-600 truncate max-w-[100px]">{files.idProof.name}</span>}
                                                {editMode && selectedSme?.idProof && !files.idProof && (
                                                    <a href={`http://localhost:5000/${selectedSme.idProof}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-blue hover:underline">View</a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 mt-8 border-t pt-4">
                            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-5 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200">Cancel</button>
                            <button type="submit" className="px-5 py-2 bg-brand-blue text-white rounded hover:bg-opacity-90 font-medium">
                                {editMode ? 'Update SME' : 'Create SME'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default SMEManagement;
