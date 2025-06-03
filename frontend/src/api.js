const BASE_URL = 'http://localhost:8000/api';

export const API_ROUTES = {
  createUser: `${BASE_URL}/users/create/`,
  getUsers: `${BASE_URL}/users/`,
  login: `${BASE_URL}/users/login/`,
  updateProfile: `${BASE_URL}/users/update/`,  // use like updateUser + userId + '/'
};
