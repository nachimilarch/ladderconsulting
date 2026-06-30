import api from './axios';

export const adminCompanyAPI = {
    list: (params) => api.get('/admin/companies', { params }),
    getDetail: (id) => api.get(`/admin/companies/${id}`),
    approve: (id) => api.patch(`/admin/companies/${id}/approve`),
    reject: (id, data) => api.patch(`/admin/companies/${id}/reject`, data),
    suspend: (id, data) => api.patch(`/admin/companies/${id}/suspend`, data),
    reactivate: (id) => api.patch(`/admin/companies/${id}/reactivate`),
    remove: (id) => api.delete(`/admin/companies/${id}`),
    assignExecutive: (id, data) => api.patch(`/admin/companies/${id}/assign-executive`, data),
    listUnassigned: () => api.get('/admin/companies/unassigned'),
    listExecutiveAssignments: () => api.get('/admin/executive-assignments'),
    setPlacementFeeRate: (id, formData) => api.patch(`/admin/companies/${id}/placement-fee-rate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    downloadAgreement: (id) => api.get(`/admin/companies/${id}/agreement`, { responseType: 'blob' }),
};

export const adminRequestAPI = {
    list: (params) => api.get('/admin/requests', { params }),
    update: (id, data) => api.patch(`/admin/requests/${id}`, data),
    createInvoice: (data) => api.post('/admin/invoices', data),
    updateInvoiceStatus: (id, data) => api.patch(`/admin/invoices/${id}/status`, data),
};

export const adminCandidateAPI = {
    list: (params) => api.get('/admin/candidates', { params }),
    getDetail: (id) => api.get(`/admin/candidates/${id}`),
    suspend: (id, data) => api.patch(`/admin/candidates/${id}/suspend`, data),
    reactivate: (id) => api.patch(`/admin/candidates/${id}/reactivate`),
};

export const adminStaffAPI = {
    list: () => api.get('/admin/staff'),
    create: (data) => api.post('/admin/staff', data),
    update: (id, data) => api.put(`/admin/staff/${id}`, data),
    deactivate: (id) => api.patch(`/admin/staff/${id}/deactivate`),
    getPerformance: (id) => api.get(`/admin/staff/${id}/performance`),
};

export const adminRecruitmentAPI = {
    getOverview: () => api.get('/admin/recruitment/overview'),
    getPipeline: () => api.get('/admin/recruitment/pipeline'),
    getPlacements: () => api.get('/admin/recruitment/placements'),
};

export const adminAnalyticsAPI = {
    getSummary: () => api.get('/admin/analytics/summary'),
    getMonthly: () => api.get('/admin/analytics/monthly'),
    getConversion: () => api.get('/admin/analytics/conversion'),
    getExecutivePerformance: () => api.get('/admin/analytics/executive-performance'),
};

export const adminAuditAPI = {
    getLogs: (params) => api.get('/admin/audit-logs', { params }),
};

export const adminSettingsAPI = {
    get: () => api.get('/admin/settings'),
    update: (data) => api.patch('/admin/settings', data),
};

export const adminOfferRequestAPI = {
    listAll: (params) => api.get('/admin/offer-requests', { params }),
    listFees: (params) => api.get('/admin/placement-fees', { params }),
    approve: (id) => api.put(`/offer-requests/executive/${id}/approve`),
    reject: (id, rejection_reason) => api.put(`/offer-requests/executive/${id}/reject`, { rejection_reason }),
};
