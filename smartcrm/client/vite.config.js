import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The proxy sends every /api request to the Express backend,
// so the React code never needs the backend address (and no CORS problems).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
