import api from './axios';

export const hrPremiumAPI = {
    list:    ()               => api.get('/hr/premium-requests'),
    approve: (id)             => api.post(`/hr/premium-requests/${id}/approve`),
    dismiss: (id, reason)     => api.post(`/hr/premium-requests/${id}/dismiss`, { reason }),
};
