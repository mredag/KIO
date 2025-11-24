import { AxiosError } from 'axios';

/**
 * Error handler utilities for frontend
 * Requirements: 32.1 - User-friendly error messages
 */

export interface ApiError {
  message: string;
  statusCode?: number;
  details?: any;
}

/**
 * Extract user-friendly error message from API error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    // API error response
    if (error.response?.data?.error) {
      return error.response.data.error;
    }

    // Network error
    if (error.code === 'ERR_NETWORK') {
      return 'Unable to connect to the server. Please check your network connection.';
    }

    // Timeout error
    if (error.code === 'ECONNABORTED') {
      return 'Request timed out. Please try again.';
    }

    // HTTP status errors
    if (error.response?.status === 401) {
      return 'You are not authorized. Please log in again.';
    }

    if (error.response?.status === 403) {
      return 'You do not have permission to perform this action.';
    }

    if (error.response?.status === 404) {
      return 'The requested resource was not found.';
    }

    if (error.response?.status === 500) {
      return 'A server error occurred. Please try again later.';
    }

    // Generic API error
    return error.message || 'An unexpected error occurred.';
  }

  // JavaScript Error
  if (error instanceof Error) {
    return error.message;
  }

  // Unknown error
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Parse API error into structured format
 */
export function parseApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    return {
      message: getErrorMessage(error),
      statusCode: error.response?.status,
      details: error.response?.data?.details,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }

  return {
    message: 'An unexpected error occurred',
  };
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return error.code === 'ERR_NETWORK' || !error.response;
  }
  return false;
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return error.response?.status === 401;
  }
  return false;
}

/**
 * Log error to console in development
 */
export function logError(error: unknown, context?: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[Error${context ? ` - ${context}` : ''}]:`, error);
  }
}

/**
 * Toast notification helper for errors
 */
export function showErrorToast(error: unknown, context?: string): void {
  const message = getErrorMessage(error);
  logError(error, context);
  
  // You can integrate with a toast library here
  // For now, we'll use console.error
  console.error(`Error${context ? ` (${context})` : ''}: ${message}`);
}
