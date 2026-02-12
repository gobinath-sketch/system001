import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Edit, Search, Filter, FileText, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AddSMEModal from '../components/sme/AddSMEModal';
import ViewSMEModal from '../components/sme/ViewSMEModal';

const SMEManagement = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addToast } = useToast();
    const [smes, setSmes] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedSme, setSelectedSme] = useState(null); // Used for both Edit and View
    const [smeToEdit, setSmeToEdit] = useState(null);

    // Filters
    const [filters, setFilters] = useState({
        search: '',
        type: '' // 'Company' or 'Freelancer'
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

    const handleAddClick = () => {
        setSmeToEdit(null);
        setIsAddEditModalOpen(true);
    };

    const handleEditClick = (sme, e) => {
        e.stopPropagation();
        setSmeToEdit(sme);
        setIsAddEditModalOpen(true);
    };

    const handleViewClick = (sme, e) => {
        e.stopPropagation();
        setSelectedSme(sme); // Use selectedSme for viewing
        setIsViewModalOpen(true);
    };

    const handleModalSuccess = () => {
        fetchSMEs();
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this SME?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:5000/api/smes/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            addToast('SME deleted successfully', 'success');
            fetchSMEs();
        } catch (err) {
            addToast('Error deleting SME', 'error');
        }
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
                <button
                    onClick={handleAddClick}
                    className="bg-brand-blue text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-opacity-90 shadow-md transition-colors"
                >
                    <Plus size={18} /> Add SME
                </button>
            </div>

            {/* List View */}
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
                                    <tr key={sme._id} className="hover:bg-gray-50 transition-colors">
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
                                            <div className="flex items-center justify-center gap-4">
                                                <button
                                                    onClick={(e) => handleViewClick(sme, e)}
                                                    className="text-blue-600 hover:text-blue-800 transition-transform hover:scale-110"
                                                    title="View"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleEditClick(sme, e)}
                                                    className="text-green-600 hover:text-green-800 transition-transform hover:scale-110"
                                                    title="Edit"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(sme._id, e)}
                                                    className="text-red-600 hover:text-red-800 transition-transform hover:scale-110"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            <AddSMEModal
                isOpen={isAddEditModalOpen}
                onClose={() => setIsAddEditModalOpen(false)}
                onSuccess={handleModalSuccess}
                smeToEdit={smeToEdit}
            />

            <ViewSMEModal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                sme={selectedSme}
            />
        </div>
    );
};

export default SMEManagement;
