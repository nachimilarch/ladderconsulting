import api from './axios';

export const trainingServiceAPI = {
    getCatalogue:   ()         => api.get('/training-services/catalogue'),
    request:        (data)     => api.post('/training-services/request', data),
    getMyRequests:  ()         => api.get('/training-services/my-requests'),
};

export const adminTrainingServiceAPI = {
    getCatalogue:        ()           => api.get('/training-services/catalogue'),
    createCatalogueItem: (data)       => api.post('/training-services/admin/catalogue', data),
    updateCatalogueItem: (id, data)   => api.put(`/training-services/admin/catalogue/${id}`, data),
    toggleCatalogueItem: (id)         => api.patch(`/training-services/admin/catalogue/${id}/toggle`),
    listRequests:        (params)     => api.get('/training-services/admin', { params }),
    approveRequest:      (id, data)   => api.put(`/training-services/admin/${id}/approve`, data),
    rejectRequest:       (id, data)   => api.put(`/training-services/admin/${id}/reject`, data),
};
