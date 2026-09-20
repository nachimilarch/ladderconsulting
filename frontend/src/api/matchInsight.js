import api from './axios';

export const matchInsightAPI = {
    get:     (jobId, candidateId) => api.get('/match-insights', { params: { jobId, candidateId } }),
    request: (jobId, candidateId) => api.post('/match-insights', { jobId, candidateId }),
};
