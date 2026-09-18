import api from './axios';

export const aiSubscriptionAPI = {
    status:     ()  => api.get('/ai-subscription/status'),
    subscribe:  ()  => api.post('/ai-subscription/subscribe'),
    payInvoice: ()  => api.post('/ai-subscription/pay-invoice'),
    cancel:     ()  => api.post('/ai-subscription/cancel'),
};
