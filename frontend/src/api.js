const BASE_URL = 'http://localhost:8000/api';

export const API_ROUTES = {
  // User-related routes
  createUser: `${BASE_URL}/users/create/`,
  getUsers: `${BASE_URL}/users/`,
  login: `${BASE_URL}/users/login/`,
  updateProfile: (userId) => `${BASE_URL}/users/update/${userId}/`,

  // Project-related routes
  getProjects: `${BASE_URL}/projects/`,
  createProject: `${BASE_URL}/projects/create/`,
  getProjectById: (projectId) => `${BASE_URL}/projects/${projectId}/`,  // ✅ already correct
  updateProject: (projectId) => `${BASE_URL}/projects/update/${projectId}/`,  // ✅ used in edit
  deleteProject: (projectId) => `${BASE_URL}/projects/delete/${projectId}/`,

  // Task-related routes
  getTasks: `${BASE_URL}/tasks/`,
  getTask: (taskId) => `${BASE_URL}/task/${taskId}/`,
  getAnnotations: (taskId) => `${BASE_URL}/tasks/${taskId}/annotations/`,
  saveAnnotations: (taskId) => `${BASE_URL}/tasks/${taskId}/save_annotations/`,
  exportAnnotations: (taskId) => `${BASE_URL}/tasks/${taskId}/export_annotations/`,
  deleteAnnotation: (annotationId) => `${BASE_URL}/annotations/${annotationId}/`,
  autoAnnotate: (taskId) => `${BASE_URL}/tasks/${taskId}/auto_annotate/`,
};
