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
    list:            (params)           => api.get('/companies/talent', { params }),
    expressInterest: (candidateId, data) => api.post(`/companies/talent/${candidateId}/interest`, data),

    unlockStatus: (candidateIds = [])   => api.get('/companies/talent/unlock-status', { params: candidateIds.length ? { candidateIds: candidateIds.join(',') } : {} }),
    unlock:       (candidateId, tier)   => api.post(`/companies/talent/${candidateId}/unlock`, tier ? { tier } : {}),
    fullProfile:    (candidateId)         => api.get(`/companies/talent/${candidateId}/profile`),
    previewProfile: (candidateId)         => api.get(`/companies/talent/${candidateId}/preview`),
    downloadResume: (candidateId)         => api.get(`/companies/talent/${candidateId}/resume`, { responseType: 'blob' }),
    applyToPipeline: (candidateId, jobId) => api.post(`/companies/talent/${candidateId}/apply`, { job_id: jobId }),

    packageStatus:   ()                 => api.get('/companies/package-status'),
    buyPack:         (tier = 'pack_4')   => api.post('/companies/talent/buy-pack', { tier }),
    requestPlatinum: (note)             => api.post('/companies/platinum-request', note ? { note } : {}),
    requestPackage:  (tier, note)       => api.post('/companies/package-request', { tier, ...(note ? { note } : {}) }),
};
