import api from './axios';

export const recruitmentAPI = {
    listJobs: () => api.get('/recruitment/jobs'),
    getJob: (jobId) => api.get(`/recruitment/jobs/${jobId}`),
    uploadResumes: (jobId, files) => {
        const formData = new FormData();
        files.forEach(f => formData.append('resumes', f));
        return api.post(`/recruitment/jobs/${jobId}/resumes`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    uploadResumesToPool: (files) => {
        const formData = new FormData();
        files.forEach(f => formData.append('resumes', f));
        return api.post('/recruitment/resumes', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    listBatches: (params) => api.get('/recruitment/batches', { params }),
    getBatch: (id) => api.get(`/recruitment/batches/${id}`),
    deleteCandidate: (candidateId) => api.delete(`/recruitment/candidates/${candidateId}`),

    listTalentPool: (params) => api.get('/recruitment/talent', { params }),
    assignCandidateToJob: (jobId, candidateId) =>
        api.post(`/recruitment/jobs/${jobId}/assign-candidate`, { candidateId }),

    getCandidateProfile: (candidateId, jobId) =>
        api.get(`/recruitment/candidates/${candidateId}/profile`, jobId ? { params: { jobId } } : {}),

    downloadResume: (resumeId) =>
        api.get(`/recruitment/resumes/${resumeId}/download`, { responseType: 'blob' }),

    listTalentInterests: () => api.get('/recruitment/talent-interests'),
    actOnTalentInterest: (notifId, jobId) =>
        api.post(`/recruitment/talent-interests/${notifId}/assign`, { job_id: jobId || undefined }),

    // Platinum profile-unlock approval queue (exec/admin)
    listProfileUnlockRequests: () => api.get('/recruitment/profile-unlock-requests'),
    approveProfileUnlock: (requestId) => api.put(`/recruitment/profile-unlock-requests/${requestId}/approve`),
    rejectProfileUnlock: (requestId, reason) => api.put(`/recruitment/profile-unlock-requests/${requestId}/reject`, { reason }),
};
