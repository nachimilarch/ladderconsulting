import api from './axios';

export const employeeAPI = {
    getAll: (params) => api.get('/employees', { params }),
    getOne: (id) => api.get(`/employees/${id}`),
    getAvailableUsers: () => api.get('/employees/available-users'),
    getStats: () => api.get('/employees/stats'),
    create: (data) => api.post('/employees', data),
    update: (id, data) => api.put(`/employees/${id}`, data),
    assignRoleDept: (id, data) => api.put(`/employees/${id}/assign-role-department`, data),
    remove: (id) => api.delete(`/employees/${id}`),
    getAttendance: (id, params) => api.get(`/employees/${id}/attendance`, { params }),
    addAttendance: (id, data) => api.post(`/employees/${id}/attendance`, data),
};

export const callAPI = {
    log: (data) => api.post('/calls', data),
    getAll: (params) => api.get('/calls', { params }),
    update: (id, data) => api.put(`/calls/${id}`, data),
    remove: (id) => api.delete(`/calls/${id}`),
};

export const leadAPI = {
    getAll: (params) => api.get('/leads', { params }),
    getOne: (id) => api.get(`/leads/${id}`),
    create: (data) => api.post('/leads', data),
    update: (id, data) => api.put(`/leads/${id}`, data),
    updateStage: (id, stage) => api.put(`/leads/${id}/stage`, { stage }),
    assign: (id, assigned_to) => api.put(`/leads/${id}/assign`, { assigned_to }),
    remove: (id) => api.delete(`/leads/${id}`),
};

export const taskAPI = {
    getAll: (params) => api.get('/tasks', { params }),
    getOne: (id) => api.get(`/tasks/${id}`),
    create: (data) => api.post('/tasks', data),
    updateStatus: (id, status, time_logged_hrs) => api.patch(`/tasks/${id}/status`, { status, time_logged_hrs }),
    addNote: (id, note) => api.post(`/tasks/${id}/notes`, { note }),
    getNotes: (id) => api.get(`/tasks/${id}/notes`),
    remove: (id) => api.delete(`/tasks/${id}`),
};

export const reportAPI = {
    hiring: (params) => api.get('/reports/hiring', { params }),
    hr: (params) => api.get('/reports/hr', { params }),
    calls: (params) => api.get('/reports/calls', { params }),
    leads: (params) => api.get('/reports/leads', { params }),
    productivity: (params) => api.get('/reports/productivity', { params }),
};

export const packageRequestAPI = {
    list:     ()           => api.get('/hr/package-requests'),
    activate: (id)         => api.post(`/hr/package-requests/${id}/activate`),
    dismiss:  (id, reason) => api.post(`/hr/package-requests/${id}/dismiss`, { reason }),
};

export const hrCompanyAPI = {
    list: () => api.get('/hr/companies'),
};
