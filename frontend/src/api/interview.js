import api from './axios';

export const companyInterviewAPI = {
    // Companies cannot create slots directly — use interviewRequestAPI.submit
    // (executive approval flow). Slots are created only on executive approval.
    listSlots: (params) => api.get('/interviews/slots', { params }),
    cancelSlot: (slotId) => api.patch(`/interviews/slots/${slotId}/cancel`),
    recordOutcome: (slotId, data) => api.post(`/interviews/${slotId}/outcome`, data),
    generateOffer: (slotId, data) => api.post(`/interviews/${slotId}/offer`, data),
};

export const offerRequestAPI = {
    submit: (data) => api.post('/offer-requests', data),
    getStatus: (applicationId) => api.get(`/offer-requests/${applicationId}/status`),
    // Executive
    listExec: (params) => api.get('/offer-requests/executive', { params }),
    getExecDetail: (id) => api.get(`/offer-requests/executive/${id}`),
    approve: (id) => api.put(`/offer-requests/executive/${id}/approve`),
    reject: (id, rejection_reason) => api.put(`/offer-requests/executive/${id}/reject`, { rejection_reason }),
};

export const candidateInterviewAPI = {
    getMyInterviews: () => api.get('/interviews/my'),
    confirmSlot: (slotId) => api.patch(`/interviews/slots/${slotId}/confirm`),
    requestReschedule: (slotId, data) => api.patch(`/interviews/slots/${slotId}/reschedule`, data),
    getMyOffers: () => api.get('/interviews/offers/my'),
    respondToOffer: (offerId, data) => api.patch(`/interviews/offers/${offerId}/respond`, data),
};
