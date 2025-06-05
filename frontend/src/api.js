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
  getProjectById: (projectId) => `${BASE_URL}/projects/${projectId}/`,
  updateProject: (projectId) => `${BASE_URL}/projects/update/${projectId}/`,
  deleteProject: (projectId) => `${BASE_URL}/projects/delete/${projectId}/`,

  // Task-related routes
  getTasks: `${BASE_URL}/tasks/`,  // GET all tasks
  getTask: (taskId) => `${BASE_URL}/task/${taskId}/`, 
  getAnnotations: (taskId) => `${BASE_URL}/tasks/${taskId}/annotations/`,
  saveAnnotations: (taskId) => `${BASE_URL}/tasks/${taskId}/save_annotations/`,  // POST to save annotations for a task
};
