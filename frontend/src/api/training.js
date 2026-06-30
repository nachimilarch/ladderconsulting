import api from './axios';

// Candidate-facing
export const myTrainingAPI = {
    getAssignments: () => api.get('/training/my'),
    getAssignmentDetail: (assignmentId) => api.get(`/training/my/${assignmentId}`),
    completeModule: (assignmentId, moduleId) =>
        api.patch(`/training/my/${assignmentId}/modules/${moduleId}/complete`),
    submitQuiz: (assignmentId, moduleId, answers) =>
        api.post(`/training/my/${assignmentId}/modules/${moduleId}/quiz`, { answers }),
    getCertificates: () => api.get('/training/my/certificates'),
    getAIRecommendations: () => api.get('/training/my/ai-recommendations'),
};

// Admin / Trainer
export const adminTrainingAPI = {
    getCourses: () => api.get('/training/courses'),
    getCourse: (id) => api.get(`/training/courses/${id}`),
    createCourse: (data) => api.post('/training/courses', data),
    updateCourse: (id, data) => api.put(`/training/courses/${id}`, data),
    deleteCourse: (id) => api.delete(`/training/courses/${id}`),
    addModule: (courseId, data) => api.post(`/training/courses/${courseId}/modules`, data),
    updateModule: (id, data) => api.put(`/training/modules/${id}`, data),
    deleteModule: (id) => api.delete(`/training/modules/${id}`),

    getBenchmarks: () => api.get('/training/benchmarks'),
    createBenchmark: (data) => api.post('/training/benchmarks', data),
    updateBenchmark: (roleTitle, data) =>
        api.put(`/training/benchmarks/${encodeURIComponent(roleTitle)}`, data),

    getAllAssignments: () => api.get('/training/assignments'),
    getEmployeeAssignments: (employeeId) => api.get(`/training/assignments/${employeeId}`),
    manualAssign: (data) => api.post('/training/assignments/manual', data),
};
