import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API runs on :6001; the proxy keeps everything on one
// origin so the session cookie works without CORS.
//
// When tunneling with ngrok, point ngrok at THIS dev server (port 5173),
// not at port 80 — Vite's proxy below handles forwarding /api calls to
// Express on :6001, so one tunnel covers both frontend and backend.
//   ngrok http 5173
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // allow connections from outside localhost (needed for ngrok/LAN access)
    proxy: {
      '/api': 'http://localhost:6001',
    },
    // Vite blocks unknown Host headers (DNS-rebinding protection). A leading
    // dot allows every subdomain, so rotating free ngrok addresses still work
    // while other hosts stay blocked.
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.app', '.ngrok.io'],
    // The dev server is public through ngrok, so send the basic protections
    // the production server (helmet) sends too.
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    },
  },
});