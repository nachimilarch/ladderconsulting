import api from './axios';

export const profileAPI = {
    get: () => api.get('/candidates/profile'),
    save: (data) => api.post('/candidates/profile', data),
};

export const resumeAPI = {
    upload: (file) => {
        const formData = new FormData();
        formData.append('resume', file);
        return api.post('/candidates/resume', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    parse: () => api.post('/candidates/resume/parse'),
};

export const jobAPI = {
    getMatched: (params) => api.get('/jobs/matched', { params }),
};

export const applicationAPI = {
    getAll: () => api.get('/candidates/applications'),
    apply: (jobId, data) => api.post(`/candidates/applications/${jobId}`, data),
    withdraw: (appId) => api.patch(`/candidates/applications/${appId}/withdraw`),
};
