// Centralized Configuration for API Endpoints
// Backend base URL is read from frontend/.env (VITE_API_BASE_URL), so it can
// differ per environment without touching code.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:2952';

export const API_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/api/auth/login/`,
  LOGOUT: `${API_BASE_URL}/api/auth/logout/`,
  TOKEN_REFRESH: `${API_BASE_URL}/api/token/refresh/`,
  USERS: `${API_BASE_URL}/api/auth/users/`,
  VALIDATE_DATA: `${API_BASE_URL}/api/data-process/validate/`,
  UPLOADS: `${API_BASE_URL}/api/data-process/uploads/`,
  UPLOAD_GEOJSON: (id) => `${API_BASE_URL}/api/data-process/uploads/${id}/geojson/`,
  UPLOAD_PUSH_TO_DATABASE: (id) => `${API_BASE_URL}/api/data-process/uploads/${id}/push-to-database/`,
  GIS_CONNECTIONS: `${API_BASE_URL}/api/auth/gis-connections/`,
  LOAD_DATA: `${API_BASE_URL}/api/data-process/load-data/`,
  // `filters`: optional array of { field, op, value } conditions, combined
  // with AND server-side (op defaults to "=" if omitted). Backed by
  // LoadDataView's `filters` query param — see documentation/Api_document.md.
  LOAD_DATA_TABLE: (table, filters) => {
    const base = `${API_BASE_URL}/api/data-process/load-data/?table=${encodeURIComponent(table)}`;
    return filters && filters.length > 0
      ? `${base}&filters=${encodeURIComponent(JSON.stringify(filters))}`
      : base;
  },
  // Backs the attribute-filter builder's searchable field/value dropdowns.
  LOAD_DATA_COLUMNS: (table) => `${API_BASE_URL}/api/data-process/load-data/columns/?table=${encodeURIComponent(table)}`,
  LOAD_DATA_VALUES: (table, field) =>
    `${API_BASE_URL}/api/data-process/load-data/values/?table=${encodeURIComponent(table)}&field=${encodeURIComponent(field)}`,
};
