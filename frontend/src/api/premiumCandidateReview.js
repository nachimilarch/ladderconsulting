import api from './axios';

export const premiumCandidateReviewAPI = {
    list:    (status)        => api.get('/hr/premium-candidate-requests', { params: status ? { status } : {} }),
    detail:  (id)            => api.get(`/hr/premium-candidate-requests/${id}`),
    approve: (id)            => api.put(`/hr/premium-candidate-requests/${id}/approve`),
    reject:  (id, reason)    => api.put(`/hr/premium-candidate-requests/${id}/reject`, { reason }),
};
