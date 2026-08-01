// Centralized Configuration for API Endpoints

export const API_BASE_URL = 'http://localhost:2952';

export const API_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/api/auth/login/`,
  LOGOUT: `${API_BASE_URL}/api/auth/logout/`,
  TOKEN_REFRESH: `${API_BASE_URL}/api/token/refresh/`,
  USERS: `${API_BASE_URL}/api/auth/users/`,
  VALIDATE_DATA: `${API_BASE_URL}/api/data-process/validate/`,
};
