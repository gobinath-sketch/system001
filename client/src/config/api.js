const fallbackBase = `${window.location.protocol}//${window.location.hostname}:5000`;

export const API_BASE = import.meta.env.VITE_API_URL || fallbackBase;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE;

