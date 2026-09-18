import api from './axios';

export const companyAPI = {
    getProfile:    ()         => api.get('/companies/me'),
    updateProfile: (data)     => api.put('/companies/me', data),
    getDashboard:  ()         => api.get('/companies/dashboard'),
};

export const companyJobAPI = {
    list:       ()            => api.get('/jobs'),
    create:     (data)        => api.post('/jobs', data),
    get:        (id)          => api.get(`/jobs/${id}`),
    update:     (id, data)    => api.put(`/jobs/${id}`, data),
    setStatus:  (id, status)  => api.patch(`/jobs/${id}/status`, { status }),
    remove:     (id)          => api.delete(`/jobs/${id}`),
    pay:        (id)          => api.post(`/jobs/${id}/pay`),

    getApplications:     (jobId)               => api.get(`/jobs/${jobId}/applications`),
    shortlist:           (jobId, appId, data)  => api.post(`/jobs/${jobId}/applications/${appId}/shortlist`, data),
    removeShortlist:     (jobId, appId)        => api.delete(`/jobs/${jobId}/applications/${appId}/shortlist`),
    updateAppStatus:     (jobId, appId, status)=> api.patch(`/jobs/${jobId}/applications/${appId}/status`, { status }),
};

export const interviewAPI = {
    // schedule() removed — interviews go through the executive approval flow
    // (interviewRequestAPI.submit). Direct slot creation is disabled server-side.
    list:     ()     => api.get('/companies/interviews'),
    update:   (id, data) => api.patch(`/companies/interviews/${id}`, data),
};

export const offerAPI = {
    send:   (data)    => api.post('/companies/offers', data),
    list:   ()        => api.get('/companies/offers'),
    update: (id, data)=> api.patch(`/companies/offers/${id}`, data),
};

export const aiCompanyAPI = {
    getJobMatchResults: (jobId) => api.get(`/ai/match-results/job/${jobId}`),
    saveRejectionFeedback: (data) => api.post('/ai/rejection-feedback', data),
};

export const candidateResumeAPI = {
    download: (candidateId) =>
        api.get(`/companies/candidates/${candidateId}/resume`, { responseType: 'blob' }),
    getSkills: (candidateId) =>
        api.get(`/companies/candidates/${candidateId}/skills`),
};

export const companyRequestAPI = {
    submit: (data) => api.post('/companies/requests', data),
    list:   ()     => api.get('/companies/requests'),
};

export const talentPoolAPI = {
    list:             (params)            => api.get('/companies/talent', { params }),
    expressInterest:  (candidateId, data) => api.post(`/companies/talent/${candidateId}/interest`, data),
    activationStatus: ()                  => api.get('/companies/activation-status'),
};

export const premiumAPI = {
    request: (note) => api.post('/companies/premium/request', { note }),
};
