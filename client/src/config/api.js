const fallbackBase = `${window.location.protocol}//${window.location.hostname}:5000`;
const serverApiUrl = 'https://project.globalknowledgetech.com:5006';
const envBase = (import.meta.env.VITE_API_BASE || '').trim();
const isProductionHost = window.location.hostname === 'project.globalknowledgetech.com';
const resolvedBase = envBase || (isProductionHost ? serverApiUrl : fallbackBase);

export const API_BASE = resolvedBase;
export const SOCKET_URL = resolvedBase;

// Central endpoint registry for maintainability.
export const API_ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
  },
  users: {
    root: '/api/users',
    byId: (id) => `/api/users/${id}`,
    resetPassword: (id) => `/api/users/${id}/reset-password`,
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
    exportData: '/api/settings/me/export-data',
    requestDeactivation: '/api/settings/me/request-deactivation',
    exportProfileCard: '/api/settings/me/export-profile-card',
  },
  chat: {
    users: '/api/chat/users',
    conversations: '/api/chat/conversations',
    messagesByUser: (userId) => `/api/chat/messages/${userId}`,
    sendMessage: '/api/chat/messages',
    updateMessage: (messageId) => `/api/chat/messages/${messageId}`,
    deleteMessage: (messageId) => `/api/chat/messages/${messageId}`,
    forwardMessage: (messageId) => `/api/chat/messages/${messageId}/forward`,
    uploadConfig: '/api/chat/uploads/config',
    initiateUpload: '/api/chat/uploads/initiate',
    uploadChunk: (uploadId, index) => `/api/chat/uploads/${uploadId}/chunk?index=${index}`,
    completeUpload: (uploadId) => `/api/chat/uploads/${uploadId}/complete`,
    cancelUpload: (uploadId) => `/api/chat/uploads/${uploadId}`,
    markConversationRead: (userId) => `/api/chat/conversations/${userId}/read`,
  },
  emailAutomation: {
    health: '/api/email-automation/health',
    tokenCheck: '/api/email-automation/graph/token-check',
    ingestPull: '/api/email-automation/ingest/pull',
    ingestSelected: '/api/email-automation/ingest/selected',
    mailboxMessages: '/api/email-automation/mailbox/messages',
    mailboxMessageById: (id) => `/api/email-automation/mailbox/messages/${id}`,
    calendarEvents: '/api/email-automation/calendar/events',
    calendarEventById: (id) => `/api/email-automation/calendar/events/${id}`,
    teams: '/api/email-automation/teams',
    teamChannels: (teamId) => `/api/email-automation/teams/${teamId}/channels`,
    channelMessages: (teamId, channelId) => `/api/email-automation/teams/${teamId}/channels/${channelId}/messages`,
    chatsAuthUrl: '/api/email-automation/chats/auth/url',
    chats: '/api/email-automation/chats',
    chatMessages: (chatId) => `/api/email-automation/chats/${chatId}/messages`,
    queue: '/api/email-automation/queue',
    queueReview: (id) => `/api/email-automation/queue/${id}/review`,
    history: '/api/email-automation/history',
  },
};

export const apiUrl = (path) => `${API_BASE}${path}`;
export const uploadUrl = (relativePath = '') => `${API_BASE}/${String(relativePath).replace(/^\/+/, '')}`;


