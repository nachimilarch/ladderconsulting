import api from './axios';

export const employeeAPI = {
    getAll: () => api.get('/employees'),
    create: (data) => api.post('/employees', data),
    update: (id, data) => api.put(`/employees/${id}`, data),
    remove: (id) => api.delete(`/employees/${id}`),
};

export const callAPI = {
    log: (data) => api.post('/calls', data),
    getAll: (params) => api.get('/calls', { params }),
};

export const leadAPI = {
    getAll: (params) => api.get('/leads', { params }),
    create: (data) => api.post('/leads', data),
    update: (id, data) => api.put(`/leads/${id}`, data),
    updateStage: (id, stage) => api.put(`/leads/${id}/stage`, { stage }),
    remove: (id) => api.delete(`/leads/${id}`),
};

export const taskAPI = {
    getAll: (params) => api.get('/tasks', { params }),
    create: (data) => api.post('/tasks', data),
    update: (id, data) => api.put(`/tasks/${id}`, data),
    updateStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }),
    addNote: (id, note) => api.post(`/tasks/${id}/notes`, { note }),
    getNotes: (id) => api.get(`/tasks/${id}/notes`),
    remove: (id) => api.delete(`/tasks/${id}`),
};

export const reportAPI = {
    hr: (params) => api.get('/reports/hr', { params }),
};