import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Search } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

const ProgramExecutionList = () => {
    const { socket } = useSocket();
    const [opportunities, setOpportunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchOpportunities();
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleEntityUpdated = (event) => {
            if (event?.entity === 'opportunity') {
                fetchOpportunities();
            }
        };

        socket.on('entity_updated', handleEntityUpdated);
        return () => socket.off('entity_updated', handleEntityUpdated);
    }, [socket]);

    const fetchOpportunities = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/opportunities', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setOpportunities(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching opportunities:', err);
            setLoading(false);
        }
    };

    const filteredOpportunities = opportunities.filter(opp =>
        opp.opportunityNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-5">Loading...</div>;

    return (
        <div className="p-3 sm:p-5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 sm:mb-8 gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-primary-blue">Opportunities</h1>
                <div className="relative w-full sm:w-64">
                    <input
                        type="text"
                        placeholder="Search by Opp ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-brand-blue"
                    />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm whitespace-nowrap">
                        <thead className="uppercase tracking-wider border-b-2 border-gray-100 bg-gray-50 text-gray-500 font-semibold">
                            <tr>
                                <th className="px-6 py-3">Opp ID</th>
                                <th className="px-6 py-3">Type of Opp</th>
                                <th className="px-6 py-3">Progress</th>
                                <th className="px-6 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredOpportunities.map((opp) => (
                                <tr key={opp._id} className="hover:bg-blue-50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-brand-blue font-medium">{opp.opportunityNumber}</td>
                                    <td className="px-6 py-4 text-gray-800">{opp.type}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2">
                                            <div className="flex-1 bg-gray-200 rounded-full h-2 w-32">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${(opp.progressPercentage || 0) >= 100
                                                        ? 'bg-green-500' // Completed
                                                        : 'bg-brand-blue' // In Progress (Theme Color)
                                                        }`}
                                                    style={{ width: `${opp.progressPercentage || 0}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs font-medium text-gray-700 min-w-[35px]">
                                                {opp.progressPercentage || 0}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Link
                                            to={`/opportunities/${opp._id}`}
                                            className="text-brand-blue hover:text-brand-gold font-medium"
                                        >
                                            Manage
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProgramExecutionList;
