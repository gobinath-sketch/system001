import React, { useState } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import UploadButton from '../ui/UploadButton';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

const DocumentUpload = ({ opportunityId, onUploadSuccess }) => {
    const { addToast } = useToast();
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [poValue, setPoValue] = useState('');
    const [poDate, setPoDate] = useState('');
    const [documentType, setDocumentType] = useState('proposal'); // Added state for document type

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) {
            addToast('Please select a file', 'error');
            return;
        }

        if (documentType === 'po' && (!poValue || !poDate)) {
            addToast('Please enter PO value and date', 'error');
            return;
        }

        setUploading(true);

        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('document', file); // Changed to 'document' as per new endpoint

            if (documentType === 'po') {
                formData.append('poValue', poValue);
                formData.append('poDate', poDate);
            }
            formData.append('type', documentType); // Append the document type

            const res = await axios.post(`http://localhost:5000/api/opportunities/${opportunityId}/documents`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            addToast(res.data.message, 'success');
            setFile(null);
            setPoValue('');
            setPoDate('');
            if (onUploadSuccess) onUploadSuccess();
        } catch (err) {
            addToast(err.response?.data?.message || 'Upload failed', 'error');
        } finally {
            setUploading(false);
        }
    };

    const description = type === 'proposal'
        ? 'Upload the final proposal document for this opportunity'
        : 'Upload the Purchase Order received from the client';

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center mb-4">
                <FileText className="text-brand-blue mr-2" size={20} />
                <h3 className="text-lg font-bold text-gray-800">{title}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">{description}</p>

            <div className="space-y-4">
                {/* File Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Document
                    </label>
                    <input
                        type="file"
                        onChange={handleFileChange}
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                        accept=".pdf,.doc,.docx"
                    />
                    {file && (
                        <div className="mt-2 text-sm text-green-600 flex items-center">
                            <CheckCircle size={16} className="mr-1" />
                            {file.name}
                        </div>
                    )}
                </div>

                {/* PO-specific fields */}
                {type === 'po' && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                PO Value ($)
                            </label>
                            <input
                                type="number"
                                value={poValue}
                                onChange={(e) => setPoValue(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                placeholder="Enter PO value"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                PO Date
                            </label>
                            <input
                                type="date"
                                value={poDate}
                                onChange={(e) => setPoDate(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                required
                            />
                        </div>
                    </>
                )}

                {/* Upload Button */}
                <UploadButton
                    onClick={handleUpload}
                    disabled={uploading || !file}
                />
            </div>
        </div>
    );
};

export default DocumentUpload;
