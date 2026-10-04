import api from './axios';

export const publicAPI = {
    contact: (data) => api.post('/public/contact', data),
};
