import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Edit, Search, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import AddSMEModal from '../components/sme/AddSMEModal';
import ViewSMEModal from '../components/sme/ViewSMEModal';
import { API_BASE } from '../config/api';
const SMEManagement = () => {
  const navigate = useNavigate();
  useAuth();
  const {
    addToast
  } = useToast();
  const {
    socket
  } = useSocket();
  const [smes, setSmes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal State
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedSme, setSelectedSme] = useState(null); // Used for both Edit and View
  const [smeToEdit, setSmeToEdit] = useState(null);

  // Filters
  const [activeTab, setActiveTab] = useState('All SMEs'); // 'All SMEs', 'Internal', 'External'
  const [filters, setFilters] = useState({
    search: '',
    type: '', // 'Company' or 'Freelancer'
    status: '' // Availability status
  });
  useEffect(() => {
    fetchSMEs();
  }, [filters, activeTab]);
  useEffect(() => {
    if (!socket) return;
    const handleEntityUpdated = event => {
      if (event?.entity === 'sme') {
        fetchSMEs();
      }
    };
    socket.on('entity_updated', handleEntityUpdated);
    return () => socket.off('entity_updated', handleEntityUpdated);
  }, [socket, filters, activeTab]);
  const fetchSMEs = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('token');
      const queryParams = new URLSearchParams();
      if (activeTab !== 'All SMEs') queryParams.append('classification', activeTab);
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.type) queryParams.append('type', filters.type);
      if (filters.status) queryParams.append('status', filters.status);
      const res = await axios.get(`${API_BASE}/api/smes?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setSmes(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching SMEs:', err);
      setLoading(false);
    }
  };
  const handleFilterChange = e => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
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
      const token = sessionStorage.getItem('token');
      await axios.delete(`${API_BASE}/api/smes/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      addToast('SME deleted successfully', 'success');
      fetchSMEs();
    } catch {
      addToast('Error deleting SME', 'error');
    }
  };
  return <div className="p-3 sm:p-5">
    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-3">
      <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
        <button onClick={() => navigate('/dashboard/delivery')} className="h-10 w-10 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm transition-colors shrink-0" aria-label="Back">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary-blue truncate">SME Management</h1>
      </div>
      <button onClick={handleAddClick} className="bg-primary-blue text-white px-5 sm:px-7 py-3 sm:py-3.5 rounded-lg flex items-center justify-center space-x-2 hover:bg-opacity-90 shadow-md w-full sm:w-auto">
        <Plus size={18} />
        <span className="font-bold text-[15px]">Add SME</span>
      </button>
    </div>

    {/* List View */}
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Tabs Layout */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-1 sm:space-x-8 px-4" aria-label="Tabs">
          {['All SMEs', 'Internal', 'External'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setFilters({ ...filters, type: '' }); // reset type filter on tab change
              }}
              className={`
                whitespace-nowrap py-4 px-1 sm:px-3 border-b-2 font-semibold text-[14px] sm:text-[15px]
                transition-colors 
                ${activeTab === tab 
                  ? 'border-brand-blue text-brand-blue' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Table Header with Search & Filters */}
      <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
        <h2 className="text-[18px] font-semibold text-gray-900 hidden sm:block">
          {activeTab} <span className="text-gray-500">({smes.length})</span>
        </h2>
        <div className="flex flex-1 items-center justify-end gap-3 w-full md:w-auto flex-wrap">
            <div className="relative w-full sm:w-64 md:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input name="search" value={filters.search} onChange={handleFilterChange} placeholder="Search SMEs..." className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue text-[14px]" />
          </div>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            {/* Availability Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <select name="status" value={filters.status} onChange={handleFilterChange} className="pl-10 pr-9 py-2.5 border border-gray-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue text-[14px] cursor-pointer hover:bg-gray-50">
                <option value="">Any Availability</option>
                <option value="Available">Available</option>
                <option value="Engaged">Engaged</option>
                <option value="Not Available">Not Available</option>
              </select>
            </div>

            {/* Type Filter - Only relevant for All SMEs and External */}
            {activeTab !== 'Internal' && (
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <select name="type" value={filters.type} onChange={handleFilterChange} className="pl-10 pr-9 py-2.5 border border-gray-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue text-[14px] cursor-pointer hover:bg-gray-50">
                  <option value="">All Types</option>
                  <option value="Company">Company</option>
                  <option value="Freelancer">Freelancer</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[16px] relative">
          <thead className="border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-2 font-semibold text-gray-900 text-center">Type</th>
              <th className="px-6 py-2 font-semibold text-gray-900 text-center">SME Name</th>
              <th className="px-6 py-2 font-semibold text-gray-900 text-center">Status</th>
              <th className="px-6 py-2 font-semibold text-gray-900 text-center">Company Name</th>
              <th className="px-6 py-2 font-semibold text-gray-900 text-center">Contact</th>
              <th className="px-6 py-2 font-semibold text-gray-900 text-center">Email</th>
              <th className="px-6 py-2 font-semibold text-gray-900 text-center">Location</th>
              <th className="px-6 py-2 font-semibold text-gray-900 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr> : smes.length === 0 ? <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">No SMEs found</td></tr> : smes.map(sme => <tr key={sme._id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={e => handleViewClick(sme, e)}>
              <td className="px-6 py-2 text-center">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[14px] font-medium border ${
                  sme.classification === 'Internal' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                  sme.smeType === 'Company' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
                  {sme.classification === 'Internal' ? 'Internal' : (sme.smeType || 'Freelancer')}
                </span>
              </td>
              <td className="px-6 py-2 font-bold text-gray-900 text-center">{sme.name}</td>
              <td className="px-6 py-2 text-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${
                  sme.availability?.currentStatus === 'Available' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                  sme.availability?.currentStatus === 'Engaged' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                  'bg-red-100 text-red-800 border-red-200'}`}>
                  {sme.availability?.currentStatus || 'Available'}
                </span>
              </td>
              <td className="px-6 py-2 text-gray-700 text-center">
                {sme.smeType === 'Company' ? sme.companyName || 'N/A' : '-'}
              </td>
              <td className="px-6 py-2 text-gray-700 text-center">{sme.contactNumber}</td>
              <td className="px-6 py-2 text-gray-700 text-center">{sme.email}</td>
              <td className="px-6 py-2 text-gray-700 text-center">{sme.location}</td>
              <td className="px-6 py-2 text-center">
                <div className="flex items-center justify-center gap-4">
                  <button onClick={e => handleEditClick(sme, e)} className="text-green-600 hover:text-green-800 transition-transform hover:scale-110" title="Edit">
                    <Edit size={18} />
                  </button>
                  <button onClick={e => handleDelete(sme._id, e)} className="text-red-600 hover:text-red-800 transition-transform hover:scale-110" title="Delete">
                    <Trash2 size={18} />
                  </button>
                </div>
              </td>
            </tr>)}
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
      defaultClassification={activeTab === 'Internal' ? 'Internal' : 'External'} 
    />

    <ViewSMEModal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} sme={selectedSme} />
  </div>;
};
export default SMEManagement;
