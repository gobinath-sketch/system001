const fallbackBase = `${window.location.protocol}//${window.location.hostname}:5000`;

export const API_BASE = import.meta.env.VITE_API_URL || fallbackBase;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE;

// Central endpoint registry for maintainability.
export const API_ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
  },
  clients: {
    root: '/api/clients',
    checkDuplicate: '/api/clients/check-duplicate',
    byId: (id) => `/api/clients/${id}`,
  },
  opportunities: {
    root: '/api/opportunities',
    byId: (id) => `/api/opportunities/${id}`,
    status: (id) => `/api/opportunities/${id}/status`,
    progress: (id) => `/api/opportunities/${id}/progress`,
    uploadProposal: (id) => `/api/opportunities/${id}/upload-proposal`,
    uploadPO: (id) => `/api/opportunities/${id}/upload-po`,
    uploadInvoice: (id) => `/api/opportunities/${id}/upload-invoice`,
    uploadFinanceDoc: (id) => `/api/opportunities/${id}/upload-finance-doc`,
    uploadDeliveryDoc: (id) => `/api/opportunities/${id}/upload-delivery-doc`,
    uploadExpenseDoc: (id) => `/api/opportunities/${id}/upload-expense-doc`,
    escalate: (id) => `/api/opportunities/${id}/escalate`,
  },
  dashboard: {
    stats: '/api/dashboard/stats',
    clientHealth: '/api/dashboard/client-health',
    allOpportunities: '/api/dashboard/all-opportunities',
    monthlyTrends: '/api/dashboard/monthly-trends',
    recentOpportunities: '/api/dashboard/recent-opportunities',
    performance: (userId) => `/api/dashboard/performance/${userId}`,
    managerStats: '/api/dashboard/manager/stats',
    managerDocumentStats: '/api/dashboard/manager/document-stats',
    managerTeamMembers: '/api/dashboard/manager/team-members',
    managerMonthlyPerformance: '/api/dashboard/manager/monthly-performance',
    managerTeamPerformance: '/api/dashboard/manager/team-performance',
    managerDocuments: '/api/dashboard/manager/documents',
    managerSetTarget: (userId) => `/api/dashboard/manager/set-target/${userId}`,
    businessHeadTeam: '/api/dashboard/business-head/team-structure',
  },
  approvals: {
    root: '/api/approvals',
    approve: (id) => `/api/approvals/${id}/approve`,
    reject: (id) => `/api/approvals/${id}/reject`,
    read: (id) => `/api/approvals/${id}/read`,
    escalate: '/api/approvals/escalate',
  },
  notifications: {
    root: '/api/notifications',
    read: (id) => `/api/notifications/${id}/read`,
    readAll: '/api/notifications/read-all',
    byId: (id) => `/api/notifications/${id}`,
  },
  smes: {
    root: '/api/smes',
    byId: (id) => `/api/smes/${id}`,
  },
  reports: {
    gpAnalysis: '/api/reports/gp-analysis',
    vendorExpenses: '/api/reports/vendor-expenses',
  },
  settings: {
    me: '/api/settings/me',
    password: '/api/settings/me/password',
    resetPassword: '/api/settings/me/reset-password',
    sessionById: (sessionId) => `/api/settings/me/sessions/${sessionId}`,
    savePreset: '/api/settings/me/preferences/presets',
    syncLocale: '/api/settings/me/sync-locale',
    exportProfileCard: '/api/settings/me/export-profile-card',
  },
};

export const apiUrl = (path) => `${API_BASE}${path}`;
export const uploadUrl = (relativePath = '') => `${API_BASE}/${String(relativePath).replace(/^\/+/, '')}`;
