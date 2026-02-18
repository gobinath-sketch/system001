import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';

const DocumentTracking = () => {
    const navigate = useNavigate();
    const { socket } = useSocket();
    const [opportunities, setOpportunities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDocuments();
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleEntityUpdated = (event) => {
            if (['opportunity', 'approval'].includes(event?.entity)) {
                fetchDocuments();
            }
        };

        socket.on('entity_updated', handleEntityUpdated);
        return () => socket.off('entity_updated', handleEntityUpdated);
    }, [socket]);

    const fetchDocuments = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('http://localhost:5000/api/dashboard/manager/documents', {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Limit to recent 10
            setOpportunities(response.data.slice(0, 10));
            setLoading(false);
        } catch (err) {
            console.error('Error fetching documents:', err);
            setLoading(false);
        }
    };

    if (loading) return <div className="p-4 text-center text-gray-500">Loading documents...</div>;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Document Status Tracking</h3>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opportunity</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Proposal</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">PO</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {opportunities.length > 0 ? opportunities.map((opp) => (
                            <tr
                                key={opp._id}
                                className="hover:bg-gray-50 cursor-pointer"
                                onClick={() => navigate(`/opportunities/${opp._id}?tab=documents`)}
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-blue">
                                    {opp.opportunityNumber}
                                </td>

                                {/* Proposal Status */}
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    {opp.proposalDocument ? (
                                        <CheckCircle size={18} className="inline text-green-500" />
                                    ) : (
                                        <AlertCircle size={18} className="inline text-yellow-500" />
                                    )}
                                </td>

                                {/* PO Status */}
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    {opp.poDocument ? (
                                        <CheckCircle size={18} className="inline text-green-500" />
                                    ) : (
                                        <AlertCircle size={18} className="inline text-yellow-500" />
                                    )}
                                </td>

                                {/* Invoice Status */}
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    {opp.invoiceDocument ? (
                                        <CheckCircle size={18} className="inline text-green-500" />
                                    ) : (
                                        <span className="text-gray-300">-</span>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="4" className="px-6 py-4 text-center text-gray-500 text-sm">
                                    No opportunities found for your team.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DocumentTracking;
