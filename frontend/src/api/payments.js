import api from './axios';

export const hrInvoiceAPI = {
    list: (params) => api.get('/invoices/exec', { params }),
    companies: () => api.get('/invoices/exec/companies'),
    create: (data) => api.post('/invoices/exec', data),
    get: (id) => api.get(`/invoices/exec/${id}`),
    update: (id, data) => api.put(`/invoices/exec/${id}`, data),
    remove: (id) => api.delete(`/invoices/exec/${id}`),
    markPaid: (id, data) => api.put(`/invoices/exec/${id}/mark-paid`, data),
    markPartial: (id, data) => api.put(`/invoices/exec/${id}/mark-partial`, data),
};

export const companyInvoiceAPI = {
    list: () => api.get('/invoices/company'),
    placementFeeSummary: () => api.get('/invoices/company/placement-fees/summary'),
    get: (id) => api.get(`/invoices/company/${id}`),
    pay: (id, data) => api.post(`/invoices/company/${id}/pay`, data),
};

export const adminInvoiceAPI = {
    list: (params) => api.get('/admin/invoices', { params }),
    summary: () => api.get('/admin/invoices/summary'),
};

export const paymentAPI = {
    verify: (cashfreeOrderId) => api.get(`/payments/verify/${cashfreeOrderId}`),
};

export const interviewRequestAPI = {
    // Company
    submit: (data) => api.post('/interview-requests', data),
    getStatus: (applicationId) => api.get('/interview-requests', { params: { applicationId } }),
    reschedule: (id, data) => api.post(`/interview-requests/${id}/reschedule`, data),
    // Executive / Admin
    listExec: (params) => api.get('/interview-requests/executive', { params }),
    getExecDetail: (id) => api.get(`/interview-requests/executive/${id}`),
    approve: (id, data) => api.put(`/interview-requests/executive/${id}/approve`, data),
    reject: (id, data) => api.put(`/interview-requests/executive/${id}/reject`, data),
    // Executive: scheduled (confirmed/upcoming) interviews + confirm-on-behalf
    listScheduled: (params) => api.get('/interview-requests/executive/scheduled', { params }),
    confirmSlot: (slotId) => api.patch(`/interview-requests/executive/slots/${slotId}/confirm`),
};
