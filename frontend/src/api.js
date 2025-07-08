const BASE_URL = 'http://localhost:8000/api';


export const API_ROUTES = {
  // User-related routes
  createUser: `${BASE_URL}/users/create/`,
  getUsers: `${BASE_URL}/users/`,
  login: `${BASE_URL}/users/login/`,
  updateProfile: (userId) => `${BASE_URL}/users/update/${userId}/`,
  getSuperProjects: (managerId) => `${BASE_URL}/superprojects/?manager_id=${managerId}`,
  getSuperProjectById: (id) => `${BASE_URL}/superprojects/${id}/`,
  updateSuperProject: (id) => `${BASE_URL}/superprojects/update/${id}/`,
  createSuperProject: `${BASE_URL}/superprojects/create/`,
  getProjectsByUserOrManager: (user) =>
  user.role === 'manager'
    ? `${BASE_URL}/projects/?manager_id=${user.id}`
    : `${BASE_URL}/projects/?user_id=${user.id}`,

  
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
  exportAnnotations: (taskId) => `${BASE_URL}/tasks/${taskId}/export/`,
  deleteAnnotation: (annotationId) => `${BASE_URL}/annotations/${annotationId}/`,
  exportProjectAnnotations: (projectId) => `${BASE_URL}/projects/${projectId}/export/`,
  exportSuperProjectAnnotations: (superProjectId) => `${BASE_URL}/superprojects/${superProjectId}/export/`,

  inference: `${BASE_URL}/inference/`, // No project ID needed now
  deleteAnnotationsBulk: `${BASE_URL}/delete-annotations/`,
  

};
