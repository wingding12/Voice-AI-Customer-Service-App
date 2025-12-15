/**
 * API Configuration for production and development environments
 */

// Get base URL from environment or use relative path for same-origin deployments
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// WebSocket URL (uses same origin if not specified)
export const WS_URL = import.meta.env.VITE_WS_URL || 
  (typeof window !== 'undefined' 
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
    : '');

// Full API endpoint helper
export const getApiUrl = (path: string): string => {
  const base = API_BASE_URL || '';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};

// Socket.io configuration
export const getSocketConfig = () => ({
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  ...(API_BASE_URL ? { } : {}), // Use default if same origin
});

export default {
  API_BASE_URL,
  WS_URL,
  getApiUrl,
  getSocketConfig,
};

