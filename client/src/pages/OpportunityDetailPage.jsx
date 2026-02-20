import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Edit, Save, X, FileText, Calendar, User, GraduationCap, Handshake } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';

// Import Tabs
import OverviewTab from '../components/opportunity/tabs/OverviewTab';
import SalesTab from '../components/opportunity/tabs/SalesTab';
import DeliveryTab from '../components/opportunity/tabs/DeliveryTab';
import BillingTab from '../components/opportunity/tabs/BillingTab';
import RevenueTab from '../components/opportunity/tabs/RevenueTab';
import VendorPayablesTab from '../components/opportunity/tabs/VendorPayablesTab';
import { useCurrency } from '../context/CurrencyContext';
import AlertModal from '../components/ui/AlertModal';
import { API_BASE } from '../config/api';
const OpportunityDetailPage = () => {
  const {
    id
  } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user
  } = useAuth();
  const {
    addToast
  } = useToast();
  const {
    socket
  } = useSocket();

  // State
  const [opportunity, setOpportunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [tabLoading, setTabLoading] = useState(false); // To prevent double clicks or race conditions during save
  useCurrency();
  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    newStatus: ''
  });

  // Refs for tabs to call their internal save/cancel methods
  const salesRef = useRef();
  const deliveryRef = useRef();
  const billingRef = useRef();
  const revenueRef = useRef();
  const vendorPayablesRef = useRef();

  // Permissions Helper
  const isOwner = opportunity && (opportunity.createdBy?._id === user.id || opportunity.createdBy === user.id);
  let canEditSales = user.role === 'Super Admin';

  // For all Sales roles (Exec, Manager, Business Head), edit permission is restricted to the owner
  if (['Sales Executive', 'Sales Manager', 'Business Head'].includes(user.role)) {
    canEditSales = isOwner;
  }

  // Use state-based permission if opportunity is loading? No, if loading returns loading div.
  // However, canEditSales is currently defined at top level.
  // I need to replace lines 37-37 entirely.
  const canEditDelivery = user.role === 'Delivery Head' || user.role === 'Delivery Manager' || user.role === 'Delivery Team' || user.role === 'Super Admin';

  // Tab Visibility
  const isDeliveryRole = ['Delivery Team', 'Delivery Head', 'Delivery Manager'].includes(user.role);
  const isSalesRole = ['Sales Executive', 'Sales Manager', 'Business Head'].includes(user.role);
  const isAdminOrDirector = ['Super Admin', 'Director'].includes(user.role);
  const showOverviewTab = isAdminOrDirector; // Only Admin/Director can see Overview
  const showSalesTab = !isDeliveryRole || isAdminOrDirector;
  const showDeliveryTab = !isSalesRole || isAdminOrDirector;
  const showVendorPayablesTab = isDeliveryRole || isAdminOrDirector;

  // determine if current tab is editable
  const isCurrentTabEditable = () => {
    if (activeTab === 'sales') return canEditSales;
    if (activeTab === 'delivery') return canEditDelivery;
    if (activeTab === 'billing') return canEditDelivery || canEditSales;
    if (activeTab === 'vendor') return canEditDelivery;
    if (activeTab === 'revenue') return canEditSales;
    return false;
  };

  // Set default tab based on role
  useEffect(() => {
    if (isDeliveryRole && !isAdminOrDirector && activeTab === 'overview') {
      setActiveTab('delivery');
    }
    if (isSalesRole && !isAdminOrDirector && activeTab === 'overview') {
      setActiveTab('sales');
    }
  }, [isDeliveryRole, isSalesRole, isAdminOrDirector]);

  // Fetch Opportunity Data
  const fetchOpportunity = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/api/opportunities/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setOpportunity(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching opportunity:', error);
      addToast('Failed to load opportunity details', 'error');
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchOpportunity();
  }, [id]);
  useEffect(() => {
    if (!socket) return;
    const handleEntityUpdated = event => {
      if (event?.entity !== 'opportunity') return;
      if (event?.id && event.id !== id) return;
      fetchOpportunity();
    };
    socket.on('entity_updated', handleEntityUpdated);
    return () => socket.off('entity_updated', handleEntityUpdated);
  }, [socket, id]);

  // Separate effect for handling navigation state
  useEffect(() => {
    // Check for tab navigation from notification
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
      // Force refresh to get latest data when coming from notification
      fetchOpportunity();
    }
  }, [location.state]);
  const handleBack = () => {
    navigate('/opportunities');
  };
  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!opportunity) return <div className="p-8 text-center">Opportunity not found</div>;
  const handleEdit = () => {
    setIsEditing(true);
  };
  const handleSave = async () => {
    setTabLoading(true);
    let success = false;
    try {
      if (activeTab === 'sales' && salesRef.current) {
        success = await salesRef.current.handleSave();
      } else if (activeTab === 'delivery' && deliveryRef.current) {
        success = await deliveryRef.current.handleSave();
      } else if (activeTab === 'billing' && billingRef.current) {
        success = await billingRef.current.handleSave();
      } else if (activeTab === 'revenue' && revenueRef.current) {
        success = await revenueRef.current.handleSave();
      } else if (activeTab === 'vendor' && vendorPayablesRef.current) {
        success = await vendorPayablesRef.current.handleSave();
      }
      if (success) {
        setIsEditing(false);
        // Refresh is handled by the child tab calling refreshData, but we can also fetch here if needed
      }
    } catch (error) {
      console.error("Error saving tab", error);
    } finally {
      setTabLoading(false);
    }
  };
  const handleCancel = () => {
    if (activeTab === 'sales' && salesRef.current) {
      salesRef.current.handleCancel();
    } else if (activeTab === 'delivery' && deliveryRef.current) {
      deliveryRef.current.handleCancel();
    } else if (activeTab === 'billing' && billingRef.current) {
      billingRef.current.handleCancel();
    } else if (activeTab === 'revenue' && revenueRef.current) {
      revenueRef.current.handleCancel();
    } else if (activeTab === 'vendor' && vendorPayablesRef.current) {
      vendorPayablesRef.current.handleCancel();
    }
    setIsEditing(false);
  };

  // Reset edit mode when changing tabs
  const handleTabChange = tab => {
    if (isEditing) {
      if (window.confirm("You have unsaved changes. Are you sure you want to switch tabs? Changes will be lost.")) {
        handleCancel();
        setActiveTab(tab);
      }
    } else {
      setActiveTab(tab);
    }
  };

  // Direct Status Update for Overview Tab
  const handleStatusChangeRequest = newStatus => {
    setStatusModal({
      isOpen: true,
      newStatus
    });
  };
  const executeStatusUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE}/api/opportunities/${id}/status`, {
        status: statusModal.newStatus
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      addToast('Status updated successfully', 'success');
      fetchOpportunity();
      setStatusModal({
        isOpen: false,
        newStatus: ''
      });
    } catch (error) {
      console.error('Error updating status:', error);
      // Show specific error from backend (missing docs)
      const msg = error.response?.data?.message || 'Failed to update status';
      addToast(msg, 'error');
      setStatusModal({
        isOpen: false,
        newStatus: ''
      });
    }
  };

  // Render Active Tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab opportunity={opportunity} user={user} updateStatus={handleStatusChangeRequest} />;
      case 'sales':
        return <SalesTab ref={salesRef} opportunity={opportunity} canEdit={canEditSales} isEditing={isEditing} refreshData={fetchOpportunity} />;
      case 'delivery':
        return <DeliveryTab ref={deliveryRef} opportunity={opportunity} canEdit={canEditDelivery} isEditing={isEditing} canViewClient={canEditSales} // Sales can see client info
        refreshData={fetchOpportunity} />;
      case 'billing':
        return <BillingTab ref={billingRef} opportunity={opportunity} canEdit={canEditDelivery || canEditSales} // Both can edit, specific sections restricted inside
        isEditing={isEditing} refreshData={fetchOpportunity} />;
      case 'vendor':
        return <VendorPayablesTab ref={vendorPayablesRef} opportunity={opportunity} canEdit={canEditDelivery && isEditing} isEditing={isEditing} refreshData={fetchOpportunity} />;
      case 'revenue':
        return <RevenueTab ref={revenueRef} opportunity={opportunity} canEdit={canEditSales} // Revenue/PO edits allowed for Sales
        isEditing={isEditing} refreshData={fetchOpportunity} />;
      default:
        return null;
    }
  };
  return <div className="p-3 sm:p-6 bg-gray-50 h-full font-inter flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div className="flex items-center min-w-0 w-full">
                    <button onClick={handleBack} className="mr-4 h-10 w-10 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm transition-colors shrink-0" aria-label="Back">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex items-center gap-4 sm:gap-6 flex-1 ml-1 sm:ml-4 overflow-x-auto pb-1">
                        {/* Block 1: Opp ID */}
                        <div className="flex items-center gap-3 min-w-max">
                            <div className="p-2 bg-[#003D7A]/10 rounded-lg text-[#003D7A]">
                                <FileText size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Opp ID</p>
                                <p className="font-bold text-gray-900">{opportunity.opportunityNumber}</p>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-8 w-px bg-gray-200"></div>

                        {/* Block: Created By (Only for Managers/Delivery/Director) */}
                        {(user.role === 'Sales Manager' || user.role === 'Super Admin' || user.role === 'Director' || user.role.startsWith('Delivery')) && <>
                                <div className="flex items-center gap-3 min-w-max">
                                    <div className="p-2 bg-[#003D7A]/10 rounded-lg text-[#003D7A]">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Created By</p>
                                        <p className="font-bold text-gray-900">{opportunity.createdBy?.name || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="h-8 w-px bg-gray-200"></div>
                            </>}

                        {/* Block 3: Client */}
                        <div className="flex items-center gap-3 min-w-max">
                            <div className="p-2 bg-[#003D7A]/10 rounded-lg text-[#003D7A]">
                                <Handshake size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Client</p>
                                <p className="font-bold text-gray-900 truncate max-w-[160px] sm:max-w-[200px]" title={opportunity.client?.companyName || opportunity.clientName}>
                                    {opportunity.client?.companyName || opportunity.clientName || 'Unknown'}
                                </p>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-8 w-px bg-gray-200"></div>

                        {/* Block 4: Category/Type */}
                        <div className="flex items-center gap-3 min-w-max">
                            <div className="p-2 bg-[#003D7A]/10 rounded-lg text-[#003D7A]">
                                <GraduationCap size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Category</p>
                                <p className="font-bold text-gray-900">{opportunity.type}</p>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-8 w-px bg-gray-200"></div>

                        {/* Block 5: Created Date */}
                        <div className="flex items-center gap-3 min-w-max">
                            <div className="p-2 bg-[#003D7A]/10 rounded-lg text-[#003D7A]">
                                <Calendar size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Created</p>
                                <p className="font-bold text-gray-900">
                                    {new Date(opportunity.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-8 w-px bg-gray-200"></div>

                        {/* Block 2: Status (Moved to End) */}
                        <div className="flex items-center gap-3 min-w-max">
                            <div className={`w-9 h-9 flex items-center justify-center rounded-lg text-xs font-bold border ${opportunity.progressPercentage === 100 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-[#003D7A]/10 text-[#003D7A] border-[#003D7A]/20'}`}>
                                {opportunity.progressPercentage}%
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Status</p>
                                <p className={`font-bold text-sm ${opportunity.progressPercentage === 100 ? 'text-green-700' : 'text-[#003D7A]'}`}>
                                    {opportunity.statusLabel || 'Scheduled'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-1 min-h-0 flex flex-col">
                <div className="flex border-b border-gray-200 justify-between items-start sm:items-center bg-white px-2 gap-2">
                    <div className="flex space-x-1 overflow-x-auto min-w-0">
                        {showOverviewTab && <button className={`px-4 sm:px-6 py-3 sm:py-4 text-base font-semibold focus:outline-none transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-white text-blue-700 border-b-2 border-blue-600 font-bold' : 'text-gray-700 border-b-2 border-transparent hover:text-gray-900 hover:bg-gray-50'}`} onClick={() => handleTabChange('overview')}>
                                Overview
                            </button>}
                        {showSalesTab && <button className={`px-4 sm:px-6 py-3 sm:py-4 text-base font-semibold focus:outline-none transition-all whitespace-nowrap ${activeTab === 'sales' ? 'bg-white text-blue-700 border-b-2 border-blue-600 font-bold' : 'text-gray-700 border-b-2 border-transparent hover:text-gray-900 hover:bg-gray-50'}`} onClick={() => handleTabChange('sales')}>
                                Requirements
                            </button>}
                        {showDeliveryTab && <button className={`px-4 sm:px-6 py-3 sm:py-4 text-base font-semibold focus:outline-none transition-all whitespace-nowrap ${activeTab === 'delivery' ? 'bg-white text-blue-700 border-b-2 border-blue-600 font-bold' : 'text-gray-700 border-b-2 border-transparent hover:text-gray-900 hover:bg-gray-50'}`} onClick={() => handleTabChange('delivery')}>
                                Requirements
                            </button>}
                        <button className={`px-4 sm:px-6 py-3 sm:py-4 text-base font-semibold focus:outline-none transition-all whitespace-nowrap ${activeTab === 'billing' ? 'bg-white text-blue-700 border-b-2 border-blue-600 font-bold' : 'text-gray-700 border-b-2 border-transparent hover:text-gray-900 hover:bg-gray-50'}`} onClick={() => handleTabChange('billing')}>
                            {isDeliveryRole ? 'Billing' : 'Proposal Calculations'}
                        </button>
                        {showVendorPayablesTab && <button className={`px-4 sm:px-6 py-3 sm:py-4 text-base font-semibold focus:outline-none transition-all whitespace-nowrap ${activeTab === 'vendor' ? 'bg-white text-blue-700 border-b-2 border-blue-600 font-bold' : 'text-gray-700 border-b-2 border-transparent hover:text-gray-900 hover:bg-gray-50'}`} onClick={() => handleTabChange('vendor')}>
                                Vendor Payables
                            </button>}
                        {showSalesTab && <button className={`px-4 sm:px-6 py-3 sm:py-4 text-base font-semibold focus:outline-none transition-all whitespace-nowrap ${activeTab === 'revenue' ? 'bg-white text-blue-700 border-b-2 border-blue-600 font-bold' : 'text-gray-700 border-b-2 border-transparent hover:text-gray-900 hover:bg-gray-50'}`} onClick={() => handleTabChange('revenue')}>
                                PO/Invoice
                            </button>}
                    </div>

                    {/* Global Edit/Save Actions */}
                    {isCurrentTabEditable() && activeTab !== 'overview' && <div className="flex items-center gap-2 pr-2 sm:pr-4 flex-wrap justify-end">
                            {/* Currency Toggle moved to global header */}

                            {!isEditing ? <button onClick={handleEdit} className="flex items-center gap-1.5 bg-brand-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-semibold text-base shadow-sm">
                                    <Edit size={16} />
                                    Edit Details
                                </button> : <>
                                    <button onClick={handleCancel} className="flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-base" disabled={tabLoading}>
                                        <X size={16} />
                                        Cancel
                                    </button>
                                    <button onClick={handleSave} className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-semibold text-base shadow-sm" disabled={tabLoading}>
                                        <Save size={16} />
                                        {tabLoading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </>}
                        </div>}
                </div>

                {/* Tab Content */}
                <div className="p-3 sm:p-6 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                    {renderTabContent()}
                </div>
            </div>

            {/* Status Confirmation Modal */}
            <AlertModal isOpen={statusModal.isOpen} onClose={() => setStatusModal({
      ...statusModal,
      isOpen: false
    })} title="Confirm Status Change" message={`Are you sure you want to change the status to "${statusModal.newStatus}"?`} confirmText="Yes, Change Status" cancelText="No, Keep It" type="warning" onConfirm={executeStatusUpdate} />
        </div>;
};
export default OpportunityDetailPage;
