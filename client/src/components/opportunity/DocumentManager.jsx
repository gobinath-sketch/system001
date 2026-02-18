import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Upload, Download, Trash2, Clock, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import UploadButton from '../ui/UploadButton';

const DocumentManager = ({ opportunityId, editMode }) => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [documents, setDocuments] = useState({ Proposal: [], PO: [], Invoice: [] });
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Default to 'Invoice' for Delivery Team, otherwise 'Proposal'
    const [selectedType, setSelectedType] = useState(
        user.role === 'Delivery Team' ? 'Invoice' : 'Proposal'
    );
    const [file, setFile] = useState(null);

    useEffect(() => {
        if (opportunityId) {
            fetchDocuments();
        }
    }, [opportunityId]);

    const fetchDocuments = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`http://localhost:5000/api/documents/opportunity/${opportunityId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDocuments(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching documents:', err);
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) {
            addToast('Please select a file', 'error');
            return;
        }

        setUploading(true);

        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('document', file);
            formData.append('opportunityId', opportunityId);
            formData.append('documentType', selectedType);

            await axios.post('http://localhost:5000/api/documents/upload', formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            addToast('Document uploaded successfully', 'success');
            setFile(null);
            fetchDocuments();
        } catch (err) {
            addToast(err.response?.data?.message || 'Upload failed', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId) => {
        if (!window.confirm('Are you sure you want to delete this document?')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:5000/api/documents/${docId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            addToast('Document deleted successfully', 'success');
            fetchDocuments();
        } catch (err) {
            addToast(err.response?.data?.message || 'Delete failed', 'error');
        }
    };

    const canUpload = (type) => {
        const permissions = {
            'Proposal': ['Sales Executive', 'Sales Manager'],
            'PO': ['Sales Executive', 'Sales Manager'],
            'Invoice': ['Delivery Team', 'Director']
        };
        return permissions[type]?.includes(user.role) || false;
    };

    if (loading) {
        return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <FileText className="mr-2 text-brand-blue" size={20} />
                Document Management
            </h3>

            {/* Tab Navigation */}
            <div className="flex space-x-2 mb-6 border-b border-gray-200">
                {['Proposal', 'PO', 'Invoice'].map((type) => (
                    <button
                        key={type}
                        onClick={() => setSelectedType(type)}
                        className={`px-4 py-2 font-medium text-sm transition-colors ${selectedType === type
                            ? 'text-brand-blue border-b-2 border-brand-blue'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {type} ({documents[type]?.length || 0})
                    </button>
                ))}
            </div>

            {/* Upload Section - Only visible in Edit Mode */}
            {canUpload(selectedType) && editMode && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-bold text-blue-900 mb-3">Upload {selectedType} Document</h4>
                    <div className="flex items-center space-x-3">
                        <input
                            type="file"
                            onChange={handleFileChange}
                            className="flex-1 text-sm border border-gray-300 rounded-lg p-2"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        />
                        <UploadButton
                            onClick={handleUpload}
                            disabled={uploading || !file}
                        />
                    </div>
                </div>
            )}

            {/* Document List */}
            <div className="space-y-3">
                {documents[selectedType]?.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <FileText size={48} className="mx-auto mb-2 text-gray-300" />
                        <p>No {selectedType} documents uploaded yet</p>
                    </div>
                ) : (
                    documents[selectedType]?.map((doc) => (
                        <div
                            key={doc._id}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                            <div className="flex items-center space-x-3 flex-1">
                                <FileText className="text-brand-blue" size={24} />
                                <div className="flex-1">
                                    <div className="font-medium text-gray-800">{doc.fileName}</div>
                                    <div className="text-xs text-gray-500 flex items-center space-x-4 mt-1">
                                        <span className="flex items-center">
                                            <User size={12} className="mr-1" />
                                            {doc.uploadedBy?.name || 'Unknown'}
                                        </span>
                                        <span className="flex items-center">
                                            <Clock size={12} className="mr-1" />
                                            {new Date(doc.uploadedAt).toLocaleDateString()}
                                        </span>
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                            v{doc.version}
                                        </span>
                                        {doc.isLatest && (
                                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                                Latest
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <a
                                    href={`http://localhost:5000/${doc.filePath}`}
                                    download
                                    className="p-2 text-brand-blue hover:bg-blue-100 rounded-lg transition-colors"
                                    title="Download"
                                >
                                    <Download size={18} />
                                </a>
                                {doc.uploadedBy?._id === user.id && (
                                    <button
                                        onClick={() => handleDelete(doc._id)}
                                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default DocumentManager;
