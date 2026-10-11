// Central API configuration.
//
// The app talks to the backend on the same origin (Vite proxies /api and /ws to
// the FastAPI server during development; a reverse proxy handles it in prod).
// Set VITE_API_BASE at build time to point at a different origin if needed.
const configured = import.meta.env.VITE_API_BASE as string | undefined;

export const API_BASE = configured ? `${configured.replace(/\/$/, '')}/api` : '/api';

/** Build the authenticated WebSocket URL for the realtime channel. */
export function getWebSocketUrl(): string {
  const token = localStorage.getItem('token');
  if (configured) {
    const wsOrigin = configured.replace(/^http/, 'ws').replace(/\/$/, '');
    return token ? `${wsOrigin}/ws?token=${encodeURIComponent(token)}` : `${wsOrigin}/ws`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const base = `${protocol}//${window.location.host}/ws`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}
