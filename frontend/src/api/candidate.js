import api from './axios';

export const profileAPI = {
    get: () => api.get('/candidates/profile'),
    save: (data) => api.post('/candidates/profile', data),
};

export const resumeAPI = {
    upload: (formData, onProgress) =>
        api.post('/candidates/resume', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (e) =>
                onProgress && onProgress(Math.round((e.loaded * 100) / e.total)),
        }),
    get: () => api.get('/candidates/resume'),
    download: () =>
        api.get('/candidates/resume/download', { responseType: 'blob' }),
    parse: () => api.post('/candidates/resume/parse'),
    extractProfile: () => api.post('/candidates/resume/extract-profile'),
};

export const jobAPI = {
    getJobs: (params) => api.get('/candidates/jobs', { params }),
    getMatched: (params) => api.get('/jobs/matched', { params }),
};

export const applicationAPI = {
    getAll: () => api.get('/candidates/applications'),
    apply: (jobId, data = {}) => api.post(`/candidates/applications/${jobId}`, data),
    withdraw: (appId) => api.patch(`/candidates/applications/${appId}/withdraw`),
};

export const aiAPI = {
    triggerResumeMatch: () => api.post('/candidates/resume/parse'),
    getMatchResults: (candidateId) => api.get(`/ai/match-results/${candidateId}`),
};

export const documentAPI = {
    list: () => api.get('/candidates/documents'),
    upload: (formData) => api.post('/candidates/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    remove: (id) => api.delete(`/candidates/documents/${id}`),
};
