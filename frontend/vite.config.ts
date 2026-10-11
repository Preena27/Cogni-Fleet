import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The frontend uses same-origin relative URLs. During development Vite proxies
// API and WebSocket traffic to the FastAPI server on port 8000.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
