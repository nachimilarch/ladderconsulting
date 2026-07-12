import api from './axios';

export const contactListAPI = {
    upload:         (formData) => api.post('/outreach/contact-lists/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    getAll:         (params)   => api.get('/outreach/contact-lists', { params }),
    getOne:         (id)       => api.get(`/outreach/contact-lists/${id}`),
    getContacts:    (id, params) => api.get(`/outreach/contact-lists/${id}/contacts`, { params }),
    remove:         (id)       => api.delete(`/outreach/contact-lists/${id}`),
    unsubscribe:    (id)       => api.patch(`/outreach/contacts/${id}/unsubscribe`),
    callHistory:    (id)       => api.get(`/outreach/contacts/${id}/call-history`),
};

export const emailCampaignAPI = {
    create:  (data)     => api.post('/outreach/email-campaigns', data),
    getAll:  (params)   => api.get('/outreach/email-campaigns', { params }),
    getOne:  (id)       => api.get(`/outreach/email-campaigns/${id}`),
    update:  (id, data) => api.put(`/outreach/email-campaigns/${id}`, data),
    send:    (id)       => api.post(`/outreach/email-campaigns/${id}/send`),
    pause:   (id)       => api.post(`/outreach/email-campaigns/${id}/pause`),
    remove:  (id)       => api.delete(`/outreach/email-campaigns/${id}`),
};

export const replyAPI = {
    getAll:   (params)        => api.get('/outreach/replies', { params }),
    getOne:   (id)            => api.get(`/outreach/replies/${id}`),
    reply:    (id, data)      => api.post(`/outreach/replies/${id}/reply`, data),
    convert:  (id)            => api.patch(`/outreach/replies/${id}/convert`),
    ignore:   (id)            => api.patch(`/outreach/replies/${id}/ignore`),
    assign:   (id, userId)    => api.patch(`/outreach/replies/${id}/assign`, { assigned_to: userId }),
};

export const waCampaignAPI = {
    create:    (data)    => api.post('/outreach/whatsapp-campaigns', data),
    getAll:    (params)  => api.get('/outreach/whatsapp-campaigns', { params }),
    getOne:    (id)      => api.get(`/outreach/whatsapp-campaigns/${id}`),
    send:      (id)      => api.post(`/outreach/whatsapp-campaigns/${id}/send`),
};

export const vaartabotAPI = {
    getCredits:      ()           => api.get('/outreach/whatsapp/credits'),
    listWebhooks:    ()           => api.get('/outreach/whatsapp/webhooks'),
    registerWebhook: (data)       => api.post('/outreach/whatsapp/webhooks', data),
    updateWebhook:   (id, data)   => api.patch(`/outreach/whatsapp/webhooks/${id}`, data),
    testWebhook:     (id)         => api.post(`/outreach/whatsapp/webhooks/${id}/test`),
    deleteWebhook:   (id)         => api.delete(`/outreach/whatsapp/webhooks/${id}`),
};

export const autoReplyAPI = {
    getAll:  ()          => api.get('/outreach/whatsapp/auto-replies'),
    create:  (data)      => api.post('/outreach/whatsapp/auto-replies', data),
    update:  (id, data)  => api.put(`/outreach/whatsapp/auto-replies/${id}`, data),
    remove:  (id)        => api.delete(`/outreach/whatsapp/auto-replies/${id}`),
};

export const waTemplateAPI = {
    getAll:   (params)   => api.get('/outreach/whatsapp/templates', { params }),
    sync:     ()         => api.post('/outreach/whatsapp/templates/sync'),
    create:   (data)     => api.post('/outreach/whatsapp/templates', data),
    update:   (id, data) => api.put(`/outreach/whatsapp/templates/${id}`, data),
    remove:   (id)       => api.delete(`/outreach/whatsapp/templates/${id}`),
};

export const emailAutoReplyAPI = {
    getAll:  ()          => api.get('/outreach/email/auto-replies'),
    create:  (data)      => api.post('/outreach/email/auto-replies', data),
    update:  (id, data)  => api.put(`/outreach/email/auto-replies/${id}`, data),
    remove:  (id)        => api.delete(`/outreach/email/auto-replies/${id}`),
};

export const outreachCallAPI = {
    getAll:  (params)   => api.get('/outreach/calls', { params }),
    log:     (data)     => api.post('/outreach/calls', data),
    update:  (id, data) => api.put(`/outreach/calls/${id}`, data),
};

export const analyticsAPI = {
    campaigns:   (params) => api.get('/outreach/analytics/campaigns', { params }),
    conversions: (params) => api.get('/outreach/analytics/conversions', { params }),
    adminAll:    (params) => api.get('/admin/outreach/campaigns', { params }),
};
