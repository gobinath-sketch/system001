import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Plus } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import AddClientModal from '../clients/AddClientModal';

import SearchableSelect from '../ui/SearchableSelect';
import { TECHNOLOGIES, getTechnologyOptions } from '../../utils/TechnologyConstants';

const CreateOpportunityModal = ({ isOpen, onClose, onSuccess, preselectedClientId }) => {
    const { addToast } = useToast();

    // Data States
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);

    // New Client Modal State
    const [showClientModal, setShowClientModal] = useState(false);

    // Form Data State
    const [formData, setFormData] = useState({
        clientId: '',
        selectedContactPerson: '',
        requirementSummary: '',
        type: 'Training', // Default
        status: 'Identify', // Default

        // Training fields
        technology: '',
        trainingName: '',
        modeOfTraining: 'Virtual',
        batchSize: '',
        trainingLocation: '',

        // Vouchers fields
        examDetails: '',
        noOfVouchers: '',
        examLocations: [{ location: '', count: '' }],

        // Lab Support fields
        noOfIDs: '',
        duration: '',
        region: '',

        // Resource Support fields
        resourceType: '',
        resourceCount: '',

        // Content Development fields
        contentType: '',
        deliveryFormat: '',

        // Product Support fields
        projectScope: '',
        teamSize: ''
    });

    const [requirementDoc, setRequirementDoc] = useState(null); // New state for file

    useEffect(() => {
        if (isOpen) {
            fetchClients();
            if (preselectedClientId) {
                setFormData(prev => ({ ...prev, clientId: preselectedClientId }));
            }
        }
    }, [isOpen, preselectedClientId]);

    const fetchClients = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/clients', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setClients(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching clients:', err);
            addToast('Failed to load clients. Please reload.', 'error');
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        setRequirementDoc(e.target.files[0]);
    };

    const handleClientSelect = (e) => {
        if (e.target.value === 'ADD_NEW_CLIENT') {
            setShowClientModal(true);
        } else {
            handleChange(e);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const selectedClient = clients.find(c => c._id === formData.clientId);

            // Build typeSpecificDetails based on opportunity type
            let typeSpecificDetails = {};

            if (formData.type === 'Training') {
                typeSpecificDetails = {
                    technology: formData.technology,
                    trainingName: formData.trainingName,
                    modeOfTraining: formData.modeOfTraining,
                    trainingLocation: formData.trainingLocation
                };
            } else if (formData.type === 'Vouchers') {
                typeSpecificDetails = {
                    technology: formData.technology,
                    examDetails: formData.examDetails,
                    numberOfVouchers: parseInt(formData.noOfVouchers) || 0,
                    examLocation: formData.region
                };
            } else if (formData.type === 'Lab Support') {
                typeSpecificDetails = {
                    technology: formData.technology,
                    labRequirement: formData.requirementSummary,
                    numberOfIDs: parseInt(formData.noOfIDs) || 0,
                    duration: formData.duration,
                    region: formData.region
                };
            } else if (formData.type === 'Resource Support') {
                typeSpecificDetails = {
                    resourceType: formData.resourceType,
                    resourceCount: parseInt(formData.resourceCount) || 0
                };
            } else if (formData.type === 'Content Development') {
                typeSpecificDetails = {
                    contentType: formData.contentType,
                    deliveryFormat: formData.deliveryFormat
                };
            } else if (formData.type === 'Product Support') {
                typeSpecificDetails = {
                    projectScope: formData.projectScope,
                    teamSize: parseInt(formData.teamSize) || 0
                };
            }

            const payload = new FormData();
            payload.append('type', formData.type);
            payload.append('clientId', formData.clientId);
            payload.append('selectedContactPerson', formData.selectedContactPerson);
            payload.append('requirementSummary', formData.requirementSummary);
            payload.append('participants', parseInt(formData.batchSize) || 0);
            payload.append('days', parseInt(formData.duration) || 0);
            payload.append('typeSpecificDetails', JSON.stringify(typeSpecificDetails)); // Stringify nested object

            if (requirementDoc) {
                payload.append('requirementDocument', requirementDoc);
            }

            await axios.post('http://localhost:5000/api/opportunities', payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            addToast('Opportunity created successfully', 'success');
            // Reset form
            setFormData({
                clientId: '',
                selectedContactPerson: '',
                requirementSummary: '',
                type: 'Training',
                status: 'Identify',
                technology: '',
                trainingName: '',
                modeOfTraining: 'Virtual',
                batchSize: '',
                trainingLocation: '',
                examDetails: '',
                noOfVouchers: '',
                noOfIDs: '',
                duration: '',
                region: '',
                resourceType: '',
                resourceCount: '',
                contentType: '',
                deliveryFormat: '',
                projectScope: '',
                teamSize: ''
            });
            setRequirementDoc(null);
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Error creating opportunity:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Error creating opportunity';
            addToast(errorMessage, 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
                <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-gray-800">Create New Opportunity</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="border-b pb-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Select Client <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="clientId"
                                        value={formData.clientId}
                                        onChange={handleClientSelect}
                                        className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                                        required
                                    >
                                        <option value="" hidden>Select Client</option>
                                        <option value="ADD_NEW_CLIENT" className="font-bold text-primary-blue">Add New Client</option>
                                        {clients.map(client => (
                                            <option key={client._id} value={client._id}>
                                                {client.companyName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {formData.clientId && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Select Contact Person
                                        </label>
                                        <select
                                            name="selectedContactPerson"
                                            value={formData.selectedContactPerson}
                                            onChange={handleChange}
                                            className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                                        >
                                            <option value="">Select Contact Person</option>
                                            {clients.find(c => c._id === formData.clientId)?.contactPersons?.map((cp, idx) => (
                                                <option key={idx} value={cp.name}>
                                                    {cp.name} ({cp.designation})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Opportunity Type <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="type"
                                        value={formData.type}
                                        onChange={handleChange}
                                        className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                                        required
                                    >
                                        <option value="Training">Training</option>
                                        <option value="Product Support">Product Support</option>
                                        <option value="Resource Support">Resource Support</option>
                                        <option value="Vouchers">Vouchers</option>
                                        <option value="Content Development">Content Development</option>
                                        <option value="Lab Support">Lab Support</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Type-Specific Fields */}
                        <div className="border-b pb-4">
                            <h3 className="text-md font-semibold text-gray-800 mb-4">Opportunity Specific Details</h3>

                            {/* Training Fields */}
                            {formData.type === 'Training' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Technology *</label>
                                        <SearchableSelect
                                            name="technology"
                                            value={formData.technology}
                                            onChange={handleChange}
                                            options={getTechnologyOptions()}
                                            placeholder="Select or type technology"
                                            className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Training Name/Requirement *</label>
                                        <input name="trainingName" value={formData.trainingName} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="Enter training name" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Mode of Training *</label>
                                        <select name="modeOfTraining" value={formData.modeOfTraining} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" required>
                                            <option value="Virtual">Virtual</option>
                                            <option value="Classroom">Classroom</option>
                                            <option value="Hybrid">Hybrid</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Number of Participants *</label>
                                        <input type="number" name="batchSize" value={formData.batchSize} onChange={handleChange} onWheel={(e) => e.target.blur()} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue no-arrows" placeholder="Enter number of participants" required min="1" />
                                    </div>
                                    {(formData.modeOfTraining === 'Classroom' || formData.modeOfTraining === 'Hybrid') && (
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Training Location *</label>
                                            <input name="trainingLocation" value={formData.trainingLocation} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="Enter location" required />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Vouchers Fields */}
                            {formData.type === 'Vouchers' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Technology *</label>
                                        <SearchableSelect
                                            name="technology"
                                            value={formData.technology}
                                            onChange={handleChange}
                                            options={getTechnologyOptions()}
                                            placeholder="Select or type technology"
                                            className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Exam Details *</label>
                                        <input name="examDetails" value={formData.examDetails} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="Enter exam details" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">No of Vouchers *</label>
                                        <input type="number" name="noOfVouchers" value={formData.noOfVouchers} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="Enter number" required min="1" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Exam Location *</label>
                                        <input name="region" value={formData.region} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="e.g., Bangalore, Mumbai, Delhi" required />
                                    </div>
                                </div>
                            )}

                            {/* Lab Support Fields */}
                            {formData.type === 'Lab Support' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Technology *</label>
                                        <SearchableSelect
                                            name="technology"
                                            value={formData.technology}
                                            onChange={handleChange}
                                            options={getTechnologyOptions()}
                                            placeholder="Select or type technology"
                                            className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Requirement *</label>
                                        <input name="requirementSummary" value={formData.requirementSummary} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="Enter requirement" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">No of IDs *</label>
                                        <input type="number" name="noOfIDs" value={formData.noOfIDs} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="Enter number" required min="1" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Duration *</label>
                                        <input name="duration" value={formData.duration} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="e.g., 3 months, 6 months" required />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Region *</label>
                                        <input name="region" value={formData.region} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="Enter region" required />
                                    </div>
                                </div>
                            )}

                            {/* Resource Support Fields */}
                            {formData.type === 'Resource Support' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Resource Type *</label>
                                        <input name="resourceType" value={formData.resourceType} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="e.g., Trainer, Consultant, Developer" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Resource Count *</label>
                                        <input type="number" name="resourceCount" value={formData.resourceCount} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="Enter count" required min="1" />
                                    </div>
                                </div>
                            )}

                            {/* Content Development Fields */}
                            {formData.type === 'Content Development' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Content Type *</label>
                                        <input name="contentType" value={formData.contentType} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="e.g., Course Material, Documentation, Videos" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Format *</label>
                                        <input name="deliveryFormat" value={formData.deliveryFormat} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="e.g., PDF, Video, Interactive" required />
                                    </div>
                                </div>
                            )}

                            {/* Product Support Fields */}
                            {formData.type === 'Product Support' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Project Scope *</label>
                                        <input name="projectScope" value={formData.projectScope} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="e.g., Full Stack Development, Cloud Migration" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Team Size *</label>
                                        <input type="number" name="teamSize" value={formData.teamSize} onChange={handleChange} className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue" placeholder="Enter team size" required min="1" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Requirement Summary - Common for all types except Lab Support */}
                        {formData.type !== 'Lab Support' && (
                            <div className="border-b pb-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Requirement Summary *
                                    </label>
                                    <input
                                        type="text"
                                        name="requirementSummary"
                                        value={formData.requirementSummary}
                                        onChange={handleChange}
                                        className="w-full bg-gray-50 border-0 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                                        placeholder="Brief summary of the client's requirements"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div className="border-b pb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Requirement Document (Optional)
                            </label>
                            <input
                                type="file"
                                onChange={handleFileChange}
                                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                accept=".pdf,.doc,.docx,.txt"
                            />
                            <p className="text-xs text-gray-500 mt-1">Upload relevant requirement documents (PDF, DOCX, TXT).</p>
                        </div>

                        <div className="flex justify-end space-x-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
                            >
                                Cancel
                            </button>
                            <button type="submit" className="bg-brand-blue text-white px-6 py-2 rounded-lg hover:bg-opacity-90 font-bold">
                                Create Opportunity
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Nested Client Modal */}
            <AddClientModal
                isOpen={showClientModal}
                onClose={() => setShowClientModal(false)}
                onSuccess={(newClient) => {
                    setClients([...clients, newClient]);
                    setFormData({
                        ...formData,
                        clientId: newClient._id,
                        selectedContactPerson: newClient.contactPersons.find(cp => cp.isPrimary)?.name || newClient.contactPersons[0]?.name || ''
                    });
                }}
            />
        </div>
    );
};

export default CreateOpportunityModal;
