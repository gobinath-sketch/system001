import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Filter, ArrowLeft, Edit, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDefaultRouteForRole } from '../utils/navigation';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import GPReportSection from '../components/reports/GPReportSection';
import CreateOpportunityModal from '../components/opportunity/CreateOpportunityModal';
import AlertModal from '../components/ui/AlertModal';
import { API_BASE } from '../config/api';
const OPPORTUNITY_DRAFTS_KEY = 'erp_opportunity_drafts_v1';

const loadOpportunityDrafts = () => {
  try {
    const raw = localStorage.getItem(OPPORTUNITY_DRAFTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load opportunity drafts:', error);
    return [];
  }
};

const persistOpportunityDrafts = drafts => {
  try {
    localStorage.setItem(OPPORTUNITY_DRAFTS_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error('Failed to persist opportunity drafts:', error);
  }
};
const OpportunityPage = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Add useLocation
  const {
    user
  } = useAuth();
  const {
    addToast
  } = useToast();
  const {
    socket
  } = useSocket();

  // Data States
  const [opportunities, setOpportunities] = useState([]);
  const [clientsById, setClientsById] = useState({});
  const [, setLoading] = useState(true);

  // UI States
  const [showForm, setShowForm] = useState(false);
  const [preselectedClientId, setPreselectedClientId] = useState(null); // New State
  const [activeDraft, setActiveDraft] = useState(null);
  const [opportunityDrafts, setOpportunityDrafts] = useState(() => loadOpportunityDrafts());
  const [showDraftsModal, setShowDraftsModal] = useState(false);

  // ... (rest of state)

  // Handle Navigation State
  useEffect(() => {
    if (location.state?.createOpportunity) {
      setActiveDraft(null);
      setShowForm(true);
      if (location.state.clientId) {
        setPreselectedClientId(location.state.clientId);
      }
      // Optional: Clear state to prevent reopening on refresh, but requires navigation replace
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // ... (rest of component)

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCreator, setFilterCreator] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, oppId: null });

  // Status Modal State
  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    oppId: null,
    newStatus: ''
  });
  useEffect(() => {
    fetchOpportunities();
    fetchClientDirectory();
  }, []);
  useEffect(() => {
    if (!socket) return;
    const handleEntityUpdated = event => {
      if (event?.entity === 'opportunity') {
        fetchOpportunities();
      }
    };
    socket.on('entity_updated', handleEntityUpdated);
    return () => socket.off('entity_updated', handleEntityUpdated);
  }, [socket]);
  const fetchOpportunities = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/api/opportunities`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setOpportunities(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching opportunities:', err);
      setLoading(false);
    }
  };
  const fetchClientDirectory = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/api/clients`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const mapped = (res.data || []).reduce((acc, client) => {
        if (client?._id) {
          acc[client._id] = client.companyName;
        }
        return acc;
      }, {});
      setClientsById(mapped);
    } catch (error) {
      console.error('Failed to load clients for draft labels:', error);
    }
  };

  // Role Helper
  const isDeliveryRole = ['Delivery Team', 'Delivery Head', 'Delivery Manager', 'Delivery Executive'].includes(user?.role);
  const isSalesRole = ['Sales Executive', 'Sales Manager', 'Super Admin'].includes(user?.role);

  // Delivery Status Change Handler
  const handleStatusChange = async (oppId, newStatus) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_BASE}/api/opportunities/${oppId}/status`, {
        status: newStatus
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      addToast('Status updated successfully', 'success');
      fetchOpportunities();
    } catch (error) {
      console.error('Status update failed', error);
      // Display specific validation message from backend (e.g. missing docs)
      const msg = error.response?.data?.message || 'Failed to update status';
      addToast(msg, 'error');
    }
  };

  const handleDeleteOpportunity = async (oppId) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.delete(`${API_BASE}/api/opportunities/${oppId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast('Opportunity deleted successfully', 'success');
      fetchOpportunities();
    } catch (err) {
      console.error('Error deleting opportunity:', err);
      const msg = err.response?.data?.message || 'Failed to delete opportunity';
      addToast(msg, 'error');
    }
  };

  // Filter Logic
  const filteredOpportunities = opportunities.filter(opp => {
    const matchesSearch = isDeliveryRole ? opp.opportunityNumber?.toLowerCase().includes(searchTerm.toLowerCase()) : opp.opportunityNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || opp.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || opp.client?.companyName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCreator = filterCreator ? opp.createdBy?.name === filterCreator : true;
    const matchesType = filterType ? opp.type === filterType : true;

    // Filter by Training Month and Year
    const matchesMonth = filterMonth ? opp.commonDetails?.monthOfTraining === filterMonth : true;
    const matchesYear = filterYear ? opp.commonDetails?.year?.toString() === filterYear : true;
    return matchesSearch && matchesCreator && matchesType && matchesMonth && matchesYear;
  });

  // Get unique creators for filter (Sales Manager only)
  const uniqueCreators = [...new Set(opportunities.map(o => o.createdBy?.name).filter(Boolean))];
  const handleDraftSave = draft => {
    if (!draft?.formData) return null;
    const nextDraft = {
      id: draft.id || `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      formData: draft.formData,
      updatedAt: new Date().toISOString()
    };
    setOpportunityDrafts(prevDrafts => {
      const nextDrafts = [nextDraft, ...prevDrafts.filter(item => item.id !== nextDraft.id)];
      persistOpportunityDrafts(nextDrafts);
      return nextDrafts;
    });
    return nextDraft;
  };
  const handleDraftDelete = draftId => {
    if (!draftId) return;
    setOpportunityDrafts(prevDrafts => {
      const nextDrafts = prevDrafts.filter(item => item.id !== draftId);
      persistOpportunityDrafts(nextDrafts);
      return nextDrafts;
    });
    if (activeDraft?.id === draftId) {
      setActiveDraft(null);
    }
  };
  const openDraftForEdit = draft => {
    setShowDraftsModal(false);
    setActiveDraft(draft);
    setPreselectedClientId(draft?.formData?.clientId || null);
    setShowForm(true);
  };
  return <div className="p-3 sm:p-5 relative">
    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 sm:mb-8 gap-3">
      <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
        <button onClick={() => {
          navigate(getDefaultRouteForRole(user?.role));
        }} className="h-10 w-10 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm transition-colors shrink-0" aria-label="Back">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary-blue truncate">Opportunity Management</h1>
      </div>
      {!isDeliveryRole && <button onClick={() => {
        setActiveDraft(null);
        setPreselectedClientId(null);
        setShowForm(true);
      }} className="bg-primary-blue text-white px-5 sm:px-7 py-3 sm:py-3.5 rounded-lg flex items-center justify-center space-x-2 hover:bg-opacity-90 shadow-md w-full sm:w-auto">
        <Plus size={18} />
        <span className="font-bold text-[15px]">Create Opportunity</span>
      </button>}
    </div>

    {/* GP Report Section - Only for Super Admin */}
    {user?.role === 'Super Admin' && <GPReportSection />}

    <CreateOpportunityModal isOpen={showForm} onClose={() => {
      setShowForm(false);
      setPreselectedClientId(null); // Reset on close
      setActiveDraft(null);
    }} onSuccess={fetchOpportunities} preselectedClientId={preselectedClientId} draftData={activeDraft} onDraftSave={handleDraftSave} onDraftDelete={handleDraftDelete} />

    {showDraftsModal && <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} onClick={() => setShowDraftsModal(false)}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b p-5 sm:p-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">Opportunity Drafts ({opportunityDrafts.length})</h2>
          <button onClick={() => setShowDraftsModal(false)} className="text-gray-500 hover:text-gray-700" aria-label="Close drafts modal">
            <X size={24} />
          </button>
        </div>
        <div className="p-5 sm:p-6">
          {opportunityDrafts.length > 0 ? <div className="overflow-x-auto">
            <table className="min-w-full text-left text-base">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-900">Client Name</th>
                  <th className="px-4 py-3 font-semibold text-gray-900">Opportunity Type</th>
                  <th className="px-4 py-3 font-semibold text-gray-900">Last Saved</th>
                  <th className="px-4 py-3 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {opportunityDrafts.map(draft => {
                  const clientName = clientsById[draft.formData?.clientId] || 'Client not selected';
                  return <tr key={draft.id}>
                    <td className="px-4 py-4 text-gray-900">{clientName}</td>
                    <td className="px-4 py-4 text-gray-700">{draft.formData?.type || 'Not selected'}</td>
                    <td className="px-4 py-4 text-gray-600">{new Date(draft.updatedAt).toLocaleString()}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => openDraftForEdit(draft)} className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-primary-blue text-white hover:bg-primary-blue-dark" title="Edit Draft" aria-label="Edit Draft">
                          <Edit size={16} />
                        </button>
                        <button type="button" onClick={() => handleDraftDelete(draft.id)} className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-red-500 text-white hover:bg-red-600" title="Delete Draft" aria-label="Delete Draft">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div> : <div className="text-sm text-gray-500">No drafts found.</div>}
        </div>
      </div>
    </div>}

    {/* Opportunity List Container */}
    <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm">
      {/* Table Header with Search & Count */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        {/* Left: Count */}
        <div className="w-full md:w-auto flex items-center gap-3">
          <h2 className="text-[18px] font-semibold text-gray-900">
            All Opportunities ({filteredOpportunities.length})
          </h2>
          {opportunityDrafts.length > 0 && <button type="button" onClick={() => setShowDraftsModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-red-300 bg-red-50 text-[14px] font-bold text-red-700 shadow-md hover:bg-red-100">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            You have unsaved drafts ({opportunityDrafts.length})
          </button>}
        </div>

        {/* Right: Search & Filters */}
        <div className="flex flex-1 items-center justify-end gap-2 w-full md:w-auto flex-wrap">
          <div className="relative w-full sm:w-64 md:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder={isDeliveryRole ? "Search by Opp ID..." : "Opp ID or Client..."} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue text-[14px]" />
          </div>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="pl-10 pr-9 py-2.5 border border-gray-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue text-[14px] cursor-pointer hover:bg-gray-50">
                <option value="">All Types</option>
                <option value="Training">Training</option>
                <option value="Vouchers">Vouchers</option>
                <option value="Lab Support">Lab Support</option>
                <option value="Resource Support">Resource Support</option>
                <option value="Content Development">Content Development</option>
                <option value="Product Support">Product Support</option>
              </select>
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="pl-10 pr-9 py-2.5 border border-gray-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue text-[14px] cursor-pointer hover:bg-gray-50">
                <option value="">All Months</option>
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="pl-10 pr-9 py-2.5 border border-gray-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue text-[14px] cursor-pointer hover:bg-gray-50">
                <option value="">All Years</option>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {(user?.role === 'Sales Manager' || isDeliveryRole) && <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <select value={filterCreator} onChange={e => setFilterCreator(e.target.value)} className="pl-10 pr-9 py-2.5 border border-gray-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue text-base cursor-pointer hover:bg-gray-50">
                <option value="">All Creators</option>
                {uniqueCreators.map((creator, idx) => <option key={idx} value={creator}>{creator}</option>)}
              </select>
            </div>}
          </div>
        </div>
      </div>

      <div className="overflow-auto h-[calc(100vh-240px)]">
        <table className="min-w-full text-left text-[16px] relative">
          <thead className="border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-2 font-semibold text-gray-900">Opp ID</th>
              <th className="px-6 py-2 font-semibold text-gray-900">Client</th>
              {isDeliveryRole ? <th className="px-6 py-2 font-semibold text-gray-900">Created By</th> : <>
                <th className="px-6 py-2 font-semibold text-gray-900">Contact Person</th>
                {['Sales Manager', 'Business Head'].includes(user?.role) && <th className="px-6 py-2 font-semibold text-gray-900">
                  Created By
                </th>}
              </>}
              <th className="px-6 py-2 font-semibold text-gray-900">Type</th>
              <th className="px-6 py-2 font-semibold text-gray-900">Progress</th>
              <th className="px-6 py-2 font-semibold text-gray-900 text-center">Approval Status</th>
              {isSalesRole && <th className="px-5 py-3.5 font-semibold text-gray-900 w-[80px] text-center">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredOpportunities.length > 0 ? filteredOpportunities.map(opp => {
              // Find full contact details from client data
              // Fallback to primary contact if specific selection is not found/available
              let contactDetails = opp.client?.contactPersons?.find(cp => cp.name === opp.selectedContactPerson);

              // If no specific contact found, try to find the primary one
              if (!contactDetails && opp.client?.contactPersons?.length > 0) {
                contactDetails = opp.client.contactPersons.find(cp => cp.isPrimary) || opp.client.contactPersons[0];
              }

              // Determine Approval Status Badge
              let statusBadge = null;
              const appStatus = opp.approvalStatus;
              if (appStatus === 'In Process') {
                statusBadge = <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200" title="Initial data entry and configuration in process.">
                  In Process
                </span>;
              } else if (!appStatus || appStatus === 'Pre Approved' || appStatus === 'Draft' || appStatus === 'No Approval Required' || appStatus === 'Not Required') {
                statusBadge = <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-teal-100 text-teal-800 border border-teal-200 cursor-help" title="No approval required. Within approved limits.">
                  Pre-Approved
                </span>;
              } else if (appStatus === 'Approved') {
                statusBadge = <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                  Approved
                </span>;
              } else if (appStatus === 'Rejected') {
                statusBadge = <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200">
                  Rejected
                </span>;
              } else if (['Pending Manager', 'Pending Director', 'Pending'].includes(appStatus) || appStatus?.toLowerCase().includes('pending')) {
                statusBadge = <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  Pending
                </span>;
              } else {
                // Fallback for unknown status
                statusBadge = <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 border border-gray-200">
                  {appStatus}
                </span>;
              }
              return <tr key={opp._id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/opportunities/${opp._id}`)}>
                <td className="px-6 py-2 font-bold text-gray-900">
                  {opp.opportunityNumber}
                </td>
                <td className="px-6 py-2">
                  <div className="font-medium text-gray-900">{opp.client?.companyName || opp.clientName || 'N/A'}</div>
                  <div className="text-sm text-gray-700">{opp.client?.sector}</div>
                </td>

                {isDeliveryRole ? <td className="px-6 py-2">
                  <div className="font-medium text-gray-900">{opp.createdBy?.name || 'N/A'}</div>
                </td> : <>
                  <td className="px-6 py-2">
                    {contactDetails ? <div className="flex flex-col">
                      <div className="font-medium text-gray-900">{contactDetails.name}</div>
                      <div className="text-sm text-gray-700">{contactDetails.designation}</div>
                    </div> : <div className="text-gray-500 italic">{opp.selectedContactPerson || 'N/A'}</div>}
                  </td>
                  {['Sales Manager', 'Business Head'].includes(user?.role) && <td className="px-6 py-2">
                    <div className="font-medium text-gray-900">{opp.createdBy?.name || 'N/A'}</div>
                  </td>}
                </>}
                <td className="px-6 py-2 text-gray-700">{opp.type}</td>

                {/* Progress Column */}
                <td className="px-6 py-2">
                  <div className="flex flex-col space-y-2 max-w-[170px]">
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500" style={{
                          width: `${opp.progressPercentage || 0}%`
                        }}></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{opp.progressPercentage || 0}%</span>
                    </div>

                    {/* Manual Status Override */}
                    <div onClick={e => e.stopPropagation()}>
                      <select className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-gray-50 hover:bg-white focus:ring-1 focus:ring-brand-blue" value={opp.commonDetails?.status || 'Active'} onChange={e => {
                        setStatusModal({
                          isOpen: true,
                          oppId: opp._id,
                          newStatus: e.target.value
                        });
                      }} disabled={!isSalesRole && !isDeliveryRole}>
                        <option value="Active">Active</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="Discontinued">Discontinued</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>
                </td>

                {/* Status Column (Approval Status) */}
                <td className="px-6 py-2 text-center">
                  {statusBadge}
                </td>

                {isSalesRole && <td className="px-5 py-4 text-center">
                  <div className="flex justify-center">
                    <button onClick={(e) => {
                      e.stopPropagation();
                      setDeleteModal({ isOpen: true, oppId: opp._id });
                    }} className="bg-red-100 hover:bg-red-200 text-red-600 transition-colors p-2 rounded-md" title="Delete Opportunity">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </td>}
              </tr>;
            }) : <tr>
              <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                No opportunities found matching your search.
              </td>
            </tr>}
          </tbody>
        </table>
      </div>
    </div>

    {/* Status Confirmation Modal */}
    <AlertModal isOpen={statusModal.isOpen} onClose={() => setStatusModal({
      ...statusModal,
      isOpen: false
    })} title="Confirm Status Change" message={`Are you sure you want to change the status to "${statusModal.newStatus}"?`} confirmText="Yes, Change Status" cancelText="No, Keep It" type="warning" onConfirm={() => {
      handleStatusChange(statusModal.oppId, statusModal.newStatus);
      setStatusModal({
        ...statusModal,
        isOpen: false
      });
    }} />

    {/* Delete Confirmation Modal */}
    <AlertModal
      isOpen={deleteModal.isOpen}
      onClose={() => setDeleteModal({ isOpen: false, oppId: null })}
      title="Delete Opportunity"
      message="Are you sure you want to delete this opportunity? This action will remove the opportunity from your view and notify your reporting manager."
      confirmText="Yes, Delete"
      cancelText="Cancel"
      type="danger"
      onConfirm={() => {
        handleDeleteOpportunity(deleteModal.oppId);
        setDeleteModal({ isOpen: false, oppId: null });
      }}
    />
  </div>;
};
export default OpportunityPage;
