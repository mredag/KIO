import axios from 'axios';
import { logError, isAuthError } from './errorHandler';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for session cookies
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    logError(error, 'API Request');
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
// Requirements: 32.1 - User-friendly error messages
api.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    }
    return response;
  },
  (error) => {
    // Log error
    logError(error, 'API Response');

    // Handle authentication errors
    if (isAuthError(error)) {
      // Clear auth state from localStorage to prevent redirect loop
      localStorage.removeItem('auth-storage');
      
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/admin/login')) {
        window.location.href = '/admin/login';
      }
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network error: Unable to connect to server');
    }

    return Promise.reject(error);
  }
);

export default api;
