import api from './axios';

const B = '/outreach/ai';

export const outreachAiAPI = {
    status:       ()                     => api.get(`${B}/status`),
    // contacts (instant)
    analyseList:  (id)                   => api.get(`${B}/lists/${id}/analysis`),
    segmentContacts: (id, key, channel)  => api.get(`${B}/lists/${id}/segments/${encodeURIComponent(key)}/contacts`, { params: { channel } }),
    saveSegment:  (id, key, data)        => api.post(`${B}/lists/${id}/segments/${encodeURIComponent(key)}/save`, data),
    applyTags:    (id, apply)            => api.post(`${B}/lists/${id}/tags`, { apply }),
    cleanup:      (id, actions, apply)   => api.post(`${B}/lists/${id}/cleanup`, { actions, apply }),
    // copy + replies (instant)
    checkCopy:    (data)                 => api.post(`${B}/check-copy`, data),
    triage:       (ids)                  => api.get(`${B}/replies/triage`, { params: { ids: ids.join(',') } }),
    insightStats: (days)                 => api.get(`${B}/insights/stats`, { params: { days } }),
    // scheduling
    plan:         (data)                 => api.post(`${B}/schedule-plan`, data),
    applyPlan:    (data)                 => api.post(`${B}/schedule-plan/apply`, data),
    // writing tasks (AI model, background)
    startTask:    (kind, input)          => api.post(`${B}/tasks`, { kind, input }),
    getTask:      (id)                   => api.get(`${B}/tasks/${id}`),
    recent:       (kind, limit = 8)      => api.get(`${B}/tasks`, { params: { kind, limit } }),
};
